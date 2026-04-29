/**
 * OpeningStock.tsx — جلسة 30
 * دعم كامل للـ variants (لون / مقاس) عند إدخال المخزون الافتتاحي
 */

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PackagePlus, CheckCircle2, RotateCcw, Upload, Download,
  Trash2, AlertTriangle, Search, Loader2, Info, Plus, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch      { id: number; name: string; }
interface BranchStatus {
  branchId: number; branchName: string; entryId: number | null;
  status: "draft" | "committed" | "reset" | null;
  totalValue: number; itemCount: number;
}
interface OpeningEntry {
  id: number; branchId: number; branchName: string;
  status: "draft" | "committed" | "reset";
  notes: string | null; createdByName: string;
  createdAt: string; committedAt: string | null;
  items: ItemRow[]; totalValue: number; itemCount: number;
}
interface ItemRow {
  id?: number;
  productId: number; variantId?: number | null;
  productName: string; barcode: string | null;
  color?: string | null; size?: string | null;
  quantity: number; unitCost: number; totalCost: number;
}
interface ProductHit {
  id: number; name: string; barcode: string | null;
  price: number; avgCost: number; modelNumber?: string | null;
}
interface ProductVariant {
  id: number; color: string | null; size: string | null;
  sku: string | null; barcode: string | null;
  price: number; lastPurchasePrice?: number | null; stockQty: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-yellow-100 text-yellow-800 border-yellow-200",
  committed: "bg-green-100  text-green-800  border-green-200",
  reset:     "bg-gray-100   text-gray-700   border-gray-200",
};

function fmt(v: number) {
  return v.toLocaleString("ar-OM", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
async function apiFetch(url: string, opts?: RequestInit) {
  const r = await fetch(url, { credentials: "include", ...opts });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "خطأ في الخادم");
  return data;
}

// ─── Product search box ───────────────────────────────────────────────────────

function ProductSearch({ onSelect, placeholder }: {
  onSelect: (p: ProductHit) => void; placeholder: string;
}) {
  const [q, setQ]           = useState("");
  const [results, setResults] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((val: string) => {
    setQ(val);
    if (timerRef.current != null) clearTimeout(timerRef.current);
    if (val.trim().length < 1) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch(
          `/api/products/search?q=${encodeURIComponent(val.trim())}&limit=20`
        );
        const list = Array.isArray(data) ? data
          : Array.isArray(data?.products) ? data.products : [];
        setResults(list);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 280);
  }, []);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary/30">
        {loading
          ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
          : <Search className="h-4 w-4 text-muted-foreground shrink-0" />}
        <input
          value={q}
          onChange={e => search(e.target.value)}
          placeholder={placeholder}
          className="flex-1 outline-none text-sm bg-transparent"
        />
        {q && (
          <button onClick={() => { setQ(""); setResults([]); setOpen(false); }}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map(p => (
            <button key={p.id} type="button"
              onClick={() => { onSelect(p); setQ(""); setResults([]); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted transition-colors text-start gap-2"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                {p.modelNumber && (
                  <p className="text-[11px] text-muted-foreground">موديل: {p.modelNumber}</p>
                )}
              </div>
              <span className="text-muted-foreground text-xs shrink-0 font-mono">{p.barcode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Variant Picker Dialog ────────────────────────────────────────────────────

function VariantPickerDialog({
  product, defaultCost, open, onClose, onAdd,
}: {
  product: ProductHit | null;
  defaultCost: number;
  open: boolean;
  onClose: () => void;
  onAdd: (rows: ItemRow[]) => void;
}) {
  const [variants, setVariants]   = useState<ProductVariant[]>([]);
  const [loading, setLoading]     = useState(false);
  // qty/cost per variant id
  const [qtys, setQtys]   = useState<Record<number, number>>({});
  const [costs, setCosts] = useState<Record<number, number>>({});

  // fetch variants when dialog opens
  const prevId = useRef<number | null>(null);
  if (open && product && prevId.current !== product.id) {
    prevId.current = product.id;
    setLoading(true);
    apiFetch(`/api/products/${product.id}/variants-with-stock`)
      .then((data: ProductVariant[]) => {
        const list = Array.isArray(data) ? data : [];
        setVariants(list);
        // init costs from lastPurchasePrice or product avgCost
        const initCosts: Record<number, number> = {};
        const initQtys:  Record<number, number> = {};
        for (const v of list) {
          initCosts[v.id] = v.lastPurchasePrice || defaultCost || 0;
          initQtys[v.id]  = 0;
        }
        setCosts(initCosts);
        setQtys(initQtys);
      })
      .catch(() => setVariants([]))
      .finally(() => setLoading(false));
  }
  if (!open && prevId.current !== null) prevId.current = null;

  function handleAdd() {
    if (!product) return;
    const rows: ItemRow[] = [];
    for (const v of variants) {
      const qty = qtys[v.id] ?? 0;
      if (qty <= 0) continue;
      const cost = costs[v.id] ?? 0;
      rows.push({
        productId:   product.id,
        variantId:   v.id,
        productName: product.name,
        barcode:     v.barcode ?? product.barcode,
        color:       v.color,
        size:        v.size,
        quantity:    qty,
        unitCost:    cost,
        totalCost:   qty * cost,
      });
    }
    if (rows.length === 0) return;
    onAdd(rows);
    onClose();
  }

  const totalQty = Object.values(qtys).reduce((s, q) => s + (q || 0), 0);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-primary" />
            {product?.name}
          </DialogTitle>
          <DialogDescription>
            أدخل الكمية والتكلفة لكل مقاس / لون تريد إضافته
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : variants.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">
            لا توجد متغيرات لهذا المنتج — سيُضاف كمنتج بسيط
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-muted/40 text-start border-b">
                  <th className="px-3 py-2 font-medium">اللون</th>
                  <th className="px-3 py-2 font-medium">المقاس</th>
                  <th className="px-3 py-2 font-medium">باركود</th>
                  <th className="px-3 py-2 font-medium w-28 text-center">الكمية</th>
                  <th className="px-3 py-2 font-medium w-32 text-center">التكلفة</th>
                </tr>
              </thead>
              <tbody>
                {variants.map(v => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      {v.color
                        ? <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                              style={{ background: v.color.toLowerCase() }} />
                            {v.color}
                          </span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2">{v.size || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {v.barcode || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Input
                        type="number" min={0} step={1}
                        value={qtys[v.id] ?? 0}
                        onChange={e => setQtys(prev => ({ ...prev, [v.id]: parseFloat(e.target.value) || 0 }))}
                        className="h-7 w-24 text-center text-sm mx-auto"
                        inputMode="numeric"
                        dir="ltr"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Input
                        type="number" min={0} step={0.001}
                        value={costs[v.id] ?? 0}
                        onChange={e => setCosts(prev => ({ ...prev, [v.id]: parseFloat(e.target.value) || 0 }))}
                        className="h-7 w-28 text-center text-sm mx-auto"
                        inputMode="decimal"
                        dir="ltr"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            onClick={handleAdd}
            disabled={variants.length > 0 && totalQty === 0}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            إضافة ({totalQty} وحدة)
          </Button>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Simple product qty dialog (no variants) ──────────────────────────────────

function SimpleProductDialog({ product, open, onClose, onAdd }: {
  product: ProductHit | null; open: boolean;
  onClose: () => void; onAdd: (row: ItemRow) => void;
}) {
  const [qty,  setQty]  = useState(1);
  const [cost, setCost] = useState(0);

  // reset when product changes
  if (open && product && cost === 0) setCost(product.avgCost || product.price || 0);

  function handleAdd() {
    if (!product || qty <= 0) return;
    onAdd({
      productId: product.id, variantId: null,
      productName: product.name, barcode: product.barcode,
      color: null, size: null,
      quantity: qty, unitCost: cost, totalCost: qty * cost,
    });
    onClose();
    setQty(1); setCost(0);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setQty(1); setCost(0); } }}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
          <DialogDescription>أدخل الكمية والتكلفة</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">الكمية</label>
            <Input type="number" min={1} step={1} value={qty}
              onChange={e => setQty(parseFloat(e.target.value) || 1)}
              className="text-center" inputMode="numeric" dir="ltr" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">التكلفة</label>
            <Input type="number" min={0} step={0.001} value={cost}
              onChange={e => setCost(parseFloat(e.target.value) || 0)}
              className="text-center" inputMode="decimal" dir="ltr" />
          </div>
        </div>
        <DialogFooter className="gap-2 flex-row-reverse">
          <Button onClick={handleAdd} className="gap-1">
            <Plus className="h-4 w-4" /> إضافة
          </Button>
          <Button variant="outline" onClick={() => { onClose(); setQty(1); setCost(0); }}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OpeningStock() {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  function statusLabel(s: string | null): string {
    if (!s) return t("opening_stock.status_none");
    const map: Record<string, string> = {
      draft:     t("opening_stock.status_draft"),
      committed: t("opening_stock.status_committed"),
      reset:     t("opening_stock.status_reset"),
    };
    return map[s] ?? s;
  }

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [items, setItems]         = useState<ItemRow[]>([]);
  const [notes, setNotes]         = useState("");
  const [confirmCommit, setConfirmCommit] = useState(false);
  const [confirmReset,  setConfirmReset]  = useState(false);
  const [csvText,   setCsvText]   = useState("");
  const [csvDialog, setCsvDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Variant / simple product dialogs ──────────────────────────────────────
  const [pickerProduct,  setPickerProduct]  = useState<ProductHit | null>(null);
  const [pickerIsVariant, setPickerIsVariant] = useState(false);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [simpleDialogOpen,  setSimpleDialogOpen]  = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: statusList = [] } = useQuery<BranchStatus[]>({
    queryKey: ["opening-stock-status"],
    queryFn: () => apiFetch("/api/opening-stock"),
  });

  const { data: entry, refetch: refetchEntry } = useQuery<OpeningEntry | null>({
    queryKey: ["opening-stock", selectedBranchId],
    queryFn: () => selectedBranchId
      ? apiFetch(`/api/opening-stock/${selectedBranchId}`)
      : Promise.resolve(null),
    enabled: !!selectedBranchId,
    staleTime: 0,
  });

  const syncEntry = useCallback((e: OpeningEntry | null | undefined) => {
    if (!e || e.status !== "draft") return;
    setItems(e.items.map(i => ({ ...i })));
  }, []);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveDraft = useMutation({
    mutationFn: () => apiFetch("/api/opening-stock/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: selectedBranchId, items, notes }),
    }),
    onSuccess: () => {
      toast({ title: t("opening_stock.draft_saved") });
      qc.invalidateQueries({ queryKey: ["opening-stock", selectedBranchId] });
      qc.invalidateQueries({ queryKey: ["opening-stock-status"] });
      refetchEntry();
    },
    onError: (err: any) =>
      toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  const commitMut = useMutation({
    mutationFn: () => apiFetch(`/api/opening-stock/commit/${entry?.id}`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: t("opening_stock.committed_success") });
      setConfirmCommit(false);
      qc.invalidateQueries({ queryKey: ["opening-stock"] });
      qc.invalidateQueries({ queryKey: ["opening-stock-status"] });
    },
    onError: (err: any) => {
      setConfirmCommit(false);
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const resetMut = useMutation({
    mutationFn: () => apiFetch(`/api/opening-stock/reset/${selectedBranchId}`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: t("opening_stock.reset_success") });
      setConfirmReset(false);
      setItems([]);
      qc.invalidateQueries({ queryKey: ["opening-stock"] });
      qc.invalidateQueries({ queryKey: ["opening-stock-status"] });
    },
    onError: (err: any) => {
      setConfirmReset(false);
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const importCsv = useMutation({
    mutationFn: () => apiFetch("/api/opening-stock/import-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId: selectedBranchId, csvText, notes }),
    }),
    onSuccess: (data) => {
      toast({ title: `${data.itemCount} ${t("opening_stock.items_count")} — ${t("opening_stock.committed_success")}` });
      setCsvDialog(false); setCsvText("");
      qc.invalidateQueries({ queryKey: ["opening-stock", selectedBranchId] });
      qc.invalidateQueries({ queryKey: ["opening-stock-status"] });
      refetchEntry().then(r => syncEntry(r.data));
    },
    onError: (err: any) =>
      toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  // ── Product selection → check variants ────────────────────────────────────

  async function handleProductSelect(p: ProductHit) {
    // check if this product has variants
    try {
      const variants: ProductVariant[] = await apiFetch(
        `/api/products/${p.id}/variants-with-stock`
      );
      const hasVariants = Array.isArray(variants) && variants.length > 0;
      setPickerProduct(p);
      setPickerIsVariant(hasVariants);
      if (hasVariants) setVariantDialogOpen(true);
      else             setSimpleDialogOpen(true);
    } catch {
      setPickerProduct(p);
      setPickerIsVariant(false);
      setSimpleDialogOpen(true);
    }
  }

  // ── Add rows to items list ─────────────────────────────────────────────────

  function addRows(rows: ItemRow[]) {
    setItems(prev => {
      let next = [...prev];
      for (const row of rows) {
        const dupKey = `${row.productId}:${row.variantId ?? "null"}`;
        const exists = next.some(i => `${i.productId}:${i.variantId ?? "null"}` === dupKey);
        if (exists) {
          toast({ title: "الصنف موجود مسبقاً", variant: "destructive" });
          continue;
        }
        next = [...next, row];
      }
      return next;
    });
  }

  function updateItem(idx: number, field: "quantity" | "unitCost", value: number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.totalCost = updated.quantity * updated.unitCost;
      return updated;
    }));
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  // ── CSV helpers ────────────────────────────────────────────────────────────

  function downloadTemplate() {
    const blob = new Blob(
      ["barcode,quantity,unit_cost\n1234567890,10,5.500\n9876543210,5,12.750"],
      { type: "text/csv;charset=utf-8;" }
    );
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob), download: "opening_stock_template.csv",
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setCsvText(ev.target?.result as string); setCsvDialog(true); };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const totalValue  = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const isCommitted = entry?.status === "committed";
  const canCommit   = entry?.status === "draft" && items.length > 0;
  const displayItems = isCommitted ? (entry?.items ?? []) : items;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" dir={lang === "ar" ? "rtl" : "ltr"}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PackagePlus className="h-6 w-6 text-primary" />
          {t("opening_stock.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("opening_stock.subtitle")}</p>
      </div>

      {/* Branch status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {statusList.map(s => (
          <button key={s.branchId} type="button"
            onClick={() => { setSelectedBranchId(s.branchId); setItems([]); }}
            className={`text-start p-4 border-2 rounded-xl transition-all ${
              selectedBranchId === s.branchId
                ? "border-primary bg-primary/5"
                : "border-transparent bg-muted/40 hover:border-muted"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">{s.branchName}</span>
              <span className={`text-xs border px-2 py-0.5 rounded-full ${
                s.status ? STATUS_COLOR[s.status] : "bg-gray-50 text-gray-500"
              }`}>
                {statusLabel(s.status)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {s.itemCount} {t("opening_stock.items_count")} — {fmt(s.totalValue)} {t("branch_summary.omr")}
            </p>
          </button>
        ))}
      </div>

      {/* Main work area */}
      {selectedBranchId && (
        <div className="space-y-4">

          {/* Committed banner */}
          {isCommitted && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-green-800">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">{t("opening_stock.committed_banner")}</p>
                <p className="text-sm">
                  {t("opening_stock.committed_at")}{" "}
                  {entry?.committedAt
                    ? new Date(entry.committedAt).toLocaleString(lang === "ar" ? "ar-OM" : "en-GB")
                    : "—"}{" "}
                  {t("opening_stock.committed_by")} {entry?.createdByName}
                </p>
              </div>
              <Button variant="outline" size="sm"
                className="border-green-300 text-green-800 hover:bg-green-100 gap-1"
                onClick={() => setConfirmReset(true)}>
                <RotateCcw className="h-3.5 w-3.5" /> {t("opening_stock.reset")}
              </Button>
            </div>
          )}

          {/* Toolbar */}
          {!isCommitted && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Section label */}
              <div className="w-full text-xs text-muted-foreground font-medium mb-1">
                ابحث عن منتج موجود في النظام وأضفه:
              </div>
              <div className="flex-1 min-w-[260px]">
                <ProductSearch onSelect={handleProductSelect} placeholder="ابحث بالاسم أو الموديل أو الباركود…" />
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv"
                className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" size="sm" className="gap-1"
                onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> {t("opening_stock.import_csv")}
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground"
                onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> {t("opening_stock.download_template")}
              </Button>
            </div>
          )}

          {/* Items table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  المنتجات ({items.length} {t("opening_stock.items_count")})
                </CardTitle>
                {entry?.status === "draft" && entry && !items.length && (
                  <Button variant="ghost" size="sm" className="text-xs"
                    onClick={() => syncEntry(entry)}>
                    {t("opening_stock.load_draft")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {displayItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Info className="h-8 w-8 opacity-30" />
                  <p className="text-sm">
                    {isCommitted ? t("opening_stock.already_committed_empty") : t("opening_stock.empty_hint")}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-start">
                        <th className="px-4 py-2 font-medium">{t("opening_stock.product")}</th>
                        <th className="px-3 py-2 font-medium">اللون</th>
                        <th className="px-3 py-2 font-medium">المقاس</th>
                        <th className="px-4 py-2 font-medium text-xs text-muted-foreground">باركود</th>
                        <th className="px-4 py-2 font-medium w-28 text-center">{t("opening_stock.quantity")}</th>
                        <th className="px-4 py-2 font-medium w-32 text-center">{t("opening_stock.unit_cost")}</th>
                        <th className="px-4 py-2 font-medium w-32 text-end">{t("opening_stock.subtotal")}</th>
                        {!isCommitted && <th className="w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map((item, idx) => (
                        <tr key={`${item.productId}-${item.variantId ?? "simple"}-${idx}`}
                          className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2 font-medium">{item.productName}</td>
                          <td className="px-3 py-2">
                            {item.color
                              ? <span className="inline-flex items-center gap-1.5 text-xs">
                                  <span className="w-3 h-3 rounded-full border shrink-0"
                                    style={{ background: item.color.toLowerCase() }} />
                                  {item.color}
                                </span>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2 text-sm">{item.size || "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs font-mono">
                            {item.barcode ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {isCommitted ? (
                              <span>{item.quantity}</span>
                            ) : (
                              <Input type="number" min={0.001} step={1}
                                value={item.quantity}
                                onChange={e => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                                className="h-7 text-sm w-24 text-center mx-auto"
                                inputMode="numeric" dir="ltr" />
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {isCommitted ? (
                              <span>{fmt(item.unitCost)}</span>
                            ) : (
                              <Input type="number" min={0} step={0.001}
                                value={item.unitCost}
                                onChange={e => updateItem(idx, "unitCost", parseFloat(e.target.value) || 0)}
                                className="h-7 text-sm w-28 text-center mx-auto"
                                inputMode="decimal" dir="ltr" />
                            )}
                          </td>
                          <td className="px-4 py-2 text-end font-medium">
                            {fmt(item.quantity * item.unitCost)} {t("branch_summary.omr")}
                          </td>
                          {!isCommitted && (
                            <td className="px-2 py-2">
                              <button type="button" onClick={() => removeItem(idx)}
                                className="text-destructive hover:opacity-70 p-1">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/20 font-semibold">
                        <td colSpan={6} className="px-4 py-2 text-start">
                          {t("opening_stock.total")}
                        </td>
                        <td className="px-4 py-2 text-end text-primary">
                          {fmt(isCommitted ? entry!.totalValue : totalValue)} {t("branch_summary.omr")}
                        </td>
                        {!isCommitted && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes + Actions */}
          {!isCommitted && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Input placeholder={t("opening_stock.notes_placeholder")}
                value={notes} onChange={e => setNotes(e.target.value)} className="flex-1" />
              <Button variant="outline" className="gap-1"
                disabled={items.length === 0 || saveDraft.isPending}
                onClick={() => saveDraft.mutate()}>
                {saveDraft.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("opening_stock.save_draft")}
              </Button>
              <Button className="gap-1 bg-green-600 hover:bg-green-700"
                disabled={!canCommit || commitMut.isPending}
                onClick={() => {
                  if (items.length > 0) saveDraft.mutate(undefined, {
                    onSuccess: () => setConfirmCommit(true),
                  });
                }}>
                {commitMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle2 className="h-4 w-4" />
                {t("opening_stock.commit")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Variant Picker Dialog ── */}
      <VariantPickerDialog
        product={pickerProduct}
        defaultCost={pickerProduct?.avgCost || pickerProduct?.price || 0}
        open={variantDialogOpen}
        onClose={() => { setVariantDialogOpen(false); setPickerProduct(null); }}
        onAdd={addRows}
      />

      {/* ── Simple Product Dialog ── */}
      <SimpleProductDialog
        product={pickerProduct}
        open={simpleDialogOpen}
        onClose={() => { setSimpleDialogOpen(false); setPickerProduct(null); }}
        onAdd={row => addRows([row])}
      />

      {/* ── Confirm Commit ── */}
      <Dialog open={confirmCommit} onOpenChange={setConfirmCommit}>
        <DialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {t("opening_stock.confirm_commit_title")}
            </DialogTitle>
            <DialogDescription>
              {t("opening_stock.confirm_commit_desc")
                .replace("{count}", String(items.length))
                .replace("{total}", `${fmt(totalValue)} ${t("branch_summary.omr")}`)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button className="bg-green-600 hover:bg-green-700 gap-1"
              onClick={() => commitMut.mutate()} disabled={commitMut.isPending}>
              {commitMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("opening_stock.confirm_commit_btn")}
            </Button>
            <Button variant="outline" onClick={() => setConfirmCommit(false)}>
              {t("opening_stock.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Reset ── */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5" />
              {t("opening_stock.confirm_reset_title")}
            </DialogTitle>
            <DialogDescription>{t("opening_stock.confirm_reset_desc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button variant="destructive" onClick={() => resetMut.mutate()} disabled={resetMut.isPending}>
              {resetMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("opening_stock.confirm_reset_btn")}
            </Button>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              {t("opening_stock.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CSV import ── */}
      <Dialog open={csvDialog} onOpenChange={setCsvDialog}>
        <DialogContent dir={lang === "ar" ? "rtl" : "ltr"} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              {t("opening_stock.csv_preview_title")}
            </DialogTitle>
            <DialogDescription>
              {t("opening_stock.csv_preview_desc")}{" "}
              <code className="bg-muted px-1 rounded">barcode</code>,{" "}
              <code className="bg-muted px-1 rounded">quantity</code>,{" "}
              <code className="bg-muted px-1 rounded">unit_cost</code>
            </DialogDescription>
          </DialogHeader>
          <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
            rows={10}
            className="w-full border rounded-lg p-3 text-sm font-mono bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            dir="ltr" />
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button className="gap-1"
              onClick={() => importCsv.mutate()}
              disabled={importCsv.isPending || !csvText.trim() || !selectedBranchId}>
              {importCsv.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("opening_stock.import_btn")}
            </Button>
            <Button variant="outline" onClick={() => { setCsvDialog(false); setCsvText(""); }}>
              {t("opening_stock.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
