import { useState, useRef, useEffect } from "react";
import { Search, Plus, Minus, Trash2, CheckCircle2, Image as ImageIcon, Store, Monitor, Banknote, LogOut, User as UserIcon, XCircle, Clock, AlertTriangle, Printer, ArrowLeft, Receipt, TrendingUp, TrendingDown, Camera, Pause, Play, ShoppingCart, MessageSquare } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useLogout } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Product, Branch, Shift } from "@shared/schema";

function fmt(v: string | number | null | undefined) {
  return parseFloat(String(v || "0")).toFixed(3);
}

function StartPOS({ branchName, terminalName, userName, onShiftOpened }: {
  branchName: string;
  terminalName: string;
  userName: string;
  onShiftOpened: (shift: Shift) => void;
}) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [openingCash, setOpeningCash] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/shifts/current", { credentials: "include" });
        const data = await res.json();
        if (data.shift) {
          onShiftOpened(data.shift);
          return;
        }
      } catch {}
      setChecking(false);
    })();
  }, []);

  const openShiftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shifts", {
        openingCash: openingCash ? String(openingCash) : "0",
      });
      return await res.json();
    },
    onSuccess: (shift: Shift) => {
      toast({ title: t("pos.shift_opened") });
      onShiftOpened(shift);
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  if (checking) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{t("pos.checking_shift")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-primary/10 p-6 text-center border-b border-border">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
            <Store className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold" data-testid="text-start-pos-title">{t("pos.start_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("pos.start_subtitle")}</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5" /> {t("pos.cashier")}</span>
              <span className="font-medium" data-testid="text-pos-user">{userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> {t("pos.branch")}</span>
              <span className="font-medium" data-testid="text-pos-branch">{branchName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> {t("pos.terminal")}</span>
              <span className="font-medium" data-testid="text-pos-terminal">{terminalName}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Banknote className="w-4 h-4 text-muted-foreground" />
              {t("pos.opening_cash")}
            </label>
            <Input
              type="number"
              step="0.001"
              placeholder="0.000"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              autoFocus
              data-testid="input-opening-cash"
            />
          </div>

          <Button
            className="w-full h-12 text-lg font-bold gap-2"
            onClick={() => openShiftMutation.mutate()}
            disabled={openShiftMutation.isPending}
            data-testid="button-open-shift"
          >
            {openShiftMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t("pos.opening_shift")}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                {t("pos.open_new_shift")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ShiftReceipt({ report, onNewShift }: { report: any; onNewShift: () => void }) {
  const { t, lang } = useI18n();
  const diff = parseFloat(report.difference || "0");
  const diffColor = Math.abs(diff) < 0.002 ? "text-green-600" : diff > 0 ? "text-blue-600" : "text-red-600";
  const diffLabel = Math.abs(diff) < 0.002 ? t("status_labels.matched") : diff > 0 ? `${t("status_labels.surplus")} +${fmt(diff)}` : `${t("status_labels.shortage")} ${fmt(diff)}`;
  const locale = "en-US";

  return (
    <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-green-50 p-5 text-center border-b border-border">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-green-800" data-testid="text-shift-closed-title">{t("pos.shift_closed_title")}</h2>
          <p className="text-sm text-green-600 mt-1">{t("pos.shift_number").replace("{0}", report.shift?.id)}</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">{t("pos.cashier_label")}</p>
              <p className="font-bold mt-1">{report.cashierName || "-"}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">{t("pos.terminal_label")}</p>
              <p className="font-bold mt-1">{report.shift?.terminalName || "-"}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">{t("pos.open_time")}</p>
              <p className="font-bold mt-1">{report.shift?.startedAt ? new Date(report.shift.startedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "-"}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">{t("pos.close_time")}</p>
              <p className="font-bold mt-1">{report.shift?.endedAt ? new Date(report.shift.endedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "-"}</p>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-muted/30 px-4 py-2 font-bold border-b">{t("pos.sales_summary")}</div>
            <div className="divide-y">
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">{t("pos.cash_sales_count").replace("{0}", report.salesCash?.count || 0)}</span>
                <span className="font-medium">{fmt(report.salesCash?.total)} {t("common.omr")}</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">{t("pos.card_sales_count").replace("{0}", report.salesCard?.count || 0)}</span>
                <span className="font-medium">{fmt(report.salesCard?.total)} {t("common.omr")}</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">{t("pos.bank_sales_count").replace("{0}", report.salesBankTransfer?.count || 0)}</span>
                <span className="font-medium">{fmt(report.salesBankTransfer?.total)} {t("common.omr")}</span>
              </div>
              <div className="flex justify-between px-4 py-2 bg-green-50 font-bold">
                <span>{t("pos.total_sales_label")}</span>
                <span className="text-green-700">{fmt(report.totalSales)} {t("common.omr")}</span>
              </div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-muted/30 px-4 py-2 font-bold border-b">{t("pos.expenses_section")}</div>
            <div className="divide-y">
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">{t("pos.cash_expenses_count").replace("{0}", report.expensesCash?.count || 0)}</span>
                <span className="font-medium text-red-600">{fmt(report.expensesCash?.total)} {t("common.omr")}</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">{t("pos.bank_expenses_count").replace("{0}", report.expensesBank?.count || 0)}</span>
                <span className="font-medium text-red-600">{fmt(report.expensesBank?.total)} {t("common.omr")}</span>
              </div>
            </div>
          </div>

          <div className="border-2 border-primary/30 rounded-lg overflow-hidden text-sm">
            <div className="bg-primary/10 px-4 py-2 font-bold border-b border-primary/20">{t("pos.reconciliation_section")}</div>
            <div className="divide-y divide-primary/10">
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">{t("pos.opening_balance")}</span>
                <span className="font-medium">{fmt(report.openingCash)} {t("common.omr")}</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">{t("pos.plus_cash_sales")}</span>
                <span className="font-medium text-green-600">{fmt(report.salesCash?.total)} {t("common.omr")}</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">{t("pos.minus_cash_expenses")}</span>
                <span className="font-medium text-red-600">{fmt(report.expensesCash?.total)} {t("common.omr")}</span>
              </div>
              <div className="flex justify-between px-4 py-2 bg-blue-50 font-bold">
                <span>{t("pos.expected_in_drawer")}</span>
                <span>{fmt(report.expectedCash)} {t("common.omr")}</span>
              </div>
              <div className="flex justify-between px-4 py-2 font-bold">
                <span>{t("pos.actual_cash_label")}</span>
                <span>{fmt(report.actualCash)} {t("common.omr")}</span>
              </div>
              <div className={`flex justify-between px-4 py-3 font-bold text-lg ${Math.abs(diff) < 0.002 ? "bg-green-50" : "bg-red-50"}`}>
                <span>{t("pos.difference")}</span>
                <span className={diffColor} data-testid="text-shift-difference">{diffLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between px-4 py-3 bg-primary/5 rounded-lg border border-primary/20 font-bold">
            <span>{t("pos.net_income")}</span>
            <span className="text-primary text-lg">{fmt(report.netTotal)} {t("common.omr")}</span>
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => window.print()} data-testid="button-print-receipt">
            <Printer className="w-4 h-4" />
            {t("pos.print_receipt")}
          </Button>
          <Button className="flex-1 gap-2" onClick={onNewShift} data-testid="button-new-shift">
            <ArrowLeft className="w-4 h-4" />
            {t("pos.new_shift")}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface HeldInvoice {
  id: number;
  cart: {product: Product, qty: number}[];
  discountValue: number;
  discountType: "percentage" | "value";
  heldAt: Date;
  note: string;
}

export default function POS() {
  const { toast } = useToast();
  const { data } = useAuth();
  const user = data?.user;
  const logoutMutation = useLogout();
  const { t, lang, dir } = useI18n();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [closedReport, setClosedReport] = useState<any>(null);

  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankTxnId, setBankTxnId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<"percentage" | "value">("value");
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [preCloseData, setPreCloseData] = useState<any>(null);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>([]);
  const [holdNoteDialogOpen, setHoldNoteDialogOpen] = useState(false);
  const [holdNote, setHoldNote] = useState("");
  const [heldListDialogOpen, setHeldListDialogOpen] = useState(false);
  const heldIdCounter = useRef(1);
  const [customerPhone, setCustomerPhone] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(true);
  const [foundCustomerId, setFoundCustomerId] = useState<number | null>(null);
  const [cardTxnRef, setCardTxnRef] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const isOwner = user?.role === "owner" || user?.role === "admin";

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: branchesList = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: categoriesList = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const userBranchId = user?.branchId;
  const { data: branchStock = [] } = useQuery<any[]>({
    queryKey: [`/api/branch-stock/${userBranchId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!userBranchId,
  });

  const branchProductIds = new Set(branchStock.map((s: any) => s.product_id));
  const products = userBranchId
    ? allProducts.filter(p => branchProductIds.has(p.id))
    : allProducts;

  const branchName = branchesList.find(b => b.id === userBranchId)?.name || "";
  const terminalName = user?.terminalName || "T1";

  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.product.price) * item.qty), 0);
  const discountAmount = discountType === "percentage" ? subtotal * (discountValue / 100) : discountValue;
  const afterDiscount = subtotal - discountAmount;
  const vat = afterDiscount * 0.05;
  const total = afterDiscount + vat;

  function printThermalReceipt(receiptData: {
    invoiceNumber: string; branchName: string; cashierName: string;
    paymentMethod: string; subtotal: string; discount: string; vat: string; total: string;
    items: { name: string; qty: number; price: string; lineTotal: string }[];
  }) {
    const pmLabels: Record<string, string> = { 
      cash: t("payment_methods.cash"), 
      card: t("payment_methods.card"), 
      bank_transfer: t("payment_methods.bank_transfer") 
    };
    const locale = "en-US";
    const dateStr = new Date().toLocaleDateString(locale) + " " + new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    const itemsHtml = receiptData.items.map(it => `
      <tr>
        <td style="text-align:${lang === "ar" ? "left" : "right"};font-size:11px;padding:1px 0">${it.lineTotal}</td>
        <td style="text-align:center;font-size:11px;padding:1px 0">${it.price} x${it.qty}</td>
        <td style="text-align:${lang === "ar" ? "right" : "left"};font-size:12px;padding:1px 0">${it.name}</td>
      </tr>
    `).join("");
    const discountLine = parseFloat(receiptData.discount) > 0
      ? `<div style="display:flex;justify-content:space-between"><span>${t("pos.receipt_discount")}</span><span>-${receiptData.discount}</span></div>` : "";
    const html = `<!DOCTYPE html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8">
      <title>${t("pos.receipt_title")}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Inter:wght@400;700&display=swap" rel="stylesheet">
      <style>@font-face{font-family:'DigitsEN';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf) format('truetype');unicode-range:U+0020-007F}@font-face{font-family:'DigitsEN';font-style:normal;font-weight:700;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf) format('truetype');unicode-range:U+0020-007F}</style>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'DigitsEN','Cairo',sans-serif; width:80mm; padding:6mm 4mm; color:#000; direction:${dir}; font-size:12px; }
        .center { text-align:center; }
        .brand { font-size:18px; font-weight:700; color:#8b5a7a; }
        .sep { border-bottom:1px dashed #999; margin:4px 0; }
        .row { display:flex; justify-content:space-between; font-size:11px; padding:1px 0; }
        .total-row { display:flex; justify-content:space-between; font-size:14px; font-weight:700; padding:3px 0; border-top:2px solid #333; margin-top:4px; }
        table { width:100%; border-collapse:collapse; }
        .footer { text-align:center; font-size:10px; color:#666; margin-top:8px; }
        @media print { body { width:80mm; } }
      </style>
    </head><body>
      <div class="center brand">${t("app.name")}</div>
      <div class="center" style="font-size:10px;color:#888">${t("pos.receipt_title")}</div>
      <div class="sep"></div>
      <div class="row"><span>${t("pos.receipt_invoice")}</span><span>${receiptData.invoiceNumber}</span></div>
      <div class="row"><span>${t("pos.receipt_date")}</span><span>${dateStr}</span></div>
      <div class="row"><span>${t("pos.receipt_branch")}</span><span>${receiptData.branchName}</span></div>
      <div class="row"><span>${t("pos.receipt_cashier")}</span><span>${receiptData.cashierName}</span></div>
      <div class="row"><span>${t("pos.receipt_payment")}</span><span>${pmLabels[receiptData.paymentMethod] || receiptData.paymentMethod}</span></div>
      <div class="sep"></div>
      <table>${itemsHtml}</table>
      <div class="sep"></div>
      <div class="row"><span>${t("pos.receipt_subtotal")}</span><span>${receiptData.subtotal} ${t("common.omr")}</span></div>
      ${discountLine}
      ${parseFloat(receiptData.vat) > 0 ? `<div class="row"><span>${t("pos.receipt_tax")}</span><span>${receiptData.vat} ${t("common.omr")}</span></div>` : ""}
      <div class="total-row"><span>${t("pos.receipt_total")}</span><span>${receiptData.total} ${t("common.omr")}</span></div>
      <div class="sep" style="margin-top:6px"></div>
      <div class="footer">${t("pos.receipt_thanks")}</div>
      <div class="footer" style="margin-top:2px">${t("pos.receipt_brand")}</div>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`;
    const w = window.open("", "_blank", "width=320,height=600");
    if (w) { w.document.write(html); w.document.close(); }
  }

  const validatePayment = (): string | null => {
    if (paymentMethod === "card") {
      const ref = cardTxnRef.replace(/\D/g, "");
      if (!ref) return t("pos.card_txn_required");
      if (ref.length < 6 || ref.length > 20) return t("pos.card_txn_length");
    }
    if (sendWhatsApp && !customerPhone.trim()) return t("pos.whatsapp_needs_phone");
    return null;
  };

  const handleConfirmPayment = () => {
    const err = validatePayment();
    if (err) {
      setPaymentError(err);
      return;
    }
    setPaymentError("");
    saleMutation.mutate();
  };

  const saleMutation = useMutation({
    mutationFn: async () => {
      let customerId = null;
      if (customerPhone) {
        const custRes = await apiRequest("POST", "/api/customers/find-or-create", { phone: customerPhone });
        const customer = await custRes.json();
        customerId = customer.id;
      }

      const txnRef = paymentMethod === "card" ? cardTxnRef.replace(/\D/g, "") : 
                      paymentMethod === "bank_transfer" ? bankTxnId : null;

      const invoiceNumber = `INV-${Date.now()}`;
      const saleData = {
        invoiceNumber,
        branchId: user!.branchId,
        cashierId: user!.id,
        customerId,
        subtotal: subtotal.toFixed(3),
        discount: discountAmount.toFixed(3),
        discountType,
        vat: vat.toFixed(3),
        total: total.toFixed(3),
        paymentMethod,
        bankTxnId: txnRef,
        bankReceiptImage: null,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.qty,
          unitPrice: item.product.price,
          total: (parseFloat(item.product.price) * item.qty).toFixed(3),
        })),
      };
      await apiRequest("POST", "/api/sales", saleData);
      return { invoiceNumber, saleData };
    },
    onSuccess: (result) => {
      toast({ title: t("pos.sale_success"), description: t("pos.sale_success_desc") });

      if (sendWhatsApp && customerPhone) {
        const itemsList = cart.map(it => `${it.qty}x ${it.product.name}`).join("\n");
        const message = `مرحبا 🌸\nشكراً لتسوقك من لمسة أنوثة\n\n` +
          `${t("pos.receipt_invoice")}: ${result.invoiceNumber}\n\n` +
          `${itemsList}\n\n` +
          `${t("pos.receipt_total")}: ${result.saleData.total} ${t("common.omr")}\n` +
          `${t("pos.receipt_branch")}: ${branchName}\n\n` +
          `نتمنى زيارتك مرة أخرى 🌸`;
        
        const encoded = encodeURIComponent(message);
        const phone = customerPhone.replace(/\D/g, "");
        const finalPhone = phone.startsWith("968") ? phone : `968${phone}`;
        window.open(`https://wa.me/${finalPhone}?text=${encoded}`, "_blank");
      }

      if (printReceipt) {
        printThermalReceipt({
          invoiceNumber: result.invoiceNumber,
          branchName: branchName,
          cashierName: user?.name || "",
          paymentMethod: result.saleData.paymentMethod,
          subtotal: result.saleData.subtotal,
          discount: result.saleData.discount,
          vat: result.saleData.vat,
          total: result.saleData.total,
          items: cart.map(item => ({
            name: item.product.name,
            qty: item.qty,
            price: parseFloat(item.product.price).toFixed(3),
            lineTotal: (parseFloat(item.product.price) * item.qty).toFixed(3),
          })),
        });
      }

      setCart([]);
      setDiscountValue(0);
      setBankTxnId("");
      setCardTxnRef("");
      setPaymentMethod("cash");
      setCustomerPhone("");
      setSendWhatsApp(false);
      setPrintReceipt(true);
      setFoundCustomerId(null);
      setPaymentError("");
      setPayDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/location-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/current"] });
      if (user?.branchId) {
        queryClient.invalidateQueries({ queryKey: [`/api/branch-stock/${user.branchId}`] });
      }
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const prepareCloseShift = async () => {
    if (!currentShift) return;
    try {
      const reportRes = await fetch(`/api/reports/shift?shiftId=${currentShift.id}`, { credentials: "include" });
      const reportData = await reportRes.json();
      setPreCloseData(reportData);
      setPendingOrders([]);

      setActualCash("");
      setCloseDialogOpen(true);
    } catch (err: any) {
      toast({ title: t("common.error"), description: t("pos.shift_load_error"), variant: "destructive" });
    }
  };

  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      if (!currentShift) throw new Error(t("pos.no_open_shift"));
      const res = await apiRequest("PATCH", `/api/shifts/${currentShift.id}/close`, {
        actualCash: actualCash || "0",
      });
      return await res.json();
    },
    onSuccess: async (closedShift: Shift) => {
      setCloseDialogOpen(false);
      try {
        const reportRes = await fetch(`/api/reports/shift?shiftId=${closedShift.id}`, { credentials: "include" });
        const reportData = await reportRes.json();
        setClosedReport(reportData);
      } catch {
        setClosedReport({
          shift: closedShift,
          cashierName: user?.name,
          openingCash: closedShift.openingCash,
          expectedCash: closedShift.expectedCash,
          actualCash: closedShift.actualCash,
          difference: closedShift.difference,
        });
      }
      setCurrentShift(null);
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-ledger"] });
    },
    onError: (err: Error) => {
      if (err.message.includes("طلب") || err.message.includes("معلق") || err.message.includes("pending") || err.message.includes("order")) {
        setPendingOrders([{ message: err.message }]);
      }
      toast({ title: t("pos.close_shift_error"), description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (isOwner && !currentShift && !closedReport) {
      (async () => {
        try {
          const res = await fetch("/api/shifts/current", { credentials: "include" });
          const data = await res.json();
          if (data.shift) {
            setCurrentShift(data.shift);
          } else {
            const openRes = await apiRequest("POST", "/api/shifts", { openingCash: "0" });
            const shift = await openRes.json();
            setCurrentShift(shift);
          }
        } catch {}
      })();
    }
  }, [isOwner, currentShift, closedReport]);

  if (closedReport && !isOwner) {
    return (
      <ShiftReceipt
        report={closedReport}
        onNewShift={() => {
          setClosedReport(null);
          setCurrentShift(null);
        }}
      />
    );
  }

  if (!currentShift && !isOwner) {
    return (
      <StartPOS
        branchName={branchName}
        terminalName={terminalName}
        userName={user?.name || ""}
        onShiftOpened={(shift) => setCurrentShift(shift)}
      />
    );
  }

  if (!currentShift && isOwner) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{t("pos.checking_shift")}</p>
        </div>
      </div>
    );
  }

  const activeProducts = products.filter(p => p.active !== false);
  // عند اختيار فئة أم → تشمل الفلترة الفئات الفرعية أيضاً
  const childCatIdsInPOS = (parentId: string): number[] =>
    categoriesList.filter((c: any) => String(c.parentId) === parentId).map((c: any) => c.id);

  const filteredProducts = activeProducts.filter(p => {
    const matchSearch = !searchQuery ||
      p.name.includes(searchQuery) ||
      (p.barcode && p.barcode.includes(searchQuery));
    const matchCategory = filterCategory === "all" ||
      p.categoryId === parseInt(filterCategory) ||
      childCatIdsInPOS(filterCategory).includes(p.categoryId ?? -1);
    return matchSearch && matchCategory;
  });

  const addToCart = (product: Product) => {
    const existing = cart.find(i => i.product.id === product.id);
    if (existing) {
      setCart(cart.map(i => i.product.id === product.id ? {...i, qty: i.qty + 1} : i));
    } else {
      setCart([...cart, {product, qty: 1}]);
    }
  };

  const updateQty = (productId: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id === productId) {
        const newQty = i.qty + delta;
        return newQty <= 0 ? i : {...i, qty: newQty};
      }
      return i;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const holdCurrentInvoice = () => {
    if (cart.length === 0) return;
    setHoldNoteDialogOpen(true);
  };

  const confirmHoldInvoice = () => {
    const held: HeldInvoice = {
      id: heldIdCounter.current++,
      cart: [...cart],
      discountValue,
      discountType,
      heldAt: new Date(),
      note: holdNote.trim(),
    };
    setHeldInvoices(prev => [...prev, held]);
    setCart([]);
    setDiscountValue(0);
    setDiscountType("value");
    setHoldNote("");
    setHoldNoteDialogOpen(false);
    toast({ title: t("pos.invoice_held"), description: t("pos.invoice_held_desc") });
  };

  const recallInvoice = (heldId: number) => {
    const held = heldInvoices.find(h => h.id === heldId);
    if (!held) return;
    if (cart.length > 0) {
      const currentHeld: HeldInvoice = {
        id: heldIdCounter.current++,
        cart: [...cart],
        discountValue,
        discountType,
        heldAt: new Date(),
        note: t("pos.auto_held"),
      };
      setHeldInvoices(prev => [...prev.filter(h => h.id !== heldId), currentHeld]);
    } else {
      setHeldInvoices(prev => prev.filter(h => h.id !== heldId));
    }
    setCart(held.cart);
    setDiscountValue(held.discountValue);
    setDiscountType(held.discountType);
    setHeldListDialogOpen(false);
    toast({ title: t("pos.invoice_recalled"), description: held.note || t("pos.invoice_recalled_desc") });
  };

  const deleteHeldInvoice = (heldId: number) => {
    setHeldInvoices(prev => prev.filter(h => h.id !== heldId));
    toast({ title: t("pos.held_deleted") });
  };

  const handleBarcodeSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const barcode = (e.target as HTMLInputElement).value.trim();
      const product = products.find(p => p.barcode === barcode);
      if (product) {
        addToCart(product);
        (e.target as HTMLInputElement).value = "";
        setSearchQuery("");
      } else {
        toast({ 
          title: t("pos.product_not_found"), 
          description: t("pos.product_not_found_desc").replace("{0}", barcode), 
          variant: "destructive" 
        });
      }
    }
  };

  const expectedCashLive = preCloseData ? parseFloat(preCloseData.expectedCash || "0") : 0;
  const actualCashNum = parseFloat(actualCash || "0");
  const liveDiff = actualCash ? actualCashNum - expectedCashLive : 0;
  const locale = "en-US";

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="bg-card p-4 rounded-xl shadow-sm border border-border flex items-center justify-between shrink-0">
        <div className="flex gap-3 items-center text-sm flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
            <Store className="w-4 h-4 text-primary" />
            <span className="font-medium" data-testid="text-active-branch">{branchName}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
            <Monitor className="w-4 h-4 text-muted-foreground" />
            <span data-testid="text-active-terminal">{terminalName}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
            <UserIcon className="w-4 h-4 text-muted-foreground" />
            <span data-testid="text-active-cashier">{user?.name}</span>
          </div>
          {!isOwner && (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {t("pos.shift_number").replace("{0}", String(currentShift!.id))}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-xs">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {currentShift!.startedAt ? new Date(currentShift!.startedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : ""}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isOwner && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={prepareCloseShift}
              data-testid="button-close-shift"
            >
              <XCircle className="w-4 h-4" />
              {t("pos.close_shift")}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={() => logoutMutation.mutate()} data-testid="button-logout-pos">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-6 h-full min-h-0">
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="relative shrink-0 flex gap-2">
            <div className="relative flex-1">
              <Search className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground`} />
              <Input 
                ref={barcodeRef}
                placeholder={t("pos.barcode_placeholder")} 
                className={`${lang === "ar" ? "pr-10" : "pl-10"} h-12 text-lg bg-card shadow-sm border-transparent focus-visible:ring-primary`}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleBarcodeSearch}
                data-testid="input-barcode-search"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0 bg-card shadow-sm"
              onClick={() => setScannerOpen(true)}
              data-testid="button-barcode-scanner"
            >
              <Camera className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 shrink-0">
            <Button 
              variant={filterCategory === "all" ? "default" : "secondary"} 
              className="rounded-full" 
              onClick={() => setFilterCategory("all")}
              data-testid="button-category-all"
            >
              {t("pos.all_categories")}
            </Button>
            {/* الفئات الرئيسية أولاً، ثم الفرعية */}
            {categoriesList.filter((c: any) => !c.parentId).map((parent: any) => [
              <Button
                key={parent.id}
                variant={filterCategory === parent.id.toString() ? "default" : "secondary"}
                className="rounded-full font-semibold"
                onClick={() => setFilterCategory(parent.id.toString())}
              >
                {parent.name}
              </Button>,
              ...categoriesList.filter((c: any) => c.parentId === parent.id).map((child: any) => (
                <Button
                  key={child.id}
                  variant={filterCategory === child.id.toString() ? "default" : "outline"}
                  className="rounded-full text-sm"
                  onClick={() => setFilterCategory(child.id.toString())}
                >
                  ↳ {child.name}
                </Button>
              ))
            ])}
            {/* فئات بدون أب */}
            {categoriesList.filter((c: any) => c.parentId && !categoriesList.some((p: any) => p.id === c.parentId)).map((c: any) => (
              <Button key={c.id} variant={filterCategory === c.id.toString() ? "default" : "secondary"} className="rounded-full" onClick={() => setFilterCategory(c.id.toString())}>
                {c.name}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-4 content-start">
            {filteredProducts.map(p => (
              <button 
                key={p.id} 
                onClick={() => addToCart(p)}
                className="bg-card hover:bg-accent hover:border-primary/50 transition-all border border-transparent p-4 rounded-xl shadow-sm flex flex-col items-center gap-3 text-center active:scale-95"
                data-testid={`button-product-${p.id}`}
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm line-clamp-1">{p.name}</h3>
                  <p className="text-primary font-bold mt-1">{parseFloat(p.price).toFixed(3)} {t("common.omr")}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="w-96 bg-card border border-border shadow-sm rounded-xl flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <h2 className="font-bold text-lg" data-testid="text-cart-title">{t("pos.cart_title")}</h2>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                disabled={cart.length === 0}
                onClick={holdCurrentInvoice}
                data-testid="button-hold-invoice"
              >
                <Pause className="w-3.5 h-3.5" />
                {t("pos.hold")}
              </Button>
              <Button
                variant={heldInvoices.length > 0 ? "default" : "outline"}
                size="sm"
                className={`gap-1.5 ${heldInvoices.length > 0 ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                onClick={() => setHeldListDialogOpen(true)}
                disabled={heldInvoices.length === 0}
                data-testid="button-recall-invoice"
              >
                <Play className="w-3.5 h-3.5" />
                {t("pos.recall")}
                {heldInvoices.length > 0 && (
                  <span className="bg-white text-blue-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {heldInvoices.length}
                  </span>
                )}
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <p>{t("pos.cart_empty")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3 p-2 bg-background border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold truncate">{item.product.name}</h4>
                      <div className="text-xs text-muted-foreground">{parseFloat(item.product.price).toFixed(3)} {t("common.omr")}</div>
                    </div>
                    <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                      <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-background" onClick={() => updateQty(item.product.id, 1)}>
                        <Plus className="w-3 h-3"/>
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                      <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-background" onClick={() => updateQty(item.product.id, -1)}>
                        <Minus className="w-3 h-3"/>
                      </button>
                    </div>
                    <button className="text-red-500 p-2 hover:bg-red-50 rounded-md" onClick={() => removeFromCart(item.product.id)} data-testid={`button-remove-${item.product.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-muted/10 border-t border-border space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.subtotal")}</span>
                <span className="font-medium">{subtotal.toFixed(3)} {t("common.omr")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("pos.vat_label")}</span>
                <span>{vat.toFixed(3)} {t("common.omr")}</span>
              </div>
            </div>
            
            <div className="pt-3 border-t border-border flex justify-between items-center">
              <span className="font-bold text-lg">{t("pos.total_label")}</span>
              <span className="font-bold text-2xl text-primary" data-testid="text-cart-total">{total.toFixed(3)} {t("common.omr")}</span>
            </div>

            <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full h-12 text-lg font-bold mt-2" disabled={cart.length === 0} data-testid="button-checkout">
                  {t("pos.checkout")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                  <DialogTitle>{t("pos.payment_title")}</DialogTitle>
                  <DialogDescription>{t("pos.payment_desc")}</DialogDescription>
                </DialogHeader>
                <div className="py-3 space-y-5 max-h-[70vh] overflow-y-auto">
                  <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">{t("pos.amount_due")}</p>
                    <p className="text-3xl font-bold text-primary">{total.toFixed(3)} {t("common.omr")}</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">{t("pos.payment_method")}</label>
                    <div className="grid grid-cols-3 gap-3">
                      <Button variant={paymentMethod === "cash" ? "default" : "outline"} onClick={() => { setPaymentMethod("cash"); setPaymentError(""); }} className="h-12" data-testid="button-pay-cash">{t("pos.pay_cash")}</Button>
                      <Button variant={paymentMethod === "card" ? "default" : "outline"} onClick={() => { setPaymentMethod("card"); setPaymentError(""); }} className="h-12" data-testid="button-pay-card">{t("pos.pay_card")}</Button>
                      <Button variant={paymentMethod === "bank_transfer" ? "default" : "outline"} onClick={() => { setPaymentMethod("bank_transfer"); setPaymentError(""); }} className="h-12 text-xs" data-testid="button-pay-bank">{t("pos.pay_bank")}</Button>
                    </div>
                  </div>

                  {paymentMethod === "card" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                      <label className="text-sm font-medium">
                        {t("pos.card_txn_ref")} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        placeholder={t("pos.card_txn_ref_placeholder")}
                        value={cardTxnRef}
                        onChange={(e) => { setCardTxnRef(e.target.value.replace(/\D/g, "")); setPaymentError(""); }}
                        maxLength={20}
                        className="text-center text-lg tracking-wider font-mono"
                        data-testid="input-card-txn-ref"
                      />
                      <p className="text-xs text-muted-foreground">{t("pos.card_txn_ref_hint")}</p>
                    </div>
                  )}

                  {paymentMethod === "bank_transfer" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                      <label className="text-sm font-medium">{t("pos.txn_id")}</label>
                      <Input placeholder={t("pos.txn_id_placeholder")} value={bankTxnId} onChange={(e) => setBankTxnId(e.target.value)} data-testid="input-txn-id" />
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="customer-phone" className="text-sm font-medium">{t("pos.customer_phone")}</Label>
                      <Input
                        id="customer-phone"
                        placeholder={t("pos.customer_phone_placeholder")}
                        value={customerPhone}
                        onChange={(e) => { setCustomerPhone(e.target.value); setPaymentError(""); }}
                        data-testid="input-customer-phone"
                      />
                    </div>
                  </div>

                  <div className="bg-muted/30 rounded-lg p-3 space-y-3 border">
                    <label className="text-sm font-medium">{t("pos.receipt_delivery")}</label>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <Checkbox
                        id="send-whatsapp"
                        checked={sendWhatsApp}
                        onCheckedChange={(checked) => { setSendWhatsApp(!!checked); setPaymentError(""); }}
                        disabled={!customerPhone.trim()}
                        data-testid="checkbox-send-whatsapp"
                      />
                      <Label
                        htmlFor="send-whatsapp"
                        className={`text-sm font-medium ${!customerPhone.trim() ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-green-600" />
                          {t("pos.send_whatsapp")}
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <Checkbox
                        id="print-receipt"
                        checked={printReceipt}
                        onCheckedChange={(checked) => setPrintReceipt(!!checked)}
                        data-testid="checkbox-print-receipt"
                      />
                      <Label htmlFor="print-receipt" className="text-sm font-medium cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Printer className="w-4 h-4 text-blue-600" />
                          {t("pos.print_invoice")}
                        </div>
                      </Label>
                    </div>
                  </div>

                  {paymentError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-sm text-red-700 font-medium" data-testid="text-payment-error">{paymentError}</p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button className="w-full h-12 gap-2 text-lg" onClick={handleConfirmPayment} disabled={saleMutation.isPending} data-testid="button-confirm-pay">
                    <CheckCircle2 className="w-5 h-5" />
                    {saleMutation.isPending ? t("pos.confirming") : t("pos.confirm_payment")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              {t("pos.close_shift_title").replace("{0}", String(currentShift?.id || ""))}
            </DialogTitle>
            <DialogDescription>{t("pos.close_shift_desc")}</DialogDescription>
          </DialogHeader>

          {pendingOrders.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-red-800 text-sm">{t("pos.cannot_close")}</p>
                <p className="text-red-600 text-sm mt-1">{pendingOrders[0]?.message || t("pos.pending_orders_msg")}</p>
              </div>
            </div>
          )}

          {preCloseData && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">{t("pos.total_sales")}</p>
                    <p className="text-lg font-bold text-green-600" data-testid="text-close-total-sales">{fmt(preCloseData.totalSales)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">{t("pos.expenses_label")}</p>
                    <p className="text-lg font-bold text-red-600">{fmt(preCloseData.totalExpenses)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">{t("pos.net_label")}</p>
                    <p className="text-lg font-bold text-primary">{fmt(preCloseData.netTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="border rounded-lg overflow-hidden text-sm">
                <div className="bg-muted/30 px-3 py-2 font-bold border-b text-xs">{t("pos.sales_details")}</div>
                <div className="divide-y text-xs">
                  <div className="flex justify-between px-3 py-1.5">
                    <span>{t("pos.cash_count").replace("{0}", String(preCloseData.salesCash?.count || 0))}</span>
                    <span className="font-medium">{fmt(preCloseData.salesCash?.total)} {t("common.omr")}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span>{t("pos.card_count").replace("{0}", String(preCloseData.salesCard?.count || 0))}</span>
                    <span className="font-medium">{fmt(preCloseData.salesCard?.total)} {t("common.omr")}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span>{t("pos.bank_count").replace("{0}", String(preCloseData.salesBankTransfer?.count || 0))}</span>
                    <span className="font-medium">{fmt(preCloseData.salesBankTransfer?.total)} {t("common.omr")}</span>
                  </div>
                </div>
              </div>

              <div className="border-2 border-blue-200 rounded-lg overflow-hidden text-sm">
                <div className="bg-blue-50 px-3 py-2 font-bold border-b border-blue-200 text-blue-800 text-xs">{t("pos.cash_reconciliation")}</div>
                <div className="divide-y divide-blue-100 text-xs">
                  <div className="flex justify-between px-3 py-1.5">
                    <span>{t("pos.opening_balance")}</span>
                    <span className="font-medium">{fmt(preCloseData.openingCash)} {t("common.omr")}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span>{t("pos.plus_cash_sales")}</span>
                    <span className="font-medium text-green-600">{fmt(preCloseData.salesCash?.total)} {t("common.omr")}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span>{t("pos.minus_cash_expenses")}</span>
                    <span className="font-medium text-red-600">{fmt(preCloseData.expensesCash?.total)} {t("common.omr")}</span>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-blue-50 font-bold">
                    <span>{t("pos.expected_in_drawer")}</span>
                    <span className="text-blue-700" data-testid="text-close-expected">{fmt(preCloseData.expectedCash)} {t("common.omr")}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  {t("pos.actual_cash_label")}
                </label>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="0.000"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className="h-14 text-2xl text-center font-bold border-2"
                  autoFocus
                  data-testid="input-actual-cash"
                />
              </div>

              {actualCash && (
                <div className={`rounded-lg p-4 text-center border-2 ${Math.abs(liveDiff) < 0.002 ? "bg-green-50 border-green-300" : liveDiff > 0 ? "bg-blue-50 border-blue-300" : "bg-red-50 border-red-300"}`}>
                  <p className="text-xs text-muted-foreground mb-1">{t("pos.difference")}</p>
                  <p className={`text-2xl font-bold ${Math.abs(liveDiff) < 0.002 ? "text-green-600" : liveDiff > 0 ? "text-blue-600" : "text-red-600"}`} data-testid="text-close-live-diff">
                    {Math.abs(liveDiff) < 0.002 ? t("pos.matched_check") : liveDiff > 0 ? t("pos.surplus_amount").replace("{0}", liveDiff.toFixed(3)) : t("pos.shortage_amount").replace("{0}", liveDiff.toFixed(3))}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => closeShiftMutation.mutate()}
              disabled={closeShiftMutation.isPending || !actualCash}
              className="gap-2"
              data-testid="button-confirm-close-shift"
            >
              {closeShiftMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("pos.closing_shift")}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  {t("pos.confirm_close_shift")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={holdNoteDialogOpen} onOpenChange={setHoldNoteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pause className="w-5 h-5 text-orange-500" />
              {t("pos.hold_invoice_title")}
            </DialogTitle>
            <DialogDescription>{t("pos.hold_invoice_desc")}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm font-medium text-orange-800">
                {t("pos.hold_items_count").replace("{0}", String(cart.length))} - {t("pos.total_label")} {total.toFixed(3)} {t("common.omr")}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("pos.hold_note_label")}</label>
              <Input
                placeholder={t("pos.hold_note_placeholder")}
                value={holdNote}
                onChange={(e) => setHoldNote(e.target.value)}
                data-testid="input-hold-note"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setHoldNoteDialogOpen(false); setHoldNote(""); }}>{t("common.cancel")}</Button>
            <Button className="gap-2 bg-orange-600 hover:bg-orange-700" onClick={confirmHoldInvoice} data-testid="button-confirm-hold">
              <Pause className="w-4 h-4" />
              {t("pos.confirm_hold")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={heldListDialogOpen} onOpenChange={setHeldListDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
              {t("pos.held_invoices_title")}
            </DialogTitle>
            <DialogDescription>{t("pos.held_invoices_desc").replace("{0}", String(heldInvoices.length))}</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3 max-h-[60vh] overflow-y-auto">
            {heldInvoices.map((held) => {
              const heldTotal = held.cart.reduce((sum, item) => {
                const sub = parseFloat(item.product.price) * item.qty;
                const disc = held.discountType === "percentage" ? sub * (held.discountValue / 100) : held.discountValue;
                return sum + sub - disc;
              }, 0) * 1.05;
              return (
                <div key={held.id} className="border rounded-lg p-3 hover:border-blue-300 transition-colors" data-testid={`held-invoice-${held.id}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-sm">
                        {held.note || `${t("pos.held_invoice")} #${held.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {held.heldAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="font-bold text-primary">{heldTotal.toFixed(3)} {t("common.omr")}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {held.cart.slice(0, 3).map((item, idx) => (
                      <span key={idx} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {item.product.name} x{item.qty}
                      </span>
                    ))}
                    {held.cart.length > 3 && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        +{held.cart.length - 3}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={() => recallInvoice(held.id)} data-testid={`button-recall-${held.id}`}>
                      <Play className="w-3.5 h-3.5" />
                      {t("pos.recall_this")}
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => deleteHeldInvoice(held.id)} data-testid={`button-delete-held-${held.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(barcode) => {
          const product = products.find(p => p.barcode === barcode);
          if (product) {
            addToCart(product);
            toast({ title: t("pos.product_added"), description: product.name });
          } else {
            toast({
              title: t("pos.product_not_found"),
              description: t("pos.product_not_found_desc").replace("{0}", barcode),
              variant: "destructive",
            });
          }
        }}
      />
    </div>
  );
}
