import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
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

export default function ExecutivePlus() {
  const { data } = useAuth();
  const user = data?.user;
  const { t } = useI18n();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const [branchId, setBranchId] = useState<string>("all");

  const PM_LABELS: Record<string, string> = {
    cash: t("payment_methods.cash"), card: t("payment_methods.card"), bank_transfer: t("payment_methods.bank_transfer"),
  };
  const DAY_NAMES = [
    t("day_names.sun"), t("day_names.mon"), t("day_names.tue"),
    t("day_names.wed"), t("day_names.thu"), t("day_names.fri"), t("day_names.sat")
  ];

  function formatDay(dateStr: string) {
    const d = new Date(dateStr);
    return DAY_NAMES[d.getDay()] || dateStr;
  }

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
        <p className="text-muted-foreground text-lg">{t("executive_plus.unauthorized")}</p>
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
        <h1 className="text-2xl font-bold" data-testid="text-exec-plus-title">{t("executive_plus.title")}</h1>
        <div className="min-w-[220px]">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger data-testid="select-exec-plus-branch">
              <SelectValue placeholder={t("executive_plus.all_company")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("executive_plus.all_company")}</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard icon={DollarSign} label={t("executive_plus.revenue_today")} value={`${omr(today.revenue)}`} sub={t("common.omr")} color="text-emerald-600" testId="kpi-plus-revenue" />
        <KpiCard icon={TrendingUp} label={t("executive_plus.profit_today")} value={`${omr(today.profit)}`} sub={t("common.omr")} color="text-blue-600" testId="kpi-plus-profit" />
        <KpiCard icon={Percent} label={t("executive_plus.profit_margin")} value={`${(today.margin_percent || 0).toFixed(1)}%`} color="text-purple-600" testId="kpi-plus-margin" />
        <KpiCard icon={Receipt} label={t("executive_plus.avg_invoice")} value={`${omr(today.avg_invoice)}`} sub={t("common.omr")} color="text-amber-600" testId="kpi-plus-avg" />
        <KpiCard icon={Warehouse} label={t("executive_plus.inventory_value")} value={`${omr(invValue.value)}`} sub={t("common.omr")} color="text-indigo-600" testId="kpi-plus-inv" />
        <KpiCard icon={ArrowUpDown} label={t("executive_plus.turnover_30d")} value={`${(d.turnover_30d || 0).toFixed(2)}x`} color="text-cyan-600" testId="kpi-plus-turnover" />
        <KpiCard
          icon={ShieldAlert}
          label={t("executive_plus.missing_cogs")}
          value={`${risk.missing_cogs_today_pct || 0}%`}
          sub={`${risk.missing_cogs_today_count || 0}/${risk.missing_cogs_today_total || 0}`}
          color={risk.missing_cogs_today_pct > 0 ? "text-red-600" : "text-emerald-600"}
          testId="kpi-plus-missing-cogs"
        />
        <KpiCard
          icon={AlertTriangle}
          label={t("executive_plus.missing_cost_products")}
          value={`${risk.missing_cost_pct || 0}%`}
          sub={`${risk.missing_cost_count || 0}/${risk.missing_cost_total || 0}`}
          color={risk.missing_cost_pct > 0 ? "text-orange-600" : "text-emerald-600"}
          testId="kpi-plus-missing-cost"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{t("executive_plus.today_vs_yesterday")}</p>
            <div className="flex items-center gap-3">
              {isUp && <TrendingUp className="w-6 h-6 text-emerald-500" />}
              {isDown && <TrendingDown className="w-6 h-6 text-red-500" />}
              {changePercent === null && <BarChart3 className="w-6 h-6 text-muted-foreground" />}
              <div>
                <p className="text-xl font-bold" data-testid="text-plus-vs-change">
                  {changePercent !== null ? `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%` : t("executive_plus.no_sales_yesterday")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("executive_plus.today_label")} {omr(vs.today_sales)} | {t("executive_plus.yesterday_label")} {omr(vs.yesterday_sales)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{t("executive_plus.month_total")}</p>
            <p className="text-xl font-bold text-emerald-700" data-testid="text-plus-month-rev">{omr(month.revenue)} {t("common.omr")}</p>
            <p className="text-xs text-muted-foreground">{t("executive_plus.profit_label")} {omr(month.profit)} {t("common.omr")}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-2">{t("executive_plus.payment_methods_today")}</p>
            {paymentSplit.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("executive_plus.no_sales")}</p>
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
          <p className="text-sm font-bold mb-3">{t("executive_plus.trend_7d")}</p>
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
                    if (name === "margin") return [`${value.toFixed(1)}%`, t("executive_plus.chart_margin")];
                    return [`${value.toFixed(3)} ${t("common.omr")}`, name === "revenue" ? t("executive_plus.chart_revenue") : t("executive_plus.chart_profit")];
                  }}
                />
                <Legend formatter={(v: string) => v === "revenue" ? t("executive_plus.chart_revenue") : v === "profit" ? t("executive_plus.chart_profit") : t("executive_plus.chart_margin_pct")} />
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
              {t("executive_plus.top_3_profit")}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("executive_plus.table_product")}</TableHead>
                  <TableHead className="text-center">{t("executive_plus.table_qty")}</TableHead>
                  <TableHead className="text-center">{t("executive_plus.table_revenue")}</TableHead>
                  <TableHead className="text-center">{t("executive_plus.table_cost")}</TableHead>
                  <TableHead className="text-center">{t("executive_plus.table_profit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProfit.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("executive_plus.no_data")}</TableCell></TableRow>
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
              {t("executive_plus.cashier_performance")}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("executive_plus.table_cashier")}</TableHead>
                  <TableHead className="text-center">{t("executive_plus.table_invoices")}</TableHead>
                  <TableHead className="text-center">{t("executive_plus.table_revenue")}</TableHead>
                  <TableHead className="text-center">{t("executive_plus.table_cost")}</TableHead>
                  <TableHead className="text-center">{t("executive_plus.table_profit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashiers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("executive_plus.none")}</TableCell></TableRow>
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
              {t("executive_plus.low_stock_title").replace("{0}", lowStock.length.toString())}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("executive_plus.table_product")}</TableHead>
                  <TableHead className="text-center">{t("executive_plus.table_current_qty")}</TableHead>
                  <TableHead className="text-center">{t("executive_plus.table_reorder_level")}</TableHead>
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
