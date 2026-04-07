import { useState } from "react";
import { Plus, Edit2, Trash2, FolderOpen, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Category } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

export default function Categories() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data } = useAuth();
  const user = data?.user;
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  const [addOpen, setAddOpen]           = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [name, setName]                 = useState("");

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // عدد المنتجات لكل فئة
  const productCount = (catId: number) =>
    (products as any[]).filter(p => p.categoryId === catId).length;

  const createMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/categories", { name }),
    onSuccess: () => {
      toast({ title: t("products.category_added") });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setAddOpen(false);
      setName("");
    },
    onError: (err: Error) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiRequest("PATCH", `/api/categories/${id}`, { name }),
    onSuccess: () => {
      toast({ title: t("common.saved") });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setEditCategory(null);
      setName("");
    },
    onError: (err: Error) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/categories/${id}`),
    onSuccess: () => {
      toast({ title: t("common.deleted") });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setDeleteCategory(null);
    },
    onError: (err: Error) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  function openAdd() { setName(""); setAddOpen(true); }
  function openEdit(c: Category) { setEditCategory(c); setName(c.name); }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="w-6 h-6" /> {t("nav.categories")}
          </h1>
          <p className="text-muted-foreground">{t("products.all_categories")} — {categories.length} فئة</p>
        </div>
        {isOwnerOrAdmin && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" /> {t("products.add_category")}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>{t("products.category")}</TableHead>
              <TableHead>عدد المنتجات</TableHead>
              {isOwnerOrAdmin && <TableHead className="text-right">{t("products.table_actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {t("common.no_data")}
                </TableCell>
              </TableRow>
            ) : categories.map((c, i) => {
              const count = productCount(c.id);
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={count === 0 ? "secondary" : "outline"} className="gap-1">
                      <Package className="w-3 h-3" /> {count}
                    </Badge>
                  </TableCell>
                  {isOwnerOrAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteCategory(c)}>
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

      {/* ── نافذة الإضافة ── */}
      <Dialog open={addOpen} onOpenChange={open => { if (!open) { setAddOpen(false); setName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" /> {t("products.add_category")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <label className="text-sm font-medium">{t("products.category")}</label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t("products.category_name_placeholder")}
              onKeyDown={e => { if (e.key === "Enter" && name.trim()) createMutation.mutate(name); }}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setAddOpen(false); setName(""); }}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => createMutation.mutate(name)} disabled={!name.trim() || createMutation.isPending}>
              {createMutation.isPending ? "جارٍ الحفظ..." : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── نافذة التعديل ── */}
      <Dialog open={!!editCategory} onOpenChange={open => { if (!open) { setEditCategory(null); setName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5" /> تعديل الفئة
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* معلومات الفئة */}
            {editCategory && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FolderOpen className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">عدد المنتجات في هذه الفئة</p>
                  <p className="font-bold text-lg">{productCount(editCategory.id)} منتج</p>
                </div>
              </div>
            )}

            {/* حقل الاسم */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("products.category")}</label>
              <Input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && name.trim() && editCategory)
                    updateMutation.mutate({ id: editCategory.id, name });
                }}
              />
            </div>
          </div>

          <DialogFooter className="flex-row-reverse justify-between gap-2 sm:flex-row-reverse">
            {/* يسار: حذف */}
            <Button
              variant="destructive"
              onClick={() => { setEditCategory(null); setDeleteCategory(editCategory); }}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" /> حذف الفئة
            </Button>
            {/* يمين: إلغاء + حفظ */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEditCategory(null); setName(""); }}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => editCategory && updateMutation.mutate({ id: editCategory.id, name })}
                disabled={!name.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? "جارٍ الحفظ..." : t("common.save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── تأكيد الحذف ── */}
      <Dialog open={!!deleteCategory} onOpenChange={open => { if (!open) setDeleteCategory(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> تأكيد الحذف
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف فئة <strong>"{deleteCategory?.name}"</strong>؟
              {deleteCategory && productCount(deleteCategory.id) > 0 && (
                <span className="block mt-1 text-orange-600 font-medium">
                  ⚠️ تحتوي على {productCount(deleteCategory.id)} منتج — سيتم إلغاء ارتباطهم بهذه الفئة.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteCategory(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteCategory && deleteMutation.mutate(deleteCategory.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "جارٍ الحذف..." : "نعم، احذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
