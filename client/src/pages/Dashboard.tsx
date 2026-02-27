import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Binoculars, ShoppingCart, AlertCircle, Receipt } from "lucide-react";

const data = [
  { name: 'السبت', sales: 400 },
  { name: 'الأحد', sales: 300 },
  { name: 'الإثنين', sales: 550 },
  { name: 'الثلاثاء', sales: 450 },
  { name: 'الأربعاء', sales: 700 },
  { name: 'الخميس', sales: 850 },
  { name: 'الجمعة', sales: 1200 },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على أداء فروع لمسة أنوثة اليوم.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">مبيعات اليوم</CardTitle>
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <span className="text-xs font-bold">OMR</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,250.000</div>
            <p className="text-xs text-emerald-500 mt-1 flex items-center">
              +15% مقارنة بالأمس
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الضريبة (5%)</CardTitle>
            <div className="p-2 bg-blue-50 rounded-full text-blue-500">
              <Receipt className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">62.500</div>
            <p className="text-xs text-muted-foreground mt-1">ريال عماني</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">عدد الطلبات</CardTitle>
            <div className="p-2 bg-orange-50 rounded-full text-orange-500">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground mt-1">طلب جديد اليوم</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">تنبيهات المخزون</CardTitle>
            <div className="p-2 bg-red-50 rounded-full text-red-500">
              <AlertCircle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">8</div>
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
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: 'hsl(var(--foreground))', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>أحدث الطلبات (واتساب)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">طلب #{1020 + i}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">سارة أحمد • صحار</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-primary">24.500 OMR</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px]">قيد التجهيز</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
