import { useState } from "react";
import { Plus, Search, Package, Edit2, Trash2, Eye, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Category, ProductVariant } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";

export default function Products() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  // ── filters ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // ── product form (add / edit) ─────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [formProduct, setFormProduct] = useState<any>(null); // null = add
  const [formTab, setFormTab] = useState("basic");
  const [formData, setFormData] = useState({
    name: "", categoryId: "", price: "", barcode: "", productType: "simple", active: true,
  });

  // ── detail modal ──────────────────────────────────────────────────────
  const [detailProductId, setDetailProductId] = useState<number | null>(null);

  // ── variant sub-dialog ────────────────────────────────────────────────
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantForm, setVariantForm] = useState({
    barcode: "", sku: "", color: "", size: "", price: "", cost: "",
  });

  // ── inline category add ───────────────────────────────────────────────
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // ── queries ───────────────────────────────────────────────────────────
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products", search, filterCat, filterType],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (search.trim()) p.set("q", search.trim());
      if (filterCat !== "all") p.set("categoryId", filterCat);
      if (filterType !== "all") p.set("productType", filterType);
      const res = await fetch(`/api/products${p.toString() ? "?" + p.toString() : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // loaded when editing — gives avgCost, variants, locationInventory, lastSupplier
  const { data: editProductDetail } = useQuery<any>({
    queryKey: [`/api/products/${formProduct?.id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!formProduct,
  });

  // loaded for detail modal
  const { data: detailProduct } = useQuery<any>({
    queryKey: [`/api/products/${detailProductId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!detailProductId,
  });

  // ── mutations ─────────────────────────────────────────────────────────
  const createProductMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/products", data)).json(),
    onSuccess: () => {
      toast({ title: t("products.added_success") });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setFormOpen(false);
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => (await apiRequest("PATCH", `/api/products/${id}`, data)).json(),
    onSuccess: () => {
      toast({ title: t("common.saved") });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: [`/api/products/${formProduct?.id}`] });
      setFormOpen(false);
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => {
      toast({ title: t("products.deleted") });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiRequest("PATCH", `/api/products/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/products"] }),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/categories", { name }),
    onSuccess: async (res: any) => {
      const cat = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setFormData(f => ({ ...f, categoryId: cat.id.toString() }));
      setNewCategoryName("");
      setShowAddCategory(false);
      toast({ title: t("products.category_added") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const upsertVariantMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { barcode: data.barcode || null, sku: data.sku || null, color: data.color || null, size: data.size || null, price: parseFloat(data.price) || 0, costDefault: data.cost ? parseFloat(data.cost) : null };
      if (editingVariant) return apiRequest("PATCH", `/api/variants/${editingVariant.id}`, payload);
      return apiRequest("POST", `/api/products/${formProduct?.id}/variants`, payload);
    },
    onSuccess: () => {
      toast({ title: t("products.variant_saved") });
      queryClient.invalidateQueries({ queryKey: [`/api/products/${formProduct?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setVariantDialogOpen(false);
    },
    onError: (e: Error) => {
      if (e.message.includes("barcode")) toast({ title: t("products.barcode_duplicate"), variant: "destructive" });
      else toast({ title: t("common.error"), description: e.message, variant: "destructive" });
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/variants/${id}`),
    onSuccess: () => {
      toast({ title: t("products.variant_deleted") });
      queryClient.invalidateQueries({ queryKey: [`/api/products/${formProduct?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  // ── helpers ───────────────────────────────────────────────────────────
  function openAdd() {
    setFormProduct(null);
    setFormData({ name: "", categoryId: "", price: "", barcode: "", productType: "simple", active: true });
    setFormTab("basic");
    setShowAddCategory(false);
    setNewCategoryName("");
    setFormOpen(true);
  }

  function openEdit(p: any) {
    setFormProduct(p);
    setFormData({
      name: p.name,
      categoryId: p.categoryId?.toString() || "",
      price: p.price?.toString() || "",
      barcode: p.barcode || "",
      productType: p.productType || "simple",
      active: p.active ?? true,
    });
    setFormTab("basic");
    setShowAddCategory(false);
    setNewCategoryName("");
    setFormOpen(true);
  }

  function handleSave() {
    const payload = {
      name: formData.name.trim(),
      categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
      price: parseFloat(formData.price) || 0,
      barcode: formData.barcode || null,
      productType: formData.productType,
      active: formData.active,
    };
    if (formProduct) {
      updateProductMutation.mutate({ id: formProduct.id, ...payload });
    } else {
      createProductMutation.mutate({ ...payload, variants: [] });
    }
  }

  function openVariantDialog(v?: ProductVariant) {
    if (v) {
      setEditingVariant(v);
      setVariantForm({ barcode: v.barcode || "", sku: v.sku || "", color: v.color || "", size: v.size || "", price: v.price.toString(), cost: v.costDefault?.toString() || "" });
    } else {
      setEditingVariant(null);
      setVariantForm({ barcode: "", sku: "", color: "", size: "", price: formProduct?.price?.toString() || "", cost: "" });
    }
    setVariantDialogOpen(true);
  }

  const isSaving = createProductMutation.isPending || updateProductMutation.isPending;
  const formValid = formData.name.trim().length >= 2 && (formData.price !== "" && !isNaN(parseFloat(formData.price)));

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-products-title">{t("products.title")}</h1>
          <p className="text-muted-foreground">{t("products.subtitle")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2" data-testid="button-add-product">
          <Plus className="w-4 h-4" /> {t("products.add_product")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-card p-4 border rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("products.search_placeholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("products.all_categories")}</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("products.all_types")}</SelectItem>
            <SelectItem value="simple">{t("products.type_simple")}</SelectItem>
            <SelectItem value="variable">{t("products.type_variable")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">{t("products.image")}</TableHead>
              <TableHead>{t("products.table_name")}</TableHead>
              <TableHead>{t("products.code")}</TableHead>
              <TableHead>{t("products.default_price")}</TableHead>
              <TableHead>{t("products.total_stock")}</TableHead>
              <TableHead>{t("products.table_status")}</TableHead>
              <TableHead className="text-right">{t("products.table_actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t("products.no_products")}</TableCell></TableRow>
            ) : products.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                    <Package className="w-4 h-4 text-muted-foreground" />
                  </div>
                </TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.barcode || "—"}</TableCell>
                <TableCell>{parseFloat(p.price).toFixed(3)}</TableCell>
                <TableCell><Badge variant="secondary">{p.totalStock ?? 0}</Badge></TableCell>
                <TableCell>
                  <Badge
                    variant={p.active ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => toggleActiveMutation.mutate({ id: p.id, active: !p.active })}
                  >
                    {p.active ? t("products.active") : t("products.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDetailProductId(p.id)} data-testid={`button-detail-product-${p.id}`}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`button-edit-product-${p.id}`}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteProductMutation.mutate(p.id)} data-testid={`button-delete-product-${p.id}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Add / Edit Form Dialog ─────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={open => { if (!open) { setFormOpen(false); setShowAddCategory(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formProduct ? t("products.edit_product") : t("products.add_product")}</DialogTitle>
          </DialogHeader>

          <Tabs value={formTab} onValueChange={setFormTab}>
            <TabsList className="w-full">
              <TabsTrigger value="basic" className="flex-1">{t("products.tab_basic")}</TabsTrigger>
              <TabsTrigger value="pricing" className="flex-1">{t("products.tab_pricing")}</TabsTrigger>
              {formProduct && <TabsTrigger value="variants" className="flex-1">{t("products.tab_variants")}</TabsTrigger>}
              {formProduct && <TabsTrigger value="stock" className="flex-1">{t("products.tab_stock")}</TabsTrigger>}
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("products.product_name")}</label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder={t("products.product_name_placeholder")}
                  data-testid="input-name"
                />
              </div>

              {/* Category with inline add */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{t("products.category")}</label>
                  {!showAddCategory && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary" onClick={() => setShowAddCategory(true)} data-testid="button-show-add-category">
                      <Plus className="w-3 h-3 mr-1" />{t("products.add_category")}
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
                      onKeyDown={e => {
                        if (e.key === "Enter" && newCategoryName.trim()) createCategoryMutation.mutate(newCategoryName.trim());
                        if (e.key === "Escape") { setShowAddCategory(false); setNewCategoryName(""); }
                      }}
                      className="flex-1"
                      data-testid="input-new-category-name"
                    />
                    <Button size="sm" disabled={!newCategoryName.trim() || createCategoryMutation.isPending} onClick={() => createCategoryMutation.mutate(newCategoryName.trim())} data-testid="button-save-category">{t("common.save")}</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowAddCategory(false); setNewCategoryName(""); }} data-testid="button-cancel-add-category">{t("common.cancel")}</Button>
                  </div>
                ) : (
                  <Select value={formData.categoryId} onValueChange={v => setFormData(f => ({ ...f, categoryId: v }))}>
                    <SelectTrigger><SelectValue placeholder={t("products.all_categories")} /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("products.product_type")}</label>
                <Select value={formData.productType} onValueChange={v => setFormData(f => ({ ...f, productType: v }))}>
                  <SelectTrigger data-testid="select-product-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">{t("products.type_simple")}</SelectItem>
                    <SelectItem value="variable">{t("products.type_variable")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("products.code")}</label>
                <div className="flex gap-2">
                  <Input value={formData.barcode} onChange={e => setFormData(f => ({ ...f, barcode: e.target.value }))} placeholder={t("products.optional")} data-testid="input-product-barcode" />
                  <BarcodeScanButton onScan={code => setFormData(f => ({ ...f, barcode: code }))} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <label className="text-sm font-medium">{t("products.product_status")}</label>
                  <p className={`text-xs font-medium mt-0.5 ${formData.active ? "text-green-600" : "text-muted-foreground"}`}>
                    {formData.active ? t("products.active") : t("products.inactive")}
                  </p>
                </div>
                <Switch checked={formData.active} onCheckedChange={v => setFormData(f => ({ ...f, active: v }))} />
              </div>
            </TabsContent>

            {/* Pricing Tab */}
            <TabsContent value="pricing" className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("products.price_omr")}</label>
                <Input
                  type="number" step="0.001"
                  value={formData.price}
                  onChange={e => setFormData(f => ({ ...f, price: e.target.value }))}
                  readOnly={!isOwnerOrAdmin}
                  data-testid="input-price"
                />
              </div>
              {formProduct && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("products.avg_cost")}</label>
                      <Input value={parseFloat(editProductDetail?.avgCost || formProduct?.avgCost || "0").toFixed(3)} readOnly className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("products.last_purchase_price")}</label>
                      <Input value={parseFloat(editProductDetail?.lastPurchasePrice || formProduct?.lastPurchasePrice || "0").toFixed(3)} readOnly className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("products.last_supplier")}</label>
                      <Input value={editProductDetail?.lastSupplier || "—"} readOnly className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("products.profit_margin")}</label>
                      <div className="h-10 px-3 py-2 rounded-md border bg-muted text-sm flex items-center">
                        {(() => {
                          const price = parseFloat(formData.price);
                          const avg = parseFloat(editProductDetail?.avgCost || formProduct?.avgCost || "0");
                          if (avg > 0 && price > 0) return `${(((price - avg) / avg) * 100).toFixed(1)}%`;
                          return "—";
                        })()}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Variants Tab (edit only) */}
            {formProduct && (
              <TabsContent value="variants" className="pt-4">
                <div className="flex justify-end mb-3">
                  <Button size="sm" className="gap-2" onClick={() => openVariantDialog()} data-testid="button-add-variant">
                    <Plus className="w-4 h-4" />{t("products.add_variant")}
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("products.variant_barcode")}</TableHead>
                      <TableHead>{t("products.variant_color")}</TableHead>
                      <TableHead>{t("products.variant_size")}</TableHead>
                      <TableHead>{t("products.variant_price")}</TableHead>
                      <TableHead className="text-right">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!editProductDetail?.variants || editProductDetail.variants.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("products.no_variants")}</TableCell></TableRow>
                    ) : editProductDetail.variants.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.barcode || "—"}</TableCell>
                        <TableCell>{v.color || "—"}</TableCell>
                        <TableCell>{v.size || "—"}</TableCell>
                        <TableCell>{parseFloat(v.price).toFixed(3)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openVariantDialog(v)} data-testid={`button-edit-variant-${v.id}`}><Edit2 className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteVariantMutation.mutate(v.id)} data-testid={`button-delete-variant-${v.id}`}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            )}

            {/* Stock Tab (edit only) */}
            {formProduct && (
              <TabsContent value="stock" className="pt-4">
                {!editProductDetail?.locationInventory || editProductDetail.locationInventory.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{t("products.no_inventory_data")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("products.location_name")}</TableHead>
                        <TableHead>{t("products.branch")}</TableHead>
                        <TableHead>{t("products.qty_on_hand")}</TableHead>
                        <TableHead>{t("products.reorder_level")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editProductDetail.locationInventory.map((loc: any) => (
                        <TableRow key={loc.locationId}>
                          <TableCell>{loc.locationName}</TableCell>
                          <TableCell>{loc.branchName || t("products.central")}</TableCell>
                          <TableCell>
                            <Badge variant={loc.qtyOnHand <= (loc.reorderLevel || 0) ? "destructive" : "outline"}>
                              {loc.qtyOnHand}
                            </Badge>
                          </TableCell>
                          <TableCell>{loc.reorderLevel ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            )}
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={isSaving || !formValid} data-testid="button-save-product">
              {isSaving ? t("products.saving_product") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Modal ───────────────────────────────────────────────── */}
      <Dialog open={!!detailProductId} onOpenChange={open => { if (!open) setDetailProductId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />{detailProduct?.name || "…"}
            </DialogTitle>
          </DialogHeader>
          {detailProduct && (
            <Tabs defaultValue="info">
              <TabsList>
                <TabsTrigger value="info">{t("products.tab_basic")}</TabsTrigger>
                <TabsTrigger value="variants">{t("products.tab_variants")}</TabsTrigger>
                <TabsTrigger value="stock">{t("products.tab_stock")}</TabsTrigger>
              </TabsList>

              {/* Info tab */}
              <TabsContent value="info" className="pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">{t("products.default_price")}:</span> <span className="font-medium">{parseFloat(detailProduct.price).toFixed(3)}</span></div>
                  <div><span className="text-muted-foreground">{t("products.category")}:</span> <span className="font-medium">{categories.find(c => c.id === detailProduct.categoryId)?.name || "—"}</span></div>
                  <div><span className="text-muted-foreground">{t("products.product_type")}:</span> <span className="font-medium">{detailProduct.productType || "simple"}</span></div>
                  <div><span className="text-muted-foreground">{t("products.table_status")}:</span> <Badge variant={detailProduct.active ? "default" : "secondary"}>{detailProduct.active ? t("products.active") : t("products.inactive")}</Badge></div>
                  <div><span className="text-muted-foreground">{t("products.avg_cost")}:</span> <span className="font-medium">{parseFloat(detailProduct.avgCost || "0").toFixed(3)}</span></div>
                  <div><span className="text-muted-foreground">{t("products.last_purchase_price")}:</span> <span className="font-medium">{detailProduct.lastPurchasePrice ? parseFloat(detailProduct.lastPurchasePrice).toFixed(3) : "—"}</span></div>
                  <div><span className="text-muted-foreground">{t("products.last_supplier")}:</span> <span className="font-medium">{detailProduct.lastSupplier || "—"}</span></div>
                  <div><span className="text-muted-foreground">{t("products.total_stock")}:</span> <Badge variant="secondary">{detailProduct.stockQty ?? 0}</Badge></div>
                </div>
              </TabsContent>

              {/* Variants tab */}
              <TabsContent value="variants" className="pt-4">
                {!detailProduct.variants || detailProduct.variants.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground">{t("products.no_variants")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("products.variant_barcode")}</TableHead>
                        <TableHead>{t("products.variant_sku")}</TableHead>
                        <TableHead>{t("products.variant_color")}</TableHead>
                        <TableHead>{t("products.variant_size")}</TableHead>
                        <TableHead>{t("products.variant_price")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailProduct.variants.map((v: any) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono text-xs">{v.barcode || "—"}</TableCell>
                          <TableCell>{v.sku || "—"}</TableCell>
                          <TableCell>{v.color || "—"}</TableCell>
                          <TableCell>{v.size || "—"}</TableCell>
                          <TableCell>{parseFloat(v.price).toFixed(3)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Stock tab */}
              <TabsContent value="stock" className="pt-4">
                {!detailProduct.locationInventory || detailProduct.locationInventory.length === 0 ? (
                  <p className="text-center py-6 text-muted-foreground">{t("products.no_inventory_data")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead><MapPin className="w-3 h-3 inline ml-1" />{t("products.location_name")}</TableHead>
                        <TableHead>{t("products.branch")}</TableHead>
                        <TableHead>{t("products.qty_on_hand")}</TableHead>
                        <TableHead>{t("products.reorder_level")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailProduct.locationInventory.map((loc: any) => (
                        <TableRow key={loc.locationId}>
                          <TableCell>{loc.locationName}</TableCell>
                          <TableCell>{loc.branchName || t("products.central")}</TableCell>
                          <TableCell>
                            <Badge variant={loc.qtyOnHand <= (loc.reorderLevel || 0) ? "destructive" : "outline"}>
                              {loc.qtyOnHand}
                            </Badge>
                          </TableCell>
                          <TableCell>{loc.reorderLevel ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Variant Sub-dialog ─────────────────────────────────────────── */}
      <Dialog open={variantDialogOpen} onOpenChange={v => { setVariantDialogOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVariant ? t("products.edit_variant") : t("products.add_variant")}</DialogTitle>
            <DialogDescription>{formProduct?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium">{t("products.variant_barcode")}</label>
              <div className="flex gap-2">
                <Input value={variantForm.barcode} onChange={e => setVariantForm(f => ({ ...f, barcode: e.target.value }))} data-testid="input-variant-barcode" />
                <BarcodeScanButton onScan={code => setVariantForm(f => ({ ...f, barcode: code }))} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.variant_sku")}</label>
              <Input value={variantForm.sku} onChange={e => setVariantForm(f => ({ ...f, sku: e.target.value }))} data-testid="input-variant-sku" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.variant_color")}</label>
              <Input value={variantForm.color} onChange={e => setVariantForm(f => ({ ...f, color: e.target.value }))} data-testid="input-variant-color" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.variant_size")}</label>
              <Input value={variantForm.size} onChange={e => setVariantForm(f => ({ ...f, size: e.target.value }))} data-testid="input-variant-size" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.variant_price")}</label>
              <Input type="number" step="0.001" value={variantForm.price} onChange={e => setVariantForm(f => ({ ...f, price: e.target.value }))} readOnly={!isOwnerOrAdmin} data-testid="input-variant-price" />
            </div>
            {editingVariant && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("products.last_purchase_price")}</label>
                  <Input value={parseFloat(editingVariant.lastPurchasePrice?.toString() || "0").toFixed(3)} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("products.avg_cost")}</label>
                  <Input value={parseFloat(formProduct?.avgCost?.toString() || "0").toFixed(3)} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("products.profit_margin")}</label>
                  <div className="h-10 px-3 py-2 rounded-md border bg-muted text-sm flex items-center">
                    {(() => {
                      const price = parseFloat(variantForm.price);
                      const avg = parseFloat(formProduct?.avgCost?.toString() || "0");
                      if (avg > 0 && price > 0) return `${(((price - avg) / avg) * 100).toFixed(1)}%`;
                      return "—";
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => upsertVariantMutation.mutate(variantForm)} disabled={upsertVariantMutation.isPending} data-testid="button-save-variant">
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
