import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Customer, Branch } from "@shared/schema";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Users, UserPlus, Search, Phone, Eye, Edit2, Trash2,
  FileText, MessageSquare, Loader2, ShoppingBag, MoreVertical,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type KpiData = {
  totalCustomers: number; activeCustomers: number; newThisMonth: number; totalPurchases: number;
  topCustomer: { name: string; total_spent: string } | null;
};
type CustomerDetail = Customer & {
  invoices: any[]; returns: any[]; topBranch: string | null;
  returnsTotal: number; returnsCount: number; avgInvoice: number;
};

export default function MobileCustomers() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.role === "owner" || user?.role === "admin";

  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [addForm, setAddForm] = useState({ name: "", phone: "", notes: "" });
  const [editForm, setEditForm] = useState({ name: "", phone: "", notes: "", active: true });

  const { data: kpis } = useQuery<KpiData>({
    queryKey: ["/api/customers/kpis"], queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"], queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: detail } = useQuery<CustomerDetail>({
    queryKey: [`/api/customers/${detailId}`], queryFn: getQueryFn({ on401: "throw" }), enabled: !!detailId,
  });
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "throw" }),
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/customers", data); if (!r.ok) { const b = await r.json(); throw new Error(b.message); } return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/customers"] }); queryClient.invalidateQueries({ queryKey: ["/api/customers/kpis"] }); setIsAddOpen(false); setAddForm({ name: "", phone: "", notes: "" }); toast({ title: t("customers.customer_created") }); },
    onError: (e: Error) => { toast({ title: e.message === "phone_exists" ? t("customers.phone_exists") : e.message, variant: "destructive" }); },
  });
  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => { const r = await apiRequest("PUT", `/api/customers/${id}`, data); if (!r.ok) { const b = await r.json(); throw new Error(b.message); } return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/customers"] }); queryClient.invalidateQueries({ queryKey: ["/api/customers/kpis"] }); if (detailId) queryClient.invalidateQueries({ queryKey: [`/api/customers/${detailId}`] }); setIsEditOpen(false); toast({ title: t("customers.customer_updated") }); },
    onError: (e: Error) => { toast({ title: e.message === "phone_exists" ? t("customers.phone_exists") : e.message, variant: "destructive" }); },
  });
  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/customers/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/customers"] }); queryClient.invalidateQueries({ queryKey: ["/api/customers/kpis"] }); setDeleteConfirm(null); setIsDetailOpen(false); toast({ title: t("customers.customer_deleted") }); },
  });

  const filtered = search
    ? customers.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
    : customers;

  const f3 = (n: any) => parseFloat(String(n || "0")).toFixed(3);
  const fD = (d: any) => d ? format(new Date(d), "yyyy-MM-dd") : "---";

  const openDetail = (id: number) => { setDetailId(id); setIsDetailOpen(true); };
  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditForm({ name: c.name || "", phone: c.phone || "", notes: (c as any).notes || "", active: c.active !== false });
    setIsEditOpen(true);
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 pb-24 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">{t("customers.page_title")}</h2>
          <Badge variant="secondary">{customers.length}</Badge>
        </div>
        <Button size="sm" className="gap-1 h-10" onClick={() => setIsAddOpen(true)} data-testid="button-add-customer">
          <UserPlus className="w-4 h-4" />{t("customers.add_customer")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3 text-center">
          <p className="text-lg font-bold text-primary">{kpis?.totalCustomers || 0}</p>
          <p className="text-[10px] text-muted-foreground">{t("customers.kpi_total")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-lg font-bold text-emerald-600">{kpis?.newThisMonth || 0}</p>
          <p className="text-[10px] text-muted-foreground">{t("customers.kpi_new")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-lg font-bold">{f3(kpis?.totalPurchases)}</p>
          <p className="text-[10px] text-muted-foreground">{t("customers.kpi_purchases")}</p>
        </CardContent></Card>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t("customers.search_placeholder")} value={search} onChange={e => setSearch(e.target.value)}
          className="pr-10 h-12 text-base" data-testid="input-search" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{t("customers.no_customers")}</p>
          </div>
        ) : (
          filtered.map(c => (
            <Card key={c.id} className="active:scale-[0.98] transition-transform" data-testid={`card-customer-${c.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0" onClick={() => openDetail(c.id)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-base truncate">{c.name || t("customers.no_data")}</span>
                      {c.active === false && <Badge variant="secondary" className="text-[10px] shrink-0">{t("customers.inactive")}</Badge>}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2" dir="ltr">
                      <Phone className="w-3 h-3" />
                      <span className="font-mono">{c.phone || "---"}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        <strong className="text-foreground">{f3(c.totalSpent)}</strong>
                      </span>
                      <span>{t("customers.visits")}: {c.visits || 0}</span>
                      <span>{t("customers.last_visit")}: {fD(c.lastVisit)}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0"><MoreVertical className="w-5 h-5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openDetail(c.id)}><Eye className="w-4 h-4 ml-2" />{t("customers.view_details")}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(c)}><Edit2 className="w-4 h-4 ml-2" />{t("customers.edit")}</DropdownMenuItem>
                      {c.phone && <DropdownMenuItem onClick={() => window.open(`https://wa.me/${c.phone?.startsWith("968") ? c.phone : `968${c.phone}`}`, "_blank")}><MessageSquare className="w-4 h-4 ml-2" />{t("customers.whatsapp")}</DropdownMenuItem>}
                      {isOwner && <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm(c.id)}><Trash2 className="w-4 h-4 ml-2" />{t("customers.delete")}</DropdownMenuItem>
                      </>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-4">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Eye className="w-4 h-4" />{t("customers.customer_detail")}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="text-center pb-3 border-b">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2"><Users className="w-7 h-7 text-primary" /></div>
                <h3 className="font-bold text-lg">{detail.name || "---"}</h3>
                <p className="text-sm text-muted-foreground font-mono" dir="ltr">{detail.phone || "---"}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Card><CardContent className="p-3 text-center"><p className="text-base font-bold text-primary">{f3(detail.totalSpent)}</p><p className="text-[10px] text-muted-foreground">{t("customers.total_spent")}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-base font-bold">{detail.invoiceCount || detail.invoices?.length || 0}</p><p className="text-[10px] text-muted-foreground">{t("customers.invoice_count")}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-base font-bold">{f3(detail.avgInvoice)}</p><p className="text-[10px] text-muted-foreground">{t("customers.avg_invoice")}</p></CardContent></Card>
                <Card><CardContent className="p-3 text-center"><p className="text-base font-bold text-red-600">{detail.returnsCount || 0}</p><p className="text-[10px] text-muted-foreground">{t("customers.returns_count")}</p></CardContent></Card>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-10 gap-1" onClick={() => { setIsDetailOpen(false); openEdit(detail); }}><Edit2 className="w-3 h-3" />{t("customers.edit")}</Button>
                {detail.phone && (
                  <Button variant="outline" size="sm" className="flex-1 h-10 gap-1" onClick={() => window.open(`https://wa.me/${detail.phone?.startsWith("968") ? detail.phone : `968${detail.phone}`}`, "_blank")}>
                    <MessageSquare className="w-3 h-3" />{t("customers.whatsapp")}
                  </Button>
                )}
              </div>

              {detail.invoices && detail.invoices.length > 0 && (
                <div>
                  <p className="font-semibold text-sm mb-2">{t("customers.invoices_list")}</p>
                  <div className="space-y-2">
                    {detail.invoices.slice(0, 10).map((inv: any) => (
                      <Card key={inv.id} data-testid={`card-detail-invoice-${inv.id}`}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-sm">#{inv.invoice_number}</span>
                            <p className="text-xs text-muted-foreground">{fD(inv.created_at)} - {inv.branch_name}</p>
                          </div>
                          <div className="text-left">
                            <span className="font-bold text-primary">{f3(inv.total)}</span>
                            <p className="text-xs text-muted-foreground">
                              {inv.payment_method === "cash" ? t("customers.cash") : inv.payment_method === "card" ? t("customers.card") : t("customers.bank_transfer")}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {detail.returns && detail.returns.length > 0 && (
                <div>
                  <p className="font-semibold text-sm mb-2 text-red-600">{t("customers.returns")}</p>
                  {detail.returns.map((r: any) => (
                    <Card key={r.id} className="border-red-200">
                      <CardContent className="p-3 flex justify-between items-center">
                        <div>
                          <span className="font-mono text-sm">#{r.invoice_number}</span>
                          <p className="text-xs text-muted-foreground">{fD(r.created_at)}</p>
                        </div>
                        <span className="font-bold text-red-600">-{f3(r.refund_amount)}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="p-4">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><UserPlus className="w-4 h-4" />{t("customers.add_customer")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("customers.name")} *</Label><Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} className="h-12 text-base" data-testid="input-add-name" /></div>
            <div><Label>{t("customers.phone")} *</Label><Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" className="h-12 text-base text-right" data-testid="input-add-phone" inputMode="tel" /></div>
            <div><Label>{t("customers.notes")}</Label><Textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-base" /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="h-12">{t("common.cancel")}</Button>
            <Button className="h-12" onClick={() => {
              if (!addForm.name.trim()) { toast({ title: t("customers.name_required"), variant: "destructive" }); return; }
              if (!addForm.phone.trim()) { toast({ title: t("customers.phone_required"), variant: "destructive" }); return; }
              createMut.mutate({ name: addForm.name.trim(), phone: addForm.phone.trim(), notes: addForm.notes || undefined, active: true });
            }} disabled={createMut.isPending} data-testid="button-submit-add">{createMut.isPending ? t("common.saving") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="p-4">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Edit2 className="w-4 h-4" />{t("customers.edit_customer")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("customers.name")} *</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-12 text-base" /></div>
            <div><Label>{t("customers.phone")} *</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" className="h-12 text-base text-right" inputMode="tel" /></div>
            <div><Label>{t("customers.notes")}</Label><Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-base" /></div>
            <div className="flex items-center gap-3">
              <Label>{t("customers.status")}</Label>
              <Badge variant={editForm.active ? "default" : "secondary"} className="cursor-pointer text-sm px-4 py-1" onClick={() => setEditForm(f => ({ ...f, active: !f.active }))}>
                {editForm.active ? t("customers.active") : t("customers.inactive")}
              </Badge>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="h-12">{t("common.cancel")}</Button>
            <Button className="h-12" onClick={() => {
              if (!editForm.name.trim() || !editForm.phone.trim()) { toast({ title: t("customers.name_required"), variant: "destructive" }); return; }
              updateMut.mutate({ id: editingCustomer!.id, data: { name: editForm.name.trim(), phone: editForm.phone.trim(), notes: editForm.notes || undefined, active: editForm.active } });
            }} disabled={updateMut.isPending}>{updateMut.isPending ? t("common.saving") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="p-4">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2"><Trash2 className="w-4 h-4" />{t("customers.confirm_delete")}</DialogTitle>
            <DialogDescription>{t("customers.confirm_delete_desc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="h-12">{t("common.cancel")}</Button>
            <Button variant="destructive" className="h-12" onClick={() => deleteConfirm && deleteMut.mutate(deleteConfirm)} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? t("common.saving") : t("customers.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
