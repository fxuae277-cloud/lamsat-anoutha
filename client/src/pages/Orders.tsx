/**
 * Orders.tsx — نظام إدارة الطلبات لمسة أنوثة
 * جلسة 10 | RTL | عملة OMR
 */
import { useState, useMemo, useEffect } from "react";
import {
  Plus, Search, X, Eye, Edit, Trash2,
  ShoppingBag, Clock, Truck, CheckCircle, XCircle,
  Package, User, Phone,
  RefreshCw, FileText, ArrowRight,
  MapPin, AlertTriangle, Download,
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
import { useI18n } from "@/lib/i18n";
import type { Branch } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderItem {
  id?: number;
  productId: number;
  variantId?: number;
  productName?: string;
  quantity: number;
  unitPrice: number | string;
  total?: number | string;
  color?: string;
  size?: string;
  costPrice?: number | string;
  stockQty?: number;
}

interface ProductVariantExt {
  id: number;
  color?: string;
  size?: string;
  price: string;
  sku?: string;
  barcode?: string;
  isDefault: boolean;
  stockQty: number;
}

interface Order {
  id: number;
  orderNumber: string;
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  isRegisteredCustomer?: boolean;
  registeredCustomerName?: string;
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

// ─── Constants (static keys — labels resolved via t() at render time) ──────────
const STATUS_KEYS: Record<string, { color: string; icon: any }> = {
  new:       { color: "bg-blue-100 text-blue-700 border-blue-200",          icon: Clock },
  preparing: { color: "bg-amber-100 text-amber-700 border-amber-200",        icon: Package },
  ready:     { color: "bg-emerald-100 text-emerald-700 border-emerald-200",  icon: CheckCircle },
  delivered: { color: "bg-purple-100 text-purple-700 border-purple-200",     icon: Truck },
  cancelled: { color: "bg-red-100 text-red-700 border-red-200",              icon: XCircle },
};

const SOURCE_KEYS: Record<string, { color: string }> = {
  whatsapp:  { color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  instagram: { color: "bg-purple-100 text-purple-700 border-purple-200" },
  call:      { color: "bg-blue-100 text-blue-700 border-blue-200" },
  "walk-in": { color: "bg-orange-100 text-orange-700 border-orange-200" },
};

const PAY_STATUS_COLORS: Record<string, string> = {
  unpaid:  "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
  paid:    "bg-emerald-100 text-emerald-700",
};

const PAY_METHOD_COLORS: Record<string, string> = {
  cash:          "bg-emerald-100 text-emerald-700",
  card:          "bg-blue-100 text-blue-700",
  bank_transfer: "bg-purple-100 text-purple-700",
};

const n = (v: any) => parseFloat(String(v || "0")) || 0;
const omr = (v: number) => v.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ─── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-pink-100 text-pink-700",
  "bg-purple-100 text-purple-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
];
function avatarColor(name: string) {
  let s = 0;
  for (let i = 0; i < name.length; i++) s += name.charCodeAt(i);
  return AVATAR_COLORS[s % AVATAR_COLORS.length];
}

// ─── Stats Cards ───────────────────────────────────────────────────────────────
function pctChange(curr: number, prev: number): { pct: number; label: string; color: string } | null {
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return { pct: 100, label: "+100%", color: "text-emerald-600" };
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct === 0) return { pct: 0, label: "±0%", color: "text-gray-400" };
  return {
    pct,
    label: `${pct > 0 ? "+" : ""}${pct}%`,
    color: pct > 0 ? "text-emerald-600" : "text-red-500",
  };
}

function StatsCards({ stats, t }: { stats: any; t: (key: string) => string }) {
  const s = stats || {};
  const cards = [
    {
      key: "new_count", thisKey: "this_month_new", prevKey: "prev_month_new",
      labelKey: "orders_page.status_new", color: "text-blue-600", bg: "bg-blue-50 border-blue-100", icon: Clock,
    },
    {
      key: "preparing_count", thisKey: "this_month_preparing", prevKey: "prev_month_preparing",
      labelKey: "orders_page.status_preparing", color: "text-amber-600", bg: "bg-amber-50 border-amber-100", icon: Package,
    },
    {
      key: "ready_count", thisKey: "this_month_ready", prevKey: "prev_month_ready",
      labelKey: "orders_page.status_ready", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", icon: CheckCircle,
    },
    {
      key: "delivered_count", thisKey: "this_month_delivered", prevKey: "prev_month_delivered",
      labelKey: "orders_page.status_delivered", color: "text-purple-600", bg: "bg-purple-50 border-purple-100", icon: Truck,
    },
    {
      key: "cancelled_count", thisKey: "this_month_cancelled", prevKey: "prev_month_cancelled",
      labelKey: "orders_page.status_cancelled", color: "text-red-600", bg: "bg-red-50 border-red-100", icon: XCircle,
    },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cards.map(c => {
        const Icon   = c.icon;
        const curr   = Number(s[c.thisKey] || 0);
        const prev   = Number(s[c.prevKey] || 0);
        const change = pctChange(curr, prev);
        const todayNew = c.key === "new_count" ? Number(s.today_new || 0) : null;
        return (
          <div key={c.key} className={`${c.bg} border rounded-xl p-3`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${c.color} shrink-0`} />
              <p className="text-xs text-muted-foreground">{t(c.labelKey)}</p>
            </div>
            <p className={`text-2xl font-bold ${c.color}`}>{s[c.key] || 0}</p>
            <div className="mt-1.5 space-y-0.5">
              {change && (
                <p className={`text-[11px] font-medium flex items-center gap-1 ${change.color}`}>
                  <span>{change.label}</span>
                  <span className="text-muted-foreground font-normal">{t("orders_page.stat_from_last_month")}</span>
                </p>
              )}
              {todayNew !== null && todayNew > 0 && (
                <p className="text-[11px] text-blue-500 font-medium">+{todayNew} {t("orders_page.stat_today")}</p>
              )}
              {!change && todayNew === null && (
                <p className="text-[11px] text-muted-foreground">{t("orders_page.stat_this_month")} {curr}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Product Table Row ─────────────────────────────────────────────────────────
interface ProductExt extends Product { barcode?: string; }

const stockColor = (qty?: number) => {
  if (!qty || qty <= 0) return "bg-red-100 text-red-700 border-red-200";
  if (qty <= 5)         return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
};

function ProductTableRow({ item, idx, onUpdate, onRemove, t }: {
  item: OrderItem;
  idx: number;
  onUpdate: (idx: number, updates: Partial<OrderItem>) => void;
  onRemove: (idx: number) => void;
  t: (key: string) => string;
}) {
  const [search, setSearch]           = useState(item.productName || "");
  const [showDrop, setShowDrop]       = useState(false);
  const [linkedPrice, setLinkedPrice] = useState<number | null>(item.productId > 0 ? n(item.unitPrice) : null);
  const [priceStr, setPriceStr]       = useState(item.productId > 0 ? omr(n(item.unitPrice)) : "");
  const [variants, setVariants]       = useState<ProductVariantExt[]>([]);
  const [loadingV, setLoadingV]       = useState(false);
  const [results, setResults]         = useState<ProductExt[]>([]);

  useEffect(() => {
    if (item.productId > 0) setPriceStr(omr(n(item.unitPrice)));
  }, [item.productId]);

  // بحث فوري عند الكتابة
  useEffect(() => {
    if (search.trim().length < 1) { setResults([]); return; }
    const ctrl = new AbortController();
    fetch(`/api/orders/product-search?search=${encodeURIComponent(search.trim())}`, {
      credentials: "include",
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setResults(data); else setResults([]); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [search]);

  const fetchVariants = async (productId: number) => {
    setLoadingV(true);
    try {
      const res = await fetch(`/api/products/${productId}/variants-with-stock`, { credentials: "include" });
      const data: ProductVariantExt[] = await res.json();
      setVariants(data);
      if (data.length === 1) applyVariant(data[0]);
    } finally {
      setLoadingV(false);
    }
  };

  const applyVariant = (v: ProductVariantExt) => {
    const price = n(v.price);
    setLinkedPrice(price);
    setPriceStr(omr(price));
    onUpdate(idx, { variantId: v.id, color: v.color || undefined, size: v.size || undefined, unitPrice: price, stockQty: v.stockQty });
  };

  const selectProduct = async (p: ProductExt) => {
    const price = n(p.price);
    setSearch(p.name);
    setShowDrop(false);
    setLinkedPrice(price);
    setPriceStr(omr(price));
    setVariants([]);
    onUpdate(idx, { productId: p.id, productName: p.name, unitPrice: price, costPrice: n(p.avgCost), stockQty: p.stockQty, variantId: undefined, color: undefined, size: undefined });
    await fetchVariants(p.id);
  };

  const isPriceModified = linkedPrice !== null && Math.abs(n(priceStr.replace(/,/g, "")) - linkedPrice) > 0.0001;

  const colors  = [...new Set(variants.map(v => v.color).filter(Boolean))] as string[];
  const hasColors = colors.length > 0;
  const sizes   = [...new Set(variants.filter(v => !item.color || v.color === item.color).map(v => v.size).filter(Boolean))] as string[];
  const hasSizes = sizes.length > 0;

  const selectedVariant = variants.find(v =>
    (!item.color || v.color === item.color) &&
    (!item.size  || v.size  === item.size)
  );

  return (
    <tr className="border-b">
      <td colSpan={5} className="px-2 py-2">
        <div className="space-y-2">
          {/* صف البحث */}
          <div className="flex gap-1 items-center">
            <div className="relative flex-1">
              <Input
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setShowDrop(true);
                  setLinkedPrice(null);
                  setPriceStr("");
                  setVariants([]);
                  onUpdate(idx, { productName: e.target.value, productId: 0, unitPrice: 0, variantId: undefined, color: undefined, size: undefined });
                }}
                onFocus={() => search.length >= 1 && setShowDrop(true)}
                onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                placeholder={t("orders_page.product_search_placeholder")}
                className="h-8 text-xs"
              />
              {showDrop && results.length > 0 && (
                <div className="absolute top-full right-0 left-0 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto mt-0.5" style={{ zIndex: 9999 }}>
                  {results.map(p => (
                    <button key={p.id} type="button"
                      className="w-full text-start flex items-center gap-2 px-3 py-2 hover:bg-pink-50 border-b border-gray-50 last:border-0"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => selectProduct(p)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        {p.barcode && <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{p.barcode}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${stockColor(p.stockQty)}`}>
                          {p.stockQty ?? 0} {t("orders_page.variant_qty_suffix")}
                        </span>
                        <span className="text-pink-600 font-bold text-xs">{omr(n(p.price))} ر.ع</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <BarcodeScanButton onScan={barcode => { setSearch(barcode); setShowDrop(true); }} />

            {/* الكمية */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-muted-foreground">{t("orders_page.form_qty_label")}</span>
              <Input type="number" min="1" value={item.quantity}
                onChange={e => onUpdate(idx, { quantity: parseInt(e.target.value) || 1 })}
                className="w-16 h-8 text-center text-xs" dir="ltr" />
            </div>

            {/* السعر */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-muted-foreground">{t("orders_page.form_price_label")}</span>
              <div className="relative">
                <Input type="text" inputMode="decimal" dir="ltr"
                  value={priceStr}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^\d.]/g, "");
                    setPriceStr(raw);
                    onUpdate(idx, { unitPrice: parseFloat(raw) || 0 });
                  }}
                  onBlur={() => {
                    const v = parseFloat(priceStr.replace(/,/g, "")) || 0;
                    setPriceStr(omr(v));
                    onUpdate(idx, { unitPrice: v });
                  }}
                  placeholder="0.000"
                  className={`w-24 h-8 text-xs ${item.productId > 0 ? isPriceModified ? "border-amber-400 bg-amber-50" : "border-emerald-400 bg-emerald-50" : ""}`}
                />
                {item.productId > 0 && (
                  <span className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] ${isPriceModified ? "text-amber-500" : "text-emerald-500"}`}>
                    {isPriceModified ? "✎" : "🔗"}
                  </span>
                )}
              </div>
            </div>

            {/* الإجمالي */}
            <div className="shrink-0 text-xs font-bold text-pink-600 min-w-[70px] text-end" dir="ltr">
              {omr(n(item.unitPrice) * item.quantity)} ر.ع
            </div>

            {/* حذف */}
            <button type="button" onClick={() => onRemove(idx)}
              className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* اختيار اللون والمقاس */}
          {loadingV && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <div className="w-3 h-3 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
              {t("orders_page.loading_variants")}
            </div>
          )}

          {!loadingV && item.productId > 0 && variants.length > 0 && (hasColors || hasSizes) && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 space-y-2.5">
              {/* ألوان */}
              {hasColors && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-gray-500">{t("orders_page.color_label")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {colors.map(color => {
                      const colorVariants = variants.filter(v => v.color === color);
                      const totalStock = colorVariants.reduce((s, v) => s + v.stockQty, 0);
                      const isSelected = item.color === color;
                      return (
                        <button key={color} type="button"
                          onClick={() => {
                            onUpdate(idx, { color, size: undefined, variantId: undefined });
                            const cv = colorVariants.find(v => !v.size) || colorVariants[0];
                            if (cv && colorVariants.length === 1) applyVariant(cv);
                          }}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                            isSelected
                              ? "border-pink-500 bg-pink-100 text-pink-700 ring-2 ring-pink-300 ring-offset-1"
                              : "border-gray-200 bg-white hover:border-pink-300 hover:bg-pink-50"
                          } ${totalStock === 0 ? "opacity-40" : ""}`}>
                          {color}
                          <span className={`me-1 text-[10px] ${stockColor(totalStock).split(" ")[1]}`}>
                            ({totalStock})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* مقاسات */}
              {hasSizes && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-gray-500">{t("orders_page.size_label")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sizes.map(size => {
                      const sv = variants.find(v => v.size === size && (!item.color || v.color === item.color));
                      const qty = sv?.stockQty ?? 0;
                      const isSelected = item.size === size;
                      return (
                        <button key={size} type="button"
                          onClick={() => sv && applyVariant(sv)}
                          disabled={qty === 0}
                          className={`min-w-[38px] px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                            isSelected
                              ? "border-pink-500 bg-pink-600 text-white ring-2 ring-pink-300 ring-offset-1"
                              : qty === 0
                                ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                                : "border-gray-200 bg-white hover:border-pink-300 hover:bg-pink-50"
                          }`}>
                          {size}
                          <span className={`block text-[9px] leading-none mt-0.5 ${isSelected ? "text-pink-200" : qty === 0 ? "text-gray-300" : "text-muted-foreground"}`}>
                            {qty === 0 ? t("orders_page.out_of_stock") : qty}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* معلومات الـ variant المحدد */}
              {selectedVariant && (
                <div className="flex items-center gap-3 text-xs pt-1 border-t border-gray-200">
                  {item.color && <span className="text-gray-600">{t("orders_page.variant_color")} <b>{item.color}</b></span>}
                  {item.size  && <span className="text-gray-600">{t("orders_page.variant_size")} <b>{item.size}</b></span>}
                  <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${stockColor(selectedVariant.stockQty)}`}>
                    {t("orders_page.variant_stock")} {selectedVariant.stockQty} {t("orders_page.variant_qty_suffix")}
                  </span>
                  {isPriceModified && linkedPrice !== null && (
                    <button type="button" className="text-emerald-600 underline"
                      onClick={() => { setPriceStr(omr(linkedPrice)); onUpdate(idx, { unitPrice: linkedPrice }); }}>
                      ↩ {omr(linkedPrice)} ر.ع
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Order Form Modal ──────────────────────────────────────────────────────────
function OrderFormModal({ order, onClose, onSaved }: {
  order?: Order | null; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const { t, lang } = useI18n();
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
  const emptyRow: OrderItem = { productId: 0, quantity: 1, unitPrice: 0 };
  const [items, setItems]   = useState<OrderItem[]>(order?.items?.length ? order.items : [{ ...emptyRow }]);
  const [branchId, setBranchId] = useState(order?.branchId || user?.branchId || 0);

  const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "returnNull" }) });

  useEffect(() => {
    if (!branchId && branches.length > 0) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId]);

  const updateItem = (idx: number, updates: Partial<OrderItem>) =>
    setItems(prev => prev.map((x, xi) => xi === idx ? { ...x, ...updates } : x));
  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, xi) => xi !== idx));
  const addRow = () =>
    setItems(prev => [...prev, { ...emptyRow }]);

  const subtotal = items.reduce((s, i) => s + n(i.unitPrice) * i.quantity, 0);
  const discVal = n(discount);
  const feeVal  = n(deliveryFee);
  const total   = Math.max(0, subtotal - discVal + feeVal);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!customerName.trim()) throw new Error(t("orders_page.form_customer_name"));
      const validItems = items.filter(i => i.productId && i.productId > 0);
      if (validItems.length === 0) throw new Error(t("orders_page.form_products"));
      const body = {
        customerName, customerPhone, customerId, source, deliveryMethod, deliveryAddress,
        deliveryFee: feeVal.toFixed(3), subtotal: subtotal.toFixed(3),
        discount: discVal.toFixed(3), total: total.toFixed(3),
        paymentMethod, paymentStatus, notes, branchId,
        items: validItems.map(i => ({
          productId: i.productId, variantId: i.variantId || null,
          quantity: i.quantity,
          unitPrice: n(i.unitPrice).toFixed(3),
          total: (n(i.unitPrice) * i.quantity).toFixed(3),
          costPrice: n(i.costPrice).toFixed(3),
          color: i.color || null, size: i.size || null,
        })),
      };
      if (isEdit) return apiRequest("PUT", `/api/orders/${order!.id}`, body).then(r => r.json());
      return apiRequest("POST", "/api/orders", body).then(r => r.json());
    },
    onSuccess: () => { toast({ title: isEdit ? t("orders_page.toast_order_updated") : t("orders_page.toast_order_created") }); onSaved(); },
    onError: (e: Error) => toast({ title: t("orders_page.toast_error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-pink-600" />
            {isEdit ? `${t("orders_page.form_title_edit")} ${order?.orderNumber}` : t("orders_page.form_title_new")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t("orders_page.form_customer_name")}</label>
              <Input value={customerName} onChange={e => { setCustomerName(e.target.value); setCustomerId(null); }} placeholder={t("orders_page.form_customer_placeholder")} className="h-9" />
            </div>
            <div className="space-y-1 relative">
              <label className="text-xs font-medium text-gray-600">{t("orders_page.form_phone")} {customerId && <span className="text-green-600 text-[10px]">{t("orders_page.form_registered")}</span>}</label>
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
                      className="w-full text-start flex items-center gap-2 px-3 py-2 hover:bg-pink-50 text-sm"
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
              <label className="text-xs font-medium text-gray-600">{t("orders_page.form_source")}</label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">{t("orders_page.source_walkin_opt")}</SelectItem>
                  <SelectItem value="whatsapp">{t("orders_page.source_whatsapp_opt")}</SelectItem>
                  <SelectItem value="instagram">{t("orders_page.source_instagram_opt")}</SelectItem>
                  <SelectItem value="call">{t("orders_page.source_call_opt")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t("orders_page.form_delivery_method")}</label>
              <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">{t("orders_page.delivery_pickup_opt")}</SelectItem>
                  <SelectItem value="delivery">{t("orders_page.delivery_delivery_opt")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t("orders_page.form_branch")}</label>
              <Select value={String(branchId)} onValueChange={v => setBranchId(Number(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.address ? `${b.name} - ${b.address}` : b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {deliveryMethod === "delivery" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t("orders_page.form_delivery_address")}</label>
                <Input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder={t("orders_page.form_delivery_address_placeholder")} className="h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{t("orders_page.form_delivery_fee")}</label>
                <Input type="number" step="0.001" min="0" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} dir="ltr" className="h-9" />
              </div>
            </div>
          )}

          {/* Products Table */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">{t("orders_page.form_products")}</label>
            <div className="border rounded-lg" style={{ overflow: "visible" }}>
              <div className="bg-gray-50 border-b px-3 py-2 flex items-center gap-4 text-xs font-semibold text-muted-foreground rounded-t-lg">
                <span className="flex-1">{t("orders_page.form_col_product")}</span>
                <span className="w-20 text-center">{t("orders_page.form_col_qty")}</span>
                <span className="w-24 text-center">{t("orders_page.form_col_price")}</span>
                <span className="w-20 text-center">{t("orders_page.form_col_total")}</span>
                <span className="w-6"></span>
              </div>
              <table className="w-full">
                <tbody>
                  {items.map((item, idx) => (
                    <ProductTableRow
                      key={idx}
                      item={item}
                      idx={idx}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                      t={t}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1 w-full border-dashed" onClick={addRow}>
              <Plus className="w-3 h-3" /> {t("orders_page.form_add_product")}
            </Button>
          </div>

          {/* Payment */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t("orders_page.form_payment_method")}</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("orders_page.pay_cash_opt")}</SelectItem>
                  <SelectItem value="card">{t("orders_page.pay_card_opt")}</SelectItem>
                  <SelectItem value="bank_transfer">{t("orders_page.pay_bank_opt")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t("orders_page.form_payment_status")}</label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">{t("orders_page.pay_unpaid_opt")}</SelectItem>
                  <SelectItem value="partial">{t("orders_page.pay_partial_opt")}</SelectItem>
                  <SelectItem value="paid">{t("orders_page.pay_paid_opt")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{t("orders_page.form_discount")}</label>
              <Input type="number" step="0.001" min="0" value={discount} onChange={e => setDiscount(e.target.value)} dir="ltr" className="h-9" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">{t("orders_page.form_notes")}</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder={t("orders_page.form_notes_placeholder")} className="h-9" />
          </div>

          {/* Summary */}
          <div className="bg-pink-50 border border-pink-100 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("orders_page.form_subtotal")}</span><span dir="ltr">{omr(subtotal)} ر.ع</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-600">
              <span>{t("orders_page.form_discount_label")}</span><span dir="ltr">- {omr(discVal)} ر.ع</span>
            </div>
            {feeVal > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("orders_page.form_delivery_fee_label")}</span><span dir="ltr">+ {omr(feeVal)} ر.ع</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-pink-200 pt-1.5">
              <span>{t("orders_page.form_total")}</span><span className="text-pink-600 text-base" dir="ltr">{omr(total)} ر.ع</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{t("orders_page.form_cancel")}</Button>
          <Button className="bg-pink-600 hover:bg-pink-700" size="sm"
            onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? t("orders_page.form_saving") : isEdit ? t("orders_page.form_save_edit") : t("orders_page.form_save_new")}
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
  const { t, lang } = useI18n();
  const [status, setStatus]       = useState(order.status);
  const [showConvert, setShowConvert] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState(String(n(order.total)));

  const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    new:       { label: t("orders_page.status_new"),       color: "bg-blue-100 text-blue-700 border-blue-200",          icon: Clock },
    preparing: { label: t("orders_page.status_preparing"), color: "bg-amber-100 text-amber-700 border-amber-200",        icon: Package },
    ready:     { label: t("orders_page.status_ready"),     color: "bg-emerald-100 text-emerald-700 border-emerald-200",  icon: CheckCircle },
    delivered: { label: t("orders_page.status_delivered"), color: "bg-purple-100 text-purple-700 border-purple-200",     icon: Truck },
    cancelled: { label: t("orders_page.status_cancelled"), color: "bg-red-100 text-red-700 border-red-200",              icon: XCircle },
  };

  const statusMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/orders/${order.id}/status`, { status }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: t("orders_page.toast_status_updated") });
      if (status === "delivered" && !order.invoiceId) { setShowConvert(true); return; }
      onSaved();
    },
    onError: (e: Error) => toast({ title: t("orders_page.toast_error"), description: e.message, variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/orders/${order.id}/convert-to-invoice`, {
      paymentMethod: payMethod, amountPaid: n(amountPaid).toFixed(3),
    }).then(r => r.json()),
    onSuccess: () => { toast({ title: t("orders_page.toast_converted") }); onSaved(); },
    onError: (e: Error) => toast({ title: t("orders_page.toast_error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader><DialogTitle>{t("orders_page.status_modal_title")} {order.orderNumber}</DialogTitle></DialogHeader>
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
                    {status === val && <CheckCircle className="w-4 h-4 text-pink-600 me-auto" />}
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>{t("orders_page.form_cancel")}</Button>
              <Button size="sm" className="bg-pink-600 hover:bg-pink-700"
                onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending || status === order.status}>
                {statusMutation.isPending ? t("orders_page.status_updating") : t("orders_page.status_update_btn")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-emerald-800">{t("orders_page.convert_title")}</p>
              <p className="text-xs text-muted-foreground">{t("orders_page.convert_subtitle")}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ["cash", t("orders_page.pay_cash_opt")],
                  ["card", t("orders_page.pay_card_opt")],
                  ["bank_transfer", t("orders_page.pay_bank_opt")],
                ].map(([v,l]) => (
                  <button key={v}
                    className={`py-1.5 rounded-lg border text-xs font-medium transition-colors ${payMethod===v?"bg-emerald-600 text-white border-emerald-600":"border-gray-200 hover:bg-gray-100"}`}
                    onClick={() => setPayMethod(v)}>{l}</button>
                ))}
              </div>
              <Input type="number" step="0.001" placeholder={t("orders_page.convert_amount_placeholder")}
                value={amountPaid} onChange={e => setAmountPaid(e.target.value)} dir="ltr" className="h-8 text-sm" />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onSaved}>{t("orders_page.convert_later")}</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
                {convertMutation.isPending ? t("orders_page.converting") : t("orders_page.convert_btn")}
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
  const { t, lang } = useI18n();

  const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    new:       { label: t("orders_page.status_new"),       color: "bg-blue-100 text-blue-700 border-blue-200",          icon: Clock },
    preparing: { label: t("orders_page.status_preparing"), color: "bg-amber-100 text-amber-700 border-amber-200",        icon: Package },
    ready:     { label: t("orders_page.status_ready"),     color: "bg-emerald-100 text-emerald-700 border-emerald-200",  icon: CheckCircle },
    delivered: { label: t("orders_page.status_delivered"), color: "bg-purple-100 text-purple-700 border-purple-200",     icon: Truck },
    cancelled: { label: t("orders_page.status_cancelled"), color: "bg-red-100 text-red-700 border-red-200",              icon: XCircle },
  };
  const SOURCE_MAP: Record<string, { label: string; color: string }> = {
    whatsapp:  { label: t("orders_page.source_whatsapp"), color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    instagram: { label: t("orders_page.source_instagram"), color: "bg-purple-100 text-purple-700 border-purple-200" },
    call:      { label: t("orders_page.source_call"),     color: "bg-blue-100 text-blue-700 border-blue-200" },
    "walk-in": { label: t("orders_page.source_walkin"),   color: "bg-orange-100 text-orange-700 border-orange-200" },
  };
  const PAY_STATUS_MAP: Record<string, { label: string; color: string }> = {
    unpaid:  { label: t("orders_page.pay_unpaid"),  color: "bg-red-100 text-red-700" },
    partial: { label: t("orders_page.pay_partial"), color: "bg-amber-100 text-amber-700" },
    paid:    { label: t("orders_page.pay_paid"),    color: "bg-emerald-100 text-emerald-700" },
  };

  const st  = STATUS_MAP[order.status] || STATUS_MAP.new;
  const src = SOURCE_MAP[order.source] || SOURCE_MAP["walk-in"];
  const pay = PAY_STATUS_MAP[order.paymentStatus || "unpaid"];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-pink-600" />
            {t("orders_page.detail_title")} {order.orderNumber}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={`${st.color} text-xs`}>{st.label}</Badge>
            <Badge variant="outline" className={`${src.color} text-xs`}>{src.label}</Badge>
            <Badge variant="outline" className={`${pay.color} text-xs`}>{pay.label}</Badge>
            {order.invoiceId && <Badge className="bg-purple-100 text-purple-700 text-xs">{t("orders_page.badge_invoice")} #{order.invoiceId}</Badge>}
          </div>
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">{t("orders_page.detail_customer_info")}</p>
            <div className="flex items-center gap-2 text-sm"><User className="w-3.5 h-3.5 text-gray-400" /><span className="font-medium">{order.customerName}</span></div>
            {order.customerPhone && <div className="flex items-center gap-2 text-sm"><Phone className="w-3.5 h-3.5 text-gray-400" /><span dir="ltr">{order.customerPhone}</span></div>}
            {order.deliveryAddress && <div className="flex items-center gap-2 text-sm"><MapPin className="w-3.5 h-3.5 text-gray-400" /><span>{order.deliveryAddress}</span></div>}
          </div>
          {order.items && order.items.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">{t("orders_page.detail_products")}</p>
              <div className="space-y-1.5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span>{item.productName || `#${item.productId}`} × {item.quantity}</span>
                    <span className="text-pink-600 font-medium" dir="ltr">{omr(n(item.unitPrice) * item.quantity)} ر.ع</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="border-t pt-3 space-y-1 text-sm">
            {n(order.discount) > 0 && <div className="flex justify-between text-emerald-600 text-xs"><span>{t("orders_page.detail_discount")}</span><span dir="ltr">- {omr(n(order.discount))} ر.ع</span></div>}
            {n(order.deliveryFee) > 0 && <div className="flex justify-between text-xs"><span>{t("orders_page.detail_delivery_fee")}</span><span dir="ltr">+ {omr(n(order.deliveryFee))} ر.ع</span></div>}
            <div className="flex justify-between font-bold"><span>{t("orders_page.detail_total")}</span><span className="text-pink-600" dir="ltr">{omr(n(order.total))} ر.ع</span></div>
          </div>
          {order.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
              <p className="font-medium mb-1">{t("orders_page.detail_notes_label")}</p><p>{order.notes}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{fmtDateTime(order.createdAt)}</p>
        </div>
        <DialogFooter><Button variant="outline" size="sm" onClick={onClose}>{t("orders_page.detail_close")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Orders Page ──────────────────────────────────────────────────────────
export default function Orders() {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data: authData } = useAuth();
  const user = authData?.user;
  const isManager = ["owner", "admin", "manager"].includes(user?.role || "");

  // Build label maps using t()
  const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    new:       { label: t("orders_page.status_new"),       color: "bg-blue-100 text-blue-700 border-blue-200",          icon: Clock },
    preparing: { label: t("orders_page.status_preparing"), color: "bg-amber-100 text-amber-700 border-amber-200",        icon: Package },
    ready:     { label: t("orders_page.status_ready"),     color: "bg-emerald-100 text-emerald-700 border-emerald-200",  icon: CheckCircle },
    delivered: { label: t("orders_page.status_delivered"), color: "bg-purple-100 text-purple-700 border-purple-200",     icon: Truck },
    cancelled: { label: t("orders_page.status_cancelled"), color: "bg-red-100 text-red-700 border-red-200",              icon: XCircle },
  };
  const SOURCE_MAP: Record<string, { label: string; color: string }> = {
    whatsapp:  { label: t("orders_page.source_whatsapp"), color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    instagram: { label: t("orders_page.source_instagram"), color: "bg-purple-100 text-purple-700 border-purple-200" },
    call:      { label: t("orders_page.source_call"),     color: "bg-blue-100 text-blue-700 border-blue-200" },
    "walk-in": { label: t("orders_page.source_walkin"),   color: "bg-orange-100 text-orange-700 border-orange-200" },
  };
  const PAY_METHOD_MAP: Record<string, { label: string; color: string }> = {
    cash:          { label: t("orders_page.pay_cash"),          color: "bg-emerald-100 text-emerald-700" },
    card:          { label: t("orders_page.pay_card"),          color: "bg-blue-100 text-blue-700" },
    bank_transfer: { label: t("orders_page.pay_bank_transfer"), color: "bg-purple-100 text-purple-700" },
  };

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [fromDate, setFromDate]       = useState("");
  const [toDate, setToDate]           = useState("");

  const [appliedSearch, setAppliedSearch]           = useState("");
  const [appliedStatus, setAppliedStatus]           = useState("all");
  const [appliedSource, setAppliedSource]           = useState("all");
  const [appliedFrom, setAppliedFrom]               = useState("");
  const [appliedTo, setAppliedTo]                   = useState("");

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
    queryKey: ["/api/orders/full", appliedSearch, appliedStatus, appliedSource, appliedFrom, appliedTo],
    queryFn: () => {
      const p = new URLSearchParams();
      if (appliedSearch) p.set("search", appliedSearch);
      if (appliedStatus !== "all") p.set("status", appliedStatus);
      if (appliedSource !== "all") p.set("source", appliedSource);
      if (appliedFrom) p.set("from", appliedFrom);
      if (appliedTo) p.set("to", appliedTo);
      return fetch(`/api/orders/full?${p}`, { credentials: "include" }).then(r => r.json());
    },
    placeholderData: prev => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/orders/${id}`).then(r => r.json()),
    onSuccess: () => { toast({ title: t("orders_page.toast_deleted") }); refresh(); setDeleteId(null); },
    onError: (e: Error) => toast({ title: t("orders_page.toast_error"), description: e.message, variant: "destructive" }),
  });

  const refresh = () => { refetch(); refetchStats(); };
  const applyFilters = () => {
    setAppliedSearch(search); setAppliedStatus(statusFilter);
    setAppliedSource(sourceFilter); setAppliedFrom(fromDate); setAppliedTo(toDate);
    setPage(1);
  };
  const clearFilters = () => {
    setSearch(""); setStatusFilter("all"); setSourceFilter("all"); setFromDate(""); setToDate("");
    setAppliedSearch(""); setAppliedStatus("all"); setAppliedSource("all"); setAppliedFrom(""); setAppliedTo("");
    setPage(1);
  };
  const hasFilters = !!(appliedSearch || appliedStatus !== "all" || appliedSource !== "all" || appliedFrom || appliedTo);
  const hasPendingChange = search !== appliedSearch || statusFilter !== appliedStatus || sourceFilter !== appliedSource || fromDate !== appliedFrom || toDate !== appliedTo;

  const exportCSV = () => {
    const rows = [
      [
        t("orders_page.csv_col_order_num"),
        t("orders_page.csv_col_customer"),
        t("orders_page.csv_col_phone"),
        t("orders_page.csv_col_status"),
        t("orders_page.csv_col_source"),
        t("orders_page.csv_col_payment"),
        t("orders_page.csv_col_total"),
        t("orders_page.csv_col_date"),
      ],
      ...safeOrders.map(o => [
        o.orderNumber,
        o.customerName,
        o.customerPhone || "",
        STATUS_MAP[o.status]?.label || o.status,
        SOURCE_MAP[o.source]?.label || o.source,
        PAY_METHOD_MAP[o.paymentMethod || ""]?.label || o.paymentMethod || "",
        omr(n(o.total)),
        fmtDate(o.createdAt),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const safeOrders = Array.isArray(orders) ? orders : [];
  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return safeOrders.slice(start, start + PER_PAGE);
  }, [safeOrders, page]);
  const totalPages = Math.ceil(safeOrders.length / PER_PAGE);

  return (
    <div className="p-4 md:p-6 space-y-4" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-pink-600" /> {t("orders_page.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("orders_page.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-1.5 h-9 text-sm border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={exportCSV}>
            <Download className="w-4 h-4" /> {t("orders_page.btn_export_csv")}
          </Button>
          <Button className="bg-pink-600 hover:bg-pink-700 gap-1.5" onClick={() => { setEditOrder(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> {t("orders_page.btn_new_order")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} t={t} />

      {/* Filters */}
      <div className="bg-white rounded-xl border p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <Input placeholder={t("orders_page.search_placeholder")} value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applyFilters()}
              className="pe-9 h-8 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v)}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder={t("orders_page.filter_all_statuses")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders_page.filter_all_statuses")}</SelectItem>
              {Object.entries(STATUS_MAP).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={v => setSourceFilter(v)}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder={t("orders_page.filter_all_sources")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders_page.filter_all_sources")}</SelectItem>
              {Object.entries(SOURCE_MAP).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateInput value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 w-36 text-xs" />
          <DateInput value={toDate}   onChange={e => setToDate(e.target.value)}   className="h-8 w-36 text-xs" />
          <Button size="sm"
            className={`h-8 text-xs gap-1 ${hasPendingChange ? "bg-pink-600 hover:bg-pink-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            onClick={applyFilters}>
            <Search className="w-3 h-3" /> {t("orders_page.btn_search")}
          </Button>
          {hasFilters && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-red-500 border-red-200 hover:bg-red-50" onClick={clearFilters}>
              <X className="w-3 h-3" /> {t("orders_page.btn_clear")}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{orders.length} {t("orders_page.orders_count")}</p>
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
            <p>{t("orders_page.no_orders")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  {[
                    t("orders_page.col_order_num"),
                    t("orders_page.col_customer"),
                    t("orders_page.col_products"),
                    t("orders_page.col_amount"),
                    t("orders_page.col_status"),
                    t("orders_page.col_payment"),
                    t("orders_page.col_source"),
                    t("orders_page.col_date"),
                    t("orders_page.col_actions"),
                  ].map(h => (
                    <th key={h} className="text-start px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
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
                        {order.invoiceId && <span className="me-1 text-[10px] bg-purple-100 text-purple-600 px-1 rounded">{t("orders_page.badge_invoice")}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(order.customerName || "؟")}`}>
                            {(order.customerName || "؟").charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <p className="font-medium text-xs">{order.customerName}</p>
                              {order.isRegisteredCustomer && (
                                <span className="text-[9px] bg-green-100 text-green-700 border border-green-200 rounded-full px-1.5 py-0.5 font-medium whitespace-nowrap">{t("orders_page.badge_prev_customer")}</span>
                              )}
                            </div>
                            {order.customerPhone && <p className="text-[10px] text-muted-foreground" dir="ltr">{order.customerPhone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{(order.items?.length || 0)} {t("orders_page.product_count")}</td>
                      <td className="px-4 py-3 font-bold text-pink-600 text-xs" dir="ltr">{omr(n(order.total))} ر.ع</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`${st.color} text-[10px] gap-1`}>
                          <StIcon className="w-2.5 h-2.5" />{st.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {order.paymentMethod ? (
                          <Badge variant="outline" className={`${PAY_METHOD_MAP[order.paymentMethod]?.color || "bg-gray-100 text-gray-700"} text-[10px]`}>
                            {PAY_METHOD_MAP[order.paymentMethod]?.label || order.paymentMethod}
                          </Badge>
                        ) : <span className="text-[10px] text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`${src.color} text-[10px]`}>{src.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(order.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600" title={t("orders_page.detail_title")} onClick={() => setViewOrder(order)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {order.status !== "cancelled" && order.status !== "delivered" && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-amber-50 hover:text-amber-600" title={t("orders_page.status_modal_title")} onClick={() => setStatusOrder(order)}>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {order.status === "delivered" && !order.invoiceId && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-emerald-50 hover:text-emerald-600" title={t("orders_page.convert_btn")} onClick={() => setStatusOrder(order)}>
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-gray-100" title={t("orders_page.form_title_edit")} onClick={() => { setEditOrder(order); setShowForm(true); }}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          {isManager && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600" title={t("orders_page.delete_title")} onClick={() => setDeleteId(order.id)}>
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
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-8 text-xs">{t("orders_page.pagination_prev")}</Button>
          <span className="text-xs text-muted-foreground">
            {t("orders_page.pagination_info").replace("{page}", String(page)).replace("{total}", String(totalPages))}
          </span>
          <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="h-8 text-xs">{t("orders_page.pagination_next")}</Button>
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
        <DialogContent className="max-w-xs" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-4 h-4" /> {t("orders_page.delete_title")}</DialogTitle>
          </DialogHeader>
          <DialogDescription>{t("orders_page.delete_confirm")}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>{t("orders_page.delete_cancel")}</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? t("orders_page.deleting") : t("orders_page.delete_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
