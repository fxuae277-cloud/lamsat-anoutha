/**
 * POS.tsx — Point of Sale screen
 * RTL/LTR via <html dir>; OMR with 3 decimal places.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search, Plus, Minus, Trash2, CheckCircle2, Store, Monitor,
  Banknote, LogOut, User as UserIcon, XCircle, Clock, Printer,
  ArrowRight, Receipt, ShoppingCart, MessageSquare, Pause, Play,
  Tag, Package, Percent, CreditCard, Wallet, RotateCcw, ChevronDown,
  Phone, AlertTriangle, ZapOff, Loader2, Maximize2, Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { printInvoiceLocal } from "@/lib/localPrintClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fmtOMR, fmtDateTime, fmtDate } from "@/lib/formatters";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";
import { type BarcodeIndicatorState } from "@/components/BarcodeIndicator";
import { DevicePrintSettingsDialog } from "@/components/DevicePrintSettingsDialog";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useScannerSettings } from "@/hooks/useScannerSettings";
import { beepSuccess, beepError } from "@/lib/scannerBeep";
import type { Branch, Shift } from "@shared/schema";
import { queueSale, syncPending, getPendingCount, refreshProductCache, refreshCustomerCache } from "@/lib/sync-engine";

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

// CATEGORY_ICONS keys are intentionally Arabic — they match category names
// stored in the database and are NOT user-facing labels. DB migration TODO.
const CATEGORY_ICONS: Record<string, string> = {
  "خواتم": "💍", "حلقان": "💎", "أطقم": "👑",
  "عقود": "📿", "أساور": "⌚",
};
const catIcon = (name?: string) => CATEGORY_ICONS[name || ""] || "🛍️";

function useStockBadge() {
  const { t } = useI18n();
  return (qty: number) => {
    if (qty === 0) return { label: t("pos:stockBadge.out"),       cls: "bg-red-100 text-red-700 border-red-200" };
    if (qty < 5)  return { label: t("pos:stockBadge.low"),       cls: "bg-amber-100 text-amber-700 border-amber-200" };
    return            { label: t("pos:stockBadge.available"), cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  };
}

const uid = () => Math.random().toString(36).slice(2);

// ─── StartPOS ─────────────────────────────────────────────────────────────────
function StartPOS({ branchName, terminalName, userName, onShiftOpened }: {
  branchName: string; terminalName: string; userName: string;
  onShiftOpened: (shift: Shift) => void;
}) {
  const { toast } = useToast();
  const { t } = useI18n();
  const NS = "pos:startShift";
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
    onSuccess: (shift: Shift) => { toast({ title: t(`${NS}.openSuccess`) }); onShiftOpened(shift); },
    onError: (e: Error) => toast({ title: t("pos:messages.error"), description: e.message, variant: "destructive" }),
  });

  if (checking) return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground">{t(`${NS}.loading`)}</p>
      </div>
    </div>
  );

  const fields: [string, string, any][] = [
    [t(`${NS}.cashier`), userName, UserIcon],
    [t(`${NS}.branch`), branchName, Store],
    [t(`${NS}.terminal`), terminalName, Monitor],
  ];

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50">
      <div className="w-full max-w-md bg-white border border-pink-100 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-l from-pink-600 to-rose-500 p-8 text-center text-white">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Store className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold">{t(`${NS}.appName`)}</h1>
          <p className="text-pink-100 mt-1 text-sm">{t(`${NS}.subtitle`)}</p>
        </div>
        <div className="p-8 space-y-6">
          <div className="bg-pink-50 rounded-xl p-4 space-y-2 text-sm">
            {fields.map(([label, val, Icon]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {label}</span>
                <span className="font-semibold">{val}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t(`${NS}.openingCashLabel`)}</label>
            <Input
              type="number" step="0.001" min="0" placeholder={t(`${NS}.openingPlaceholder`)}
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
            {openShiftMutation.isPending ? t(`${NS}.opening`) : t(`${NS}.openShiftBtn`)}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── ReceiptModal ─────────────────────────────────────────────────────────────
// Printer name and paper width are read from the per-device profile inside
// `printInvoiceLocal` (localStorage on this PC) — they are NOT passed in
// from POS, so each cashier device prints to its own printer.
function ReceiptModal({ sale, onClose, branchName, cashierName, shiftId }: {
  sale: any; onClose: () => void;
  branchName: string; cashierName: string; shiftId?: number;
}) {
  const { toast } = useToast();
  const { t } = useI18n();
  const R = "pos:receipt";
  const W = "pos:whatsapp";
  const total  = n(sale.total);
  const paid   = n(sale.amountPaid ?? sale.amount_paid ?? total);
  const change = n(sale.changeAmount ?? sale.change_amount ?? 0);
  const [printing, setPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const printingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const paymentLabel = (method: string) =>
    method === "cash" ? t(`${R}.cash`) :
    method === "card" ? t(`${R}.card`) :
    t(`${R}.bank_transfer`);

  const handlePrint = async () => {
    if (printingRef.current) return;
    printingRef.current = true;
    setPrinting(true);
    try {
      const result = await printInvoiceLocal({
        invoiceNumber: sale.invoiceNumber || sale.invoice_number || "",
        createdAt:     sale.createdAt     || sale.created_at,
        cashierName:   cashierName,
        branchName:    branchName,
        customerName:  sale.customerName ?? null,
        items: (sale.items || []).map((i: any) => ({
          productName: i.productName || i.product_name || "",
          quantity:    i.quantity,
          unitPrice:   n(i.unitPrice ?? i.unit_price),
          color:       i.color,
          size:        i.size,
        })),
        subtotal:      n(sale.subtotal),
        discount:      n(sale.discount),
        vat:           n(sale.vat),
        total:         n(sale.total),
        amountPaid:    n(sale.amountPaid ?? sale.amount_paid ?? sale.total),
        changeAmount:  n(sale.changeAmount ?? sale.change_amount ?? 0),
        paymentMethod: sale.paymentMethod || sale.payment_method || "cash",
      });
      if (result.ok) {
        if (!result.ignoredDuplicate) {
          toast({ title: t(`${R}.printSuccess`) });
        }
        setPrintSuccess(true);
        closeTimerRef.current = window.setTimeout(() => {
          onClose();
        }, 800);
      } else {
        toast({ title: t(`${R}.printFailed`), description: result.error, variant: "destructive" });
      }
    } finally {
      setPrinting(false);
      printingRef.current = false;
    }
  };

  const handleWhatsApp = () => {
    const items = (sale.items || []).map((i: any) =>
      `  • ${i.productName || i.product_name} × ${i.quantity} = ${omr(n(i.unitPrice || i.unit_price) * i.quantity)} ر.ع`
    ).join("\n");
    const customerLine = sale.customerName
      ? t(`${W}.customerLine`, { name: sale.customerName }) + "\n"
      : "";
    const msg = encodeURIComponent(
      t(`${W}.appHeader`) + "\n" +
      t(`${W}.divider`) + "\n" +
      t(`${W}.invoiceLine`, { number: sale.invoiceNumber || sale.invoice_number }) + "\n" +
      t(`${W}.dateLine`, { date: fmtDate(sale.createdAt || sale.created_at) }) + "\n" +
      customerLine +
      "\n" + t(`${W}.productsHeader`) + "\n" + items + "\n\n" +
      t(`${W}.totalLine`, { amount: omr(total) }) + "\n" +
      t(`${W}.paidLine`, { amount: omr(paid) }) + "\n" +
      (n(change) > 0 ? t(`${W}.changeLine`, { amount: omr(change) }) + "\n" : "") +
      "\n" + t(`${W}.thankYou`)
    );
    const rawPhone = (sale.customerPhone || "").replace(/\D/g, "");
    if (!rawPhone) {
      window.open(`https://web.whatsapp.com/send?text=${msg}`, "_blank");
      return;
    }
    let phone = rawPhone;
    if (phone.startsWith("00968")) phone = phone.slice(2);
    else if (!phone.startsWith("968")) phone = `968${phone}`;
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${msg}`, "_blank");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" /> {t(`${R}.title`)}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm space-y-1 bg-gray-50 rounded-lg p-4 max-h-[50vh] overflow-y-auto">
          <p className="text-center font-bold text-base">{t(`${R}.appHeader`)}</p>
          <p className="text-center text-xs text-muted-foreground">{branchName}</p>
          <hr className="border-dashed my-1" />
          <div className="grid grid-cols-2 gap-x-2 text-xs">
            <span className="text-muted-foreground">{t(`${R}.invoiceNumber`)}</span>
            <span className="font-medium">{sale.invoiceNumber || sale.invoice_number}</span>
            <span className="text-muted-foreground">{t(`${R}.date`)}</span>
            <span>{fmtDateTime(sale.createdAt || sale.created_at)}</span>
            <span className="text-muted-foreground">{t(`${R}.cashier`)}</span>
            <span>{cashierName}</span>
            {sale.customerName && (<>
              <span className="text-muted-foreground">{t(`${R}.customerLabel`)}</span>
              <span>{sale.customerName}</span>
            </>)}
            {sale.customerPhone && (<>
              <span className="text-muted-foreground">{t(`${R}.phone`)}</span>
              <span dir="ltr">{sale.customerPhone}</span>
            </>)}
          </div>
          <hr className="border-dashed my-1" />
          <table className="w-full text-xs">
            <thead><tr>
              <th className="text-start pb-1">{t(`${R}.thProduct`)}</th>
              <th className="text-center">{t(`${R}.thQty`)}</th>
              <th className="text-end">{t(`${R}.thAmount`)}</th>
            </tr></thead>
            <tbody>
              {(sale.items || []).map((item: any, i: number) => (
                <tr key={i}>
                  <td>{item.productName || item.product_name}{item.color ? ` (${item.color})` : ""}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-end" dir="ltr">{omr(n(item.unitPrice || item.unit_price) * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr className="border-dashed my-1" />
          <div className="space-y-0.5 text-xs">
            {n(sale.discount) > 0 && (
              <div className="flex justify-between"><span>{t(`${R}.discount`)}</span><span dir="ltr">- {omr(n(sale.discount))} {t("pos:fallback.currency")}</span></div>
            )}
            <div className="flex justify-between font-bold text-sm">
              <span>{t(`${R}.total`)}</span><span dir="ltr">{omr(total)} {t("pos:fallback.currency")}</span>
            </div>
            <div className="flex justify-between"><span>{t(`${R}.paid`)}</span><span dir="ltr">{omr(paid)} {t("pos:fallback.currency")}</span></div>
            {change > 0 && <div className="flex justify-between text-emerald-600"><span>{t(`${R}.change`)}</span><span dir="ltr">{omr(change)} {t("pos:fallback.currency")}</span></div>}
            <div className="flex justify-between text-muted-foreground">
              <span>{t(`${R}.paymentMethod`)}</span>
              <span>{paymentLabel(sale.paymentMethod)}</span>
            </div>
          </div>
          <hr className="border-dashed my-1" />
          <p className="text-center text-xs text-muted-foreground">{t(`${R}.thankYou`)}</p>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-start">
          <Button size="sm" onClick={handlePrint} disabled={printing || printSuccess} className="bg-pink-600 hover:bg-pink-700 gap-1">
            {printing ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t(`${R}.printing`)}</>
            ) : printSuccess ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> {t(`${R}.printed`)}</>
            ) : (
              <><Printer className="w-3.5 h-3.5" /> {t(`${R}.printBtn`)}</>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={handleWhatsApp} className="gap-1 border-emerald-500 text-emerald-700 hover:bg-emerald-50">
            <MessageSquare className="w-3.5 h-3.5" /> {t(`${R}.whatsappBtn`)}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>{t(`${R}.closeBtn`)}</Button>
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
  const { t } = useI18n();
  const NS = "pos:holdList";
  const qc = useQueryClient();
  const { data: held = [], isLoading } = useQuery<HeldInvoice[]>({
    queryKey: ["/api/pos/held"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pos/held/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pos/held"] }); toast({ title: t(`${NS}.deleteSuccess`) }); },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/pos/held/${id}/resume`).then(r => r.json()),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ["/api/pos/held"] }); onResume(data); },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pause className="w-4 h-4 text-amber-500" /> {t(`${NS}.title`)}</DialogTitle></DialogHeader>
        {isLoading && <p className="text-center text-sm text-muted-foreground py-4">{t(`${NS}.loading`)}</p>}
        {!isLoading && held.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">{t(`${NS}.empty`)}</p>
        )}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {held.map(h => (
            <div key={h.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50">
              <div>
                <p className="font-medium text-sm">{h.hold_number}</p>
                <p className="text-xs text-muted-foreground">
                  {h.customer_name || t("pos:fallback.noCustomer")} · {t(`${NS}.itemCount`, { count: h.items.length })}
                </p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(h.created_at)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1 h-7 text-xs"
                  onClick={() => resumeMutation.mutate(h.id)} disabled={resumeMutation.isPending}>
                  <Play className="w-3 h-3" /> {t(`${NS}.resume`)}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700"
                  onClick={() => deleteMutation.mutate(h.id)} disabled={deleteMutation.isPending}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" size="sm" onClick={onClose}>{t(`${NS}.close`)}</Button></DialogFooter>
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
  const { t } = useI18n();
  const NS = "pos:customer";
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"search" | "new">("search");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [existsOtherBranch, setExistsOtherBranch] = useState<{ id: number; name: string; phone: string } | null>(null);

  const { data: allCustomers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers/search", ""],
    queryFn: () => fetch(`/api/customers/search`, { credentials: "include" }).then(r => r.json()),
  });

  const results = search.trim()
    ? allCustomers.filter(c =>
        (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || "").includes(search)
      )
    : allCustomers;

  const linkBranchMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/customers/${id}/link-branch`, {}).then(r => r.json()),
    onSuccess: (c) => {
      toast({ title: t(`${NS}.linkSuccess`) });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/search"] });
      setExistsOtherBranch(null);
      onSelect(c);
    },
    onError: (e: Error) => toast({ title: t(`${NS}.errorGeneric`), description: e.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/customers", { name: newName, phone: newPhone }).then(async r => {
      if (!r.ok) {
        const body = await r.json();
        if (body.code === "exists_other_branch") { setExistsOtherBranch(body.customer); throw new Error("exists_other_branch"); }
        throw new Error(body.message || t(`${NS}.errorGeneric`));
      }
      return r.json();
    }),
    onSuccess: (c) => {
      toast({ title: t(`${NS}.addSuccess`) });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/search"] });
      onSelect(c);
    },
    onError: (e: Error) => { if (e.message !== "exists_other_branch") toast({ title: t(`${NS}.errorGeneric`), description: e.message, variant: "destructive" }); },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserIcon className="w-4 h-4" /> {t(`${NS}.title`)}</DialogTitle></DialogHeader>

        {existsOtherBranch && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
            <p className="text-sm font-medium text-amber-800">⚠️ {t(`${NS}.existsOtherBranch`)}</p>
            <p className="text-xs text-amber-700">{existsOtherBranch.name} — {existsOtherBranch.phone}</p>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs bg-amber-600 hover:bg-amber-700"
                onClick={() => linkBranchMutation.mutate(existsOtherBranch.id)}
                disabled={linkBranchMutation.isPending}>
                {linkBranchMutation.isPending ? t(`${NS}.linking`) : t(`${NS}.linkAndUse`)}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExistsOtherBranch(null)}>{t(`${NS}.cancel`)}</Button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <Button size="sm" variant={mode === "search" ? "default" : "outline"} onClick={() => setMode("search")} className="flex-1 h-8 text-xs">{t(`${NS}.customerList`)}</Button>
          <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")} className="flex-1 h-8 text-xs bg-pink-50">{t(`${NS}.newCustomer`)}</Button>
        </div>
        {mode === "search" ? (
          <div className="space-y-2">
            <Input
              placeholder={t(`${NS}.searchPlaceholder`)}
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            <div className="space-y-1 max-h-56 overflow-y-auto rounded-lg border bg-gray-50/50 p-1">
              {results.length === 0 ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-muted-foreground">{t(`${NS}.noResults`)}</p>
                  <Button size="sm" className="bg-pink-600 hover:bg-pink-700 text-xs h-7"
                    onClick={() => { setNewName(search); setMode("new"); }}>
                    {t(`${NS}.addAsNew`, { name: search })}
                  </Button>
                </div>
              ) : (
                results.map(c => (
                  <button key={c.id} className="w-full text-start flex items-center gap-3 p-2 hover:bg-pink-50 rounded-lg transition-colors"
                    onClick={() => onSelect(c)}>
                    <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-sm font-bold shrink-0">
                      {c.name?.charAt(0) || t("pos:fallback.unknownInitial")}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input placeholder={t(`${NS}.namePlaceholder`)} value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
            <Input placeholder={t(`${NS}.phonePlaceholder`)} value={newPhone} onChange={e => setNewPhone(e.target.value)} dir="ltr" />
            <Button className="w-full bg-pink-600 hover:bg-pink-700"
              onClick={() => createMutation.mutate()} disabled={!newName || createMutation.isPending}>
              {createMutation.isPending ? t(`${NS}.adding`) : t(`${NS}.addAndSelect`)}
            </Button>
          </div>
        )}
        <div className="pt-1">
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => onSelect(null)}>
            {t(`${NS}.noCustomerSale`)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ReturnModal ──────────────────────────────────────────────────────────────
function ReturnModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const NS = "pos:returnInvoice";
  const [invoiceNum, setInvoiceNum] = useState("");
  const [sale, setSale] = useState<any>(null);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [refundMethod, setRefundMethod] = useState("cash");

  const search = async () => {
    try {
      const res = await fetch(`/api/sales?invoiceNumber=${invoiceNum}`, { credentials: "include" });
      const data = await res.json();
      const found = Array.isArray(data) ? data[0] : data;
      if (!found) { toast({ title: t(`${NS}.notFound`), variant: "destructive" }); return; }
      const det = await fetch(`/api/sales/${found.id}`, { credentials: "include" }).then(r => r.json());
      setSale(det);
      const s: Record<number, number> = {};
      (det.items || []).forEach((i: any) => { s[i.id] = i.quantity; });
      setSelected(s);
    } catch { toast({ title: t(`${NS}.searchError`), variant: "destructive" }); }
  };

  const returnMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(selected)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => {
          const si = sale.items.find((i: any) => i.id === Number(id));
          return { saleItemId: Number(id), productId: si.productId, quantity, unitPrice: si.unitPrice };
        });
      // reason kept as fixed string for backend audit trail (not user-facing).
      return apiRequest("POST", `/api/sales/${sale.id}/return`, { items, refundMethod, reason: "مرتجع من POS" }).then(r => r.json());
    },
    onSuccess: () => { toast({ title: t(`${NS}.success`) }); onClose(); },
    onError: (e: Error) => toast({ title: t("pos:messages.error"), description: e.message, variant: "destructive" }),
  });

  const refundOptions: [string, string][] = [
    ["cash", t(`${NS}.cash`)],
    ["card", t(`${NS}.card`)],
    ["bank_transfer", t(`${NS}.bankTransfer`)],
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="w-4 h-4 text-orange-500" /> {t(`${NS}.title`)}</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Input placeholder={t(`${NS}.invoicePlaceholder`)} value={invoiceNum}
            onChange={e => setInvoiceNum(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()} />
          <Button onClick={search} className="bg-pink-600 hover:bg-pink-700 shrink-0">{t(`${NS}.search`)}</Button>
        </div>
        {sale && (
          <div className="space-y-3 mt-2">
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium">{sale.invoiceNumber} — {fmtDate(sale.createdAt)}</p>
              <p className="text-muted-foreground text-xs">{t(`${NS}.totalLabel`)} {omr(n(sale.total))} {t("pos:fallback.currency")}</p>
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
              {refundOptions.map(([val, label]) => (
                <button key={val}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${refundMethod === val ? "bg-orange-500 text-white border-orange-500" : "border-border hover:bg-muted/50"}`}
                  onClick={() => setRefundMethod(val)}>{label}</button>
              ))}
            </div>
            <Button className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => returnMutation.mutate()} disabled={returnMutation.isPending}>
              {returnMutation.isPending ? t(`${NS}.processing`) : t(`${NS}.confirm`)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── CloseShiftModal ─────────────────────────────────────────────────────────
function CloseShiftModal({ shift, onClose, onClosed, canEditOpening }: {
  shift: Shift;
  onClose: () => void;
  onClosed: () => void;
  canEditOpening: boolean;
}) {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const NS = "pos:closeShift";
  const [actualCash, setActualCash] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [editingOpening, setEditingOpening] = useState(false);
  const [openingDraft, setOpeningDraft] = useState<string>(String(shift.openingCash ?? "0"));
  const [savingOpening, setSavingOpening] = useState(false);
  const [openingValue, setOpeningValue] = useState<number>(n(shift.openingCash));

  const reloadSummary = async () => {
    try {
      const r = await fetch(`/api/reports/shift?shiftId=${shift.id}`, { credentials: "include" });
      if (r.ok) setSummary(await r.json());
    } catch {}
  };

  useEffect(() => {
    (async () => {
      await reloadSummary();
      setLoadingSummary(false);
    })();
  }, [shift.id]);

  const saveOpeningCash = async () => {
    const amount = parseFloat(openingDraft);
    if (isNaN(amount) || amount < 0) {
      toast({ title: t(`${NS}.invalidValue`), variant: "destructive" });
      return;
    }
    setSavingOpening(true);
    try {
      const r = await fetch(`/api/shifts/${shift.id}/opening-cash`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ openingCash: amount.toFixed(3) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || t(`${NS}.openingUpdateFailed`));
      setOpeningValue(amount);
      setEditingOpening(false);
      await reloadSummary();
      toast({ title: t(`${NS}.openingUpdated`) });
    } catch (e: any) {
      toast({ title: t(`${NS}.errorGeneric`), description: e.message, variant: "destructive" });
    } finally {
      setSavingOpening(false);
    }
  };

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (actualCash === "") throw new Error(t(`${NS}.actualCashRequired`));
      const r = await fetch(`/api/shifts/${shift.id}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actualCash }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || t(`${NS}.closeFailed`));
      return data;
    },
    onSuccess: () => {
      toast({ title: t(`${NS}.closedSuccess`) });
      onClosed();
    },
    onError: (e: Error) => toast({ title: t(`${NS}.errorGeneric`), description: e.message, variant: "destructive" }),
  });

  const totalSales = n(summary?.totalSales ?? 0);
  const totalCash  = n(summary?.salesCash?.total ?? 0);
  const totalCard  = n(summary?.salesCard?.total ?? 0);
  const totalBank  = n(summary?.salesBankTransfer?.total ?? 0);
  const openingCash = n(summary?.openingCash ?? openingValue);
  const cashExp     = n(summary?.expensesCash?.total ?? 0);
  const expected   = n(summary?.expectedCash ?? (openingCash + totalCash - cashExp));
  const actualNum  = n(actualCash);
  const diff       = actualNum - expected;
  const currency = t("pos:fallback.currency");

  const startedAtLabel = (() => {
    if (!shift.startedAt) return "";
    const locale = lang === "en" ? "en-GB" : "ar-OM-u-nu-latn";
    try {
      return new Date(shift.startedAt).toLocaleString(locale);
    } catch {
      return new Date(shift.startedAt).toLocaleString();
    }
  })();

  const summaryRows: [string, string, string][] = [
    [t(`${NS}.totalSales`),   omr(totalSales) + " " + currency, "text-emerald-600 font-bold"],
    [t(`${NS}.cashSales`),    omr(totalCash)  + " " + currency, "text-gray-700"],
    [t(`${NS}.cardSales`),    omr(totalCard)  + " " + currency, "text-purple-600"],
    [t(`${NS}.bankSales`),    omr(totalBank)  + " " + currency, "text-blue-600"],
    [t(`${NS}.cashExpenses`), "−" + omr(cashExp) + " " + currency, "text-red-600"],
    [t(`${NS}.expectedCash`), omr(expected)   + " " + currency, "text-orange-600 font-semibold"],
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <LogOut className="w-5 h-5 text-orange-500" />
            {t(`${NS}.title`)}
          </DialogTitle>
          <DialogDescription className="text-start">
            {startedAtLabel} ← {t(`${NS}.startedAt`)}
          </DialogDescription>
        </DialogHeader>

        {loadingSummary ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="font-bold text-base">{t(`${NS}.summaryTitle`)}</span>
                <span className="text-muted-foreground text-xs">{t(`${NS}.electronicInvoice`)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t(`${NS}.openingCashLabel`)}</span>
                {editingOpening ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" step="0.001" min="0"
                      value={openingDraft}
                      onChange={e => setOpeningDraft(e.target.value)}
                      className="h-7 w-24 text-sm text-center"
                      dir="ltr"
                      autoFocus
                    />
                    <Button size="sm" className="h-7 px-2 text-xs"
                      onClick={saveOpeningCash} disabled={savingOpening}>
                      {t(`${NS}.save`)}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                      onClick={() => { setEditingOpening(false); setOpeningDraft(String(openingValue)); }}>
                      {t(`${NS}.cancel`)}
                    </Button>
                  </div>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="text-gray-700">{omr(openingCash)} {currency}</span>
                    {canEditOpening && (
                      <Button size="sm" variant="ghost" className="h-6 px-1 text-[11px] text-pink-600 hover:bg-pink-50"
                        onClick={() => { setOpeningDraft(String(openingCash)); setEditingOpening(true); }}>
                        {t(`${NS}.edit`)}
                      </Button>
                    )}
                  </span>
                )}
              </div>
              {summaryRows.map(([label, val, cls]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cls}>{val}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-green-600" />
                {t(`${NS}.countActualCash`)}
              </label>
              <Input
                type="number"
                step="0.001"
                min="0"
                placeholder={t(`${NS}.actualCashPlaceholder`)}
                value={actualCash}
                onChange={e => setActualCash(e.target.value)}
                className="text-center text-xl h-14 font-bold border-2 focus:border-pink-400"
                autoFocus
                dir="ltr"
              />
              {actualCash !== "" && (
                <div className={`text-center text-sm font-semibold py-2 rounded-lg ${
                  Math.abs(diff) < 0.001
                    ? "bg-green-50 text-green-700"
                    : diff > 0
                    ? "bg-blue-50 text-blue-700"
                    : "bg-red-50 text-red-700"
                }`}>
                  {Math.abs(diff) < 0.001
                    ? t(`${NS}.cashMatches`)
                    : diff > 0
                    ? t(`${NS}.cashOver`, { amount: omr(diff) })
                    : t(`${NS}.cashShort`, { amount: omr(Math.abs(diff)) })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{t(`${NS}.cancel`)}</Button>
          <Button
            className="bg-orange-500 hover:bg-orange-600 gap-1"
            onClick={() => closeMutation.mutate()}
            disabled={closeMutation.isPending || actualCash === ""}
          >
            {closeMutation.isPending
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t(`${NS}.closing`)}</>
              : <><LogOut className="w-4 h-4" /> {t(`${NS}.confirmClose`)}</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main POS Component ───────────────────────────────────────────────────────
export default function POS() {
  const { data: authData } = useAuth();
  const user = authData?.user;
  const { toast } = useToast();
  const { t } = useI18n();
  const stockBadge = useStockBadge();
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
  const [showHold, setShowHold]           = useState(false);
  const [showCustomer, setShowCustomer]   = useState(false);
  const [showReturn, setShowReturn]       = useState(false);
  const [confirmClear, setConfirmClear]   = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [scannerState, setScannerState] = useState<BarcodeIndicatorState>("idle");
  const scannerStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { settings: scannerSettings } = useScannerSettings();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const fullscreenSupported =
    typeof document !== "undefined" &&
    typeof (document.documentElement as any).requestFullscreen === "function";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Auto-sync pending offline sales when connection is restored
  useEffect(() => {
    const handleOnline = async () => {
      const count = await getPendingCount();
      if (count === 0) return;
      try {
        const result = await syncPending();
        if (result.synced > 0) {
          toast({
            title: `${result.synced} offline sale(s) synced`,
            description: result.failed > 0 ? `${result.failed} failed — will retry` : undefined,
          });
          qc.invalidateQueries({ queryKey: ["/api/pos/products"] });
        }
      } catch {}
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen failed:", error);
    }
  }, []);

  const isOwner = user?.role === "owner" || user?.role === "admin";
  const branchId = user?.branchId || 1;

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "returnNull" }),
  });
  const branchName = branches.find(b => b.id === branchId)?.name || t("pos:fallback.branch");

  const { data: appSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"], queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 120_000,
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"], queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery<POSProduct[]>({
    queryKey: ["/api/pos/products", search, activeCat],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (activeCat !== "all") p.set("categoryId", String(activeCat));
      if (!navigator.onLine) {
        const { getCachedProducts } = await import("@/lib/sync-engine");
        return getCachedProducts() as unknown as POSProduct[];
      }
      const data = await fetch(`/api/pos/products?${p}`, { credentials: "include" }).then(r => r.json()).then(d => Array.isArray(d) ? d : []);
      if (!search && activeCat === "all") refreshProductCache(data);
      return data;
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
  const currency = t("pos:fallback.currency");

  const addToCart = useCallback((prod: POSProduct, qty = 1, color?: string, size?: string) => {
    if (prod.stockQty <= 0) {
      toast({ title: t("pos:messages.outOfStock"), description: prod.name, variant: "destructive" }); return;
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
    toast({ title: t("pos:messages.added"), description: prod.name, duration: 1500 });
  }, [toast, t]);

  const updateQty = (uid: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.uid !== uid) return i;
      const q = Math.max(0, Math.min(i.quantity + delta, i.maxStock));
      return q === 0 ? i : { ...i, quantity: q };
    }).filter(i => i.quantity > 0));
  };

  const removeItem = (uid: string) => setCart(prev => prev.filter(i => i.uid !== uid));

  // ── Barcode scanner ──────────────────────────────────────────────────
  const flashScanner = useCallback((next: "success" | "error", barcode?: string) => {
    setScannerState(next);
    if (scannerStateTimerRef.current) clearTimeout(scannerStateTimerRef.current);
    scannerStateTimerRef.current = setTimeout(() => setScannerState("idle"), 600);
    if (scannerSettings.soundEnabled) {
      try { (next === "success" ? beepSuccess : beepError)(); } catch {}
    }
    try { window.dispatchEvent(new CustomEvent("scanner-flash", { detail: { state: next, barcode } })); } catch {}
  }, [scannerSettings.soundEnabled]);

  useEffect(() => () => { if (scannerStateTimerRef.current) clearTimeout(scannerStateTimerRef.current); }, []);

  const handleScannedBarcode = useCallback(async (barcode: string) => {
    // 1. Try the products list already loaded for this branch (instant).
    const local = (products as POSProduct[]).find(p => p.barcode === barcode);
    if (local) {
      if (local.stockQty <= 0) {
        flashScanner("error", barcode);
        toast({ title: "نفد المخزون", description: local.name, variant: "destructive" });
        return;
      }
      addToCart(local);
      flashScanner("success", barcode);
      return;
    }

    // 2. Fallback: hit the API in case the local list is stale.
    try {
      const res = await fetch(`/api/products/by-barcode/${encodeURIComponent(barcode)}`, { credentials: "include" });
      if (res.status === 404) {
        flashScanner("error", barcode);
        toast({ title: "المنتج غير موجود", description: barcode, variant: "destructive" });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const stock = Number(data.stockQuantity ?? data.stockQty ?? data.stock ?? 0);
      if (stock <= 0) {
        flashScanner("error", barcode);
        toast({ title: "نفد المخزون", description: data.name || barcode, variant: "destructive" });
        return;
      }
      addToCart({
        id: data.id,
        name: data.name,
        barcode: data.barcode,
        price: data.price,
        avgCost: data.avgCost ?? "0",
        image: data.image,
        categoryId: data.categoryId,
        stockQty: stock,
      });
      flashScanner("success", barcode);
      qc.invalidateQueries({ queryKey: ["/api/products"] });
    } catch (err) {
      flashScanner("error", barcode);
      toast({ title: "خطأ في الاتصال", description: barcode, variant: "destructive" });
    }
  }, [products, addToCart, flashScanner, toast, qc]);

  const { lastScanned } = useBarcodeScanner({
    enabled:   scannerSettings.enabled && !!shift,
    threshold: scannerSettings.threshold,
    onScan:    handleScannedBarcode,
    onInvalid: (raw) => {
      flashScanner("error", raw);
      toast({ title: "باركود غير صالح", description: `يحتوي على رموز غير مسموحة: ${raw}`, variant: "destructive" });
    },
  });

  const clearCart = () => {
    setCart([]); setCustomer(null); setDiscount(""); setAmountPaid(""); setPayRef(""); setConfirmClear(false);
  };

  const holdMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pos/held", {
      items: cart, customerId: customer?.id, customerName: customer?.name, customerPhone: customer?.phone,
    }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: t("pos:messages.holdSuccess", { number: data.hold_number }) });
      clearCart();
      qc.invalidateQueries({ queryKey: ["/api/pos/held-count"] });
    },
    onError: (e: Error) => toast({ title: t("pos:messages.error"), description: e.message, variant: "destructive" }),
  });

  const resumeHeld = (held: HeldInvoice) => {
    setCart(held.items);
    if (held.customer_id) setCustomer({ id: held.customer_id, name: held.customer_name || "", phone: held.customer_phone });
    setShowHold(false);
    qc.invalidateQueries({ queryKey: ["/api/pos/held-count"] });
  };

  const saleMutation = useMutation({
    mutationFn: async () => {
      if (!shift) throw new Error(t("pos:messages.errOpenShiftFirst"));
      if (cart.length === 0) throw new Error(t("pos:messages.errCartEmpty"));
      if (payMethod === "cash" && paid < total) throw new Error(t("pos:messages.errAmountInsufficient"));

      const body = {
        invoiceNumber: "",
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

      // ── Offline-first: if no network, queue locally ──────────
      if (!navigator.onLine) {
        const localId = await queueSale(body);
        const pendingCount = await getPendingCount();
        toast({
          title: "Sale saved offline",
          description: `${pendingCount} sale(s) will sync when back online`,
        });
        return {
          _offline: true,
          invoiceNumber: `PEND-${Date.now()}`,
          createdAt: new Date().toISOString(),
          total: body.total,
          subtotal: body.subtotal,
          discount: body.discount,
          vat: body.vat,
          amountPaid: body.amountPaid,
          changeAmount: body.changeAmount,
          paymentMethod: body.paymentMethod,
          items: cart.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, color: i.color })),
          customerName: customer?.name ?? null,
          customerPhone: customer?.phone ?? null,
        };
      }

      const res = await apiRequest("POST", "/api/sales", body);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || t("pos:messages.errInvoiceFailed"));
      }
      const sale = await res.json();
      return {
        ...sale,
        items: cart.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, color: i.color })),
        customerName: customer?.name ?? null,
        customerPhone: customer?.phone ?? null,
      };
    },
    onSuccess: async (sale) => {
      setCompletedSale(sale);
      clearCart();
      setAmountPaid("");
      setPayRef("");
      qc.invalidateQueries({ queryKey: ["/api/pos/products"] });

      const autoPrintResult = await printInvoiceLocal({
        invoiceNumber: sale.invoiceNumber || sale.invoice_number || "",
        createdAt:     sale.createdAt     || sale.created_at,
        cashierName:   user?.name || "",
        branchName:    branchName,
        customerName:  sale.customerName ?? null,
        items: (sale.items || []).map((i: any) => ({
          productName: i.productName || i.product_name || "",
          quantity:    i.quantity,
          unitPrice:   n(i.unitPrice ?? i.unit_price),
          color:       i.color,
          size:        i.size,
        })),
        subtotal:      n(sale.subtotal),
        discount:      n(sale.discount),
        vat:           n(sale.vat),
        total:         n(sale.total),
        amountPaid:    n(sale.amountPaid ?? sale.amount_paid ?? sale.total),
        changeAmount:  n(sale.changeAmount ?? sale.change_amount ?? 0),
        paymentMethod: sale.paymentMethod || sale.payment_method || "cash",
      });
      if (!autoPrintResult.ok) {
        toast({
          title: t("pos:messages.autoPrintWarning"),
          description: autoPrintResult.error,
          variant: "destructive",
        });
      }
    },
    onError: (e: Error) => toast({ title: t("pos:messages.invoiceError"), description: e.message, variant: "destructive" }),
  });

  // ── Barcode scan (physical scanner redirects to search) ──────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.querySelector("[role='dialog']")) return;
      const active = document.activeElement;
      if (!active) return;
      const tag = active.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((active as HTMLElement).isContentEditable) return;
      if (e.key.length === 1 && /[a-zA-Z0-9\-]/.test(e.key)) {
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!user) return null;
  if (!shift) return (
    <StartPOS
      branchName={branchName}
      terminalName={user.terminalName || "T1"}
      userName={user.name}
      onShiftOpened={s => setShift(s)}
    />
  );

  const rootCats = categories.filter(c => !c.parentId && c.isActive !== false);

  const paymentMethods: ["cash" | "card" | "bank_transfer", string, any][] = [
    ["cash",          t("pos:payment.cash"),          Banknote],
    ["card",          t("pos:payment.card"),          CreditCard],
    ["bank_transfer", t("pos:payment.bank_transfer"), Wallet],
  ];

  const discountTypes: ["value" | "percent", string][] = [
    ["value", currency],
    ["percent", "%"],
  ];

  return (
    <div className="w-full h-full min-h-0 flex overflow-hidden bg-gray-50">

      {/* ══ Cart (Right) ══ */}
      <div className="w-[360px] xl:w-[400px] 2xl:w-[440px] shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden shadow-md min-h-0">

          <div className="px-3 py-2 border-b shrink-0">
            <button className="w-full flex items-center justify-between bg-gray-50 hover:bg-pink-50 border border-dashed border-gray-300 hover:border-pink-300 rounded-lg px-3 py-2 transition-colors text-sm"
              onClick={() => setShowCustomer(true)}>
              <span className="flex items-center gap-2">
                <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                <span className={customer ? "text-gray-800 font-medium" : "text-gray-400"}>
                  {customer ? customer.name : t("pos:cart.selectCustomer")}
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

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">{t("pos:cart.empty")}</p>
                <p className="text-xs mt-1">{t("pos:cart.emptyHint")}</p>
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
                  <p className="text-xs font-bold text-pink-600 mt-0.5">{omr(item.unitPrice)} {currency}</p>
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

          <div className="border-t bg-white shrink-0 px-3 py-3 space-y-3">
            {isOwner && cart.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <Input
                  type="number" min="0" step="0.001" placeholder={t("pos:totals.discountPlaceholder")}
                  value={discount} onChange={e => setDiscount(e.target.value)}
                  className="h-7 text-xs flex-1" dir="ltr"
                />
                <div className="flex rounded-md border overflow-hidden shrink-0">
                  {discountTypes.map(([val, lbl]) => (
                    <button key={val}
                      className={`px-2 py-0.5 text-xs transition-colors ${discType === val ? "bg-pink-600 text-white" : "hover:bg-gray-100"}`}
                      onClick={() => setDiscType(val)}>{lbl}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>{t("pos:totals.subtotal")}</span><span dir="ltr">{omr(subtotal)} {currency}</span>
              </div>
              {discVal > 0 && (
                <div className="flex justify-between text-emerald-600 text-xs">
                  <span>{t("pos:totals.discount")}</span><span dir="ltr">- {omr(discVal)} {currency}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t">
                <span>{t("pos:totals.total")}</span>
                <span className="text-pink-600" dir="ltr">{omr(total)} {currency}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {paymentMethods.map(([val, label, Icon]) => (
                <button key={val}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all ${payMethod === val ? "bg-pink-600 text-white border-pink-600 shadow-sm" : "border-gray-200 hover:border-pink-300 hover:bg-pink-50"}`}
                  onClick={() => { setPayMethod(val); setAmountPaid(""); setPayRef(""); }}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

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
                  placeholder={t("pos:payment.amountReceived")}
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  className="h-8 text-sm text-center" dir="ltr"
                />
                {paid > 0 && (
                  <div className={`flex justify-between text-sm px-1 font-medium ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    <span>{t("pos:payment.change")}</span>
                    <span dir="ltr">{omr(change >= 0 ? change : paid - total)} {currency}</span>
                  </div>
                )}
              </div>
            )}

            {(payMethod === "card" || payMethod === "bank_transfer") && (
              <Input
                placeholder={payMethod === "card" ? t("pos:payment.cardRefPlaceholder") : t("pos:payment.bankRefPlaceholder")}
                value={payRef} onChange={e => setPayRef(e.target.value)}
                className="h-8 text-sm" dir="ltr"
              />
            )}

            <Button
              className={`w-full h-11 text-sm font-bold transition-all ${canComplete ? "bg-gradient-to-l from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600 shadow-md" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
              disabled={!canComplete || saleMutation.isPending}
              onClick={() => saleMutation.mutate()}
            >
              {saleMutation.isPending ? (
                <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t("pos:actions.checkoutLoading")}</span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {t("pos:actions.checkout")} {cart.length > 0 ? `— ${omr(total)} ${currency}` : ""}
                </span>
              )}
            </Button>

            {cart.length > 0 && (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => holdMutation.mutate()} disabled={holdMutation.isPending}>
                <Pause className="w-3 h-3" />
                {holdMutation.isPending ? t("pos:actions.holdLoading") : t("pos:actions.hold")}
              </Button>
            )}
          </div>
        </div>

        {/* ══ Products (Left) ══ */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">

          <div className="flex items-center px-3 py-2 bg-gradient-to-l from-pink-600 to-rose-500 shrink-0 gap-3">

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <Store className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-white text-xs font-bold whitespace-nowrap">{t("pos:header.appName")}</span>
            </div>

            <div className="flex-1 flex items-center justify-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-bold">{t("pos:header.cart")}</span>
              {cart.length > 0 && (
                <span className="bg-white text-pink-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{cart.length}</span>
              )}
              {cart.length > 0 && (
                <button className="text-white/70 hover:text-white ml-1" onClick={() => setConfirmClear(true)}>
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isOwner && (
                <Button size="sm" variant="ghost"
                  className="h-7 text-xs gap-1 text-white hover:bg-white/20 px-2"
                  onClick={() => setShowReturn(true)}>
                  <RotateCcw className="w-3.5 h-3.5" /> {t("pos:header.return")}
                </Button>
              )}
              <Button size="sm" variant="ghost"
                className="h-7 text-xs gap-1 text-white hover:bg-white/20 px-2 relative"
                onClick={() => setShowHold(true)}>
                <Pause className="w-3.5 h-3.5" /> {t("pos:header.hold")}
                {heldCount > 0 && (
                  <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-white text-pink-600 text-[9px] font-bold flex items-center justify-center">{heldCount}</span>
                )}
              </Button>
              {fullscreenSupported && (
                <Button size="sm" variant="ghost"
                  className="h-7 text-xs gap-1 text-white hover:bg-white/20 px-2"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? t("pos:header.exitFullscreen") : t("pos:header.fullscreen")}>
                  {isFullscreen
                    ? <><Minimize2 className="w-3.5 h-3.5" /> {t("pos:header.minimize")}</>
                    : <><Maximize2 className="w-3.5 h-3.5" /> {t("pos:header.maximize")}</>
                  }
                </Button>
              )}
              <DevicePrintSettingsDialog />
              <Button size="sm" variant="ghost"
                className="h-7 text-xs gap-1 text-orange-200 hover:text-white hover:bg-white/20 px-2 border border-orange-300/40"
                onClick={() => setShowCloseShift(true)}>
                <LogOut className="w-3.5 h-3.5" /> {t("pos:header.close")}
              </Button>
            </div>
          </div>

          <div className="bg-white border-b px-4 py-3 space-y-2 shrink-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                  ref={searchRef}
                  placeholder={t("pos:search.placeholder")}
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
              <BarcodeScanButton onScan={(barcode) => {
                const found = products.find(p => p.barcode === barcode);
                if (found) {
                  addToCart(found);
                } else {
                  setSearch(barcode);
                }
              }} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              <button
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${activeCat === "all" ? "bg-pink-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                onClick={() => setActiveCat("all")}>
                {t("pos:search.all")} <span className="opacity-70">({products.length})</span>
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

          {topProducts.length > 0 && !search && activeCat === "all" && (
            <div className="bg-white border-b px-4 py-2 shrink-0">
              <p className="text-xs text-muted-foreground mb-1.5">{t("pos:search.topSelling")}</p>
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

          <div className="flex-1 overflow-y-auto p-3">
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
                <p>{t("pos:search.noProducts")}</p>
                {search && <p className="text-xs mt-1">{t("pos:search.tryDifferent")}</p>}
              </div>
            )}

            {!loadingProducts && (
              <div className="divide-y">
                {products.map(prod => {
                  const badge = stockBadge(prod.stockQty);
                  const outOfStock = prod.stockQty === 0;
                  return (
                    <div
                      key={prod.id}
                      onClick={() => !outOfStock && addToCart(prod)}
                      className={`grid grid-cols-[1fr_auto_auto] items-center px-4 py-3 gap-3 transition-colors ${
                        outOfStock
                          ? "opacity-40 cursor-default"
                          : "cursor-pointer hover:bg-gray-50 active:bg-gray-100"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800 leading-tight">{prod.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {prod.categoryName}
                          {" · "}
                          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${badge.cls}`}>
                            {badge.label} ({prod.stockQty})
                          </span>
                        </p>
                      </div>

                      <span className="text-sm font-medium text-pink-700 whitespace-nowrap">
                        {omr(n(prod.price))} {currency}
                      </span>

                      {!outOfStock ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); addToCart(prod); }}
                          className="w-7 h-7 rounded-full bg-pink-50 border border-pink-300 text-pink-800 text-lg flex items-center justify-center hover:bg-pink-100"
                        >
                          +
                        </button>
                      ) : (
                        <div className="w-7 h-7" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
      {showCloseShift && shift && (
        <CloseShiftModal
          shift={shift}
          onClose={() => setShowCloseShift(false)}
          onClosed={() => { setShift(null); setShowCloseShift(false); clearCart(); }}
          canEditOpening={isOwner}
        />
      )}

      {/* Confirm Clear Cart */}
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-4 h-4" /> {t("pos:actions.clearCart")}</DialogTitle>
          </DialogHeader>
          <DialogDescription>{t("pos:actions.clearCartConfirm")}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmClear(false)}>{t("pos:actions.cancel")}</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={clearCart}>{t("pos:actions.clearYes")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
