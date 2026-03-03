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
  TrendingUp, TrendingDown, DollarSign, BarChart3, Receipt,
  Package, Users, AlertTriangle, Warehouse, CreditCard, Banknote, Building2
} from "lucide-react";
import type { Branch } from "@shared/schema";

function omr(v: number | string | null) {
  if (v === null || v === undefined) return "0.000";
  return parseFloat(String(v)).toFixed(3);
}

export default function Executive() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const [branchId, setBranchId] = useState<string>("all");

  const PM_LABELS: Record<string, string> = {
    cash: t("payment_methods.cash"),
    card: t("payment_methods.card"),
    bank_transfer: t("payment_methods.bank_transfer"),
  };

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const qs = branchId !== "all" ? `?branch_id=${branchId}` : "";
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/dashboard/executive", branchId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/executive${qs}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `${res.status}`);
      }
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground text-lg">{t("executive.unauthorized")}</p>
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
  const topProducts = d.topProducts || [];
  const cashiers = d.cashiers || [];
  const lowStock = d.lowStock || [];
  const inventoryValue = d.inventoryValue || {};

  const changePercent = vs.change_percent;
  const isUp = changePercent !== null && changePercent > 0;
  const isDown = changePercent !== null && changePercent < 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold" data-testid="text-executive-title">{t("executive.title")}</h1>
        <div className="min-w-[220px]">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger data-testid="select-exec-branch">
              <SelectValue placeholder={t("executive.all_branches")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("executive.all_branches")}</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard icon={DollarSign} label={t("executive.revenue_today")} value={`${omr(today.revenue)} ${t("common.omr")}`} color="text-emerald-600" testId="kpi-revenue" />
        <KpiCard icon={TrendingUp} label={t("executive.profit_today")} value={`${omr(today.profit)} ${t("common.omr")}`} color="text-blue-600" testId="kpi-profit" />
        <KpiCard icon={BarChart3} label={t("executive.margin_pct")} value={`${(today.margin_percent || 0).toFixed(1)}%`} color="text-purple-600" testId="kpi-margin" />
        <KpiCard icon={Receipt} label={t("executive.avg_invoice")} value={`${omr(today.avg_invoice)} ${t("common.omr")}`} color="text-amber-600" testId="kpi-avg" />
        <KpiCard icon={Warehouse} label={t("executive.inventory_value")} value={`${omr(inventoryValue.value)} ${t("common.omr")}`} color="text-indigo-600" testId="kpi-inv-value" />
        <KpiCard icon={AlertTriangle} label={t("executive.low_stock_items")} value={String(lowStock.length)} color="text-red-600" testId="kpi-low-stock" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{t("executive.today_vs_yesterday")}</p>
            <div className="flex items-center gap-3">
              {isUp && <TrendingUp className="w-6 h-6 text-emerald-500" />}
              {isDown && <TrendingDown className="w-6 h-6 text-red-500" />}
              {changePercent === null && <BarChart3 className="w-6 h-6 text-muted-foreground" />}
              <div>
                <p className="text-xl font-bold" data-testid="text-vs-change">
                  {changePercent !== null ? `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%` : t("executive.no_sales_yesterday")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("executive.today_label")} {omr(vs.today_sales)} | {t("executive.yesterday_label")} {omr(vs.yesterday_sales)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{t("executive.month_total")}</p>
            <p className="text-xl font-bold text-emerald-700" data-testid="text-month-revenue">{omr(month.revenue)} {t("common.omr")}</p>
            <p className="text-xs text-muted-foreground">{t("executive.profit_label")} {omr(month.profit)} {t("common.omr")}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-2">{t("executive.payment_methods_today")}</p>
            {paymentSplit.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("executive.no_sales")}</p>
            ) : (
              <div className="space-y-1">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-bold flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t("executive.top_5_products")}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("executive.table_product")}</TableHead>
                  <TableHead className="text-center">{t("executive.table_qty")}</TableHead>
                  <TableHead className="text-center">{t("executive.table_revenue")}</TableHead>
                  <TableHead className="text-center">{t("executive.table_cost")}</TableHead>
                  <TableHead className="text-center">{t("executive.table_profit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("executive.no_sales_today")}</TableCell></TableRow>
                ) : topProducts.map((p: any) => (
                  <TableRow key={p.product_id} data-testid={`row-top-product-${p.product_id}`}>
                    <TableCell className="font-medium">{p.name}</TableCell>
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
              {t("executive.cashier_performance")}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("executive.table_cashier")}</TableHead>
                  <TableHead className="text-center">{t("executive.table_invoices")}</TableHead>
                  <TableHead className="text-center">{t("executive.table_revenue")}</TableHead>
                  <TableHead className="text-center">{t("executive.table_cost")}</TableHead>
                  <TableHead className="text-center">{t("executive.table_profit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashiers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("executive.none")}</TableCell></TableRow>
                ) : cashiers.map((c: any) => (
                  <TableRow key={c.cashier_id} data-testid={`row-cashier-${c.cashier_id}`}>
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
              {t("executive.low_stock_title").replace("{0}", lowStock.length.toString())}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("executive.table_product")}</TableHead>
                  <TableHead className="text-center">{t("executive.table_current_qty")}</TableHead>
                  <TableHead className="text-center">{t("executive.table_reorder_level")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((s: any) => (
                  <TableRow key={s.product_id} data-testid={`row-low-stock-${s.product_id}`}>
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

function KpiCard({ icon: Icon, label, value, color, testId }: {
  icon: any; label: string; value: string; color: string; testId: string;
}) {
  return (
    <Card className="border-primary/10 hover:shadow-md transition-shadow">
      <CardContent className="p-4 text-center">
        <Icon className={`w-6 h-6 mx-auto mb-2 ${color}`} />
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-bold" data-testid={testId}>{value}</p>
      </CardContent>
    </Card>
  );
}
