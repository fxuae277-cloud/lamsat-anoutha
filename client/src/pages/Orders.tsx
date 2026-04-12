/**
 * Orders.tsx — نظام إدارة الطلبات لمسة أنوثة
 * جلسة 10 | RTL | عملة OMR
 */
import { useState, useMemo } from "react";
import {
  Plus, Search, X, Eye, Edit, Trash2,
  ShoppingBag, Clock, Truck, CheckCircle, XCircle,
  Package, User, Phone,
  RefreshCw, FileText, ArrowRight,
  MapPin, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/formatters";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";
import { DateInput } from "@/components/ui/date-input";
import type { Branch } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderItem {
  id?: number;
  productId: number;
  productName?: string;
  quantity: number;
  unitPrice: number | string;
  total?: number | string;
  color?: string;
  size?: string;
  costPrice?: number | string;
  stockQty?: number;
}

interface Order {
  id: number;
  orderNumber: string;
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  source: string;
  status: string;
  deliveryMethod: string;
  deliveryAddress?: string;
  deliveryFee?: string;
  subtotal?: string;
  discount?: string;
  discountType?: string;
  total: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentReference?: string;
  notes?: string;
  branchId?: number;
  branchName?: string;
  invoiceId?: number;
  items?: OrderItem[];
  createdAt: string;
}

interface Product { id: number; name: string; price: number | string; avgCost?: number | string; stockQty?: number; }

// ─── Constants ─────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  new:       { label: "جديد",           color: "bg-blue-100 text-blue-700 border-blue-200",      icon: Clock },
  preparing: { label: "جاري التجهيز",   color: "bg-amber-100 text-amber-700 border-amber-200",   icon: Package },
  ready:     { label: "جاهز للتسليم",   color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
  delivered: { label: "تم التسليم",     color: "bg-purple-100 text-purple-700 border-purple-200", icon: Truck },
  cancelled: { label: "ملغي",           color: "bg-red-100 text-red-700 border-red-200",          icon: XCircle },
};

const SOURCE_MAP: Record<string, { label: string; color: string }> = {
  whatsapp:  { label: "واتساب",   color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  instagram: { label: "إنستغرام", color: "bg-purple-100 text-purple-700 border-purple-200" },
  call:      { label: "اتصال",    color: "bg-blue-100 text-blue-700 border-blue-200" },
  "walk-in": { label: "حضوري",   color: "bg-orange-100 text-orange-700 border-orange-200" },
};

const PAY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  unpaid:  { label: "غير مدفوع", color: "bg-red-100 text-red-700" },
  partial: { label: "جزئي",      color: "bg-amber-100 text-amber-700" },
  paid:    { label: "مدفوع",     color: "bg-emerald-100 text-emerald-700" },
};

const n = (v: any) => parseFloat(String(v || "0")) || 0;
const omr = (v: number) => v.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ─── Stats Cards ───────────────────────────────────────────────────────────────
function StatsCards({ stats }: { stats: any }) {
  const cards = [
    { key: "new_count",       label: "جديد",         color: "text-blue-600",    bg: "bg-blue-50 border-blue-100",     icon: Clock },
    { key: "preparing_count", label: "جاري التجهيز", color: "text-amber-600",   bg: "bg-amber-50 border-amber-100",   icon: Package },
    { key: "ready_count",     label: "جاهز",         color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", icon: CheckCircle },
    { key: "delivered_count", label: "تم التسليم",   color: "text-purple-600",  bg: "bg-purple-50 border-purple-100", icon: Truck },
    { key: "cancelled_count", label: "ملغي",         color: "text-red-600",     bg: "bg-red-50 border-red-100",       icon: XCircle },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.key} className={`${c.bg} border rounded-xl p-3 flex items-center gap-3`}>
            <Icon className={`w-5 h-5 ${c.color} shrink-0`} />
            <div>
              <p className={`text-xl font-bold ${c.color}`}>{stats?.[c.key] || 0}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Order Form Modal ──────────────────────────────────────────────────────────
function OrderFormModal({ order, onClose, onSaved }: {
  order?: Order | null; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!order;
  const { data: authData } = useAuth();
  const user = authData?.user;

  const [customerName, setCustomerName]     = useState(order?.customerName || "");
  const [customerPhone, setCustomerPhone]   = useState(order?.customerPhone || "");
  const [customerId, setCustomerId]         = useState<number | null>(order?.customerId || null);
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [source, setSource]                 = useState(order?.source || "walk-in");
  const [deliveryMethod, setDeliveryMethod] = useState(order?.deliveryMethod || "pickup");
  const [deliveryAddress, setDeliveryAddress] = useState(order?.deliveryAddress || "");
  const [deliveryFee, setDeliveryFee]       = useState(String(n(order?.deliveryFee)));
  const [discount, setDiscount]             = useState(String(n(order?.discount)));
  const [paymentMethod, setPaymentMethod]   = useState(order?.paymentMethod || "cash");
  const [paymentStatus, setPaymentStatus]   = useState(order?.paymentStatus || "unpaid");
  const [notes, setNotes]                   = useState(order?.notes || "");
  const [items, setItems]                   = useState<OrderItem[]>(order?.items || []);
  const [productSearch, setProductSearch]   = useState("");
  const [showSearch, setShowSearch]         = useState(false);
  const [branchId, setBranchId]             = useState(order?.branchId || user?.branchId || 0);

  const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "returnNull" }) });

  const { data: productResults = [] } = useQuery<Product[]>({
    queryKey: ["/api/pos/products", productSearch],
    queryFn: () => fetch(`/api/pos/products?search=${encodeURIComponent(productSearch)}`, { credentials: "include" }).then(r => r.json()),
    enabled: productSearch.length >= 2,
  });

  const subtotal = items.reduce((s, i) => s + n(i.unitPrice) * i.quantity, 0);
  const discVal = n(discount);
  const feeVal  = n(deliveryFee);
  const total   = Math.max(0, subtotal - discVal + feeVal);

  const addProduct = (p: Product) => {
    setItems(prev => {
      const ex = prev.find(i => i.productId === p.id);
      if (ex) return prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, unitPrice: n(p.price), costPrice: n(p.avgCost), stockQty: p.stockQty }];
    });
    setProductSearch("");
    setShowSearch(false);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!customerName.trim()) throw new Error("اسم العميل مطلوب");
      if (items.length === 0) throw new Error("يجب إضافة منتج واحد على الأقل");
      const body = {
        customerName, customerPhone, customerId, source, deliveryMethod, deliveryAddress,
        deliveryFee: feeVal.toFixed(3), subtotal: subtotal.toFixed(3),
        discount: discVal.toFixed(3), total: total.toFixed(3),
        paymentMethod, paymentStatus, notes, branchId,
        items: items.map(i => ({
          productId: i.productId, quantity: i.quantity,
          unitPrice: n(i.unitPrice).toFixed(3),
          total: (n(i.unitPrice) * i.quantity).toFixed(3),
          costPrice: n(i.costPrice).toFixed(3),
          color: i.color || null, size: i.size || null,
        })),
      };
      if (isEdit) return apiRequest("PUT", `/api/orders/${order!.id}`, body).then(r => r.json());
      return apiRequest("POST", "/api/orders", body).then(r => r.json());
    },
    onSuccess: () => { toast({ title: isEdit ? "تم تعديل الطلب" : "تم إنشاء الطلب بنجاح" }); onSaved(); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-pink-600" />
            {isEdit ? `تعديل الطلب ${order?.orderNumber}` : "طلب جديد"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">اسم العميل *</label>
              <Input value={customerName} onChange={e => { setCustomerName(e.target.value); setCustomerId(null); }} placeholder="اسم العميل" className="h-9" />
            </div>
            <div className="space-y-1 relative">
              <label className="text-xs font-medium text-gray-600">رقم الهاتف {customerId && <span className="text-green-600 text-[10px]">✓ مسجل</span>}</label>
              <Input
                value={customerPhone}
                onChange={async e => {
                  const val = e.target.value;
                  setCustomerPhone(val);
                  setCustomerId(null);
                  if (val.length >= 4) {
                    try {
                      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(val)}`, { credentials: "include" });
                      const data = await res.json();
                      setCustomerSuggestions(Array.isArray(data) ? data : []);
                    } catch { setCustomerSuggestions([]); }
                  } else {
                    setCustomerSuggestions([]);
                  }
                }}
                placeholder="9XXXXXXXX" dir="ltr" className="h-9"
              />
              {customerSuggestions.length > 0 && (
                <div className="absolute top-full right-0 left-0 z-50 bg-white border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {customerSuggestions.map(c => (
                    <button key={c.id} type="button"
                      className="w-full text-right flex items-center gap-2 px-3 py-2 hover:bg-pink-50 text-sm"
                      onClick={() => {
                        setCustomerName(c.name);
                        setCustomerPhone(c.phone || "");
                        setCustomerId(c.id);
                        setCustomerSuggestions([]);
                      }}>
                      <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xs font-bold shrink-0">
                        {c.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-xs">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground" dir="ltr">{c.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Source & Delivery */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">المصدر</label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">حضوري</SelectItem>
                  <SelectItem value="whatsapp">واتساب</SelectItem>
                  <SelectItem value="instagram">إنستغرام</SelectItem>
                  <SelectItem value="call">اتصال</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">طريقة الاستلام</label>
              <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">استلام من المتجر</SelectItem>
                  <SelectItem value="delivery">توصيل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">الفرع</label>
              <Select value={String(branchId)} onValueChange={v => setBranchId(Number(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {deliveryMethod === "delivery" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">عنوان التوصيل</label>
                <Input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="العنوان التفصيلي" className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">رسوم التوصيل (ر.ع)</label>
                <Input type="number" step="0.001" min="0" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} dir="ltr" className="h-9" />
              </div>
            </div>
          )}

          {/* Products */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">المنتجات *</label>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowSearch(v => !v)}>
                <Plus className="w-3 h-3" /> إضافة منتج
              </Button>
            </div>
            {showSearch && (
              <div className="relative">
                <div className="flex gap-2 mb-1">
                  <Input placeholder="ابحث عن منتج..." value={productSearch}
                    onChange={e => setProductSearch(e.target.value)} autoFocus className="h-8 text-sm flex-1" />
                  <BarcodeScanButton onScan={(barcode) => setProductSearch(barcode)} />
                </div>
                {productResults.length > 0 && (
                  <div className="absolute top-full right-0 left-0 bg-white border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto mt-1">
                    {productResults.map(p => (
                      <button key={p.id} className="w-full text-right flex justify-between items-center px-3 py-2 hover:bg-pink-50 text-sm" onClick={() => addProduct(p)}>
                        <span>{p.name}</span>
                        <span className="text-pink-600 font-medium text-xs">{omr(n(p.price))} ر.ع</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {items.length === 0 && <p className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded-lg">لم تُضف منتجات بعد</p>}
            <div className="space-y-1.5">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border">
                  <span className="flex-1 truncate text-xs font-medium">{item.productName}</span>
                  <Input type="number" min="1" value={item.quantity}
                    onChange={e => setItems(prev => prev.map((i, x) => x === idx ? { ...i, quantity: parseInt(e.target.value) || 1 } : i))}
                    className="w-14 h-7 text-center text-xs" dir="ltr" />
                  <span className="text-xs text-gray-500 w-20 text-left" dir="ltr">{omr(n(item.unitPrice))} ر.ع</span>
                  <span className="text-xs font-bold text-pink-600 w-20 text-left" dir="ltr">{omr(n(item.unitPrice) * item.quantity)} ر.ع</span>
                  <button className="text-red-400 hover:text-red-600" onClick={() => setItems(prev => prev.filter((_, x) => x !== idx))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">طريقة الدفع</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                  <SelectItem value="bank_transfer">تحويل</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">حالة الدفع</label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">غير مدفوع</SelectItem>
                  <SelectItem value="partial">دفع جزئي</SelectItem>
                  <SelectItem value="paid">مدفوع</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">خصم (ر.ع)</label>
              <Input type="number" step="0.001" min="0" value={discount} onChange={e => setDiscount(e.target.value)} dir="ltr" className="h-9" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">ملاحظات</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات الطلب..." className="h-9" />
          </div>

          {items.length > 0 && (
            <div className="bg-pink-50 border border-pink-100 rounded-xl p-3 space-y-1 text-sm">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>المجموع الفرعي</span><span dir="ltr">{omr(subtotal)} ر.ع</span>
              </div>
              {discVal > 0 && <div className="flex justify-between text-xs text-emerald-600"><span>خصم</span><span dir="ltr">- {omr(discVal)} ر.ع</span></div>}
              {feeVal > 0 && <div className="flex justify-between text-xs"><span>رسوم التوصيل</span><span dir="ltr">+ {omr(feeVal)} ر.ع</span></div>}
              <div className="flex justify-between font-bold border-t border-pink-200 pt-1">
                <span>الإجمالي</span><span className="text-pink-600" dir="ltr">{omr(total)} ر.ع</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>إلغاء</Button>
          <Button className="bg-pink-600 hover:bg-pink-700" size="sm"
            onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديلات" : "إنشاء الطلب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Modal ──────────────────────────────────────────────────────────────
function StatusModal({ order, onClose, onSaved }: {
  order: Order; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [status, setStatus]       = useState(order.status);
  const [showConvert, setShowConvert] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState(String(n(order.total)));

  const statusMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/orders/${order.id}/status`, { status }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "تم تحديث حالة الطلب" });
      if (status === "delivered" && !order.invoiceId) { setShowConvert(true); return; }
      onSaved();
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/orders/${order.id}/convert-to-invoice`, {
      paymentMethod: payMethod, amountPaid: n(amountPaid).toFixed(3),
    }).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم تحويل الطلب لفاتورة بيع بنجاح" }); onSaved(); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader><DialogTitle>تحديث حالة الطلب {order.orderNumber}</DialogTitle></DialogHeader>
        {!showConvert ? (
          <>
            <div className="grid gap-2">
              {Object.entries(STATUS_MAP).map(([val, info]) => {
                const Icon = info.icon;
                return (
                  <button key={val}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 text-sm font-medium transition-all ${status === val ? "border-pink-500 bg-pink-50" : "border-gray-200 hover:border-gray-300"}`}
                    onClick={() => setStatus(val)}>
                    <Icon className="w-4 h-4" />
                    <span>{info.label}</span>
                    {status === val && <CheckCircle className="w-4 h-4 text-pink-600 mr-auto" />}
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>إلغاء</Button>
              <Button size="sm" className="bg-pink-600 hover:bg-pink-700"
                onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending || status === order.status}>
                {statusMutation.isPending ? "جارٍ التحديث..." : "تحديث"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-emerald-800">هل تريد تحويل الطلب لفاتورة بيع؟</p>
              <p className="text-xs text-muted-foreground">سيتم خصم المخزون وتسجيل قيد محاسبي تلقائياً</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[["cash","نقدي"],["card","بطاقة"],["bank_transfer","تحويل"]].map(([v,l]) => (
                  <button key={v}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-colors ${payMethod===v?"bg-emerald-600 text-white border-emerald-600":"border-gray-200 hover:bg-gray-100"}`}
                    onClick={() => setPayMethod(v)}>{l}</button>
                ))}
              </div>
              <Input type="number" step="0.001" placeholder="المبلغ المدفوع"
                value={amountPaid} onChange={e => setAmountPaid(e.target.value)} dir="ltr" className="h-8 text-sm" />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onSaved}>لاحقاً</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
                {convertMutation.isPending ? "جارٍ التحويل..." : "تحويل لفاتورة"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function OrderDetailModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const st  = STATUS_MAP[order.status] || STATUS_MAP.new;
  const src = SOURCE_MAP[order.source] || SOURCE_MAP["walk-in"];
  const pay = PAY_STATUS_MAP[order.paymentStatus || "unpaid"];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-pink-600" />
            تفاصيل الطلب {order.orderNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={`${st.color} text-xs`}>{st.label}</Badge>
            <Badge variant="outline" className={`${src.color} text-xs`}>{src.label}</Badge>
            <Badge variant="outline" className={`${pay.color} text-xs`}>{pay.label}</Badge>
            {order.invoiceId && <Badge className="bg-purple-100 text-purple-700 text-xs">فاتورة #{order.invoiceId}</Badge>}
          </div>
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">معلومات العميل</p>
            <div className="flex items-center gap-2 text-sm"><User className="w-3.5 h-3.5 text-gray-400" /><span className="font-medium">{order.customerName}</span></div>
            {order.customerPhone && <div className="flex items-center gap-2 text-sm"><Phone className="w-3.5 h-3.5 text-gray-400" /><span dir="ltr">{order.customerPhone}</span></div>}
            {order.deliveryAddress && <div className="flex items-center gap-2 text-sm"><MapPin className="w-3.5 h-3.5 text-gray-400" /><span>{order.deliveryAddress}</span></div>}
          </div>
          {order.items && order.items.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">المنتجات</p>
              <div className="space-y-1.5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span>{item.productName || `منتج #${item.productId}`} × {item.quantity}</span>
                    <span className="text-pink-600 font-medium" dir="ltr">{omr(n(item.unitPrice) * item.quantity)} ر.ع</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="border-t pt-3 space-y-1 text-sm">
            {n(order.discount) > 0 && <div className="flex justify-between text-emerald-600 text-xs"><span>خصم</span><span dir="ltr">- {omr(n(order.discount))} ر.ع</span></div>}
            {n(order.deliveryFee) > 0 && <div className="flex justify-between text-xs"><span>رسوم التوصيل</span><span dir="ltr">+ {omr(n(order.deliveryFee))} ر.ع</span></div>}
            <div className="flex justify-between font-bold"><span>الإجمالي</span><span className="text-pink-600" dir="ltr">{omr(n(order.total))} ر.ع</span></div>
          </div>
          {order.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
              <p className="font-medium mb-1">ملاحظات:</p><p>{order.notes}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{fmtDateTime(order.createdAt)}</p>
        </div>
        <DialogFooter><Button variant="outline" size="sm" onClick={onClose}>إغلاق</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Orders Page ──────────────────────────────────────────────────────────
export default function Orders() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: authData } = useAuth();
  const user = authData?.user;
  const isManager = ["owner", "admin", "manager"].includes(user?.role || "");

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [fromDate, setFromDate]       = useState("");
  const [toDate, setToDate]           = useState("");
  const [showForm, setShowForm]       = useState(false);
  const [editOrder, setEditOrder]     = useState<Order | null>(null);
  const [statusOrder, setStatusOrder] = useState<Order | null>(null);
  const [viewOrder, setViewOrder]     = useState<Order | null>(null);
  const [deleteId, setDeleteId]       = useState<number | null>(null);
  const [page, setPage]               = useState(1);
  const PER_PAGE = 20;

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/orders/stats"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: orders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["/api/orders/full", search, statusFilter, sourceFilter, fromDate, toDate],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (sourceFilter !== "all") p.set("source", sourceFilter);
      if (fromDate) p.set("from", fromDate);
      if (toDate) p.set("to", toDate);
      return fetch(`/api/orders/full?${p}`, { credentials: "include" }).then(r => r.json());
    },
    placeholderData: prev => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/orders/${id}`).then(r => r.json()),
    onSuccess: () => { toast({ title: "تم حذف الطلب" }); refresh(); setDeleteId(null); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const refresh = () => { refetch(); refetchStats(); };
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setSourceFilter("all"); setFromDate(""); setToDate(""); setPage(1); };
  const hasFilters = !!(search || statusFilter !== "all" || sourceFilter !== "all" || fromDate || toDate);

  const safeOrders = Array.isArray(orders) ? orders : [];
  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return safeOrders.slice(start, start + PER_PAGE);
  }, [safeOrders, page]);
  const totalPages = Math.ceil(safeOrders.length / PER_PAGE);

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-pink-600" /> الطلبات
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة طلبات العملاء</p>
        </div>
        <Button className="bg-pink-600 hover:bg-pink-700 gap-1.5" onClick={() => { setEditOrder(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> طلب جديد
        </Button>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Filters */}
      <div className="bg-white rounded-xl border p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <Input placeholder="بحث برقم الطلب أو رقم الهاتف..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} className="pr-9 h-8 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {Object.entries(STATUS_MAP).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={v => { setSourceFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="المصدر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المصادر</SelectItem>
              {Object.entries(SOURCE_MAP).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateInput value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 w-36 text-xs" />
          <DateInput value={toDate}   onChange={e => setToDate(e.target.value)}   className="h-8 w-36 text-xs" />
          {hasFilters && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-red-500 border-red-200 hover:bg-red-50" onClick={clearFilters}>
              <X className="w-3 h-3" /> مسح
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{orders.length} طلب</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>لا توجد طلبات مطابقة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  {["رقم الطلب","العميل","المنتجات","المبلغ","الحالة","المصدر","تاريخ الطلب","إجراءات"].map(h => (
                    <th key={h} className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(order => {
                  const st  = STATUS_MAP[order.status] || STATUS_MAP.new;
                  const src = SOURCE_MAP[order.source] || SOURCE_MAP["walk-in"];
                  const StIcon = st.icon;
                  return (
                    <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-pink-700">
                        {order.orderNumber}
                        {order.invoiceId && <span className="mr-1 text-[10px] bg-purple-100 text-purple-600 px-1 rounded">فاتورة</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-xs">{order.customerName}</p>
                        {order.customerPhone && <p className="text-[10px] text-muted-foreground" dir="ltr">{order.customerPhone}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{(order.items?.length || 0)} منتج</td>
                      <td className="px-4 py-3 font-bold text-pink-600 text-xs" dir="ltr">{omr(n(order.total))} ر.ع</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`${st.color} text-[10px] gap-1`}>
                          <StIcon className="w-2.5 h-2.5" />{st.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`${src.color} text-[10px]`}>{src.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(order.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600" title="عرض" onClick={() => setViewOrder(order)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {order.status !== "cancelled" && order.status !== "delivered" && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-amber-50 hover:text-amber-600" title="تحديث الحالة" onClick={() => setStatusOrder(order)}>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {order.status === "delivered" && !order.invoiceId && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-emerald-50 hover:text-emerald-600" title="تحويل لفاتورة" onClick={() => setStatusOrder(order)}>
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-gray-100" title="تعديل" onClick={() => { setEditOrder(order); setShowForm(true); }}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          {isManager && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600" title="حذف" onClick={() => setDeleteId(order.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-8 text-xs">السابق</Button>
          <span className="text-xs text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="h-8 text-xs">التالي</Button>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <OrderFormModal order={editOrder} onClose={() => { setShowForm(false); setEditOrder(null); }}
          onSaved={() => { setShowForm(false); setEditOrder(null); refresh(); }} />
      )}
      {statusOrder && (
        <StatusModal order={statusOrder} onClose={() => setStatusOrder(null)}
          onSaved={() => { setStatusOrder(null); refresh(); }} />
      )}
      {viewOrder && <OrderDetailModal order={viewOrder} onClose={() => setViewOrder(null)} />}

      {/* Confirm Delete */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-xs" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-4 h-4" /> حذف الطلب</DialogTitle>
          </DialogHeader>
          <DialogDescription>هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>إلغاء</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "جارٍ الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
