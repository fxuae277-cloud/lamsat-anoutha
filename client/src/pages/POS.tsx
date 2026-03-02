import { useState, useRef, useEffect } from "react";
import { Search, Plus, Minus, Trash2, CheckCircle2, Image as ImageIcon, Store, Monitor, Banknote, LogOut, User as UserIcon, XCircle, Clock, AlertTriangle, Printer, ArrowLeft, Receipt, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
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
      toast({ title: "تم فتح الشفت بنجاح" });
      onShiftOpened(shift);
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  if (checking) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">جارٍ التحقق من الشفت...</p>
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
          <h1 className="text-xl font-bold" data-testid="text-start-pos-title">تشغيل نقطة البيع</h1>
          <p className="text-sm text-muted-foreground mt-1">أدخل رصيد الصندوق لفتح شفت جديد</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5" /> الكاشير:</span>
              <span className="font-medium" data-testid="text-pos-user">{userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> الفرع:</span>
              <span className="font-medium" data-testid="text-pos-branch">{branchName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> الجهاز:</span>
              <span className="font-medium" data-testid="text-pos-terminal">{terminalName}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Banknote className="w-4 h-4 text-muted-foreground" />
              رصيد الصندوق الافتتاحي (OMR)
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
                جارٍ الفتح...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                فتح شفت جديد
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ShiftReceipt({ report, onNewShift }: { report: any; onNewShift: () => void }) {
  const diff = parseFloat(report.difference || "0");
  const diffColor = Math.abs(diff) < 0.002 ? "text-green-600" : diff > 0 ? "text-blue-600" : "text-red-600";
  const diffLabel = Math.abs(diff) < 0.002 ? "مطابق ✓" : diff > 0 ? `زيادة +${fmt(diff)}` : `نقص ${fmt(diff)}`;

  return (
    <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-green-50 p-5 text-center border-b border-border">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-green-800" data-testid="text-shift-closed-title">تم إغلاق الشفت بنجاح</h2>
          <p className="text-sm text-green-600 mt-1">شفت #{report.shift?.id}</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">الكاشير</p>
              <p className="font-bold mt-1">{report.cashierName || "-"}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">الجهاز</p>
              <p className="font-bold mt-1">{report.shift?.terminalName || "-"}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">وقت الفتح</p>
              <p className="font-bold mt-1">{report.shift?.startedAt ? new Date(report.shift.startedAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" }) : "-"}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">وقت الإغلاق</p>
              <p className="font-bold mt-1">{report.shift?.endedAt ? new Date(report.shift.endedAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" }) : "-"}</p>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-muted/30 px-4 py-2 font-bold border-b">ملخص المبيعات</div>
            <div className="divide-y">
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">نقدي ({report.salesCash?.count || 0} عملية)</span>
                <span className="font-medium">{fmt(report.salesCash?.total)} ر.ع</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">بطاقة ({report.salesCard?.count || 0} عملية)</span>
                <span className="font-medium">{fmt(report.salesCard?.total)} ر.ع</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">تحويل بنكي ({report.salesBankTransfer?.count || 0} عملية)</span>
                <span className="font-medium">{fmt(report.salesBankTransfer?.total)} ر.ع</span>
              </div>
              <div className="flex justify-between px-4 py-2 bg-green-50 font-bold">
                <span>إجمالي المبيعات</span>
                <span className="text-green-700">{fmt(report.totalSales)} ر.ع</span>
              </div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="bg-muted/30 px-4 py-2 font-bold border-b">المصروفات</div>
            <div className="divide-y">
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">نقدية ({report.expensesCash?.count || 0})</span>
                <span className="font-medium text-red-600">{fmt(report.expensesCash?.total)} ر.ع</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">بنكية ({report.expensesBank?.count || 0})</span>
                <span className="font-medium text-red-600">{fmt(report.expensesBank?.total)} ر.ع</span>
              </div>
            </div>
          </div>

          <div className="border-2 border-primary/30 rounded-lg overflow-hidden text-sm">
            <div className="bg-primary/10 px-4 py-2 font-bold border-b border-primary/20">تسوية الصندوق</div>
            <div className="divide-y divide-primary/10">
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">الافتتاحية</span>
                <span className="font-medium">{fmt(report.openingCash)} ر.ع</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">+ مبيعات نقدية</span>
                <span className="font-medium text-green-600">{fmt(report.salesCash?.total)} ر.ع</span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">- مصروفات نقدية</span>
                <span className="font-medium text-red-600">{fmt(report.expensesCash?.total)} ر.ع</span>
              </div>
              <div className="flex justify-between px-4 py-2 bg-blue-50 font-bold">
                <span>= المتوقع في الصندوق</span>
                <span>{fmt(report.expectedCash)} ر.ع</span>
              </div>
              <div className="flex justify-between px-4 py-2 font-bold">
                <span>الفعلي في الصندوق</span>
                <span>{fmt(report.actualCash)} ر.ع</span>
              </div>
              <div className={`flex justify-between px-4 py-3 font-bold text-lg ${Math.abs(diff) < 0.002 ? "bg-green-50" : "bg-red-50"}`}>
                <span>الفرق</span>
                <span className={diffColor} data-testid="text-shift-difference">{diffLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between px-4 py-3 bg-primary/5 rounded-lg border border-primary/20 font-bold">
            <span>صافي الدخل</span>
            <span className="text-primary text-lg">{fmt(report.netTotal)} ر.ع</span>
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => window.print()} data-testid="button-print-receipt">
            <Printer className="w-4 h-4" />
            طباعة
          </Button>
          <Button className="flex-1 gap-2" onClick={onNewShift} data-testid="button-new-shift">
            <ArrowLeft className="w-4 h-4" />
            شفت جديد
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function POS() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
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

  const { data: products = [] } = useQuery<Product[]>({
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

  const branchName = branchesList.find(b => b.id === user?.branchId)?.name || "";
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
    const pmLabels: Record<string, string> = { cash: "نقدي", card: "بطاقة", bank_transfer: "تحويل بنكي" };
    const dateStr = new Date().toLocaleDateString("ar-OM") + " " + new Date().toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" });
    const itemsHtml = receiptData.items.map(it => `
      <tr>
        <td style="text-align:left;font-size:11px;padding:1px 0">${it.lineTotal}</td>
        <td style="text-align:center;font-size:11px;padding:1px 0">${it.price} x${it.qty}</td>
        <td style="text-align:right;font-size:12px;padding:1px 0">${it.name}</td>
      </tr>
    `).join("");
    const discountLine = parseFloat(receiptData.discount) > 0
      ? `<div style="display:flex;justify-content:space-between"><span>الخصم</span><span>-${receiptData.discount}</span></div>` : "";
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>إيصال</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Cairo',sans-serif; width:80mm; padding:6mm 4mm; color:#000; direction:rtl; font-size:12px; }
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
      <div class="center brand">لمسة أنوثة</div>
      <div class="center" style="font-size:10px;color:#888">إيصال بيع</div>
      <div class="sep"></div>
      <div class="row"><span>الفاتورة:</span><span>${receiptData.invoiceNumber}</span></div>
      <div class="row"><span>التاريخ:</span><span>${dateStr}</span></div>
      <div class="row"><span>الفرع:</span><span>${receiptData.branchName}</span></div>
      <div class="row"><span>الكاشير:</span><span>${receiptData.cashierName}</span></div>
      <div class="row"><span>الدفع:</span><span>${pmLabels[receiptData.paymentMethod] || receiptData.paymentMethod}</span></div>
      <div class="sep"></div>
      <table>${itemsHtml}</table>
      <div class="sep"></div>
      <div class="row"><span>المجموع الفرعي</span><span>${receiptData.subtotal} OMR</span></div>
      ${discountLine}
      ${parseFloat(receiptData.vat) > 0 ? `<div class="row"><span>الضريبة</span><span>${receiptData.vat} OMR</span></div>` : ""}
      <div class="total-row"><span>الإجمالي</span><span>${receiptData.total} OMR</span></div>
      <div class="sep" style="margin-top:6px"></div>
      <div class="footer">شكراً لتسوقكم معنا</div>
      <div class="footer" style="margin-top:2px">لمسة أنوثة - سلطنة عمان</div>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`;
    const w = window.open("", "_blank", "width=320,height=600");
    if (w) { w.document.write(html); w.document.close(); }
  }

  const saleMutation = useMutation({
    mutationFn: async () => {
      const invoiceNumber = `INV-${Date.now()}`;
      const saleData = {
        invoiceNumber,
        branchId: user!.branchId,
        cashierId: user!.id,
        customerId: null,
        subtotal: subtotal.toFixed(3),
        discount: discountAmount.toFixed(3),
        discountType,
        vat: vat.toFixed(3),
        total: total.toFixed(3),
        paymentMethod,
        bankTxnId: paymentMethod === "bank_transfer" ? bankTxnId : null,
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
      toast({ title: "تمت العملية بنجاح", description: "تم حفظ الفاتورة." });

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

      setCart([]);
      setDiscountValue(0);
      setBankTxnId("");
      setPaymentMethod("cash");
      setPayDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/location-inventory"] });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
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
      toast({ title: "خطأ", description: "فشل تحميل بيانات الشفت", variant: "destructive" });
    }
  };

  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      if (!currentShift) throw new Error("لا يوجد شفت مفتوح");
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
      if (err.message.includes("طلب") || err.message.includes("معلق")) {
        setPendingOrders([{ message: err.message }]);
      }
      toast({ title: "خطأ في إغلاق الشفت", description: err.message, variant: "destructive" });
    },
  });

  if (closedReport) {
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

  if (!currentShift) {
    return (
      <StartPOS
        branchName={branchName}
        terminalName={terminalName}
        userName={user?.name || ""}
        onShiftOpened={(shift) => setCurrentShift(shift)}
      />
    );
  }

  const activeProducts = products.filter(p => p.active !== false);
  const filteredProducts = activeProducts.filter(p => {
    const matchSearch = !searchQuery || 
      p.name.includes(searchQuery) || 
      (p.barcode && p.barcode.includes(searchQuery));
    const matchCategory = filterCategory === "all" || p.categoryId === parseInt(filterCategory);
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

  const handleBarcodeSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const barcode = (e.target as HTMLInputElement).value.trim();
      const product = products.find(p => p.barcode === barcode);
      if (product) {
        addToCart(product);
        (e.target as HTMLInputElement).value = "";
        setSearchQuery("");
      } else {
        toast({ title: "المنتج غير موجود", description: `لا يوجد منتج بالباركود: ${barcode}`, variant: "destructive" });
      }
    }
  };

  const expectedCashLive = preCloseData ? parseFloat(preCloseData.expectedCash || "0") : 0;
  const actualCashNum = parseFloat(actualCash || "0");
  const liveDiff = actualCash ? actualCashNum - expectedCashLive : 0;

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
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            شفت #{currentShift.id}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-xs">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            {currentShift.startedAt ? new Date(currentShift.startedAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" }) : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={prepareCloseShift}
            data-testid="button-close-shift"
          >
            <XCircle className="w-4 h-4" />
            إغلاق الشفت
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={logout} data-testid="button-logout-pos">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-6 h-full min-h-0">
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="relative shrink-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              ref={barcodeRef}
              placeholder="امسح الباركود واضغط Enter أو ابحث بالاسم..." 
              className="pr-10 h-12 text-lg bg-card shadow-sm border-transparent focus-visible:ring-primary"
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleBarcodeSearch}
              data-testid="input-barcode-search"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 shrink-0">
            <Button 
              variant={filterCategory === "all" ? "default" : "secondary"} 
              className="rounded-full" 
              onClick={() => setFilterCategory("all")}
              data-testid="button-category-all"
            >
              الكل
            </Button>
            {categoriesList.map((cat: any) => (
              <Button 
                key={cat.id} 
                variant={filterCategory === cat.id.toString() ? "default" : "secondary"} 
                className="rounded-full"
                onClick={() => setFilterCategory(cat.id.toString())}
              >
                {cat.name}
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
                  <p className="text-primary font-bold mt-1">{parseFloat(p.price).toFixed(3)} OMR</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="w-96 bg-card border border-border shadow-sm rounded-xl flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="font-bold text-lg" data-testid="text-cart-title">سلة المشتريات</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <p>السلة فارغة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3 p-2 bg-background border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold truncate">{item.product.name}</h4>
                      <div className="text-xs text-muted-foreground">{parseFloat(item.product.price).toFixed(3)} OMR</div>
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
            <div className="flex items-center gap-2 pb-2">
              <Input 
                type="number" 
                placeholder="خصم" 
                className="w-24 text-center" 
                value={discountValue || ""}
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                data-testid="input-discount"
              />
              <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="value">OMR</SelectItem>
                  <SelectItem value="percentage">%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">المجموع الفرعي:</span>
                <span className="font-medium">{subtotal.toFixed(3)} OMR</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الخصم:</span>
                  <span className="text-green-600">-{discountAmount.toFixed(3)} OMR</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ضريبة القيمة المضافة (5%):</span>
                <span>{vat.toFixed(3)} OMR</span>
              </div>
            </div>
            
            <div className="pt-3 border-t border-border flex justify-between items-center">
              <span className="font-bold text-lg">الإجمالي:</span>
              <span className="font-bold text-2xl text-primary" data-testid="text-cart-total">{total.toFixed(3)} OMR</span>
            </div>

            <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full h-12 text-lg font-bold mt-2" disabled={cart.length === 0} data-testid="button-checkout">
                  دفع وإنهاء
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>إتمام الدفع</DialogTitle>
                  <DialogDescription>اختر طريقة الدفع وأكمل العملية</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-6">
                  <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">المبلغ المطلوب</p>
                    <p className="text-3xl font-bold text-primary">{total.toFixed(3)} OMR</p>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-sm font-medium">طريقة الدفع</label>
                    <div className="grid grid-cols-3 gap-3">
                      <Button variant={paymentMethod === "cash" ? "default" : "outline"} onClick={() => setPaymentMethod("cash")} className="h-12" data-testid="button-pay-cash">نقداً</Button>
                      <Button variant={paymentMethod === "card" ? "default" : "outline"} onClick={() => setPaymentMethod("card")} className="h-12" data-testid="button-pay-card">بطاقة</Button>
                      <Button variant={paymentMethod === "bank_transfer" ? "default" : "outline"} onClick={() => setPaymentMethod("bank_transfer")} className="h-12 text-xs" data-testid="button-pay-bank">تحويل بنكي</Button>
                    </div>
                  </div>

                  {paymentMethod === "bank_transfer" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">رقم العملية (Txn ID)</label>
                        <Input placeholder="أدخل رقم التحويل..." value={bankTxnId} onChange={(e) => setBankTxnId(e.target.value)} data-testid="input-txn-id" />
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button className="w-full h-12 gap-2 text-lg" onClick={() => saleMutation.mutate()} disabled={saleMutation.isPending} data-testid="button-confirm-pay">
                    <CheckCircle2 className="w-5 h-5" />
                    {saleMutation.isPending ? "جارِ الحفظ..." : "تأكيد الدفع"}
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
              إغلاق الشفت #{currentShift.id}
            </DialogTitle>
            <DialogDescription>راجع ملخص الشفت وأدخل المبلغ الفعلي في الصندوق</DialogDescription>
          </DialogHeader>

          {pendingOrders.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-red-800 text-sm">لا يمكن إغلاق الشفت</p>
                <p className="text-red-600 text-sm mt-1">{pendingOrders[0]?.message || "يوجد طلبات معلقة"}</p>
              </div>
            </div>
          )}

          {preCloseData && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
                    <p className="text-lg font-bold text-green-600" data-testid="text-close-total-sales">{fmt(preCloseData.totalSales)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">المصروفات</p>
                    <p className="text-lg font-bold text-red-600">{fmt(preCloseData.totalExpenses)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">الصافي</p>
                    <p className="text-lg font-bold text-primary">{fmt(preCloseData.netTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="border rounded-lg overflow-hidden text-sm">
                <div className="bg-muted/30 px-3 py-2 font-bold border-b text-xs">تفاصيل المبيعات</div>
                <div className="divide-y text-xs">
                  <div className="flex justify-between px-3 py-1.5">
                    <span>نقدي ({preCloseData.salesCash?.count || 0})</span>
                    <span className="font-medium">{fmt(preCloseData.salesCash?.total)} ر.ع</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span>بطاقة ({preCloseData.salesCard?.count || 0})</span>
                    <span className="font-medium">{fmt(preCloseData.salesCard?.total)} ر.ع</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span>تحويل بنكي ({preCloseData.salesBankTransfer?.count || 0})</span>
                    <span className="font-medium">{fmt(preCloseData.salesBankTransfer?.total)} ر.ع</span>
                  </div>
                </div>
              </div>

              <div className="border-2 border-blue-200 rounded-lg overflow-hidden text-sm">
                <div className="bg-blue-50 px-3 py-2 font-bold border-b border-blue-200 text-blue-800 text-xs">تسوية الصندوق</div>
                <div className="divide-y divide-blue-100 text-xs">
                  <div className="flex justify-between px-3 py-1.5">
                    <span>الافتتاحية</span>
                    <span className="font-medium">{fmt(preCloseData.openingCash)} ر.ع</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span>+ مبيعات نقدية</span>
                    <span className="font-medium text-green-600">{fmt(preCloseData.salesCash?.total)} ر.ع</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5">
                    <span>- مصروفات نقدية</span>
                    <span className="font-medium text-red-600">{fmt(preCloseData.expensesCash?.total)} ر.ع</span>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-blue-50 font-bold">
                    <span>= المتوقع في الصندوق</span>
                    <span className="text-blue-700" data-testid="text-close-expected">{fmt(preCloseData.expectedCash)} ر.ع</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  <Banknote className="w-4 h-4" />
                  المبلغ الفعلي في الصندوق (ر.ع)
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
                  <p className="text-xs text-muted-foreground mb-1">الفرق</p>
                  <p className={`text-2xl font-bold ${Math.abs(liveDiff) < 0.002 ? "text-green-600" : liveDiff > 0 ? "text-blue-600" : "text-red-600"}`} data-testid="text-close-live-diff">
                    {Math.abs(liveDiff) < 0.002 ? "مطابق ✓" : liveDiff > 0 ? `+${liveDiff.toFixed(3)} زيادة` : `${liveDiff.toFixed(3)} نقص`}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>إلغاء</Button>
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
                  جارٍ الإغلاق...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  تأكيد إغلاق الشفت
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
