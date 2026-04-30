import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PackageSearch, Boxes, TrendingDown, AlertTriangle,
  Search, GitBranch, ArrowUpDown, DollarSign, TrendingUp,
  Activity, Zap, Warehouse, BarChart2, RefreshCw,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
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

// ── ألوان الرسم البياني ──────────────────────────────────────────────────
// ── مكوّن صورة المنتج مع fallback "No Image" ─────────────────────────────
function ProductImage({ src, alt }: { src?: string | null; alt?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex flex-col items-center justify-center gap-0.5 shrink-0"
        title="No image available"
      >
        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5A1.5 1.5 0 0021.75 18V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"
          />
        </svg>
        <span className="text-[9px] text-gray-400 font-medium leading-none">No Image</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? ""}
      className="w-12 h-12 rounded-lg object-cover border border-gray-200 shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

const PIE_COLORS = [
  "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

export default function InventoryOverview() {
  const { t } = useI18n();

  // Stock tab state
  const [stockSearch,    setStockSearch]    = useState("");
  const [filterBranch,   setFilterBranch]   = useState("all");
  const [filterType,     setFilterType]     = useState("all");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [filterLocType,  setFilterLocType]  = useState<"all" | "branch" | "warehouse">("all");
  const [sortCol,        setSortCol]        = useState<"name"|"qty"|"price">("name");
  const [sortDir,        setSortDir]        = useState<"asc"|"desc">("asc");

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
  const filtered = (Array.isArray(stockRaw) ? stockRaw : [])
    .filter(row => {
      if (filterBranch !== "all" && String(row.branch_id) !== filterBranch) return false;
      if (filterType   !== "all" && row.product_type !== filterType)         return false;
      const threshold = row.min_qty ?? row.reorder_level ?? 5;
      if (filterStatus === "low"  && !(row.qty_on_hand > 0 && row.qty_on_hand <= threshold)) return false;
      if (filterStatus === "ok"   && row.qty_on_hand <= threshold)                            return false;
      if (filterStatus === "zero" && row.qty_on_hand !== 0)                  return false;
      if (filterLocType === "warehouse" && row.branch_id)                    return false;
      if (filterLocType === "branch"    && !row.branch_id)                   return false;
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

  // ── KPIs الأساسية ─────────────────────────────────────────────────────
  const stock = Array.isArray(stockRaw) ? stockRaw : [];
  const totalRows    = stock.length;
  const lowStockRows = stock.filter(r => {
    const threshold = r.min_qty ?? r.reorder_level ?? 5;
    return r.qty_on_hand > 0 && r.qty_on_hand <= threshold;
  }).length;
  const zeroRows = stock.filter(r => r.qty_on_hand === 0).length;
  const totalValue   = stock.reduce((s, r) => s + parseFloat(r.price || "0") * (r.qty_on_hand || 0), 0);
  const totalQty     = stock.reduce((s, r) => s + (r.qty_on_hand || 0), 0);
  const costValue    = stock.reduce((s, r) => s + parseFloat(r.last_purchase_price || "0") * (r.qty_on_hand || 0), 0);
  const avgPrice     = totalQty > 0 ? totalValue / totalQty : 0;
  const missingCostCount = stock.filter(r => !r.last_purchase_price || parseFloat(r.last_purchase_price) === 0).length;

  // ── تجميع حسب الموقع/الفرع مع نوع الموقع ────────────────────────────
  const locationData = useMemo(() => {
    const map: Record<string, {
      name: string; qty: number; value: number;
      isCentral: boolean; branchId: number | null; branchName: string;
    }> = {};
    for (const row of stock) {
      const key = row.branch_name || row.full_location_name || "غير محدد";
      if (!map[key]) map[key] = {
        name:       key,
        qty:        0,
        value:      0,
        isCentral:  !row.branch_id,
        branchId:   row.branch_id ?? null,
        branchName: row.branch_name || key,
      };
      map[key].qty   += row.qty_on_hand || 0;
      map[key].value += parseFloat(row.price || "0") * (row.qty_on_hand || 0);
    }
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [stock]);

  const filteredLocationData = useMemo(() => {
    if (filterLocType === "all") return locationData;
    if (filterLocType === "warehouse") return locationData.filter(l => l.isCentral);
    return locationData.filter(l => !l.isCentral);
  }, [locationData, filterLocType]);

  // ── تجميع حسب المنتج (للرسم البياني) ────────────────────────────────
  const productPieData = useMemo(() => {
    const map: Record<string, { name: string; value: number; qty: number }> = {};
    for (const row of stock) {
      const key = row.product_name || "غير محدد";
      if (!map[key]) map[key] = { name: key, value: 0, qty: 0 };
      map[key].value += parseFloat(row.price || "0") * (row.qty_on_hand || 0);
      map[key].qty   += row.qty_on_hand || 0;
    }
    return Object.values(map)
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [stock]);

  // ── عناصر التنبيه ────────────────────────────────────────────────────
  const alertItems = useMemo(() => {
    const low  = stock.filter(r => r.qty_on_hand > 0 && r.qty_on_hand <= r.reorder_level)
                      .sort((a, b) => a.qty_on_hand - b.qty_on_hand).slice(0, 4);
    const zero = stock.filter(r => r.qty_on_hand === 0).slice(0, 2);
    return [...zero, ...low];
  }, [stock]);

  // ── درجة صحة المخزون (0-100) ─────────────────────────────────────────
  const healthScore = useMemo(() => {
    if (totalRows === 0) return 0;
    const badItems = zeroRows * 2 + lowStockRows + missingCostCount * 0.5;
    const maxBad   = totalRows * 3.5;
    return Math.max(0, Math.min(100, Math.round(100 * (1 - badItems / maxBad))));
  }, [totalRows, zeroRows, lowStockRows, missingCostCount]);

  const healthLabel = healthScore >= 80 ? t("inventoryOverview.health_excellent") : healthScore >= 60 ? t("inventoryOverview.health_good") : healthScore >= 40 ? t("inventoryOverview.health_average") : t("inventoryOverview.health_needs_improvement");
  const healthColor = healthScore >= 80 ? "text-green-600" : healthScore >= 60 ? "text-blue-600" : healthScore >= 40 ? "text-yellow-600" : "text-red-600";
  const healthBg    = healthScore >= 80 ? "bg-green-50 border-green-200" : healthScore >= 60 ? "bg-blue-50 border-blue-200" : healthScore >= 40 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

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
  const filteredMovements = (Array.isArray(movements) ? movements : []).filter(m => {
    if (movBranch !== "all" && String(m.branchId) !== movBranch) return false;
    if (movSearch) {
      const q = movSearch.toLowerCase();
      const hit = [m.productName, m.barcode, m.sku, m.note].some(v => (v || "").toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });

  // ── مساعد الـ Tooltip للرسم البياني ─────────────────────────────────
  function CustomTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm" dir="rtl">
        <p className="font-semibold mb-1">{d.name}</p>
        <p className="text-muted-foreground">{t("inventoryOverview.tooltip_value")} <span className="font-bold text-primary">{fmtOMR(d.value)}</span></p>
        <p className="text-muted-foreground">{t("inventoryOverview.tooltip_qty")} <span className="font-bold">{d.qty} {t("inventoryOverview.tooltip_unit")}</span></p>
        <p className="text-muted-foreground">{t("inventoryOverview.tooltip_pct")} <span className="font-bold">{totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : 0}%</span></p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 pb-20" dir="rtl">
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("inv_overview.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("inv_overview.subtitle")}</p>
        </div>
        {totalRows > 0 && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold ${healthBg} ${healthColor}`}>
            <Activity className="w-4 h-4" />
            {t("inventoryOverview.health_label")}: {healthLabel} ({healthScore}/100)
          </div>
        )}
      </div>

      {/* ── KPI Cards (7 cards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">

        {/* إجمالي قيمة المخزون */}
        <Card className="border-0 bg-gradient-to-br from-amber-50 to-yellow-100/60 xl:col-span-1">
          <CardContent className="p-4 flex gap-3 items-center">
            <div className="w-10 h-10 rounded-xl bg-yellow-200 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-yellow-700" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-yellow-700 truncate">{fmtOMR(totalValue)}</p>
              <p className="text-xs text-muted-foreground">{t("inventoryOverview.kpi_inventory_value")}</p>
            </div>
          </CardContent>
        </Card>

        {/* إجمالي الأصناف */}
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

        {/* إجمالي الكمية */}
        <Card className="border-0 bg-gradient-to-br from-green-50 to-green-100/60">
          <CardContent className="p-4 flex gap-3 items-center">
            <div className="w-10 h-10 rounded-xl bg-green-200 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{totalQty}</p>
              <p className="text-xs text-muted-foreground">{t("inventoryOverview.kpi_total_qty")}</p>
            </div>
          </CardContent>
        </Card>

        {/* منخفض المخزون */}
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

        {/* نفاد المخزون */}
        <Card className="border-0 bg-gradient-to-br from-red-50 to-red-100/60">
          <CardContent className="p-4 flex gap-3 items-center">
            <div className="w-10 h-10 rounded-xl bg-red-200 flex items-center justify-center shrink-0">
              <PackageSearch className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{zeroRows}</p>
              <p className="text-xs text-muted-foreground">{t("inventoryOverview.kpi_out_of_stock")}</p>
            </div>
          </CardContent>
        </Card>

        {/* عدد الفروع/المواقع */}
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

        {/* متوسط سعر البيع */}
        <Card className="border-0 bg-gradient-to-br from-purple-50 to-purple-100/60">
          <CardContent className="p-4 flex gap-3 items-center">
            <div className="w-10 h-10 rounded-xl bg-purple-200 flex items-center justify-center shrink-0">
              <BarChart2 className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-purple-600 truncate">{fmtOMR(avgPrice)}</p>
              <p className="text-xs text-muted-foreground">{t("inventoryOverview.kpi_avg_sell_price")}</p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ── تنبيهات المخزون ── */}
      {alertItems.length > 0 && (
        <Card className="mb-5 border-yellow-200 bg-yellow-50/30">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              {t("inventoryOverview.alerts_title")}
              <Badge variant="outline" className="border-yellow-400 text-yellow-700 bg-yellow-50 text-xs">
                {alertItems.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex flex-col gap-2">
              {alertItems.map((item, idx) => {
                const isZero = item.qty_on_hand === 0;
                return (
                  <div
                    key={`${item.variant_id}-${item.location_id}-${idx}`}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                      isZero
                        ? "bg-red-50 border-red-200"
                        : "bg-yellow-50 border-yellow-200"
                    }`}
                  >
                    <span className="text-lg">{isZero ? "🔴" : "⚠️"}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold">{item.product_name}</span>
                      {(item.color || item.size) && (
                        <span className="text-muted-foreground text-xs me-2">
                          {[item.color, item.size].filter(Boolean).join(" / ")}
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs me-2">
                        — {item.full_location_name || item.branch_name}
                      </span>
                    </div>
                    <div className="text-end shrink-0">
                      <span className={`font-bold ${isZero ? "text-red-600" : "text-yellow-700"}`}>
                        {isZero ? t("inventoryOverview.alert_depleted") : `${item.qty_on_hand} ${t("inventoryOverview.alert_unit")}`}
                      </span>
                      {!isZero && (
                        <span className="text-muted-foreground text-xs block">
                          {t("inventoryOverview.alert_min_label")} {item.reorder_level}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── لوحتا التوزيع ── */}
      {stock.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">

          {/* توزيع المخزون حسب الموقع */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-base flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-blue-600" />
                {t("inventoryOverview.dist_by_location")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {filteredLocationData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("inventoryOverview.no_data")}</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredLocationData.map((loc, idx) => {
                    const pctValue = totalValue > 0 ? (loc.value / totalValue) * 100 : 0;
                    const pctQty   = totalQty  > 0 ? (loc.qty   / totalQty)   * 100 : 0;
                    const color    = PIE_COLORS[idx % PIE_COLORS.length];
                    return (
                      <div key={loc.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm gap-2">
                          <span className="font-medium flex items-center gap-2 min-w-0">
                            <span
                              className="inline-block w-3 h-3 rounded-sm shrink-0"
                              style={{ background: color }}
                            />
                            <span className="truncate">{loc.name}</span>
                          </span>
                          <span className="font-bold text-primary shrink-0">{fmtOMR(loc.value)}</span>
                        </div>
                        {/* شريط القيمة */}
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pctValue}%`, background: color }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{loc.qty} {t("inventoryOverview.location_qty_pct")} ({pctQty.toFixed(1)}% {t("inventoryOverview.location_pct_of_qty")})</span>
                          <span>{pctValue.toFixed(1)}% {t("inventoryOverview.location_pct_of_value")}</span>
                        </div>
                      </div>
                    );
                  })}
                  {/* ملخص إجمالي */}
                  <div className="pt-3 border-t flex justify-between text-sm">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{t("inventoryOverview.location_total")}</span>
                      <span className="text-xs">
                        {locationData.filter(l => !l.isCentral).length} {t("inventoryOverview.location_branch_count")}
                        {locationData.some(l => l.isCentral) && ` · ${t("inventoryOverview.location_central")}`}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <span className="font-semibold">{totalQty} {t("inventoryOverview.footer_unit")}</span>
                      <span className="font-bold text-primary">{fmtOMR(totalValue)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* توزيع القيمة حسب المنتج */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-600" />
                {t("inventoryOverview.dist_by_product")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {productPieData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("inventoryOverview.no_data")}</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width={170} height={170}>
                    <PieChart>
                      <Pie
                        data={productPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={78}
                        strokeWidth={2}
                      >
                        {productPieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 flex-1 w-full">
                    {productPieData.map((p, i) => (
                      <div key={p.name} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="truncate font-medium">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                          <span className="font-bold text-foreground">{fmtOMR(p.value)}</span>
                          <span>({totalValue > 0 ? ((p.value / totalValue) * 100).toFixed(0) : 0}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}

      {/* ── تحليل هوامش الربح + ملاحظات ── */}
      {stock.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">

          {/* هامش الربح الإجمالي */}
          <Card className="border-green-200 bg-green-50/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-sm">{t("inventoryOverview.margin_title")}</span>
              </div>
              {costValue > 0 ? (
                <>
                  <p className="text-2xl font-bold text-green-600 mb-1">
                    {(((totalValue - costValue) / costValue) * 100).toFixed(1)}%
                  </p>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${Math.min(100, ((totalValue - costValue) / costValue) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div className="flex justify-between">
                      <span>{t("inventoryOverview.margin_cost_label")}</span>
                      <span className="font-medium">{fmtOMR(costValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("inventoryOverview.margin_sell_label")}</span>
                      <span className="font-medium">{fmtOMR(totalValue)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-green-700">
                      <span>{t("inventoryOverview.margin_expected_profit")}</span>
                      <span>{fmtOMR(totalValue - costValue)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p className="text-yellow-600 font-medium mb-1">{t("inventoryOverview.margin_cannot_calc")}</p>
                  <p>{t("inventoryOverview.margin_missing_prices").replace("{{count}}", String(missingCostCount))}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* أسعار الشراء المفقودة */}
          <Card className={missingCostCount > 0 ? "border-orange-200 bg-orange-50/30" : "border-green-200 bg-green-50/30"}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="w-4 h-4 text-orange-600" />
                <span className="font-semibold text-sm">{t("inventoryOverview.price_completion_title")}</span>
              </div>
              <p className={`text-2xl font-bold mb-1 ${missingCostCount > 0 ? "text-orange-600" : "text-green-600"}`}>
                {missingCostCount === 0
                  ? "100%"
                  : `${(((totalRows - missingCostCount) / Math.max(totalRows, 1)) * 100).toFixed(0)}%`
                }
              </p>
              <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full ${missingCostCount > 0 ? "bg-orange-400" : "bg-green-500"}`}
                  style={{ width: `${((totalRows - missingCostCount) / Math.max(totalRows, 1)) * 100}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {missingCostCount > 0 ? (
                  <p>{t("inventoryOverview.price_missing_count").replace("{{count}}", String(missingCostCount))}</p>
                ) : (
                  <p className="text-green-700 font-medium">{t("inventoryOverview.price_all_recorded")}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ملخص سريع */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-sm">{t("inventoryOverview.quick_summary_title")}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("inventoryOverview.summary_normal")}</span>
                  <Badge variant="outline" className="border-green-400 text-green-700 bg-green-50 text-xs">
                    {totalRows - lowStockRows - zeroRows} {t("inventoryOverview.summary_item")} ✅
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("inventoryOverview.summary_low_stock")}</span>
                  <Badge variant="outline" className="border-yellow-400 text-yellow-700 bg-yellow-50 text-xs">
                    {lowStockRows} {t("inventoryOverview.summary_item")} ⚠️
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("inventoryOverview.summary_out_of_stock")}</span>
                  <Badge variant="outline" className="border-red-400 text-red-700 bg-red-50 text-xs">
                    {zeroRows} {t("inventoryOverview.summary_item")} 🔴
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("inventoryOverview.summary_locations")}</span>
                  <Badge variant="outline" className="text-xs">
                    {locationData.length} {t("inventoryOverview.summary_location")}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* ── Tabs ── */}
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
                  className="pe-9 h-9"
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
            {/* فلتر نوع الموقع */}
            <Select value={filterLocType} onValueChange={v => setFilterLocType(v as any)}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inventoryOverview.filter_all_locations")}</SelectItem>
                <SelectItem value="branch">{t("inventoryOverview.filter_branches_only")}</SelectItem>
                <SelectItem value="warehouse">{t("inventoryOverview.filter_warehouse_only")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inv_overview.all_types")}</SelectItem>
                <SelectItem value="simple">{t("inventoryOverview.filter_type_simple")}</SelectItem>
                <SelectItem value="variable">{t("inventoryOverview.filter_type_variable")}</SelectItem>
                <SelectItem value="composite">{t("inventoryOverview.filter_type_composite")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inventoryOverview.filter_all_statuses")}</SelectItem>
                <SelectItem value="ok">{t("inventoryOverview.filter_available")}</SelectItem>
                <SelectItem value="low">{t("inventoryOverview.filter_low")}</SelectItem>
                <SelectItem value="zero">{t("inventoryOverview.filter_depleted")}</SelectItem>
              </SelectContent>
            </Select>
            {(filterBranch !== "all" || filterType !== "all" || filterStatus !== "all" || filterLocType !== "all" || stockSearch) && (
              <button
                className="text-xs text-muted-foreground hover:text-destructive underline"
                onClick={() => { setFilterBranch("all"); setFilterType("all"); setFilterStatus("all"); setFilterLocType("all"); setStockSearch(""); }}
              >
                {t("inventoryOverview.clear_filters")}
              </button>
            )}
          </div>

          <div className="text-xs text-muted-foreground px-1">
            {t("inventoryOverview.showing_count").replace("{{shown}}", String(filtered.length)).replace("{{total}}", String(totalRows))}
          </div>

          {/* Stock Table */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead className="w-14">{t("inventoryOverview.col_image")}</TableHead>
                      <TableHead className="min-w-[160px]">
                        <SortBtn col="name" label={t("inv_overview.col_product")} />
                      </TableHead>
                      <TableHead>{t("inventoryOverview.col_category")}</TableHead>
                      <TableHead>{t("inv_overview.col_variant")}</TableHead>
                      <TableHead>{t("inv_overview.col_size")}</TableHead>
                      <TableHead>{t("inv_overview.col_branch")}</TableHead>
                      <TableHead className="text-center">
                        <SortBtn col="qty" label={t("inv_overview.col_qty")} />
                      </TableHead>
                      <TableHead className="text-center">{t("inv_overview.col_reorder")}</TableHead>
                      <TableHead className="text-center">
                        <SortBtn col="price" label={t("inventoryOverview.col_sell_price")} />
                      </TableHead>
                      <TableHead className="text-center">{t("inventoryOverview.col_last_cost")}</TableHead>
                      <TableHead>{t("inv_overview.col_status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockLoading ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-16 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Boxes className="w-8 h-8 animate-pulse opacity-40" />
                            <span>{t("common.loading")}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-16 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <PackageSearch className="w-10 h-10 opacity-30" />
                            <span>{t("inv_overview.no_stock")}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((row: any, idx: number) => {
                        const rowThreshold = row.min_qty ?? row.reorder_level ?? 5;
                        const isLow  = row.qty_on_hand > 0 && row.qty_on_hand <= rowThreshold;
                        const isZero = row.qty_on_hand === 0;
                        const catName = row.category_name || "";
                        const hasCost = row.last_purchase_price && parseFloat(row.last_purchase_price) > 0;
                        const margin  = hasCost && row.price
                          ? (((parseFloat(row.price) - parseFloat(row.last_purchase_price)) / parseFloat(row.last_purchase_price)) * 100)
                          : null;
                        return (
                          <TableRow
                            key={`${row.variant_id}-${row.location_id}`}
                            className={isZero ? "bg-red-50/50" : isLow ? "bg-yellow-50/40" : ""}
                          >
                            {/* # */}
                            <TableCell className="text-center text-xs text-muted-foreground font-mono">
                              {idx + 1}
                            </TableCell>

                            {/* صورة / placeholder */}
                            <TableCell>
                              <ProductImage src={row.image} alt={row.product_name} />
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
                            <TableCell className="text-sm">
                              <span className="truncate max-w-[140px] block" title={row.branch_name || row.full_location_name || "—"}>
                                {row.branch_name || row.full_location_name || "—"}
                              </span>
                            </TableCell>

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

                            {/* سعر البيع */}
                            <TableCell className="text-center text-sm font-medium">
                              {row.price ? fmtOMR(row.price) : "—"}
                            </TableCell>

                            {/* آخر سعر شراء + هامش */}
                            <TableCell className="text-center text-sm">
                              {hasCost ? (
                                <div>
                                  <div className="font-medium">{fmtOMR(row.last_purchase_price)}</div>
                                  {margin !== null && (
                                    <div className={`text-xs font-semibold ${margin >= 30 ? "text-green-600" : margin >= 10 ? "text-yellow-600" : "text-red-500"}`}>
                                      {margin.toFixed(0)}{t("inventoryOverview.profit_pct")}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-orange-500 text-xs font-medium">{t("inventoryOverview.cost_not_set")}</span>
                              )}
                            </TableCell>

                            {/* الحالة */}
                            <TableCell>
                              {isZero ? (
                                <Badge variant="destructive" className="text-xs gap-1">
                                  {t("inventoryOverview.status_depleted")}
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

          {/* Footer summary */}
          {filtered.length > 0 && (
            <div className="flex flex-wrap gap-4 items-center justify-between px-2 py-2 text-sm text-muted-foreground">
              <div className="flex gap-4">
                <span>{t("inventoryOverview.footer_total_qty")} <span className="font-bold text-foreground">
                  {filtered.reduce((s, r) => s + (r.qty_on_hand || 0), 0)} {t("inventoryOverview.footer_unit")}
                </span></span>
                <span>{t("inventoryOverview.footer_total_value")} <span className="font-bold text-primary">
                  {fmtOMR(filtered.reduce((s, r) => s + parseFloat(r.price || "0") * (r.qty_on_hand || 0), 0))}
                </span></span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="border-green-400 text-green-700 bg-green-50 text-xs">
                  ✅ {filtered.filter(r => r.qty_on_hand > r.reorder_level).length}
                </Badge>
                <Badge variant="outline" className="border-yellow-400 text-yellow-700 bg-yellow-50 text-xs">
                  ⚠️ {filtered.filter(r => r.qty_on_hand > 0 && r.qty_on_hand <= r.reorder_level).length}
                </Badge>
                <Badge variant="destructive" className="text-xs">
                  🔴 {filtered.filter(r => r.qty_on_hand === 0).length}
                </Badge>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══ Tab 2: Inventory Movements ══ */}
        <TabsContent value="movements" className="space-y-4 border-none p-0 outline-none">
          <div className="flex flex-wrap gap-2 items-center bg-card border rounded-lg p-3">
            <div className="flex gap-2 min-w-[180px] flex-1">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pe-9 h-9"
                  placeholder={t("inventoryOverview.mov_search_placeholder")}
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
            <span className="font-semibold text-foreground">{filteredMovements.length}</span> {t("inventoryOverview.mov_count")}
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
