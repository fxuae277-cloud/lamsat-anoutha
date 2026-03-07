import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tag, Search, Loader2, Package, Barcode, Palette, Ruler, ChevronDown, ChevronUp } from "lucide-react";

type Product = {
  id: number; name: string; category: string; price: string;
  active: boolean; variants?: Variant[];
};
type Variant = {
  id: number; productId: number; sku: string; barcode: string;
  color: string; size: string; costDefault: string; price: string; active: boolean;
};

export default function MobileProducts() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"], queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: variants = [] } = useQuery<Variant[]>({
    queryKey: [`/api/products/${expandedId}/variants`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!expandedId,
  });

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== "all" && p.category !== catFilter) return false;
    return true;
  });

  const f3 = (n: any) => parseFloat(String(n || "0")).toFixed(3);

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 pb-24 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Tag className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">{t("mobile.products")}</h2>
        <Badge variant="secondary">{products.length}</Badge>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t("mobile.search_product")} value={search} onChange={e => setSearch(e.target.value)}
            className="pr-10 h-12 text-base" data-testid="input-search-product" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-32 h-12" data-testid="select-category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("customers.filter_all")}</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{t("mobile.no_results")}</p>
          </div>
        ) : (
          filtered.map(p => {
            const isExpanded = expandedId === p.id;
            return (
              <div key={p.id}>
                <Card className="active:scale-[0.98] transition-transform" data-testid={`card-product-${p.id}`}>
                  <CardContent className="p-4" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-base truncate">{p.name}</span>
                          {!p.active && <Badge variant="secondary" className="text-[10px] shrink-0">{t("customers.inactive")}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{p.category || "---"}</Badge>
                          <span>{t("products.variant_price")}: <strong className="text-foreground">{f3(p.price)}</strong></span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {isExpanded && (
                  <div className="mr-3 border-r-2 border-primary/20 pr-3 mt-1 space-y-2">
                    {variants.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-3 text-center">{t("products.no_variants") || "لا توجد متغيرات"}</p>
                    ) : (
                      variants.map(v => (
                        <Card key={v.id} className="bg-muted/30" data-testid={`card-variant-${v.id}`}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {v.color && <span className="flex items-center gap-1 text-xs"><Palette className="w-3 h-3" />{v.color}</span>}
                                {v.size && <span className="flex items-center gap-1 text-xs"><Ruler className="w-3 h-3" />{v.size}</span>}
                              </div>
                              <span className="font-bold text-primary">{f3(v.price)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Barcode className="w-3 h-3" /><span className="font-mono">{v.barcode || "---"}</span></span>
                              {v.sku && <span>SKU: {v.sku}</span>}
                              <span className="mr-auto">{t("products.variant_cost")}: {f3(v.costDefault)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
