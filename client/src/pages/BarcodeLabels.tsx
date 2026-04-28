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
  Printer, Search, Plus, Minus, Trash2, Tag, Package, X, Eye, RefreshCw,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import { useI18n } from "@/lib/i18n";
import {
  getDeviceProfile,
  setDeviceProfile,
  loadPrintersLocal,
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

      {/* Product info */}
      <div style={{ fontSize: f, fontWeight: 500, textAlign: "center", lineHeight: 1.45 }}>
        {item.model && <p>Shoe Model: {item.model}</p>}
        {item.color && <p>Color: {item.color}</p>}
        {item.size  && <p>Size: {item.size}</p>}
        {!item.model && !item.color && !item.size && (
          <p style={{ maxWidth: size.w - 8 }} className="truncate">{item.name}</p>
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

  // Build SIZES with translated labels (inside component so t() is available)
  const SIZES: Record<SizeKey, SizeDim & { label: string }> = {
    small:   { ...SIZE_DIMS.small,   label: t("barcode_labels.size_small") },
    medium:  { ...SIZE_DIMS.medium,  label: t("barcode_labels.size_medium") },
    large:   { ...SIZE_DIMS.large,   label: t("barcode_labels.size_large") },
    LARGE_2: { ...SIZE_DIMS.LARGE_2, label: t("barcode_labels.size_large_2") },
  };

  const singleLabelMode = size === "LARGE_2";

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

  const remove = (id: number) => setItems(prev => prev.filter(i => i.productId !== id));

  const totalLabels = items.reduce((s, i) => s + i.qty, 0);

  // ── print ──────────────────────────────────────────────────────────────────
  // Only warn when there is no label printer at all — neither in the device
  // profile, nor in legacy LS, nor in app settings, nor auto-picked from the
  // local print service. Receipt-printer state is irrelevant here: label
  // printing must NEVER require a receipt printer to be configured.
  const handlePrint = () => {
    const haveLabelPrinter = !!labelPrinter;
    if (!haveLabelPrinter) {
      toast({
        title: t("barcode_labels.no_label_printer"),
        description: t("barcode_labels.no_label_printer_desc"),
        variant: "destructive",
      });
      // Continue to preview window so the cashier can still see the labels
      // — but the print button inside the preview shows the warning banner.
    }
    const sz = SIZES[size];
    const single = isSingleLabel(sz);
    const logoUrl = `${window.location.origin}/logo.png`;

    const labelsHtml = items.flatMap(item =>
      Array(item.qty).fill(null).map(() => {
        const div = document.createElement("div");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        div.appendChild(svg);
        try {
          JsBarcode(svg, item.barcode, {
            format: "CODE128", width: 1.4, height: sz.bh,
            displayValue: false, margin: 2,
            lineColor: "#000", background: "#fff",
          });
        } catch { /* skip */ }
        const svgStr = svg.outerHTML;
        const price  = parseFloat(item.price).toFixed(3);

        const productInfo = (item.model || item.color || item.size)
          ? `${item.model ? `<p>Shoe Model: ${item.model}</p>` : ""}
             ${item.color ? `<p>Color: ${item.color}</p>` : ""}
             ${item.size  ? `<p>Size: ${item.size}</p>`  : ""}`
          : `<p>${item.name}</p>`;

        // ── Single-label (LARGE_2) layout — matches reference design ────────
        if (single) {
          return `
            <div class="label single-label">
              <div class="content">
                <p class="brand">LAMST ANOTHA</p>
                <div class="line-row">
                  <span class="hr-line"></span>
                  <span class="tagline">TOUCH OF FEMININITY</span>
                  <span class="hr-line"></span>
                </div>
                <div class="info">${productInfo}</div>
                <div class="barcode-wrap">
                  ${svgStr}
                  <p class="barcode-num">${item.barcode}</p>
                </div>
                <div class="line-row">
                  <span class="hr-line"></span>
                </div>
                <p class="price">${price} <span class="ro">R.O</span></p>
              </div>
            </div>`;
        }

        // ── Default grid layout (small/medium/large) ────────────────────────
        return `
          <div class="label">
            <img src="${logoUrl}" class="logo" alt="logo" />
            <p class="brand">LAMST ANOTHA</p>
            <p class="tagline">TOUCH OF FEMININITY</p>
            <div class="divider"></div>
            <div class="info">${productInfo}</div>
            <div class="barcode-wrap">
              ${svgStr}
              <p class="barcode-num">${item.barcode}</p>
            </div>
            <div class="divider"></div>
            <p class="price">${price} <span class="ro">R.O</span></p>
          </div>`;
      })
    ).join("");

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const printerBanner = labelPrinter
      ? `<div style="background:#fff3cd;padding:6px 14px;font-size:12px;display:inline-block;border-radius:4px;margin-right:12px;">
           🖨️ اختر الطابعة: <strong>${labelPrinter}</strong>
         </div>`
      : `<div style="background:#f8d7da;padding:6px 14px;font-size:12px;display:inline-block;border-radius:4px;margin-right:12px;">
           ⚠️ لم يتم تحديد طابعة الملصقات — راجع الإعدادات
         </div>`;

    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${t("barcode_labels.print_win_title")}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#fff; color:#000; margin:0; }
  .grid {
    display: ${single ? "block" : "flex"};
    flex-wrap: wrap;
    gap: ${single ? "0" : "3mm"};
    padding: ${single ? "0" : "5mm"};
    justify-content: flex-start;
  }
  .label {
    width: ${sz.mm_w}mm;
    height: ${sz.mm_h}mm;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 1mm 1mm;
    margin: 0 auto;
    text-align: center;
    overflow: hidden;
    ${single ? "page-break-after: always; break-after: page;" : "page-break-inside: avoid;"}
  }
  .logo { height: ${sz.mm_h * 0.16}mm; object-fit:contain; filter: grayscale(100%) brightness(0); max-width:100%; display:block; margin:0 auto; }
  .brand { font-size: ${sz.font + 1}pt; font-weight: 800; letter-spacing: 0.10em; text-align:center; line-height:1.1; white-space:nowrap; }
  .tagline { font-size: ${sz.font - 2}pt; font-weight: 300; letter-spacing: 0.06em; text-align:center; line-height:1.1; white-space:nowrap; }
  .divider { width:90%; height:0.3pt; background:#000; margin:0 auto; }
  .info { font-size: ${sz.font - 1}pt; font-weight:500; text-align:center; line-height:1.4; max-width:100%; }
  .info p { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0 auto; }
  .barcode-wrap { display:flex; flex-direction:column; align-items:center; width:100%; }
  .barcode-wrap svg { width:100% !important; height:auto !important; max-width:100%; max-height:${sz.mm_h * 0.30}mm; display:block; margin:0 auto; }
  .barcode-num { font-size: ${sz.font - 2}pt; letter-spacing:0.03em; margin-top:-0.3mm; text-align:center; }
  .price { font-size: ${sz.font + 4}pt; font-weight:800; letter-spacing:0.03em; line-height:1; text-align:center; }
  .ro { font-size: ${sz.font + 1}pt; font-weight:600; }

  /* ── Single-label (LARGE_2) — portrait 39×58mm، content area 33×52mm ── */
  .label.single-label { padding: 0; }
  .label.single-label .content {
    width: 33mm;
    height: 52mm;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: space-between;
    text-align: center;
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  .label.single-label .brand {
    font-family: 'Times New Roman', 'Georgia', serif;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1;
    white-space: nowrap;
    margin: 0;
  }
  .label.single-label .line-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1mm;
    width: 100%;
    margin: 0.2mm 0;
  }
  .label.single-label .hr-line {
    flex: 1;
    height: 0.4pt;
    background: #000;
    min-width: 4mm;
  }
  .label.single-label .tagline {
    font-size: 4pt;
    font-weight: 400;
    letter-spacing: 0.08em;
    white-space: nowrap;
    line-height: 1;
  }
  .label.single-label .info {
    font-size: 5.5pt;
    font-weight: 700;
    line-height: 1.2;
    margin: 0;
  }
  .label.single-label .info p {
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .label.single-label .barcode-wrap {
    width: 100%;
    margin: 0;
  }
  .label.single-label .barcode-wrap svg {
    width: 100% !important;
    height: 8mm !important;
    max-height: 8mm;
    display: block;
    margin: 0 auto;
  }
  .label.single-label .barcode-num {
    font-size: 5pt;
    font-weight: 500;
    letter-spacing: 0.04em;
    margin-top: -0.2mm;
    line-height: 1;
  }
  .label.single-label .price {
    font-size: 11pt;
    font-weight: 800;
    letter-spacing: 0.01em;
    line-height: 1;
    margin: 0;
    white-space: nowrap;
  }
  .label.single-label .ro {
    font-size: 6pt;
    font-weight: 600;
    letter-spacing: 0;
  }

  @media print {
    @page { margin: 0; size: ${sz.mm_w}mm ${sz.mm_h}mm; }
    html, body { margin: 0; padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .grid { padding: 0 !important; gap: 0 !important; ${single ? "display:flex !important; flex-direction:column !important; justify-content:flex-start !important; align-items:center !important;" : ""} }
    ${single ? ".label:last-child { page-break-after: auto; break-after: auto; }" : ""}
  }
  .no-print { text-align:center; padding:10px; background:#f5f5f5; }
  @media print { .no-print { display:none; } }
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="padding:8px 24px;background:#222;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;margin:4px;">
    🖨️ ${t("barcode_labels.print_btn")}
  </button>
  <button onclick="window.close()" style="padding:8px 24px;background:#666;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;margin:4px;">
    ✕ ${t("barcode_labels.print_close")}
  </button>
  <span style="font-size:13px;color:#555;">${totalLabels} ${t("barcode_labels.print_info_stickers")} — ${sz.mm_w}×${sz.mm_h}mm</span>
  ${printerBanner}
</div>
<div class="grid">${labelsHtml}</div>
<script>setTimeout(()=>window.print(),500);</script>
</body></html>`);
    win.document.close();
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
              onClick={handlePrint}
              disabled={items.length === 0}
              className="gap-2"
              data-testid="button-print-labels"
            >
              <Printer className="h-4 w-4" />
              {t("barcode_labels.btn_print")} {totalLabels > 0 && `(${totalLabels} ${t("barcode_labels.label_stickers")})`}
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
                <Select value={size} onValueChange={handleSizeChange}>
                  <SelectTrigger data-testid="select-label-size"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SIZES) as SizeKey[]).map(k => (
                      <SelectItem key={k} value={k}>{SIZES[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("barcode_labels.cols_label")}</label>
                <Select
                  value={String(cols)}
                  onValueChange={v => setCols(Number(v))}
                  disabled={singleLabelMode}
                >
                  <SelectTrigger data-testid="select-label-cols"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} {t("barcode_labels.cols_suffix")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {singleLabelMode && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {t("barcode_labels.single_label_hint")}
                  </p>
                )}
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
                  className="pr-9"
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
                        className="w-full text-right px-3 py-2.5 hover:bg-pink-50 flex items-center justify-between gap-2 transition-colors"
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
                    <div key={item.productId}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">
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
