/**
 * OpeningStock.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets the owner initialize inventory quantities + costs for any branch
 * without creating a purchase invoice.
 *
 * Flow:  Select branch → Add products (or import CSV) → Save Draft → Commit
 *        (if something went wrong: Reset → start over)
 */

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PackagePlus,
  CheckCircle2,
  RotateCcw,
  Upload,
  Download,
  Trash2,
  AlertTriangle,
  Search,
  ChevronDown,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branch {
  id: number;
  name: string;
}

interface BranchStatus {
  branchId: number;
  branchName: string;
  entryId: number | null;
  status: "draft" | "committed" | "reset" | null;
  totalValue: number;
  itemCount: number;
}

interface OpeningEntry {
  id: number;
  branchId: number;
  branchName: string;
  status: "draft" | "committed" | "reset";
  notes: string | null;
  createdByName: string;
  createdAt: string;
  committedAt: string | null;
  items: ItemRow[];
  totalValue: number;
  itemCount: number;
}

interface ItemRow {
  id?: number;
  productId: number;
  productName: string;
  barcode: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface ProductHit {
  id: number;
  name: string;
  barcode: string | null;
  price: number;
  avgCost: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  committed: "مثبَّت",
  reset: "تم الإعادة",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
  committed: "bg-green-100 text-green-800 border-green-200",
  reset: "bg-gray-100 text-gray-700 border-gray-200",
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

function ProductSearch({ onAdd }: { onAdd: (p: ProductHit) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((val: string) => {
    setQ(val);
    clearTimeout(timerRef.current);
    if (val.trim().length < 1) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch(
          `/api/orders/product-search?search=${encodeURIComponent(val.trim())}`
        );
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
  }, []);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-primary/30">
        {loading ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
        ) : (
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="ابحث بالاسم أو الباركود لإضافة منتج..."
          className="flex-1 outline-none text-sm bg-transparent"
        />
      </div>
      {open && results.length > 0 && (
        <div
          className="absolute z-50 top-full mt-1 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto"
        >
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onAdd(p);
                setQ("");
                setResults([]);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors text-right"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground text-xs">{p.barcode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OpeningStock() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [notes, setNotes] = useState("");
  const [confirmCommit, setConfirmCommit] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvDialog, setCsvDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiFetch("/api/branches"),
  });

  const { data: statusList = [] } = useQuery<BranchStatus[]>({
    queryKey: ["opening-stock-status"],
    queryFn: () => apiFetch("/api/opening-stock"),
  });

  const { data: entry, refetch: refetchEntry } = useQuery<OpeningEntry | null>({
    queryKey: ["opening-stock", selectedBranchId],
    queryFn: () =>
      selectedBranchId
        ? apiFetch(`/api/opening-stock/${selectedBranchId}`)
        : Promise.resolve(null),
    enabled: !!selectedBranchId,
    staleTime: 0,
  });

  // When entry loads, sync items into local state (for draft editing)
  const syncEntry = useCallback((e: OpeningEntry | null | undefined) => {
    if (!e || e.status !== "draft") return;
    setItems(e.items.map((i) => ({ ...i })));
  }, []);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveDraft = useMutation({
    mutationFn: () =>
      apiFetch("/api/opening-stock/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selectedBranchId, items, notes }),
      }),
    onSuccess: () => {
      toast({ title: "تم حفظ المسودة" });
      qc.invalidateQueries({ queryKey: ["opening-stock", selectedBranchId] });
      qc.invalidateQueries({ queryKey: ["opening-stock-status"] });
      refetchEntry();
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const commitMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/opening-stock/commit/${entry?.id}`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "تم تثبيت المخزون الافتتاحي ✅" });
      setConfirmCommit(false);
      qc.invalidateQueries({ queryKey: ["opening-stock"] });
      qc.invalidateQueries({ queryKey: ["opening-stock-status"] });
    },
    onError: (err: any) => {
      setConfirmCommit(false);
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const resetMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/opening-stock/reset/${selectedBranchId}`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "تم إعادة تعيين المخزون الافتتاحي" });
      setConfirmReset(false);
      setItems([]);
      qc.invalidateQueries({ queryKey: ["opening-stock"] });
      qc.invalidateQueries({ queryKey: ["opening-stock-status"] });
    },
    onError: (err: any) => {
      setConfirmReset(false);
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const importCsv = useMutation({
    mutationFn: () =>
      apiFetch("/api/opening-stock/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selectedBranchId, csvText, notes }),
      }),
    onSuccess: (data) => {
      toast({ title: `تم استيراد ${data.itemCount} منتج بنجاح` });
      setCsvDialog(false);
      setCsvText("");
      qc.invalidateQueries({ queryKey: ["opening-stock", selectedBranchId] });
      qc.invalidateQueries({ queryKey: ["opening-stock-status"] });
      refetchEntry().then((r) => syncEntry(r.data));
    },
    onError: (err: any) =>
      toast({ title: "خطأ في الاستيراد", description: err.message, variant: "destructive" }),
  });

  // ── Item manipulation ──────────────────────────────────────────────────────

  function addProduct(p: ProductHit) {
    if (items.some((i) => i.productId === p.id)) {
      toast({ title: "المنتج موجود بالفعل في القائمة", variant: "destructive" });
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        barcode: p.barcode,
        quantity: 1,
        unitCost: p.avgCost || p.price || 0,
        totalCost: p.avgCost || p.price || 0,
      },
    ]);
  }

  function updateItem(idx: number, field: "quantity" | "unitCost", value: number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        updated.totalCost = updated.quantity * updated.unitCost;
        return updated;
      })
    );
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── CSV helpers ────────────────────────────────────────────────────────────

  function downloadTemplate() {
    const header = "barcode,quantity,unit_cost";
    const sample = "1234567890,10,5.500\n9876543210,5,12.750";
    const blob = new Blob([header + "\n" + sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "opening_stock_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string);
      setCsvDialog(true);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const totalValue = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const branchStatus = statusList.find((s) => s.branchId === selectedBranchId);
  const isCommitted = entry?.status === "committed";
  const isDraft = !entry || entry.status === "draft" || entry.status === "reset";
  const canCommit = entry?.status === "draft" && items.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackagePlus className="h-6 w-6 text-primary" />
            المخزون الافتتاحي
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            تهيئة الكميات والتكاليف للفروع دون فاتورة شراء
          </p>
        </div>
      </div>

      {/* ── Branch status overview ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {statusList.map((s) => (
          <button
            key={s.branchId}
            type="button"
            onClick={() => {
              setSelectedBranchId(s.branchId);
              setItems([]);
            }}
            className={`text-right p-4 border-2 rounded-xl transition-all ${
              selectedBranchId === s.branchId
                ? "border-primary bg-primary/5"
                : "border-transparent bg-muted/40 hover:border-muted"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">{s.branchName}</span>
              {s.status ? (
                <span
                  className={`text-xs border px-2 py-0.5 rounded-full ${STATUS_COLOR[s.status]}`}
                >
                  {STATUS_LABEL[s.status]}
                </span>
              ) : (
                <span className="text-xs border px-2 py-0.5 rounded-full bg-gray-50 text-gray-500">
                  غير مهيأ
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {s.itemCount} صنف — {fmt(s.totalValue)} ر.ع
            </p>
          </button>
        ))}
      </div>

      {/* ── Main work area ── */}
      {selectedBranchId && (
        <div className="space-y-4">
          {/* Status banner for committed */}
          {isCommitted && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-green-800">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">المخزون الافتتاحي مُثبَّت</p>
                <p className="text-sm">
                  تم التثبيت في{" "}
                  {entry?.committedAt
                    ? new Date(entry.committedAt).toLocaleString("ar-OM")
                    : "—"}{" "}
                  بواسطة {entry?.createdByName}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-green-300 text-green-800 hover:bg-green-100 gap-1"
                onClick={() => setConfirmReset(true)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                إعادة تعيين
              </Button>
            </div>
          )}

          {/* Toolbar */}
          {!isCommitted && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[240px]">
                <ProductSearch onAdd={addProduct} />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                استيراد CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
                onClick={downloadTemplate}
              >
                <Download className="h-4 w-4" />
                تحميل النموذج
              </Button>
            </div>
          )}

          {/* Items table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  الأصناف ({items.length} صنف)
                </CardTitle>
                {branchStatus?.status === "draft" && entry && !items.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => syncEntry(entry)}
                  >
                    تحميل المسودة المحفوظة
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Info className="h-8 w-8 opacity-30" />
                  <p className="text-sm">
                    {isCommitted
                      ? "لا توجد أصناف لعرضها (تم التثبيت)"
                      : "ابدأ بإضافة منتجات أو استيراد ملف CSV"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30 text-right">
                        <th className="px-4 py-2 font-medium">المنتج</th>
                        <th className="px-4 py-2 font-medium">الباركود</th>
                        <th className="px-4 py-2 font-medium w-28">الكمية</th>
                        <th className="px-4 py-2 font-medium w-32">تكلفة الوحدة</th>
                        <th className="px-4 py-2 font-medium w-32 text-left">الإجمالي</th>
                        {!isCommitted && <th className="w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {(isCommitted ? entry!.items : items).map((item, idx) => (
                        <tr
                          key={item.productId}
                          className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-2 font-medium">{item.productName}</td>
                          <td className="px-4 py-2 text-muted-foreground text-xs">
                            {item.barcode ?? "—"}
                          </td>
                          <td className="px-4 py-2">
                            {isCommitted ? (
                              <span>{item.quantity}</span>
                            ) : (
                              <Input
                                type="number"
                                min={0.001}
                                step={0.001}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(idx, "quantity", parseFloat(e.target.value) || 0)
                                }
                                className="h-7 text-sm w-24 text-center"
                              />
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {isCommitted ? (
                              <span>{fmt(item.unitCost)}</span>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                step={0.001}
                                value={item.unitCost}
                                onChange={(e) =>
                                  updateItem(idx, "unitCost", parseFloat(e.target.value) || 0)
                                }
                                className="h-7 text-sm w-28 text-center"
                              />
                            )}
                          </td>
                          <td className="px-4 py-2 text-left font-medium">
                            {fmt(item.quantity * item.unitCost)} ر.ع
                          </td>
                          {!isCommitted && (
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-destructive hover:opacity-70 p-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/20 font-semibold">
                        <td colSpan={4} className="px-4 py-2 text-right">
                          الإجمالي
                        </td>
                        <td className="px-4 py-2 text-left text-primary">
                          {fmt(isCommitted ? entry!.totalValue : totalValue)} ر.ع
                        </td>
                        {!isCommitted && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes + Action buttons */}
          {!isCommitted && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="ملاحظات (اختياري)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                className="gap-1"
                disabled={items.length === 0 || saveDraft.isPending}
                onClick={() => saveDraft.mutate()}
              >
                {saveDraft.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ مسودة
              </Button>
              <Button
                className="gap-1 bg-green-600 hover:bg-green-700"
                disabled={!canCommit || commitMut.isPending}
                onClick={() => {
                  // Auto-save draft first, then confirm commit
                  if (items.length > 0) saveDraft.mutate(undefined, {
                    onSuccess: () => setConfirmCommit(true),
                  });
                }}
              >
                {commitMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle2 className="h-4 w-4" />
                تثبيت المخزون
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Confirm Commit dialog ── */}
      <Dialog open={confirmCommit} onOpenChange={setConfirmCommit}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              تأكيد تثبيت المخزون الافتتاحي
            </DialogTitle>
            <DialogDescription>
              سيتم إضافة <strong>{items.length} صنف</strong> بقيمة إجمالية{" "}
              <strong>{fmt(totalValue)} ر.ع</strong> إلى مخزون الفرع وإنشاء قيد
              محاسبي تلقائي. لا يمكن التراجع إلا عبر زر "إعادة التعيين".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button
              className="bg-green-600 hover:bg-green-700 gap-1"
              onClick={() => commitMut.mutate()}
              disabled={commitMut.isPending}
            >
              {commitMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              نعم، ثبِّت
            </Button>
            <Button variant="outline" onClick={() => setConfirmCommit(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Reset dialog ── */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5" />
              إعادة تعيين المخزون الافتتاحي
            </DialogTitle>
            <DialogDescription>
              سيتم خصم الكميات التي أُضيفت من مخزون الفرع. هذا الإجراء يسمح
              بإعادة إدخال المخزون الافتتاحي من الصفر.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button
              variant="destructive"
              onClick={() => resetMut.mutate()}
              disabled={resetMut.isPending}
            >
              {resetMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              نعم، أعِد التعيين
            </Button>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CSV import dialog ── */}
      <Dialog open={csvDialog} onOpenChange={setCsvDialog}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              معاينة استيراد CSV
            </DialogTitle>
            <DialogDescription>
              راجع محتوى الملف قبل الاستيراد. الأعمدة المطلوبة:{" "}
              <code className="bg-muted px-1 rounded">barcode</code>,{" "}
              <code className="bg-muted px-1 rounded">quantity</code>,{" "}
              <code className="bg-muted px-1 rounded">unit_cost</code>
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
            className="w-full border rounded-lg p-3 text-sm font-mono bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            dir="ltr"
          />
          <DialogFooter className="gap-2 flex-row-reverse">
            <Button
              className="gap-1"
              onClick={() => importCsv.mutate()}
              disabled={importCsv.isPending || !csvText.trim() || !selectedBranchId}
            >
              {importCsv.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              استيراد
            </Button>
            <Button variant="outline" onClick={() => { setCsvDialog(false); setCsvText(""); }}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
