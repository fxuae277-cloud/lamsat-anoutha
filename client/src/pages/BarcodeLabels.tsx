import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Printer, Search, Plus, Minus, Trash2, Tag, Package, X, Eye, RefreshCw, Loader2,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import { useI18n } from "@/lib/i18n";
import {
  getDeviceProfile,
  setDeviceProfile,
  loadPrintersLocal,
  DEFAULT_LOCAL_PRINT_URL,
  DEFAULT_LOCAL_PRINT_API_KEY,
} from "@/lib/localPrintClient";

// ─── types ────────────────────────────────────────────────────────────────────
interface LabelItem {
  productId: number;
  name: string;
  barcode: string;
  price: string;
  qty: number;
  model?: string;
  color?: string;
  size?: string;
}

// ─── label size keys ──────────────────────────────────────────────────────────
// 58mm × 40mm thermal label @ 96dpi ≈ 219px × 151px
// LARGE_2 ("كبير2") is portrait 39×58mm @ 96dpi ≈ 147 × 219 px, one column,
// one label per page (page-break-after: always).
const SIZE_DIMS = {
  small:   { w: 164, h: 113, font: 7,  bh: 32, mm_w: 43, mm_h: 30 },
  medium:  { w: 219, h: 151, font: 8,  bh: 40, mm_w: 58, mm_h: 40 },
  large:   { w: 302, h: 208, font: 10, bh: 55, mm_w: 80, mm_h: 55 },
  LARGE_2: { w: 147, h: 219, font: 8,  bh: 38, mm_w: 39, mm_h: 58, singleLabel: true },
} as const;
type SizeKey = keyof typeof SIZE_DIMS;
type SizeDim = typeof SIZE_DIMS[SizeKey];
const isSingleLabel = (s: SizeDim): boolean =>
  ("singleLabel" in s) && (s as { singleLabel?: boolean }).singleLabel === true;

// ─── label-printer setting keys (try every shape we have used) ────────────
// Older builds wrote to localStorage directly under one of these names; newer
// builds put the value inside the device profile (lamsa.deviceProfile). We
// read all of them so the warning never appears for a cashier that already
// configured a printer in the past.
const LEGACY_LABEL_PRINTER_KEYS = [
  "labelPrinter",
  "labelPrinterName",
  "barcodePrinter",
  "barcodePrinterName",
  "selectedLabelPrinter",
];

function readLegacyLabelPrinter(): string {
  if (typeof localStorage === "undefined") return "";
  for (const key of LEGACY_LABEL_PRINTER_KEYS) {
    const v = localStorage.getItem(key);
    if (v && v.trim()) return v.trim();
  }
  // Sometimes nested under a single "printerSettings" object.
  const nested = localStorage.getItem("printerSettings");
  if (nested) {
    try {
      const parsed = JSON.parse(nested);
      const candidates = [
        parsed?.labelPrinter,
        parsed?.labelPrinterName,
        parsed?.barcodePrinter,
      ];
      for (const v of candidates) {
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    } catch { /* fall through */ }
  }
  return "";
}

// ─── single barcode SVG (bars only, no built-in number) ──────────────────────
function BarcodeImg({ barcode, height, width }: { barcode: string; height: number; width: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !barcode) return;
    try {
      JsBarcode(svgRef.current, barcode, {
        format:       "CODE128",
        width:        1.2,
        height,
        displayValue: false,
        margin:       2,
        lineColor:    "#000",
        background:   "#fff",
      });
    } catch {
      if (svgRef.current) svgRef.current.innerHTML = "";
    }
  }, [barcode, height, width]);

  return <svg ref={svgRef} style={{ width: "100%", maxWidth: width }} />;
}

// ─── label preview card — 58×40mm thermal style ───────────────────────────────
function LabelCard({ item, size }: { item: LabelItem; size: SizeDim }) {
  const f = size.font;
  const price = parseFloat(item.price).toFixed(3);
  const useMm = isSingleLabel(size);
  const cardW = useMm ? `${size.mm_w}mm` : size.w;
  const cardH = useMm ? `${size.mm_h}mm` : size.h;

  return (
    <div
      className="bg-white overflow-hidden shrink-0 flex flex-col items-center"
      style={{ width: cardW, height: cardH, padding: "3px 4px", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#000" }}
    >
      {/* Logo */}
      <img
        src="/logo.png"
        alt="logo"
        style={{ height: size.h * 0.18, objectFit: "contain", filter: "grayscale(100%) brightness(0)", marginBottom: 1 }}
      />

      {/* Brand name */}
      <p style={{ fontSize: f + 1, fontWeight: 800, letterSpacing: "0.12em", lineHeight: 1.1, textAlign: "center" }}>
        LAMST ANOTHA
      </p>

      {/* Tagline */}
      <p style={{ fontSize: f - 1, fontWeight: 300, letterSpacing: "0.08em", lineHeight: 1.1, textAlign: "center", marginBottom: 2 }}>
        TOUCH OF FEMININITY
      </p>

      {/* Divider */}
      <div style={{ width: "85%", height: 0.5, background: "#000", marginBottom: 2 }} />

      {/* Product info — name + variant line ("Color: X | Size: Y") to mirror
          the server-side TSPL renderer in tscLabel.ts. */}
      <div style={{ fontSize: f, fontWeight: 500, textAlign: "center", lineHeight: 1.45 }}>
        <p style={{ maxWidth: size.w - 8, fontWeight: 700 }} className="truncate">{item.name}</p>
        {(item.color || item.size) && (
          <p style={{ fontSize: f - 1, fontWeight: 400 }}>
            {[
              item.color && `Color: ${item.color}`,
              item.size  && `Size: ${item.size}`,
            ].filter(Boolean).join(" | ")}
          </p>
        )}
      </div>

      {/* Barcode */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", marginTop: 2 }}>
        <BarcodeImg barcode={item.barcode} height={size.bh} width={size.w - 8} />
        <p style={{ fontSize: f - 1, letterSpacing: "0.05em", marginTop: -1 }}>{item.barcode}</p>
      </div>

      {/* Divider */}
      <div style={{ width: "85%", height: 0.5, background: "#000", margin: "2px 0" }} />

      {/* Price */}
      <p style={{ fontSize: f + 4, fontWeight: 800, letterSpacing: "0.04em", lineHeight: 1 }}>
        {price} <span style={{ fontSize: f + 1 }}>R.O</span>
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function BarcodeLabels() {
  const { t, lang } = useI18n();
  const { toast } = useToast();

  const [search, setSearch]       = useState("");
  const [items, setItems]         = useState<LabelItem[]>([]);
  const [size, setSize]           = useState<SizeKey>("medium");
  const [cols, setCols]           = useState(4);
  const [showPreview, setShowPreview] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printProgress, setPrintProgress] =
    useState<{ current: number; total: number } | null>(null);

  // Build SIZES with translated labels (inside component so t() is available)
  const SIZES: Record<SizeKey, SizeDim & { label: string }> = {
    small:   { ...SIZE_DIMS.small,   label: t("barcode_labels.size_small") },
    medium:  { ...SIZE_DIMS.medium,  label: t("barcode_labels.size_medium") },
    large:   { ...SIZE_DIMS.large,   label: t("barcode_labels.size_large") },
    LARGE_2: { ...SIZE_DIMS.LARGE_2, label: t("barcode_labels.size_large_2") },
  };

  const handleSizeChange = (v: string) => {
    const next = v as SizeKey;
    setSize(next);
    if (next === "LARGE_2") setCols(1);
  };

  // ── settings (label printer) ───────────────────────────────────────────────
  // Resolution order (first non-empty wins):
  //   1. Device profile (localStorage `lamsa.deviceProfile.labelPrinterName`) —
  //      this is what the per-device "إعدادات الطباعة لهذا الجهاز" dialog writes.
  //   2. Legacy localStorage keys (labelPrinter, labelPrinterName, barcodePrinter,
  //      barcodePrinterName, selectedLabelPrinter, printerSettings.labelPrinter)
  //      — for cashiers configured before the device-profile rollout.
  //   3. /api/settings (server-wide labelPrinter) — for tenants that set it once
  //      from the back-office.
  //   4. First printer reported by the local print service (auto fallback).
  // Only when all four are empty do we show the warning.
  const { data: appSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 120_000,
  });

  const [deviceLabelPrinter, setDeviceLabelPrinter] = useState<string>(
    () => getDeviceProfile().labelPrinterName?.trim() || readLegacyLabelPrinter(),
  );
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [autoPicked, setAutoPicked] = useState(false);
  const [refreshingPrinters, setRefreshingPrinters] = useState(false);

  // Prefer the device profile value, then legacy LS keys, then app settings.
  const persistedLabelPrinter =
    deviceLabelPrinter ||
    readLegacyLabelPrinter() ||
    appSettings?.labelPrinter?.trim() ||
    "";

  // Auto-pick first printer from the local service if nothing is configured.
  // This runs once on mount and again whenever the printer list refreshes.
  const refreshPrinters = useCallback(async () => {
    setRefreshingPrinters(true);
    try {
      const result = await loadPrintersLocal();
      if (result.ok) {
        setAvailablePrinters(result.printers);
        if (!persistedLabelPrinter && result.printers.length > 0) {
          const first = result.printers[0];
          setDeviceLabelPrinter(first);
          setDeviceProfile({ labelPrinterName: first });
          setAutoPicked(true);
        }
      } else {
        setAvailablePrinters([]);
      }
    } finally {
      setRefreshingPrinters(false);
    }
  }, [persistedLabelPrinter]);

  useEffect(() => {
    void refreshPrinters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const labelPrinter = persistedLabelPrinter;
  const printerListUnavailable = availablePrinters.length === 0;

  const handleSelectLabelPrinter = (v: string) => {
    const next = v === "__none__" ? "" : v;
    setDeviceLabelPrinter(next);
    setDeviceProfile({ labelPrinterName: next });
    setAutoPicked(false);
  };

  // ── product search ─────────────────────────────────────────────────────────
  const { data: _results } = useQuery<any>({
    queryKey: [`/api/products/search?q=${encodeURIComponent(search)}&limit=15`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: search.length >= 1,
  });
  // API returns { products: [...], total: N }
  const results: any[] = Array.isArray(_results)
    ? _results
    : Array.isArray(_results?.products)
      ? _results.products
      : [];

  const addProduct = useCallback((p: any) => {
    if (!p.barcode) return;
    setItems(prev => {
      const existing = prev.find(i => i.productId === p.id);
      if (existing) return prev.map(i => i.productId === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, {
        productId: p.id,
        name:      p.name,
        barcode:   p.barcode,
        price:     p.price ?? p.priceDefault ?? "0",
        qty:       1,
        model:     p.modelNumber || p.sku || "",
        color:     p.color || "",
        size:      p.size || "",
      }];
    });
    setSearch("");
  }, []);

  const changeQty = (id: number, delta: number) =>
    setItems(prev => prev
      .map(i => i.productId === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );

  const setQty = (id: number, val: number) =>
    setItems(prev => prev.map(i => i.productId === id ? { ...i, qty: Math.max(1, val) } : i));

  const updateItem = (id: number, patch: Partial<LabelItem>) =>
    setItems(prev => prev.map(i => i.productId === id ? { ...i, ...patch } : i));

  const remove = (id: number) => setItems(prev => prev.filter(i => i.productId !== id));

  const totalLabels = items.reduce((s, i) => s + i.qty, 0);

  // ── print via local print service ──────────────────────────────────────────
  // POST one request per item to http://127.0.0.1:3001/print/barcode-label
  // with a flat payload that v2.2 of the local service detects (productName +
  // barcode at top-level → handleStructuredLabelPrint, server-side TSPL render
  // at 59×39mm). Each item carries its own `copies` count so we never spam
  // the printer buffer with one request per copy.
  const handlePrint = async () => {
    if (!labelPrinter) {
      toast({
        title: t("barcode_labels.no_label_printer"),
        description: t("barcode_labels.no_label_printer_desc"),
        variant: "destructive",
      });
      return;
    }
    if (items.length === 0) return;

    setIsPrinting(true);
    setPrintProgress({ current: 0, total: items.length });

    const profile = getDeviceProfile();
    const baseUrl = (profile.baseUrl || DEFAULT_LOCAL_PRINT_URL).replace(/\/+$/, "");
    const apiKey = (profile.apiKey || DEFAULT_LOCAL_PRINT_API_KEY).trim();
    const printUrl = `${baseUrl}/print/barcode-label`;

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setPrintProgress({ current: i + 1, total: items.length });

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);

      try {
        const response = await fetch(printUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "x-lamsa-print-key": apiKey,
          },
          body: JSON.stringify({
            printerName: labelPrinter,
            productName: (item.name || "").slice(0, 50),
            // Send color/size only when non-empty so JSON.stringify drops them
            // and the local service treats the item as variant-less. The
            // service composes the variant line itself ("Color: X | Size: Y").
            color: item.color?.trim() || undefined,
            size: item.size?.trim() || undefined,
            priceOMR: parseFloat(item.price),
            barcode: item.barcode,
            copies: Math.max(1, Math.min(100, item.qty || 1)),
          }),
          signal: ctrl.signal,
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
          const errBody = await response.json().catch(() => ({} as any));
          let msg: string;
          if (response.status === 503) {
            msg = t("barcode_labels.printer_offline_503");
          } else if (response.status === 408) {
            msg = t("barcode_labels.print_timeout");
          } else {
            msg = errBody?.error || errBody?.detail || `HTTP ${response.status}`;
          }
          errors.push(`${item.name}: ${msg}`);
        }
      } catch (err: any) {
        failCount++;
        const isAbort = err?.name === "AbortError";
        const isNetwork = /failed to fetch|networkerror|load failed/i.test(String(err?.message || ""));
        const msg = isAbort
          ? t("barcode_labels.print_timeout")
          : isNetwork
            ? t("barcode_labels.service_offline")
            : String(err?.message || err);
        errors.push(`${item.name}: ${msg}`);
      } finally {
        clearTimeout(timer);
      }

      // Brief gap between requests so the printer's spool buffer doesn't
      // overflow when many products are queued back-to-back.
      if (i < items.length - 1) {
        await new Promise<void>(resolve => setTimeout(resolve, 300));
      }
    }

    if (failCount === 0) {
      toast({
        title: t("barcode_labels.print_success").replace("{count}", String(successCount)),
      });
    } else if (successCount === 0) {
      toast({
        title: t("barcode_labels.print_all_failed"),
        description: errors[0],
        variant: "destructive",
      });
    } else {
      toast({
        title: t("barcode_labels.print_partial")
          .replace("{success}", String(successCount))
          .replace("{fail}", String(failCount)),
        description: errors[0],
        variant: "destructive",
      });
    }

    setIsPrinting(false);
    setPrintProgress(null);
  };

  const sz = SIZES[size];

  // ── all labels flat for preview ────────────────────────────────────────────
  const previewLabels = items.flatMap(item => Array(Math.min(item.qty, 8)).fill(item));

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
          <Tag className="w-6 h-6" /> {t("barcode_labels.title")}
        </h1>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview(!showPreview)} className="gap-2">
              <Eye className="h-4 w-4" />
              {showPreview ? t("barcode_labels.btn_hide_preview") : t("barcode_labels.btn_preview")}
            </Button>
            <Button
              onClick={() => void handlePrint()}
              disabled={items.length === 0 || isPrinting}
              className="gap-2"
              data-testid="button-print-labels"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {printProgress
                    ? `${t("barcode_labels.printing_progress")} ${printProgress.current}/${printProgress.total}`
                    : t("barcode_labels.printing_progress")}
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  {t("barcode_labels.btn_print")} {totalLabels > 0 && `(${totalLabels} ${t("barcode_labels.label_stickers")})`}
                </>
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground" data-testid="text-selected-label-printer">
            {t("barcode_labels.selected_printer_label")}{" "}
            <span className={labelPrinter ? "font-semibold text-foreground" : "italic text-amber-600"}>
              {labelPrinter || t("barcode_labels.no_printer_selected")}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── الجانب الأيسر: إعدادات + بحث ────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          {/* إعدادات الطباعة */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Printer className="h-4 w-4 text-primary" /> {t("barcode_labels.print_settings_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("barcode_labels.label_size_label")}</label>
                <Select value={size} onValueChange={handleSizeChange} disabled>
                  <SelectTrigger data-testid="select-label-size" title={t("barcode_labels.size_locked_hint")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SIZES) as SizeKey[]).map(k => (
                      <SelectItem key={k} value={k}>{SIZES[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t("barcode_labels.size_locked_hint")}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("barcode_labels.cols_label")}</label>
                <Select
                  value={String(cols)}
                  onValueChange={v => setCols(Number(v))}
                  disabled
                >
                  <SelectTrigger data-testid="select-label-cols" title={t("barcode_labels.cols_disabled_hint")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} {t("barcode_labels.cols_suffix")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t("barcode_labels.cols_disabled_hint")}
                </p>
              </div>

              {/* ── Label printer selector ─────────────────────────────────── */}
              <div className="pt-2 border-t border-muted">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">
                    {t("barcode_labels.label_printer_label")}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] gap-1"
                    onClick={() => void refreshPrinters()}
                    disabled={refreshingPrinters}
                    data-testid="button-refresh-label-printers"
                  >
                    <RefreshCw className={`h-3 w-3 ${refreshingPrinters ? "animate-spin" : ""}`} />
                    {t("barcode_labels.btn_refresh_printers")}
                  </Button>
                </div>
                <Select
                  value={labelPrinter || "__none__"}
                  onValueChange={handleSelectLabelPrinter}
                >
                  <SelectTrigger data-testid="select-label-printer">
                    <SelectValue placeholder={t("barcode_labels.label_printer_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t("barcode_labels.no_printer_selected")}
                    </SelectItem>
                    {/* Always show the persisted value even if it's not in the
                        live discovery list (printer offline, service down). */}
                    {labelPrinter && !availablePrinters.includes(labelPrinter) && (
                      <SelectItem value={labelPrinter}>{labelPrinter}</SelectItem>
                    )}
                    {availablePrinters.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {autoPicked && labelPrinter && (
                  <p className="text-[11px] text-emerald-600 mt-1">
                    {t("barcode_labels.label_printer_auto_picked")}
                  </p>
                )}
                {printerListUnavailable && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    {/* Local print service unreachable — preview still works
                        but actual silent print needs the service running. */}
                    {t("barcode_labels.no_label_printer_desc")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* بحث المنتجات */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> {t("barcode_labels.add_product_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={lang === "ar"
                    ? "ابحث بالاسم أو الموديل أو الباركود…"
                    : "Search by name, model or barcode…"}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pe-9"
                  autoComplete="off"
                />
                {search && (
                  <button className="absolute left-2 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* hint */}
              {!search && (
                <p className="text-[11px] text-muted-foreground px-1">
                  {lang === "ar"
                    ? "يمكن البحث بالاسم أو رقم الموديل أو الباركود"
                    : "Search by product name, model number, or barcode"}
                </p>
              )}

              {/* نتائج البحث */}
              {search.length >= 1 && (
                <div className="border rounded-xl divide-y max-h-72 overflow-y-auto shadow-md bg-white z-10">
                  {results.length === 0 ? (
                    <p className="text-center py-4 text-sm text-muted-foreground">{t("barcode_labels.no_results")}</p>
                  ) : results.map((p: any) => {
                    const q = search.toLowerCase();
                    const matchesBarcode = p.barcode?.toLowerCase().includes(q);
                    const matchesModel  = p.modelNumber?.toLowerCase().includes(q);
                    return (
                      <button
                        key={p.id}
                        className="w-full text-start px-3 py-2.5 hover:bg-pink-50 flex items-center justify-between gap-2 transition-colors"
                        onClick={() => addProduct(p)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {p.barcode && (
                              <span className={`text-[11px] font-mono ${matchesBarcode ? "text-pink-600 font-bold" : "text-muted-foreground"}`}>
                                {p.barcode}
                              </span>
                            )}
                            {p.modelNumber && (
                              <span className={`text-[11px] font-mono ${matchesModel ? "text-blue-600 font-bold" : "text-muted-foreground"}`}>
                                {lang === "ar" ? "موديل: " : "Model: "}{p.modelNumber}
                              </span>
                            )}
                            {!p.barcode && (
                              <span className="text-[11px] text-red-500">{t("barcode_labels.no_barcode")}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {parseFloat(p.price || p.priceDefault || 0).toFixed(3)}
                          </span>
                          {p.barcode
                            ? <Plus className="h-4 w-4 text-green-600" />
                            : <Badge className="text-[9px] bg-red-100 text-red-700">{t("barcode_labels.no_barcode")}</Badge>
                          }
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── الجانب الأيمن: قائمة المنتجات المختارة ──────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" /> {t("barcode_labels.selected_products_title")}
              </CardTitle>
              {items.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-red-500 h-7"
                  onClick={() => setItems([])}>
                  {t("barcode_labels.clear_all")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Tag className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{t("barcode_labels.empty_msg")}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {items.map(item => (
                    <div key={item.productId} className="px-4 py-3 hover:bg-muted/20 space-y-2">
                      <div className="flex items-center gap-3">
                        {/* Barcode mini preview */}
                        <div className="w-20 shrink-0">
                          <BarcodeImg barcode={item.barcode} height={30} width={80} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.barcode}</p>
                          <p className="text-xs font-bold text-primary">
                            {parseFloat(item.price).toFixed(3)} {t("barcode_labels.currency")}
                          </p>
                        </div>

                        {/* Qty controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => changeQty(item.productId, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            value={item.qty}
                            onChange={e => setQty(item.productId, parseInt(e.target.value) || 1)}
                            className="w-14 h-7 text-center text-sm p-1"
                            min={1}
                          />
                          <Button variant="outline" size="icon" className="h-7 w-7"
                            onClick={() => changeQty(item.productId, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Delete */}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0"
                          onClick={() => remove(item.productId)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Color / Size — optional variant fields (printed as
                          "Color: X | Size: Y" by the local print service) */}
                      <div className="grid grid-cols-2 gap-2 pl-[5.75rem]">
                        <Input
                          placeholder={t("barcode_labels.color_placeholder")}
                          value={item.color || ""}
                          onChange={e => updateItem(item.productId, { color: e.target.value })}
                          className="h-8 text-sm"
                          maxLength={30}
                          data-testid={`input-color-${item.productId}`}
                        />
                        <Input
                          placeholder={t("barcode_labels.size_placeholder")}
                          value={item.size || ""}
                          onChange={e => updateItem(item.productId, { size: e.target.value })}
                          className="h-8 text-sm"
                          maxLength={20}
                          data-testid={`input-size-${item.productId}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              {items.length > 0 && (
                <div className="px-4 py-3 border-t bg-muted/20 flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{items.length} {t("barcode_labels.product_count")}</span>
                  <span className="font-bold text-primary">{totalLabels} {t("barcode_labels.total_labels")}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── معاينة الملصقات ────────────────────────────────────────────── */}
          {showPreview && items.length > 0 && (
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  {t("barcode_labels.preview_title")} ({Math.min(previewLabels.length, 24)} {t("barcode_labels.label_stickers")})
                  {previewLabels.length > 24 && (
                    <span className="text-xs text-muted-foreground">• {t("barcode_labels.preview_only_first")}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="flex flex-wrap gap-2 bg-gray-100 rounded-xl p-3"
                  style={{ columnGap: 8, rowGap: 8 }}
                >
                  {previewLabels.slice(0, 24).map((item, i) => (
                    <LabelCard key={i} item={item} size={sz} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
