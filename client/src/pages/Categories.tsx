import { useState } from "react";
import { Plus, Edit2, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

  const [addOpen, setAddOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

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
    mutationFn: ({ id, name }: { id: number; name: string }) => apiRequest("PATCH", `/api/categories/${id}`, { name }),
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
    },
    onError: (err: Error) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  function openAdd() { setName(""); setAddOpen(true); }
  function openEdit(c: Category) { setEditCategory(c); setName(c.name); }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="w-6 h-6" /> {t("nav.categories")}
          </h1>
          <p className="text-muted-foreground">{t("products.all_categories")}</p>
        </div>
        {isOwnerOrAdmin && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" /> {t("products.add_category")}
          </Button>
        )}
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t("products.category")}</TableHead>
              {isOwnerOrAdmin && <TableHead className="text-right">{t("products.table_actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">{t("common.no_data")}</TableCell></TableRow>
            ) : categories.map((c, i) => (
              <TableRow key={c.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                {isOwnerOrAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("products.add_category")}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
            <label className="text-sm font-medium">{t("products.category")}</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("products.category_name_placeholder")} />
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate(name)} disabled={!name.trim() || createMutation.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCategory} onOpenChange={open => { if (!open) setEditCategory(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("common.edit")}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
            <label className="text-sm font-medium">{t("products.category")}</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={() => editCategory && updateMutation.mutate({ id: editCategory.id, name })} disabled={!name.trim() || updateMutation.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
