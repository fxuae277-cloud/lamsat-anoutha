import { useState } from "react";
import { Plus, Search, Package, Palette, Ruler, Barcode, Edit2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Product, Category, ProductVariant } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";

export default function Products() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [manageVariantsOpen, setManageVariantsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);

  const [newProduct, setNewProduct] = useState({ name: "", categoryId: "", price: "", active: true });
  const [variantForm, setVariantForm] = useState({ productName: "", productCategoryId: "", productActive: true, barcode: "", sku: "", color: "", size: "", price: "", cost: "" });
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const { user } = useAuth();
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: variants = [] } = useQuery<ProductVariant[]>({ 
    queryKey: [`/api/products/${selectedProduct?.id}/variants`], 
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedProduct 
  });

  const filteredProducts = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || p.categoryId === parseInt(filterCat);
    return matchSearch && matchCat;
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      toast({ title: t("products.added_success") });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setAddOpen(false);
      setNewProduct({ name: "", categoryId: "", price: "", active: true });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => {
      toast({ title: t("products.deleted") });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    }
  });

  const toggleProductActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => apiRequest("PATCH", `/api/products/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/products"] })
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => apiRequest("POST", "/api/categories", { name }),
    onSuccess: async (newCat: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setVariantForm(f => ({ ...f, productCategoryId: newCat.id.toString() }));
      setNewCategoryName("");
      setShowAddCategory(false);
      toast({ title: t("products.category_added") });
    },
    onError: (err: Error) => toast({ title: t("common.error"), description: err.message, variant: "destructive" })
  });

  const openManageVariants = (product: Product) => {
    setSelectedProduct(product);
    setManageVariantsOpen(true);
  };

  const openVariantDialog = (variant?: ProductVariant) => {
    const base = {
      productName: selectedProduct?.name || "",
      productCategoryId: selectedProduct?.categoryId?.toString() || "",
      productActive: selectedProduct?.active ?? true,
    };
    if (variant) {
      setEditingVariant(variant);
      setVariantForm({ 
        ...base,
        barcode: variant.barcode || "", sku: variant.sku || "", color: variant.color || "", 
        size: variant.size || "", price: variant.price.toString(), cost: variant.costDefault?.toString() || "" 
      });
    } else {
      setEditingVariant(null);
      setVariantForm({ ...base, barcode: "", sku: "", color: "", size: "", price: selectedProduct?.price.toString() || "", cost: "" });
    }
    setVariantDialogOpen(true);
  };

  const upsertVariantMutation = useMutation({
    mutationFn: async (data: any) => {
      const { productName, productActive, productCategoryId, ...rest } = data;
      const payload = { ...rest, costDefault: rest.cost || null };
      delete payload.cost;

      const newCatId = productCategoryId ? parseInt(productCategoryId) : null;
      const productChanged =
        (productName && selectedProduct && productName !== selectedProduct.name) ||
        (selectedProduct && productActive !== selectedProduct.active) ||
        (selectedProduct && newCatId !== (selectedProduct.categoryId ?? null));
      if (productChanged && selectedProduct) {
        await apiRequest("PATCH", `/api/products/${selectedProduct.id}`, {
          name: productName,
          active: productActive,
          categoryId: newCatId,
        });
      }

      if (editingVariant) {
        return apiRequest("PATCH", `/api/variants/${editingVariant.id}`, payload);
      }
      return apiRequest("POST", `/api/products/${selectedProduct?.id}/variants`, payload);
    },
    onSuccess: () => {
      toast({ title: t("products.variant_saved") });
      queryClient.invalidateQueries({ queryKey: [`/api/products/${selectedProduct?.id}/variants`] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setVariantDialogOpen(false);
    },
    onError: (err: Error) => {
      if (err.message.includes("barcode")) toast({ title: t("products.barcode_duplicate"), variant: "destructive" });
      else toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/variants/${id}`),
    onSuccess: () => {
      toast({ title: t("products.variant_deleted") });
      queryClient.invalidateQueries({ queryKey: [`/api/products/${selectedProduct?.id}/variants`] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-products-title">{t("products.title")}</h1>
          <p className="text-muted-foreground">{t("products.subtitle")}</p>
        </div>
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-product" className="gap-2">
          <Plus className="w-4 h-4" /> {t("products.add_product")}
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-card p-4 border rounded-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t("products.search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder={t("products.category")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("products.all_categories")}</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("products.table_name")}</TableHead>
              <TableHead>{t("products.table_category")}</TableHead>
              <TableHead>{t("products.default_price")}</TableHead>
              <TableHead>{t("products.variants")}</TableHead>
              <TableHead>{t("products.table_status")}</TableHead>
              <TableHead className="text-right">{t("products.table_actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{categories.find(c => c.id === p.categoryId)?.name || "-"}</TableCell>
                <TableCell>{parseFloat(p.price).toFixed(3)}</TableCell>
                <TableCell><Badge variant="outline">{(p as any).variantsCount || 0}</Badge></TableCell>
                <TableCell>
                  <Badge 
                    variant={p.active ? "default" : "secondary"} className="cursor-pointer"
                    onClick={() => toggleProductActiveMutation.mutate({ id: p.id, active: !p.active })}
                  >
                    {p.active ? t("products.active") : t("products.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openManageVariants(p)} data-testid={`button-manage-variants-${p.id}`}>{t("products.manage_variants")}</Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteProductMutation.mutate(p.id)} data-testid={`button-delete-product-${p.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("products.add_product")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.product_name")}</label>
              <Input value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} data-testid="input-name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.category")}</label>
              <Select value={newProduct.categoryId} onValueChange={v => setNewProduct({...newProduct, categoryId: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.price_omr")}</label>
              <Input type="number" step="0.001" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} data-testid="input-price" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createProductMutation.mutate({...newProduct, categoryId: parseInt(newProduct.categoryId)})} data-testid="button-save-product">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageVariantsOpen} onOpenChange={setManageVariantsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("products.variants")} - {selectedProduct?.name}</DialogTitle>
            <DialogDescription>{t("products.manage_variants")}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mb-4">
            <Button onClick={() => openVariantDialog()} size="sm" className="gap-2" data-testid="button-add-variant"><Plus className="w-4 h-4" /> {t("products.add_variant")}</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("products.variant_barcode")}</TableHead>
                <TableHead>{t("products.variant_sku")}</TableHead>
                <TableHead>{t("products.variant_color")}</TableHead>
                <TableHead>{t("products.variant_size")}</TableHead>
                <TableHead>{t("products.variant_price")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-4">{t("products.no_variants")}</TableCell></TableRow>
              ) : variants.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono">{v.barcode || "-"}</TableCell>
                  <TableCell>{v.sku || "-"}</TableCell>
                  <TableCell>{v.color || "-"}</TableCell>
                  <TableCell>{v.size || "-"}</TableCell>
                  <TableCell>{parseFloat(v.price.toString()).toFixed(3)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openVariantDialog(v)} data-testid={`button-edit-variant-${v.id}`}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteVariantMutation.mutate(v.id)} data-testid={`button-delete-variant-${v.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Dialog open={variantDialogOpen} onOpenChange={v => { setVariantDialogOpen(v); if (!v) { setShowAddCategory(false); setNewCategoryName(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingVariant ? t("products.edit_variant") : t("products.add_variant")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {selectedProduct && (
              <>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-medium">{t("products.product_name")}</label>
                  <Input
                    value={variantForm.productName}
                    onChange={e => setVariantForm({...variantForm, productName: e.target.value})}
                    className="font-semibold"
                    data-testid="input-variant-product-name"
                  />
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium cursor-pointer" htmlFor="product-active-switch">
                      {t("products.product_status")}
                    </label>
                    <p className={`text-xs font-medium ${variantForm.productActive ? "text-green-600" : "text-muted-foreground"}`}>
                      {variantForm.productActive ? t("products.active") : t("products.inactive")}
                    </p>
                  </div>
                  <Switch
                    id="product-active-switch"
                    checked={variantForm.productActive}
                    onCheckedChange={val => setVariantForm({...variantForm, productActive: val})}
                    data-testid="switch-product-active"
                  />
                </div>
              </>
            )}
            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t("products.category")}</label>
                {!showAddCategory && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-primary"
                    onClick={() => setShowAddCategory(true)}
                    data-testid="button-show-add-category"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {t("products.add_category")}
                  </Button>
                )}
              </div>
              {showAddCategory ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder={t("products.category_name_placeholder")}
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newCategoryName.trim()) createCategoryMutation.mutate(newCategoryName.trim()); if (e.key === "Escape") { setShowAddCategory(false); setNewCategoryName(""); } }}
                    className="flex-1"
                    data-testid="input-new-category-name"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                    onClick={() => createCategoryMutation.mutate(newCategoryName.trim())}
                    data-testid="button-save-category"
                  >
                    {t("common.save")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowAddCategory(false); setNewCategoryName(""); }}
                    data-testid="button-cancel-add-category"
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : (
                <Select value={variantForm.productCategoryId} onValueChange={val => setVariantForm({...variantForm, productCategoryId: val})}>
                  <SelectTrigger data-testid="select-variant-category">
                    <SelectValue placeholder={t("products.all_categories")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium">{t("products.variant_barcode")}</label>
              <div className="flex gap-2">
                <Input value={variantForm.barcode} onChange={e => setVariantForm({...variantForm, barcode: e.target.value})} data-testid="input-variant-barcode" />
                <BarcodeScanButton onScan={code => setVariantForm({...variantForm, barcode: code})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.variant_sku")}</label>
              <Input value={variantForm.sku} onChange={e => setVariantForm({...variantForm, sku: e.target.value})} data-testid="input-variant-sku" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.variant_color")}</label>
              <Input value={variantForm.color} onChange={e => setVariantForm({...variantForm, color: e.target.value})} data-testid="input-variant-color" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.variant_size")}</label>
              <Input value={variantForm.size} onChange={e => setVariantForm({...variantForm, size: e.target.value})} data-testid="input-variant-size" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.variant_price")}</label>
              <Input 
                type="number" 
                step="0.001" 
                value={variantForm.price} 
                onChange={e => setVariantForm({...variantForm, price: e.target.value})} 
                data-testid="input-variant-price" 
                readOnly={!isOwnerOrAdmin}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.variant_cost")}</label>
              <Input 
                type="number" 
                step="0.001" 
                value={variantForm.cost} 
                onChange={e => setVariantForm({...variantForm, cost: e.target.value})} 
                data-testid="input-variant-cost" 
                readOnly
              />
            </div>
            {editingVariant && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("products.last_purchase_price")}</label>
                  <Input 
                    type="number" 
                    step="0.001" 
                    value={editingVariant.lastPurchasePrice?.toString() || "0"} 
                    readOnly 
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("products.avg_cost")}</label>
                  <Input 
                    type="number" 
                    step="0.001" 
                    value={selectedProduct?.avgCost?.toString() || "0"} 
                    readOnly 
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("products.profit_margin")}</label>
                  <div className="h-10 px-3 py-2 rounded-md border bg-muted text-sm flex items-center">
                    {(() => {
                      const price = parseFloat(variantForm.price);
                      const avgCost = parseFloat(selectedProduct?.avgCost?.toString() || "0");
                      if (avgCost > 0) {
                        const margin = ((price - avgCost) / avgCost) * 100;
                        return `${margin.toFixed(1)}%`;
                      }
                      return "-";
                    })()}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("products.final_price")}</label>
                  <Input 
                    type="number" 
                    step="0.001" 
                    value={variantForm.price} 
                    readOnly 
                    className="bg-muted"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => upsertVariantMutation.mutate(variantForm)} disabled={upsertVariantMutation.isPending} data-testid="button-save-variant">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
