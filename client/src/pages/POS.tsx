import { useState, useRef } from "react";
import { Search, Plus, Minus, Trash2, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Product, Branch, User } from "@shared/schema";

export default function POS() {
  const { toast } = useToast();
  const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankTxnId, setBankTxnId] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedCashier, setSelectedCashier] = useState<string>("");
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
  const { data: usersList = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: categoriesList = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const cashiers = usersList.filter(u => u.role === "cashier" || u.role === "owner");

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

  const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.product.price) * item.qty), 0);
  const discountAmount = discountType === "percentage" ? subtotal * (discountValue / 100) : discountValue;
  const afterDiscount = subtotal - discountAmount;
  const vat = afterDiscount * 0.05;
  const total = afterDiscount + vat;

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

  const saleMutation = useMutation({
    mutationFn: async () => {
      const branchId = parseInt(selectedBranch);
      const cashierId = selectedCashier ? parseInt(selectedCashier) : undefined;
      if (!branchId) throw new Error("يجب اختيار الفرع");
      
      const invoiceNumber = `INV-${Date.now()}`;
      const saleData = {
        invoiceNumber,
        branchId,
        cashierId: cashierId || null,
        customerId: null,
        subtotal: subtotal.toFixed(3),
        discount: discountAmount.toFixed(3),
        discountType,
        vat: vat.toFixed(3),
        total: total.toFixed(3),
        paymentMethod,
        bankTxnId: paymentMethod === "bank" ? bankTxnId : null,
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
      setPayDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="bg-card p-4 rounded-xl shadow-sm border border-border flex items-center justify-between shrink-0">
        <div className="flex gap-4 items-center">
          <div className="w-48">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger data-testid="select-branch">
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branchesList.map(b => (
                  <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={selectedCashier} onValueChange={setSelectedCashier}>
              <SelectTrigger data-testid="select-cashier">
                <SelectValue placeholder="الكاشير" />
              </SelectTrigger>
              <SelectContent>
                {cashiers.map(u => (
                  <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                <Button className="w-full h-12 text-lg font-bold mt-2" disabled={cart.length === 0 || !selectedBranch} data-testid="button-checkout">
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
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant={paymentMethod === "cash" ? "default" : "outline"} onClick={() => setPaymentMethod("cash")} className="h-12" data-testid="button-pay-cash">نقداً</Button>
                      <Button variant={paymentMethod === "bank" ? "default" : "outline"} onClick={() => setPaymentMethod("bank")} className="h-12" data-testid="button-pay-bank">تحويل بنكي</Button>
                    </div>
                  </div>

                  {paymentMethod === "bank" && (
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
