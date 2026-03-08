import { useState } from "react";
import { Plus, Search, MapPin, Phone, MessageCircle, Eye, Clock, Package, CheckCircle2, XCircle, ChefHat, Truck, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order, Branch, City } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

function fmt(v: string | number | null | undefined) {
  return parseFloat(String(v || "0")).toFixed(3);
}

export default function Orders() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const locale = "en-US";

  const isManager = ["owner", "admin", "manager"].includes(user?.role || "");

  const STATUS_MAP: Record<string, {label: string, color: string, icon: any}> = {
    new: { label: t("status_labels.new"), color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
    preparing: { label: t("status_labels.preparing"), color: "bg-orange-100 text-orange-700 border-orange-200", icon: ChefHat },
    ready: { label: t("status_labels.ready"), color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Package },
    delivering: { label: t("status_labels.delivering"), color: "bg-purple-100 text-purple-700 border-purple-200", icon: Truck },
    completed: { label: t("status_labels.completed"), color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
    cancelled: { label: t("status_labels.cancelled"), color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  };

  const ORDER_STATUSES = Object.entries(STATUS_MAP);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newOrder, setNewOrder] = useState({ customerName: "", customerPhone: "", city: "", address: "", deliveryType: "pickup", total: "", notes: "" });

  const queryKey = branchFilter !== "all" ? ["/api/orders", { branchId: branchFilter }] : ["/api/orders"];
  const { data: ordersList = [] } = useQuery<Order[]>({
    queryKey,
    queryFn: async () => {
      const url = branchFilter !== "all" ? `/api/orders?branchId=${branchFilter}` : "/api/orders";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load orders");
      return res.json();
    },
  });
  const { data: branchesList = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: citiesList = [] } = useQuery<City[]>({ queryKey: ["/api/cities"], queryFn: getQueryFn({ on401: "throw" }) });

  const filtered = ordersList.filter(o => {
    const matchSearch = !search || 
      o.orderNumber?.toLowerCase().includes(search.toLowerCase()) || 
      o.customerName?.toLowerCase().includes(search.toLowerCase()) || 
      (o.customerPhone && o.customerPhone.includes(search));
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const branchMap = Object.fromEntries(branchesList.map(b => [b.id, b.name]));

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = ordersList.filter(o => o.createdAt && new Date(o.createdAt).toISOString().slice(0, 10) === todayStr);
  const stats = {
    total: todayOrders.length,
    newCount: todayOrders.filter(o => o.status === "new").length,
    preparing: todayOrders.filter(o => o.status === "preparing").length,
    ready: todayOrders.filter(o => o.status === "ready").length,
    completed: todayOrders.filter(o => o.status === "completed").length,
    cancelled: todayOrders.filter(o => o.status === "cancelled").length,
  };

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
      toast({ title: t("orders.order_created") });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setAddOpen(false);
      setNewOrder({ customerName: "", customerPhone: "", city: "", address: "", deliveryType: "pickup", total: "", notes: "" });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
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

  const openDetail = async (orderId: number) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: "include" });
      const data = await res.json();
      setDetailOrder(data);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
    setDetailLoading(false);
  };

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/[\s\-\+]/g, "");
    const finalPhone = cleaned.startsWith("968") ? cleaned : `968${cleaned}`;
    window.open(`https://wa.me/${finalPhone}`, "_blank");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-orders-title">{t("orders.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("orders.subtitle")}</p>
        </div>
        
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-order">
              <Plus className="w-4 h-4" />
              {t("orders.add_order")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t("orders.new_order")}</DialogTitle>
              <DialogDescription>{t("orders.new_order_desc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("orders.customer_name")} <span className="text-red-500">*</span></label>
                  <Input value={newOrder.customerName} onChange={e => setNewOrder({...newOrder, customerName: e.target.value})} data-testid="input-order-customer" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("orders.phone")}</label>
                  <Input value={newOrder.customerPhone} onChange={e => setNewOrder({...newOrder, customerPhone: e.target.value})} data-testid="input-order-phone" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("orders.city")}</label>
                  <Select value={newOrder.city} onValueChange={v => setNewOrder({...newOrder, city: v})}>
                    <SelectTrigger><SelectValue placeholder={t("orders.select_city")} /></SelectTrigger>
                    <SelectContent>
                      {citiesList.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("orders.delivery_type")}</label>
                  <Select value={newOrder.deliveryType} onValueChange={v => setNewOrder({...newOrder, deliveryType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pickup">{t("orders.pickup")}</SelectItem>
                      <SelectItem value="delivery">{t("orders.delivery")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("orders.address")}</label>
                <Input value={newOrder.address} onChange={e => setNewOrder({...newOrder, address: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("orders.amount_omr")}</label>
                <Input type="number" step="0.001" value={newOrder.total} onChange={e => setNewOrder({...newOrder, total: e.target.value})} data-testid="input-order-total" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("orders.notes")}</label>
                <Input value={newOrder.notes} onChange={e => setNewOrder({...newOrder, notes: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newOrder.customerName} data-testid="button-save-order">
                {createMutation.isPending ? t("orders.saving_order") : t("orders.save_order")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("orders.stats_today")}</p>
            <p className="text-2xl font-bold text-blue-700" data-testid="text-stats-total">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("status_labels.new")}</p>
            <p className="text-2xl font-bold text-yellow-700" data-testid="text-stats-new">{stats.newCount}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("status_labels.preparing")}</p>
            <p className="text-2xl font-bold text-orange-700" data-testid="text-stats-preparing">{stats.preparing}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("status_labels.ready")}</p>
            <p className="text-2xl font-bold text-emerald-700" data-testid="text-stats-ready">{stats.ready}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("status_labels.completed")}</p>
            <p className="text-2xl font-bold text-green-700" data-testid="text-stats-completed">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">{t("status_labels.cancelled")}</p>
            <p className="text-2xl font-bold text-red-700" data-testid="text-stats-cancelled">{stats.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-3 items-center bg-muted/20">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
            <Input 
              placeholder={t("orders.search_placeholder")} 
              className={`${lang === "ar" ? "pr-9" : "pl-9"} bg-background`} 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              data-testid="input-search-orders" 
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-background" data-testid="select-status-filter">
              <SelectValue placeholder={t("orders.status_filter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders.all_statuses")}</SelectItem>
              {ORDER_STATUSES.map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isManager && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-44 bg-background" data-testid="select-branch-filter">
                <SelectValue placeholder={t("orders.all_branches")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("orders.all_branches")}</SelectItem>
                {branchesList.map(b => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        <div className="divide-y">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t("orders.no_orders")}</p>
            </div>
          ) : filtered.map((order) => {
            const s = STATUS_MAP[order.status || "new"] || STATUS_MAP["new"];
            const StatusIcon = s.icon;
            const orderTime = order.createdAt ? new Date(order.createdAt).toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
            return (
              <div key={order.id} className="p-4 hover:bg-muted/30 transition-colors" data-testid={`card-order-${order.id}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold">{order.orderNumber}</h3>
                        <Badge className={`${s.color} border shadow-none text-xs`}>{s.label}</Badge>
                        {order.deliveryType === "delivery" ? (
                          <Badge variant="outline" className="text-xs gap-1"><Truck className="w-3 h-3" />{t("orders.delivery")}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs gap-1"><Store className="w-3 h-3" />{t("orders.pickup")}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">{order.customerName}</span>
                        {order.customerPhone && (
                          <button 
                            className="flex items-center gap-1 hover:text-green-600 transition-colors"
                            onClick={() => openWhatsApp(order.customerPhone!)}
                            data-testid={`button-whatsapp-${order.id}`}
                          >
                            <Phone className="w-3 h-3" /> {order.customerPhone}
                          </button>
                        )}
                        {order.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {order.city}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {orderTime}</span>
                      </div>
                      {order.branchId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <Store className="w-3 h-3 inline" /> {branchMap[order.branchId] || "-"}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 md:justify-end shrink-0">
                    <div className="text-center px-3">
                      <p className="font-bold text-lg text-primary">{fmt(order.total)} <span className="text-xs font-normal">{t("common.omr")}</span></p>
                    </div>

                    <Select value={order.status || "new"} onValueChange={v => updateStatusMutation.mutate({ id: order.id, status: v })}>
                      <SelectTrigger className="w-36" data-testid={`select-status-${order.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map(([key, val]) => (
                          <SelectItem key={key} value={key}>{val.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openDetail(order.id)} data-testid={`button-detail-${order.id}`}>
                      <Eye className="w-4 h-4" />
                      {t("orders.details")}
                    </Button>

                    {order.customerPhone && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => openWhatsApp(order.customerPhone!)}
                        data-testid={`button-wa-${order.id}`}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {t("orders.order_details")}
            </DialogTitle>
            <DialogDescription>
              {detailOrder?.orderNumber || ""}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : detailOrder ? (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{t("orders.customer_name")}</p>
                  <p className="font-bold mt-0.5">{detailOrder.customerName}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{t("orders.phone")}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="font-bold">{detailOrder.customerPhone || "-"}</p>
                    {detailOrder.customerPhone && (
                      <button className="text-green-600 hover:text-green-700" onClick={() => openWhatsApp(detailOrder.customerPhone)}>
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{t("orders.status_filter")}</p>
                  <Badge className={`${(STATUS_MAP[detailOrder.status] || STATUS_MAP.new).color} border shadow-none mt-0.5`}>
                    {(STATUS_MAP[detailOrder.status] || STATUS_MAP.new).label}
                  </Badge>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{t("orders.order_time")}</p>
                  <p className="font-bold mt-0.5">
                    {detailOrder.createdAt ? new Date(detailOrder.createdAt).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{t("orders.delivery_type")}</p>
                  <p className="font-bold mt-0.5">{detailOrder.deliveryType === "delivery" ? t("orders.delivery") : t("orders.pickup")}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{t("orders.branch_label")}</p>
                  <p className="font-bold mt-0.5">{detailOrder.branchId ? branchMap[detailOrder.branchId] || "-" : "-"}</p>
                </div>
                {detailOrder.city && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{t("orders.city")}</p>
                    <p className="font-bold mt-0.5">{detailOrder.city}</p>
                  </div>
                )}
                {detailOrder.address && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{t("orders.address")}</p>
                    <p className="font-bold mt-0.5">{detailOrder.address}</p>
                  </div>
                )}
              </div>

              {detailOrder.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">{t("orders.notes")}</p>
                  <p className="text-sm">{detailOrder.notes}</p>
                </div>
              )}

              {detailOrder.items && detailOrder.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-3 py-2 font-bold text-sm border-b">{t("orders.order_items")}</div>
                  <div className="divide-y text-sm">
                    {detailOrder.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between px-3 py-2">
                        <span>{item.product_name || item.productName || `#${item.productId}`} x{item.quantity}</span>
                        <span className="font-medium">{fmt(item.total)} {t("common.omr")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex justify-between items-center">
                <span className="font-bold text-lg">{t("orders.total_amount")}</span>
                <span className="font-bold text-2xl text-primary">{fmt(detailOrder.total)} {t("common.omr")}</span>
              </div>

              <div className="flex gap-2">
                <Select value={detailOrder.status || "new"} onValueChange={v => {
                  updateStatusMutation.mutate({ id: detailOrder.id, status: v });
                  setDetailOrder({ ...detailOrder, status: v });
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {detailOrder.customerPhone && (
                  <Button variant="outline" className="gap-2 text-green-600 border-green-200 hover:bg-green-50" onClick={() => openWhatsApp(detailOrder.customerPhone)}>
                    <MessageCircle className="w-4 h-4" />
                    {t("orders.whatsapp")}
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
