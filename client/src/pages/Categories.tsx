import { useState } from "react";
import { Plus, Edit2, Trash2, FolderOpen, Package, Search, ChevronDown, ChevronRight, Image as ImageIcon, ChevronsUpDown } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Category } from "@shared/schema";

const EMPTY_FORM = {
  name: "", description: "", image: "", parentId: "", isActive: true, sortOrder: 0,
};

type CatRow = Category & { depth: number };

export default function Categories() {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();
  const { data: authData } = useAuth();
  const user = authData?.user;
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  // ── فلاتر ──────────────────────────────────────────────────────────────────
  const [search, setSearch]             = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "true" | "false">("all");
  const [filterParent, setFilterParent] = useState<"all" | "root" | string>("all");
  const [collapsed, setCollapsed]       = useState<Set<number>>(new Set());

  // ── modals ─────────────────────────────────────────────────────────────────
  const [addOpen, setAddOpen]               = useState(false);
  const [editCategory, setEditCategory]     = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [form, setForm]                     = useState({ ...EMPTY_FORM });

  // ── queries ────────────────────────────────────────────────────────────────
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // ── helpers ────────────────────────────────────────────────────────────────
  const productCount  = (id: number) => (products as any[]).filter(p => p.categoryId === id).length;
  const subCount      = (id: number) => (categories as Category[]).filter(c => c.parentId === id).length;
  const getCatName    = (id?: number | null) => id ? (categories as Category[]).find(c => c.id === id)?.name ?? "—" : "—";

  // بناء الهرم (مع الفلاتر)
  function buildRows(): CatRow[] {
    const cats = (categories as Category[]).filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterActive !== "all" && String(c.isActive) !== filterActive) return false;
      if (filterParent === "root" && c.parentId !== null) return false;
      if (filterParent !== "all" && filterParent !== "root" && String(c.parentId) !== filterParent) return false;
      return true;
    });
    const roots = cats.filter(c => !c.parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "ar"));
    const result: CatRow[] = [];
    for (const r of roots) {
      result.push({ ...r, depth: 0 });
      if (!collapsed.has(r.id)) {
        const children = cats
          .filter(c => c.parentId === r.id)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "ar"));
        for (const ch of children) result.push({ ...ch, depth: 1 });
      }
    }
    return result;
  }
  const rows = buildRows();

  // ── mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiRequest("POST", "/api/categories", {
        name:        data.name.trim(),
        description: data.description.trim() || null,
        image:       data.image || null,
        parentId:    data.parentId ? Number(data.parentId) : null,
        isActive:    data.isActive,
        sortOrder:   Number(data.sortOrder) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: t("categories_page.toast_added") });
      setAddOpen(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (err: Error) => toast({ title: t("categories_page.toast_error"), description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof form }) =>
      apiRequest("PATCH", `/api/categories/${id}`, {
        name:        data.name.trim(),
        description: data.description.trim() || null,
        image:       data.image || null,
        parentId:    data.parentId ? Number(data.parentId) : null,
        isActive:    data.isActive,
        sortOrder:   Number(data.sortOrder) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: t("categories_page.toast_saved") });
      setEditCategory(null);
    },
    onError: (err: Error) => toast({ title: t("categories_page.toast_error"), description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/categories/${id}/toggle`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/categories"] }),
    onError: (err: Error) => toast({ title: t("categories_page.toast_error"), description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: t("categories_page.toast_deleted") });
      setDeleteCategory(null);
    },
    onError: (err: Error) => toast({ title: t("categories_page.toast_error"), description: err.message, variant: "destructive" }),
  });

  // ── form helpers ───────────────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setAddOpen(true);
  }

  function openAddSub(parent: Category) {
    setForm({ ...EMPTY_FORM, parentId: parent.id.toString() });
    setAddOpen(true);
  }

  function collapseAll() {
    const rootIds = (categories as Category[]).filter(c => !c.parentId).map(c => c.id);
    setCollapsed(new Set(rootIds));
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  function openEdit(c: Category) {
    setForm({
      name:        c.name,
      description: (c as any).description || "",
      image:       (c as any).image || "",
      parentId:    c.parentId?.toString() || "",
      isActive:    (c as any).isActive ?? true,
      sortOrder:   c.sortOrder ?? 0,
    });
    setEditCategory(c);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
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
      setForm(f => ({ ...f, image: canvas.toDataURL("image/jpeg", 0.7) }));
      URL.revokeObjectURL(url);
    };
    img.src = url;
    e.target.value = "";
  }

  // فئات الأب المتاحة (بدون الفئة الحالية وأبناءها)
  function parentOptions(excludeId?: number) {
    return (categories as Category[]).filter(c => {
      if (c.parentId !== null) return false; // فئات رئيسية فقط
      if (excludeId && c.id === excludeId) return false;
      return true;
    });
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="w-6 h-6" /> {t("categories_page.title")}
          </h1>
          <p className="text-muted-foreground">
            {categories.length} {t("categories_page.subtitle_categories")} — {(categories as Category[]).filter(c => !(c as any).isActive).length} {t("categories_page.subtitle_inactive")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} className="gap-1 text-xs">
            <ChevronsUpDown className="w-3.5 h-3.5" /> {t("categories_page.expand_all")}
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} className="gap-1 text-xs">
            <ChevronRight className="w-3.5 h-3.5" /> {t("categories_page.collapse_all")}
          </Button>
          {isOwnerOrAdmin && (
            <Button onClick={openAdd} className="gap-2">
              <Plus className="w-4 h-4" /> {t("categories_page.add_category")}
            </Button>
          )}
        </div>
      </div>

      {/* فلاتر */}
      <div className="flex flex-wrap gap-3 items-center bg-card p-4 border rounded-lg">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("categories_page.search_placeholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterActive} onValueChange={v => setFilterActive(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("categories_page.filter_all_statuses")}</SelectItem>
            <SelectItem value="true">{t("categories_page.filter_active")}</SelectItem>
            <SelectItem value="false">{t("categories_page.filter_inactive")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterParent} onValueChange={v => setFilterParent(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("categories_page.filter_all_cats")}</SelectItem>
            <SelectItem value="root">{t("categories_page.filter_root")}</SelectItem>
            {(categories as Category[]).filter(c => !c.parentId).map(c => (
              <SelectItem key={c.id} value={c.id.toString()}>{t("categories_page.filter_sub")} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* الجدول */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-10">{t("categories_page.col_num")}</TableHead>
              <TableHead className="w-12">{t("categories_page.col_image")}</TableHead>
              <TableHead>{t("categories_page.col_name")}</TableHead>
              <TableHead>{t("categories_page.col_desc")}</TableHead>
              <TableHead>{t("categories_page.col_parent")}</TableHead>
              <TableHead>{t("categories_page.col_products")}</TableHead>
              <TableHead>{t("categories_page.col_status")}</TableHead>
              {isOwnerOrAdmin && <TableHead className="text-start">{t("categories_page.col_actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10">
                <div className="flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" /></div>
              </TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                {t("categories_page.no_results")} {search && `${t("categories_page.no_results_search")} "${search}"`}
              </TableCell></TableRow>
            ) : rows.map((c, i) => {
              const count = productCount(c.id);
              const hasChildren = subCount(c.id) > 0;
              const isCollapsed = collapsed.has(c.id);
              return (
                <TableRow key={c.id} className={`hover:bg-muted/30 transition-colors${c.depth === 1 ? " bg-muted/20" : ""}`}>
                  <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>

                  {/* صورة */}
                  <TableCell>
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {(c as any).image
                        ? <img src={(c as any).image} alt={c.name} className="w-full h-full object-cover" />
                        : <FolderOpen className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </TableCell>

                  {/* الاسم مع indent وزر الطي */}
                  <TableCell>
                    <div className="flex items-center gap-1" style={{ paddingRight: c.depth * 20 }}>
                      {c.depth === 0 && hasChildren && (
                        <button
                          className="p-0.5 rounded hover:bg-muted transition-colors"
                          onClick={() => setCollapsed(s => {
                            const n = new Set(s);
                            n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                            return n;
                          })}
                        >
                          {isCollapsed
                            ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                      )}
                      {c.depth === 1 && <span className="text-muted-foreground text-xs ms-1">└</span>}
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </TableCell>

                  {/* الوصف */}
                  <TableCell className="text-muted-foreground text-sm max-w-[180px] truncate">
                    {(c as any).description || "—"}
                  </TableCell>

                  {/* الفئة الأب */}
                  <TableCell className="text-sm text-muted-foreground">
                    {c.parentId
                      ? <Badge variant="outline" className="text-xs">{getCatName(c.parentId)}</Badge>
                      : <Badge variant="secondary" className="text-xs">{t("categories_page.badge_root")}</Badge>}
                  </TableCell>

                  {/* عدد المنتجات */}
                  <TableCell>
                    <Badge
                      variant={count === 0 ? "secondary" : "outline"}
                      className={count > 0 ? "cursor-pointer hover:bg-primary/10 gap-1" : "gap-1"}
                      title={count > 0 ? t("categories_page.view_products_title") : t("categories_page.no_products_title")}
                      onClick={() => count > 0 && setLocation(`/products?categoryId=${c.id}`)}
                    >
                      <Package className="w-3 h-3" /> {count} {t("categories_page.product_count")}
                    </Badge>
                  </TableCell>

                  {/* الحالة */}
                  <TableCell>
                    {isOwnerOrAdmin ? (
                      <Switch
                        checked={(c as any).isActive ?? true}
                        onCheckedChange={() => toggleMutation.mutate(c.id)}
                        disabled={toggleMutation.isPending}
                      />
                    ) : (
                      <Badge variant={(c as any).isActive ? "default" : "secondary"}>
                        {(c as any).isActive ? t("categories_page.badge_active") : t("categories_page.badge_inactive")}
                      </Badge>
                    )}
                  </TableCell>

                  {/* إجراءات */}
                  {isOwnerOrAdmin && (
                    <TableCell className="text-start">
                      <div className="flex justify-end gap-1">
                        {c.depth === 0 && (
                          <Button variant="ghost" size="icon" title={t("categories_page.add_sub_title")} onClick={() => openAddSub(c)}>
                            <Plus className="w-4 h-4 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" title={t("categories_page.edit_title")} onClick={() => openEdit(c)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={t("categories_page.delete_title")} onClick={() => setDeleteCategory(c)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Modal الإضافة ── */}
      <Dialog open={addOpen} onOpenChange={open => { if (!open) { setAddOpen(false); setForm({ ...EMPTY_FORM }); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> {t("categories_page.modal_add_title")}</DialogTitle>
          </DialogHeader>
          <CategoryForm form={form} setForm={setForm} onImageChange={handleImageChange} parentOptions={parentOptions()} t={t} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setAddOpen(false); setForm({ ...EMPTY_FORM }); }}>{t("categories_page.modal_cancel")}</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.name.trim() || createMutation.isPending}>
              {createMutation.isPending ? t("categories_page.modal_saving") : t("categories_page.modal_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal التعديل ── */}
      <Dialog open={!!editCategory} onOpenChange={open => { if (!open) setEditCategory(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit2 className="w-5 h-5" /> {t("categories_page.modal_edit_prefix")} {editCategory?.name}</DialogTitle>
          </DialogHeader>
          {editCategory && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{t("categories_page.modal_products_label")} <strong>{productCount(editCategory.id)}</strong></span>
              {subCount(editCategory.id) > 0 && (
                <span className="text-sm text-muted-foreground">— {t("categories_page.modal_sub_cats_label")} <strong>{subCount(editCategory.id)}</strong></span>
              )}
            </div>
          )}
          <CategoryForm form={form} setForm={setForm} onImageChange={handleImageChange} parentOptions={parentOptions(editCategory?.id)} t={t} />
          <DialogFooter className="flex-row justify-between gap-2">
            <Button variant="destructive" className="gap-1" onClick={() => { setEditCategory(null); setDeleteCategory(editCategory); }}>
              <Trash2 className="w-4 h-4" /> {t("categories_page.modal_delete")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditCategory(null)}>{t("categories_page.modal_cancel")}</Button>
              <Button onClick={() => editCategory && updateMutation.mutate({ id: editCategory.id, data: form })} disabled={!form.name.trim() || updateMutation.isPending}>
                {updateMutation.isPending ? t("categories_page.modal_saving") : t("categories_page.modal_save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal تأكيد الحذف ── */}
      <Dialog open={!!deleteCategory} onOpenChange={open => { if (!open) setDeleteCategory(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2"><Trash2 className="w-5 h-5" /> {t("categories_page.modal_confirm_delete")}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 pt-1">
                <p>{t("categories_page.modal_confirm_msg")} <strong>"{deleteCategory?.name}"</strong>{"؟"}</p>
                {deleteCategory && productCount(deleteCategory.id) > 0 && (
                  <p className="text-orange-600 font-medium">⚠️ {t("categories_page.modal_confirm_products_warning").replace("{count}", String(productCount(deleteCategory.id)))}</p>
                )}
                {deleteCategory && subCount(deleteCategory.id) > 0 && (
                  <p className="text-red-600 font-medium">⚠️ {t("categories_page.modal_confirm_sub_warning").replace("{count}", String(subCount(deleteCategory.id)))}</p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteCategory(null)}>{t("categories_page.modal_cancel")}</Button>
            <Button variant="destructive" onClick={() => deleteCategory && deleteMutation.mutate(deleteCategory.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? t("categories_page.modal_deleting") : t("categories_page.modal_confirm_yes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── مكوّن الفورم المشترك ───────────────────────────────────────────────────
function CategoryForm({
  form, setForm, onImageChange, parentOptions, t,
}: {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  parentOptions: Category[];
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-4 py-2">
      {/* الاسم */}
      <div className="space-y-1">
        <label className="text-sm font-medium">{t("categories_page.form_name_label")} <span className="text-destructive">{t("categories_page.form_name_required")}</span></label>
        <Input
          autoFocus
          value={form.name}
          onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
          placeholder={t("categories_page.form_name_placeholder")}
          maxLength={100}
        />
      </div>

      {/* الوصف */}
      <div className="space-y-1">
        <label className="text-sm font-medium">{t("categories_page.form_desc_label")} <span className="text-muted-foreground text-xs">{t("categories_page.form_desc_optional")}</span></label>
        <Textarea
          value={form.description}
          onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
          placeholder={t("categories_page.form_desc_placeholder")}
          rows={2}
          maxLength={500}
        />
      </div>

      {/* الصورة */}
      <div className="space-y-1">
        <label className="text-sm font-medium">{t("categories_page.form_image_label")} <span className="text-muted-foreground text-xs">{t("categories_page.form_image_optional")}</span></label>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {form.image
              ? <img src={form.image} alt="" className="w-full h-full object-cover" />
              : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div className="flex flex-col gap-1.5">
            <input type="file" accept="image/*" className="hidden" id="cat-img-input" onChange={onImageChange} />
            <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("cat-img-input")?.click()}>
              {t("categories_page.form_image_choose")}
            </Button>
            {form.image && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive h-7"
                onClick={() => setForm((f: any) => ({ ...f, image: "" }))}>
                {t("categories_page.form_image_delete")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* الفئة الأب */}
      <div className="space-y-1">
        <label className="text-sm font-medium">{t("categories_page.form_parent_label")} <span className="text-muted-foreground text-xs">{t("categories_page.form_parent_optional")}</span></label>
        <Select value={form.parentId || "none"} onValueChange={v => setForm((f: any) => ({ ...f, parentId: v === "none" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder={t("categories_page.form_parent_placeholder")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("categories_page.form_parent_root")}</SelectItem>
            {parentOptions.map(c => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* الترتيب + الحالة */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("categories_page.form_sort_label")}</label>
          <Input
            type="number" min={0}
            value={form.sortOrder}
            onChange={e => setForm((f: any) => ({ ...f, sortOrder: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("categories_page.form_status_label")}</label>
          <div className="flex items-center gap-3 h-10 border rounded-md px-3">
            <Switch
              checked={form.isActive}
              onCheckedChange={v => setForm((f: any) => ({ ...f, isActive: v }))}
            />
            <span className={`text-sm font-medium ${form.isActive ? "text-green-600" : "text-muted-foreground"}`}>
              {form.isActive ? t("categories_page.form_status_active") : t("categories_page.form_status_inactive")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
