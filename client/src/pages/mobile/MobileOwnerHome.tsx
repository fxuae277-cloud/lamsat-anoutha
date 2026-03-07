import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, TrendingUp, ReceiptText, ShoppingCart, AlertTriangle,
  Package, ArrowRightLeft, ClipboardCheck, Camera, Loader2, BarChart3,
  Clock, Boxes, Store
} from "lucide-react";

type DashboardData = {
  kpi: {
    todaySales: number; monthSales: number; invoiceCount: number;
    avgInvoice: number; grossProfit: number; expenses: number;
    netCash: number; openShifts: number; lowStock: number;
    outOfStock: number; pendingTransfers: number; branchCount: number;
  };
  branches: { id: number; name: string }[];
  topProducts: { name: string; qty: string; total: number }[];
  branchPerformance: { branch_name: string; total: number }[];
  recentOps: { description: string; created_at: string; table_name: string }[];
  timeseries: { date: string; sales: number }[];
};

export default function MobileOwnerHome() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [branchId, setBranchId] = useState<string>("all");
  const [period, setPeriod] = useState("today");

  const queryStr = `/api/mobile/owner/dashboard?period=${period}${branchId !== "all" ? `&branchId=${branchId}` : ""}`;
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: [queryStr],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpi = data?.kpi;

  return (
    <div className="p-4 pb-24 space-y-4" dir="rtl">
      <div className="flex gap-2">
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="flex-1 h-10" data-testid="select-branch-filter">
            <SelectValue placeholder={t("mobile.all_branches")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("mobile.all_branches")}</SelectItem>
            {data?.branches?.map(b => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-28 h-10" data-testid="select-period-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t("mobile.today")}</SelectItem>
            <SelectItem value="7days">{t("mobile.7days")}</SelectItem>
            <SelectItem value="30days">{t("mobile.30days")}</SelectItem>
            <SelectItem value="month">{t("mobile.this_month")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-3 text-center">
            <DollarSign className="w-6 h-6 mx-auto mb-1 opacity-80" />
            <p className="text-xl font-bold" data-testid="text-today-sales">{(kpi?.todaySales || 0).toFixed(3)}</p>
            <p className="text-xs opacity-80">{t("mobile.today_sales")}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-3 text-center">
            <BarChart3 className="w-6 h-6 mx-auto mb-1 opacity-80" />
            <p className="text-xl font-bold" data-testid="text-month-sales">{(kpi?.monthSales || 0).toFixed(3)}</p>
            <p className="text-xs opacity-80">{t("mobile.month_sales")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <ReceiptText className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{kpi?.invoiceCount || 0}</p>
            <p className="text-xs text-muted-foreground">{t("mobile.invoices")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
            <p className="text-lg font-bold">{(kpi?.grossProfit || 0).toFixed(3)}</p>
            <p className="text-xs text-muted-foreground">{t("mobile.profit")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold">{(kpi?.avgInvoice || 0).toFixed(3)}</p>
            <p className="text-[10px] text-muted-foreground">{t("mobile.avg_invoice")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold">{(kpi?.expenses || 0).toFixed(3)}</p>
            <p className="text-[10px] text-muted-foreground">{t("mobile.expenses")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold">{(kpi?.netCash || 0).toFixed(3)}</p>
            <p className="text-[10px] text-muted-foreground">{t("mobile.net_cash")}</p>
          </CardContent>
        </Card>
      </div>

      {((kpi?.lowStock || 0) > 0 || (kpi?.outOfStock || 0) > 0 || (kpi?.pendingTransfers || 0) > 0) && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-3 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-orange-600" /> {t("mobile.alerts")}</p>
            <div className="flex flex-wrap gap-2">
              {(kpi?.lowStock || 0) > 0 && <Badge variant="outline" className="gap-1"><Package className="w-3 h-3" /> {t("mobile.low_stock")}: {kpi?.lowStock}</Badge>}
              {(kpi?.outOfStock || 0) > 0 && <Badge variant="destructive" className="gap-1"><Boxes className="w-3 h-3" /> {t("mobile.out_of_stock")}: {kpi?.outOfStock}</Badge>}
              {(kpi?.pendingTransfers || 0) > 0 && <Badge variant="outline" className="gap-1"><ArrowRightLeft className="w-3 h-3" /> {t("mobile.pending_transfers")}: {kpi?.pendingTransfers}</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{t("mobile.open_shifts")}: {kpi?.openShifts || 0}</span>
        <span className="text-xs text-muted-foreground mr-auto"><Store className="w-3 h-3 inline" /> {kpi?.branchCount || 0} {t("mobile.branches")}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Button variant="outline" className="h-16 flex-col gap-1 text-xs" onClick={() => setLocation("/m/purchases")} data-testid="button-quick-purchase">
          <ShoppingCart className="w-5 h-5" />
          {t("mobile.purchase")}
        </Button>
        <Button variant="outline" className="h-16 flex-col gap-1 text-xs" onClick={() => setLocation("/m/transfers")} data-testid="button-quick-transfer">
          <ArrowRightLeft className="w-5 h-5" />
          {t("mobile.transfer")}
        </Button>
        <Button variant="outline" className="h-16 flex-col gap-1 text-xs" onClick={() => setLocation("/m/stocktake")} data-testid="button-quick-stocktake">
          <ClipboardCheck className="w-5 h-5" />
          {t("mobile.stocktake")}
        </Button>
        <Button variant="outline" className="h-16 flex-col gap-1 text-xs" onClick={() => setLocation("/m/pos")} data-testid="button-quick-scan">
          <Camera className="w-5 h-5" />
          {t("mobile.scan")}
        </Button>
      </div>

      {data?.topProducts && data.topProducts.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="font-semibold text-sm mb-2">{t("mobile.top_products")}</p>
            {data.topProducts.map((p, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0">
                <span className="text-sm">{i + 1}. {p.name}</span>
                <span className="text-sm font-bold text-primary">{(p.total || 0).toFixed(3)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data?.branchPerformance && data.branchPerformance.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="font-semibold text-sm mb-2">{t("mobile.branch_performance")}</p>
            {data.branchPerformance.map((b, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0">
                <span className="text-sm">{b.branch_name}</span>
                <span className="text-sm font-bold">{(b.total || 0).toFixed(3)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
