import { useState } from "react";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, CreditCard, Building2,
  Download, FileText, Package, Users, Layers, PieChart as PieIcon,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Calendar, GitBranch,
  Banknote, Receipt, Activity, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateInput } from "@/components/ui/date-input";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Branch } from "@shared/schema";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }
function startOfMonthStr() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }
function omr(v: string | number | null | undefined) {
  return parseFloat(String(v || "0")).toFixed(3);
}
function fmtOMR(v: string | number | null | undefined) {
  const n = parseFloat(String(v || "0"));
  return n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " ر.ع";
}
function downloadCSV(filename: string, rows: any[][]) {
  const bom = "\uFEFF";
  const csv = bom + rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const PINK  = "#E91E63";
const COLORS = ["#E91E63", "#FF6B9D", "#9C27B0", "#673AB7", "#3F51B5", "#00BCD4", "#009688", "#4CAF50", "#FF9800", "#F44336", "#607D8B"];

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color, trend }:
  { title: string; value: string; sub?: string; icon: any; color: string; trend?: "up"|"down"|"flat" }) {
  return (
    <Card className="relative overflow-hidden rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground mb-1 truncate">{title}</p>
            <p className={`text-xl font-bold ${color} leading-tight`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color.replace("text-", "bg-")}/10`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        {trend && (
          <div className={`mt-3 flex items-center gap-1 text-xs ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"}`}>
            {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-pink-100 rounded-xl shadow-lg p-3 text-sm min-w-[140px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{parseFloat(p.value || 0).toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── COGS Categories Arabic Labels ────────────────────────────────────────────
const CAT_LABELS: Record<string, string> = {
  supplies: "مستلزمات", rent: "إيجار", salary: "رواتب", transport: "مواصلات",
  maintenance: "صيانة", electricity: "كهرباء ومياه", phone: "اتصالات",
  marketing: "تسويق", shipping: "شحن", taxes: "ضرائب", other: "أخرى",
};

// ══════════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════════
export default function Reports() {
  const { data: authData } = useAuth();
  const user = authData?.user;
  const { t } = useI18n();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const [from, setFrom]           = useState(startOfMonthStr());
  const [to,   setTo]             = useState(todayStr());
  const [branch, setBranch]       = useState("all");
  const [bsExpanded, setBsExpanded] = useState<Record<string, boolean>>({});

  const branchId = branch !== "all" ? Number(branch) : undefined;
  const branchQs = branchId ? `&branchId=${branchId}` : "";

  const { data: _branches }     = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "returnNull" }) });
  const { data: income }        = useQuery<any>({ queryKey: [`/api/reports/income-statement?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }), enabled: isAdmin });
  const { data: branchComp }    = useQuery<any>({ queryKey: [`/api/reports/branch-comparison-range?from=${from}&to=${to}`], queryFn: getQueryFn({ on401: "returnNull" }), enabled: isAdmin });
  const { data: _salesList }    = useQuery<any[]>({ queryKey: [`/api/reports/sales-list?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }) });
  const { data: payments }      = useQuery<any>({ queryKey: [`/api/reports/payments-report?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }) });
  const { data: _shiftsRpt }    = useQuery<any[]>({ queryKey: [`/api/reports/shifts-report?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }) });
  const { data: _productsRpt }  = useQuery<any[]>({ queryKey: [`/api/reports/products-report?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }) });
  const { data: _categoriesRpt }= useQuery<any[]>({ queryKey: [`/api/reports/categories-report?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }) });
  const { data: cashFlow }      = useQuery<any>({ queryKey: [`/api/reports/cash-flow?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }), enabled: isAdmin });
  const { data: _expCats }      = useQuery<any[]>({ queryKey: [`/api/reports/expenses-by-category?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }), enabled: isAdmin });

  // ── null-safe array coercion (= [] لا يحمي من null، فقط من undefined) ───
  const branches     : Branch[] = Array.isArray(_branches)     ? _branches     : [];
  const salesList    : any[]    = Array.isArray(_salesList)    ? _salesList    : [];
  const shiftsRpt    : any[]    = Array.isArray(_shiftsRpt)    ? _shiftsRpt    : [];
  const productsRpt  : any[]    = Array.isArray(_productsRpt)  ? _productsRpt  : [];
  const categoriesRpt: any[]    = Array.isArray(_categoriesRpt)? _categoriesRpt: [];
  const expCats      : any[]    = Array.isArray(_expCats)      ? _expCats      : [];

  // ── branch display ────────────────────────────────────────────────────────
  const branchLabel = (id: number) => {
    const b = branches.find(b => b.id === id);
    return b ? (b.address ? `${b.name} - ${b.address}` : b.name) : `فرع ${id}`;
  };

  // ── payments pie data ─────────────────────────────────────────────────────
  const paymentPieData = payments ? [
    { name: "نقدي",        value: parseFloat(payments.cash || 0)   },
    { name: "بطاقة",       value: parseFloat(payments.card || 0)   },
    { name: "تحويل بنكي",  value: parseFloat(payments.bank || 0)   },
  ].filter(d => d.value > 0) : [];

  // ── expenses pie data ─────────────────────────────────────────────────────
  const expPieData = expCats.map(e => ({
    name:  CAT_LABELS[e.category] || e.category,
    value: parseFloat(e.total),
  })).filter(d => d.value > 0);

  // ── branch comparison bar data ────────────────────────────────────────────
  const bcData = (branchComp?.branches || []).map((b: any) => ({
    name:     b.branchName?.split(" - ")[0] || b.branchName,
    مبيعات:  parseFloat(b.totalSales),
    تكلفة:   parseFloat(b.cogsTotal),
    ربح:     parseFloat(b.netProfit),
    مصروفات: parseFloat(b.totalExpenses),
  }));

  // ── CSV export helpers ────────────────────────────────────────────────────
  function exportSales() {
    const headers = ["#", "رقم الفاتورة", "التاريخ", "الفرع", "طريقة الدفع", "المجموع", "ضريبة", "تكلفة", "ربح"];
    const rows = salesList.map((s, i) => [
      i + 1, s.invoice_number,
      new Date(s.created_at).toLocaleDateString("ar-OM"),
      branchLabel(s.branch_id),
      s.payment_method,
      omr(s.total), omr(s.vat), omr(s.cogs_total), omr(s.gross_profit),
    ]);
    downloadCSV(`مبيعات_${from}_${to}.csv`, [headers, ...rows]);
  }
  function exportBranchComp() {
    if (!branchComp?.branches) return;
    const headers = ["الفرع", "المبيعات", "التكلفة", "إجمالي الربح", "المصروفات", "صافي الربح", "الهامش%"];
    const rows = branchComp.branches.map((b: any) => [
      b.branchName, omr(b.totalSales), omr(b.cogsTotal),
      omr(b.grossProfit), omr(b.totalExpenses), omr(b.netProfit), b.margin + "%",
    ]);
    downloadCSV(`مقارنة_الفروع_${from}_${to}.csv`, [headers, ...rows]);
  }
  function exportIncome() {
    if (!income) return;
    downloadCSV(`قائمة_الدخل_${from}_${to}.csv`, [
      ["البند", "القيمة (ر.ع)"],
      ["إجمالي المبيعات", omr(income.revenue?.total)],
      ["المرتجعات", `(${omr(income.revenue?.returns)})`],
      ["صافي المبيعات", omr(income.revenue?.netRevenue)],
      ["تكلفة البضاعة المباعة", `(${omr(income.cogs?.total)})`],
      ["إجمالي الربح التجاري", omr(income.grossProfit)],
      ["المصروفات التشغيلية", `(${omr(income.expenses?.total)})`],
      ["صافي الربح", omr(income.netProfit)],
      ["هامش الربح", income.netMargin + "%"],
    ]);
  }

  // ══════════════════════════════════════════════════════════════════════════
  const filterBar = (
    <div className="flex flex-wrap gap-3 items-center justify-center mb-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <DateInput value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
        <span className="text-muted-foreground">—</span>
        <DateInput value={to} onChange={e => setTo(e.target.value)} className="w-40" />
      </div>
      {isAdmin && (
        <Select value={branch} onValueChange={setBranch}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="كل الفروع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفروع</SelectItem>
            {branches.map(b => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.name}{b.address ? ` - ${b.address}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
          <BarChart3 className="h-6 w-6" /> التقارير المالية
        </h1>
        <p className="text-sm text-muted-foreground">لمسة أنوثة — {from} إلى {to}</p>
      </div>

      {filterBar}

      <Tabs defaultValue="overview" className="w-full" dir="rtl">
        <div className="overflow-x-auto">
          <TabsList className="flex w-max min-w-full md:w-full justify-start md:justify-center gap-1 mb-2">
            <TabsTrigger value="overview" className="gap-1 whitespace-nowrap"><TrendingUp className="h-4 w-4" />نظرة عامة</TabsTrigger>
            <TabsTrigger value="income"   className="gap-1 whitespace-nowrap"><FileText className="h-4 w-4" />قائمة الدخل</TabsTrigger>
            <TabsTrigger value="sales"    className="gap-1 whitespace-nowrap"><Receipt className="h-4 w-4" />المبيعات</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1 whitespace-nowrap"><CreditCard className="h-4 w-4" />المدفوعات</TabsTrigger>
            <TabsTrigger value="products" className="gap-1 whitespace-nowrap"><Package className="h-4 w-4" />المنتجات</TabsTrigger>
            <TabsTrigger value="categories" className="gap-1 whitespace-nowrap"><Layers className="h-4 w-4" />الفئات</TabsTrigger>
            <TabsTrigger value="shifts"   className="gap-1 whitespace-nowrap"><Activity className="h-4 w-4" />الورديات</TabsTrigger>
            {isAdmin && <TabsTrigger value="branches" className="gap-1 whitespace-nowrap"><GitBranch className="h-4 w-4" />مقارنة الفروع</TabsTrigger>}
            {isAdmin && <TabsTrigger value="cashflow" className="gap-1 whitespace-nowrap"><Banknote className="h-4 w-4" />التدفقات النقدية</TabsTrigger>}
          </TabsList>
        </div>

        {/* ══ نظرة عامة ══════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-5">
          {income && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard title="إجمالي المبيعات"        value={fmtOMR(income.revenue?.total)}    icon={TrendingUp}   color="text-green-600" />
                <KpiCard title="تكلفة البضاعة المباعة"  value={fmtOMR(income.cogs?.total)}       icon={Package}      color="text-orange-600" />
                <KpiCard title="إجمالي الربح التجاري"   value={fmtOMR(income.grossProfit)}       icon={DollarSign}   color="text-blue-600"   sub={`هامش ${income.grossMargin}%`} />
                <KpiCard title="صافي الربح"             value={fmtOMR(income.netProfit)}         icon={Activity}     color="text-primary"    sub={`هامش ${income.netMargin}%`} trend={parseFloat(income.netProfit) >= 0 ? "up" : "down"} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard title="مبيعات نقدية"    value={fmtOMR(income.revenue?.cashSales)} icon={Banknote}    color="text-green-700" />
                <KpiCard title="مبيعات بطاقة"    value={fmtOMR(income.revenue?.cardSales)} icon={CreditCard}  color="text-purple-600" />
                <KpiCard title="مبيعات تحويل"    value={fmtOMR(income.revenue?.bankSales)} icon={Building2}   color="text-indigo-600" />
                <KpiCard title="المصروفات التشغيلية" value={fmtOMR(income.expenses?.total)} icon={TrendingDown} color="text-red-600" />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Payments Pie */}
                <Card className="rounded-2xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PieIcon className="h-4 w-4 text-primary" />طرق الدفع</CardTitle></CardHeader>
                  <CardContent>
                    {paymentPieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={paymentPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {paymentPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => [parseFloat(v).toFixed(3) + " ر.ع", ""]} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <p className="text-center text-muted-foreground py-12 text-sm">لا توجد بيانات</p>}
                  </CardContent>
                </Card>

                {/* Expenses Pie */}
                <Card className="rounded-2xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PieIcon className="h-4 w-4 text-red-500" />توزيع المصروفات</CardTitle></CardHeader>
                  <CardContent>
                    {expPieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={expPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {expPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => [parseFloat(v).toFixed(3) + " ر.ع", ""]} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <p className="text-center text-muted-foreground py-12 text-sm">لا توجد بيانات</p>}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ══ قائمة الدخل ══════════════════════════════════════════════════ */}
        <TabsContent value="income" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />قائمة الدخل</h2>
            <Button size="sm" variant="outline" onClick={exportIncome}>
              <Download className="h-4 w-4 ml-1" /> تصدير CSV
            </Button>
          </div>

          {income ? (
            <div className="bg-white rounded-2xl shadow-sm border border-pink-50 overflow-hidden">
              {/* ─ الإيرادات ─ */}
              <div className="bg-green-50 px-5 py-3 border-b font-bold text-green-800">الإيرادات</div>
              <div className="divide-y">
                <IncomeRow label="إجمالي المبيعات"   value={income.revenue?.total}     indent={1} />
                <IncomeRow label="المرتجعات"           value={`(${omr(income.revenue?.returns)})`} indent={1} valueClass="text-red-600" />
                <IncomeRow label="صافي المبيعات"       value={income.revenue?.netRevenue} indent={0} bold />
              </div>
              {/* ─ تكلفة البضاعة ─ */}
              <div className="bg-orange-50 px-5 py-3 border-b font-bold text-orange-800 border-t mt-2">تكلفة البضاعة المباعة</div>
              <div className="divide-y">
                <IncomeRow label="تكلفة المبيعات" value={`(${omr(income.cogs?.total)})`} indent={1} valueClass="text-orange-700" />
              </div>
              {/* ─ إجمالي الربح ─ */}
              <div className="bg-blue-50 px-5 py-3 border-b font-bold text-blue-800 border-t mt-2 flex justify-between items-center">
                <span>إجمالي الربح التجاري</span>
                <span className="text-blue-700 font-bold text-lg">{fmtOMR(income.grossProfit)}</span>
              </div>
              {/* ─ المصروفات التشغيلية ─ */}
              <div className="bg-red-50 px-5 py-3 border-b font-bold text-red-800 border-t mt-2">المصروفات التشغيلية</div>
              <div className="divide-y">
                {(income.expenses?.byCategory || []).map((c: any) => (
                  <IncomeRow key={c.category} label={CAT_LABELS[c.category] || c.category} value={`(${omr(c.total)})`} indent={1} valueClass="text-red-600" />
                ))}
                <IncomeRow label="إجمالي المصروفات" value={`(${omr(income.expenses?.total)})`} indent={0} bold valueClass="text-red-700" />
              </div>
              {/* ─ صافي الربح ─ */}
              <div className={`px-5 py-4 border-t-2 border-primary/30 flex justify-between items-center mt-2 ${parseFloat(income.netProfit) >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                <span className="font-extrabold text-lg">صافي الربح</span>
                <div className="text-right">
                  <p className={`font-extrabold text-2xl ${parseFloat(income.netProfit) >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {fmtOMR(income.netProfit)}
                  </p>
                  <p className="text-xs text-muted-foreground">هامش الربح: {income.netMargin}%</p>
                </div>
              </div>
            </div>
          ) : <EmptyState icon={FileText} label="اختر نطاق تاريخ لعرض قائمة الدخل" />}
        </TabsContent>

        {/* ══ المبيعات ══════════════════════════════════════════════════════ */}
        <TabsContent value="sales" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-lg flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" />سجل المبيعات</h2>
            <Button size="sm" variant="outline" onClick={exportSales}>
              <Download className="h-4 w-4 ml-1" /> تصدير CSV
            </Button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">رقم الفاتورة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  {isAdmin && <TableHead className="text-right">الفرع</TableHead>}
                  <TableHead className="text-right">طريقة الدفع</TableHead>
                  <TableHead className="text-right">المجموع</TableHead>
                  <TableHead className="text-right">ضريبة</TableHead>
                  <TableHead className="text-right">تكلفة</TableHead>
                  <TableHead className="text-right">ربح</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesList.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">لا توجد مبيعات في هذه الفترة</TableCell></TableRow>
                ) : salesList.map((s, i) => (
                  <TableRow key={s.id} className="hover:bg-pink-50/30">
                    <TableCell className="text-xs">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs text-primary">{s.invoice_number}</TableCell>
                    <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString("ar-OM")}</TableCell>
                    {isAdmin && <TableCell className="text-xs">{branchLabel(s.branch_id)}</TableCell>}
                    <TableCell>
                      <PayMethodBadge method={s.payment_method} />
                    </TableCell>
                    <TableCell className="font-medium">{omr(s.total)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{omr(s.vat)}</TableCell>
                    <TableCell className="text-xs text-orange-600">{omr(s.cogs_total)}</TableCell>
                    <TableCell className="font-medium text-green-600">{omr(s.gross_profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {salesList.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <SummaryBox label="إجمالي المبيعات" value={salesList.reduce((s, r) => s + parseFloat(r.total || 0), 0).toFixed(3)} color="text-green-600" />
              <SummaryBox label="إجمالي التكلفة" value={salesList.reduce((s, r) => s + parseFloat(r.cogs_total || 0), 0).toFixed(3)} color="text-orange-600" />
              <SummaryBox label="إجمالي الربح"   value={salesList.reduce((s, r) => s + parseFloat(r.gross_profit || 0), 0).toFixed(3)} color="text-primary" />
            </div>
          )}
        </TabsContent>

        {/* ══ المدفوعات ════════════════════════════════════════════════════ */}
        <TabsContent value="payments" className="space-y-4">
          {payments ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard title="مبيعات نقدية"   value={fmtOMR(payments.cash)}          icon={Banknote}   color="text-green-600" />
                <KpiCard title="مبيعات بطاقة"   value={fmtOMR(payments.card)}          icon={CreditCard} color="text-purple-600" />
                <KpiCard title="تحويل بنكي"      value={fmtOMR(payments.bank_transfer)} icon={Building2}  color="text-indigo-600" />
              </div>
              <Card className="rounded-2xl">
                <CardHeader className="pb-2"><CardTitle className="text-sm">توزيع طرق الدفع</CardTitle></CardHeader>
                <CardContent>
                  {paymentPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={paymentPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
                          {paymentPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [parseFloat(v).toFixed(3) + " ر.ع", ""]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyState icon={PieIcon} label="لا توجد بيانات" />}
                </CardContent>
              </Card>
            </div>
          ) : <EmptyState icon={CreditCard} label="اختر نطاق تاريخ لعرض تقرير المدفوعات" />}
        </TabsContent>

        {/* ══ المنتجات ══════════════════════════════════════════════════════ */}
        <TabsContent value="products" className="space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Package className="h-5 w-5 text-primary" />ربحية المنتجات</h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">المنتج</TableHead>
                  <TableHead className="text-right">الكمية</TableHead>
                  <TableHead className="text-right">إجمالي المبيعات</TableHead>
                  <TableHead className="text-right">التكلفة</TableHead>
                  <TableHead className="text-right">إجمالي الربح</TableHead>
                  <TableHead className="text-right">الهامش</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsRpt.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : productsRpt.map((p, i) => {
                  const margin = parseFloat(p.total_revenue || 0) > 0
                    ? ((parseFloat(p.gross_profit || 0) / parseFloat(p.total_revenue || 0)) * 100).toFixed(1)
                    : "0.0";
                  return (
                    <TableRow key={i} className="hover:bg-pink-50/30">
                      <TableCell className="text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium">{p.product_name}</TableCell>
                      <TableCell>{p.total_qty}</TableCell>
                      <TableCell className="text-green-600 font-medium">{omr(p.total_revenue)}</TableCell>
                      <TableCell className="text-orange-600">{omr(p.total_cogs)}</TableCell>
                      <TableCell className="text-blue-600 font-medium">{omr(p.gross_profit)}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${parseFloat(margin) >= 30 ? "bg-green-100 text-green-800" : parseFloat(margin) >= 15 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                          {margin}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {productsRpt.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader className="pb-2"><CardTitle className="text-sm">أعلى 10 منتجات ربحية</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={productsRpt.slice(0, 10).map(p => ({ name: p.product_name?.slice(0, 12) || "؟", ربح: parseFloat(p.gross_profit || 0) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "Cairo" }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="ربح" fill={PINK} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ الفئات ════════════════════════════════════════════════════════ */}
        <TabsContent value="categories" className="space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />مبيعات الفئات</h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">الفئة</TableHead>
                  <TableHead className="text-right">الكمية</TableHead>
                  <TableHead className="text-right">المبيعات</TableHead>
                  <TableHead className="text-right">التكلفة</TableHead>
                  <TableHead className="text-right">الربح</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoriesRpt.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : categoriesRpt.map((c, i) => (
                  <TableRow key={i} className="hover:bg-pink-50/30">
                    <TableCell className="text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium">{c.category_name || "—"}</TableCell>
                    <TableCell>{c.total_qty}</TableCell>
                    <TableCell className="text-green-600 font-medium">{omr(c.total_revenue)}</TableCell>
                    <TableCell className="text-orange-600">{omr(c.total_cogs)}</TableCell>
                    <TableCell className="text-blue-600 font-medium">{omr(c.gross_profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ══ الورديات ════════════════════════════════════════════════════ */}
        <TabsContent value="shifts" className="space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />تقرير الورديات</h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  {isAdmin && <TableHead className="text-right">الفرع</TableHead>}
                  <TableHead className="text-right">الكاشير</TableHead>
                  <TableHead className="text-right">الجهاز</TableHead>
                  <TableHead className="text-right">المبيعات</TableHead>
                  <TableHead className="text-right">الافتتاح</TableHead>
                  <TableHead className="text-right">المتوقع</TableHead>
                  <TableHead className="text-right">الفعلي</TableHead>
                  <TableHead className="text-right">الفرق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shiftsRpt.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">لا توجد ورديات مغلقة في هذه الفترة</TableCell></TableRow>
                ) : shiftsRpt.map((s, i) => {
                  const diff = parseFloat(s.difference || 0);
                  return (
                    <TableRow key={s.id} className="hover:bg-pink-50/30">
                      <TableCell className="text-xs">{i + 1}</TableCell>
                      <TableCell className="text-xs">{s.started_at ? new Date(s.started_at).toLocaleDateString("ar-OM") : "—"}</TableCell>
                      {isAdmin && <TableCell className="text-xs">{branchLabel(s.branch_id)}</TableCell>}
                      <TableCell className="font-medium">{s.cashier_name || s.cashierName || "—"}</TableCell>
                      <TableCell className="text-xs">{s.terminal_name || s.terminalName}</TableCell>
                      <TableCell className="text-green-600 font-medium">{omr(s.total_cash ?? s.totalCash)}</TableCell>
                      <TableCell>{omr(s.opening_cash ?? s.openingCash)}</TableCell>
                      <TableCell>{omr(s.expected_cash ?? s.expectedCash)}</TableCell>
                      <TableCell className="font-medium">{omr(s.actual_cash ?? s.actualCash)}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${Math.abs(diff) < 0.002 ? "bg-green-100 text-green-800" : diff > 0 ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}`}>
                          {diff > 0 ? `+${omr(diff)}` : omr(diff)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ══ مقارنة الفروع ════════════════════════════════════════════════ */}
        {isAdmin && (
          <TabsContent value="branches" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" />مقارنة الفروع</h2>
              <Button size="sm" variant="outline" onClick={exportBranchComp}>
                <Download className="h-4 w-4 ml-1" /> تصدير CSV
              </Button>
            </div>

            {branchComp?.branches ? (
              <div className="space-y-5">
                {/* Bar Chart */}
                <Card className="rounded-2xl">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">مقارنة المبيعات والربح</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={bcData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: "Cairo" }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="مبيعات"  fill={PINK}    radius={[4, 4, 0, 0]} />
                        <Bar dataKey="تكلفة"   fill="#FF9800" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ربح"     fill="#4CAF50" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="مصروفات" fill="#F44336" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Branch Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {branchComp.branches.map((b: any) => (
                    <Card key={b.branchId} className="rounded-2xl border-pink-100">
                      <CardHeader className="pb-2 border-b border-pink-50">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          {b.branchName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-3">
                        <div className="space-y-2 text-sm">
                          <BranchRow label="إجمالي المبيعات"    value={omr(b.totalSales)}    color="text-green-600" />
                          <BranchRow label="تكلفة البضاعة"       value={omr(b.cogsTotal)}     color="text-orange-600" />
                          <BranchRow label="إجمالي الربح التجاري" value={omr(b.grossProfit)}  color="text-blue-600" />
                          <BranchRow label="المصروفات"            value={omr(b.totalExpenses)} color="text-red-600" />
                          <div className="border-t pt-2 flex justify-between font-bold">
                            <span>صافي الربح</span>
                            <span className={parseFloat(b.netProfit) >= 0 ? "text-green-700" : "text-red-700"}>
                              {omr(b.netProfit)} ر.ع
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>هامش الربح</span>
                            <Badge className={`text-xs ${parseFloat(b.margin) >= 20 ? "bg-green-100 text-green-800" : parseFloat(b.margin) >= 10 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                              {b.margin}%
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Summary Table */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-right">الفرع</TableHead>
                        <TableHead className="text-right">المبيعات</TableHead>
                        <TableHead className="text-right">التكلفة</TableHead>
                        <TableHead className="text-right">إجمالي الربح</TableHead>
                        <TableHead className="text-right">المصروفات</TableHead>
                        <TableHead className="text-right">صافي الربح</TableHead>
                        <TableHead className="text-right">الهامش</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchComp.branches.map((b: any) => (
                        <TableRow key={b.branchId} className="hover:bg-pink-50/30">
                          <TableCell className="font-medium">{b.branchName}</TableCell>
                          <TableCell className="text-green-600">{omr(b.totalSales)}</TableCell>
                          <TableCell className="text-orange-600">{omr(b.cogsTotal)}</TableCell>
                          <TableCell className="text-blue-600">{omr(b.grossProfit)}</TableCell>
                          <TableCell className="text-red-600">{omr(b.totalExpenses)}</TableCell>
                          <TableCell className={`font-bold ${parseFloat(b.netProfit) >= 0 ? "text-green-700" : "text-red-700"}`}>{omr(b.netProfit)}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${parseFloat(b.margin) >= 20 ? "bg-green-100 text-green-800" : parseFloat(b.margin) >= 10 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                              {b.margin}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : <EmptyState icon={GitBranch} label="اختر نطاق تاريخ لعرض مقارنة الفروع" />}
          </TabsContent>
        )}

        {/* ══ التدفقات النقدية ══════════════════════════════════════════════ */}
        {isAdmin && (
          <TabsContent value="cashflow" className="space-y-4">
            <h2 className="font-bold text-lg flex items-center gap-2"><Banknote className="h-5 w-5 text-primary" />قائمة التدفقات النقدية</h2>
            {cashFlow ? (
              <div className="space-y-4">
                {/* Operating */}
                <Card className="rounded-2xl border-green-100">
                  <CardHeader className="pb-2 bg-green-50 rounded-t-2xl">
                    <CardTitle className="text-sm text-green-800">أولاً: التدفقات التشغيلية</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-2 text-sm">
                    <CashFlowRow label="إيرادات من المبيعات" value={cashFlow.operating?.fromSales} color="text-green-600" />
                    <CashFlowRow label="مدفوعات المصروفات"    value={`(${omr(cashFlow.operating?.toExpenses)})`} color="text-red-600" />
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>صافي التدفق التشغيلي</span>
                      <span className={parseFloat(cashFlow.operating?.netOperating) >= 0 ? "text-green-700" : "text-red-700"}>
                        {omr(cashFlow.operating?.netOperating)} ر.ع
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Financing */}
                <Card className="rounded-2xl border-blue-100">
                  <CardHeader className="pb-2 bg-blue-50 rounded-t-2xl">
                    <CardTitle className="text-sm text-blue-800">ثانياً: التدفقات التمويلية</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-2 text-sm">
                    <CashFlowRow label="إيداعات" value={cashFlow.financing?.depositsIn}     color="text-green-600" />
                    <CashFlowRow label="سحوبات"  value={`(${omr(cashFlow.financing?.withdrawalsOut)})`} color="text-red-600" />
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>صافي التمويلي</span>
                      <span className={parseFloat(cashFlow.financing?.netFinancing) >= 0 ? "text-green-700" : "text-red-700"}>
                        {omr(cashFlow.financing?.netFinancing)} ر.ع
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Bank */}
                <Card className="rounded-2xl border-purple-100">
                  <CardHeader className="pb-2 bg-purple-50 rounded-t-2xl">
                    <CardTitle className="text-sm text-purple-800">ثالثاً: حركة البنك</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-2 text-sm">
                    <CashFlowRow label="إجمالي الوارد"  value={cashFlow.bank?.totalIn}  color="text-green-600" />
                    <CashFlowRow label="إجمالي الصادر"  value={`(${omr(cashFlow.bank?.totalOut)})`} color="text-red-600" />
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>صافي حركة البنك</span>
                      <span className={parseFloat(cashFlow.bank?.netChange) >= 0 ? "text-green-700" : "text-red-700"}>
                        {omr(cashFlow.bank?.netChange)} ر.ع
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Net */}
                <Card className={`rounded-2xl border-2 ${parseFloat(cashFlow.totalNetChange) >= 0 ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
                  <CardContent className="p-5 flex justify-between items-center">
                    <span className="font-extrabold text-lg">صافي التغير في النقدية</span>
                    <span className={`font-extrabold text-2xl ${parseFloat(cashFlow.totalNetChange) >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {omr(cashFlow.totalNetChange)} ر.ع
                    </span>
                  </CardContent>
                </Card>
              </div>
            ) : <EmptyState icon={Banknote} label="اختر نطاق تاريخ لعرض التدفقات النقدية" />}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─── helper sub-components ────────────────────────────────────────────────────
function IncomeRow({ label, value, indent = 0, bold = false, valueClass = "" }:
  { label: string; value: any; indent?: number; bold?: boolean; valueClass?: string }) {
  return (
    <div className={`flex justify-between items-center px-5 py-2.5 ${bold ? "font-semibold bg-muted/20" : ""}`}
         style={{ paddingRight: `${20 + indent * 16}px` }}>
      <span className="text-sm">{label}</span>
      <span className={`text-sm font-mono ${valueClass || (bold ? "font-bold" : "")}`}>
        {typeof value === "number" ? value.toFixed(3) : value || "0.000"} ر.ع
      </span>
    </div>
  );
}

function BranchRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color}`}>{value} ر.ع</span>
    </div>
  );
}

function CashFlowRow({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color}`}>
        {typeof value === "string" && value.startsWith("(") ? value : `${parseFloat(String(value || 0)).toFixed(3)}`} ر.ع
      </span>
    </div>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-muted/30 rounded-xl p-3 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`font-bold text-lg ${color}`}>{value} ر.ع</p>
    </div>
  );
}

function EmptyState({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <Icon className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function PayMethodBadge({ method }: { method: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    cash:          { label: "نقدي",         cls: "bg-green-100 text-green-800" },
    card:          { label: "بطاقة",         cls: "bg-purple-100 text-purple-800" },
    bank_transfer: { label: "تحويل بنكي",    cls: "bg-indigo-100 text-indigo-800" },
  };
  const m = map[method] || { label: method, cls: "bg-gray-100 text-gray-800" };
  return <Badge className={`text-xs ${m.cls}`}>{m.label}</Badge>;
}
