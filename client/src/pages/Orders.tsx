import { useState } from "react";
import { Plus, Search, MapPin, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order, Branch, City } from "@shared/schema";

const STATUS_MAP: Record<string, {label: string, color: string}> = {
  new: { label: "جديد", color: "bg-blue-100 text-blue-700" },
  preparing: { label: "تم التجهيز", color: "bg-orange-100 text-orange-700" },
  ready: { label: "جاهز للاستلام", color: "bg-emerald-100 text-emerald-700" },
  delivering: { label: "خرج للتوصيل", color: "bg-purple-100 text-purple-700" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-700" },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-700" },
};

const ORDER_STATUSES = Object.entries(STATUS_MAP);

export default function Orders() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [newOrder, setNewOrder] = useState({ customerName: "", customerPhone: "", city: "", address: "", deliveryType: "pickup", total: "", notes: "" });

  const { data: ordersList = [] } = useQuery<Order[]>({ queryKey: ["/api/orders"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: branchesList = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: citiesList = [] } = useQuery<City[]>({ queryKey: ["/api/cities"], queryFn: getQueryFn({ on401: "throw" }) });

  const filtered = ordersList.filter(o => {
    const matchSearch = !search || o.orderNumber.includes(search) || o.customerName.includes(search) || (o.customerPhone && o.customerPhone.includes(search));
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const branchMap = Object.fromEntries(branchesList.map(b => [b.id, b.name]));

  const createMutation = useMutation({
    mutationFn: async () => {
      const cityMatch = citiesList.find(c => c.name === newOrder.city);
      const branchId = cityMatch?.branchId || branchesList[0]?.id;
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      await apiRequest("POST", "/api/orders", {
        ...newOrder,
        orderNumber,
        branchId,
        status: "new",
        items: [],
      });
    },
    onSuccess: () => {
      toast({ title: "تم إنشاء الطلب" });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setAddOpen(false);
      setNewOrder({ customerName: "", customerPhone: "", city: "", address: "", deliveryType: "pickup", total: "", notes: "" });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/orders/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-orders-title">طلبات السوشيال ميديا</h1>
          <p className="text-muted-foreground mt-1">إدارة طلبات واتساب وانستجرام وتوجيهها للفروع.</p>
        </div>
        
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-order">
              <Plus className="w-4 h-4" />
              إدخال طلب جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>طلب جديد</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">اسم العميل</label>
                  <Input value={newOrder.customerName} onChange={e => setNewOrder({...newOrder, customerName: e.target.value})} data-testid="input-order-customer" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">رقم الجوال</label>
                  <Input value={newOrder.customerPhone} onChange={e => setNewOrder({...newOrder, customerPhone: e.target.value})} data-testid="input-order-phone" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">المدينة</label>
                  <Select value={newOrder.city} onValueChange={v => setNewOrder({...newOrder, city: v})}>
                    <SelectTrigger><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                    <SelectContent>
                      {citiesList.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">نوع التسليم</label>
                  <Select value={newOrder.deliveryType} onValueChange={v => setNewOrder({...newOrder, deliveryType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">استلام من الفرع</SelectItem>
                      <SelectItem value="delivery">توصيل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">العنوان</label>
                <Input value={newOrder.address} onChange={e => setNewOrder({...newOrder, address: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">المبلغ (OMR)</label>
                <Input type="number" step="0.001" value={newOrder.total} onChange={e => setNewOrder({...newOrder, total: e.target.value})} data-testid="input-order-total" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ملاحظات</label>
                <Input value={newOrder.notes} onChange={e => setNewOrder({...newOrder, notes: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newOrder.customerName} data-testid="button-save-order">
                {createMutation.isPending ? "جارِ الحفظ..." : "حفظ الطلب"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-4 items-center bg-muted/20">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث برقم الطلب، اسم العميل، جوال..." className="pr-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-orders" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-background"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {ORDER_STATUSES.map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="divide-y">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">لا توجد طلبات</div>
          ) : filtered.map((order) => {
            const s = STATUS_MAP[order.status || "new"] || STATUS_MAP["new"];
            return (
              <div key={order.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4" data-testid={`card-order-${order.id}`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">{order.orderNumber}</h3>
                      <Badge className={`${s.color} border-none shadow-none`}>{s.label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      <span className="text-foreground font-medium">{order.customerName}</span>
                      {order.customerPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {order.customerPhone}</span>}
                      {order.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {order.city}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 md:justify-end">
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">الفرع:</p>
                    <p className="font-medium text-sm">{order.branchId ? branchMap[order.branchId] || "-" : "-"}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">التسليم:</p>
                    <p className="font-medium text-sm">{order.deliveryType === "delivery" ? "توصيل" : "استلام"}</p>
                  </div>
                  <div className="text-left border-r pr-4 border-border">
                    <p className="text-xs text-muted-foreground">القيمة:</p>
                    <p className="font-bold text-lg text-primary">{parseFloat(order.total || "0").toFixed(3)} OMR</p>
                  </div>
                  <div>
                    <Select value={order.status || "new"} onValueChange={v => updateStatusMutation.mutate({ id: order.id, status: v })}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map(([key, val]) => (
                          <SelectItem key={key} value={key}>{val.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
