import { useState } from "react";
import { Plus, Search, Truck, Eye, Edit2, Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Supplier } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "@/lib/formatters";

const EMPTY_FORM = {
  name: "", phone: "", whatsapp: "", email: "",
  address: "", city: "", taxNo: "", crNo: "", notes: "", active: true,
};

export default function Suppliers() {
  const { t } = useI18n();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState("info");

  // ── queries ───────────────────────────────────────────────────────────
  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: detailStatement } = useQuery<any>({
    queryKey: [`/api/suppliers/${detailId}/statement`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!detailId && detailTab === "statement",
  });

  const { data: detailSupplier } = useQuery<any>({
    queryKey: [`/api/suppliers/${detailId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!detailId,
  });

  // ── filtered list ─────────────────────────────────────────────────────
  const filtered = suppliers.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.whatsapp?.includes(q);
  });

  // ── mutations ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingSupplier) {
        return (await apiRequest("PATCH", `/api/suppliers/${editingSupplier.id}`, data)).json();
      }
      return (await apiRequest("POST", "/api/suppliers", data)).json();
    },
    onSuccess: () => {
      toast({ title: editingSupplier ? t("suppliers_page.updated_success") : t("suppliers_page.added_success") });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setFormOpen(false);
    },
    onError: (e: Error) => {
      const msg = e.message.includes("يوجد مورد") || e.message.includes("already exists")
        ? t("suppliers_page.name_duplicate")
        : e.message;
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    },
  });

  // ── helpers ───────────────────────────────────────────────────────────
  function openAdd() {
    setEditingSupplier(null);
    setFormData({ ...EMPTY_FORM });
    setFormOpen(true);
  }

  function openEdit(s: any) {
    setEditingSupplier(s);
    setFormData({
      name: s.name || "", phone: s.phone || "", whatsapp: s.whatsapp || "",
      email: s.email || "", address: s.address || "", city: s.city || "",
      taxNo: s.taxNo || "", crNo: s.crNo || "", notes: s.notes || "",
      active: s.active ?? true,
    });
    setFormOpen(true);
  }

  function openDetail(id: number) {
    setDetailId(id);
    setDetailTab("info");
  }

  function set(field: string, value: any) {
    setFormData(f => ({ ...f, [field]: value }));
  }

  const isSaving = saveMutation.isPending;

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="w-6 h-6" /> {t("suppliers_page.title")}
          </h1>
          <p className="text-muted-foreground">{t("suppliers_page.subtitle")}</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" /> {t("suppliers_page.add_supplier")}
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-3 bg-card border rounded-lg p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("suppliers_page.search_placeholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("suppliers_page.col_name")}</TableHead>
              <TableHead>{t("suppliers_page.col_phone")}</TableHead>
              <TableHead>{t("suppliers_page.col_whatsapp")}</TableHead>
              <TableHead>{t("suppliers_page.col_email")}</TableHead>
              <TableHead>{t("suppliers_page.col_total_purchases")}</TableHead>
              <TableHead>{t("suppliers_page.col_last_purchase")}</TableHead>
              <TableHead>{t("suppliers_page.col_status")}</TableHead>
              <TableHead className="text-right">{t("products.table_actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="py-12 text-center text-muted-foreground space-y-3">
                    <Truck className="w-10 h-10 mx-auto opacity-30" />
                    <p>{t("common.no_data")}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.map(s => (
              <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-sm">{s.phone || "—"}</TableCell>
                <TableCell className="text-sm">
                  {s.whatsapp ? (
                    <a
                      href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-green-600 hover:underline"
                    >
                      <MessageCircle className="w-3 h-3" /> {s.whatsapp}
                    </a>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-sm">{s.email || "—"}</TableCell>
                <TableCell className="font-mono text-sm">
                  {parseFloat(s.totalPurchases || "0").toFixed(3)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {fmtDate(s.lastPurchaseDate)}
                </TableCell>
                <TableCell>
                  <Badge variant={s.active ? "default" : "secondary"}>
                    {s.active ? t("suppliers_page.active") : t("suppliers_page.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(s.id)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={open => { if (!open) setFormOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? t("suppliers_page.edit_supplier") : t("suppliers_page.add_supplier")}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Name — full width */}
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium">{t("suppliers_page.field_name")} *</label>
              <Input value={formData.name} onChange={e => set("name", e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Phone className="w-3 h-3" /> {t("suppliers_page.field_phone")}
              </label>
              <Input value={formData.phone} onChange={e => set("phone", e.target.value)} dir="ltr" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <MessageCircle className="w-3 h-3 text-green-600" /> {t("suppliers_page.field_whatsapp")}
              </label>
              <Input value={formData.whatsapp} onChange={e => set("whatsapp", e.target.value)} dir="ltr" placeholder="+968..." />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Mail className="w-3 h-3" /> {t("suppliers_page.field_email")}
              </label>
              <Input type="email" value={formData.email} onChange={e => set("email", e.target.value)} dir="ltr" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("suppliers_page.field_city")}</label>
              <Input value={formData.city} onChange={e => set("city", e.target.value)} />
            </div>

            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {t("suppliers_page.field_address")}
              </label>
              <Input value={formData.address} onChange={e => set("address", e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("suppliers_page.field_tax_no")}</label>
              <Input value={formData.taxNo} onChange={e => set("taxNo", e.target.value)} dir="ltr" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("suppliers_page.field_cr_no")}</label>
              <Input value={formData.crNo} onChange={e => set("crNo", e.target.value)} dir="ltr" />
            </div>

            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium">{t("suppliers_page.field_notes")}</label>
              <Textarea rows={3} value={formData.notes} onChange={e => set("notes", e.target.value)} />
            </div>

            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <label className="text-sm font-medium">{t("suppliers_page.field_status")}</label>
                <p className={`text-xs font-medium mt-0.5 ${formData.active ? "text-green-600" : "text-muted-foreground"}`}>
                  {formData.active ? t("suppliers_page.active") : t("suppliers_page.inactive")}
                </p>
              </div>
              <Switch checked={formData.active} onCheckedChange={v => set("active", v)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={isSaving || !formData.name.trim()}
            >
              {isSaving ? "..." : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail View ───────────────────────────────────────────────── */}
      <Dialog open={!!detailId} onOpenChange={open => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              {detailSupplier?.name || "…"}
            </DialogTitle>
          </DialogHeader>

          {detailSupplier && (
            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList>
                <TabsTrigger value="info">{t("suppliers_page.tab_info")}</TabsTrigger>
                <TabsTrigger value="statement">{t("suppliers_page.tab_statement")}</TabsTrigger>
              </TabsList>

              {/* Info tab */}
              <TabsContent value="info" className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {detailSupplier.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{detailSupplier.phone}</span>
                    </div>
                  )}
                  {detailSupplier.whatsapp && (
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-green-600" />
                      <a href={`https://wa.me/${detailSupplier.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                        {detailSupplier.whatsapp}
                      </a>
                    </div>
                  )}
                  {detailSupplier.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{detailSupplier.email}</span>
                    </div>
                  )}
                  {detailSupplier.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{detailSupplier.address}{detailSupplier.city ? ` — ${detailSupplier.city}` : ""}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  {detailSupplier.taxNo && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t("suppliers_page.field_tax_no")}</p>
                      <p className="font-mono">{detailSupplier.taxNo}</p>
                    </div>
                  )}
                  {detailSupplier.crNo && (
                    <div>
                      <p className="text-xs text-muted-foreground">{t("suppliers_page.field_cr_no")}</p>
                      <p className="font-mono">{detailSupplier.crNo}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">{t("suppliers_page.total_purchases")}</p>
                    <p className="font-bold text-lg">{parseFloat(detailSupplier.totalPurchases || "0").toFixed(3)} OMR</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("suppliers_page.current_balance")}</p>
                    <p className="font-bold text-lg">{parseFloat(detailSupplier.balance || "0").toFixed(3)} OMR</p>
                  </div>
                </div>

                {detailSupplier.notes && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1">{t("suppliers_page.field_notes")}</p>
                    <p className="text-sm bg-muted rounded p-3">{detailSupplier.notes}</p>
                  </div>
                )}
              </TabsContent>

              {/* Statement tab */}
              <TabsContent value="statement" className="pt-4">
                {!detailStatement ? (
                  <p className="text-center py-8 text-muted-foreground">…</p>
                ) : detailStatement.items?.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{t("suppliers_page.no_purchases")}</p>
                ) : (
                  <>
                    <div className="flex gap-6 mb-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t("suppliers_page.total_purchases")}: </span>
                        <span className="font-bold">{detailStatement.totalPurchases?.toFixed(3)} OMR</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("suppliers_page.current_balance")}: </span>
                        <span className="font-bold">{detailStatement.currentBalance?.toFixed(3)} OMR</span>
                      </div>
                    </div>
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>{t("suppliers_page.invoice_no")}</TableHead>
                          <TableHead>{t("suppliers_page.invoice_date")}</TableHead>
                          <TableHead>{t("suppliers_page.invoice_branch")}</TableHead>
                          <TableHead>{t("suppliers_page.invoice_total")}</TableHead>
                          <TableHead>{t("suppliers_page.running_balance")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailStatement.items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">{item.invoice_number}</TableCell>
                            <TableCell className="text-sm">{fmtDate(item.created_at)}</TableCell>
                            <TableCell className="text-sm">{item.branch_name || "—"}</TableCell>
                            <TableCell className="font-medium">{item.total?.toFixed(3)}</TableCell>
                            <TableCell className="font-mono text-sm">{item.balance?.toFixed(3)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
