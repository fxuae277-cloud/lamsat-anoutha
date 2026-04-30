import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, AlertTriangle, Receipt, Store, Package, TrendingUp, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, parseServerError } from "@/lib/queryClient";
import { fmtTime } from "@/lib/formatters";
import { DateInput } from "@/components/ui/date-input";
import { useI18n } from "@/lib/i18n";

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt(v: string | number | undefined) {
  return parseFloat(String(v || "0")).toFixed(3);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// PAYMENT_AR replaced by t() calls in component

// ─── types ───────────────────────────────────────────────────────────────────
interface DashboardStats {
  todaySales: string;
  todayVat: string;
  todayOrderCount: number;
  lowStockCount: number;
  lowStockItems: { inventoryId: number; productName: string; warehouseName: string; quantity: number; minQuantity: number }[];
}

interface Sale {
  id: number;
  invoiceNumber: string;
  branchName: string;
  cashierName: string;
  total: string;
  paymentMethod: string;
  createdAt: string;
}

interface Shift {
  shift: { branchId: number; status: string } | null;
}

interface Branch {
  id: number;
  name: string;
}

// ─── component ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t, lang } = useI18n();
  const [filterFrom, setFilterFrom] = useState(today());
  const [filterTo, setFilterTo] = useState(today());
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");

  function getPaymentLabel(method: string): string {
    const map: Record<string, string> = {
      cash: t("dashboard.payment_cash"),
      bank: t("dashboard.payment_bank"),
      credit: t("dashboard.payment_deferred"),
      card: t("dashboard.payment_card"),
    };
    return map[method] ?? method;
  }

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: salesData, isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales", filterFrom, filterTo, filterBranch, filterPayment],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (filterFrom) p.set("from", filterFrom);
      if (filterTo) p.set("to", filterTo);
      if (filterBranch !== "all") p.set("branchId", filterBranch);
      if (filterPayment !== "all") p.set("paymentMethod", filterPayment);
      const res = await fetch(`/api/sales?${p.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(await parseServerError(res));
      return res.json();
    },
    select: (rows) => rows.slice(0, 20),
  });

  const { data: shiftData } = useQuery<Shift>({
    queryKey: ["/api/shifts/current"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const inventoryValue = allProducts.reduce((sum: number, p: any) => {
    const cost = parseFloat(p.avgCost || "0") || parseFloat(p.price || "0");
    return sum + cost * (p.totalStock ?? 0);
  }, 0);

  const activeBranch = shiftData?.shift
    ? branches?.find((b) => b.id === shiftData.shift!.branchId)?.name ?? "—"
    : "—";

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* page title */}
      <div>
        <h1 className="text-2xl font-bold">{t("dashboard.page_title")}</h1>
        <p className="text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* sales today */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.sales_today")}</CardTitle>
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <Receipt className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(stats?.todaySales)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("app.currency")}</p>
          </CardContent>
        </Card>

        {/* invoice count */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.invoices_count")}</CardTitle>
            <div className="p-2 bg-blue-50 rounded-full text-blue-500">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayOrderCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("dashboard.invoices_today")}</p>
          </CardContent>
        </Card>

        {/* low stock */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.low_stock")}</CardTitle>
            <div className="p-2 bg-red-50 rounded-full text-red-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.lowStockCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("dashboard.products_running_low")}</p>
          </CardContent>
        </Card>

        {/* stock value */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.stock_value")}</CardTitle>
            <div className="p-2 bg-emerald-50 rounded-full text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventoryValue.toFixed(3)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("app.currency")}</p>
          </CardContent>
        </Card>

        {/* active branch */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.active_branch")}</CardTitle>
            <div className="p-2 bg-emerald-50 rounded-full text-emerald-600">
              <Store className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{activeBranch}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {shiftData?.shift ? t("shifts.open") : t("shifts.no_shift")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* bottom: sales table + low stock alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* sales table with filters */}
        <Card className="col-span-1 lg:col-span-2 border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">{t("dashboard.recent_invoices")}</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <DateInput
                  value={filterFrom}
                  onChange={e => setFilterFrom(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
                <span className="text-xs text-muted-foreground">{t("app.to")}</span>
                <DateInput
                  value={filterTo}
                  onChange={e => setFilterTo(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("dashboard.all_branches")}</SelectItem>
                    {branches?.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}{(b as any).address ? " - " + (b as any).address : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterPayment} onValueChange={setFilterPayment}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("dashboard.all_payment")}</SelectItem>
                    <SelectItem value="cash">{t("dashboard.payment_cash")}</SelectItem>
                    <SelectItem value="bank">{t("dashboard.payment_bank")}</SelectItem>
                    <SelectItem value="credit">{t("dashboard.payment_deferred")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {salesData && (
              <p className="text-xs text-muted-foreground mt-1">
                {salesData.length} {t("dashboard.invoices_count")} —
                {t("dashboard.total")}: <span className="font-bold text-primary">
                  {salesData.reduce((s, r) => s + parseFloat(r.total || "0"), 0).toFixed(3)} {t("app.currency_short")}
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {salesLoading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
              </div>
            ) : !salesData?.length ? (
              <p className="text-center text-muted-foreground py-10">{t("dashboard.no_invoices")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t("dashboard.invoice_number")}</th>
                      <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t("dashboard.branch")}</th>
                      <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t("dashboard.cashier")}</th>
                      <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t("dashboard.payment_method")}</th>
                      <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t("dashboard.total")}</th>
                      <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t("dashboard.time")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.map((sale) => (
                      <tr key={sale.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs">{sale.invoiceNumber}</td>
                        <td className="py-3 px-4">{sale.branchName ?? "—"}</td>
                        <td className="py-3 px-4">{sale.cashierName ?? "—"}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs">
                            {getPaymentLabel(sale.paymentMethod)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-bold text-primary">{fmt(sale.total)} {t("app.currency_short")}</td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {fmtTime(sale.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* low stock alerts */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("dashboard.low_stock_items")}</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {!stats?.lowStockItems?.length ? (
              <p className="text-center text-muted-foreground py-8 text-sm">{t("dashboard.no_low_stock")}</p>
            ) : (
              <div className="space-y-3">
                {stats.lowStockItems.map((item) => (
                  <div key={item.inventoryId} className="flex flex-col gap-1 border-b last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{item.productName}</span>
                      <Badge className="bg-red-100 text-red-700 border-none text-xs">
                        {item.quantity} / {item.minQuantity}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.warehouseName}</span>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div
                        className="bg-red-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (item.quantity / item.minQuantity) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
