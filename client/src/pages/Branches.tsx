import { useState } from "react";
import { Plus, Edit2, Trash2, GitBranch, Phone, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Branch } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

export default function Branches() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { data } = useAuth();
  const user = data?.user;
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  const [formOpen, setFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "", phone: "", isMain: false });
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const body = {
        name: payload.name.trim(),
        address: payload.address.trim() || null,
        phone: payload.phone.trim() || null,
        isMain: payload.isMain,
      };
      if (editingBranch) {
        return (await apiRequest("PATCH", `/api/branches/${editingBranch.id}`, body)).json();
      }
      return (await apiRequest("POST", "/api/branches", body)).json();
    },
    onSuccess: () => {
      toast({ title: t("common.saved") });
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setFormOpen(false);
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await apiRequest("DELETE", `/api/branches/${id}`)).json();
    },
    onSuccess: () => {
      toast({ title: "تم حذف الفرع بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setDeletingBranch(null);
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  function openAdd() {
    setEditingBranch(null);
    setFormData({ name: "", address: "", phone: "", isMain: false });
    setFormOpen(true);
  }

  function openEdit(b: Branch) {
    setEditingBranch(b);
    setFormData({
      name: b.name,
      address: b.address || "",
      phone: b.phone || "",
      isMain: b.isMain ?? false,
    });
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="w-6 h-6" /> الفروع
          </h1>
          <p className="text-muted-foreground">إدارة الفروع والمواقع</p>
        </div>
        {isOwnerOrAdmin && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" /> إضافة فرع
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>اسم الفرع</TableHead>
              <TableHead><MapPin className="w-3 h-3 inline ms-1" />عنوان الفرع</TableHead>
              <TableHead><Phone className="w-3 h-3 inline ms-1" />هاتف الفرع</TableHead>
              <TableHead className="w-20">النوع</TableHead>
              {isOwnerOrAdmin && <TableHead className="text-start w-16">الإجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>لا توجد فروع مضافة</p>
                </TableCell>
              </TableRow>
            ) : branches.map((b, i) => (
              <TableRow key={b.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="text-sm">{b.address || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm font-mono">{b.phone || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {b.isMain
                    ? <Badge className="gap-1 bg-primary/10 text-primary border-primary/30"><Star className="w-3 h-3" />رئيسي</Badge>
                    : <Badge variant="outline" className="text-xs">فرع</Badge>
                  }
                </TableCell>
                {isOwnerOrAdmin && (
                  <TableCell className="text-start">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="تعديل" onClick={() => openEdit(b)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" title="حذف" onClick={() => setDeletingBranch(b)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deletingBranch} onOpenChange={open => { if (!open) setDeletingBranch(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> حذف الفرع
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف <strong>{deletingBranch?.name}</strong>؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingBranch(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={() => deletingBranch && deleteMutation.mutate(deletingBranch.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={open => { if (!open) setFormOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              {editingBranch ? "تعديل الفرع" : "إضافة فرع جديد"}
            </DialogTitle>
            <DialogDescription>أدخل بيانات الفرع ثم اضغط حفظ</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">اسم الفرع <span className="text-destructive">*</span></label>
              <Input
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="مثال: لمسة أنوثة - شناص"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3" /> عنوان الفرع
              </label>
              <Input
                value={formData.address}
                onChange={e => setFormData(f => ({ ...f, address: e.target.value }))}
                placeholder="المدينة / المنطقة / الشارع"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-1">
                <Phone className="w-3 h-3" /> هاتف الفرع
              </label>
              <Input
                value={formData.phone}
                onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                placeholder="+968 XXXX XXXX"
                type="tel"
                dir="ltr"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Star className="w-3 h-3 text-primary" /> نوع الفرع
                </label>
                <p className="text-xs text-muted-foreground">
                  {formData.isMain ? "مركز رئيسي — يظهر كأساس للنظام" : "فرع عادي"}
                </p>
              </div>
              <Switch
                checked={formData.isMain}
                onCheckedChange={val => setFormData(f => ({ ...f, isMain: val }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "جاري الحفظ..." : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
