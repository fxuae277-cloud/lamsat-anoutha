import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, FileCheck, Package, Truck, Ship, FileText, AlertTriangle, Search, Edit, Building, UserPlus, FileSpreadsheet } from "lucide-react";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";
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
import { useI18n } from "@/lib/i18n";
import type { Supplier, Product, PurchaseInvoice, ProductVariant } from "@shared/schema";

function omr(val: string | number | null) {
  if (val === null || val === undefined) return "0.000";
  return parseFloat(String(val)).toFixed(3);
}

function SuppliersTab() {
  const { t } = useI18n();
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
      toast({ title: editId ? t("purchases.supplier_updated") : t("purchases.supplier_added") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const supplier = suppliers.find(s => s.id === id);
      const res = await apiRequest("PATCH", `/api/suppliers/${id}`, { active: !supplier?.active });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: t("purchases.status_updated") });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("purchases.search_suppliers")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9"
            data-testid="input-supplier-search"
          />
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-new-supplier">
          <Plus className="w-4 h-4" /> {t("purchases.add_supplier")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("purchases.table_name")}</TableHead>
                <TableHead>{t("purchases.table_phone")}</TableHead>
                <TableHead>{t("purchases.table_email")}</TableHead>
                <TableHead>{t("purchases.table_city")}</TableHead>
                <TableHead>{t("purchases.table_tax_no")}</TableHead>
                <TableHead>{t("purchases.table_cr_no")}</TableHead>
                <TableHead>{t("purchases.table_status")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {search ? t("purchases.no_results") : t("purchases.no_suppliers")}
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
                      {s.active ? t("purchases.active") : t("purchases.disabled")}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" /> {editId ? t("purchases.edit_supplier") : t("purchases.new_supplier")}
            </DialogTitle>
            <DialogDescription>{editId ? t("purchases.edit_supplier_desc") : t("purchases.new_supplier_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("purchases.supplier_name")} *</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder={t("purchases.supplier_name_placeholder")} data-testid="input-supplier-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.phone")}</label>
                <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+968..." data-testid="input-supplier-phone" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.email")}</label>
                <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@example.com" data-testid="input-supplier-email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.city")}</label>
                <Input value={formCity} onChange={e => setFormCity(e.target.value)} data-testid="input-supplier-city" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.address")}</label>
                <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} data-testid="input-supplier-address" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.tax_no")}</label>
                <Input value={formTaxNo} onChange={e => setFormTaxNo(e.target.value)} data-testid="input-supplier-taxno" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.cr_no")}</label>
                <Input value={formCrNo} onChange={e => setFormCrNo(e.target.value)} data-testid="input-supplier-crno" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("purchases.notes")}</label>
              <Input value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder={t("purchases.notes")} data-testid="input-supplier-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!formName.trim() || saveMutation.isPending} data-testid="button-save-supplier">
              {editId ? t("purchases.update_supplier") : t("purchases.add_supplier")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchasesTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";

  const [showCreate, setShowCreate] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);
  const [showQuickProduct, setShowQuickProduct] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [showOcrReview, setShowOcrReview] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  const [newSupplierId, setNewSupplierId] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newShipping, setNewShipping] = useState("0");
  const [newCustoms, setNewCustoms] = useState("0");
  const [newClearance, setNewClearance] = useState("0");
  const [newOther, setNewOther] = useState("0");
  const [newNotes, setNewNotes] = useState("");

  const [addProductId, setAddProductId] = useState("");
  const [addVariantId, setAddVariantId] = useState<number | null>(null);
  const [addQty, setAddQty] = useState("");
  const [addUnitCost, setAddUnitCost] = useState("");

  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");

  // Quick Create Product Fields
  const [qpName, setQpName] = useState("");
  const [qpCategoryId, setQpCategoryId] = useState("");
  const [qpBarcode, setQpBarcode] = useState("");
  const [qpSku, setQpSku] = useState("");
  const [qpColor, setQpColor] = useState("");
  const [qpSize, setQpSize] = useState("");
  const [qpPrice, setQpPrice] = useState("");
  const [qpCost, setQpCost] = useState("");

  const { data: invoices = [] } = useQuery<PurchaseInvoice[]>({
    queryKey: ["/api/purchases"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allSuppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
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

  const { data: productVariants = [] } = useQuery<ProductVariant[]>({
    queryKey: ["/api/products", addProductId, "variants"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${addProductId}/variants`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!addProductId,
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

  const supplierMap = Object.fromEntries(allSuppliers.map(s => [s.id, s.name]));
  const productMap = Object.fromEntries(allProducts.map(p => [p.id, p.name]));

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/purchases", {
        supplierId: Number(newSupplierId),
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
      toast({ title: t("purchases.invoice_created") });
      setNewSupplierId(""); setNewNotes("");
      setNewShipping("0"); setNewCustoms("0"); setNewClearance("0"); setNewOther("0");
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
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
      toast({ title: t("purchases.quick_supplier_success") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchases/${selectedInvoice}/items`, {
        productId: Number(addProductId),
        variantId: addVariantId,
        qty: Number(addQty),
        unitCostBase: Number(addUnitCost),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
      setAddProductId("");
      setAddVariantId(null);
      setAddQty("");
      setAddUnitCost("");
      toast({ title: t("purchases.item_added") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const quickProductMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/variants/quick-create", {
        productName: qpName,
        categoryId: qpCategoryId ? Number(qpCategoryId) : null,
        barcode: qpBarcode,
        sku: qpSku,
        color: qpColor,
        size: qpSize,
        price: Number(qpPrice) || 0,
        costDefault: Number(qpCost) || 0,
      });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setAddProductId(String(data.product.id));
      setAddVariantId(data.variant.id);
      setAddUnitCost(String(data.variant.costDefault || 0));
      setShowQuickProduct(false);
      toast({ title: t("common.success") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/purchases/${selectedInvoice}/items/${itemId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
      toast({ title: t("purchases.item_deleted") });
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
      toast({ title: t("purchases.invoice_approved"), description: t("purchases.invoice_approved_desc") });
    },
    onError: (e: Error) => {
      setShowPostConfirm(false);
      toast({ title: t("purchases.approve_failed"), description: e.message, variant: "destructive" });
    },
  });

  async function handleOcrUpload(file: File) {
    if (!selectedInvoice) return;
    setOcrScanning(true);
    try {
      const formData = new FormData();
      formData.append("invoice", file);
      const res = await fetch("/api/ocr/invoice", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setOcrResult(data);
      setShowOcrReview(true);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setOcrScanning(false);
    }
  }

  async function importOcrLines(onlyMatched: boolean) {
    if (!ocrResult?.lines || !selectedInvoice) return;
    const linesToImport = onlyMatched ? ocrResult.lines.filter((l: any) => l.matched) : ocrResult.lines;
    let imported = 0;
    for (const line of linesToImport) {
      let variantId = line.variantId;
      let productId = line.productId;

      if (!variantId) {
        try {
          const res = await apiRequest("POST", "/api/variants/quick-create", {
            productName: line.productCode || line.description,
            barcode: null,
            sku: line.productCode || null,
            color: line.color || null,
            size: line.size || null,
            price: line.price || 0,
            costDefault: line.price || 0,
          });
          const data = await res.json();
          variantId = data.variant.id;
          productId = data.product.id;
        } catch { continue; }
      }

      try {
        await apiRequest("POST", `/api/purchases/${selectedInvoice}/items`, {
          productId,
          variantId,
          qty: line.qty,
          unitCostBase: line.price,
        });
        imported++;
      } catch {}
    }
    qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
    qc.invalidateQueries({ queryKey: ["/api/products"] });
    setShowOcrReview(false);
    setOcrResult(null);
    toast({ title: t("purchases_v2.ocr_imported"), description: `${imported} / ${linesToImport.length}` });
  }

  const items = invoiceDetail?.items || [];
  const isPending = invoiceDetail?.status === "pending";
  const statusLabel = invoiceDetail?.status === "pending" ? t("purchases.pending") : invoiceDetail?.status === "approved" ? t("purchases.approved") : t("purchases.cancelled");
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
              {t("purchases.purchase_invoice")} #{invoiceDetail.invoiceNumber}
            </h1>
            <p className="text-muted-foreground mt-1">
              {supplierMap[invoiceDetail.supplierId] || "—"} | {invoiceDetail.invoiceDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPending && (
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" data-testid="input-ocr-upload"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleOcrUpload(f); e.target.value = ""; }}
                  disabled={ocrScanning} />
                <Button variant="outline" asChild disabled={ocrScanning} data-testid="button-ocr-upload">
                  <span>
                    {ocrScanning ? (
                      <><FileText className="w-4 h-4 ml-1 animate-pulse" /> {t("purchases_v2.ocr_scanning")}</>
                    ) : (
                      <><FileText className="w-4 h-4 ml-1" /> {t("purchases_v2.ocr_upload")}</>
                    )}
                  </span>
                </Button>
              </label>
            )}
            <Badge variant={isPending ? "outline" : "default"} className={isPending ? "border-amber-400 text-amber-600" : invoiceDetail?.status === "approved" ? "bg-green-600" : "bg-red-500"}>
              {statusLabel}
            </Badge>
            <Button variant="outline" onClick={() => setSelectedInvoice(null)} data-testid="button-back-to-list">{t("purchases.back_to_list")}</Button>
          </div>
        </div>

        {isPending && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> {t("purchases.add_item")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1 min-w-[180px] flex-1">
                  <label className="text-sm font-medium">{t("purchases.product")}</label>
                  <div className="flex gap-2">
                    <Select value={addProductId} onValueChange={(v) => { setAddProductId(v); setAddVariantId(null); }}>
                      <SelectTrigger data-testid="select-add-product" className="flex-1"><SelectValue placeholder={t("purchases.select_product")} /></SelectTrigger>
                      <SelectContent>
                        {allProducts.map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <BarcodeScanButton onScan={async (barcode) => {
                      try {
                        const res = await fetch(`/api/variants/barcode/${barcode}`, { credentials: "include" });
                        if (res.ok) {
                          const variant = await res.json();
                          setAddProductId(String(variant.productId));
                          setAddVariantId(variant.id);
                          setAddUnitCost(String(variant.costDefault || 0));
                          toast({ title: t("common.success"), description: `${variant.color || ""} ${variant.size || ""} - ${variant.barcode}` });
                        } else {
                          setQpBarcode(barcode);
                          setShowQuickProduct(true);
                        }
                      } catch (e) {
                        toast({ title: t("common.error"), description: String(e), variant: "destructive" });
                      }
                    }} />
                  </div>
                </div>
                {addProductId && productVariants.length > 0 && (
                  <div className="space-y-1 min-w-[180px] flex-1">
                    <label className="text-sm font-medium">{t("products.variants")}</label>
                    <Select value={addVariantId ? String(addVariantId) : ""} onValueChange={(v) => {
                      const vid = Number(v);
                      setAddVariantId(vid);
                      const vr = productVariants.find(pv => pv.id === vid);
                      if (vr?.costDefault) setAddUnitCost(String(vr.costDefault));
                    }}>
                      <SelectTrigger data-testid="select-add-variant"><SelectValue placeholder={t("transfers.select_variant")} /></SelectTrigger>
                      <SelectContent>
                        {productVariants.map(v => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {[v.color, v.size].filter(Boolean).join(" / ") || v.barcode || v.sku || `#${v.id}`}
                            {v.barcode ? ` (${v.barcode})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {addProductId && productVariants.length === 0 && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">&nbsp;</label>
                    <Button variant="outline" size="sm" onClick={() => {
                      setQpBarcode("");
                      const prod = allProducts.find(p => String(p.id) === addProductId);
                      if (prod) { setQpName(prod.name); setQpCategoryId(prod.categoryId ? String(prod.categoryId) : ""); setQpPrice(String(prod.price)); }
                      setShowQuickProduct(true);
                    }} data-testid="button-quick-create-variant">
                      <Plus className="w-3 h-3 ml-1" /> {t("purchases_v2.quick_create")}
                    </Button>
                  </div>
                )}
                <div className="space-y-1 w-28">
                  <label className="text-sm font-medium">{t("purchases.qty")}</label>
                  <Input type="number" min="1" value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="0" data-testid="input-add-qty" />
                </div>
                <div className="space-y-1 w-36">
                  <label className="text-sm font-medium">{t("purchases.unit_cost")}</label>
                  <Input type="number" step="0.001" min="0" value={addUnitCost} onChange={e => setAddUnitCost(e.target.value)} placeholder="0.000" data-testid="input-add-unit-cost" />
                </div>
                <Button onClick={() => addItemMutation.mutate()} disabled={!addProductId || !addVariantId || !addQty || !addUnitCost || addItemMutation.isPending} data-testid="button-add-item">
                  <Plus className="w-4 h-4 ml-1" /> {t("purchases.add")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4" /> {t("purchases.items")} ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("purchases.table_product")}</TableHead>
                  <TableHead>{t("products.barcode")}</TableHead>
                  <TableHead>{t("products.variant_color")}</TableHead>
                  <TableHead>{t("products.variant_size")}</TableHead>
                  <TableHead>{t("purchases.table_qty")}</TableHead>
                  <TableHead>{t("purchases.table_unit_price")}</TableHead>
                  <TableHead>{t("purchases.table_total")}</TableHead>
                  {!isPending && <TableHead>{t("purchases.table_extra_cost")}</TableHead>}
                  {!isPending && <TableHead>{t("purchases.table_final_cost")}</TableHead>}
                  {isPending && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isPending ? 8 : 9} className="text-center text-muted-foreground py-8">
                      {t("purchases.no_items")}
                    </TableCell>
                  </TableRow>
                )}
                {items.map((it: any) => (
                  <TableRow key={it.id} data-testid={`row-purchase-item-${it.id}`}>
                    <TableCell>
                      <div className="font-medium">{it.productName || productMap[it.productId] || it.productId}</div>
                      {it.variantId && <div className="text-xs text-muted-foreground">{t("purchases_v2.variant_info")}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{it.barcode || "—"}</TableCell>
                    <TableCell>{it.color || "—"}</TableCell>
                    <TableCell>{it.size || "—"}</TableCell>
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
                  <TableCell colSpan={4}>{t("common.total")}</TableCell>
                  <TableCell className="font-mono">{items.reduce((s: number, it: any) => s + it.qty, 0)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="font-mono">{omr(itemsSubtotal)}</TableCell>
                  {!isPending && <TableCell className="font-mono text-amber-600">{omr(extraTotal)}</TableCell>}
                  {!isPending && <TableCell className="font-mono text-emerald-600">{omr(parseFloat(invoiceDetail.totalAmount))}</TableCell>}
                  {isPending && <TableCell></TableCell>}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Ship className="w-4 h-4" /> {t("purchases.extra_costs")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1"><Truck className="w-3 h-3" /> {t("purchases.shipping")}</label>
                <Input type="number" step="0.001" value={invoiceDetail.shippingCost || "0"} disabled={!isPending}
                  onChange={e => updateCostsMutation.mutate({ shippingCost: Number(e.target.value) })}
                  data-testid="input-shipping-cost" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.customs")}</label>
                <Input type="number" step="0.001" value={invoiceDetail.customsCost || "0"} disabled={!isPending}
                  onChange={e => updateCostsMutation.mutate({ customsCost: Number(e.target.value) })}
                  data-testid="input-customs-cost" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.clearance")}</label>
                <Input type="number" step="0.001" value={invoiceDetail.clearanceCost || "0"} disabled={!isPending}
                  onChange={e => updateCostsMutation.mutate({ clearanceCost: Number(e.target.value) })}
                  data-testid="input-clearance-cost" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.other")}</label>
                <Input type="number" step="0.001" value={invoiceDetail.otherCost || "0"} disabled={!isPending}
                  onChange={e => updateCostsMutation.mutate({ otherCost: Number(e.target.value) })}
                  data-testid="input-other-cost" />
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg border flex flex-wrap gap-6">
              <div>
                <span className="text-xs text-muted-foreground">{t("purchases.subtotal")}</span>
                <p className="font-bold font-mono">{omr(itemsSubtotal)} {t("common.omr")}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("purchases.total_extra")}</span>
                <p className="font-bold font-mono text-amber-600">{omr(extraTotal)} {t("common.omr")}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t("purchases.grand_total")}</span>
                <p className="font-bold font-mono text-lg text-emerald-700">{omr(itemsSubtotal + extraTotal)} {t("common.omr")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isPending && items.length > 0 && canManage && (
          <div className="flex justify-end">
            <Button size="lg" className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => setShowPostConfirm(true)} data-testid="button-approve-invoice">
              <FileCheck className="w-5 h-5" /> {t("purchases.approve_invoice")}
            </Button>
          </div>
        )}

        <Dialog open={showPostConfirm} onOpenChange={setShowPostConfirm}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> {t("purchases.approve_confirm_title")}
              </DialogTitle>
              <DialogDescription>
                {t("purchases.approve_confirm_desc")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg border space-y-2">
                <p><strong>{t("purchases.items")}:</strong> {items.length}</p>
                <p><strong>{t("purchases.subtotal")}:</strong> {omr(itemsSubtotal)} {t("common.omr")}</p>
                <p><strong>{t("purchases.total_extra")}:</strong> {omr(extraTotal)} {t("common.omr")}</p>
                <p className="border-t pt-2"><strong>{t("purchases.grand_total")}:</strong> <span className="text-lg font-bold text-emerald-700">{omr(itemsSubtotal + extraTotal)} {t("common.omr")}</span></p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowPostConfirm(false)}>{t("common.cancel")}</Button>
              <Button className="bg-green-600 hover:bg-green-700 gap-2" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} data-testid="button-confirm-approve">
                <FileCheck className="w-4 h-4" /> {approveMutation.isPending ? t("common.loading") : t("purchases.approve_invoice")}
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
          <Plus className="w-4 h-4" /> {t("purchases.new_purchase")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("purchases.supplier")}</TableHead>
                <TableHead>{t("purchases.date")}</TableHead>
                <TableHead>{t("purchases.grand_total")}</TableHead>
                <TableHead>{t("purchases.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell>
                </TableRow>
              )}
              {invoices.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedInvoice(inv.id)} data-testid={`row-purchase-${inv.id}`}>
                  <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
                  <TableCell>{supplierMap[inv.supplierId] || "—"}</TableCell>
                  <TableCell>{inv.invoiceDate}</TableCell>
                  <TableCell className="font-mono">{omr(inv.grandTotal)} {t("common.omr")}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "pending" ? "outline" : "default"} className={inv.status === "pending" ? "border-amber-400 text-amber-600" : inv.status === "approved" ? "bg-green-600" : "bg-red-500"}>
                      {inv.status === "pending" ? t("purchases.pending") : inv.status === "approved" ? t("purchases.approved") : t("purchases.cancelled")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> {t("purchases.new_purchase")}</DialogTitle>
            <DialogDescription>{t("purchases.create_invoice_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.supplier")} *</label>
                <div className="flex gap-1">
                  <Select value={newSupplierId} onValueChange={setNewSupplierId}>
                    <SelectTrigger data-testid="select-new-supplier" className="flex-1"><SelectValue placeholder={t("purchases.select_supplier")} /></SelectTrigger>
                    <SelectContent>
                      {activeSuppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => setShowQuickSupplier(true)} title={t("purchases.new_supplier")} data-testid="button-quick-add-supplier">
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("purchases.date")} *</label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} data-testid="input-new-date" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.shipping")}</label>
                <Input type="number" step="0.001" value={newShipping} onChange={e => setNewShipping(e.target.value)} data-testid="input-new-shipping" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.customs")}</label>
                <Input type="number" step="0.001" value={newCustoms} onChange={e => setNewCustoms(e.target.value)} data-testid="input-new-customs" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.clearance")}</label>
                <Input type="number" step="0.001" value={newClearance} onChange={e => setNewClearance(e.target.value)} data-testid="input-new-clearance" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.other")}</label>
                <Input type="number" step="0.001" value={newOther} onChange={e => setNewOther(e.target.value)} data-testid="input-new-other" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
            <Button className="bg-primary gap-2" onClick={() => createMutation.mutate()} disabled={!newSupplierId || createMutation.isPending} data-testid="button-save-purchase">
              <Plus className="w-4 h-4" /> {createMutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQuickSupplier} onOpenChange={setShowQuickSupplier}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("purchases.quick_supplier")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("purchases.supplier_name")} *</label>
              <Input value={quickName} onChange={e => setQuickName(e.target.value)} placeholder={t("purchases.supplier_name")} data-testid="input-quick-supplier-name" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("purchases.phone")}</label>
              <Input value={quickPhone} onChange={e => setQuickPhone(e.target.value)} placeholder="+968..." data-testid="input-quick-supplier-phone" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickSupplier(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => quickSupplierMutation.mutate()} disabled={!quickName.trim() || quickSupplierMutation.isPending}>
              {quickSupplierMutation.isPending ? t("common.loading") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQuickProduct} onOpenChange={setShowQuickProduct}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("purchases_v2.quick_create_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("products.product_name")} *</label>
              <Input value={qpName} onChange={e => setQpName(e.target.value)} data-testid="input-qp-name" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("products.category")}</label>
              <Select value={qpCategoryId} onValueChange={setQpCategoryId}>
                <SelectTrigger data-testid="select-qp-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("products.barcode")}</label>
                <Input value={qpBarcode} onChange={e => setQpBarcode(e.target.value)} data-testid="input-qp-barcode" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("products.variant_sku")}</label>
                <Input value={qpSku} onChange={e => setQpSku(e.target.value)} data-testid="input-qp-sku" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("products.variant_color")}</label>
                <Input value={qpColor} onChange={e => setQpColor(e.target.value)} data-testid="input-qp-color" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("products.variant_size")}</label>
                <Input value={qpSize} onChange={e => setQpSize(e.target.value)} data-testid="input-qp-size" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("products.variant_price")}</label>
                <Input type="number" step="0.001" value={qpPrice} onChange={e => setQpPrice(e.target.value)} data-testid="input-qp-price" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("products.variant_cost")}</label>
                <Input type="number" step="0.001" value={qpCost} onChange={e => setQpCost(e.target.value)} data-testid="input-qp-cost" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickProduct(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => quickProductMutation.mutate()} disabled={!qpName || quickProductMutation.isPending} data-testid="button-save-qp">
              {quickProductMutation.isPending ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showOcrReview} onOpenChange={setShowOcrReview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("purchases_v2.ocr_review_title")}</DialogTitle>
            <DialogDescription>
              {ocrResult?.lines?.length > 0
                ? t("purchases_v2.ocr_lines_found").replace("{0}", ocrResult.lines.length)
                : t("purchases_v2.ocr_no_lines")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {ocrResult?.lines?.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("purchases_v2.ocr_code")}</TableHead>
                    <TableHead>{t("products.variant_color")}</TableHead>
                    <TableHead>{t("products.variant_size")}</TableHead>
                    <TableHead>{t("purchases.table_qty")}</TableHead>
                    <TableHead>{t("purchases.table_unit_price")}</TableHead>
                    <TableHead>{t("purchases.table_total")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ocrResult.lines.map((line: any, i: number) => (
                    <TableRow key={i} className={line.matched ? "" : "bg-amber-50"}>
                      <TableCell>{line.lineNo}</TableCell>
                      <TableCell>
                        <div className="font-mono text-sm font-bold">{line.productCode}</div>
                        <div className="text-xs text-muted-foreground">{line.description}</div>
                      </TableCell>
                      <TableCell>{line.color || "—"}</TableCell>
                      <TableCell>{line.size || "—"}</TableCell>
                      <TableCell className="font-mono">{line.qty}</TableCell>
                      <TableCell className="font-mono">{omr(line.price)}</TableCell>
                      <TableCell className="font-mono">{omr(line.amount)}</TableCell>
                      <TableCell>
                        {line.matched ? (
                          <Badge className="bg-green-600 text-white">{t("purchases_v2.ocr_matched")}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-400 text-amber-600">{t("purchases_v2.ocr_not_matched")}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{t("purchases_v2.ocr_no_lines")}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowRawText(!showRawText)}>
                {t("purchases_v2.ocr_raw_text")}
              </Button>
            </div>

            {showRawText && (
              <pre className="bg-muted p-4 rounded-lg text-xs max-h-60 overflow-auto whitespace-pre-wrap font-mono" dir="ltr">
                {ocrResult?.rawText || ""}
              </pre>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowOcrReview(false); setOcrResult(null); }}>
              {t("common.cancel")}
            </Button>
            {ocrResult?.lines?.some((l: any) => l.matched) && (
              <Button variant="outline" onClick={() => importOcrLines(true)} data-testid="button-ocr-import-matched">
                {t("purchases_v2.ocr_import_matched")}
              </Button>
            )}
            {ocrResult?.lines?.length > 0 && (
              <Button onClick={() => importOcrLines(false)} data-testid="button-ocr-import-all">
                {t("purchases_v2.ocr_import_all")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PurchasesPage() {
  const { t } = useI18n();
  return (
    <div className="container mx-auto p-4 lg:p-6 pb-20">
      <div className="mb-6 text-right">
        <h1 className="text-3xl font-bold tracking-tight">{t("purchases.title")}</h1>
        <p className="text-muted-foreground">{t("purchases.subtitle")}</p>
      </div>

      <Tabs defaultValue="purchases" className="space-y-4">
        <TabsList className="flex justify-start">
          <TabsTrigger value="purchases" className="gap-2"><FileText className="w-4 h-4" /> {t("purchases.tab_purchases")}</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2"><Truck className="w-4 h-4" /> {t("purchases.tab_suppliers")}</TabsTrigger>
        </TabsList>
        <TabsContent value="purchases" className="border-none p-0 outline-none">
          <PurchasesTab />
        </TabsContent>
        <TabsContent value="suppliers" className="border-none p-0 outline-none">
          <SuppliersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
