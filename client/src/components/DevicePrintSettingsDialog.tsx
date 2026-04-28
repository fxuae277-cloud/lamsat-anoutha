/**
 * DevicePrintSettingsDialog — per-device print profile UI.
 *
 * Owns the "ملف الطباعة لهذا الجهاز" controls. The settings live in
 * localStorage (lamsa.deviceProfile) on the cashier PC and are saved
 * immediately on every change — no global Save bar, no /api/settings
 * round-trip — so each cashier device keeps its own printer + paper width.
 *
 * Rendered as a button + dialog so it can drop into the POS topbar (the
 * cashier sets up the printer from their own session, no owner login
 * required).
 */
import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plug, Printer, RefreshCw, Loader2, CheckCircle2, XCircle, Settings2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  printTestInvoiceLocal,
  checkLocalPrintHealth,
  loadPrintersLocal,
  getDeviceProfile,
  setDeviceProfile,
  DEFAULT_LOCAL_PRINT_URL,
  DEFAULT_LOCAL_PRINT_API_KEY,
  type DeviceProfile,
  type PaperWidth,
} from "@/lib/localPrintClient";

const FIXED_PRINTERS = ["EPSON TM-T100 Receipt", "P0S-58", "TSC TTP-244M Pro"];

interface Props {
  /** Render the trigger button. If omitted, a default ghost button is used. */
  trigger?: React.ReactNode;
}

export function DevicePrintSettingsDialog({ trigger }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [profile, setProfileState] = useState<DeviceProfile>(() => getDeviceProfile());
  const [status, setStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [testingConnection, setTestingConnection] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [testPrinting, setTestPrinting] = useState(false);

  // Re-read from localStorage when the dialog opens, so a fresh-loaded
  // profile from another tab/device shows up correctly.
  useEffect(() => {
    if (open) setProfileState(getDeviceProfile());
  }, [open]);

  const updateProfile = useCallback((patch: Partial<DeviceProfile>) => {
    setProfileState(prev => setDeviceProfile({ ...prev, ...patch }));
  }, []);

  const allPrinters = Array.from(new Set([...FIXED_PRINTERS, ...discovered]));

  const handleTestConnection = async () => {
    // Always read the latest profile from localStorage (input changes are
    // persisted on every keystroke, but local React state can lag).
    const live = getDeviceProfile();
    const baseUrl = (live.baseUrl || DEFAULT_LOCAL_PRINT_URL).trim();
    console.log("Local print baseUrl:", baseUrl);
    console.log("Calling health endpoint:", `${baseUrl}/health`);
    setTestingConnection(true);
    const result = await checkLocalPrintHealth(baseUrl);
    setTestingConnection(false);
    console.log("Health result:", result);
    if (result.ok) {
      setStatus("connected");
      toast({ title: "خدمة الطباعة المحلية متصلة", description: result.baseUrl });
    } else {
      setStatus("disconnected");
      toast({
        title: "خدمة الطباعة المحلية غير متصلة",
        description: result.error
          ? `${baseUrl} — ${result.error}`
          : `تأكد أن الرابط هو ${DEFAULT_LOCAL_PRINT_URL}`,
        variant: "destructive",
      });
    }
  };

  const handleLoadPrinters = async () => {
    const live = getDeviceProfile();
    const baseUrl = (live.baseUrl || DEFAULT_LOCAL_PRINT_URL).trim();
    const apiKey = live.apiKey || DEFAULT_LOCAL_PRINT_API_KEY;
    console.log("Local print baseUrl:", baseUrl);
    console.log("Calling printers endpoint:", `${baseUrl}/printers`);
    setLoadingPrinters(true);
    const result = await loadPrintersLocal(baseUrl, apiKey);
    setLoadingPrinters(false);
    console.log("Printers result:", result);
    if (result.ok) {
      setStatus("connected");
      setDiscovered(result.printers);
      toast({
        title: "تم تحميل الطابعات",
        description: `${result.printers.length} طابعة من ${result.baseUrl}`,
      });
    } else {
      setStatus("disconnected");
      toast({
        title: "خدمة الطباعة المحلية غير متصلة",
        description: result.error
          ? `${baseUrl} — ${result.error}`
          : `تأكد أن الرابط هو ${DEFAULT_LOCAL_PRINT_URL} وأن الخدمة تعمل`,
        variant: "destructive",
      });
    }
  };

  const handleTestReceipt = async () => {
    // Re-read the live profile so the receipt test uses the current device
    // settings (baseUrl / printer / paperWidth) — never a stale snapshot.
    const live = getDeviceProfile();
    setProfileState(live);

    const baseUrl = (live.baseUrl || DEFAULT_LOCAL_PRINT_URL).trim();
    const receiptPrinterName = live.receiptPrinterName?.trim() ?? "";
    const paperWidth = live.paperWidth;
    const url = `${baseUrl}/print/invoice`;

    console.log("Local print baseUrl:", baseUrl);
    console.log("Receipt printer:", receiptPrinterName);
    console.log("Paper width:", paperWidth);
    console.log("Calling receipt print endpoint:", url);

    if (!receiptPrinterName) {
      toast({
        title: "خطأ في الطباعة",
        description: "لم يتم اختيار طابعة الفواتير لهذا الجهاز",
        variant: "destructive",
      });
      return;
    }

    // Pre-flight /health: if the service is reachable we must NEVER show
    // "خدمة الطباعة المحلية غير متصلة" — even when the print itself fails.
    const health = await checkLocalPrintHealth(baseUrl);
    console.log("Pre-print health probe:", health);
    if (health.ok) setStatus("connected");

    setTestPrinting(true);
    const result = await printTestInvoiceLocal(receiptPrinterName, paperWidth);
    setTestPrinting(false);
    console.log("Test print result:", result);

    if (result.ok) {
      toast({
        title: "تمت الطباعة",
        description: `${receiptPrinterName} (${paperWidth})`,
      });
      return;
    }

    // Service is up but the print attempt failed — surface the real
    // backend error so the cashier (and we) can see what actually broke.
    if (health.ok) {
      toast({
        title: "فشل الطباعة (الخدمة متصلة)",
        description: result.detail || result.error || "خطأ غير معروف من خدمة الطباعة",
        variant: "destructive",
      });
    } else {
      toast({
        title: "خطأ في طباعة الإيصال التجريبية",
        description: result.detail
          ? `${result.error} — ${result.detail}`
          : result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger ?? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-white hover:bg-white/20 px-2"
            data-testid="button-open-device-print-settings"
          >
            <Settings2 className="w-3.5 h-3.5" /> الطباعة
          </Button>
        )}
      </span>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-pink-600" />
            إعدادات الطباعة لهذا الجهاز
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
            ⓘ هذه الإعدادات خاصة بهذا الجهاز فقط — تُحفظ محلياً على متصفح الكاشير ولا تؤثر على بقية الفروع أو أجهزة الكاشير الأخرى.
          </p>

          <div className="border rounded-lg p-4 space-y-4 bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Plug className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                  ملف الطباعة لهذا الجهاز
                </span>
                {status === "connected" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" /> متصلة
                  </span>
                )}
                {status === "disconnected" && (
                  <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded">
                    <XCircle className="w-3 h-3" /> غير متصلة
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{profile.enabled ? "مفعّلة" : "معطّلة"}</span>
                <Switch
                  checked={profile.enabled}
                  onCheckedChange={v => updateProfile({ enabled: v })}
                  data-testid="switch-local-print-enabled"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">اسم جهاز الكاشير (اختياري)</Label>
              <Input
                value={profile.cashierDeviceName}
                onChange={e => updateProfile({ cashierDeviceName: e.target.value })}
                placeholder="مثال: كاشير 1 — فرع لوى"
                data-testid="input-cashier-device-name"
              />
              <p className="text-xs text-muted-foreground">يساعدك على التمييز بين أجهزة الكاشير عند مراجعة سجلات الطباعة.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">رابط خدمة الطباعة المحلية</Label>
                <Input
                  dir="ltr"
                  className="text-left"
                  value={profile.baseUrl}
                  onChange={e => updateProfile({ baseUrl: e.target.value })}
                  placeholder={DEFAULT_LOCAL_PRINT_URL}
                  data-testid="input-local-print-url"
                />
                <p className="text-xs text-muted-foreground">الرابط الافتراضي: {DEFAULT_LOCAL_PRINT_URL}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">مفتاح API</Label>
                <Input
                  dir="ltr"
                  className="text-left"
                  value={profile.apiKey}
                  onChange={e => updateProfile({ apiKey: e.target.value })}
                  placeholder={DEFAULT_LOCAL_PRINT_API_KEY}
                  data-testid="input-local-print-api-key"
                />
                <p className="text-xs text-muted-foreground">x-lamsa-print-key الافتراضي: {DEFAULT_LOCAL_PRINT_API_KEY}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleTestConnection}
                disabled={testingConnection}
                data-testid="button-test-local-print-connection"
              >
                {testingConnection
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الاختبار...</>
                  : <><Plug className="w-3.5 h-3.5" /> اختبار الاتصال</>}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleLoadPrinters}
                disabled={loadingPrinters}
                data-testid="button-load-local-printers"
              >
                {loadingPrinters
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ التحميل...</>
                  : <><RefreshCw className="w-3.5 h-3.5" /> تحميل الطابعات</>}
              </Button>
            </div>

            {status === "disconnected" && (
              <p className="text-xs text-red-600 dark:text-red-400">
                خدمة الطباعة المحلية غير متصلة — تأكد أن الرابط هو {DEFAULT_LOCAL_PRINT_URL} وأن الخدمة تعمل على هذا الجهاز.
              </p>
            )}
            {status === "connected" && discovered.length > 0 && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                تم اكتشاف {discovered.length} طابعة من خدمة الطباعة المحلية على هذا الجهاز.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-emerald-200 dark:border-emerald-800">
              <div className="space-y-2">
                <Label className="text-sm font-medium">طابعة الفواتير لهذا الجهاز</Label>
                <Select
                  value={profile.receiptPrinterName || "__none__"}
                  onValueChange={v => updateProfile({ receiptPrinterName: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger data-testid="select-device-receipt-printer">
                    <SelectValue placeholder="اختر طابعة الفواتير" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">لم يتم الاختيار</SelectItem>
                    {allPrinters.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!profile.receiptPrinterName && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    لم يتم اختيار طابعة الفواتير لهذا الجهاز
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">مقاس الورق لهذا الجهاز</Label>
                <Select
                  value={profile.paperWidth}
                  onValueChange={v => updateProfile({ paperWidth: v as PaperWidth })}
                >
                  <SelectTrigger data-testid="select-device-paper-width">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58mm (طابعة ضيقة)</SelectItem>
                    <SelectItem value="80mm">80mm (طابعة عريضة)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {profile.paperWidth === "58mm"
                    ? "تخطيط مضغوط مع التفاف لأسماء المنتجات"
                    : "التخطيط الكامل لتصميم الفاتورة"}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
              <Label className="text-sm font-medium">طابعة الملصقات (اختيارية لهذا الجهاز)</Label>
              <Select
                value={profile.labelPrinterName || "__none__"}
                onValueChange={v => updateProfile({ labelPrinterName: v === "__none__" ? "" : v })}
              >
                <SelectTrigger data-testid="select-device-label-printer">
                  <SelectValue placeholder="بدون طابعة ملصقات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون طابعة ملصقات</SelectItem>
                  {allPrinters.map(p => (
                    <SelectItem key={`lbl-${p}`} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">يمكن تركها فارغة على الأجهزة التي لا تستخدم طباعة ملصقات.</p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleTestReceipt}
                disabled={testPrinting}
                data-testid="button-test-receipt-print"
              >
                {testPrinting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جارٍ الطباعة...</>
                  : <><Printer className="w-3.5 h-3.5" /> اختبار طباعة فاتورة</>}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="default" onClick={() => setOpen(false)} data-testid="button-close-device-print-settings">
            تم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
