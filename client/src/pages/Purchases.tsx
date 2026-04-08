import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { fmtDate } from "@/lib/formatters";
import { Plus, Trash2, FileCheck, Package, Truck, Ship, FileText, AlertTriangle, Search, Edit, Building, UserPlus, FileSpreadsheet, X, Loader2, CheckCircle2, Upload, Printer } from "lucide-react";
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
  const [showStatement, setShowStatement] = useState(false);
  const [statementSupplierId, setStatementSupplierId] = useState<number | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<string>("cash");
  const [payNote, setPayNote] = useState("");
  const [payBranchId, setPayBranchId] = useState("");
  const { data } = useAuth();
  const user = data?.user;

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
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

  function openPayment(s: Supplier) {
    setPaySupplier(s);
    setPayAmount("");
    setPayMethod("cash");
    setPayNote("");
    setPayBranchId(String(user?.branchId || ""));
    setShowPayment(true);
  }

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!paySupplier) return;
      await apiRequest("POST", `/api/suppliers/${paySupplier.id}/payment`, {
        amount: Number(payAmount),
        method: payMethod,
        note: payNote || null,
        branchId: Number(payBranchId),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/suppliers"] });
      qc.invalidateQueries({ queryKey: ["/api/cash-ledger"] });
      qc.invalidateQueries({ queryKey: ["/api/bank-ledger"] });
      setShowPayment(false);
      toast({ title: t("purchases.payment_success") });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
  });

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
                <TableHead>{t("purchases.table_city")}</TableHead>
                <TableHead>{t("purchases.balance")}</TableHead>
                <TableHead>{t("purchases.total_purchases")}</TableHead>
                <TableHead>{t("purchases.table_status")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {search ? t("purchases.no_results") : t("purchases.no_suppliers")}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(s => (
                <TableRow key={s.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-supplier-${s.id}`}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="font-mono text-sm">{s.phone || "—"}</TableCell>
                  <TableCell>{s.city || "—"}</TableCell>
                  <TableCell className="font-mono font-bold text-red-600">{omr((s as any).balance)}</TableCell>
                  <TableCell className="font-mono">{omr((s as any).totalPurchases)}</TableCell>
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
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} data-testid={`button-edit-supplier-${s.id}`} title={t("common.edit")}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPayment(s)} data-testid={`button-pay-supplier-${s.id}`} title={t("purchases.record_payment")}>
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setStatementSupplierId(s.id); setShowStatement(true); }} data-testid={`button-statement-supplier-${s.id}`} title={t("customers.statement")}>
                        <FileText className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SupplierStatementDialog
        open={showStatement}
        onOpenChange={setShowStatement}
        supplierId={statementSupplierId}
      />

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              {t("purchases.record_payment")}
            </DialogTitle>
            <DialogDescription>
              {paySupplier?.name} - {t("purchases.current_balance")}: {omr((paySupplier as any)?.balance)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.amount")} ({t("common.omr")})</label>
              <Input
                type="number"
                step="0.001"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="0.000"
                autoFocus
                data-testid="input-payment-amount"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.method")}</label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("payment_methods.cash")}</SelectItem>
                  <SelectItem value="bank_transfer">{t("payment_methods.bank_transfer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.branch")}</label>
              <Select value={payBranchId} onValueChange={setPayBranchId}>
                <SelectTrigger data-testid="select-payment-branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.note")}</label>
              <Input
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
                placeholder={t("common.note")}
                data-testid="input-payment-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => payMutation.mutate()}
              disabled={!payAmount || Number(payAmount) <= 0 || !payBranchId || payMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-payment"
            >
              {payMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function SupplierStatementDialog({ open, onOpenChange, supplierId }: { open: boolean; onOpenChange: (v: boolean) => void; supplierId: number | null }) {
  const { t } = useI18n();
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: statement, isLoading } = useQuery<any>({
    queryKey: ["/api/suppliers", supplierId, "statement", { from, to }],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${supplierId}/statement?from=${from}&to=${to}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: open && !!supplierId,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:p-0 print:m-0 print:overflow-visible">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> {t("customers.supplier_statement")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-4 print:hidden">
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">{t("customers.statement_from")}</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">{t("customers.statement_to")}</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <Button variant="outline" className="gap-2" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> {t("common.print")}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : statement ? (
            <div id="statement-print-area" className="space-y-6">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h2 className="text-2xl font-bold">{t("customers.supplier_statement")}</h2>
                  <p className="text-muted-foreground">{from} - {to}</p>
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-lg">{statement.supplier.name}</h3>
                  <p className="text-sm">{statement.supplier.phone}</p>
                  <p className="text-sm">{statement.supplier.city}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-muted/30">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">{t("customers.statement_total_purchases")}</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-4">
                    <p className="text-2xl font-bold">{omr(statement.totalPurchases)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30 col-span-2">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">{t("customers.statement_current_balance")}</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-4">
                    <p className="text-2xl font-bold text-primary">{omr(statement.currentBalance)}</p>
                  </CardContent>
                </Card>
              </div>

              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("common.type")}</TableHead>
                    <TableHead>{t("customers.invoice_number")}</TableHead>
                    <TableHead>{t("common.branch")}</TableHead>
                    <TableHead className="text-left">{t("common.amount")}</TableHead>
                    <TableHead className="text-left">{t("customers.statement_balance")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t("customers.statement_no_transactions")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    statement.items.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>{fmtDate(item.created_at)}</TableCell>
                        <TableCell>
                          {item.type === 'purchase' ? t("customers.statement_purchase") : t("customers.statement_payment")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.invoice_number || "—"}</TableCell>
                        <TableCell>{item.branch_name || "—"}</TableCell>
                        <TableCell className="text-left font-medium">{omr(item.total)}</TableCell>
                        <TableCell className="text-left font-bold">{omr(item.balance)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PurchasesTab() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useAuth();
  const user = data?.user;
  const canManage = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";

  const [showCreate, setShowCreate] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);
  const [showQuickProduct, setShowQuickProduct] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editProductName, setEditProductName] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSize, setEditSize] = useState("");
  const [ocrStage, setOcrStage] = useState<"idle" | "uploading" | "parsing" | "review" | "importing" | "done">("idle");
  const [ocrError, setOcrError] = useState<{ stage: string; error: string } | null>(null);
  const [ocrItems, setOcrItems] = useState<any[]>([]);
  const [ocrValidation, setOcrValidation] = useState<any>(null);
  const [ocrMeta, setOcrMeta] = useState<{ invoiceNo: string | null; date: string | null; totalQty: number; totalAmount: number; rawText: string } | null>(null);
  const [showOcrRawText, setShowOcrRawText] = useState(false);

  const [newSupplierId, setNewSupplierId] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
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
  const [addColor, setAddColor] = useState("");
  const [addSize, setAddSize] = useState("");
  const [addProductName, setAddProductName] = useState("");

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

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
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
        branchId: newBranchId ? Number(newBranchId) : null,
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
      setNewSupplierId(""); setNewBranchId(""); setNewNotes("");
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
      let productId = addProductId ? Number(addProductId) : null;
      let variantId = addVariantId;

      if (!productId && addProductName.trim()) {
        const qcRes = await apiRequest("POST", "/api/variants/quick-create", {
          productName: addProductName.trim(),
          barcode: null, sku: null,
          color: addColor || null,
          size: addSize || null,
          price: Number(addUnitCost) || 0,
          costDefault: Number(addUnitCost) || 0,
        });
        const qcData = await qcRes.json();
        productId = qcData.product.id;
        variantId = qcData.variant.id;
      }

      if (!productId) throw new Error(t("purchases.select_product"));

      const res = await apiRequest("POST", `/api/purchases/${selectedInvoice}/items`, {
        productId,
        variantId,
        qty: Number(addQty),
        unitCostBase: Number(addUnitCost),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setAddProductId("");
      setAddVariantId(null);
      setAddQty("");
      setAddUnitCost("");
      setAddColor("");
      setAddSize("");
      setAddProductName("");
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

  const updateItemMutation = useMutation({
    mutationFn: async (data: { itemId: number; qty: number; unitCostBase: number; productName: string; barcode: string; color: string; size: string }) => {
      const res = await apiRequest("PATCH", `/api/purchases/${selectedInvoice}/items/${data.itemId}`, {
        qty: data.qty,
        unitCostBase: data.unitCostBase,
        productName: data.productName,
        barcode: data.barcode,
        color: data.color,
        size: data.size,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
      qc.invalidateQueries({ queryKey: ["/api/purchases"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setEditingItemId(null);
      toast({ title: t("common.saved") });
    },
    onError: (e: any) => {
      toast({ title: t("common.error"), description: e.message, variant: "destructive" });
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
      const res = await apiRequest("PATCH", `/api/purchases/${selectedInvoice}/status`, { status: "approved" });
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

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/purchases/${selectedInvoice}/status`, { status: "received" });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchases"] });
      qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: t("purchases.invoice_received"), description: t("purchases.invoice_received_desc") });
    },
    onError: (e: Error) => toast({ title: t("purchases.approve_failed"), description: e.message, variant: "destructive" }),
  });

  async function handleOcrUpload(file: File) {
    if (!selectedInvoice) return;
    setOcrError(null);
    setOcrItems([]);
    setOcrValidation(null);
    setOcrMeta(null);
    setShowOcrRawText(false);

    setOcrStage("uploading");
    let fileId: string;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(`/api/purchases/${selectedInvoice}/invoice-image`, { method: "POST", body: formData, credentials: "include" });
      const uploadData = await uploadRes.json();
      if (!uploadData.ok) {
        setOcrError({ stage: uploadData.stage || "upload", error: uploadData.error || "فشل الرفع" });
        setOcrStage("idle");
        return;
      }
      fileId = uploadData.fileId;
    } catch (err: any) {
      setOcrError({ stage: "upload", error: err.message });
      setOcrStage("idle");
      return;
    }

    setOcrStage("parsing");
    try {
      const parseRes = await apiRequest("POST", `/api/purchases/${selectedInvoice}/parse-invoice`, { fileId });
      const parseData = await parseRes.json();
      if (!parseData.ok) {
        setOcrError({ stage: parseData.stage || "parse", error: parseData.error || "فشل القراءة" });
        setOcrStage("idle");
        return;
      }

      const { items, invoiceNo, date, totalQty, totalAmount, rawText, validation } = parseData.parsed;

      if (!items || items.length === 0) {
        setOcrError({ stage: "parse", error: "لم يتم العثور على أصناف في الصورة" });
        setOcrStage("idle");
        return;
      }

      setOcrItems(items);
      setOcrValidation(validation);
      setOcrMeta({ invoiceNo, date, totalQty, totalAmount, rawText });
      setOcrStage("review");
    } catch (err: any) {
      setOcrError({ stage: "parse", error: err.message });
      setOcrStage("idle");
    }
  }

  function updateOcrItem(index: number, field: string, value: any) {
    setOcrItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      const item = updated[index];
      item.computedAmount = (item.qty || 0) * (item.unitCost || 0);
      if (field === "qty" || field === "unitCost") {
        item.amount = item.computedAmount;
      }
      const tolerance = 0.05;
      item.reviewReasons = [];
      item.needsReview = false;
      if (item.qty <= 0) { item.reviewReasons.push("qty_zero"); item.needsReview = true; }
      if (item.unitCost <= 0) { item.reviewReasons.push("price_zero"); item.needsReview = true; }
      if (item.amount > 0 && Math.abs(item.computedAmount - item.amount) > item.amount * tolerance) {
        item.reviewReasons.push("amount_mismatch"); item.needsReview = true;
      }
      if (!item.code || item.code.length < 1) { item.reviewReasons.push("no_description"); item.needsReview = true; }
      return updated;
    });
    revalidateOcrTotals();
  }

  function addOcrItem() {
    setOcrItems(prev => [...prev, {
      lineNo: prev.length + 1,
      code: "",
      color: "",
      size: "",
      qty: 1,
      unitCost: 0,
      amount: 0,
      computedAmount: 0,
      needsReview: true,
      reviewReasons: ["price_zero"],
    }]);
  }

  function removeOcrItem(index: number) {
    setOcrItems(prev => prev.filter((_, i) => i !== index));
    revalidateOcrTotals();
  }

  function fixOcrItem(index: number) {
    setOcrItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      item.amount = item.qty * item.unitCost;
      item.computedAmount = item.amount;
      item.needsReview = false;
      item.reviewReasons = [];
      if (item.qty <= 0) { item.reviewReasons.push("qty_zero"); item.needsReview = true; }
      if (item.unitCost <= 0) { item.reviewReasons.push("price_zero"); item.needsReview = true; }
      if (!item.code || item.code.length < 1) { item.reviewReasons.push("no_description"); item.needsReview = true; }
      updated[index] = item;
      return updated;
    });
    revalidateOcrTotals();
  }

  function revalidateOcrTotals() {
    setTimeout(() => {
      setOcrValidation((prev: any) => {
        if (!prev) return prev;
        const actualQty = ocrItems.reduce((s, i) => s + (i.qty || 0), 0);
        const actualAmount = ocrItems.reduce((s, i) => s + (i.amount || 0), 0);
        const lineErrors = ocrItems.filter(i => i.needsReview).length;
        const qtyMatch = prev.expectedTotalQty === null || Math.abs(actualQty - prev.expectedTotalQty) <= 1;
        const amtMatch = prev.expectedTotalAmount === null || Math.abs(actualAmount - prev.expectedTotalAmount) <= prev.expectedTotalAmount * 0.05;
        return { ...prev, lineErrors, totalQtyMatch: qtyMatch, totalAmountMatch: amtMatch, actualTotalQty: actualQty, actualTotalAmount: actualAmount, allPass: lineErrors === 0 && qtyMatch && amtMatch };
      });
    }, 0);
  }

  const ocrAllValid = ocrValidation?.allPass || (ocrItems.length > 0 && ocrItems.every((i: any) => !i.needsReview));

  async function importOcrItems() {
    if (!selectedInvoice || ocrItems.length === 0) return;
    setOcrStage("importing");
    let imported = 0;
    let errors = 0;

    for (const item of ocrItems) {
      if (!item.qty || item.qty <= 0) continue;

      let variantId: number | null = null;
      let productId: number | null = null;

      if (item.code) {
        try {
          const skuRes = await fetch(`/api/variants/barcode/${encodeURIComponent(item.code)}`, { credentials: "include" });
          if (skuRes.ok) {
            const v = await skuRes.json();
            variantId = v.id;
            productId = v.productId;
          }
        } catch {}
      }

      if (!variantId) {
        try {
          const itemName = (item.code || `صنف ${imported + 1}`).substring(0, 100);
          const qcRes = await apiRequest("POST", "/api/variants/quick-create", {
            productName: itemName,
            barcode: null, sku: null,
            color: item.color || null,
            size: item.size || null,
            price: item.unitCost || 0,
            costDefault: item.unitCost || 0,
          });
          const qcData = await qcRes.json();
          variantId = qcData.variant.id;
          productId = qcData.product.id;
        } catch (e) {
          errors++;
          continue;
        }
      }

      try {
        await apiRequest("POST", `/api/purchases/${selectedInvoice}/items`, {
          productId, variantId,
          qty: item.qty,
          unitCostBase: item.unitCost || 0,
        });
        imported++;
      } catch { errors++; }
    }

    qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
    qc.invalidateQueries({ queryKey: ["/api/products"] });
    setOcrStage("done");
    toast({
      title: t("purchases_v2.ocr_imported"),
      description: `${imported} ${t("purchases.items")}` + (errors > 0 ? ` (${errors} ${t("common.error")})` : ""),
      variant: errors > 0 && imported === 0 ? "destructive" : "default",
    });
    setTimeout(() => { setOcrStage("idle"); setOcrItems([]); setOcrValidation(null); setOcrMeta(null); }, 3000);
  }

  const items = invoiceDetail?.items || [];
  const isPending = invoiceDetail?.status === "pending";
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const profitMargin = parseFloat(settings?.default_profit_margin || "50");

  const statusLabel = invoiceDetail?.status === "pending" ? t("purchases.pending") : invoiceDetail?.status === "approved" ? t("purchases.approved") : invoiceDetail?.status === "received" ? t("purchases.received") : t("purchases.cancelled");
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
                <input type="file" accept="image/*,.pdf" className="hidden" data-testid="input-ocr-upload"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleOcrUpload(f); e.target.value = ""; }}
                  disabled={ocrStage !== "idle"} />
                <Button variant="outline" asChild disabled={ocrStage !== "idle"} data-testid="button-ocr-upload">
                  <span>
                    <Upload className="w-4 h-4 ml-1" /> {t("purchases_v2.ocr_upload")}
                  </span>
                </Button>
              </label>
            )}
            <Badge variant={isPending ? "outline" : "default"} className={isPending ? "border-amber-400 text-amber-600" : invoiceDetail?.status === "approved" ? "bg-green-600" : invoiceDetail?.status === "received" ? "bg-blue-600" : "bg-red-500"}>
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
                    <Select value={addProductId} onValueChange={(v) => {
                      setAddProductId(v);
                      setAddVariantId(null);
                      setAddColor("");
                      setAddSize("");
                      const prod = allProducts.find(p => String(p.id) === v);
                      if (prod) setAddProductName(prod.name);
                    }}>
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
                          setAddColor(variant.color || "");
                          setAddSize(variant.size || "");
                          const prod = allProducts.find(p => p.id === variant.productId);
                          if (prod) setAddProductName(prod.name);
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
                <div className="space-y-1 min-w-[140px] flex-1">
                  <label className="text-sm font-medium">{t("products.name")}</label>
                  <Input value={addProductName} onChange={e => { setAddProductName(e.target.value); if (addProductId) { setAddProductId(""); setAddVariantId(null); } }}
                    placeholder={t("products.name")} data-testid="input-add-product-name" />
                </div>
                <div className="space-y-1 w-28">
                  <label className="text-sm font-medium">{t("products.variant_color")}</label>
                  <Input value={addColor} onChange={e => setAddColor(e.target.value)} placeholder={t("products.variant_color")} data-testid="input-add-color" />
                </div>
                <div className="space-y-1 w-28">
                  <label className="text-sm font-medium">{t("products.variant_size")}</label>
                  <Input value={addSize} onChange={e => setAddSize(e.target.value)} placeholder={t("products.variant_size")} data-testid="input-add-size" />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3 mt-3">
                {addProductId && productVariants.length > 0 && (
                  <div className="space-y-1 min-w-[180px] flex-1">
                    <label className="text-sm font-medium">{t("products.variants")}</label>
                    <Select value={addVariantId ? String(addVariantId) : ""} onValueChange={(v) => {
                      const vid = Number(v);
                      setAddVariantId(vid);
                      const vr = productVariants.find(pv => pv.id === vid);
                      if (vr) {
                        if (vr.costDefault) setAddUnitCost(String(vr.costDefault));
                        setAddColor(vr.color || "");
                        setAddSize(vr.size || "");
                      }
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
                <Button onClick={() => addItemMutation.mutate()} disabled={(!addProductId && !addProductName.trim()) || !addQty || !addUnitCost || addItemMutation.isPending} data-testid="button-add-item"
                  className="bg-pink-500 hover:bg-pink-600 text-white">
                  <Plus className="w-4 h-4 ml-1" /> {t("purchases.add")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(ocrStage === "uploading" || ocrStage === "parsing" || ocrStage === "importing") && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800">
                    {ocrStage === "uploading" && t("purchases_v2.ocr_uploading")}
                    {ocrStage === "parsing" && t("purchases_v2.ocr_parsing")}
                    {ocrStage === "importing" && t("purchases_v2.ocr_importing")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {ocrError && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-red-800">{t("common.error")} ({ocrError.stage})</p>
                  <p className="text-sm text-red-700 mt-1">{ocrError.error}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setOcrError(null)}>
                  <X className="w-4 h-4" />
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
                {items.map((it: any) => {
                  const isEditing = editingItemId === it.id;
                  return (
                  <TableRow key={it.id} data-testid={`row-purchase-item-${it.id}`}>
                    <TableCell>
                      {isEditing ? (
                        <Input className="h-8 min-w-[120px]" value={editProductName}
                          onChange={e => setEditProductName(e.target.value)} data-testid={`input-edit-name-${it.id}`} />
                      ) : (
                        <>
                          <div className="font-medium">{it.productName || productMap[it.productId] || it.productId}</div>
                          {it.variantId && <div className="text-xs text-muted-foreground">{t("purchases_v2.variant_info")}</div>}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {isEditing ? (
                        <Input className="h-8 w-28 font-mono text-xs" value={editBarcode}
                          onChange={e => setEditBarcode(e.target.value)} data-testid={`input-edit-barcode-${it.id}`} />
                      ) : (it.barcode || "—")}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input className="h-8 w-24" value={editColor}
                          onChange={e => setEditColor(e.target.value)} data-testid={`input-edit-color-${it.id}`} />
                      ) : (it.color || "—")}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input className="h-8 w-20" value={editSize}
                          onChange={e => setEditSize(e.target.value)} data-testid={`input-edit-size-${it.id}`} />
                      ) : (it.size || "—")}
                    </TableCell>
                    <TableCell className="font-mono">
                      {isEditing ? (
                        <Input type="number" min={1} className="h-8 w-20 font-mono" value={editQty}
                          onChange={e => setEditQty(e.target.value)} data-testid={`input-edit-qty-${it.id}`} />
                      ) : it.qty}
                    </TableCell>
                    <TableCell className="font-mono">
                      {isEditing ? (
                        <Input type="number" min={0} step="0.001" className="h-8 w-24 font-mono" value={editPrice}
                          onChange={e => setEditPrice(e.target.value)} data-testid={`input-edit-price-${it.id}`} />
                      ) : omr(it.unitCostBase)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {isEditing ? omr((parseFloat(editQty) || 0) * (parseFloat(editPrice) || 0)) : omr(it.lineSubtotal)}
                    </TableCell>
                    {!isPending && <TableCell className="font-mono text-amber-600">{omr(it.allocatedExtraCost)}</TableCell>}
                    {!isPending && <TableCell className="font-mono font-bold text-emerald-600">{omr(it.unitCostFinal)}</TableCell>}
                    {isPending && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 h-8 w-8 p-0"
                                disabled={updateItemMutation.isPending}
                                onClick={() => updateItemMutation.mutate({
                                  itemId: it.id,
                                  qty: parseInt(editQty) || 1,
                                  unitCostBase: parseFloat(editPrice) || 0,
                                  productName: editProductName,
                                  barcode: editBarcode,
                                  color: editColor,
                                  size: editSize,
                                })}
                                data-testid={`button-save-item-${it.id}`}>
                                <FileCheck className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-muted-foreground h-8 w-8 p-0"
                                onClick={() => setEditingItemId(null)} data-testid={`button-cancel-edit-${it.id}`}>
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-700 h-8 w-8 p-0"
                                onClick={() => {
                                  setEditingItemId(it.id);
                                  setEditProductName(it.productName || productMap[it.productId] || "");
                                  setEditBarcode(it.barcode || "");
                                  setEditColor(it.color || "");
                                  setEditSize(it.size || "");
                                  setEditQty(String(it.qty));
                                  setEditPrice(String(parseFloat(it.unitCostBase)));
                                }}
                                data-testid={`button-edit-item-${it.id}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                                onClick={() => deleteItemMutation.mutate(it.id)} data-testid={`button-delete-item-${it.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
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

        {invoiceDetail?.status === "approved" && canManage && (
          <div className="flex justify-end">
            <Button size="lg" className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => receiveMutation.mutate()} disabled={receiveMutation.isPending} data-testid="button-receive-invoice">
              <FileCheck className="w-5 h-5" /> {t("purchases.receive_invoice")}
            </Button>
          </div>
        )}

        {(invoiceDetail?.status === "approved" || invoiceDetail?.status === "received") && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 flex items-center gap-3 text-sm text-green-800 dark:text-green-300">
            <FileCheck className="w-5 h-5 shrink-0" />
            <span>
              {invoiceDetail.status === "received"
                ? t("purchases.inventory_updated_received")
                : t("purchases.inventory_updated_approved")}
            </span>
          </div>
        )}

        <Dialog open={ocrStage === "review"} onOpenChange={(open) => { if (!open) { setOcrStage("idle"); setOcrItems([]); setOcrValidation(null); setOcrMeta(null); } }}>
          <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t("purchases_v2.ocr_review_title")}
              </DialogTitle>
              <DialogDescription>
                {t("purchases_v2.ocr_review_desc")}
              </DialogDescription>
            </DialogHeader>

            {ocrMeta && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg border">
                {ocrMeta.invoiceNo && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t("purchases.invoice_number")}</p>
                    <p className="font-bold">{ocrMeta.invoiceNo}</p>
                  </div>
                )}
                {ocrMeta.date && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t("purchases.date")}</p>
                    <p className="font-bold">{ocrMeta.date}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">{t("purchases_v2.ocr_items_count")}</p>
                  <p className="font-bold">{ocrItems.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("purchases_v2.ocr_total_qty")}</p>
                  <p className="font-bold">{ocrItems.reduce((s: number, i: any) => s + (i.qty || 0), 0)}</p>
                </div>
              </div>
            )}

            {ocrValidation && (
              <div className={`p-3 rounded-lg border flex items-start gap-3 ${ocrValidation.allPass ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
                {ocrValidation.allPass ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 text-sm">
                  <p className={`font-medium ${ocrValidation.allPass ? "text-green-800" : "text-red-800"}`}>
                    {ocrValidation.allPass ? t("purchases_v2.ocr_validation_pass") : t("purchases_v2.ocr_validation_fail")}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {ocrValidation.lineErrors > 0 && (
                      <span className="text-red-700">{t("purchases_v2.ocr_line_errors")}: {ocrValidation.lineErrors}</span>
                    )}
                    {!ocrValidation.totalQtyMatch && ocrValidation.expectedTotalQty !== null && (
                      <span className="text-red-700">
                        {t("purchases_v2.ocr_qty_mismatch")}: {ocrValidation.actualTotalQty} ≠ {ocrValidation.expectedTotalQty}
                      </span>
                    )}
                    {!ocrValidation.totalAmountMatch && ocrValidation.expectedTotalAmount !== null && (
                      <span className="text-red-700">
                        {t("purchases_v2.ocr_amount_mismatch")}: {omr(ocrValidation.actualTotalAmount)} ≠ {omr(ocrValidation.expectedTotalAmount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead className="min-w-[140px]">{t("purchases_v2.ocr_description")}</TableHead>
                    <TableHead className="min-w-[80px]">{t("products.variant_color")}</TableHead>
                    <TableHead className="min-w-[60px]">{t("products.variant_size")}</TableHead>
                    <TableHead className="min-w-[70px]">{t("purchases.table_qty")}</TableHead>
                    <TableHead className="min-w-[90px]">{t("purchases.table_unit_price")}</TableHead>
                    <TableHead className="min-w-[90px]">{t("purchases.table_total")}</TableHead>
                    <TableHead className="min-w-[80px]">{t("common.status")}</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ocrItems.map((item: any, idx: number) => (
                    <TableRow key={idx} className={item.needsReview ? "bg-red-50" : "bg-green-50/30"} data-testid={`row-ocr-item-${idx}`}>
                      <TableCell className="text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                      <TableCell>
                        <Input value={item.code || ""} onChange={e => updateOcrItem(idx, "code", e.target.value)}
                          className={`h-8 text-sm ${item.reviewReasons?.includes("no_description") ? "border-red-400" : ""}`}
                          data-testid={`input-ocr-code-${idx}`} />
                      </TableCell>
                      <TableCell>
                        <Input value={item.color || ""} onChange={e => updateOcrItem(idx, "color", e.target.value)}
                          className="h-8 text-sm" data-testid={`input-ocr-color-${idx}`} />
                      </TableCell>
                      <TableCell>
                        <Input value={item.size || ""} onChange={e => updateOcrItem(idx, "size", e.target.value)}
                          className="h-8 text-sm" data-testid={`input-ocr-size-${idx}`} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} value={item.qty || 0}
                          onChange={e => updateOcrItem(idx, "qty", parseInt(e.target.value) || 0)}
                          className={`h-8 text-sm w-20 font-mono ${item.reviewReasons?.includes("qty_zero") ? "border-red-400" : ""}`}
                          data-testid={`input-ocr-qty-${idx}`} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} step="0.001" value={item.unitCost || 0}
                          onChange={e => updateOcrItem(idx, "unitCost", parseFloat(e.target.value) || 0)}
                          className={`h-8 text-sm w-24 font-mono ${item.reviewReasons?.includes("price_zero") ? "border-red-400" : ""}`}
                          data-testid={`input-ocr-price-${idx}`} />
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono text-sm ${item.reviewReasons?.includes("amount_mismatch") ? "text-red-600 font-bold" : ""}`}>
                          {omr(item.amount || 0)}
                          {item.reviewReasons?.includes("amount_mismatch") && (
                            <span className="text-xs block text-red-500">≠ {omr(item.computedAmount)}</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.needsReview ? (
                          <div className="space-y-0.5">
                            {item.reviewReasons?.map((r: string, ri: number) => (
                              <Badge key={ri} variant="destructive" className="text-[10px] block w-fit">
                                {t(`purchases_v2.ocr_err_${r}`) || r}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge className="bg-green-600 text-white text-[10px]">{t("purchases_v2.ocr_status_ok")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {item.needsReview && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600"
                              onClick={() => fixOcrItem(idx)} data-testid={`button-ocr-fix-${idx}`}
                              title={t("purchases_v2.ocr_fix")}>
                              <FileCheck className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500"
                            onClick={() => removeOcrItem(idx)} data-testid={`button-ocr-remove-${idx}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/30 border-t-2">
                    <TableCell></TableCell>
                    <TableCell>{t("common.total")}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="font-mono">{ocrItems.reduce((s: number, i: any) => s + (i.qty || 0), 0)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="font-mono">{omr(ocrItems.reduce((s: number, i: any) => s + (i.amount || 0), 0))}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={addOcrItem} data-testid="button-ocr-add-row">
                <Plus className="w-4 h-4" /> {t("purchases_v2.ocr_add_item")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowOcrRawText(!showOcrRawText)}>
                {t("purchases_v2.ocr_raw_text")}
              </Button>
            </div>

            {showOcrRawText && (
              <pre className="bg-muted p-4 rounded-lg text-xs max-h-48 overflow-auto whitespace-pre-wrap font-mono" dir="ltr">
                {ocrMeta?.rawText || ""}
              </pre>
            )}

            <DialogFooter className="flex gap-2 sm:justify-between">
              <Button variant="outline" onClick={() => { setOcrStage("idle"); setOcrItems([]); setOcrValidation(null); setOcrMeta(null); }}>
                {t("common.cancel")}
              </Button>
              <div className="flex gap-2">
                {!ocrAllValid && (
                  <p className="text-sm text-red-600 self-center">{t("purchases_v2.ocr_fix_before_import")}</p>
                )}
                <Button onClick={importOcrItems} disabled={!ocrAllValid || ocrItems.length === 0}
                  className="bg-green-600 hover:bg-green-700 gap-2" data-testid="button-ocr-confirm-import">
                  <FileCheck className="w-4 h-4" /> {t("purchases_v2.ocr_confirm_import")} ({ocrItems.length})
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPostConfirm} onOpenChange={setShowPostConfirm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> {t("purchases.approve_confirm_title")}
              </DialogTitle>
              <DialogDescription>
                {t("purchases.approve_confirm_desc")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg border grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t("purchases.items")}</p>
                  <p className="font-bold">{items.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("purchases.subtotal")}</p>
                  <p className="font-bold">{omr(itemsSubtotal)} {t("common.omr")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("purchases.total_extra")}</p>
                  <p className="font-bold text-amber-600">{omr(extraTotal)} {t("common.omr")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("purchases.grand_total")}</p>
                  <p className="font-bold text-emerald-700">{omr(itemsSubtotal + extraTotal)} {t("common.omr")}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-2 text-xs font-bold border-b flex justify-between items-center">
                  <span>{t("purchases.price_updated_on_approval")}</span>
                  <span className="text-emerald-700">{t("products.profit_margin")}: {profitMargin}%</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="h-8">
                        <TableHead className="h-8 py-0">{t("purchases.product")}</TableHead>
                        <TableHead className="h-8 py-0 text-left">{t("purchases.table_unit_price")}</TableHead>
                        <TableHead className="h-8 py-0 text-left">{t("products.suggested_price")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it: any) => {
                        const unitCostFinal = parseFloat(it.unitCostFinal || "0");
                        const suggestedPrice = unitCostFinal * (1 + profitMargin / 100);
                        return (
                          <TableRow key={it.id} className="h-8">
                            <TableCell className="py-1">
                              <p className="font-medium">{it.productName || productMap[it.productId] || "—"}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {[it.color, it.size].filter(Boolean).join(" / ")}
                              </p>
                            </TableCell>
                            <TableCell className="py-1 font-mono text-left">{omr(unitCostFinal)}</TableCell>
                            <TableCell className="py-1 font-mono text-left font-bold text-emerald-700">{omr(suggestedPrice)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
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

  // ── إحصائيات + فلاتر ──────────────────────────────────────────────────
  const [invSearch,     setInvSearch]     = useState("");
  const [invSupplier,   setInvSupplier]   = useState("all");
  const [invStatus,     setInvStatus]     = useState("all");

  const invoiceStats = {
    total:    invoices.length,
    amount:   invoices.reduce((s, i) => s + parseFloat(String(i.grandTotal || 0)), 0),
    pending:  invoices.filter(i => i.status === "pending").length,
    done:     invoices.filter(i => i.status === "approved" || i.status === "received").length,
  };

  const filteredInvoices = (invoices as PurchaseInvoice[]).filter(inv => {
    if (invSearch) {
      const q = invSearch.toLowerCase();
      const name = supplierMap[inv.supplierId]?.toLowerCase() || "";
      if (!inv.invoiceNumber.toLowerCase().includes(q) && !name.includes(q)) return false;
    }
    if (invSupplier !== "all" && String(inv.supplierId) !== invSupplier) return false;
    if (invStatus   !== "all" && inv.status !== invStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold">{invoiceStats.total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">إجمالي الفواتير</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-primary">{omr(invoiceStats.amount)} <span className="text-sm">ر.ع</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">إجمالي المشتريات</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center cursor-pointer hover:border-amber-400/50" onClick={() => setInvStatus("pending")}>
          <p className="text-2xl font-bold text-amber-500">{invoiceStats.pending}</p>
          <p className="text-xs text-muted-foreground mt-0.5">معلقة</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center cursor-pointer hover:border-green-400/50" onClick={() => setInvStatus("approved")}>
          <p className="text-2xl font-bold text-green-600">{invoiceStats.done}</p>
          <p className="text-xs text-muted-foreground mt-0.5">مكتملة</p>
        </div>
      </div>

      {/* شريط الفلاتر */}
      <div className="flex flex-wrap gap-3 items-center bg-card p-4 border rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pr-9" placeholder="بحث بالمورد أو رقم الفاتورة..." value={invSearch} onChange={e => setInvSearch(e.target.value)} />
        </div>
        <Select value={invSupplier} onValueChange={setInvSupplier}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="كل الموردين" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الموردين</SelectItem>
            {allSuppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={invStatus} onValueChange={setInvStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending">معلقة</SelectItem>
            <SelectItem value="approved">مؤكدة</SelectItem>
            <SelectItem value="received">مستلمة</SelectItem>
            <SelectItem value="cancelled">ملغاة</SelectItem>
          </SelectContent>
        </Select>
        {(invSearch || invSupplier !== "all" || invStatus !== "all") && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setInvSearch(""); setInvSupplier("all"); setInvStatus("all"); }}>
            مسح الفلاتر ✕
          </Button>
        )}
        <Button className="gap-2 ms-auto" onClick={() => setShowCreate(true)} data-testid="button-new-purchase">
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
                <TableHead>{t("purchases.table_actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell>
                </TableRow>
              )}
              {filteredInvoices.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedInvoice(inv.id)} data-testid={`row-purchase-${inv.id}`}>
                  <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
                  <TableCell>{supplierMap[inv.supplierId] || "—"}</TableCell>
                  <TableCell>{inv.invoiceDate}</TableCell>
                  <TableCell className="font-mono">{omr(inv.grandTotal)} {t("common.omr")}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "pending" ? "outline" : "default"} className={inv.status === "pending" ? "border-amber-400 text-amber-600" : inv.status === "approved" ? "bg-green-600" : inv.status === "received" ? "bg-blue-600" : "bg-red-500"}>
                      {inv.status === "pending" ? t("purchases.pending") : inv.status === "approved" ? t("purchases.approved") : inv.status === "received" ? t("purchases.received") : t("purchases.cancelled")}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setSelectedInvoice(inv.id)}>
                      <FileText className="w-3.5 h-3.5" /> {t("purchases.open_invoice")}
                    </Button>
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
              <div className="space-y-1 col-span-2">
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
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.branch_label")}</label>
                <Select value={newBranchId} onValueChange={setNewBranchId}>
                  <SelectTrigger data-testid="select-new-branch"><SelectValue placeholder={t("purchases.select_branch")} /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.date")} *</label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} data-testid="input-new-date" />
              </div>
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
                  {(categories as any[]).filter(c => !c.parentId).map((parent: any) => [
                    <SelectItem key={parent.id} value={String(parent.id)} className="font-semibold">
                      {parent.name}
                    </SelectItem>,
                    ...(categories as any[]).filter(c => c.parentId === parent.id).map((child: any) => (
                      <SelectItem key={child.id} value={String(child.id)} className="pr-6 text-muted-foreground">
                        ↳ {child.name}
                      </SelectItem>
                    ))
                  ])}
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
      <PurchasesTab />
    </div>
  );
}
