import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShoppingCart, AlertCircle, Receipt } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

const STATUS_MAP: Record<string, {label: string, color: string}> = {
  new: { label: "جديد", color: "bg-blue-100 text-blue-700" },
  preparing: { label: "تم التجهيز", color: "bg-orange-100 text-orange-700" },
  ready: { label: "جاهز للاستلام", color: "bg-emerald-100 text-emerald-700" },
  delivering: { label: "خرج للتوصيل", color: "bg-purple-100 text-purple-700" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-700" },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-700" },
};

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const chartData = (stats?.weeklySales || []).map((d: any) => {
    const dayIndex = new Date(d.date).getDay();
    return { name: DAY_NAMES[dayIndex], sales: parseFloat(d.total) };
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
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-dashboard-title">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على أداء فروع لمسة أنوثة اليوم.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm" data-testid="card-today-sales">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">مبيعات اليوم</CardTitle>
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <span className="text-xs font-bold">OMR</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-sales-total">
              {parseFloat(stats?.todaySales || "0").toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">ريال عماني</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm" data-testid="card-today-vat">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الضريبة (5%)</CardTitle>
            <div className="p-2 bg-blue-50 rounded-full text-blue-500">
              <Receipt className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-vat-total">
              {parseFloat(stats?.todayVat || "0").toFixed(3)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">ريال عماني</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm" data-testid="card-today-orders">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">عدد الطلبات</CardTitle>
            <div className="p-2 bg-orange-50 rounded-full text-orange-500">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-order-count">
              {stats?.todayOrderCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">فاتورة اليوم</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm" data-testid="card-low-stock">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">تنبيهات المخزون</CardTitle>
            <div className="p-2 bg-red-50 rounded-full text-red-500">
              <AlertCircle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-low-stock-count">
              {stats?.lowStockCount || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">منتجات قاربت على النفاذ</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle>المبيعات آخر 7 أيام</CardTitle>
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
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                لا توجد بيانات مبيعات بعد
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>أحدث الطلبات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(stats?.recentOrders || []).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد طلبات بعد</p>
              ) : (
                stats.recentOrders.map((order: any) => {
                  const s = STATUS_MAP[order.status] || STATUS_MAP["new"];
                  return (
                    <div key={order.id} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                      <div>
                        <p className="font-medium text-sm">طلب #{order.orderNumber}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{order.customerName} • {order.city}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-sm text-primary">{parseFloat(order.total || "0").toFixed(3)} OMR</p>
                        <Badge className={`${s.color} border-none shadow-none mt-1`}>{s.label}</Badge>
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
