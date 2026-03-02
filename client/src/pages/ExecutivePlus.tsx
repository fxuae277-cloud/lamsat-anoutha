import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Receipt,
  Package, Users, AlertTriangle, Warehouse, CreditCard, Banknote,
  RefreshCw, ShieldAlert, Percent, ArrowUpDown
} from "lucide-react";
import type { Branch } from "@shared/schema";

function omr(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "0.000";
  return parseFloat(String(v)).toFixed(3);
}

const PM_LABELS: Record<string, string> = {
  cash: "نقداً", card: "بطاقة", bank_transfer: "تحويل بنكي",
};
const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function formatDay(dateStr: string) {
  const d = new Date(dateStr);
  return DAY_NAMES[d.getDay()] || dateStr;
}

export default function ExecutivePlus() {
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const [branchId, setBranchId] = useState<string>("all");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const qs = branchId !== "all" ? `?branch_id=${branchId}` : "";
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/dashboard/executive-plus", branchId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/executive-plus${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `${res.status}`);
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground text-lg">غير مصرح — هذه الصفحة للإدارة فقط</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-destructive">{(error as Error).message}</p>
      </div>
    );
  }

  const d = data || {};
  const today = d.today || {};
  const vs = d.todayVsYesterday || {};
  const month = d.month || {};
  const paymentSplit = d.paymentSplit || [];
  const trend7d = d.trend7d || [];
  const topProfit = d.topProfitProducts7d || [];
  const cashiers = d.cashiersToday || [];
  const lowStock = d.lowStock || [];
  const invValue = d.inventoryValue || {};
  const risk = d.risk || {};
  const changePercent = vs.change_percent;
  const isUp = changePercent !== null && changePercent > 0;
  const isDown = changePercent !== null && changePercent < 0;

  const chartData = trend7d.map((t: any) => ({
    name: formatDay(t.day),
    revenue: t.revenue,
    profit: t.profit,
    margin: t.margin,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold" data-testid="text-exec-plus-title">لوحة الإدارة التنفيذية+</h1>
        <div className="min-w-[220px]">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger data-testid="select-exec-plus-branch">
              <SelectValue placeholder="كل الشركة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الشركة</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard icon={DollarSign} label="إيراد اليوم" value={`${omr(today.revenue)}`} sub="OMR" color="text-emerald-600" testId="kpi-plus-revenue" />
        <KpiCard icon={TrendingUp} label="ربح اليوم" value={`${omr(today.profit)}`} sub="OMR" color="text-blue-600" testId="kpi-plus-profit" />
        <KpiCard icon={Percent} label="هامش الربح" value={`${(today.margin_percent || 0).toFixed(1)}%`} color="text-purple-600" testId="kpi-plus-margin" />
        <KpiCard icon={Receipt} label="متوسط الفاتورة" value={`${omr(today.avg_invoice)}`} sub="OMR" color="text-amber-600" testId="kpi-plus-avg" />
        <KpiCard icon={Warehouse} label="قيمة المخزون" value={`${omr(invValue.value)}`} sub="OMR" color="text-indigo-600" testId="kpi-plus-inv" />
        <KpiCard icon={ArrowUpDown} label="دوران المخزون 30ي" value={`${(d.turnover_30d || 0).toFixed(2)}x`} color="text-cyan-600" testId="kpi-plus-turnover" />
        <KpiCard
          icon={ShieldAlert}
          label="بدون تكلفة بيع"
          value={`${risk.missing_cogs_today_pct || 0}%`}
          sub={`${risk.missing_cogs_today_count || 0}/${risk.missing_cogs_today_total || 0}`}
          color={risk.missing_cogs_today_pct > 0 ? "text-red-600" : "text-emerald-600"}
          testId="kpi-plus-missing-cogs"
        />
        <KpiCard
          icon={AlertTriangle}
          label="منتجات بدون سعر تكلفة"
          value={`${risk.missing_cost_pct || 0}%`}
          sub={`${risk.missing_cost_count || 0}/${risk.missing_cost_total || 0}`}
          color={risk.missing_cost_pct > 0 ? "text-orange-600" : "text-emerald-600"}
          testId="kpi-plus-missing-cost"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">اليوم مقابل أمس</p>
            <div className="flex items-center gap-3">
              {isUp && <TrendingUp className="w-6 h-6 text-emerald-500" />}
              {isDown && <TrendingDown className="w-6 h-6 text-red-500" />}
              {changePercent === null && <BarChart3 className="w-6 h-6 text-muted-foreground" />}
              <div>
                <p className="text-xl font-bold" data-testid="text-plus-vs-change">
                  {changePercent !== null ? `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%` : "لا توجد مبيعات أمس"}
                </p>
                <p className="text-xs text-muted-foreground">
                  اليوم: {omr(vs.today_sales)} | أمس: {omr(vs.yesterday_sales)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">إجمالي الشهر</p>
            <p className="text-xl font-bold text-emerald-700" data-testid="text-plus-month-rev">{omr(month.revenue)} OMR</p>
            <p className="text-xs text-muted-foreground">الربح: {omr(month.profit)} OMR</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-2">طرق الدفع اليوم</p>
            {paymentSplit.length === 0 ? (
              <p className="text-xs text-muted-foreground">لا توجد مبيعات</p>
            ) : (
              <div className="space-y-1.5">
                {paymentSplit.map((p: any) => (
                  <div key={p.payment_method} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      {p.payment_method === "cash" ? <Banknote className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                      {PM_LABELS[p.payment_method] || p.payment_method}
                    </span>
                    <span className="font-mono font-medium">{omr(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-5">
          <p className="text-sm font-bold mb-3">اتجاه 7 أيام — الإيراد / الربح / الهامش %</p>
          <div className="h-[280px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "margin") return [`${value.toFixed(1)}%`, "الهامش"];
                    return [`${value.toFixed(3)} OMR`, name === "revenue" ? "الإيراد" : "الربح"];
                  }}
                />
                <Legend formatter={(v: string) => v === "revenue" ? "الإيراد" : v === "profit" ? "الربح" : "الهامش %"} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#gradRev)" strokeWidth={2} name="revenue" />
                <Area yAxisId="left" type="monotone" dataKey="profit" stroke="#3b82f6" fill="url(#gradProfit)" strokeWidth={2} name="profit" />
                <Area yAxisId="right" type="monotone" dataKey="margin" stroke="#a855f7" fill="none" strokeWidth={2} strokeDasharray="5 3" name="margin" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-bold flex items-center gap-2">
              <Package className="w-4 h-4" />
              أعلى 3 منتجات ربحاً (7 أيام)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead className="text-center">الكمية</TableHead>
                  <TableHead className="text-center">الإيراد</TableHead>
                  <TableHead className="text-center">التكلفة</TableHead>
                  <TableHead className="text-center">الربح</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProfit.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : topProfit.map((p: any, i: number) => (
                  <TableRow key={p.product_id} data-testid={`row-top-profit-${p.product_id}`}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                        {p.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{p.qty_sold}</TableCell>
                    <TableCell className="text-center font-mono">{omr(p.revenue)}</TableCell>
                    <TableCell className="text-center font-mono text-muted-foreground">{omr(p.cogs)}</TableCell>
                    <TableCell className="text-center font-mono text-emerald-600 font-bold">{omr(p.profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-bold flex items-center gap-2">
              <Users className="w-4 h-4" />
              أداء الكاشير اليوم
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>الكاشير</TableHead>
                  <TableHead className="text-center">الفواتير</TableHead>
                  <TableHead className="text-center">الإيراد</TableHead>
                  <TableHead className="text-center">التكلفة</TableHead>
                  <TableHead className="text-center">الربح</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashiers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">لا يوجد</TableCell></TableRow>
                ) : cashiers.map((c: any) => (
                  <TableRow key={c.cashier_id} data-testid={`row-cashier-plus-${c.cashier_id}`}>
                    <TableCell className="font-medium">{c.cashier_name || "—"}</TableCell>
                    <TableCell className="text-center">{c.invoices_count}</TableCell>
                    <TableCell className="text-center font-mono">{omr(c.revenue)}</TableCell>
                    <TableCell className="text-center font-mono text-muted-foreground">{omr(c.cogs)}</TableCell>
                    <TableCell className="text-center font-mono text-emerald-600 font-bold">{omr(c.profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-card border border-red-200 shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-red-50/50">
            <h3 className="font-bold flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              أصناف منخفضة المخزون ({lowStock.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead className="text-center">الكمية الحالية</TableHead>
                  <TableHead className="text-center">حد إعادة الطلب</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((s: any) => (
                  <TableRow key={s.product_id} data-testid={`row-low-stock-plus-${s.product_id}`}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive" className="text-xs">{s.total_qty}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{s.reorder_level}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color, testId }: {
  icon: any; label: string; value: string; sub?: string; color: string; testId: string;
}) {
  return (
    <Card className="border-primary/10 hover:shadow-md transition-shadow">
      <CardContent className="p-3 text-center">
        <Icon className={`w-5 h-5 mx-auto mb-1.5 ${color}`} />
        <p className="text-[11px] text-muted-foreground mb-0.5 leading-tight">{label}</p>
        <p className="text-base font-bold leading-tight" data-testid={testId}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
