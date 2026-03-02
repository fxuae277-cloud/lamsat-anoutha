import { useState, useRef, useEffect } from "react";
import { Search, Plus, Minus, Trash2, CheckCircle2, Image as ImageIcon, Store, Monitor, Banknote, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Product, Branch, Shift } from "@shared/schema";

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

export default function POS() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);

  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankTxnId, setBankTxnId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<"percentage" | "value">("value");
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const barcodeRef = useRef<HTMLInputElement>(null);

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
    },
    onSuccess: () => {
      toast({ title: "تمت العملية بنجاح", description: "تم حفظ الفاتورة." });
      setCart([]);
      setDiscountValue(0);
      setBankTxnId("");
      setPaymentMethod("cash");
      setPayDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

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

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="bg-card p-4 rounded-xl shadow-sm border border-border flex items-center justify-between shrink-0">
        <div className="flex gap-4 items-center text-sm">
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
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={logout} data-testid="button-logout-pos">
          <LogOut className="w-4 h-4" />
          خروج
        </Button>
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
    </div>
  );
}
