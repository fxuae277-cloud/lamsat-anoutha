import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";
import { ShoppingCart, Plus, Trash2, Save, CheckCircle, Loader2, Search, Camera } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PurchaseItem = {
  productId: number;
  variantId?: number;
  name: string;
  barcode: string;
  qty: number;
  unitCost: number;
  color?: string;
  size?: string;
};

export default function MobilePurchases() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: variants = [] } = useQuery<any[]>({
    queryKey: ["/api/variants"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const handleBarcode = useCallback((barcode: string) => {
    const variant = variants.find((v: any) => v.barcode === barcode);
    if (variant) {
      const product = products.find((p: any) => p.id === variant.productId);
      setItems(prev => [...prev, {
        productId: variant.productId, variantId: variant.id,
        name: product?.name || "", barcode, qty: 1,
        unitCost: parseFloat(variant.price || "0"),
        color: variant.color, size: variant.size,
      }]);
      toast({ title: t("mobile.product_added") });
      return;
    }
    const product = products.find((p: any) => p.barcode === barcode);
    if (product) {
      setItems(prev => [...prev, {
        productId: product.id, name: product.name, barcode,
        qty: 1, unitCost: parseFloat(product.price || "0"),
      }]);
      toast({ title: t("mobile.product_added") });
      return;
    }
    toast({ title: t("mobile.product_not_found"), variant: "destructive" });
  }, [variants, products, toast, t]);

  const saveMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("POST", "/api/purchases", {
        supplierId: Number(supplierId) || null,
        invoiceNumber: invoiceNumber || undefined,
        notes: notes || undefined,
        status: "pending",
      });
      const purchase = await res.json();

      for (const item of items) {
        await apiRequest("POST", `/api/purchases/${purchase.id}/items`, {
          productId: item.productId,
          variantId: item.variantId,
          productName: item.name,
          quantity: item.qty,
          unitCost: item.unitCost.toFixed(3),
          total: (item.qty * item.unitCost).toFixed(3),
          color: item.color,
          size: item.size,
        });
      }

      if (status === "approved") {
        await apiRequest("POST", `/api/purchase-invoices/${purchase.id}/approve`);
      }

      return purchase;
    },
    onSuccess: () => {
      toast({ title: t("mobile.purchase_saved") });
      setItems([]);
      setInvoiceNumber("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
    },
    onError: (err: Error) => {
      toast({ title: t("mobile.error"), description: err.message, variant: "destructive" });
    },
  });

  const total = items.reduce((sum, i) => sum + i.qty * i.unitCost, 0);
  const filteredProducts = searchQuery.length >= 2
    ? products.filter((p: any) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="p-4 pb-24 space-y-4" dir="rtl">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <ShoppingCart className="w-5 h-5" />
        {t("mobile.new_purchase")}
      </h2>

      <div className="grid grid-cols-1 gap-3">
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger data-testid="select-supplier">
            <SelectValue placeholder={t("mobile.select_supplier")} />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s: any) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder={t("mobile.invoice_number")} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} data-testid="input-invoice-number" />
      </div>

      <div className="flex items-center gap-2">
        <BarcodeScanButton onScan={handleBarcode} size="default" className="h-12 w-14 shrink-0" />
        <Button variant="outline" className="h-12 flex-1 gap-2 justify-start text-muted-foreground" onClick={() => setSearchOpen(true)} data-testid="button-search-purchase">
          <Search className="w-4 h-4" />
          {t("mobile.search_product")}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Camera className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>{t("mobile.scan_to_add")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <Card key={idx}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    {(item.color || item.size) && <p className="text-xs text-muted-foreground">{[item.color, item.size].filter(Boolean).join(" / ")}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">{t("mobile.qty")}</Label>
                    <Input type="number" value={item.qty} onChange={e => {
                      const v = parseInt(e.target.value) || 1;
                      setItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: v } : it));
                    }} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">{t("mobile.unit_cost")}</Label>
                    <Input type="number" step="0.001" value={item.unitCost} onChange={e => {
                      const v = parseFloat(e.target.value) || 0;
                      setItems(prev => prev.map((it, i) => i === idx ? { ...it, unitCost: v } : it));
                    }} className="h-9" />
                  </div>
                  <div className="text-left pt-5">
                    <p className="font-bold text-primary text-sm">{(item.qty * item.unitCost).toFixed(3)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <Card className="border-2 border-primary">
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between text-lg font-bold">
              <span>{t("mobile.total")}</span>
              <span>{total.toFixed(3)}</span>
            </div>
            <Input placeholder={t("mobile.notes")} value={notes} onChange={e => setNotes(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12 gap-2" onClick={() => saveMutation.mutate("draft")} disabled={saveMutation.isPending} data-testid="button-save-draft">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t("mobile.save_draft")}
              </Button>
              <Button className="h-12 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => saveMutation.mutate("approved")} disabled={saveMutation.isPending} data-testid="button-approve-purchase">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {t("mobile.approve")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("mobile.search_product")}</DialogTitle></DialogHeader>
          <Input autoFocus placeholder={t("mobile.search_placeholder")} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {filteredProducts.map((p: any) => (
              <Button key={p.id} variant="ghost" className="w-full justify-between h-auto py-3" onClick={() => {
                setItems(prev => [...prev, { productId: p.id, name: p.name, barcode: p.barcode, qty: 1, unitCost: parseFloat(p.price || "0") }]);
                setSearchOpen(false); setSearchQuery("");
              }}><span>{p.name}</span><span className="text-primary font-bold">{parseFloat(p.price).toFixed(3)}</span></Button>
            ))}
            {searchQuery.length >= 2 && filteredProducts.length === 0 && <p className="text-center text-muted-foreground py-4">{t("mobile.no_results")}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
