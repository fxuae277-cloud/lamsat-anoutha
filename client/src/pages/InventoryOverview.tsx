import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PackageSearch, Boxes, TrendingDown, AlertTriangle,
  Search, GitBranch, ArrowUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getQueryFn, parseServerError } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { fmtOMR, fmtDate } from "@/lib/formatters";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";
import type { Branch } from "@shared/schema";

// ── أيقونة الفئة الافتراضية ──────────────────────────────────────────────
const CAT_ICONS: Record<string, string> = {
  خواتم: "💍", حلقان: "💎", أطقم: "👑", عقود: "📿", أساور: "⌚",
};
function catIcon(name?: string) {
  if (!name) return "📦";
  for (const [k, v] of Object.entries(CAT_ICONS)) {
    if (name.includes(k)) return v;
  }
  return "📦";
}

// ── شارة الفئة ───────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  خواتم:  "bg-pink-100 text-pink-700 border-pink-200",
  حلقان:  "bg-purple-100 text-purple-700 border-purple-200",
  أطقم:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  عقود:   "bg-blue-100 text-blue-700 border-blue-200",
  أساور:  "bg-green-100 text-green-700 border-green-200",
};
function catBadgeClass(name?: string) {
  if (!name) return "bg-gray-100 text-gray-600 border-gray-200";
  for (const [k, v] of Object.entries(CAT_COLORS)) {
    if (name.includes(k)) return v;
  }
  return "bg-gray-100 text-gray-600 border-gray-200";
}

export default function InventoryOverview() {
  const { t } = useI18n();

  // Stock tab state
  const [stockSearch,  setStockSearch]  = useState("");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterType,   setFilterType]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortCol,      setSortCol]      = useState<"name"|"qty"|"price">("name");
  const [sortDir,      setSortDir]      = useState<"asc"|"desc">("asc");

  // Movements tab state
  const [movType,   setMovType]   = useState("all");
  const [movFrom,   setMovFrom]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [movTo,     setMovTo]     = useState(new Date().toISOString().slice(0, 10));
  const [movBranch, setMovBranch] = useState("all");
  const [movSearch, setMovSearch] = useState("");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: stockRaw = [], isLoading: stockLoading } = useQuery<any[]>({
    queryKey: ["/api/inventory-balances"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: movements = [], isLoading: movLoading } = useQuery<any[]>({
    queryKey: ["/api/inventory/transactions", { type: movType, from: movFrom, to: movTo }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (movType !== "all") params.set("type", movType);
      if (movFrom) params.set("from", movFrom);
      if (movTo)   params.set("to",   movTo);
      const res = await fetch(`/api/inventory/transactions?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(await parseServerError(res));
      return res.json();
    },
  });

  // ── فلترة المخزون ─────────────────────────────────────────────────────
  const filtered = stockRaw
    .filter(row => {
      if (filterBranch !== "all" && String(row.branch_id) !== filterBranch) return false;
      if (filterType   !== "all" && row.product_type !== filterType)         return false;
      if (filterStatus === "low"  && row.qty_on_hand > row.reorder_level)    return false;
      if (filterStatus === "ok"   && row.qty_on_hand <= row.reorder_level)   return false;
      if (filterStatus === "zero" && row.qty_on_hand !== 0)                  return false;
      if (stockSearch) {
        const q = stockSearch.toLowerCase();
        const hits = [row.product_name, row.barcode, row.sku, row.category_name]
          .map(v => (v || "").toLowerCase());
        if (!hits.some(h => h.includes(q))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let va: any, vb: any;
      if (sortCol === "name")  { va = a.product_name || ""; vb = b.product_name || ""; }
      if (sortCol === "qty")   { va = a.qty_on_hand;        vb = b.qty_on_hand; }
      if (sortCol === "price") { va = parseFloat(a.price || "0"); vb = parseFloat(b.price || "0"); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });

  // ── KPIs ──────────────────────────────────────────────────────────────
  const totalRows    = stockRaw.length;
  const lowStockRows = stockRaw.filter(r => r.qty_on_hand > 0 && r.qty_on_hand <= r.reorder_level).length;
  const zeroRows     = stockRaw.filter(r => r.qty_on_hand === 0).length;
  const totalValue   = stockRaw.reduce((s, r) => s + parseFloat(r.price || "0") * r.qty_on_hand, 0);

  // ── ترتيب الأعمدة ──────────────────────────────────────────────────
  function toggleSort(col: "name"|"qty"|"price") {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }
  function SortBtn({ col, label }: { col: "name"|"qty"|"price"; label: string }) {
    return (
      <button
        className="flex items-center gap-1 hover:text-primary transition-colors"
        onClick={() => toggleSort(col)}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortCol === col ? "text-primary" : "text-muted-foreground/50"}`} />
      </button>
    );
  }

  // ── نوع الحركة ────────────────────────────────────────────────────────
  function typeLabel(type: string) {
    const key = `inv_overview.type_${type}`;
    const label = t(key);
    return label.startsWith("inv_overview.") ? type : label;
  }
  function typeBadgeClass(type: string) {
    if (type === "sale")                                return "bg-blue-100 text-blue-700 border-blue-300";
    if (type === "purchase" || type === "receive")      return "bg-green-100 text-green-700 border-green-300";
    if (type.includes("transfer"))                      return "bg-purple-100 text-purple-700 border-purple-300";
    if (type.includes("adjust") || type.includes("stocktake")) return "bg-amber-100 text-amber-700 border-amber-300";
    return "bg-gray-100 text-gray-600 border-gray-300";
  }

  // ── فلترة الحركات ──────────────────────────────────────────────────
  const filteredMovements = movements.filter(m => {
    if (movBranch !== "all" && String(m.branchId) !== movBranch) return false;
    if (movSearch) {
      const q = movSearch.toLowerCase();
      if (!(m.productName || "").toLowerCase().includes(q) && !(m.note || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="container mx-auto p-4 lg:p-6 pb-20" dir="rtl">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t("inv_overview.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("inv_overview.subtitle")}</p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-0 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-4 flex gap-3 items-center">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalRows}</p>
              <p className="text-xs text-muted-foreground">{t("dashboard.total_products")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-yellow-50 to-yellow-100/60">
          <CardContent className="p-4 flex gap-3 items-center">
            <div className="w-10 h-10 rounded-xl bg-yellow-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{lowStockRows}</p>
              <p className="text-xs text-muted-foreground">{t("inv_overview.status_low")}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-red-50 to-red-100/60">
          <CardContent className="p-4 flex gap-3 items-center">
            <div className="w-10 h-10 rounded-xl bg-red-200 flex items-center justify-center shrink-0">
              <PackageSearch className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{zeroRows}</p>
              <p className="text-xs text-muted-foreground">نفاد المخزون</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-blue-50 to-blue-100/60">
          <CardContent className="p-4 flex gap-3 items-center">
            <div className="w-10 h-10 rounded-xl bg-blue-200 flex items-center justify-center shrink-0">
              <GitBranch className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{branches.length}</p>
              <p className="text-xs text-muted-foreground">{t("nav.branches")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* قيمة المخزون الإجمالية */}
      {totalValue > 0 && (
        <div className="mb-5 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-center">
          <span className="text-muted-foreground">قيمة المخزون الإجمالية (بسعر البيع): </span>
          <span className="font-bold text-primary text-base">{fmtOMR(totalValue)}</span>
        </div>
      )}

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList className="h-10">
          <TabsTrigger value="stock" className="gap-2">
            <Boxes className="w-4 h-4" /> {t("inv_overview.tab_stock")}
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-2">
            <TrendingDown className="w-4 h-4" /> {t("inv_overview.tab_movements")}
          </TabsTrigger>
        </TabsList>

        {/* ══ Tab 1: Current Stock ══ */}
        <TabsContent value="stock" className="space-y-4 border-none p-0 outline-none">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center bg-card border rounded-lg p-3">
            <div className="flex gap-2 flex-1 min-w-[180px]">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pr-9 h-9"
                  placeholder={t("inv_overview.search_placeholder")}
                  value={stockSearch}
                  onChange={e => setStockSearch(e.target.value)}
                />
              </div>
              <BarcodeScanButton onScan={(barcode) => setStockSearch(barcode)} />
            </div>
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inv_overview.all_branches")}</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}{b.address ? " - " + b.address : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inv_overview.all_types")}</SelectItem>
                <SelectItem value="simple">بسيط</SelectItem>
                <SelectItem value="variable">متعدد</SelectItem>
                <SelectItem value="composite">مركب</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="ok">✅ متوفر</SelectItem>
                <SelectItem value="low">⚠️ منخفض</SelectItem>
                <SelectItem value="zero">🔴 نفاد</SelectItem>
              </SelectContent>
            </Select>
            {(filterBranch !== "all" || filterType !== "all" || filterStatus !== "all" || stockSearch) && (
              <button
                className="text-xs text-muted-foreground hover:text-destructive underline"
                onClick={() => { setFilterBranch("all"); setFilterType("all"); setFilterStatus("all"); setStockSearch(""); }}
              >
                مسح الفلاتر
              </button>
            )}
          </div>

          <div className="text-xs text-muted-foreground px-1">
            عرض <span className="font-semibold text-foreground">{filtered.length}</span> من {totalRows} صنف
          </div>

          {/* Stock Table */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead className="w-14">صورة</TableHead>
                      <TableHead className="min-w-[160px]">
                        <SortBtn col="name" label={t("inv_overview.col_product")} />
                      </TableHead>
                      <TableHead>الفئة</TableHead>
                      <TableHead>{t("inv_overview.col_variant")}</TableHead>
                      <TableHead>{t("inv_overview.col_size")}</TableHead>
                      <TableHead>{t("inv_overview.col_branch")}</TableHead>
                      <TableHead className="text-center">
                        <SortBtn col="qty" label={t("inv_overview.col_qty")} />
                      </TableHead>
                      <TableHead className="text-center">{t("inv_overview.col_reorder")}</TableHead>
                      <TableHead className="text-center">
                        <SortBtn col="price" label="السعر (ر.ع)" />
                      </TableHead>
                      <TableHead>{t("inv_overview.col_status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockLoading ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-16 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Boxes className="w-8 h-8 animate-pulse opacity-40" />
                            <span>{t("common.loading")}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-16 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <PackageSearch className="w-10 h-10 opacity-30" />
                            <span>{t("inv_overview.no_stock")}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((row: any, idx: number) => {
                        const isLow  = row.qty_on_hand > 0 && row.qty_on_hand <= row.reorder_level;
                        const isZero = row.qty_on_hand === 0;
                        const catName = row.category_name || "";
                        return (
                          <TableRow
                            key={`${row.variant_id}-${row.location_id}`}
                            className={isZero ? "bg-red-50/50" : isLow ? "bg-yellow-50/40" : ""}
                          >
                            {/* # */}
                            <TableCell className="text-center text-xs text-muted-foreground font-mono">
                              {idx + 1}
                            </TableCell>

                            {/* صورة / أيقونة */}
                            <TableCell>
                              {row.image ? (
                                <img
                                  src={row.image}
                                  alt={row.product_name}
                                  className="w-12 h-12 rounded-lg object-cover border"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl border">
                                  {catIcon(catName)}
                                </div>
                              )}
                            </TableCell>

                            {/* اسم المنتج */}
                            <TableCell>
                              <div className="font-semibold text-sm">{row.product_name}</div>
                              {row.barcode && (
                                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  {row.barcode}
                                </div>
                              )}
                            </TableCell>

                            {/* الفئة */}
                            <TableCell>
                              {catName ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${catBadgeClass(catName)}`}>
                                  {catIcon(catName)} {catName}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>

                            {/* اللون */}
                            <TableCell className="text-sm text-muted-foreground">{row.color || "—"}</TableCell>

                            {/* المقاس */}
                            <TableCell className="text-sm text-muted-foreground">{row.size || "—"}</TableCell>

                            {/* الفرع/الموقع */}
                            <TableCell className="text-sm">{row.full_location_name || row.branch_name || "—"}</TableCell>

                            {/* الكمية */}
                            <TableCell className="text-center">
                              <span className={`text-lg font-bold ${isZero ? "text-red-600" : isLow ? "text-yellow-600" : "text-green-600"}`}>
                                {row.qty_on_hand}
                              </span>
                            </TableCell>

                            {/* الحد الأدنى */}
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {row.reorder_level}
                            </TableCell>

                            {/* السعر */}
                            <TableCell className="text-center text-sm font-medium">
                              {row.price ? fmtOMR(row.price) : "—"}
                            </TableCell>

                            {/* الحالة */}
                            <TableCell>
                              {isZero ? (
                                <Badge variant="destructive" className="text-xs gap-1">
                                  🔴 نفاد
                                </Badge>
                              ) : isLow ? (
                                <Badge variant="outline" className="text-xs gap-1 border-yellow-400 text-yellow-700 bg-yellow-50">
                                  <AlertTriangle className="w-3 h-3" /> {t("inv_overview.status_low")}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs border-green-400 text-green-700 bg-green-50">
                                  ✅ {t("inv_overview.status_ok")}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ Tab 2: Inventory Movements ══ */}
        <TabsContent value="movements" className="space-y-4 border-none p-0 outline-none">
          <div className="flex flex-wrap gap-2 items-center bg-card border rounded-lg p-3">
            <div className="flex gap-2 min-w-[180px] flex-1">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pr-9 h-9"
                  placeholder="بحث بالمنتج..."
                  value={movSearch}
                  onChange={e => setMovSearch(e.target.value)}
                />
              </div>
              <BarcodeScanButton onScan={(barcode) => setMovSearch(barcode)} />
            </div>
            <Select value={movType} onValueChange={setMovType}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder={t("inv_overview.filter_type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inv_overview.all_types")}</SelectItem>
                <SelectItem value="sale">{t("inv_overview.type_sale")}</SelectItem>
                <SelectItem value="purchase">{t("inv_overview.type_purchase")}</SelectItem>
                <SelectItem value="transfer">{t("inv_overview.type_transfer")}</SelectItem>
                <SelectItem value="adjustment">{t("inv_overview.type_adjustment")}</SelectItem>
                <SelectItem value="stocktake_adjustment">{t("inv_overview.type_stocktake_adjustment")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground shrink-0">{t("inv_overview.filter_from")}</label>
              <DateInput value={movFrom} onChange={e => setMovFrom(e.target.value)} className="w-36 h-9" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground shrink-0">{t("inv_overview.filter_to")}</label>
              <DateInput value={movTo} onChange={e => setMovTo(e.target.value)} className="w-36 h-9" />
            </div>
            <Select value={movBranch} onValueChange={setMovBranch}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inv_overview.all_branches")}</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}{b.address ? " - " + b.address : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground px-1">
            <span className="font-semibold text-foreground">{filteredMovements.length}</span> حركة
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>{t("inv_overview.col_date")}</TableHead>
                      <TableHead>{t("inv_overview.col_product")}</TableHead>
                      <TableHead>{t("inv_overview.col_type")}</TableHead>
                      <TableHead className="text-center">{t("inv_overview.col_qty_change")}</TableHead>
                      <TableHead>{t("inv_overview.col_ref")}</TableHead>
                      <TableHead>{t("inv_overview.col_user")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                          {t("common.loading")}
                        </TableCell>
                      </TableRow>
                    ) : filteredMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <TrendingDown className="w-10 h-10 opacity-30" />
                            <span>{t("inv_overview.no_movements")}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMovements.map((m: any, idx: number) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-center text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {m.date ? fmtDate(m.date) : fmtDate(m.createdAt)}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{m.productName}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${typeBadgeClass(m.type)}`}>
                              {typeLabel(m.type)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-base font-bold ${m.qty >= 0 ? "text-green-600" : "text-destructive"}`}>
                              {m.qty >= 0 ? "+" : ""}{m.qty}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {m.refTable && m.refId ? `${m.refTable}#${m.refId}` : (m.note || "—")}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{m.createdByName || "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
