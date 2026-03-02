import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Receipt,
  Package, Users, AlertTriangle, Warehouse, CreditCard, Banknote, Building2
} from "lucide-react";
import type { Branch } from "@shared/schema";

function omr(v: number | string | null) {
  if (v === null || v === undefined) return "0.000";
  return parseFloat(String(v)).toFixed(3);
}

const PM_LABELS: Record<string, string> = {
  cash: "نقداً",
  card: "بطاقة",
  bank_transfer: "تحويل بنكي",
};

export default function Executive() {
  const { user } = useAuth();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const [branchId, setBranchId] = useState<string>("all");

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
        <h1 className="text-2xl font-bold" data-testid="text-executive-title">لوحة الإدارة التنفيذية</h1>
        <div className="min-w-[220px]">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger data-testid="select-exec-branch">
              <SelectValue placeholder="جميع الفروع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفروع (الشركة)</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard icon={DollarSign} label="إيراد اليوم" value={`${omr(today.revenue)} OMR`} color="text-emerald-600" testId="kpi-revenue" />
        <KpiCard icon={TrendingUp} label="ربح اليوم" value={`${omr(today.profit)} OMR`} color="text-blue-600" testId="kpi-profit" />
        <KpiCard icon={BarChart3} label="هامش الربح %" value={`${(today.margin_percent || 0).toFixed(1)}%`} color="text-purple-600" testId="kpi-margin" />
        <KpiCard icon={Receipt} label="متوسط الفاتورة" value={`${omr(today.avg_invoice)} OMR`} color="text-amber-600" testId="kpi-avg" />
        <KpiCard icon={Warehouse} label="قيمة المخزون" value={`${omr(inventoryValue.value)} OMR`} color="text-indigo-600" testId="kpi-inv-value" />
        <KpiCard icon={AlertTriangle} label="أصناف منخفضة" value={String(lowStock.length)} color="text-red-600" testId="kpi-low-stock" />
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
                <p className="text-xl font-bold" data-testid="text-vs-change">
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
            <p className="text-xl font-bold text-emerald-700" data-testid="text-month-revenue">{omr(month.revenue)} OMR</p>
            <p className="text-xs text-muted-foreground">الربح: {omr(month.profit)} OMR</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-2">طرق الدفع اليوم</p>
            {paymentSplit.length === 0 ? (
              <p className="text-xs text-muted-foreground">لا توجد مبيعات</p>
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
              أعلى 5 منتجات اليوم
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
                {topProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">لا توجد مبيعات اليوم</TableCell></TableRow>
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
