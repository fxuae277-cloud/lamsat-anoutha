import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShoppingCart, AlertCircle, Receipt } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

const STATUS_MAP: Record<string, {labelKey: string, color: string}> = {
  new: { labelKey: "status_labels.new", color: "bg-blue-100 text-blue-700" },
  preparing: { labelKey: "status_labels.preparing", color: "bg-orange-100 text-orange-700" },
  ready: { labelKey: "status_labels.ready", color: "bg-emerald-100 text-emerald-700" },
  delivering: { labelKey: "status_labels.delivering", color: "bg-purple-100 text-purple-700" },
  completed: { labelKey: "status_labels.completed", color: "bg-green-100 text-green-700" },
  cancelled: { labelKey: "status_labels.cancelled", color: "bg-red-100 text-red-700" },
};

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const DAY_NAMES = [
    t("day_names.sun"),
    t("day_names.mon"),
    t("day_names.tue"),
    t("day_names.wed"),
    t("day_names.thu"),
    t("day_names.fri"),
    t("day_names.sat")
  ];

  const chartData = (stats?.weeklySales || []).map((d: any) => {
    const date = new Date(d.date);
    const dayIndex = date.getDay();
    const formattedDate = date.toLocaleDateString(lang === "ar" ? "ar-OM" : "en-US", { month: 'short', day: 'numeric' });
    return { 
      name: DAY_NAMES[dayIndex], 
      date: formattedDate,
      sales: parseFloat(d.total) 
    };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-dashboard-title">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm" data-testid="card-today-sales">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.today_sales")}</CardTitle>
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <span className="text-xs font-bold">{t("common.omr")}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-sales-total">
              {parseFloat(stats?.todaySales || "0").toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("common.omr_currency")}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm" data-testid="card-today-vat">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.total_vat")}</CardTitle>
            <div className="p-2 bg-blue-50 rounded-full text-blue-500">
              <Receipt className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-vat-total">
              {parseFloat(stats?.todayVat || "0").toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("common.omr_currency")}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm" data-testid="card-today-orders">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.order_count")}</CardTitle>
            <div className="p-2 bg-orange-50 rounded-full text-orange-500">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-order-count">
              {stats?.todayOrderCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("dashboard.invoices_today")}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm" data-testid="card-low-stock">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.stock_alerts")}</CardTitle>
            <div className="p-2 bg-red-50 rounded-full text-red-500">
              <AlertCircle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-low-stock-count">
              {stats?.lowStockCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("dashboard.products_running_low")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle>{t("dashboard.sales_last_7_days")}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    labelFormatter={(value, payload) => {
                      if (payload && payload.length > 0) {
                        return `${payload[0].payload.name} (${payload[0].payload.date})`;
                      }
                      return value;
                    }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', direction: lang === 'ar' ? 'rtl' : 'ltr' }} 
                  />
                  <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                {t("dashboard.no_sales_data")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>{t("dashboard.recent_orders")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(stats?.recentOrders || []).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("dashboard.no_orders_yet")}</p>
              ) : (
                stats.recentOrders.map((order: any) => {
                  const s = STATUS_MAP[order.status] || STATUS_MAP["new"];
                  return (
                    <div key={order.id} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                      <div>
                        <p className="font-medium text-sm">{t("dashboard.order_number").replace("{0}", order.orderNumber)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{order.customerName} • {order.city}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-primary">{parseFloat(order.total || "0").toFixed(3)} {t("common.omr")}</p>
                        <Badge className={`${s.color} border-none shadow-none mt-1`}>{t(s.labelKey)}</Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
