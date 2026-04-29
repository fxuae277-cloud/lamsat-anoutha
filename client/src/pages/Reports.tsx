import { useState } from "react";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, CreditCard, Building2,
  Download, Package, Users, PieChart as PieIcon,
  ArrowUpRight, ArrowDownRight, Minus, Calendar, GitBranch,
  Banknote, ChevronDown, ChevronUp, Scale,
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
  const [ordersYear, setOrdersYear]   = useState(String(new Date().getFullYear()));
  const [ordersView, setOrdersView]   = useState<"category"|"product">("category");

  const branchId = branch !== "all" ? Number(branch) : undefined;
  const branchQs = branchId ? `&branchId=${branchId}` : "";

  const { data: _branches }     = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "returnNull" }) });
  const { data: income }        = useQuery<any>({ queryKey: [`/api/reports/income-statement?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }), enabled: isAdmin });
  const { data: branchComp }    = useQuery<any>({ queryKey: [`/api/reports/branch-comparison-range?from=${from}&to=${to}`], queryFn: getQueryFn({ on401: "returnNull" }), enabled: isAdmin });
  const { data: payments }      = useQuery<any>({ queryKey: [`/api/reports/payments-report?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }) });
  const { data: _productsRpt }  = useQuery<any[]>({ queryKey: [`/api/reports/products-report?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }) });
  const { data: cashFlow }      = useQuery<any>({ queryKey: [`/api/reports/cash-flow?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }), enabled: isAdmin });
  const { data: _expCats }      = useQuery<any[]>({ queryKey: [`/api/reports/expenses-by-category?from=${from}&to=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }), enabled: isAdmin });
  const { data: balanceSheet }  = useQuery<any>({ queryKey: [`/api/reports/balance-sheet?asOf=${to}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }), enabled: isAdmin });
  const { data: ordersMonthly } = useQuery<any>({ queryKey: [`/api/reports/orders-monthly?year=${ordersYear}${branchQs}`], queryFn: getQueryFn({ on401: "returnNull" }) });

  // ── null-safe array coercion ───────────────────────────────────────────────
  const branches     : Branch[] = Array.isArray(_branches)     ? _branches     : [];
  const productsRpt  : any[]    = Array.isArray(_productsRpt)  ? _productsRpt  : [];
  const expCats      : any[]    = Array.isArray(_expCats)      ? _expCats      : [];

  // ── branch city label helper ──────────────────────────────────────────────
  const branchCityLabel = (b: Branch) => {
    if (!b.address) return b.name;
    const city = b.address.split("،")[0].replace("ولاية", "").trim();
    if (!city || b.name.includes(city)) return b.name;
    return `${b.name} - ${city}`;
  };

  const branchLabel = (id: number) => {
    const b = branches.find(b => b.id === id);
    return b ? branchCityLabel(b) : `فرع ${id}`;
  };

  // ── payments helpers — API returns { methods: [...], transactions: [...], grandTotal } ──
  const pmtMethod = (key: string) =>
    parseFloat((payments?.methods || []).find((m: any) => m.method === key)?.total || "0");
  const pmtMethodCount = (key: string) =>
    (payments?.methods || []).find((m: any) => m.method === key)?.count || 0;

  // ── payments pie data ─────────────────────────────────────────────────────
  const paymentPieData = payments ? [
    { name: "نقدي",        value: pmtMethod("cash")          },
    { name: "بطاقة",       value: pmtMethod("card")          },
    { name: "تحويل بنكي",  value: pmtMethod("bank_transfer") },
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
  function exportBranchComp() {
    if (!branchComp?.branches) return;
    const headers = ["الفرع", "المبيعات", "التكلفة", "إجمالي الربح", "المصروفات", "صافي الربح", "الهامش%"];
    const rows = branchComp.branches.map((b: any) => [
      b.branchName, omr(b.totalSales), omr(b.cogsTotal),
      omr(b.grossProfit), omr(b.totalExpenses), omr(b.netProfit), b.margin + "%",
    ]);
    downloadCSV(`مقارنة_الفروع_${from}_${to}.csv`, [headers, ...rows]);
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
                {(() => {
                  if (!b.address) return b.name;
                  const city = b.address.split("،")[0].replace("ولاية", "").trim();
                  if (!city || b.name.includes(city)) return b.name;
                  return `${b.name} - ${city}`;
                })()}
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
            <TabsTrigger value="overview"      className="gap-1 whitespace-nowrap"><TrendingUp className="h-4 w-4" />نظرة عامة</TabsTrigger>
            <TabsTrigger value="payments"      className="gap-1 whitespace-nowrap"><CreditCard className="h-4 w-4" />المدفوعات</TabsTrigger>
            <TabsTrigger value="products"      className="gap-1 whitespace-nowrap"><Package className="h-4 w-4" />المنتجات</TabsTrigger>
            <TabsTrigger value="orders-report" className="gap-1 whitespace-nowrap"><Users className="h-4 w-4" />تقرير الطلبات</TabsTrigger>
            {isAdmin && <TabsTrigger value="branches"      className="gap-1 whitespace-nowrap"><GitBranch className="h-4 w-4" />مقارنة الفروع</TabsTrigger>}
            {isAdmin && <TabsTrigger value="cashflow"      className="gap-1 whitespace-nowrap"><Banknote className="h-4 w-4" />التدفقات النقدية</TabsTrigger>}
            {isAdmin && <TabsTrigger value="balance-sheet" className="gap-1 whitespace-nowrap"><Scale className="h-4 w-4" />الميزانية العمومية</TabsTrigger>}
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
                <KpiCard title="صافي الربح"             value={fmtOMR(income.netProfit)}         icon={TrendingUp}   color="text-primary"    sub={`هامش ${income.netMargin}%`} trend={parseFloat(income.netProfit) >= 0 ? "up" : "down"} />
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

        {/* ══ المدفوعات ════════════════════════════════════════════════════ */}
        <TabsContent value="payments" className="space-y-4">
          {payments ? (
            <div className="space-y-4">
              {/* KPI cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard title="مبيعات نقدية"    value={fmtOMR(pmtMethod("cash"))}          icon={Banknote}   color="text-green-600"  sub={`${pmtMethodCount("cash")} فاتورة`} />
                <KpiCard title="مبيعات بطاقة"    value={fmtOMR(pmtMethod("card"))}          icon={CreditCard} color="text-purple-600" sub={`${pmtMethodCount("card")} فاتورة`} />
                <KpiCard title="تحويل بنكي"       value={fmtOMR(pmtMethod("bank_transfer"))} icon={Building2}  color="text-indigo-600" sub={`${pmtMethodCount("bank_transfer")} فاتورة`} />
                <KpiCard title="الإجمالي"         value={fmtOMR(payments.grandTotal)}        icon={DollarSign} color="text-primary" />
              </div>

              {/* Pie chart */}
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

              {/* Transactions table */}
              {(payments.transactions || []).length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b font-semibold text-sm bg-muted/30">
                    آخر {payments.transactions.length} عملية دفع
                  </div>
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-start">رقم الفاتورة</TableHead>
                        <TableHead className="text-start">الفرع</TableHead>
                        <TableHead className="text-start">طريقة الدفع</TableHead>
                        <TableHead className="text-start">الرقم المرجعي</TableHead>
                        <TableHead className="text-start">المبلغ</TableHead>
                        <TableHead className="text-start">الكاشير</TableHead>
                        <TableHead className="text-start">التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.transactions.map((tx: any) => (
                        <TableRow key={tx.id} className="hover:bg-pink-50/30">
                          <TableCell className="font-mono text-xs text-primary">{tx.invoiceNumber}</TableCell>
                          <TableCell className="text-xs">{tx.branchName}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${tx.method === "cash" ? "bg-green-100 text-green-800" : tx.method === "card" ? "bg-purple-100 text-purple-800" : "bg-indigo-100 text-indigo-800"}`}>
                              {tx.method === "cash" ? "نقدي" : tx.method === "card" ? "بطاقة" : "تحويل"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{tx.bankTxnId || "—"}</TableCell>
                          <TableCell className="font-medium text-green-600">{omr(tx.total)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.cashierName || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("ar-OM") : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
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
                  <TableHead className="text-start">#</TableHead>
                  <TableHead className="text-start">المنتج</TableHead>
                  <TableHead className="text-start">الكمية</TableHead>
                  <TableHead className="text-start">إجمالي المبيعات</TableHead>
                  <TableHead className="text-start">التكلفة</TableHead>
                  <TableHead className="text-start">إجمالي الربح</TableHead>
                  <TableHead className="text-start">الهامش</TableHead>
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

        {/* ══ تقرير الطلبات ════════════════════════════════════════════════ */}
        <TabsContent value="orders-report" className="space-y-4">
          {/* شريط الإعدادات */}
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />تقرير الطلبات الشهري
            </h2>
            <div className="flex gap-2 items-center">
              <select
                value={ordersYear}
                onChange={e => setOrdersYear(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm bg-background"
              >
                {[0, 1, 2].map(offset => {
                  const y = String(new Date().getFullYear() - offset);
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <div className="flex rounded-md border overflow-hidden text-sm">
                <button
                  className={`px-3 py-1.5 transition-colors ${ordersView === "category" ? "bg-primary text-white" : "hover:bg-muted"}`}
                  onClick={() => setOrdersView("category")}
                >حسب الفئة</button>
                <button
                  className={`px-3 py-1.5 transition-colors ${ordersView === "product" ? "bg-primary text-white" : "hover:bg-muted"}`}
                  onClick={() => setOrdersView("product")}
                >حسب المنتج</button>
              </div>
            </div>
          </div>

          {/* بطاقات حالات الطلبات */}
          {(ordersMonthly?.statuses || []).length > 0 && (() => {
            const sts = ordersMonthly.statuses as any[];
            const find = (s: string) => sts.find(x => x.status === s);
            const statusMap: Record<string, { label: string; cls: string }> = {
              new:       { label: "جديد",      cls: "bg-blue-100 text-blue-800" },
              confirmed: { label: "مؤكد",      cls: "bg-indigo-100 text-indigo-800" },
              preparing: { label: "قيد التجهيز", cls: "bg-yellow-100 text-yellow-800" },
              ready:     { label: "جاهز",      cls: "bg-purple-100 text-purple-800" },
              delivered: { label: "مُسلَّم",   cls: "bg-green-100 text-green-800" },
              cancelled: { label: "ملغي",      cls: "bg-red-100 text-red-800" },
            };
            return (
              <div className="flex flex-wrap gap-2">
                {sts.map((s: any) => {
                  const info = statusMap[s.status] || { label: s.status, cls: "bg-gray-100 text-gray-800" };
                  return (
                    <div key={s.status} className={`rounded-xl px-4 py-2 text-sm font-medium flex gap-2 items-center ${info.cls}`}>
                      <span>{info.label}</span>
                      <span className="font-bold">{s.cnt}</span>
                      <span className="opacity-70 text-xs">({parseFloat(s.total).toFixed(3)} ر.ع)</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* مخطط الطلبات الشهرية */}
          {(ordersMonthly?.monthly || []).length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">إجمالي الطلبات الشهرية — {ordersYear}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={(ordersMonthly?.monthly || []).map((m: any) => ({
                    name: (() => {
                      const MONTH_AR: Record<string, string> = {
                        "01":"يناير","02":"فبراير","03":"مارس","04":"أبريل",
                        "05":"مايو","06":"يونيو","07":"يوليو","08":"أغسطس",
                        "09":"سبتمبر","10":"أكتوبر","11":"نوفمبر","12":"ديسمبر",
                      };
                      return MONTH_AR[m.month?.slice(5)] || m.month?.slice(5);
                    })(),
                    طلبات:  parseFloat(m.total_revenue || 0),
                    ربح:    parseFloat(m.gross_profit || 0),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "Cairo" }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="طلبات" fill={PINK}      radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ربح"   fill="#9C27B0"   radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* جدول الملخص الشهري */}
          {(() => {
            const MONTH_AR: Record<string, string> = {
              "01":"يناير","02":"فبراير","03":"مارس","04":"أبريل",
              "05":"مايو","06":"يونيو","07":"يوليو","08":"أغسطس",
              "09":"سبتمبر","10":"أكتوبر","11":"نوفمبر","12":"ديسمبر",
            };
            const rows = ordersMonthly?.monthly || [];
            return (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>الشهر</TableHead>
                      <TableHead className="text-center">عدد الطلبات</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-start">إجمالي المبيعات</TableHead>
                      <TableHead className="text-start">التكلفة</TableHead>
                      <TableHead className="text-start">إجمالي الربح</TableHead>
                      <TableHead className="text-center">الهامش%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          لا توجد طلبات في سنة {ordersYear}
                        </TableCell>
                      </TableRow>
                    ) : rows.map((m: any) => {
                      const margin = parseFloat(m.total_revenue) > 0
                        ? ((parseFloat(m.gross_profit) / parseFloat(m.total_revenue)) * 100).toFixed(1)
                        : "0.0";
                      const mm = m.month?.slice(5);
                      return (
                        <TableRow key={m.month} className="hover:bg-pink-50/30">
                          <TableCell className="font-medium">{MONTH_AR[mm] || mm} {m.month?.slice(0, 4)}</TableCell>
                          <TableCell className="text-center">{m.order_count}</TableCell>
                          <TableCell className="text-center">{m.total_qty}</TableCell>
                          <TableCell className="text-start text-green-600 font-medium">{fmtOMR(m.total_revenue)}</TableCell>
                          <TableCell className="text-start text-orange-600">{fmtOMR(m.total_cogs)}</TableCell>
                          <TableCell className="text-start text-blue-600 font-medium">{fmtOMR(m.gross_profit)}</TableCell>
                          <TableCell className="text-center">
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
            );
          })()}

          {/* تفصيل حسب الفئة */}
          {ordersView === "category" && (() => {
            const MONTH_AR: Record<string, string> = {
              "01":"يناير","02":"فبراير","03":"مارس","04":"أبريل",
              "05":"مايو","06":"يونيو","07":"يوليو","08":"أغسطس",
              "09":"سبتمبر","10":"أكتوبر","11":"نوفمبر","12":"ديسمبر",
            };
            const rows = ordersMonthly?.by_category || [];

            // رسم بياني: مجموع الفئات على مدار السنة
            const catTotals: Record<string, number> = {};
            rows.forEach((r: any) => {
              catTotals[r.category_name] = (catTotals[r.category_name] || 0) + parseFloat(r.total_revenue || 0);
            });
            const pieData = Object.entries(catTotals)
              .map(([name, value]) => ({ name, value }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 8);

            return (
              <div className="space-y-4">
                {pieData.length > 0 && (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <PieIcon className="h-4 w-4 text-primary" />توزيع مبيعات الفئات — {ordersYear}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => [parseFloat(v).toFixed(3) + " ر.ع", ""]} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b font-semibold text-sm bg-muted/30">
                    مبيعات أعلى 8 فئات — شهرياً
                  </div>
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>الشهر</TableHead>
                        <TableHead>الفئة</TableHead>
                        <TableHead className="text-center">الكمية</TableHead>
                        <TableHead className="text-start">المبيعات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                      ) : rows.map((row: any, i: number) => {
                        const mm = row.month?.slice(5);
                        return (
                          <TableRow key={i} className="hover:bg-pink-50/30">
                            <TableCell className="text-sm text-muted-foreground">{MONTH_AR[mm] || mm}</TableCell>
                            <TableCell className="font-medium">{row.category_name}</TableCell>
                            <TableCell className="text-center">{row.total_qty}</TableCell>
                            <TableCell className="text-start text-green-600 font-medium">{fmtOMR(row.total_revenue)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}

          {/* تفصيل حسب المنتج */}
          {ordersView === "product" && (() => {
            const MONTH_AR: Record<string, string> = {
              "01":"يناير","02":"فبراير","03":"مارس","04":"أبريل",
              "05":"مايو","06":"يونيو","07":"يوليو","08":"أغسطس",
              "09":"سبتمبر","10":"أكتوبر","11":"نوفمبر","12":"ديسمبر",
            };
            const rows = ordersMonthly?.by_product || [];

            // أعلى 10 منتجات للرسم البياني
            const prodTotals: Record<string, number> = {};
            rows.forEach((r: any) => {
              prodTotals[r.product_name] = (prodTotals[r.product_name] || 0) + parseFloat(r.total_revenue || 0);
            });
            const top10 = Object.entries(prodTotals)
              .map(([name, value]) => ({ name: name.slice(0, 14), value }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 10);

            return (
              <div className="space-y-4">
                {top10.length > 0 && (
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">أعلى 10 منتجات — إجمالي {ordersYear}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={top10}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "Cairo" }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" name="مبيعات" fill={PINK} radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b font-semibold text-sm bg-muted/30">
                    مبيعات أعلى 15 منتجاً — شهرياً
                  </div>
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>الشهر</TableHead>
                        <TableHead>المنتج</TableHead>
                        <TableHead className="text-center">الكمية</TableHead>
                        <TableHead className="text-start">المبيعات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                      ) : rows.map((row: any, i: number) => {
                        const mm = row.month?.slice(5);
                        return (
                          <TableRow key={i} className="hover:bg-pink-50/30">
                            <TableCell className="text-sm text-muted-foreground">{MONTH_AR[mm] || mm}</TableCell>
                            <TableCell className="font-medium">{row.product_name}</TableCell>
                            <TableCell className="text-center">{row.total_qty}</TableCell>
                            <TableCell className="text-start text-green-600 font-medium">{fmtOMR(row.total_revenue)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}
        </TabsContent>

        {/* ══ مقارنة الفروع ════════════════════════════════════════════════ */}
        {isAdmin && (
          <TabsContent value="branches" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" />مقارنة الفروع</h2>
              <Button size="sm" variant="outline" onClick={exportBranchComp}>
                <Download className="h-4 w-4 ms-1" /> تصدير CSV
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
                        <TableHead className="text-start">الفرع</TableHead>
                        <TableHead className="text-start">المبيعات</TableHead>
                        <TableHead className="text-start">التكلفة</TableHead>
                        <TableHead className="text-start">إجمالي الربح</TableHead>
                        <TableHead className="text-start">المصروفات</TableHead>
                        <TableHead className="text-start">صافي الربح</TableHead>
                        <TableHead className="text-start">الهامش</TableHead>
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

        {/* ── الميزانية العمومية ───────────────────────────────────────────── */}
        {isAdmin && (
          <TabsContent value="balance-sheet" className="space-y-4">
            <div className="text-center text-sm text-muted-foreground mb-2">
              الميزانية العمومية بتاريخ: <span className="font-semibold text-foreground">{to}</span>
            </div>
            {balanceSheet ? (
              <>
                {/* KPI row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard title="إجمالي الأصول"          value={fmtOMR(balanceSheet.totals?.assets)}                    icon={Package}    color="text-blue-600" />
                  <KpiCard title="إجمالي الخصوم"          value={fmtOMR(balanceSheet.totals?.liabilities)}               icon={TrendingDown} color="text-red-600" />
                  <KpiCard title="حقوق الملكية"           value={fmtOMR(balanceSheet.totals?.equity)}                    icon={Users}      color="text-purple-600" />
                  <KpiCard title="أرباح/خسائر الفترة"     value={fmtOMR(balanceSheet.totals?.currentPeriodProfit)}       icon={TrendingUp} color={parseFloat(balanceSheet.totals?.currentPeriodProfit) >= 0 ? "text-green-600" : "text-red-600"} />
                </div>

                {/* توازن الميزانية */}
                {(() => {
                  const diff = Math.abs(parseFloat(balanceSheet.totals?.assets || "0") - parseFloat(balanceSheet.totals?.totalLiabilitiesAndEquity || "0"));
                  return (
                    <div className={`flex items-center justify-center gap-3 py-2 px-4 rounded-xl text-sm font-medium ${diff < 0.01 ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                      <Scale className="h-4 w-4" />
                      {diff < 0.01
                        ? "✅ الميزانية متوازنة — الأصول = الخصوم + حقوق الملكية"
                        : `⚠️ فارق في الميزانية: ${diff.toFixed(3)} ر.ع`}
                    </div>
                  );
                })()}

                {/* جدولان جنباً إلى جنب */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* الأصول */}
                  <Card className="rounded-2xl border-blue-100">
                    <CardHeader className="pb-2 bg-blue-50 rounded-t-2xl">
                      <CardTitle className="text-sm text-blue-800 flex justify-between">
                        <span>أولاً: الأصول</span>
                        <span className="font-mono">{fmtOMR(balanceSheet.totals?.assets)}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 p-0">
                      {(balanceSheet.assets || []).length === 0
                        ? <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
                        : (balanceSheet.assets || []).map((a: any) => (
                          <BsRow key={a.code} code={a.code} name={a.name} balance={a.balance} level={a.level} />
                        ))}
                      <div className="flex justify-between items-center px-4 py-3 bg-blue-50/60 border-t font-bold text-sm">
                        <span>إجمالي الأصول</span>
                        <span className="font-mono text-blue-700">{fmtOMR(balanceSheet.totals?.assets)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* الخصوم + حقوق الملكية */}
                  <div className="space-y-4">
                    <Card className="rounded-2xl border-red-100">
                      <CardHeader className="pb-2 bg-red-50 rounded-t-2xl">
                        <CardTitle className="text-sm text-red-800 flex justify-between">
                          <span>ثانياً: الخصوم</span>
                          <span className="font-mono">{fmtOMR(balanceSheet.totals?.liabilities)}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-2 p-0">
                        {(balanceSheet.liabilities || []).length === 0
                          ? <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
                          : (balanceSheet.liabilities || []).map((a: any) => (
                            <BsRow key={a.code} code={a.code} name={a.name} balance={a.balance} level={a.level} />
                          ))}
                        <div className="flex justify-between items-center px-4 py-3 bg-red-50/60 border-t font-bold text-sm">
                          <span>إجمالي الخصوم</span>
                          <span className="font-mono text-red-700">{fmtOMR(balanceSheet.totals?.liabilities)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-purple-100">
                      <CardHeader className="pb-2 bg-purple-50 rounded-t-2xl">
                        <CardTitle className="text-sm text-purple-800 flex justify-between">
                          <span>ثالثاً: حقوق الملكية</span>
                          <span className="font-mono">{fmtOMR((parseFloat(balanceSheet.totals?.equity || "0") + parseFloat(balanceSheet.totals?.currentPeriodProfit || "0")).toFixed(3))}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-2 p-0">
                        {(balanceSheet.equity || []).map((a: any) => (
                          <BsRow key={a.code} code={a.code} name={a.name} balance={a.balance} level={a.level} />
                        ))}
                        <BsRow code="" name="أرباح/خسائر الفترة الحالية" balance={balanceSheet.totals?.currentPeriodProfit} level={2}
                          valueClass={parseFloat(balanceSheet.totals?.currentPeriodProfit) >= 0 ? "text-green-700" : "text-red-700"} />
                        <div className="flex justify-between items-center px-4 py-3 bg-purple-50/60 border-t font-bold text-sm">
                          <span>إجمالي حقوق الملكية</span>
                          <span className="font-mono text-purple-700">
                            {fmtOMR((parseFloat(balanceSheet.totals?.equity || "0") + parseFloat(balanceSheet.totals?.currentPeriodProfit || "0")).toFixed(3))}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* مجموع الجانب الأيسر */}
                    <Card className="rounded-2xl border-2 border-gray-300 bg-gray-50">
                      <CardContent className="px-4 py-3 flex justify-between items-center">
                        <span className="font-extrabold text-sm">إجمالي الخصوم + حقوق الملكية</span>
                        <span className="font-mono font-extrabold text-base">
                          {fmtOMR(balanceSheet.totals?.totalLiabilitiesAndEquity)}
                        </span>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* تصدير CSV */}
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                    const rows: any[][] = [
                      ["نوع", "كود الحساب", "اسم الحساب", "الرصيد (ر.ع)"],
                      ...((balanceSheet.assets || []).map((a: any) => ["أصول", a.code, a.name, omr(a.balance)])),
                      ["إجمالي الأصول", "", "", omr(balanceSheet.totals?.assets)],
                      ...((balanceSheet.liabilities || []).map((a: any) => ["خصوم", a.code, a.name, omr(a.balance)])),
                      ["إجمالي الخصوم", "", "", omr(balanceSheet.totals?.liabilities)],
                      ...((balanceSheet.equity || []).map((a: any) => ["حقوق الملكية", a.code, a.name, omr(a.balance)])),
                      ["أرباح/خسائر الفترة", "", "", omr(balanceSheet.totals?.currentPeriodProfit)],
                      ["إجمالي الخصوم + ح.الملكية", "", "", omr(balanceSheet.totals?.totalLiabilitiesAndEquity)],
                    ];
                    downloadCSV(`الميزانية_العمومية_${to}.csv`, rows);
                  }}>
                    <Download className="h-4 w-4" />
                    تصدير CSV
                  </Button>
                </div>
              </>
            ) : <EmptyState icon={Scale} label="اختر تاريخ لعرض الميزانية العمومية" />}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ─── helper sub-components ────────────────────────────────────────────────────
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

function BsRow({ code, name, balance, level = 1, valueClass = "" }:
  { code: string; name: string; balance: any; level?: number; valueClass?: string }) {
  const isHeader = level <= 1;
  const amount = parseFloat(String(balance || "0"));
  return (
    <div
      className={`flex justify-between items-center px-4 py-2 border-b border-border/40 last:border-0 ${isHeader ? "bg-muted/20 font-semibold" : ""}`}
      style={{ paddingRight: `${16 + (level - 1) * 16}px` }}
    >
      <span className={`text-sm ${isHeader ? "" : "text-muted-foreground"}`}>
        {code ? `${code} - ${name}` : name}
      </span>
      <span className={`text-sm font-mono ${valueClass || (isHeader ? "font-bold" : "")}`}>
        {amount.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ر.ع
      </span>
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
