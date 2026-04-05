import { useState } from "react";
import { Plus, Edit2, GitBranch, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  const [formData, setFormData] = useState({ name: "", address: "", phone: "" });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingBranch) {
        return (await apiRequest("PATCH", `/api/branches/${editingBranch.id}`, data)).json();
      }
      return (await apiRequest("POST", "/api/branches", data)).json();
    },
    onSuccess: () => {
      toast({ title: t("common.saved") });
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setFormOpen(false);
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  function openAdd() {
    setEditingBranch(null);
    setFormData({ name: "", address: "", phone: "" });
    setFormOpen(true);
  }

  function openEdit(b: Branch) {
    setEditingBranch(b);
    setFormData({ name: b.name, address: (b as any).address || "", phone: (b as any).phone || "" });
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="w-6 h-6" /> {t("nav.branches")}
          </h1>
          <p className="text-muted-foreground">{t("settings.branches_desc") || "إدارة الفروع والمواقع"}</p>
        </div>
        {isOwnerOrAdmin && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" /> {t("common.add")}
          </Button>
        )}
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t("settings.branch_name") || "اسم الفرع"}</TableHead>
              <TableHead>{t("settings.branch_address") || "العنوان"}</TableHead>
              <TableHead>{t("settings.branch_phone") || "الهاتف"}</TableHead>
              {isOwnerOrAdmin && <TableHead className="text-right">{t("products.table_actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">{t("common.no_data")}</TableCell></TableRow>
            ) : branches.map((b, i) => (
              <TableRow key={b.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{(b as any).address || "—"}</TableCell>
                <TableCell>{(b as any).phone || "—"}</TableCell>
                {isOwnerOrAdmin && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Edit2 className="w-4 h-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? t("common.edit") : t("common.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("settings.branch_name") || "الاسم"}</label>
              <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("settings.branch_address") || "العنوان"}</label>
              <Input value={formData.address} onChange={e => setFormData(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("settings.branch_phone") || "الهاتف"}</label>
              <Input value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate(formData)} disabled={!formData.name.trim() || saveMutation.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
