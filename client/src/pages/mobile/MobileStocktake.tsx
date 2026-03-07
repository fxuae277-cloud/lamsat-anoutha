import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";
import { ClipboardCheck, Camera, Loader2, CheckCircle, Save } from "lucide-react";

type StocktakeItem = {
  variantId: number;
  productId: number;
  name: string;
  barcode: string;
  systemQty: number;
  actualQty: number;
  color?: string;
  size?: string;
};

export default function MobileStocktake() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const [locationId, setLocationId] = useState("");
  const [items, setItems] = useState<StocktakeItem[]>([]);
  const [started, setStarted] = useState(false);

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: variants = [] } = useQuery<any[]>({
    queryKey: ["/api/variants"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: balances = [] } = useQuery<any[]>({
    queryKey: [`/api/inventory-balances?locationId=${locationId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!locationId,
  });

  const handleBarcode = useCallback((barcode: string) => {
    const variant = variants.find((v: any) => v.barcode === barcode);
    if (!variant) {
      toast({ title: t("mobile.product_not_found"), variant: "destructive" });
      return;
    }
    const product = products.find((p: any) => p.id === variant.productId);
    const existing = items.find(i => i.variantId === variant.id);
    if (existing) {
      setItems(prev => prev.map(i => i.variantId === variant.id ? { ...i, actualQty: i.actualQty + 1 } : i));
      toast({ title: t("mobile.qty_updated") });
      return;
    }
    const balance = balances.find((b: any) => b.variantId === variant.id);
    setItems(prev => [...prev, {
      variantId: variant.id, productId: variant.productId,
      name: product?.name || "", barcode,
      systemQty: balance?.qtyOnHand || 0, actualQty: 1,
      color: variant.color, size: variant.size,
    }]);
    toast({ title: t("mobile.product_added") });
  }, [variants, products, balances, items, toast, t]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stocktakes", {
        branchId: user?.branchId || 1,
        locationId: Number(locationId),
        notes: "",
      });
      const stocktake = await res.json();
      for (const item of items) {
        await apiRequest("POST", `/api/stocktakes/${stocktake.id}/items`, {
          productId: item.productId,
          variantId: item.variantId,
          systemQty: item.systemQty,
          countedQty: item.actualQty,
          difference: item.actualQty - item.systemQty,
        });
      }
      return stocktake;
    },
    onSuccess: () => {
      toast({ title: t("mobile.stocktake_saved") });
      setItems([]); setStarted(false);
      queryClient.invalidateQueries({ queryKey: ["/api/stocktakes"] });
    },
    onError: (err: Error) => {
      toast({ title: t("mobile.error"), description: err.message, variant: "destructive" });
    },
  });

  const locLabel = (loc: any) => {
    if (loc.isCentral) return loc.name;
    return loc.branchName ? `${loc.branchName} - ${loc.name}` : loc.name;
  };

  if (!started) {
    return (
      <div className="p-4 pb-24 space-y-4" dir="rtl">
        <div className="text-center pt-8 pb-4">
          <ClipboardCheck className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold">{t("mobile.new_stocktake")}</h2>
        </div>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>{t("mobile.select_location")}</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger data-testid="select-stocktake-location"><SelectValue placeholder={t("mobile.select_location")} /></SelectTrigger>
                <SelectContent>
                  {locations.map((loc: any) => <SelectItem key={loc.id} value={String(loc.id)}>{locLabel(loc)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full h-14 text-lg" disabled={!locationId} onClick={() => setStarted(true)} data-testid="button-start-stocktake">
              <ClipboardCheck className="w-5 h-5 ml-2" />
              {t("mobile.start_stocktake")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-3" dir="rtl">
      <div className="flex items-center gap-2">
        <BarcodeScanButton onScan={handleBarcode} size="default" className="h-12 w-14 shrink-0" />
        <p className="text-sm text-muted-foreground flex-1">{t("mobile.scan_to_count")}</p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Camera className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>{t("mobile.scan_products_to_count")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => {
            const diff = item.actualQty - item.systemQty;
            return (
              <Card key={idx} className={diff !== 0 ? "border-orange-300" : ""}>
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{item.name}</p>
                  {(item.color || item.size) && <p className="text-xs text-muted-foreground">{[item.color, item.size].filter(Boolean).join(" / ")}</p>}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="text-center bg-muted/50 p-2 rounded">
                      <p className="text-xs text-muted-foreground">{t("mobile.system_qty")}</p>
                      <p className="font-bold">{item.systemQty}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">{t("mobile.actual_qty")}</p>
                      <Input type="number" value={item.actualQty} onChange={e => {
                        const v = parseInt(e.target.value) || 0;
                        setItems(prev => prev.map((it, i) => i === idx ? { ...it, actualQty: v } : it));
                      }} className="h-8 text-center" />
                    </div>
                    <div className={`text-center p-2 rounded ${diff > 0 ? "bg-emerald-50" : diff < 0 ? "bg-red-50" : "bg-muted/50"}`}>
                      <p className="text-xs text-muted-foreground">{t("mobile.difference")}</p>
                      <p className={`font-bold ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : ""}`}>{diff > 0 ? "+" : ""}{diff}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <Button className="w-full h-12 gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-stocktake">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t("mobile.save_stocktake")}
        </Button>
      )}
    </div>
  );
}
