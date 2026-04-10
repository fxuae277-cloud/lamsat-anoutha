/**
 * POS.tsx — شاشة نقطة البيع لمسة أنوثة
 * جلسة 10 | RTL | عملة OMR 3 خانات عشرية
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search, Plus, Minus, Trash2, CheckCircle2, Store, Monitor,
  Banknote, LogOut, User as UserIcon, XCircle, Clock, Printer,
  ArrowRight, Receipt, ShoppingCart, MessageSquare, Pause, Play,
  Tag, Package, Percent, CreditCard, Wallet, RotateCcw, ChevronDown,
  Phone, AlertTriangle, ZapOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fmtOMR, fmtDateTime, fmtDate } from "@/lib/formatters";
import type { Branch, Shift } from "@shared/schema";

// ─── Types ───────────────────────────────────────────────────────────────────
interface POSProduct {
  id: number;
  name: string;
  barcode?: string;
  price: number | string;
  avgCost: number | string;
  image?: string;
  categoryId?: number;
  categoryName?: string;
  stockQty: number;
}

interface CartItem {
  uid: string;
  productId: number;
  productName: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  color?: string;
  size?: string;
  maxStock: number;
  image?: string;
  categoryName?: string;
}

interface HeldInvoice {
  id: number;
  hold_number: string;
  items: CartItem[];
  customer_id?: number;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
}

interface Customer { id: number; name: string; phone?: string; city?: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n = (v: string | number | null | undefined) => parseFloat(String(v || "0")) || 0;
const omr = (v: number) => v.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const CATEGORY_ICONS: Record<string, string> = {
  "خواتم": "💍", "حلقان": "💎", "أطقم": "👑",
  "عقود": "📿", "أساور": "⌚",
};
const catIcon = (name?: string) => CATEGORY_ICONS[name || ""] || "🛍️";

const stockBadge = (qty: number) => {
  if (qty === 0) return { label: "نافد", cls: "bg-red-100 text-red-700 border-red-200" };
  if (qty < 5)  return { label: "منخفض", cls: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "متوفر", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
};

const uid = () => Math.random().toString(36).slice(2);

// ─── StartPOS ─────────────────────────────────────────────────────────────────
function StartPOS({ branchName, terminalName, userName, onShiftOpened }: {
  branchName: string; terminalName: string; userName: string;
  onShiftOpened: (shift: Shift) => void;
}) {
  const { toast } = useToast();
  const [openingCash, setOpeningCash] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/shifts/current", { credentials: "include" });
        const data = await res.json();
        if (data.shift) { onShiftOpened(data.shift); return; }
      } catch {}
      setChecking(false);
    })();
  }, []);

  const openShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shifts", { openingCash: openingCash || "0" });
      return res.json();
    },
    onSuccess: (shift: Shift) => { toast({ title: "تم فتح الوردية بنجاح" }); onShiftOpened(shift); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (checking) return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground">جارٍ التحقق من الوردية...</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50">
      <div className="w-full max-w-md bg-white border border-pink-100 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-l from-pink-600 to-rose-500 p-8 text-center text-white">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Store className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold">لمسة أنوثة</h1>
          <p className="text-pink-100 mt-1 text-sm">نقطة البيع</p>
        </div>
        <div className="p-8 space-y-6">
          <div className="bg-pink-50 rounded-xl p-4 space-y-2 text-sm">
            {[["الكاشير", userName, UserIcon], ["الفرع", branchName, Store], ["الجهاز", terminalName, Monitor]].map(([label, val, Icon]: any) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {label}</span>
                <span className="font-semibold">{val}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">النقد الافتتاحي (اختياري)</label>
            <Input
              type="number" step="0.001" min="0" placeholder="0.000 ر.ع"
              value={openingCash} onChange={e => setOpeningCash(e.target.value)}
              className="text-center text-lg h-12"
              dir="ltr"
            />
          </div>
          <Button
            className="w-full h-12 text-base bg-gradient-to-l from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600"
            onClick={() => openShiftMutation.mutate()}
            disabled={openShiftMutation.isPending}
          >
            {openShiftMutation.isPending ? "جارٍ الفتح..." : "فتح الوردية وبدء البيع"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── ReceiptModal ─────────────────────────────────────────────────────────────
function ReceiptModal({ sale, onClose, branchName, cashierName, shiftId }: {
  sale: any; onClose: () => void;
  branchName: string; cashierName: string; shiftId?: number;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const total = n(sale.total);
  const paid  = n(sale.amountPaid ?? sale.amount_paid ?? total);
  const change = n(sale.changeAmount ?? sale.change_amount ?? 0);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open("", "_blank", "width=320,height=600");
    if (!w) return;
    w.document.write(`<html><head><title>فاتورة</title>
      <style>
        body{font-family:'Cairo',sans-serif;direction:rtl;margin:0;padding:10px;font-size:12px}
        .center{text-align:center} .bold{font-weight:700}
        table{width:100%;border-collapse:collapse}
        td,th{padding:3px 4px} th{border-bottom:1px dashed #000}
        .total-row{border-top:2px solid #000;font-weight:700}
        hr{border:none;border-top:1px dashed #000;margin:6px 0}
      </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };

  const handleWhatsApp = () => {
    const items = (sale.items || []).map((i: any) =>
      `  • ${i.productName || i.product_name} × ${i.quantity} = ${omr(n(i.unitPrice || i.unit_price) * i.quantity)} ر.ع`
    ).join("\n");
    const msg = encodeURIComponent(
      `🌸 *لمسة أنوثة* 🌸\n` +
      `────────────────\n` +
      `رقم الفاتورة: ${sale.invoiceNumber || sale.invoice_number}\n` +
      `التاريخ: ${fmtDate(sale.createdAt || sale.created_at)}\n\n` +
      `المنتجات:\n${items}\n\n` +
      `الإجمالي: *${omr(total)} ر.ع*\n` +
      `المدفوع: ${omr(paid)} ر.ع\n` +
      `الباقي: ${omr(change)} ر.ع\n\n` +
      `شكراً لتسوقكم معنا 💝`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" /> تمت عملية البيع بنجاح
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="text-sm space-y-1 bg-gray-50 rounded-lg p-4 max-h-[50vh] overflow-y-auto">
          <p className="text-center font-bold text-base">🌸 لمسة أنوثة 🌸</p>
          <p className="text-center text-xs text-muted-foreground">{branchName}</p>
          <hr className="border-dashed my-1" />
          <div className="grid grid-cols-2 gap-x-2 text-xs">
            <span className="text-muted-foreground">رقم الفاتورة:</span>
            <span className="font-medium">{sale.invoiceNumber || sale.invoice_number}</span>
            <span className="text-muted-foreground">التاريخ:</span>
            <span>{fmtDateTime(sale.createdAt || sale.created_at)}</span>
            <span className="text-muted-foreground">الكاشير:</span>
            <span>{cashierName}</span>
          </div>
          <hr className="border-dashed my-1" />
          <table className="w-full text-xs">
            <thead><tr>
              <th className="text-right pb-1">المنتج</th>
              <th className="text-center">كمية</th>
              <th className="text-left">المبلغ</th>
            </tr></thead>
            <tbody>
              {(sale.items || []).map((item: any, i: number) => (
                <tr key={i}>
                  <td>{item.productName || item.product_name}{item.color ? ` (${item.color})` : ""}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-left" dir="ltr">{omr(n(item.unitPrice || item.unit_price) * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr className="border-dashed my-1" />
          <div className="space-y-0.5 text-xs">
            {n(sale.discount) > 0 && (
              <div className="flex justify-between"><span>خصم:</span><span dir="ltr">- {omr(n(sale.discount))} ر.ع</span></div>
            )}
            <div className="flex justify-between font-bold text-sm">
              <span>الإجمالي:</span><span dir="ltr">{omr(total)} ر.ع</span>
            </div>
            <div className="flex justify-between"><span>المدفوع:</span><span dir="ltr">{omr(paid)} ر.ع</span></div>
            {change > 0 && <div className="flex justify-between text-emerald-600"><span>الباقي:</span><span dir="ltr">{omr(change)} ر.ع</span></div>}
            <div className="flex justify-between text-muted-foreground">
              <span>طريقة الدفع:</span>
              <span>{sale.paymentMethod === "cash" ? "نقدي" : sale.paymentMethod === "card" ? "بطاقة" : "تحويل"}</span>
            </div>
          </div>
          <hr className="border-dashed my-1" />
          <p className="text-center text-xs text-muted-foreground">شكراً لتسوقكم معنا 💝</p>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-start">
          <Button size="sm" onClick={handlePrint} className="bg-pink-600 hover:bg-pink-700 gap-1">
            <Printer className="w-3.5 h-3.5" /> طباعة
          </Button>
          <Button size="sm" variant="outline" onClick={handleWhatsApp} className="gap-1 border-emerald-500 text-emerald-700 hover:bg-emerald-50">
            <MessageSquare className="w-3.5 h-3.5" /> واتساب
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── HoldListModal ────────────────────────────────────────────────────────────
function HoldListModal({ onClose, onResume }: {
  onClose: () => void;
  onResume: (held: HeldInvoice) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: held = [], isLoading } = useQuery<HeldInvoice[]>({
    queryKey: ["/api/pos/held"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pos/held/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pos/held"] }); toast({ title: "تم حذف الفاتورة المعلقة" }); },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/pos/held/${id}/resume`).then(r => r.json()),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["/api/pos/held"] }); onResume(data); },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pause className="w-4 h-4 text-amber-500" /> الفواتير المعلقة</DialogTitle></DialogHeader>
        {isLoading && <p className="text-center text-sm text-muted-foreground py-4">جارٍ التحميل...</p>}
        {!isLoading && held.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">لا توجد فواتير معلقة</p>
        )}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {held.map(h => (
            <div key={h.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50">
              <div>
                <p className="font-medium text-sm">{h.hold_number}</p>
                <p className="text-xs text-muted-foreground">
                  {h.customer_name || "بدون عميل"} · {h.items.length} منتج
                </p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(h.created_at)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1 h-7 text-xs"
                  onClick={() => resumeMutation.mutate(h.id)} disabled={resumeMutation.isPending}>
                  <Play className="w-3 h-3" /> استئناف
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700"
                  onClick={() => deleteMutation.mutate(h.id)} disabled={deleteMutation.isPending}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" size="sm" onClick={onClose}>إغلاق</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CustomerModal ────────────────────────────────────────────────────────────
function CustomerModal({ onClose, onSelect }: {
  onClose: () => void;
  onSelect: (c: Customer | null) => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"search" | "new">("search");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const { data: results = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers/search", search],
    queryFn: () => fetch(`/api/customers/search?q=${encodeURIComponent(search)}`, { credentials: "include" }).then(r => r.json()),
    enabled: search.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/customers", { name: newName, phone: newPhone }).then(r => r.json()),
    onSuccess: (c) => { toast({ title: "تم إضافة العميل" }); onSelect(c); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserIcon className="w-4 h-4" /> اختيار العميل</DialogTitle></DialogHeader>
        <div className="flex gap-2 mb-3">
          <Button size="sm" variant={mode === "search" ? "default" : "outline"} onClick={() => setMode("search")} className="flex-1 h-8 text-xs">بحث عن عميل</Button>
          <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")} className="flex-1 h-8 text-xs">عميل جديد</Button>
        </div>
        {mode === "search" ? (
          <div className="space-y-3">
            <Input placeholder="ابحث بالاسم أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {results.map(c => (
                <button key={c.id} className="w-full text-right flex items-center gap-3 p-2 hover:bg-pink-50 rounded-lg transition-colors"
                  onClick={() => onSelect(c)}>
                  <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-sm font-bold shrink-0">
                    {c.name?.charAt(0) || "؟"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone}</p>
                  </div>
                </button>
              ))}
              {search.length >= 2 && results.length === 0 && <p className="text-center text-xs text-muted-foreground py-3">لا يوجد عملاء مطابقون</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input placeholder="اسم العميل *" value={newName} onChange={e => setNewName(e.target.value)} />
            <Input placeholder="رقم الهاتف" value={newPhone} onChange={e => setNewPhone(e.target.value)} dir="ltr" />
            <Button className="w-full bg-pink-600 hover:bg-pink-700"
              onClick={() => createMutation.mutate()} disabled={!newName || createMutation.isPending}>
              {createMutation.isPending ? "جارٍ الإضافة..." : "إضافة وتحديد"}
            </Button>
          </div>
        )}
        <div className="pt-1">
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => onSelect(null)}>
            بيع بدون عميل
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ReturnModal ──────────────────────────────────────────────────────────────
function ReturnModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [invoiceNum, setInvoiceNum] = useState("");
  const [sale, setSale] = useState<any>(null);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [refundMethod, setRefundMethod] = useState("cash");

  const search = async () => {
    try {
      const res = await fetch(`/api/sales?invoiceNumber=${invoiceNum}`, { credentials: "include" });
      const data = await res.json();
      const found = Array.isArray(data) ? data[0] : data;
      if (!found) { toast({ title: "لم يتم العثور على الفاتورة", variant: "destructive" }); return; }
      const det = await fetch(`/api/sales/${found.id}`, { credentials: "include" }).then(r => r.json());
      setSale(det);
      const s: Record<number, number> = {};
      (det.items || []).forEach((i: any) => { s[i.id] = i.quantity; });
      setSelected(s);
    } catch { toast({ title: "خطأ في البحث", variant: "destructive" }); }
  };

  const returnMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(selected)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => {
          const si = sale.items.find((i: any) => i.id === Number(id));
          return { saleItemId: Number(id), productId: si.productId, quantity, unitPrice: si.unitPrice };
        });
      return apiRequest("POST", `/api/sales/${sale.id}/return`, { items, refundMethod, reason: "مرتجع من POS" }).then(r => r.json());
    },
    onSuccess: () => { toast({ title: "تم تسجيل المرتجع بنجاح" }); onClose(); },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="w-4 h-4 text-orange-500" /> إرجاع فاتورة</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input placeholder="رقم الفاتورة (INV-XXXXX)" value={invoiceNum}
            onChange={e => setInvoiceNum(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()} />
          <Button onClick={search} className="bg-pink-600 hover:bg-pink-700 shrink-0">بحث</Button>
        </div>
        {sale && (
          <div className="space-y-3 mt-2">
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium">{sale.invoiceNumber} — {fmtDate(sale.createdAt)}</p>
              <p className="text-muted-foreground text-xs">الإجمالي: {omr(n(sale.total))} ر.ع</p>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(sale.items || []).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between border rounded-lg p-2">
                  <span className="text-sm">{item.productName} × {item.quantity}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                      onClick={() => setSelected(s => ({ ...s, [item.id]: Math.max(0, (s[item.id] || 0) - 1) }))}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{selected[item.id] || 0}</span>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                      onClick={() => setSelected(s => ({ ...s, [item.id]: Math.min(item.quantity, (s[item.id] || 0) + 1) }))}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {[["cash","نقدي"], ["card","بطاقة"], ["bank_transfer","تحويل"]].map(([val, label]) => (
                <button key={val}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${refundMethod === val ? "bg-orange-500 text-white border-orange-500" : "border-border hover:bg-muted/50"}`}
                  onClick={() => setRefundMethod(val)}>{label}</button>
              ))}
            </div>
            <Button className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => returnMutation.mutate()} disabled={returnMutation.isPending}>
              {returnMutation.isPending ? "جارٍ الإرجاع..." : "تأكيد الإرجاع"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main POS Component ───────────────────────────────────────────────────────
export default function POS() {
  const { data: user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [shift, setShift]           = useState<Shift | null>(null);
  const [cart, setCart]             = useState<CartItem[]>([]);
  const [search, setSearch]         = useState("");
  const [activeCat, setActiveCat]   = useState<number | "all">("all");
  const [customer, setCustomer]     = useState<Customer | null>(null);
  const [payMethod, setPayMethod]   = useState<"cash" | "card" | "bank_transfer">("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [payRef, setPayRef]         = useState("");
  const [discount, setDiscount]     = useState("");
  const [discType, setDiscType]     = useState<"value" | "percent">("value");
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [showHold, setShowHold]     = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const isOwner = user?.role === "owner" || user?.role === "admin";
  const branchId = user?.branchId || 1;

  // ── Data Queries ────────────────────────────────────────────────────
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "returnNull" }),
  });
  const branchName = branches.find(b => b.id === branchId)?.name || "الفرع";

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"], queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery<POSProduct[]>({
    queryKey: ["/api/pos/products", search, activeCat],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (activeCat !== "all") p.set("categoryId", String(activeCat));
      return fetch(`/api/pos/products?${p}`, { credentials: "include" }).then(r => r.json());
    },
    placeholderData: prev => prev,
    staleTime: 10_000,
  });

  const { data: topProducts = [] } = useQuery<POSProduct[]>({
    queryKey: ["/api/pos/top"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 60_000,
  });

  const { data: heldCount = 0 } = useQuery<number>({
    queryKey: ["/api/pos/held-count"],
    queryFn: () => fetch("/api/pos/held", { credentials: "include" })
      .then(r => r.json()).then((d: any[]) => d.length),
    refetchInterval: 15_000,
    enabled: !!shift,
  });

  // ── Cart Calculations ───────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discVal = (() => {
    const d = n(discount);
    if (!d) return 0;
    return discType === "percent" ? subtotal * (d / 100) : Math.min(d, subtotal);
  })();
  const total = Math.max(0, subtotal - discVal);
  const paid  = n(amountPaid);
  const change = Math.max(0, paid - total);
  const canComplete = cart.length > 0 && (payMethod !== "cash" || paid >= total) && shift;

  // ── Cart Ops ─────────────────────────────────────────────────────────
  const addToCart = useCallback((prod: POSProduct, qty = 1, color?: string, size?: string) => {
    if (prod.stockQty <= 0) {
      toast({ title: "المخزون نافد", description: prod.name, variant: "destructive" }); return;
    }
    setCart(prev => {
      const key = `${prod.id}-${color || ""}-${size || ""}`;
      const existing = prev.find(i => i.uid.startsWith(key));
      if (existing) {
        const newQty = Math.min(existing.quantity + qty, prod.stockQty);
        return prev.map(i => i.uid === existing.uid ? { ...i, quantity: newQty } : i);
      }
      return [...prev, {
        uid: `${key}-${uid()}`,
        productId: prod.id,
        productName: prod.name,
        unitPrice: n(prod.price),
        costPrice: n(prod.avgCost),
        quantity: Math.min(qty, prod.stockQty),
        color, size,
        maxStock: prod.stockQty,
        image: prod.image,
        categoryName: prod.categoryName,
      }];
    });
    toast({ title: "تمت الإضافة", description: prod.name, duration: 1500 });
  }, [toast]);

  const updateQty = (uid: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.uid !== uid) return i;
      const q = Math.max(0, Math.min(i.quantity + delta, i.maxStock));
      return q === 0 ? i : { ...i, quantity: q };
    }).filter(i => i.quantity > 0));
  };

  const removeItem = (uid: string) => setCart(prev => prev.filter(i => i.uid !== uid));

  const clearCart = () => {
    setCart([]); setCustomer(null); setDiscount(""); setAmountPaid(""); setPayRef(""); setConfirmClear(false);
  };

  // ── Hold ─────────────────────────────────────────────────────────────
  const holdMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pos/held", {
      items: cart, customerId: customer?.id, customerName: customer?.name, customerPhone: customer?.phone,
    }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: `تم تعليق الفاتورة ${data.hold_number}` });
      clearCart();
      qc.invalidateQueries({ queryKey: ["/api/pos/held-count"] });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const resumeHeld = (held: HeldInvoice) => {
    setCart(held.items);
    if (held.customer_id) setCustomer({ id: held.customer_id, name: held.customer_name || "", phone: held.customer_phone });
    setShowHold(false);
    qc.invalidateQueries({ queryKey: ["/api/pos/held-count"] });
  };

  // ── Complete Sale ─────────────────────────────────────────────────────
  const saleMutation = useMutation({
    mutationFn: async () => {
      if (!shift) throw new Error("يجب فتح وردية أولاً");
      if (cart.length === 0) throw new Error("السلة فارغة");
      if (payMethod === "cash" && paid < total) throw new Error("المبلغ المدفوع أقل من الإجمالي");

      const invNumRes = await fetch("/api/sales", { method: "HEAD", credentials: "include" });
      const body = {
        invoiceNumber: "", // يُولَّد في الـ storage
        subtotal: subtotal.toFixed(3),
        discount: discVal.toFixed(3),
        discountType: discType,
        vat: "0",
        total: total.toFixed(3),
        amountPaid: payMethod === "cash" ? paid.toFixed(3) : total.toFixed(3),
        changeAmount: payMethod === "cash" ? change.toFixed(3) : "0",
        paymentMethod: payMethod,
        paymentReference: payRef || null,
        customerId: customer?.id || null,
        shiftId: shift.id,
        items: cart.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toFixed(3),
          total: (i.unitPrice * i.quantity).toFixed(3),
          unitCostAtSale: i.costPrice.toFixed(3),
          lineCogs: (i.costPrice * i.quantity).toFixed(3),
          color: i.color || null,
          size: i.size || null,
        })),
      };
      const res = await apiRequest("POST", "/api/sales", body);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "فشل إنشاء الفاتورة");
      }
      const sale = await res.json();
      return { ...sale, items: cart.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, color: i.color })) };
    },
    onSuccess: (sale) => {
      setCompletedSale(sale);
      clearCart();
      setAmountPaid("");
      setPayRef("");
      qc.invalidateQueries({ queryKey: ["/api/pos/products"] });
    },
    onError: (e: Error) => toast({ title: "خطأ في الفاتورة", description: e.message, variant: "destructive" }),
  });

  // ── Barcode scan ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement === searchRef.current) return;
      if (e.key.length === 1 && /[a-zA-Z0-9\-]/.test(e.key)) {
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Auth guard ───────────────────────────────────────────────────────
  if (!user) return null;
  if (!shift) return (
    <StartPOS
      branchName={branchName}
      terminalName={user.terminalName || "T1"}
      userName={user.name}
      onShiftOpened={s => setShift(s)}
    />
  );

  // ── Render ────────────────────────────────────────────────────────────
  const rootCats = categories.filter(c => !c.parentId && c.isActive !== false);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50" dir="rtl">
      {/* ─ Header ─ */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">لمسة أنوثة</h1>
            <p className="text-xs text-muted-foreground leading-tight">{branchName} · {user.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={() => setShowReturn(true)}>
              <RotateCcw className="w-3 h-3" /> إرجاع
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 relative"
            onClick={() => setShowHold(true)}>
            <Pause className="w-3 h-3" /> معلق
            {heldCount > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-pink-600 text-white text-[9px] flex items-center justify-center">{heldCount}</span>
            )}
          </Button>
        </div>
      </header>

      {/* ─ Main Body ─ */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* ══ Cart (Right in RTL) ══ */}
        <div className="w-[380px] shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          {/* Cart Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50 shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-pink-600" />
              <span className="font-semibold text-sm">سلة المشتريات</span>
              {cart.length > 0 && <Badge className="bg-pink-100 text-pink-700 border-pink-200 text-xs h-5 px-1.5">{cart.length}</Badge>}
            </div>
            {cart.length > 0 && (
              <button className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                onClick={() => setConfirmClear(true)}>
                <XCircle className="w-3.5 h-3.5" /> مسح الكل
              </button>
            )}
          </div>

          {/* Customer */}
          <div className="px-3 py-2 border-b shrink-0">
            <button className="w-full flex items-center justify-between bg-gray-50 hover:bg-pink-50 border border-dashed border-gray-300 hover:border-pink-300 rounded-lg px-3 py-2 transition-colors text-sm"
              onClick={() => setShowCustomer(true)}>
              <span className="flex items-center gap-2">
                <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                <span className={customer ? "text-gray-800 font-medium" : "text-gray-400"}>
                  {customer ? customer.name : "اختيار العميل (اختياري)"}
                </span>
              </span>
              {customer ? (
                <button className="text-gray-400 hover:text-red-500 p-0.5" onClick={e => { e.stopPropagation(); setCustomer(null); }}>
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">السلة فارغة</p>
                <p className="text-xs mt-1">اضغط على أي منتج لإضافته</p>
              </div>
            )}
            {cart.map(item => (
              <div key={item.uid} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {item.image
                    ? <img src={item.image} alt="" className="w-full h-full object-cover rounded-lg" />
                    : <span className="text-lg">{catIcon(item.categoryName)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate leading-tight">{item.productName}</p>
                  {(item.color || item.size) && (
                    <p className="text-[10px] text-muted-foreground">{[item.color, item.size].filter(Boolean).join(" · ")}</p>
                  )}
                  <p className="text-xs font-bold text-pink-600 mt-0.5">{omr(item.unitPrice)} ر.ع</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
                    onClick={() => updateQty(item.uid, -1)}>
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                  <button className={`w-6 h-6 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors ${item.quantity >= item.maxStock ? "opacity-30 cursor-not-allowed" : ""}`}
                    onClick={() => item.quantity < item.maxStock && updateQty(item.uid, 1)}>
                    <Plus className="w-3 h-3" />
                  </button>
                  <button className="w-6 h-6 text-red-400 hover:text-red-600 flex items-center justify-center ml-1"
                    onClick={() => removeItem(item.uid)}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary & Payment */}
          <div className="border-t bg-white shrink-0 px-3 py-3 space-y-3">
            {/* Discount (owner only) */}
            {isOwner && cart.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <Input
                  type="number" min="0" step="0.001" placeholder="خصم"
                  value={discount} onChange={e => setDiscount(e.target.value)}
                  className="h-7 text-xs flex-1" dir="ltr"
                />
                <div className="flex rounded-md border overflow-hidden shrink-0">
                  {[["value","ر.ع"],["percent","%"]].map(([val,lbl]) => (
                    <button key={val}
                      className={`px-2 py-0.5 text-xs transition-colors ${discType === val ? "bg-pink-600 text-white" : "hover:bg-gray-100"}`}
                      onClick={() => setDiscType(val as any)}>{lbl}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>المجموع الفرعي</span><span dir="ltr">{omr(subtotal)} ر.ع</span>
              </div>
              {discVal > 0 && (
                <div className="flex justify-between text-emerald-600 text-xs">
                  <span>الخصم</span><span dir="ltr">- {omr(discVal)} ر.ع</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t">
                <span>الإجمالي</span>
                <span className="text-pink-600" dir="ltr">{omr(total)} ر.ع</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="grid grid-cols-3 gap-1.5">
              {([["cash","نقدي",Banknote],["card","بطاقة",CreditCard],["bank_transfer","تحويل",Wallet]] as const).map(([val,label,Icon]) => (
                <button key={val}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all ${payMethod === val ? "bg-pink-600 text-white border-pink-600 shadow-sm" : "border-gray-200 hover:border-pink-300 hover:bg-pink-50"}`}
                  onClick={() => { setPayMethod(val); setAmountPaid(""); setPayRef(""); }}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Cash input */}
            {payMethod === "cash" && (
              <div className="space-y-2">
                <div className="flex gap-1">
                  {[5, 10, 20, 50].map(v => (
                    <button key={v}
                      className="flex-1 py-1 text-xs rounded border border-gray-200 hover:border-pink-400 hover:bg-pink-50 transition-colors"
                      onClick={() => setAmountPaid(v.toFixed(3))}>
                      {v}
                    </button>
                  ))}
                </div>
                <Input
                  type="number" step="0.001" min="0"
                  placeholder="المبلغ المدفوع"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  className="h-8 text-sm text-center" dir="ltr"
                />
                {paid > 0 && (
                  <div className={`flex justify-between text-sm px-1 font-medium ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    <span>الباقي</span>
                    <span dir="ltr">{omr(change >= 0 ? change : paid - total)} ر.ع</span>
                  </div>
                )}
              </div>
            )}

            {/* Card / Transfer reference */}
            {(payMethod === "card" || payMethod === "bank_transfer") && (
              <Input
                placeholder={payMethod === "card" ? "رقم مرجع البطاقة" : "رقم مرجع التحويل"}
                value={payRef} onChange={e => setPayRef(e.target.value)}
                className="h-8 text-sm" dir="ltr"
              />
            )}

            {/* Complete Sale */}
            <Button
              className={`w-full h-11 text-sm font-bold transition-all ${canComplete ? "bg-gradient-to-l from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 shadow-md" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
              disabled={!canComplete || saleMutation.isPending}
              onClick={() => saleMutation.mutate()}
            >
              {saleMutation.isPending ? (
                <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جارٍ البيع...</span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  إتمام البيع {cart.length > 0 ? `— ${omr(total)} ر.ع` : ""}
                </span>
              )}
            </Button>

            {/* Hold */}
            {cart.length > 0 && (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => holdMutation.mutate()} disabled={holdMutation.isPending}>
                <Pause className="w-3 h-3" />
                {holdMutation.isPending ? "جارٍ التعليق..." : "تعليق الفاتورة"}
              </Button>
            )}
          </div>
        </div>

        {/* ══ Products (Left) ══ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search + Categories */}
          <div className="bg-white border-b px-4 py-3 space-y-2 shrink-0">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                ref={searchRef}
                placeholder="بحث بالاسم أو الباركود..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-10 pl-4 h-9 text-sm bg-gray-50 border-gray-200 focus:border-pink-400"
              />
              {search && (
                <button className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearch("")}>
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Category tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${activeCat === "all" ? "bg-pink-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                onClick={() => setActiveCat("all")}>
                الكل <span className="opacity-70">({products.length})</span>
              </button>
              {rootCats.map(cat => {
                const cnt = products.filter(p => p.categoryId === cat.id).length;
                return (
                  <button key={cat.id}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${activeCat === cat.id ? "bg-pink-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    onClick={() => setActiveCat(cat.id)}>
                    <span>{catIcon(cat.name)}</span> {cat.name} <span className="opacity-70">({cnt})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Top products strip */}
          {topProducts.length > 0 && !search && activeCat === "all" && (
            <div className="bg-white border-b px-4 py-2 shrink-0">
              <p className="text-xs text-muted-foreground mb-1.5">⚡ الأكثر مبيعاً</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {topProducts.map(p => (
                  <button key={p.id}
                    className="flex items-center gap-2 bg-amber-50 border border-amber-200 hover:border-amber-400 rounded-lg px-3 py-1.5 text-xs font-medium shrink-0 transition-colors"
                    onClick={() => addToCart(p)}>
                    <span>{catIcon(p.categoryName)}</span>
                    <span className="truncate max-w-[80px]">{p.name}</span>
                    <span className="text-amber-700 font-bold">{omr(n(p.price))}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loadingProducts && (
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border p-3 animate-pulse">
                    <div className="w-full aspect-square bg-gray-200 rounded-lg mb-2" />
                    <div className="h-3 bg-gray-200 rounded mb-1.5 w-3/4" />
                    <div className="h-3.5 bg-gray-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {!loadingProducts && products.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Package className="w-16 h-16 mb-3 opacity-20" />
                <p>لا توجد منتجات مطابقة</p>
                {search && <p className="text-xs mt-1">جرب بحثاً مختلفاً أو امسح الفلاتر</p>}
              </div>
            )}

            {!loadingProducts && (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {products.map(prod => {
                  const badge = stockBadge(prod.stockQty);
                  const outOfStock = prod.stockQty === 0;
                  return (
                    <button
                      key={prod.id}
                      className={`bg-white rounded-xl border text-right overflow-hidden transition-all group ${outOfStock
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:border-pink-400 hover:shadow-md hover:-translate-y-0.5 active:scale-95 cursor-pointer"}`}
                      onClick={() => !outOfStock && addToCart(prod)}
                      disabled={outOfStock}
                    >
                      {/* Image */}
                      <div className="relative bg-pink-50 aspect-square overflow-hidden">
                        {prod.image
                          ? <img src={prod.image} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          : <div className="w-full h-full flex items-center justify-center text-4xl">{catIcon(prod.categoryName)}</div>
                        }
                        {/* Stock badge */}
                        <span className={`absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {/* Qty badge */}
                        {!outOfStock && prod.stockQty < 10 && (
                          <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                            {prod.stockQty} متبقي
                          </span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-2.5">
                        <p className="text-xs font-semibold leading-tight line-clamp-2 mb-1.5 text-gray-800 min-h-[2rem]">{prod.name}</p>
                        <p className="text-sm font-bold text-pink-600" dir="ltr">{omr(n(prod.price))} ر.ع</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─ Modals ─ */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          branchName={branchName}
          cashierName={user.name}
          shiftId={shift?.id}
          onClose={() => { setCompletedSale(null); searchRef.current?.focus(); }}
        />
      )}
      {showHold && <HoldListModal onClose={() => setShowHold(false)} onResume={resumeHeld} />}
      {showCustomer && <CustomerModal onClose={() => setShowCustomer(false)} onSelect={c => { setCustomer(c); setShowCustomer(false); }} />}
      {showReturn && <ReturnModal onClose={() => setShowReturn(false)} />}

      {/* Confirm Clear Cart */}
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="max-w-xs" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-4 h-4" /> مسح السلة</DialogTitle>
          </DialogHeader>
          <DialogDescription>هل تريد مسح جميع المنتجات من السلة؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmClear(false)}>إلغاء</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={clearCart}>نعم، مسح الكل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
