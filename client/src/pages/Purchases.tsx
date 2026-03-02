import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, FileCheck, Package, Truck, Ship, FileText, AlertTriangle, Search, Edit, Building, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Branch, Supplier, Product, PurchaseInvoice } from "@shared/schema";

function omr(val: string | number | null) {
  if (val === null || val === undefined) return "0.000";
  return parseFloat(String(val)).toFixed(3);
}

function SuppliersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formTaxNo, setFormTaxNo] = useState("");
  const [formCrNo, setFormCrNo] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const filtered = suppliers.filter(s =>
    !search || s.name.includes(search) || (s.phone && s.phone.includes(search)) || (s.city && s.city.includes(search))
  );

  function resetForm() {
    setFormName(""); setFormPhone(""); setFormEmail("");
    setFormAddress(""); setFormCity("");
    setFormTaxNo(""); setFormCrNo(""); setFormNotes("");
    setEditId(null);
  }

  function openEdit(s: Supplier) {
    setEditId(s.id);
    setFormName(s.name);
    setFormPhone(s.phone || "");
    setFormEmail(s.email || "");
    setFormAddress(s.address || "");
    setFormCity(s.city || "");
    setFormTaxNo(s.taxNo || "");
    setFormCrNo(s.crNo || "");
    setFormNotes(s.notes || "");
    setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        name: formName.trim(),
        phone: formPhone || null,
        email: formEmail || null,
        address: formAddress || null,
        city: formCity || null,
        taxNo: formTaxNo || null,
        crNo: formCrNo || null,
        notes: formNotes || null,
      };
      if (editId) {
        const res = await apiRequest("PATCH", `/api/suppliers/${editId}`, body);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/suppliers", body);
        return res.json();
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setShowForm(false);
      resetForm();
      toast({ title: editId ? "تم تحديث المورد" : "تمت إضافة المورد" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const supplier = suppliers.find(s => s.id === id);
      const res = await apiRequest("PATCH", `/api/suppliers/${id}`, { active: !supplier?.active });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "تم تحديث الحالة" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الهاتف أو المدينة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9"
            data-testid="input-supplier-search"
          />
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-new-supplier">
          <Plus className="w-4 h-4" /> إضافة مورد
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>المدينة</TableHead>
                <TableHead>الرقم الضريبي</TableHead>
                <TableHead>السجل التجاري</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {search ? "لا توجد نتائج" : "لا يوجد موردون"}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(s => (
                <TableRow key={s.id} data-testid={`row-supplier-${s.id}`}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="font-mono text-sm">{s.phone || "—"}</TableCell>
                  <TableCell className="text-sm">{s.email || "—"}</TableCell>
                  <TableCell>{s.city || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{s.taxNo || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{s.crNo || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={s.active ? "default" : "outline"}
                      className={`cursor-pointer ${s.active ? "bg-green-600" : "border-red-400 text-red-500"}`}
                      onClick={() => toggleActiveMutation.mutate(s.id)}
                      data-testid={`badge-supplier-active-${s.id}`}
                    >
                      {s.active ? "نشط" : "معطل"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)} data-testid={`button-edit-supplier-${s.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); resetForm(); } }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" /> {editId ? "تعديل المورد" : "إضافة مورد جديد"}
            </DialogTitle>
            <DialogDescription>{editId ? "عدّل بيانات المورد" : "أدخل بيانات المورد الجديد"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">اسم المورد *</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="اسم المورد (فريد)" data-testid="input-supplier-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">الهاتف</label>
                <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+968..." data-testid="input-supplier-phone" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">البريد الإلكتروني</label>
                <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@example.com" data-testid="input-supplier-email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">المدينة</label>
                <Input value={formCity} onChange={e => setFormCity(e.target.value)} placeholder="مسقط" data-testid="input-supplier-city" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">العنوان</label>
                <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="العنوان" data-testid="input-supplier-address" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">الرقم الضريبي</label>
                <Input value={formTaxNo} onChange={e => setFormTaxNo(e.target.value)} data-testid="input-supplier-taxno" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">رقم السجل التجاري</label>
                <Input value={formCrNo} onChange={e => setFormCrNo(e.target.value)} data-testid="input-supplier-crno" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ملاحظات</label>
              <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="ملاحظات..." data-testid="input-supplier-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>إلغاء</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!formName.trim() || saveMutation.isPending} data-testid="button-save-supplier">
              {editId ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchasesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";

  const [showCreate, setShowCreate] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);

  const [newSupplierId, setNewSupplierId] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newShipping, setNewShipping] = useState("0");
  const [newCustoms, setNewCustoms] = useState("0");
  const [newClearance, setNewClearance] = useState("0");
  const [newOther, setNewOther] = useState("0");
  const [newNotes, setNewNotes] = useState("");

  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addUnitCost, setAddUnitCost] = useState("");

  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");

  const { data: invoices = [] } = useQuery<PurchaseInvoice[]>({
    queryKey: ["/api/purchases"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allSuppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: activeSuppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers", "activeOnly"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers?activeOnly=true", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: invoiceDetail } = useQuery<any>({
    queryKey: ["/api/purchases", selectedInvoice],
    queryFn: async () => {
      const res = await fetch(`/api/purchases/${selectedInvoice}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!selectedInvoice,
  });

  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]));
  const supplierMap = Object.fromEntries(allSuppliers.map(s => [s.id, s.name]));
  const productMap = Object.fromEntries(allProducts.map(p => [p.id, p.name]));

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/purchases", {
        supplierId: Number(newSupplierId),
        branchId: Number(newBranchId),
        invoiceDate: newDate,
        shippingCost: Number(newShipping) || 0,
        customsCost: Number(newCustoms) || 0,
        clearanceCost: Number(newClearance) || 0,
        otherCost: Number(newOther) || 0,
        notes: newNotes || null,
      });
      return res.json();
    },
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["/api/purchases"] });
      setShowCreate(false);
      setSelectedInvoice(inv.id);
      toast({ title: "تم إنشاء فاتورة المشتريات" });
      setNewSupplierId(""); setNewBranchId(""); setNewNotes("");
      setNewShipping("0"); setNewCustoms("0"); setNewClearance("0"); setNewOther("0");
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const quickSupplierMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/suppliers", {
        name: quickName.trim(),
        phone: quickPhone || null,
      });
      return res.json();
    },
    onSuccess: (newSupplier: Supplier) => {
      qc.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setNewSupplierId(String(newSupplier.id));
      setShowQuickSupplier(false);
      setQuickName(""); setQuickPhone("");
      toast({ title: "تمت إضافة المورد واختياره" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchases/${selectedInvoice}/items`, {
        productId: Number(addProductId),
        qty: Number(addQty),
        unitCostBase: Number(addUnitCost),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
      setAddProductId(""); setAddQty(""); setAddUnitCost("");
      toast({ title: "تمت إضافة الصنف" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/purchases/${selectedInvoice}/items/${itemId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
      toast({ title: "تم حذف الصنف" });
    },
  });

  const updateCostsMutation = useMutation({
    mutationFn: async (costs: any) => {
      const res = await apiRequest("PATCH", `/api/purchases/${selectedInvoice}`, costs);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
      qc.invalidateQueries({ queryKey: ["/api/purchases"] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchase-invoices/${selectedInvoice}/approve`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchases"] });
      qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setShowPostConfirm(false);
      toast({ title: "تم اعتماد الفاتورة بنجاح", description: "تم تحديث تكلفة المنتجات والمخزون" });
    },
    onError: (e: Error) => {
      setShowPostConfirm(false);
      toast({ title: "فشل الاعتماد", description: e.message, variant: "destructive" });
    },
  });

  const items = invoiceDetail?.items || [];
  const isPending = invoiceDetail?.status === "pending";
  const statusLabel = invoiceDetail?.status === "pending" ? "مسودة" : invoiceDetail?.status === "approved" ? "معتمدة" : "ملغاة";
  const itemsSubtotal = items.reduce((s: number, it: any) => s + parseFloat(it.lineSubtotal || "0"), 0);
  const extraTotal = invoiceDetail
    ? parseFloat(invoiceDetail.shippingCost || "0") + parseFloat(invoiceDetail.customsCost || "0") +
      parseFloat(invoiceDetail.clearanceCost || "0") + parseFloat(invoiceDetail.otherCost || "0")
    : 0;

  if (selectedInvoice && invoiceDetail) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-purchase-detail-title">
              فاتورة مشتريات #{invoiceDetail.invoiceNumber}
            </h1>
            <p className="text-muted-foreground mt-1">
              {supplierMap[invoiceDetail.supplierId] || "—"} | {branchMap[invoiceDetail.branchId] || ""} | {invoiceDetail.invoiceDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isPending ? "outline" : "default"} className={isPending ? "border-amber-400 text-amber-600" : invoiceDetail?.status === "approved" ? "bg-green-600" : "bg-red-500"}>
              {statusLabel}
            </Badge>
            <Button variant="outline" onClick={() => setSelectedInvoice(null)} data-testid="button-back-to-list">رجوع</Button>
          </div>
        </div>

        {isPending && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة صنف</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1 min-w-[200px] flex-1">
                  <label className="text-sm font-medium">المنتج</label>
                  <Select value={addProductId} onValueChange={setAddProductId}>
                    <SelectTrigger data-testid="select-add-product"><SelectValue placeholder="اختر منتج..." /></SelectTrigger>
                    <SelectContent>
                      {allProducts.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name} ({omr(p.price)} OMR)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 w-28">
                  <label className="text-sm font-medium">الكمية</label>
                  <Input type="number" min="1" value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="0" data-testid="input-add-qty" />
                </div>
                <div className="space-y-1 w-36">
                  <label className="text-sm font-medium">سعر التكلفة</label>
                  <Input type="number" step="0.001" min="0" value={addUnitCost} onChange={e => setAddUnitCost(e.target.value)} placeholder="0.000" data-testid="input-add-unit-cost" />
                </div>
                <Button onClick={() => addItemMutation.mutate()} disabled={!addProductId || !addQty || !addUnitCost || addItemMutation.isPending} data-testid="button-add-item">
                  <Plus className="w-4 h-4 ml-1" /> إضافة
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> الأصناف ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>سعر الوحدة</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  {!isPending && <TableHead>التكلفة الإضافية</TableHead>}
                  {!isPending && <TableHead>التكلفة النهائية/وحدة</TableHead>}
                  {isPending && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isPending ? 5 : 6} className="text-center text-muted-foreground py-8">
                      لا توجد أصناف
                    </TableCell>
                  </TableRow>
                )}
                {items.map((it: any) => (
                  <TableRow key={it.id} data-testid={`row-purchase-item-${it.id}`}>
                    <TableCell>{it.productName || productMap[it.productId] || it.productId}</TableCell>
                    <TableCell className="font-mono">{it.qty}</TableCell>
                    <TableCell className="font-mono">{omr(it.unitCostBase)}</TableCell>
                    <TableCell className="font-mono">{omr(it.lineSubtotal)}</TableCell>
                    {!isPending && <TableCell className="font-mono text-amber-600">{omr(it.allocatedExtraCost)}</TableCell>}
                    {!isPending && <TableCell className="font-mono font-bold text-emerald-600">{omr(it.unitCostFinal)}</TableCell>}
                    {isPending && (
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => deleteItemMutation.mutate(it.id)} data-testid={`button-delete-item-${it.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold bg-muted/30">
                  <TableCell>المجموع</TableCell>
                  <TableCell className="font-mono">{items.reduce((s: number, it: any) => s + it.qty, 0)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="font-mono">{omr(itemsSubtotal)}</TableCell>
                  {!isPending && <TableCell className="font-mono text-amber-600">{omr(extraTotal)}</TableCell>}
                  {!isPending && <TableCell></TableCell>}
                  {isPending && <TableCell></TableCell>}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Ship className="w-4 h-4" /> التكاليف الإضافية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1"><Truck className="w-3 h-3" /> شحن</label>
                <Input type="number" step="0.001" value={invoiceDetail.shippingCost || "0"} disabled={!isPending}
                  onChange={e => updateCostsMutation.mutate({ shippingCost: Number(e.target.value) })}
                  data-testid="input-shipping-cost" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">جمارك</label>
                <Input type="number" step="0.001" value={invoiceDetail.customsCost || "0"} disabled={!isPending}
                  onChange={e => updateCostsMutation.mutate({ customsCost: Number(e.target.value) })}
                  data-testid="input-customs-cost" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">تخليص</label>
                <Input type="number" step="0.001" value={invoiceDetail.clearanceCost || "0"} disabled={!isPending}
                  onChange={e => updateCostsMutation.mutate({ clearanceCost: Number(e.target.value) })}
                  data-testid="input-clearance-cost" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">أخرى</label>
                <Input type="number" step="0.001" value={invoiceDetail.otherCost || "0"} disabled={!isPending}
                  onChange={e => updateCostsMutation.mutate({ otherCost: Number(e.target.value) })}
                  data-testid="input-other-cost" />
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg border flex flex-wrap gap-6">
              <div>
                <span className="text-xs text-muted-foreground">إجمالي الأصناف</span>
                <p className="font-bold font-mono">{omr(itemsSubtotal)} OMR</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">إجمالي التكاليف الإضافية</span>
                <p className="font-bold font-mono text-amber-600">{omr(extraTotal)} OMR</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">الإجمالي الكلي</span>
                <p className="font-bold font-mono text-lg text-emerald-700">{omr(itemsSubtotal + extraTotal)} OMR</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isPending && items.length > 0 && canManage && (
          <div className="flex justify-end">
            <Button size="lg" className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => setShowPostConfirm(true)} data-testid="button-approve-invoice">
              <FileCheck className="w-5 h-5" /> اعتماد الفاتورة
            </Button>
          </div>
        )}

        <Dialog open={showPostConfirm} onOpenChange={setShowPostConfirm}>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> تأكيد اعتماد الفاتورة
              </DialogTitle>
              <DialogDescription>
                سيتم توزيع التكاليف الإضافية على الأصناف وتحديث متوسط التكلفة والمخزون. لا يمكن التراجع بعد الاعتماد.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
                <p><strong>عدد الأصناف:</strong> {items.length}</p>
                <p><strong>إجمالي الأصناف:</strong> {omr(itemsSubtotal)} OMR</p>
                <p><strong>تكاليف إضافية:</strong> {omr(extraTotal)} OMR</p>
                <p className="border-t pt-2"><strong>الإجمالي الكلي:</strong> <span className="text-lg font-bold text-emerald-700">{omr(itemsSubtotal + extraTotal)} OMR</span></p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800">
                <p className="font-medium">التوزيع المتوقع:</p>
                {items.map((it: any) => {
                  const lineVal = parseFloat(it.lineSubtotal || "0");
                  const ratio = itemsSubtotal > 0 ? lineVal / itemsSubtotal : 0;
                  const allocated = extraTotal * ratio;
                  const finalUnit = it.qty > 0 ? (lineVal + allocated) / it.qty : 0;
                  return (
                    <div key={it.id} className="flex justify-between text-xs mt-1">
                      <span>{it.productName || productMap[it.productId]}: {it.qty} x {omr(finalUnit)}</span>
                      <span className="text-amber-600">+{omr(allocated)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowPostConfirm(false)}>إلغاء</Button>
              <Button className="bg-green-600 hover:bg-green-700 gap-2" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} data-testid="button-confirm-approve">
                <FileCheck className="w-4 h-4" /> تأكيد الاعتماد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button className="gap-2" onClick={() => setShowCreate(true)} data-testid="button-new-purchase">
          <Plus className="w-4 h-4" /> فاتورة مشتريات جديدة
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد فواتير مشتريات</TableCell>
                </TableRow>
              )}
              {invoices.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedInvoice(inv.id)} data-testid={`row-purchase-${inv.id}`}>
                  <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
                  <TableCell>{supplierMap[inv.supplierId] || "—"}</TableCell>
                  <TableCell>{branchMap[inv.branchId] || "—"}</TableCell>
                  <TableCell>{inv.invoiceDate}</TableCell>
                  <TableCell className="font-mono">{omr(inv.grandTotal)} OMR</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "pending" ? "outline" : "default"} className={inv.status === "pending" ? "border-amber-400 text-amber-600" : inv.status === "approved" ? "bg-green-600" : "bg-red-500"}>
                      {inv.status === "pending" ? "مسودة" : inv.status === "approved" ? "معتمدة" : "ملغاة"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> فاتورة مشتريات جديدة</DialogTitle>
            <DialogDescription>أدخل بيانات الفاتورة ثم أضف الأصناف بعد الإنشاء</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">المورد *</label>
                <div className="flex gap-1">
                  <Select value={newSupplierId} onValueChange={setNewSupplierId}>
                    <SelectTrigger data-testid="select-new-supplier" className="flex-1"><SelectValue placeholder="اختر مورد..." /></SelectTrigger>
                    <SelectContent>
                      {activeSuppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => setShowQuickSupplier(true)} title="إضافة مورد جديد" data-testid="button-quick-add-supplier">
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">الفرع *</label>
                <Select value={newBranchId} onValueChange={setNewBranchId}>
                  <SelectTrigger data-testid="select-new-branch"><SelectValue placeholder="اختر فرع..." /></SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">تاريخ الفاتورة *</label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} data-testid="input-new-date" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">شحن</label>
                <Input type="number" step="0.001" value={newShipping} onChange={e => setNewShipping(e.target.value)} data-testid="input-new-shipping" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">جمارك</label>
                <Input type="number" step="0.001" value={newCustoms} onChange={e => setNewCustoms(e.target.value)} data-testid="input-new-customs" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">تخليص</label>
                <Input type="number" step="0.001" value={newClearance} onChange={e => setNewClearance(e.target.value)} data-testid="input-new-clearance" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">أخرى</label>
                <Input type="number" step="0.001" value={newOther} onChange={e => setNewOther(e.target.value)} data-testid="input-new-other" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ملاحظات</label>
              <Input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="ملاحظات اختيارية..." data-testid="input-new-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newSupplierId || !newBranchId || !newDate || createMutation.isPending} data-testid="button-create-purchase">
              إنشاء الفاتورة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQuickSupplier} onOpenChange={setShowQuickSupplier}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> إضافة مورد سريع</DialogTitle>
            <DialogDescription>أضف مورد جديد واختره تلقائياً للفاتورة</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">اسم المورد *</label>
              <Input value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="اسم المورد" data-testid="input-quick-supplier-name" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">الهاتف</label>
              <Input value={quickPhone} onChange={e => setQuickPhone(e.target.value)} placeholder="+968..." data-testid="input-quick-supplier-phone" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickSupplier(false)}>إلغاء</Button>
            <Button onClick={() => quickSupplierMutation.mutate()} disabled={!quickName.trim() || quickSupplierMutation.isPending} data-testid="button-save-quick-supplier">
              إضافة واختيار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Purchases() {
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-lg">ليس لديك صلاحية للوصول لهذه الصفحة</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-purchases-title">الموردون والمشتريات</h1>
        <p className="text-muted-foreground mt-1">إدارة الموردين وفواتير المشتريات ومتوسط التكلفة (Average Cost)</p>
      </div>

      <Tabs defaultValue="purchases" dir="rtl">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="purchases" data-testid="tab-purchases">فواتير المشتريات</TabsTrigger>
          <TabsTrigger value="suppliers" data-testid="tab-suppliers">الموردون</TabsTrigger>
        </TabsList>
        <TabsContent value="purchases" className="mt-4">
          <PurchasesTab />
        </TabsContent>
        <TabsContent value="suppliers" className="mt-4">
          <SuppliersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
