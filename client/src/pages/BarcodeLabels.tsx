import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Printer, Search, Plus, Minus, Trash2, Tag, Package, X, Eye,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import { useI18n } from "@/lib/i18n";

// ─── types ────────────────────────────────────────────────────────────────────
interface LabelItem {
  productId: number;
  name: string;
  barcode: string;
  price: string;
  qty: number;
}

// ─── label size keys ──────────────────────────────────────────────────────────
const SIZE_DIMS = {
  small:  { w: 150, h: 90,  font: 9,  bh: 40 },
  medium: { w: 220, h: 140, font: 11, bh: 60 },
  large:  { w: 340, h: 190, font: 13, bh: 80 },
} as const;
type SizeKey = keyof typeof SIZE_DIMS;

// ─── single barcode SVG ───────────────────────────────────────────────────────
function BarcodeImg({ barcode, height, width }: { barcode: string; height: number; width: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !barcode) return;
    try {
      JsBarcode(svgRef.current, barcode, {
        format:      "CODE128",
        width:       1.2,
        height,
        displayValue: true,
        fontSize:    9,
        margin:      2,
        lineColor:   "#000",
        background:  "#fff",
      });
    } catch {
      // invalid barcode — render placeholder
      if (svgRef.current) svgRef.current.innerHTML = "";
    }
  }, [barcode, height, width]);

  return <svg ref={svgRef} style={{ width: "100%", maxWidth: width }} />;
}

// ─── label preview card ───────────────────────────────────────────────────────
function LabelCard({ item, size }: { item: LabelItem; size: typeof SIZE_DIMS[SizeKey] }) {
  return (
    <div
      className="border border-gray-300 rounded bg-white flex flex-col items-center justify-between overflow-hidden shrink-0"
      style={{ width: size.w, height: size.h, padding: 4 }}
    >
      <p className="text-center leading-tight font-semibold truncate w-full" style={{ fontSize: size.font }}>
        {item.name}
      </p>
      <div className="w-full flex justify-center">
        <BarcodeImg barcode={item.barcode} height={size.bh} width={size.w - 8} />
      </div>
      <p className="font-bold" style={{ fontSize: size.font + 1 }}>
        {parseFloat(item.price).toFixed(3)} ر.ع
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function BarcodeLabels() {
  const { t, lang } = useI18n();

  const [search, setSearch]       = useState("");
  const [items, setItems]         = useState<LabelItem[]>([]);
  const [size, setSize]           = useState<SizeKey>("medium");
  const [cols, setCols]           = useState(4);
  const [showPreview, setShowPreview] = useState(false);

  // Build SIZES with translated labels (inside component so t() is available)
  const SIZES: Record<SizeKey, typeof SIZE_DIMS[SizeKey] & { label: string }> = {
    small:  { ...SIZE_DIMS.small,  label: t("barcode_labels.size_small") },
    medium: { ...SIZE_DIMS.medium, label: t("barcode_labels.size_medium") },
    large:  { ...SIZE_DIMS.large,  label: t("barcode_labels.size_large") },
  };

  // ── product search ─────────────────────────────────────────────────────────
  const { data: _results } = useQuery<any[]>({
    queryKey: [`/api/products/search?q=${encodeURIComponent(search)}&limit=10`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: search.length >= 1,
  });
  const results: any[] = Array.isArray(_results) ? _results : [];

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
  const handlePrint = () => {
    const sz = SIZES[size];

    // Build label HTML for each item × qty
    const labelsHtml = items.flatMap(item =>
      Array(item.qty).fill(null).map(() => {
        // Generate barcode SVG as string
        const div = document.createElement("div");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        div.appendChild(svg);
        try {
          JsBarcode(svg, item.barcode, {
            format: "CODE128", width: 1.5, height: sz.bh,
            displayValue: true, fontSize: 9, margin: 2,
            lineColor: "#000", background: "#fff",
          });
        } catch { /* skip */ }
        const svgStr = svg.outerHTML;

        return `
          <div class="label">
            <div class="lname">${item.name}</div>
            ${svgStr}
            <div class="lprice">${parseFloat(item.price).toFixed(3)} ${t("barcode_labels.currency")}</div>
          </div>`;
      })
    ).join("");

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="${lang === "ar" ? "rtl" : "ltr"}" lang="${lang}">
<head>
<meta charset="UTF-8"/>
<title>${t("barcode_labels.print_win_title")}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#fff; }
  .grid { display:flex; flex-wrap:wrap; gap:4mm; padding:6mm; justify-content:flex-start; }
  .label {
    width: ${sz.w * 0.265}mm;
    height: ${sz.h * 0.265}mm;
    border: 0.5px solid #ccc;
    display: flex; flex-direction: column;
    align-items: center; justify-content: space-between;
    padding: 1mm; overflow: hidden;
    page-break-inside: avoid;
  }
  .lname { font-size: ${sz.font}px; font-weight:600; text-align:center; width:100%; word-break:break-word; line-height:1.2; }
  .lprice { font-size: ${sz.font + 2}px; font-weight:700; }
  .label svg { width:100%; max-height:${sz.bh * 0.265}mm; }
  @media print {
    @page { margin: 5mm; size: A4; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
  .no-print { text-align:center; padding:10px; background:#f5f5f5; }
  @media print { .no-print { display:none; } }
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="padding:8px 24px;background:#e91e63;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;margin:4px;">
    🖨️ ${t("barcode_labels.print_btn")}
  </button>
  <button onclick="window.close()" style="padding:8px 24px;background:#666;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;margin:4px;">
    ✕ ${t("barcode_labels.print_close")}
  </button>
  <span style="margin-right:12px;font-size:13px;color:#555;">${totalLabels} ${t("barcode_labels.print_info_stickers")} ${SIZES[size].label}</span>
</div>
<div class="grid">${labelsHtml}</div>
<script>setTimeout(()=>window.print(),400);</script>
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)} className="gap-2">
            <Eye className="h-4 w-4" />
            {showPreview ? t("barcode_labels.btn_hide_preview") : t("barcode_labels.btn_preview")}
          </Button>
          <Button onClick={handlePrint} disabled={items.length === 0} className="gap-2">
            <Printer className="h-4 w-4" />
            {t("barcode_labels.btn_print")} {totalLabels > 0 && `(${totalLabels} ${t("barcode_labels.label_stickers")})`}
          </Button>
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
                <Select value={size} onValueChange={v => setSize(v as SizeKey)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SIZES) as SizeKey[]).map(k => (
                      <SelectItem key={k} value={k}>{SIZES[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("barcode_labels.cols_label")}</label>
                <Select value={String(cols)} onValueChange={v => setCols(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} {t("barcode_labels.cols_suffix")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  placeholder={t("barcode_labels.search_placeholder")}
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

              {/* نتائج البحث */}
              {search.length >= 1 && (
                <div className="border rounded-xl divide-y max-h-60 overflow-y-auto shadow-md bg-white z-10">
                  {results.length === 0 ? (
                    <p className="text-center py-4 text-sm text-muted-foreground">{t("barcode_labels.no_results")}</p>
                  ) : results.map((p: any) => (
                    <button
                      key={p.id}
                      className="w-full text-right px-3 py-2.5 hover:bg-pink-50 flex items-center justify-between gap-2 transition-colors"
                      onClick={() => addProduct(p)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.barcode || t("barcode_labels.no_barcode")}</p>
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
                  ))}
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
