import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";
import { Camera, Search, Trash2, Plus, Minus, ShoppingCart, Loader2, X, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CartItem = {
  productId: number;
  variantId?: number;
  name: string;
  barcode: string;
  price: number;
  qty: number;
  color?: string;
  size?: string;
};

type Product = { id: number; name: string; barcode: string; price: string; active: boolean };
type Variant = { id: number; productId: number; barcode: string; price: string; color: string; size: string; productName?: string };

export default function MobilePOS() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankTxnId, setBankTxnId] = useState("");

  const { data: currentShift } = useQuery<any>({
    queryKey: ["/api/shifts/current"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allVariants = [] } = useQuery<Variant[]>({
    queryKey: ["/api/variants"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const userBranchId = user?.branchId;
  const { data: branchStock = [] } = useQuery<any[]>({
    queryKey: [`/api/branch-stock/${userBranchId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!userBranchId,
  });

  const branchProductIds = new Set(branchStock.map((s: any) => s.product_id));
  const branchVariantIds = new Set(branchStock.map((s: any) => s.variant_id));
  const products = userBranchId
    ? allProducts.filter(p => branchProductIds.has(p.id))
    : allProducts;
  const variants = userBranchId
    ? allVariants.filter(v => branchVariantIds.has(v.id))
    : allVariants;

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.productId === item.productId && c.variantId === item.variantId);
      if (existing) {
        return prev.map(c =>
          c.productId === item.productId && c.variantId === item.variantId
            ? { ...c, qty: c.qty + 1 }
            : c
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    const variant = variants.find(v => v.barcode === barcode);
    if (variant) {
      const product = products.find(p => p.id === variant.productId);
      addToCart({
        productId: variant.productId,
        variantId: variant.id,
        name: product?.name || "",
        barcode: variant.barcode,
        price: parseFloat(variant.price),
        qty: 1,
        color: variant.color,
        size: variant.size,
      });
      toast({ title: t("mobile.product_added"), description: product?.name });
      return;
    }
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCart({
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        price: parseFloat(product.price),
        qty: 1,
      });
      toast({ title: t("mobile.product_added"), description: product.name });
      return;
    }
    toast({ title: t("mobile.product_not_found"), variant: "destructive" });
  }, [variants, products, addToCart, toast, t]);

  const updateQty = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const newQty = item.qty + delta;
      return newQty > 0 ? { ...item, qty: newQty } : item;
    }));
  };

  const removeItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const vatRate = 0.05;
  const vat = subtotal * vatRate;
  const total = subtotal + vat;

  const saleMutation = useMutation({
    mutationFn: async () => {
      const body = {
        branchId: user?.branchId,
        cashierId: user?.id,
        subtotal: subtotal.toFixed(3),
        discount: "0",
        discountType: "fixed",
        vat: vat.toFixed(3),
        total: total.toFixed(3),
        paymentMethod,
        bankTxnId: paymentMethod !== "cash" ? bankTxnId : undefined,
        items: cart.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.qty,
          unitPrice: item.price.toFixed(3),
          total: (item.price * item.qty).toFixed(3),
        })),
      };
      const res = await apiRequest("POST", "/api/sales", body);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: t("mobile.sale_success"), description: `${t("mobile.invoice")} #${data.invoiceNumber}` });
      setCart([]);
      setBankTxnId("");
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/employee/home"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mobile/my-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      if (user?.branchId) {
        queryClient.invalidateQueries({ queryKey: [`/api/branch-stock/${user.branchId}`] });
      }
    },
    onError: (err: Error) => {
      toast({ title: t("mobile.sale_error"), description: err.message, variant: "destructive" });
    },
  });

  const filteredProducts = searchQuery.length >= 2
    ? products.filter(p => p.active && p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  if (!currentShift || currentShift.status !== "open") {
    return (
      <div className="p-4 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-4" dir="rtl">
        <AlertTriangle className="w-16 h-16 text-orange-500" />
        <h2 className="text-xl font-bold text-center">{t("mobile.shift_required")}</h2>
        <p className="text-muted-foreground text-center">{t("mobile.shift_required_desc")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-3" dir="rtl">
      <div className="flex items-center gap-2">
        <BarcodeScanButton onScan={handleBarcodeScan} size="default" className="h-12 w-14 shrink-0" />
        <Button variant="outline" className="h-12 flex-1 gap-2 justify-start text-muted-foreground" onClick={() => setSearchOpen(true)} data-testid="button-search-products">
          <Search className="w-4 h-4" />
          {t("mobile.search_product")}
        </Button>
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Camera className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">{t("mobile.scan_to_start")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cart.map((item, idx) => (
            <Card key={idx}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" data-testid={`text-cart-item-${idx}`}>{item.name}</p>
                    {(item.color || item.size) && (
                      <p className="text-xs text-muted-foreground">{[item.color, item.size].filter(Boolean).join(" / ")}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => removeItem(idx)} data-testid={`button-remove-item-${idx}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(idx, -1)} data-testid={`button-qty-minus-${idx}`}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center font-bold" data-testid={`text-qty-${idx}`}>{item.qty}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(idx, 1)} data-testid={`button-qty-plus-${idx}`}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="font-bold text-primary">{(item.price * item.qty).toFixed(3)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <Card className="border-2 border-primary">
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span>{t("mobile.subtotal")}</span>
              <span>{subtotal.toFixed(3)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t("mobile.vat")} (5%)</span>
              <span>{vat.toFixed(3)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>{t("mobile.total")}</span>
              <span data-testid="text-total">{total.toFixed(3)}</span>
            </div>

            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger data-testid="select-payment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t("mobile.cash")}</SelectItem>
                <SelectItem value="card">{t("mobile.card")}</SelectItem>
                <SelectItem value="bank_transfer">{t("mobile.bank_transfer")}</SelectItem>
              </SelectContent>
            </Select>

            {paymentMethod !== "cash" && (
              <Input
                placeholder={t("mobile.txn_reference")}
                value={bankTxnId}
                onChange={e => setBankTxnId(e.target.value)}
                data-testid="input-txn-ref"
              />
            )}

            <Button
              className="w-full h-14 text-lg gap-2"
              onClick={() => saleMutation.mutate()}
              disabled={saleMutation.isPending}
              data-testid="button-complete-sale"
            >
              {saleMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
              {t("mobile.complete_sale")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("mobile.search_product")}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder={t("mobile.search_placeholder")}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            data-testid="input-search-product"
          />
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {filteredProducts.map(p => (
              <Button
                key={p.id}
                variant="ghost"
                className="w-full justify-between h-auto py-3"
                onClick={() => {
                  addToCart({ productId: p.id, name: p.name, barcode: p.barcode, price: parseFloat(p.price), qty: 1 });
                  setSearchOpen(false);
                  setSearchQuery("");
                  toast({ title: t("mobile.product_added"), description: p.name });
                }}
                data-testid={`button-product-${p.id}`}
              >
                <span className="text-right">{p.name}</span>
                <span className="text-primary font-bold">{parseFloat(p.price).toFixed(3)}</span>
              </Button>
            ))}
            {searchQuery.length >= 2 && filteredProducts.length === 0 && (
              <p className="text-center text-muted-foreground py-4">{t("mobile.no_results")}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
