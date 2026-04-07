import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Plus, Search, Package, Edit2, Trash2, Eye, MapPin, AlertCircle, Download, ArrowUpDown, ArrowUp, ArrowDown, Copy } from "lucide-react";
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
  const { data } = useAuth();
  const user = data?.user;
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  // ── filters ──────────────────────────────────────────────────────────
  const searchStr = useSearch();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(() => {
    const params = new URLSearchParams(searchStr);
    return params.get("categoryId") || "all";
  });
  const [filterType, setFilterType]     = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterStock, setFilterStock]   = useState<"all" | "zero" | "low">("all");
  const [sortBy, setSortBy]             = useState<"name" | "price" | "stock" | null>(null);
  const [sortDir, setSortDir]           = useState<"asc" | "desc">("asc");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // تحديث الفلتر عند تغيير الرابط
  useEffect(() => {
    const params = new URLSearchParams(searchStr);
    const cat = params.get("categoryId");
    if (cat) setFilterCat(cat);
  }, [searchStr]);

  // ── product form (add / edit) ─────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [formProduct, setFormProduct] = useState<any>(null); // null = add
  const [formTab, setFormTab] = useState("basic");
  const [formData, setFormData] = useState({
    name: "", categoryId: "", price: "", barcode: "", productType: "simple", active: true, image: "",
  });

  // ── detail modal ──────────────────────────────────────────────────────
  const [detailProductId, setDetailProductId] = useState<number | null>(null);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

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
    setFormData({ name: "", categoryId: "", price: "", barcode: "", productType: "simple", active: true, image: "" });
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
      image: p.image || "",
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
      image: formData.image || null,
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

  const deleteConfirmProduct = (products as any[]).find(p => p.id === deleteConfirmId);

  const isSaving = createProductMutation.isPending || updateProductMutation.isPending;
  const formValid = formData.name.trim().length >= 2 && (formData.price !== "" && !isNaN(parseFloat(formData.price)));

  // ── client-side filter + sort ─────────────────────────────────────────
  const filteredProducts = (products as any[])
    .filter(p => {
      if (filterStatus === "active"   && !p.active) return false;
      if (filterStatus === "inactive" &&  p.active) return false;
      const stock = p.totalStock ?? 0;
      if (filterStock === "zero" && stock !== 0) return false;
      if (filterStock === "low"  && (stock === 0 || stock >= 5)) return false;
      return true;
    })
    .sort((a, b) => {
      if (!sortBy) return 0;
      let va: any = 0, vb: any = 0;
      if (sortBy === "name")  { va = a.name;                    vb = b.name; }
      if (sortBy === "price") { va = parseFloat(a.price) || 0;  vb = parseFloat(b.price) || 0; }
      if (sortBy === "stock") { va = a.totalStock ?? 0;         vb = b.totalStock ?? 0; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });

  // ── stats (من الكل بدون فلاتر الحالة والمخزون) ───────────────────────
  const stats = {
    total:    (products as any[]).length,
    outStock: (products as any[]).filter(p => (p.totalStock ?? 0) === 0).length,
    low:      (products as any[]).filter(p => { const s = p.totalStock ?? 0; return s > 0 && s < 5; }).length,
    inactive: (products as any[]).filter(p => !p.active).length,
  };

  // ── toggle sort ───────────────────────────────────────────────────────
  function toggleSort(field: "name" | "price" | "stock") {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
  }
  function sortIcon(field: "name" | "price" | "stock") {
    if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 opacity-40 inline ms-1" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 inline ms-1 text-primary" />
      : <ArrowDown className="w-3 h-3 inline ms-1 text-primary" />;
  }

  // ── export CSV ────────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ["#", "الاسم", "الفئة", "الباركود", "السعر", "المخزون", "الحالة"];
    const rows = filteredProducts.map((p, i) => [
      i + 1,
      `"${p.name}"`,
      `"${categories.find((c: any) => c.id === p.categoryId)?.name ?? "—"}"`,
      p.barcode || "",
      parseFloat(p.price).toFixed(3),
      p.totalStock ?? 0,
      p.active ? "نشط" : "غير نشط",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "products.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── copy barcode ──────────────────────────────────────────────────────
  function copyBarcode(code: string) {
    navigator.clipboard.writeText(code).then(() =>
      toast({ title: "تم النسخ", description: code })
    );
  }

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-products-title">{t("products.title")}</h1>
          <p className="text-muted-foreground">{t("products.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {(() => {
            const nameCount: Record<string, number> = {};
            (products as any[]).forEach(p => { nameCount[p.name.trim()] = (nameCount[p.name.trim()] || 0) + 1; });
            const dupCount = Object.values(nameCount).filter(c => c > 1).length;
            return dupCount > 0 ? (
              <Button variant="outline" className="gap-2 border-orange-400 text-orange-600 hover:bg-orange-50" onClick={() => setDuplicatesOpen(true)}>
                <AlertCircle className="w-4 h-4" /> {dupCount} أسماء مكررة
              </Button>
            ) : null;
          })()}
          <Button onClick={openAdd} className="gap-2" data-testid="button-add-product">
            <Plus className="w-4 h-4" /> {t("products.add_product")}
          </Button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">إجمالي المنتجات</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setFilterStock("zero")}>
          <p className="text-2xl font-bold text-destructive">{stats.outStock}</p>
          <p className="text-xs text-muted-foreground mt-0.5">نفد المخزون</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center cursor-pointer hover:border-orange-400/50 transition-colors" onClick={() => setFilterStock("low")}>
          <p className="text-2xl font-bold text-orange-500">{stats.low}</p>
          <p className="text-xs text-muted-foreground mt-0.5">مخزون منخفض</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors" onClick={() => setFilterStatus("inactive")}>
          <p className="text-2xl font-bold text-muted-foreground">{stats.inactive}</p>
          <p className="text-xs text-muted-foreground mt-0.5">غير نشط</p>
        </div>
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
            {categories.filter((c: any) => !c.parentId).map((parent: any) => [
              <SelectItem key={parent.id} value={parent.id.toString()} className="font-semibold">
                {parent.name}
              </SelectItem>,
              ...categories.filter((c: any) => c.parentId === parent.id).map((child: any) => (
                <SelectItem key={child.id} value={child.id.toString()} className="pr-6 text-muted-foreground">
                  ↳ {child.name}
                </SelectItem>
              ))
            ])}
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
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">النشطة فقط</SelectItem>
            <SelectItem value="inactive">غير النشطة</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStock} onValueChange={v => setFilterStock(v as any)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المخزون</SelectItem>
            <SelectItem value="zero">نفد المخزون</SelectItem>
            <SelectItem value="low">مخزون منخفض</SelectItem>
          </SelectContent>
        </Select>
        {(filterStatus !== "all" || filterStock !== "all") && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setFilterStatus("all"); setFilterStock("all"); }}>
            مسح الفلاتر ✕
          </Button>
        )}
        <Button variant="outline" size="sm" className="gap-1.5 ms-auto" onClick={exportCSV}>
          <Download className="w-4 h-4" /> تصدير CSV
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 text-center">#</TableHead>
              <TableHead className="w-10">{t("products.image")}</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                {t("products.table_name")}{sortIcon("name")}
              </TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>{t("products.code")}</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("price")}>
                {t("products.default_price")}{sortIcon("price")}
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("stock")}>
                الكمية{sortIcon("stock")}
              </TableHead>
              <TableHead>{t("products.table_status")}</TableHead>
              <TableHead className="text-right">{t("products.table_actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">{t("products.no_products")}</TableCell></TableRow>
            ) : filteredProducts.map((p, idx) => {
              const catName = categories.find((c: any) => c.id === p.categoryId)?.name ?? "—";
              const stock = p.totalStock ?? 0;
              return (
              <TableRow key={p.id} className={!p.active ? "opacity-60" : ""}>
                <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                <TableCell>
                  <div
                    className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden ${p.image ? "cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" : ""}`}
                    onClick={() => p.image && setPreviewImage(p.image)}
                    title={p.image ? "اضغط للمعاينة" : undefined}
                  >
                    {p.image
                      ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      : <Package className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{catName}</Badge></TableCell>
                <TableCell
                  className={`font-mono text-xs ${p.barcode ? "text-foreground cursor-pointer hover:text-primary transition-colors group" : "text-muted-foreground"}`}
                  title={p.barcode ? "اضغط لنسخ الباركود" : undefined}
                  onClick={() => p.barcode && copyBarcode(p.barcode)}
                >
                  {p.barcode
                    ? <span className="flex items-center gap-1">{p.barcode} <Copy className="w-3 h-3 opacity-0 group-hover:opacity-50" /></span>
                    : "—"}
                </TableCell>
                <TableCell className="font-medium">{parseFloat(p.price).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-xs text-muted-foreground">ر.ع</span></TableCell>
                <TableCell>
                  <Badge variant={stock === 0 ? "destructive" : stock < 5 ? "secondary" : "outline"} className={stock > 0 && stock < 5 ? "border-orange-400 text-orange-600 bg-orange-50" : ""}>
                    {stock}
                  </Badge>
                </TableCell>
                <TableCell>
                  {isOwnerOrAdmin ? (
                    <Switch
                      checked={p.active ?? true}
                      onCheckedChange={v => toggleActiveMutation.mutate({ id: p.id, active: v })}
                      disabled={toggleActiveMutation.isPending}
                    />
                  ) : (
                    <Badge variant={p.active ? "default" : "secondary"}>
                      {p.active ? t("products.active") : t("products.inactive")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="التفاصيل" onClick={() => setDetailProductId(p.id)} data-testid={`button-detail-product-${p.id}`}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="تعديل" onClick={() => openEdit(p)} data-testid={`button-edit-product-${p.id}`}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="حذف" onClick={() => setDeleteConfirmId(p.id)} data-testid={`button-delete-product-${p.id}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
            })}
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
                      {categories.filter((c: any) => !c.parentId).map((parent: any) => [
                        <SelectItem key={parent.id} value={parent.id.toString()} className="font-semibold">
                          {parent.name}
                        </SelectItem>,
                        ...categories.filter((c: any) => c.parentId === parent.id).map((child: any) => (
                          <SelectItem key={child.id} value={child.id.toString()} className="pr-6 text-muted-foreground">
                            ↳ {child.name}
                          </SelectItem>
                        ))
                      ])}
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

              {/* Image Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("products.image")}</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {formData.image
                      ? <img src={formData.image} alt="" className="w-full h-full object-cover" />
                      : <Package className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="product-image-input"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const img = new Image();
                        const url = URL.createObjectURL(file);
                        img.onload = () => {
                          const MAX = 600;
                          let { width, height } = img;
                          if (width > MAX || height > MAX) {
                            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
                            else { width = Math.round(width * MAX / height); height = MAX; }
                          }
                          const canvas = document.createElement("canvas");
                          canvas.width = width; canvas.height = height;
                          canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
                          setFormData(f => ({ ...f, image: canvas.toDataURL("image/jpeg", 0.7) }));
                          URL.revokeObjectURL(url);
                        };
                        img.src = url;
                        e.target.value = "";
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("product-image-input")?.click()}>
                      اختر صورة
                    </Button>
                    {formData.image && (
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setFormData(f => ({ ...f, image: "" }))}>
                        حذف الصورة
                      </Button>
                    )}
                  </div>
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

      {/* ── Duplicates Modal ──────────────────────────────────────────────── */}
      <Dialog open={duplicatesOpen} onOpenChange={setDuplicatesOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="w-5 h-5" /> المنتجات ذات الأسماء المكررة
            </DialogTitle>
            <DialogDescription>
              هذه المنتجات لها نفس الاسم — راجعها وادمجها أو احذف المكرر
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {(() => {
              const groups: Record<string, any[]> = {};
              (products as any[]).forEach(p => {
                const key = p.name.trim();
                if (!groups[key]) groups[key] = [];
                groups[key].push(p);
              });
              const dups = Object.entries(groups).filter(([, arr]) => arr.length > 1);
              return dups.map(([name, items]) => (
                <div key={name} className="border rounded-lg p-3 space-y-2">
                  <p className="font-semibold text-sm text-orange-700">{name} <Badge variant="secondary">{items.length} نسخ</Badge></p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>الباركود</TableHead>
                        <TableHead>السعر</TableHead>
                        <TableHead>المخزون</TableHead>
                        <TableHead className="text-right">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">#{p.id}</TableCell>
                          <TableCell className="font-mono text-xs">{p.barcode || "—"}</TableCell>
                          <TableCell>{parseFloat(p.price).toFixed(3)}</TableCell>
                          <TableCell>
                            <Badge variant={p.totalStock === 0 ? "destructive" : "outline"}>{p.totalStock ?? 0}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => { setDuplicatesOpen(false); openEdit(p); }}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteProductMutation.mutate(p.id)}>
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ));
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicatesOpen(false)}>إغلاق</Button>
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

      {/* ── مودال معاينة الصورة ── */}
      <Dialog open={!!previewImage} onOpenChange={open => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="max-w-sm p-2">
          <img src={previewImage ?? ""} alt="" className="w-full rounded-lg object-contain max-h-[70vh]" />
        </DialogContent>
      </Dialog>

      {/* ── مودال تأكيد الحذف ── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> تأكيد الحذف
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 pt-1">
                <p>هل أنت متأكد من حذف المنتج <strong>"{deleteConfirmProduct?.name}"</strong>؟</p>
                <p className="text-muted-foreground text-sm">لا يمكن التراجع عن هذا الإجراء.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              disabled={deleteProductMutation.isPending}
              onClick={() => {
                if (deleteConfirmId) {
                  deleteProductMutation.mutate(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
            >
              {deleteProductMutation.isPending ? "جارٍ الحذف..." : "نعم، احذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
