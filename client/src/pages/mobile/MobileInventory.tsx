import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Boxes, Search, Loader2, Package, Barcode, Palette, Ruler, AlertTriangle, ArrowRightLeft, Clock } from "lucide-react";

type Location = { id: number; name: string; branchId: number | null; branchName: string; isCentral: boolean };
type Balance = {
  id: number; locationId: number; variantId: number; qtyOnHand: number; qtyReserved: number;
  productName: string; barcode: string; color: string; size: string; price: string; sku: string;
  locationName: string;
};
type Transfer = {
  id: number; fromLocationName: string; toLocationName: string; status: string;
  createdAt: string; lineCount: number; notes: string;
};

export default function MobileInventory() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"balances" | "transfers">("balances");
  const [locationId, setLocationId] = useState("all");
  const [search, setSearch] = useState("");

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"], queryFn: getQueryFn({ on401: "throw" }),
  });

  const balanceUrl = locationId !== "all" ? `/api/inventory-balances?locationId=${locationId}` : "/api/inventory-balances";
  const { data: balances = [], isLoading: loadingBal } = useQuery<Balance[]>({
    queryKey: [balanceUrl], queryFn: getQueryFn({ on401: "throw" }), enabled: tab === "balances",
  });

  const { data: transfers = [], isLoading: loadingTx } = useQuery<Transfer[]>({
    queryKey: ["/api/stock-transfers"], queryFn: getQueryFn({ on401: "throw" }), enabled: tab === "transfers",
  });

  const filteredBal = search
    ? balances.filter(b => b.productName?.toLowerCase().includes(search.toLowerCase()) || b.barcode?.includes(search))
    : balances;

  const f3 = (n: any) => parseFloat(String(n || "0")).toFixed(3);
  const fD = (d: any) => d ? fmtDate(d) : "---";

  const locLabel = (loc: Location) => loc.isCentral ? loc.name : `${loc.branchName} - ${loc.name}`;

  return (
    <div className="p-4 pb-24 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Boxes className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">{t("mobile.inventory")}</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant={tab === "balances" ? "default" : "outline"} className="h-12 gap-1" onClick={() => setTab("balances")} data-testid="tab-balances">
          <Package className="w-4 h-4" />{t("inv_balances.tab_balances")}
        </Button>
        <Button variant={tab === "transfers" ? "default" : "outline"} className="h-12 gap-1" onClick={() => setTab("transfers")} data-testid="tab-transfers">
          <ArrowRightLeft className="w-4 h-4" />{t("inv_balances.tab_transfers")}
        </Button>
      </div>

      {tab === "balances" && (
        <>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="h-12" data-testid="select-location"><SelectValue placeholder={t("mobile.select_location")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("customers.filter_all")}</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={String(l.id)}>{locLabel(l)}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={t("mobile.search_product")} value={search} onChange={e => setSearch(e.target.value)}
              className="pe-10 h-12 text-base" data-testid="input-search-inventory" />
          </div>

          {loadingBal ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredBal.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">{t("mobile.no_results")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBal.map(b => {
                const isLow = b.qtyOnHand < 5;
                const isOut = b.qtyOnHand <= 0;
                return (
                  <Card key={b.id} className={`${isOut ? "border-red-300 bg-red-50 dark:bg-red-950/20" : isLow ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : ""}`} data-testid={`card-balance-${b.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-base truncate">{b.productName}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {b.color && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Palette className="w-3 h-3" />{b.color}</span>}
                            {b.size && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Ruler className="w-3 h-3" />{b.size}</span>}
                          </div>
                        </div>
                        <div className="text-end shrink-0">
                          <p className={`text-2xl font-bold ${isOut ? "text-red-600" : isLow ? "text-orange-600" : "text-primary"}`}>{b.qtyOnHand}</p>
                          {isLow && !isOut && <div className="flex items-center gap-1 text-orange-600"><AlertTriangle className="w-3 h-3" /><span className="text-[10px]">{t("mobile.low_stock")}</span></div>}
                          {isOut && <div className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-3 h-3" /><span className="text-[10px]">{t("mobile.out_of_stock")}</span></div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Barcode className="w-3 h-3" /><span className="font-mono">{b.barcode || "---"}</span></span>
                        {b.sku && <span>SKU: {b.sku}</span>}
                        <span>{t("products.variant_price")}: <strong>{f3(b.price)}</strong></span>
                        {locationId === "all" && <Badge variant="outline" className="text-[10px]">{b.locationName}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "transfers" && (
        <>
          {loadingTx ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-16">
              <ArrowRightLeft className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">{t("mobile.no_transfers")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transfers.map((tx: any) => (
                <Card key={tx.id} data-testid={`card-transfer-${tx.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={tx.status === "approved" ? "default" : tx.status === "cancelled" ? "destructive" : "secondary"} className="text-xs">
                        {tx.status === "approved" ? t("mobile.completed") : tx.status === "cancelled" ? t("customers.inactive") : t("mobile.draft")}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{fD(tx.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{tx.fromLocationName}</span>
                      <ArrowRightLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{tx.toLocationName}</span>
                    </div>
                    {tx.notes && <p className="text-xs text-muted-foreground mt-1">{tx.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
