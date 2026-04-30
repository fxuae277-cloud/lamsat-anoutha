/**
 * DevicePrintSettingsDialog — per-device print profile UI.
 *
 * Per-cashier print settings persisted to localStorage (lamsa.deviceProfile).
 * Saved on every change — no global Save bar, no /api/settings round-trip.
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
import { useI18n } from "@/lib/i18n";
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
  trigger?: React.ReactNode;
}

export function DevicePrintSettingsDialog({ trigger }: Props) {
  const { toast } = useToast();
  const { t } = useI18n();
  const NS = "pos:devicePrint";
  const [open, setOpen] = useState(false);
  const [profile, setProfileState] = useState<DeviceProfile>(() => getDeviceProfile());
  const [status, setStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [testingConnection, setTestingConnection] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [testPrinting, setTestPrinting] = useState(false);

  useEffect(() => {
    if (open) setProfileState(getDeviceProfile());
  }, [open]);

  const updateProfile = useCallback((patch: Partial<DeviceProfile>) => {
    setProfileState(prev => setDeviceProfile({ ...prev, ...patch }));
  }, []);

  const allPrinters = Array.from(new Set([...FIXED_PRINTERS, ...discovered]));

  const handleTestConnection = async () => {
    const live = getDeviceProfile();
    const baseUrl = (live.baseUrl || DEFAULT_LOCAL_PRINT_URL).trim();
    setTestingConnection(true);
    const result = await checkLocalPrintHealth(baseUrl);
    setTestingConnection(false);
    if (result.ok) {
      setStatus("connected");
      toast({ title: t(`${NS}.toastConnectedTitle`), description: result.baseUrl });
    } else {
      setStatus("disconnected");
      toast({
        title: t(`${NS}.toastDisconnectedTitle`),
        description: result.error
          ? `${baseUrl} — ${result.error}`
          : t(`${NS}.toastDisconnectedHint`, { url: DEFAULT_LOCAL_PRINT_URL }),
        variant: "destructive",
      });
    }
  };

  const handleLoadPrinters = async () => {
    const live = getDeviceProfile();
    const baseUrl = (live.baseUrl || DEFAULT_LOCAL_PRINT_URL).trim();
    const apiKey = live.apiKey || DEFAULT_LOCAL_PRINT_API_KEY;
    setLoadingPrinters(true);
    const result = await loadPrintersLocal(baseUrl, apiKey);
    setLoadingPrinters(false);
    if (result.ok) {
      setStatus("connected");
      setDiscovered(result.printers);
      toast({
        title: t(`${NS}.toastPrintersLoaded`),
        description: t(`${NS}.toastPrintersLoadedDesc`, { count: result.printers.length, baseUrl: result.baseUrl }),
      });
    } else {
      setStatus("disconnected");
      toast({
        title: t(`${NS}.toastDisconnectedTitle`),
        description: result.error
          ? `${baseUrl} — ${result.error}`
          : t(`${NS}.toastDisconnectedHintFull`, { url: DEFAULT_LOCAL_PRINT_URL }),
        variant: "destructive",
      });
    }
  };

  const handleTestReceipt = async () => {
    const live = getDeviceProfile();
    setProfileState(live);

    const baseUrl = (live.baseUrl || DEFAULT_LOCAL_PRINT_URL).trim();
    const receiptPrinterName = live.receiptPrinterName?.trim() ?? "";
    const paperWidth = live.paperWidth;

    if (!receiptPrinterName) {
      toast({
        title: t(`${NS}.toastPrintError`),
        description: t(`${NS}.noReceiptPrinter`),
        variant: "destructive",
      });
      return;
    }

    const health = await checkLocalPrintHealth(baseUrl);
    if (health.ok) setStatus("connected");

    setTestPrinting(true);
    const result = await printTestInvoiceLocal(receiptPrinterName, paperWidth);
    setTestPrinting(false);

    if (result.ok) {
      toast({
        title: t(`${NS}.toastPrinted`),
        description: `${receiptPrinterName} (${paperWidth})`,
      });
      return;
    }

    if (health.ok) {
      toast({
        title: t(`${NS}.toastPrintFailedConnected`),
        description: result.detail || result.error || t(`${NS}.toastUnknownError`),
        variant: "destructive",
      });
    } else {
      toast({
        title: t(`${NS}.toastTestPrintError`),
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
            <Settings2 className="w-3.5 h-3.5" /> {t(`${NS}.trigger`)}
          </Button>
        )}
      </span>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-pink-600" />
            {t(`${NS}.title`)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
            ⓘ {t(`${NS}.description`)}
          </p>

          <div className="border rounded-lg p-4 space-y-4 bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Plug className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                  {t(`${NS}.profileLabel`)}
                </span>
                {status === "connected" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3" /> {t(`${NS}.connected`)}
                  </span>
                )}
                {status === "disconnected" && (
                  <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded">
                    <XCircle className="w-3 h-3" /> {t(`${NS}.disconnected`)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{profile.enabled ? t(`${NS}.enabled`) : t(`${NS}.disabledLabel`)}</span>
                <Switch
                  checked={profile.enabled}
                  onCheckedChange={v => updateProfile({ enabled: v })}
                  data-testid="switch-local-print-enabled"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t(`${NS}.cashierDeviceName`)}</Label>
              <Input
                value={profile.cashierDeviceName}
                onChange={e => updateProfile({ cashierDeviceName: e.target.value })}
                placeholder={t(`${NS}.cashierDeviceNamePlaceholder`)}
                data-testid="input-cashier-device-name"
              />
              <p className="text-xs text-muted-foreground">{t(`${NS}.cashierDeviceNameHelp`)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t(`${NS}.baseUrl`)}</Label>
                <Input
                  dir="ltr"
                  className="text-end"
                  value={profile.baseUrl}
                  onChange={e => updateProfile({ baseUrl: e.target.value })}
                  placeholder={DEFAULT_LOCAL_PRINT_URL}
                  data-testid="input-local-print-url"
                />
                <p className="text-xs text-muted-foreground">{t(`${NS}.defaultUrlPrefix`)} {DEFAULT_LOCAL_PRINT_URL}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t(`${NS}.apiKey`)}</Label>
                <Input
                  dir="ltr"
                  className="text-end"
                  value={profile.apiKey}
                  onChange={e => updateProfile({ apiKey: e.target.value })}
                  placeholder={DEFAULT_LOCAL_PRINT_API_KEY}
                  data-testid="input-local-print-api-key"
                />
                <p className="text-xs text-muted-foreground">{t(`${NS}.defaultApiKeyPrefix`)} {DEFAULT_LOCAL_PRINT_API_KEY}</p>
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
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t(`${NS}.testingConnection`)}</>
                  : <><Plug className="w-3.5 h-3.5" /> {t(`${NS}.testConnection`)}</>}
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
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t(`${NS}.loadingPrinters`)}</>
                  : <><RefreshCw className="w-3.5 h-3.5" /> {t(`${NS}.loadPrinters`)}</>}
              </Button>
            </div>

            {status === "disconnected" && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {t(`${NS}.disconnectedHelp`, { url: DEFAULT_LOCAL_PRINT_URL })}
              </p>
            )}
            {status === "connected" && discovered.length > 0 && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {t(`${NS}.discoveredCount`, { count: discovered.length })}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-emerald-200 dark:border-emerald-800">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t(`${NS}.receiptPrinter`)}</Label>
                <Select
                  value={profile.receiptPrinterName || "__none__"}
                  onValueChange={v => updateProfile({ receiptPrinterName: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger data-testid="select-device-receipt-printer">
                    <SelectValue placeholder={t(`${NS}.selectReceiptPrinter`)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t(`${NS}.noneSelected`)}</SelectItem>
                    {allPrinters.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!profile.receiptPrinterName && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {t(`${NS}.noReceiptPrinter`)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t(`${NS}.paperWidth`)}</Label>
                <Select
                  value={profile.paperWidth}
                  onValueChange={v => updateProfile({ paperWidth: v as PaperWidth })}
                >
                  <SelectTrigger data-testid="select-device-paper-width">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">{t(`${NS}.paperWidth58`)}</SelectItem>
                    <SelectItem value="80mm">{t(`${NS}.paperWidth80`)}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {profile.paperWidth === "58mm"
                    ? t(`${NS}.paperHelp58`)
                    : t(`${NS}.paperHelp80`)}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
              <Label className="text-sm font-medium">{t(`${NS}.labelPrinter`)}</Label>
              <Select
                value={profile.labelPrinterName || "__none__"}
                onValueChange={v => updateProfile({ labelPrinterName: v === "__none__" ? "" : v })}
              >
                <SelectTrigger data-testid="select-device-label-printer">
                  <SelectValue placeholder={t(`${NS}.noLabelPrinter`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t(`${NS}.noLabelPrinter`)}</SelectItem>
                  {allPrinters.map(p => (
                    <SelectItem key={`lbl-${p}`} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t(`${NS}.labelPrinterHelp`)}</p>
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
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t(`${NS}.testReceiptPrinting`)}</>
                  : <><Printer className="w-3.5 h-3.5" /> {t(`${NS}.testReceipt`)}</>}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="default" onClick={() => setOpen(false)} data-testid="button-close-device-print-settings">
            {t(`${NS}.close`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
