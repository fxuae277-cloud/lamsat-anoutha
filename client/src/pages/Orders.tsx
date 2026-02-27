import { Plus, Search, MapPin, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const orders = [
  { id: "ORD-1025", customer: "سارة أحمد", phone: "96891234567", city: "صحار", branch: "لوى", type: "توصيل", status: "جديد", total: 24.500, date: "اليوم 10:30 ص" },
  { id: "ORD-1024", customer: "منى البلوشي", phone: "96899876543", city: "شناص", branch: "شناص", type: "استلام من الفرع", status: "تم التجهيز", total: 12.000, date: "اليوم 09:15 ص" },
  { id: "ORD-1023", customer: "مريم العجمي", phone: "96891112222", city: "مسقط", branch: "الرئيسي", type: "توصيل خارجي", status: "خرج للتوصيل", total: 45.000, date: "الأمس" },
];

const getStatusBadge = (status: string) => {
  switch(status) {
    case "جديد": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none shadow-none">جديد</Badge>;
    case "تم التجهيز": return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none shadow-none">تم التجهيز</Badge>;
    case "خرج للتوصيل": return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none shadow-none">خرج للتوصيل</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export default function Orders() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">طلبات السوشيال ميديا</h1>
          <p className="text-muted-foreground mt-1">إدارة طلبات واتساب وانستجرام وتوجيهها للفروع للتجهيز.</p>
        </div>
        
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          إدخال طلب جديد
        </Button>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-4 items-center bg-muted/20">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث برقم الطلب، اسم العميل، جوال..." className="pr-9 bg-background" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-40 bg-background"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="new">جديد</SelectItem>
              <SelectItem value="ready">تم التجهيز</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all-branches">
            <SelectTrigger className="w-40 bg-background"><SelectValue placeholder="الفرع الموجه" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all-branches">كل الفروع</SelectItem>
              <SelectItem value="liwa">لوى</SelectItem>
              <SelectItem value="shinas">شناص</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="divide-y">
          {orders.map((order) => (
            <div key={order.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{order.id}</h3>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="text-foreground font-medium">{order.customer}</span></span>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {order.phone}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {order.city}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-6 md:justify-end">
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">موجه لفرع:</p>
                  <p className="font-medium text-sm">{order.branch}</p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-muted-foreground">نوع التسليم:</p>
                  <p className="font-medium text-sm">{order.type}</p>
                </div>
                <div className="text-left border-r pr-4 border-border">
                  <p className="text-xs text-muted-foreground">القيمة:</p>
                  <p className="font-bold text-lg text-primary">{order.total.toFixed(3)} OMR</p>
                </div>
                <div>
                  <Button variant="outline" size="sm">تحديث الحالة</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
