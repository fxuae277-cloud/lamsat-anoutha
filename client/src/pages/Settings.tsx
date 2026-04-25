import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Branch } from "@shared/schema";
import {
  KeyRound, ShieldCheck, Eye, EyeOff, Lock, UserCircle,
  Settings2, Save, X, Loader2, AlertTriangle, Globe,
  Banknote, Receipt, FileText, Printer, Database, Download, Percent
} from "lucide-react";

type SettingsData = Record<string, string>;

const ROLE_OPTIONS = [
  { value: "owner", labelKey: "sidebar.role_owner" },
  { value: "admin", labelKey: "sidebar.role_admin" },
  { value: "cashier", labelKey: "sidebar.role_cashier" },
  { value: "employee", labelKey: "sidebar.role_employee" },
];

const ROLE_LABELS_KEYS: Record<string, string> = {
  owner: "sidebar.role_owner",
  admin: "sidebar.role_admin",
  cashier: "sidebar.role_cashier",
  employee: "sidebar.role_employee",
};

const DEFAULT_SETTINGS: SettingsData = {
  businessName: "لمسة أنوثة إكسسوارات لوى",
  currency: "OMR",
  decimalPlaces: "3",
  numberFormat: "en-US",
  vatEnabled: "true",
  vatRate: "5",
  vatInclusive: "true",
  taxRegistrationNumber: "",
  taxName: "ضريبة القيمة المضافة",
  allowEmployeeDiscount: "true",
  invoicePrefix: "LO",
  invoiceNumberDigits: "5",
  allowEditAfterPayment: "false",
  allowCancelAfterClose: "false",
  receiptSize: "80mm",
  thermalPrinter: "true",
  receiptPrinter: "",
  labelPrinter: "",
  businessLogo: "",
  autoBackup: "true",
  default_profit_margin: "50",
};

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);

function isSettingsDirty(current: SettingsData, saved: SettingsData): boolean {
  for (const key of SETTINGS_KEYS) {
    if ((current[key] ?? "") !== (saved[key] ?? "")) return true;
  }
  return false;
}

export default function Settings() {
  const { toast } = useToast();
  const { data } = useAuth();
  const currentUser = data?.user;
  const { t, lang, setLang } = useI18n();
  const isOwnerOrAdmin = currentUser?.role === "owner" || currentUser?.role === "admin";

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showChangeNewPass, setShowChangeNewPass] = useState(false);

  const [currentSettings, setCurrentSettings] = useState<SettingsData>({ ...DEFAULT_SETTINGS });
  const [savedSettings, setSavedSettings] = useState<SettingsData>({ ...DEFAULT_SETTINGS });
  const [pendingLang, setPendingLang] = useState<Lang>(lang);
  const [savedLang, setSavedLang] = useState<Lang>(lang);
  const [activeTab, setActiveTab] = useState("account");
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  const { data: branchesList = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "throw" }) });

  const { data: printersData } = useQuery<{ printers: string[] }>({
    queryKey: ["/api/printers"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 60_000,
  });
  const systemPrinters: string[] = printersData?.printers ?? [];

  const { data: serverSettings } = useQuery<SettingsData>({
    queryKey: ["/api/settings"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  useEffect(() => {
    if (serverSettings) {
      const merged = { ...DEFAULT_SETTINGS, ...serverSettings };
      setCurrentSettings(merged);
      setSavedSettings(merged);
    }
  }, [serverSettings]);

  useEffect(() => {
    setPendingLang(lang);
    setSavedLang(lang);
  }, [lang]);

  const settingsDirty = isSettingsDirty(currentSettings, savedSettings);
  const langDirty = pendingLang !== savedLang;
  const isDirty = settingsDirty || langDirty;

  const updateSetting = useCallback((key: string, value: string) => {
    setCurrentSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleCancel = useCallback(() => {
    setCurrentSettings({ ...savedSettings });
    setPendingLang(savedLang);
  }, [savedSettings, savedLang]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (settingsDirty) {
        await apiRequest("PATCH", "/api/settings", currentSettings);
      }
      if (langDirty) {
        await apiRequest("PATCH", "/api/me/settings", { uiLanguage: pendingLang });
      }
    },
    onSuccess: () => {
      setSavedSettings({ ...currentSettings });
      if (langDirty) {
        setLang(pendingLang);
        setSavedLang(pendingLang);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }
      toast({ title: t("settings.settings_saved") });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (err: Error) => {
      toast({ title: t("settings.settings_save_error"), description: err.message, variant: "destructive" });
    },
  });

  const handleTabChange = (newTab: string) => {
    if (isDirty && activeTab === "general") {
      setPendingTab(newTab);
      setShowLeaveWarning(true);
    } else {
      setActiveTab(newTab);
    }
  };

  const confirmLeave = () => {
    handleCancel();
    setShowLeaveWarning(false);
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  };

  const cancelLeave = () => {
    setShowLeaveWarning(false);
    setPendingTab(null);
  };

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const testReceiptPrint = () => {
    const printer = currentSettings.receiptPrinter;
    const w = window.open("", "_blank", "width=340,height=500");
    if (!w) return;
    w.document.write(`<html><head><title>اختبار طابعة الإيصال</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; margin: 0; padding: 10px; font-size: 12px; }
      .center { text-align: center; } .bold { font-weight: 700; }
      hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
      .hint { background: #fff3cd; padding: 6px; font-size: 11px; border-radius: 4px; margin-bottom: 8px; text-align: center; }
      @media print { .hint { display: none; } }
    </style></head><body>
    ${printer ? `<div class="hint">اختر الطابعة: <strong>${printer}</strong></div>` : ""}
    <p class="center bold">🌸 لمسة أنوثة 🌸</p>
    <p class="center" style="font-size:10px">اختبار طباعة الإيصال</p>
    <hr/>
    <p>رقم الفاتورة: TEST-001</p>
    <p>التاريخ: ${new Date().toLocaleDateString("ar-SA")}</p>
    <hr/>
    <table style="width:100%;font-size:11px"><tr><td>منتج تجريبي</td><td align="left">1 × 1.500</td></tr></table>
    <hr/>
    <p class="bold">الإجمالي: 1.500 ر.ع</p>
    <hr/>
    <p class="center" style="font-size:10px">شكراً لتسوقكم معنا 💝</p>
    <script>setTimeout(()=>{window.print();window.close();},400);</script>
    </body></html>`);
    w.document.close();
  };

  const testLabelPrint = () => {
    const printer = currentSettings.labelPrinter;
    const w = window.open("", "_blank", "width=300,height=400");
    if (!w) return;
    w.document.write(`<html><head><title>اختبار طابعة الملصقات</title>
    <style>
      @page { size: 58mm 40mm; margin: 0; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 2mm; font-size: 7pt; color: #000; background: #fff; }
      .label { width: 54mm; height: 36mm; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 0.5pt dashed #999; }
      .brand { font-size: 9pt; font-weight: 800; letter-spacing: 0.1em; }
      .price { font-size: 14pt; font-weight: 800; }
      .hint { background: #fff3cd; padding: 4px; font-size: 9px; text-align: center; margin-bottom: 3px; }
      @media print { .hint { display: none; } @page { size: 58mm 40mm; margin: 0; } }
    </style></head><body>
    ${printer ? `<div class="hint">اختر الطابعة: <strong>${printer}</strong></div>` : ""}
    <div class="label">
      <p class="brand">LAMST ANOTHA</p>
      <p style="font-size:6pt;letter-spacing:0.06em">TOUCH OF FEMININITY</p>
      <div style="width:85%;height:0.3pt;background:#000;margin:2px 0"></div>
      <p style="font-size:7pt">Test Product</p>
      <div style="width:85%;height:0.3pt;background:#000;margin:2px 0"></div>
      <p class="price">1.500 <span style="font-size:9pt">R.O</span></p>
    </div>
    <script>setTimeout(()=>{window.print();window.close();},400);</script>
    </body></html>`);
    w.document.close();
  };

  type BackupFile = { filename: string; size: number; createdAt: string };
  type ValidationCheck = { name: string; passed: boolean; details: string };

  const [validationResult, setValidationResult] = useState<{ valid: boolean; checks: ValidationCheck[] } | null>(null);
  const [validatingFile, setValidatingFile] = useState<string | null>(null);

  const { data: backupsList = [], refetch: refetchBackups } = useQuery<BackupFile[]>({
    queryKey: ["/api/settings/backups"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOwnerOrAdmin,
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/backup/create");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: t("settings.backup_created_success"), description: `${data.filename} (${(data.size / 1024 / 1024).toFixed(2)} MB)` });
      refetchBackups();
    },
    onError: (err: Error) => {
      toast({ title: t("settings.backup_create_error"), description: err.message, variant: "destructive" });
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (filename: string) => {
      await apiRequest("DELETE", `/api/settings/backup/${filename}`);
    },
    onSuccess: () => {
      toast({ title: t("settings.backup_deleted") });
      refetchBackups();
    },
    onError: (err: Error) => {
      toast({ title: t("settings.error_generic"), description: err.message, variant: "destructive" });
    },
  });

  const handleDownloadBackup = async (filename: string) => {
    try {
      const res = await fetch(`/api/settings/backup/download/${filename}`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل التنزيل");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: t("settings.error_generic"), description: err.message, variant: "destructive" });
    }
  };

  const handleValidateBackup = async (filename: string) => {
    setValidatingFile(filename);
    setValidationResult(null);
    try {
      const res = await apiRequest("POST", `/api/settings/backup/validate/${filename}`);
      const data = await res.json();
      setValidationResult(data);
    } catch (err: any) {
      toast({ title: t("settings.error_generic"), description: err.message, variant: "destructive" });
    } finally {
      setValidatingFile(null);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/exports/backup.json", { credentials: "include" });
      if (!res.ok) throw new Error(t("settings.upload_error"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t("settings.backup_uploaded") });
    } catch (err: any) {
      toast({ title: t("settings.error_generic"), description: err.message, variant: "destructive" });
    } finally {
      setBackupLoading(false);
    }
  };

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/change-password", { oldPassword, newPassword });
    },
    onSuccess: () => {
      toast({ title: t("settings.password_changed") });
      setOldPassword("");
      setNewPassword("");
      setShowOldPass(false);
      setShowChangeNewPass(false);
    },
    onError: (err: Error) => {
      toast({ title: t("settings.error"), description: err.message, variant: "destructive" });
    },
  });

  const roleLabel = t(ROLE_LABELS_KEYS[currentUser?.role || ""] || "sidebar.role_employee");
  const userBranch = branchesList.find(b => b.id === currentUser?.branchId);

  return (
    <div className="max-w-5xl mx-auto pb-24 animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">{t("settings.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} dir={lang === "ar" ? "rtl" : "ltr"} className="space-y-6">
        <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap gap-1">
          <TabsTrigger value="account" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-account">
            <UserCircle className="w-4 h-4" />
            {t("settings.tab_account")}
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-general">
            <Settings2 className="w-4 h-4" />
            {t("settings.tab_general")}
          </TabsTrigger>
        </TabsList>

        {/* ─── Account Tab ─── */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCircle className="w-5 h-5" />
                {t("settings.account_info")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-4 ${currentUser?.role === "owner" ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
                <div className="p-4 bg-muted/30 rounded-lg border text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold mx-auto mb-2">
                    {currentUser?.name?.charAt(0) || "؟"}
                  </div>
                  <p className="font-bold text-sm">{currentUser?.name}</p>
                  <p className="text-xs text-muted-foreground">@{currentUser?.username}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">{t("settings.role")}</p>
                  <p className="font-bold text-sm">{roleLabel}</p>
                </div>
                {currentUser?.role !== "owner" && (
                  <>
                    <div className="p-4 bg-muted/30 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">{t("settings.branch")}</p>
                      <p className="font-bold text-sm">{userBranch ? (userBranch.address ? `${userBranch.name} - ${userBranch.address}` : userBranch.name) : "-"}</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">{t("settings.terminal")}</p>
                      <p className="font-bold text-sm" dir="ltr">{currentUser?.terminalName || "-"}</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="w-5 h-5" />
                {t("settings.change_password")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label>{t("settings.current_password")}</Label>
                  <div className="relative">
                    <Input type={showOldPass ? "text" : "password"} value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder={t("settings.current_password_placeholder")} data-testid="input-old-password" />
                    <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowOldPass(!showOldPass)}>
                      {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.new_password")}</Label>
                  <div className="relative">
                    <Input type={showChangeNewPass ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t("settings.new_password_placeholder")} data-testid="input-new-password" />
                    <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowChangeNewPass(!showChangeNewPass)}>
                      {showChangeNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button onClick={() => changePasswordMutation.mutate()} disabled={changePasswordMutation.isPending || !oldPassword || newPassword.length < 6} className="gap-2" data-testid="button-confirm-change-password">
                  <KeyRound className="w-4 h-4" />
                  {changePasswordMutation.isPending ? t("settings.changing_password") : t("settings.change_password_btn")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* ─── General Settings Tab ─── */}
        <TabsContent value="general" className="space-y-6">

          {/* 1. Business & Currency */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Banknote className="w-5 h-5" />
                {t("settings.business_currency_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("settings.business_name")}</Label>
                  <Input value={currentSettings.businessName} onChange={e => updateSetting("businessName", e.target.value)} data-testid="input-business-name" />
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.default_currency")}</Label>
                  <Select value={currentSettings.currency} onValueChange={v => updateSetting("currency", v)}>
                    <SelectTrigger data-testid="select-currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OMR">{t("settings.currency_omr")}</SelectItem>
                      <SelectItem value="SAR">{t("settings.currency_sar")}</SelectItem>
                      <SelectItem value="AED">{t("settings.currency_aed")}</SelectItem>
                      <SelectItem value="USD">{t("settings.currency_usd")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.decimal_places")}</Label>
                  <Select value={currentSettings.decimalPlaces} onValueChange={v => updateSetting("decimalPlaces", v)}>
                    <SelectTrigger data-testid="select-decimal-places"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">{t("settings.decimal_2")}</SelectItem>
                      <SelectItem value="3">{t("settings.decimal_3")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("settings.number_format")}</Label>
                  <Select value={currentSettings.numberFormat} onValueChange={v => updateSetting("numberFormat", v)}>
                    <SelectTrigger data-testid="select-number-format"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ar-OM">{t("settings.format_ar")}</SelectItem>
                      <SelectItem value="en-US">{t("settings.format_en")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Tax / VAT */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Percent className="w-5 h-5" />
                {t("settings.tax_settings")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">{t("settings.vat_label")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.vat_description")}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" max="100" className="w-20 text-center" value={currentSettings.vatRate} onChange={e => updateSetting("vatRate", e.target.value)} data-testid="input-vat-rate" />
                    <span className="font-bold text-sm">%</span>
                  </div>
                  <Switch checked={currentSettings.vatEnabled === "true"} onCheckedChange={v => updateSetting("vatEnabled", v ? "true" : "false")} data-testid="switch-vat-enabled" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base">{t("settings.price_includes_tax")}</Label>
                    <p className="text-sm text-muted-foreground">{t("settings.price_includes_tax_desc")}</p>
                  </div>
                  <Switch checked={currentSettings.vatInclusive === "true"} onCheckedChange={v => updateSetting("vatInclusive", v ? "true" : "false")} data-testid="switch-vat-inclusive" />
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.tax_name")}</Label>
                  <Input value={currentSettings.taxName} onChange={e => updateSetting("taxName", e.target.value)} placeholder={t("settings.tax_name_placeholder")} data-testid="input-tax-name" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("settings.tax_reg_number")}</Label>
                <Input value={currentSettings.taxRegistrationNumber} onChange={e => updateSetting("taxRegistrationNumber", e.target.value)} placeholder={t("settings.tax_reg_placeholder")} dir="ltr" className="text-left" data-testid="input-tax-reg-number" />
              </div>
            </CardContent>
          </Card>

          {/* 3. Discounts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                {t("settings.discount_settings")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">{t("settings.allow_employee_discount")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.allow_employee_discount_desc")}</p>
                </div>
                <Switch checked={currentSettings.allowEmployeeDiscount === "true"} onCheckedChange={v => updateSetting("allowEmployeeDiscount", v ? "true" : "false")} data-testid="switch-employee-discount" />
              </div>
            </CardContent>
          </Card>

          {/* 4. Invoice Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t("settings.invoice_settings")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("settings.invoice_prefix")}</Label>
                  <Input value={currentSettings.invoicePrefix} onChange={e => updateSetting("invoicePrefix", e.target.value)} placeholder="LO" dir="ltr" className="text-left" data-testid="input-invoice-prefix" />
                  <p className="text-xs text-muted-foreground">{t("settings.invoice_prefix_example")} {currentSettings.invoicePrefix}-{"0".repeat(parseInt(currentSettings.invoiceNumberDigits || "5") - 1)}1</p>
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.invoice_digits")}</Label>
                  <Select value={currentSettings.invoiceNumberDigits} onValueChange={v => updateSetting("invoiceNumberDigits", v)}>
                    <SelectTrigger data-testid="select-invoice-digits"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">{t("settings.digits_4")}</SelectItem>
                      <SelectItem value="5">{t("settings.digits_5")}</SelectItem>
                      <SelectItem value="6">{t("settings.digits_6")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base">{t("settings.edit_after_payment")}</Label>
                    <p className="text-sm text-muted-foreground">{t("settings.edit_after_payment_desc")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${currentSettings.allowEditAfterPayment === "true" ? "text-green-600" : "text-red-500"}`}>
                      {currentSettings.allowEditAfterPayment === "true" ? t("settings.allowed") : t("settings.not_allowed")}
                    </span>
                    <Switch checked={currentSettings.allowEditAfterPayment === "true"} onCheckedChange={v => updateSetting("allowEditAfterPayment", v ? "true" : "false")} data-testid="switch-edit-after-payment" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base">{t("settings.cancel_after_close")}</Label>
                    <p className="text-sm text-muted-foreground">{t("settings.cancel_after_close_desc")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${currentSettings.allowCancelAfterClose === "true" ? "text-green-600" : "text-red-500"}`}>
                      {currentSettings.allowCancelAfterClose === "true" ? t("settings.allowed") : t("settings.not_allowed")}
                    </span>
                    <Switch checked={currentSettings.allowCancelAfterClose === "true"} onCheckedChange={v => updateSetting("allowCancelAfterClose", v ? "true" : "false")} data-testid="switch-cancel-after-close" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Print Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Printer className="w-5 h-5" />
                {t("settings.print_settings")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("settings.receipt_size")}</Label>
                  <Select value={currentSettings.receiptSize} onValueChange={v => updateSetting("receiptSize", v)}>
                    <SelectTrigger data-testid="select-receipt-size"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="58mm">{t("settings.size_58mm")}</SelectItem>
                      <SelectItem value="80mm">{t("settings.size_80mm")}</SelectItem>
                      <SelectItem value="A4">{t("settings.size_a4")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base">{t("settings.thermal_printer")}</Label>
                    <p className="text-sm text-muted-foreground">{t("settings.thermal_printer_desc")}</p>
                  </div>
                  <Switch checked={currentSettings.thermalPrinter === "true"} onCheckedChange={v => updateSetting("thermalPrinter", v ? "true" : "false")} data-testid="switch-thermal-printer" />
                </div>
              </div>

              {/* Printer Assignment */}
              <div className="border rounded-lg p-4 space-y-4 bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-sm text-blue-700 dark:text-blue-400">{t("settings.printer_assignment")}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Receipt Printer */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("settings.receipt_printer")}</Label>
                    <Select
                      value={currentSettings.receiptPrinter || "__none__"}
                      onValueChange={v => updateSetting("receiptPrinter", v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("settings.select_printer")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("settings.no_printer_selected")}</SelectItem>
                        {systemPrinters.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("settings.receipt_printer_desc")}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={testReceiptPrint}
                    >
                      <Printer className="w-3 h-3" /> {t("settings.test_receipt_print")}
                    </Button>
                  </div>

                  {/* Label Printer */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("settings.label_printer")}</Label>
                    <Select
                      value={currentSettings.labelPrinter || "__none__"}
                      onValueChange={v => updateSetting("labelPrinter", v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("settings.select_printer")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t("settings.no_printer_selected")}</SelectItem>
                        {systemPrinters.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("settings.label_printer_desc")}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={testLabelPrint}
                    >
                      <Printer className="w-3 h-3" /> {t("settings.test_label_print")}
                    </Button>
                  </div>
                </div>
                {systemPrinters.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {t("settings.printers_not_detected")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("settings.business_logo")}</Label>
                <Input value={currentSettings.businessLogo} onChange={e => updateSetting("businessLogo", e.target.value)} placeholder="https://example.com/logo.png" dir="ltr" className="text-left" data-testid="input-business-logo" />
                <p className="text-xs text-muted-foreground">{t("settings.business_logo_desc")}</p>
              </div>
            </CardContent>
          </Card>

          {/* 6. Backup */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="w-5 h-5" />
                {t("settings.backup_settings")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">{t("settings.auto_backup")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.auto_backup_desc")}</p>
                </div>
                <Switch checked={currentSettings.autoBackup === "true"} onCheckedChange={v => updateSetting("autoBackup", v ? "true" : "false")} data-testid="switch-auto-backup" />
              </div>

              <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div>
                  <Label className="text-base font-semibold">{t("settings.create_backup")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.create_backup_desc")}</p>
                </div>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => createBackupMutation.mutate()} disabled={createBackupMutation.isPending} data-testid="button-create-backup">
                  {createBackupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  {createBackupMutation.isPending ? t("settings.creating_backup") : t("settings.create_backup_btn")}
                </Button>
              </div>

              {backupsList.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-3 border-b">
                    <Label className="text-base font-semibold">{t("settings.backup_list")}</Label>
                    <p className="text-xs text-muted-foreground">{t("settings.backup_list_desc")}</p>
                  </div>
                  <div className="divide-y">
                    {backupsList.map((backup: BackupFile) => (
                      <div key={backup.filename} className="p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm font-medium truncate" data-testid={`text-backup-name-${backup.filename}`}>{backup.filename}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{(() => { const d = new Date(backup.createdAt); const day = String(d.getDate()).padStart(2,"0"); const month = String(d.getMonth()+1).padStart(2,"0"); const h = String(d.getHours()).padStart(2,"0"); const m = String(d.getMinutes()).padStart(2,"0"); return `${day}/${month}/${d.getFullYear()} ${h}:${m}`; })()}</span>
                              <span className="font-semibold">{(backup.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleDownloadBackup(backup.filename)} data-testid={`button-download-${backup.filename}`}>
                              <Download className="w-3.5 h-3.5" />
                              {t("settings.download")}
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleValidateBackup(backup.filename)} disabled={validatingFile === backup.filename} data-testid={`button-validate-${backup.filename}`}>
                              {validatingFile === backup.filename ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                              {t("settings.validate")}
                            </Button>
                            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => { if (confirm(t("settings.confirm_delete_backup"))) deleteBackupMutation.mutate(backup.filename); }} data-testid={`button-delete-${backup.filename}`}>
                              <X className="w-3.5 h-3.5" />
                              {t("settings.delete")}
                            </Button>
                          </div>
                        </div>

                        {validationResult && validatingFile === null && backupsList.findIndex(b => b.filename === backup.filename) === backupsList.findIndex(b => {
                          const lastValidated = validationResult.checks[0]?.details;
                          return lastValidated?.includes(backup.filename);
                        }) && null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validationResult && (
                <div className={`border rounded-lg p-4 ${validationResult.valid ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200" : "bg-red-50 dark:bg-red-950/20 border-red-200"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className={`w-5 h-5 ${validationResult.valid ? "text-emerald-600" : "text-red-600"}`} />
                    <Label className="text-base font-semibold">
                      {validationResult.valid ? t("settings.backup_valid") : t("settings.backup_invalid")}
                    </Label>
                  </div>
                  <div className="space-y-1.5">
                    {validationResult.checks.map((check: ValidationCheck, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className={check.passed ? "text-emerald-600" : "text-red-600"}>{check.passed ? "✓" : "✗"}</span>
                        <span>{check.details}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-muted/30 border rounded-lg">
                <div>
                  <Label className="text-base">{t("settings.download_backup")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.download_backup_desc")}</p>
                </div>
                <Button variant="outline" className="gap-2" onClick={handleBackup} disabled={backupLoading} data-testid="button-download-backup">
                  {backupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {backupLoading ? t("settings.downloading") : t("settings.download_backup_btn")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 7. Preferences (Language) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5" />
                {t("settings.preferences")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌐</span>
                  <div>
                    <Label className="text-base">{t("settings.system_language")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.choose_language")}
                    </p>
                  </div>
                </div>
                <Select value={pendingLang} onValueChange={(v) => setPendingLang(v as Lang)}>
                  <SelectTrigger className="w-48" data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">{t("settings.language_ar")}</SelectItem>
                    <SelectItem value="en">{t("settings.language_en")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

      </Tabs>

      {/* Sticky Save Bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.08)] animate-in slide-in-from-bottom-4 duration-300" data-testid="sticky-save-bar">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">{t("settings.unsaved_changes")}</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleCancel} className="gap-1.5" data-testid="button-cancel-settings">
                <X className="w-4 h-4" />
                {t("settings.cancel")}
              </Button>
              <Button size="sm" onClick={() => saveSettingsMutation.mutate()} disabled={!isDirty || saveSettingsMutation.isPending} className="gap-1.5 min-w-[140px]" data-testid="button-save-settings">
                {saveSettingsMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{t("settings.saving_settings")}</>
                ) : (
                  <><Save className="w-4 h-4" />{t("settings.save_settings")}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Warning Dialog */}
      <AlertDialog open={showLeaveWarning} onOpenChange={setShowLeaveWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.unsaved_warning_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.unsaved_warning_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLeave} data-testid="button-stay">{t("settings.stay")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-leave-anyway">
              {t("settings.leave_without_save")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
