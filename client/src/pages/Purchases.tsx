import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest, parseServerError } from "@/lib/queryClient";
import { fmtDate } from "@/lib/formatters";
import { Plus, Trash2, FileCheck, Package, Truck, Ship, FileText, AlertTriangle, Search, Edit, Building, UserPlus, FileSpreadsheet, X, Loader2, CheckCircle2, Upload, Printer } from "lucide-react";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
// Tabs removed — wizard uses inline add-row instead
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
      if (!res.ok) throw new Error(await parseServerError(res));
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
              <DateInput value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">{t("customers.statement_to")}</label>
              <DateInput value={to} onChange={e => setTo(e.target.value)} />
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
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardDirectApprove, setWizardDirectApprove] = useState(false);
  const [wizardSuccess, setWizardSuccess] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  // ── فلاتر قائمة الفواتير (يجب أن تكون هنا في الأعلى — قبل أي return شرطي) ──
  const [invSearch,   setInvSearch]   = useState("");
  const [invSupplier, setInvSupplier] = useState("all");
  const [invStatus,   setInvStatus]   = useState("all");
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
  const [attachUploading, setAttachUploading] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
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
  const [newPayMethod, setNewPayMethod] = useState("cash");
  const [newDueDate, setNewDueDate]     = useState("");
  const [newDiscount, setNewDiscount]   = useState("0");
  const [newDiscType, setNewDiscType]   = useState<"value"|"percent">("value");
  const [newVatRate, setNewVatRate]     = useState("0");
  const [modalItems, setModalItems]     = useState<Array<{uid:string;variantId:number|null;productId:number|null;name:string;barcode:string;color:string;size:string;qty:number;unitCost:number;sellPrice:number}>>([]);
  const [modalBarcode, setModalBarcode] = useState("");
  const [modalBarcodeLoading, setModalBarcodeLoading] = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [sortCol, setSortCol] = useState<"invoiceNumber"|"invoiceDate"|"grandTotal">("invoiceDate");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const modalBarcodeRef = useRef<HTMLInputElement>(null);

  const [addProductId, setAddProductId] = useState("");
  const [addVariantId, setAddVariantId] = useState<number | null>(null);
  const [addQty, setAddQty] = useState("");
  const [addUnitCost, setAddUnitCost] = useState("");
  const [addColor, setAddColor] = useState("");
  const [addSize, setAddSize] = useState("");
  const [addProductName, setAddProductName] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [addSearchOpen, setAddSearchOpen] = useState(false);

  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");

  // إضافة منتجات داخل نافذة الإنشاء
  const [modalManualProductId, setModalManualProductId] = useState("");
  const [modalManualVariantId, setModalManualVariantId] = useState<number | null>(null);
  const [modalManualQty, setModalManualQty] = useState("1");
  const [modalManualCost, setModalManualCost] = useState("");
  const [modalManualSellPrice, setModalManualSellPrice] = useState("");
  const [modalProductSearch, setModalProductSearch] = useState("");
  const [modalSearchOpen, setModalSearchOpen] = useState(false);
  // تبويب "إضافة يدوية" (منتج جديد أو مسجل)
  const [modalNewName, setModalNewName] = useState("");
  const [modalNewColor, setModalNewColor] = useState("");
  const [modalNewSize, setModalNewSize] = useState("");
  const [modalNewQty, setModalNewQty] = useState("1");
  const [modalNewCost, setModalNewCost] = useState("");
  const [modalNewSellPrice, setModalNewSellPrice] = useState("");
  const [modalNewSearchOpen, setModalNewSearchOpen] = useState(false);
  // تبويب الباركود — منتج تم إيجاده ينتظر تأكيد الكمية والسعر
  const [modalBarcodeFound, setModalBarcodeFound] = useState<{ variantId: number; productId: number; name: string; barcode: string; color: string; size: string; costDefault: string; priceDefault: string } | null>(null);
  const [modalBarcodeConfirmQty, setModalBarcodeConfirmQty] = useState("1");
  const [modalBarcodeConfirmCost, setModalBarcodeConfirmCost] = useState("");
  const [modalBarcodeConfirmSell, setModalBarcodeConfirmSell] = useState("");

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
      if (!res.ok) throw new Error(await parseServerError(res));
      return res.json();
    },
  });

  const { data: modalManualVariants = [] } = useQuery<ProductVariant[]>({
    queryKey: ["/api/products", modalManualProductId, "variants"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${modalManualProductId}/variants`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!modalManualProductId,
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
      if (!res.ok) throw new Error(await parseServerError(res));
      return res.json();
    },
    enabled: !!selectedInvoice,
  });

  const supplierMap = Object.fromEntries(allSuppliers.map(s => [s.id, s.name]));
  const productMap = Object.fromEntries(allProducts.map(p => [p.id, p.name]));

  // ── Modal totals ──────────────────────────────────────────────────────────
  const modalSubtotal  = modalItems.reduce((s, i) => s + i.qty * i.unitCost, 0);
  const modalDiscVal   = newDiscType === "value" ? parseFloat(newDiscount || "0") : modalSubtotal * parseFloat(newDiscount || "0") / 100;
  const modalAfterDisc = Math.max(0, modalSubtotal - modalDiscVal);
  const modalVat       = modalAfterDisc * parseFloat(newVatRate || "0") / 100;
  const modalGrandTotal = modalAfterDisc + modalVat + (parseFloat(newShipping||"0")||0) + (parseFloat(newCustoms||"0")||0) + (parseFloat(newClearance||"0")||0) + (parseFloat(newOther||"0")||0);

  async function handleModalBarcode(raw: string) {
    const barcode = raw.trim();
    if (!barcode) return;
    setModalBarcodeLoading(true);
    try {
      const res = await fetch(`/api/variants/barcode/${encodeURIComponent(barcode)}`, { credentials: "include" });
      if (res.ok) {
        const v = await res.json();
        // إذا كان المنتج موجوداً → اعرض لوحة التأكيد بدل الإضافة الفورية
        setModalBarcodeFound({ variantId: v.id, productId: v.productId, name: v.name || barcode, barcode: v.barcode || barcode, color: v.color || "", size: v.size || "", costDefault: v.costDefault || "0", priceDefault: v.priceDefault || "0" });
        setModalBarcodeConfirmQty("1");
        setModalBarcodeConfirmCost(v.costDefault || "");
        setModalBarcodeConfirmSell(v.priceDefault || "");
      } else {
        // الباركود غير موجود → افتح نافذة إنشاء منتج جديد
        setQpBarcode(barcode);
        setQpName(""); setQpColor(""); setQpSize(""); setQpPrice(""); setQpCost("");
        setShowQuickProduct(true);
        toast({ title: "الباركود غير موجود", description: `${barcode} — يمكنك إضافته كمنتج جديد`, variant: "destructive" });
      }
    } finally {
      setModalBarcodeLoading(false);
      setModalBarcode("");
    }
  }

  function confirmBarcodeItem() {
    if (!modalBarcodeFound) return;
    const v = modalBarcodeFound;
    setModalItems(prev => {
      const idx = prev.findIndex(i => i.variantId === v.variantId);
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, qty: i.qty + (parseInt(modalBarcodeConfirmQty) || 1), unitCost: parseFloat(modalBarcodeConfirmCost) || i.unitCost, sellPrice: parseFloat(modalBarcodeConfirmSell) || i.sellPrice } : i);
      return [...prev, { uid: crypto.randomUUID(), variantId: v.variantId, productId: v.productId, name: v.name, barcode: v.barcode, color: v.color, size: v.size, qty: parseInt(modalBarcodeConfirmQty) || 1, unitCost: parseFloat(modalBarcodeConfirmCost) || 0, sellPrice: parseFloat(modalBarcodeConfirmSell) || 0 }];
    });
    setModalBarcodeFound(null);
    setTimeout(() => modalBarcodeRef.current?.focus(), 50);
  }

  function resetCreate() {
    setShowCreate(false); setWizardStep(1); setWizardDirectApprove(false); setWizardSuccess(false);
    setNewSupplierId(""); setNewBranchId(""); setNewNotes(""); setNewDueDate("");
    setNewShipping("0"); setNewCustoms("0"); setNewClearance("0"); setNewOther("0");
    setNewPayMethod("cash"); setNewDiscount("0"); setNewVatRate("0"); setNewDate(new Date().toISOString().slice(0,10));
    setModalItems([]); setModalBarcode("");
    setModalManualProductId(""); setModalManualVariantId(null); setModalProductSearch("");
    setModalManualQty("1"); setModalManualCost(""); setModalManualSellPrice("");
    setModalNewName(""); setModalNewColor(""); setModalNewSize(""); setModalNewQty("1"); setModalNewCost(""); setModalNewSellPrice("");
    setModalBarcodeFound(null);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newSupplierId) throw new Error("اختر المورد");
      const res = await apiRequest("POST", "/api/purchases", {
        supplierId: Number(newSupplierId),
        // branchId مُتجاهل — القاعدة: المخزن المركزي دائماً
        invoiceDate: newDate,
        paymentMethod: newPayMethod,
        dueDate: newDueDate || null,
        discount: parseFloat(newDiscount || "0"),
        discountType: newDiscType,
        vatRate: parseFloat(newVatRate || "0"),
        vatAmount: modalVat,
        shippingCost: Number(newShipping) || 0,
        customsCost: Number(newCustoms) || 0,
        clearanceCost: Number(newClearance) || 0,
        otherCost: Number(newOther) || 0,
        notes: newNotes || null,
      });
      const inv = await res.json();
      for (const item of modalItems) {
        try {
          if (!item.productId && !item.variantId) {
            const qcRes = await apiRequest("POST", "/api/variants/quick-create", {
              productName: item.name || "صنف",
              barcode: item.barcode || null, color: item.color || null, size: item.size || null,
              price: item.sellPrice || item.unitCost || 0, costDefault: item.unitCost || 0,
            });
            const qcData = await qcRes.json();
            await apiRequest("POST", `/api/purchases/${inv.id}/items`, {
              productId: qcData.product.id, variantId: qcData.variant.id,
              qty: item.qty, unitCostBase: item.unitCost,
            });
          } else {
            await apiRequest("POST", `/api/purchases/${inv.id}/items`, {
              productId: item.productId, variantId: item.variantId,
              qty: item.qty, unitCostBase: item.unitCost,
            });
          }
        } catch {}
      }
      // إذا اعتماد مباشر → approve الفاتورة فوراً
      if (wizardDirectApprove) {
        await apiRequest("PATCH", `/api/purchases/${inv.id}/status`, { status: "approved" });
      }
      return inv;
    },
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["/api/purchases"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedInvoice(inv.id);
      if (wizardDirectApprove) {
        toast({ title: "تم اعتماد الفاتورة وتحديث المخزون ✓" });
        setWizardSuccess(true);
      } else {
        toast({ title: t("purchases.invoice_created") });
        resetCreate();
      }
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
      const productId = addProductId ? Number(addProductId) : null;
      const variantId = addVariantId;

      if (!productId) throw new Error("يرجى اختيار منتج من القائمة أولاً");

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
      setAddSearch("");
      setAddSearchOpen(false);
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
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setSelectedInvoice(null); // الرجوع لقائمة الفواتير
      toast({ title: t("purchases.invoice_received"), description: t("purchases.invoice_received_desc") });
    },
    onError: (e: Error) => toast({ title: t("purchases.approve_failed"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/purchases/${id}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchases"] });
      setShowDeleteConfirm(null);
      setSelectedIds(new Set());
      toast({ title: "تم حذف الفاتورة" });
    },
    onError: (e: Error) => toast({ title: t("common.error"), description: e.message, variant: "destructive" }),
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

      // حتى لو لم تُكتشف أصناف تلقائياً، ننتقل لمرحلة المراجعة لتمكين الإدخال اليدوي
      setOcrItems(items || []);
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
  // pending + approved قابلان للتعديل — received/cancelled مقفلان
  const isPending = invoiceDetail?.status === "pending" || invoiceDetail?.status === "approved";

  // حقول التكاليف الإضافية — local state لتجنب إعادة التحميل عند كل ضغطة
  const [localShipping,   setLocalShipping]   = useState("0");
  const [localCustoms,    setLocalCustoms]    = useState("0");
  const [localClearance,  setLocalClearance]  = useState("0");
  const [localOther,      setLocalOther]      = useState("0");
  useEffect(() => {
    if (invoiceDetail) {
      setLocalShipping(invoiceDetail.shippingCost   ?? "0");
      setLocalCustoms(invoiceDetail.customsCost     ?? "0");
      setLocalClearance(invoiceDetail.clearanceCost ?? "0");
      setLocalOther(invoiceDetail.otherCost         ?? "0");
    }
  }, [invoiceDetail?.id, invoiceDetail?.shippingCost, invoiceDetail?.customsCost, invoiceDetail?.clearanceCost, invoiceDetail?.otherCost]);
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
          <div className="flex items-center gap-2 flex-wrap">
            {/* ── زر رفع المرفقات (متعدد) ── */}
            <label className="cursor-pointer">
              <input type="file" accept="image/*,.pdf" multiple className="hidden"
                disabled={attachUploading}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length || !selectedInvoice) return;
                  e.target.value = "";
                  setAttachUploading(true);
                  try {
                    for (const file of files) {
                      const fd = new FormData();
                      fd.append("file", file);
                      const res = await fetch(`/api/purchases/${selectedInvoice}/attachment`, { method: "POST", body: fd, credentials: "include" });
                      const data = await res.json();
                      if (!data.ok) toast({ title: "فشل رفع " + file.name, description: data.error, variant: "destructive" });
                    }
                    qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
                    qc.invalidateQueries({ queryKey: ["/api/purchases"] });
                    toast({ title: `تم رفع ${files.length} مرفق ✓` });
                  } catch (err: any) {
                    toast({ title: "خطأ", description: err.message, variant: "destructive" });
                  } finally {
                    setAttachUploading(false);
                  }
                }} />
              <Button variant="outline" asChild disabled={attachUploading} className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
                <span>
                  {attachUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  رفع مرفقات {((invoiceDetail as any)?.attachmentUrls?.length > 0) && `(${(invoiceDetail as any).attachmentUrls.length})`}
                </span>
              </Button>
            </label>

            {/* عرض المرفقات الموجودة */}
            {((invoiceDetail as any)?.attachmentUrls?.length > 0) && (
              <Button variant="outline" size="sm" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => setShowAttachment(true)}>
                <FileText className="w-4 h-4" /> عرض المرفقات ({(invoiceDetail as any).attachmentUrls.length})
              </Button>
            )}

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
              {/* ── بحث حي عن المنتج ── */}
              <div className="space-y-3">
                <div className="flex gap-2 items-end">
                  {/* حقل البحث الحي */}
                  <div className="space-y-1 flex-1 relative">
                    <label className="text-sm font-medium">{t("purchases.product")}</label>
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input
                        className="pr-9"
                        placeholder="ابحث بالاسم أو الباركود أو SKU..."
                        value={addSearch}
                        data-testid="input-add-product-name"
                        onChange={e => {
                          setAddSearch(e.target.value);
                          setAddSearchOpen(true);
                          if (!e.target.value) { setAddProductId(""); setAddVariantId(null); setAddProductName(""); }
                        }}
                        onFocus={() => { if (addSearch) setAddSearchOpen(true); }}
                        onBlur={() => setTimeout(() => setAddSearchOpen(false), 180)}
                        autoComplete="off"
                      />
                    </div>
                    {/* Dropdown نتائج البحث */}
                    {addSearchOpen && addSearch.length >= 1 && (
                      <div className="absolute z-50 top-full mt-1 left-0 right-0 border rounded-lg bg-background shadow-lg max-h-56 overflow-y-auto">
                        {(() => {
                          const q = addSearch.toLowerCase();
                          const results = (allProducts as Product[]).filter(p =>
                            p.name.toLowerCase().includes(q) ||
                            (p as any).barcode?.toLowerCase().includes(q) ||
                            (p as any).sku?.toLowerCase().includes(q)
                          ).slice(0, 15);
                          return (
                            <>
                              {results.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="w-full text-right px-3 py-2 text-sm hover:bg-muted/60 transition-colors border-b last:border-0 flex items-center justify-between gap-2"
                                  onMouseDown={() => {
                                    setAddProductId(String(p.id));
                                    setAddProductName(p.name);
                                    setAddSearch(p.name);
                                    setAddVariantId(null);
                                    setAddColor(""); setAddSize("");
                                    setAddSearchOpen(false);
                                  }}
                                >
                                  <span className="font-medium">{p.name}</span>
                                  {(p as any).barcode && <span className="text-xs text-muted-foreground font-mono">{(p as any).barcode}</span>}
                                </button>
                              ))}
                              {/* خيار إضافة منتج جديد — فقط إذا لا توجد نتائج مطابقة تامة */}
                              {results.length === 0 && (
                                <button
                                  type="button"
                                  className="w-full text-right px-3 py-2.5 text-sm text-primary hover:bg-primary/5 flex items-center gap-2"
                                  onMouseDown={() => {
                                    setQpName(addSearch);
                                    setQpBarcode(""); setQpSku(""); setQpColor(""); setQpSize(""); setQpPrice(""); setQpCost("");
                                    setAddSearchOpen(false);
                                    setShowQuickProduct(true);
                                  }}
                                >
                                  <Plus className="w-4 h-4" />
                                  إضافة "{addSearch}" كمنتج جديد
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* مسح الباركود */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">&nbsp;</label>
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
                          const prod = (allProducts as Product[]).find(p => p.id === variant.productId);
                          const prodName = prod?.name || barcode;
                          setAddProductName(prodName);
                          setAddSearch(prodName);
                          toast({ title: "تم العثور على المنتج", description: `${prodName}${variant.color ? " — " + variant.color : ""}${variant.size ? " / " + variant.size : ""}` });
                        } else {
                          setQpBarcode(barcode);
                          setQpName(""); setQpColor(""); setQpSize(""); setQpPrice(""); setQpCost("");
                          setShowQuickProduct(true);
                          toast({ title: "الباركود غير موجود", description: `${barcode} — يمكنك إضافته كمنتج جديد`, variant: "destructive" });
                        }
                      } catch (e) {
                        toast({ title: t("common.error"), description: String(e), variant: "destructive" });
                      }
                    }} />
                  </div>
                </div>

                {/* المتغيرات (لون / مقاس / نوع) بعد اختيار المنتج */}
                {addProductId && productVariants.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground text-xs">اختر المتغير (لون / مقاس / نوع)</label>
                    <div className="flex flex-wrap gap-2">
                      {productVariants.map(v => {
                        const label = [v.color, v.size].filter(Boolean).join(" / ") || v.sku || v.barcode || `#${v.id}`;
                        const isSelected = addVariantId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            data-testid={`select-add-variant`}
                            onClick={() => {
                              setAddVariantId(v.id);
                              if (v.costDefault) setAddUnitCost(String(v.costDefault));
                              setAddColor(v.color || "");
                              setAddSize(v.size || "");
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted/50"}`}
                          >
                            {label}
                            {v.barcode && <span className="text-xs opacity-60 mr-1 font-mono">({v.barcode})</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* إضافة متغير جديد للمنتج المختار — فقط إذا لا يوجد متغيرات */}
                {addProductId && productVariants.length === 0 && (
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => {
                    const prod = (allProducts as Product[]).find(p => String(p.id) === addProductId);
                    if (prod) { setQpName(prod.name); setQpCategoryId((prod as any).categoryId ? String((prod as any).categoryId) : ""); setQpPrice(String((prod as any).price || "")); }
                    setQpBarcode(""); setQpColor(""); setQpSize(""); setQpCost("");
                    setShowQuickProduct(true);
                  }} data-testid="button-quick-create-variant">
                    <Plus className="w-3 h-3" /> إضافة متغير جديد لهذا المنتج
                  </Button>
                )}

                {/* الكمية + السعر + زر الإضافة */}
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1 w-28">
                    <label className="text-sm font-medium">{t("purchases.qty")}</label>
                    <Input type="number" min="1" value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="0" data-testid="input-add-qty" />
                  </div>
                  <div className="space-y-1 w-36">
                    <label className="text-sm font-medium">{t("purchases.unit_cost")}</label>
                    <Input type="number" step="0.001" min="0" value={addUnitCost} onChange={e => setAddUnitCost(e.target.value)} placeholder="0.000" data-testid="input-add-unit-cost" />
                  </div>
                  {addProductId && (
                    <div className="space-y-1 flex-1">
                      <label className="text-sm font-medium text-muted-foreground text-xs">المنتج المختار</label>
                      <p className="text-sm font-medium text-primary bg-primary/5 px-3 py-2 rounded-lg border border-primary/20 flex items-center justify-between">
                        {addProductName}
                        <button type="button" className="text-muted-foreground hover:text-red-500 mr-2" onClick={() => { setAddProductId(""); setAddProductName(""); setAddSearch(""); setAddVariantId(null); setAddColor(""); setAddSize(""); }}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </p>
                    </div>
                  )}
                  <Button onClick={() => addItemMutation.mutate()} disabled={!addProductId || !addQty || !addUnitCost || addItemMutation.isPending} data-testid="button-add-item"
                    className="bg-pink-500 hover:bg-pink-600 text-white">
                    <Plus className="w-4 h-4 ml-1" /> {t("purchases.add")}
                  </Button>
                </div>
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
                <Input type="number" step="0.001" value={localShipping} disabled={!isPending}
                  onChange={e => setLocalShipping(e.target.value)}
                  onBlur={e => updateCostsMutation.mutate({ shippingCost: Number(e.target.value) || 0 })}
                  data-testid="input-shipping-cost" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.customs")}</label>
                <Input type="number" step="0.001" value={localCustoms} disabled={!isPending}
                  onChange={e => setLocalCustoms(e.target.value)}
                  onBlur={e => updateCostsMutation.mutate({ customsCost: Number(e.target.value) || 0 })}
                  data-testid="input-customs-cost" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.clearance")}</label>
                <Input type="number" step="0.001" value={localClearance} disabled={!isPending}
                  onChange={e => setLocalClearance(e.target.value)}
                  onBlur={e => updateCostsMutation.mutate({ clearanceCost: Number(e.target.value) || 0 })}
                  data-testid="input-clearance-cost" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">{t("purchases.other")}</label>
                <Input type="number" step="0.001" value={localOther} disabled={!isPending}
                  onChange={e => setLocalOther(e.target.value)}
                  onBlur={e => updateCostsMutation.mutate({ otherCost: Number(e.target.value) || 0 })}
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

        {/* ── Dialog عرض الفاتورة الورقية المرفقة ── */}
        <Dialog open={showAttachment} onOpenChange={setShowAttachment}>
          <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0">
            <DialogHeader className="px-5 py-3.5 border-b flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                مرفقات الفاتورة — #{invoiceDetail?.invoiceNumber}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto p-4 flex flex-col gap-6">
              {((invoiceDetail as any)?.attachmentUrls?.length > 0
                ? (invoiceDetail as any).attachmentUrls
                : (invoiceDetail as any)?.attachmentUrl ? [(invoiceDetail as any).attachmentUrl] : []
              ).map((url: string, idx: number) => (
                <div key={idx} className="flex flex-col items-center gap-3 border rounded-xl p-4 bg-gray-50">
                  <div className="text-sm text-muted-foreground font-medium">مرفق {idx + 1}</div>
                  {url.toLowerCase().endsWith(".pdf") ? (
                    <iframe src={url} className="w-full h-[60vh] border rounded-lg" title={`مرفق ${idx + 1}`} />
                  ) : (
                    <img src={url} alt={`مرفق ${idx + 1}`} className="max-w-full max-h-[60vh] object-contain rounded-lg border shadow-sm" />
                  )}
                  <div className="flex gap-3">
                    <a href={url} download target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Upload className="w-4 h-4 rotate-180" /> تحميل
                      </Button>
                    </a>
                    <Button variant="outline" size="sm" className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        if (!selectedInvoice) return;
                        try {
                          const res = await fetch(`/api/purchases/${selectedInvoice}/attachment/${idx}`, { method: "DELETE", credentials: "include" });
                          const data = await res.json();
                          if (data.ok) {
                            qc.invalidateQueries({ queryKey: ["/api/purchases", selectedInvoice] });
                            qc.invalidateQueries({ queryKey: ["/api/purchases"] });
                            if (data.attachmentUrls?.length === 0) setShowAttachment(false);
                            toast({ title: "تم حذف المرفق" });
                          }
                        } catch (err: any) {
                          toast({ title: "فشل الحذف", description: err.message, variant: "destructive" });
                        }
                      }}>
                      <Trash2 className="w-4 h-4" /> حذف
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

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

            {/* تنبيه عند عدم اكتشاف أصناف تلقائياً */}
            {ocrItems.length === 0 && (
              <div className="p-3 rounded-lg border bg-amber-50 border-amber-300 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">لم يتم التعرف على الأصناف تلقائياً</p>
                  <p className="text-amber-700 text-xs mt-0.5">يمكنك إضافة الأصناف يدوياً باستخدام زر "إضافة صنف" أدناه، أو مراجعة النص المستخرج</p>
                  {ocrMeta?.rawText && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-amber-700 hover:text-amber-900 font-medium">عرض النص المستخرج من الصورة</summary>
                      <pre className="mt-1 text-xs bg-white border rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-gray-700">{ocrMeta.rawText}</pre>
                    </details>
                  )}
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
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileCheck className="w-5 h-5 text-green-600" /> تأكيد اعتماد الفاتورة
              </DialogTitle>
              <DialogDescription className="text-sm">
                سيتم تحديث المخزون وتكلفة المنتجات. لا يمكن التراجع عن هذا الإجراء.
              </DialogDescription>
            </DialogHeader>

            {/* ملخص مالي مختصر */}
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">عدد الأصناف</p>
                <p className="text-xl font-bold">{items.length}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">المجموع الفرعي</p>
                <p className="text-lg font-bold font-mono">{omr(itemsSubtotal)} <span className="text-sm">ر.ع</span></p>
              </div>
              {extraTotal > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-amber-600 mb-1">تكاليف إضافية</p>
                  <p className="text-lg font-bold font-mono text-amber-700">{omr(extraTotal)} <span className="text-sm">ر.ع</span></p>
                </div>
              )}
              <div className={`bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center ${extraTotal > 0 ? "" : "col-span-2"}`}>
                <p className="text-xs text-emerald-600 mb-1">الإجمالي النهائي</p>
                <p className="text-xl font-bold font-mono text-emerald-700">{omr(itemsSubtotal + extraTotal)} <span className="text-sm">ر.ع</span></p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPostConfirm(false)}>{t("common.cancel")}</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 gap-2" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} data-testid="button-confirm-approve">
                {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                {approveMutation.isPending ? "جاري الاعتماد..." : "اعتماد الفاتورة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── إحصائيات + فلاتر ──────────────────────────────────────────────────
  // ضمان أن invoices مصفوفة دائماً لتجنب أي crash
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const invoiceStats = {
    total:      safeInvoices.length,
    amount:     safeInvoices.reduce((s, i) => s + parseFloat(String((i as any).grandTotal || 0)), 0),
    pending:    safeInvoices.filter(i => i.status === "pending").length,
    pendingAmt: safeInvoices.filter(i => i.status === "pending").reduce((s, i) => s + parseFloat(String((i as any).grandTotal || 0)), 0),
    paidAmt:    safeInvoices.filter(i => i.status === "approved" || i.status === "received").reduce((s, i) => s + parseFloat(String((i as any).grandTotal || 0)), 0),
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = safeInvoices.filter(i => String((i as any).invoiceDate || "").startsWith(today)).length;

  const filteredInvoices = (safeInvoices as PurchaseInvoice[]).filter(inv => {
    if (invSearch) {
      const q = invSearch.toLowerCase();
      const name = supplierMap[inv.supplierId]?.toLowerCase() || "";
      if (!inv.invoiceNumber.toLowerCase().includes(q) && !name.includes(q)) return false;
    }
    if (invSupplier !== "all" && String(inv.supplierId) !== invSupplier) return false;
    if (invStatus   !== "all" && inv.status !== invStatus) return false;
    return true;
  });

  const sortedInvoices = [...filteredInvoices].sort((a: any, b: any) => {
    let av = a[sortCol] ?? ""; let bv = b[sortCol] ?? "";
    if (sortCol === "grandTotal") { av = parseFloat(String(av)); bv = parseFloat(String(bv)); }
    return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
  });

  // ══════════════════════════════════════════════════════════════
  // ── WIZARD إنشاء فاتورة مشتريات ──────────────────────────────
  // ══════════════════════════════════════════════════════════════
  if (showCreate) {
    const STEPS = [
      { num: 1, label: "المورد والتاريخ",       arabicNum: "١" },
      { num: 2, label: "المنتجات",              arabicNum: "٢" },
      { num: 3, label: "التكاليف الإضافية",    arabicNum: "٣" },
      { num: 4, label: "المراجعة والاعتماد",   arabicNum: "٤" },
    ];
    const canNext1 = !!newSupplierId;
    const canNext2 = modalItems.length > 0;
    const wSubtotal  = modalItems.reduce((s, i) => s + i.qty * i.unitCost, 0);
    const wDiscVal   = newDiscType === "value" ? parseFloat(newDiscount || "0") : wSubtotal * parseFloat(newDiscount || "0") / 100;
    const wAfterDisc = Math.max(0, wSubtotal - wDiscVal);
    const wVat       = wAfterDisc * parseFloat(newVatRate || "0") / 100;
    const wExtras    = (parseFloat(newShipping||"0")||0) + (parseFloat(newCustoms||"0")||0) + (parseFloat(newClearance||"0")||0) + (parseFloat(newOther||"0")||0);
    const wTotal     = wAfterDisc + wVat + wExtras;
    const supplierName = activeSuppliers.find(s => String(s.id) === newSupplierId)?.name || "—";
    const progWidth = wizardStep === 1 ? "0%" : wizardStep === 2 ? "33%" : wizardStep === 3 ? "66%" : "100%";
    const invNum = String(Date.now()).slice(-10);

    // ── شاشة النجاح بعد الاعتماد ──
    if (wizardSuccess) {
      return (
        <div dir="rtl" style={{ background: "#F7F7F5", minHeight: "100vh", padding: "16px" }}>
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#888780", marginBottom: "2px" }}>الموردون والمشتريات</div>
                <div style={{ fontSize: "18px", fontWeight: 600, color: "#2C2C2A" }}>فاتورة مشتريات جديدة</div>
              </div>
            </div>
            <div style={{ background: "#EAF3DE", border: "0.5px solid #C0DD97", borderRadius: "12px", padding: "36px", textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
              <div style={{ fontSize: "17px", fontWeight: 700, color: "#3B6D11", marginBottom: "4px" }}>تم اعتماد الفاتورة بنجاح!</div>
              <div style={{ fontSize: "13px", color: "#3B6D11", marginBottom: "20px" }}>تم تحديث المخزون المركزي تلقائيًا</div>
              <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                <button onClick={resetCreate}
                  style={{ background: "#D4527E", color: "white", border: "none", padding: "11px 22px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  + فاتورة جديدة
                </button>
                <button onClick={() => { setWizardSuccess(false); setShowCreate(false); }}
                  style={{ background: "white", color: "#2C2C2A", border: "0.5px solid #E5E3DC", padding: "11px 22px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>
                  العودة للفواتير
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div dir="rtl" style={{ background: "#F7F7F5", minHeight: "100vh", padding: "16px" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>

        {/* ── رأس الصفحة ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#888780", marginBottom: "2px" }}>الموردون والمشتريات</div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#2C2C2A" }}>فاتورة مشتريات جديدة</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ fontSize: "12px", color: "#888780", background: "white", border: "0.5px solid #E5E3DC", padding: "6px 12px", borderRadius: "8px" }}>PUR-{invNum}</div>
            <button onClick={resetCreate} style={{ background: "white", border: "0.5px solid #E5E3DC", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", color: "#888780", fontSize: "18px", lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div style={{ background: "white", border: "0.5px solid #E5E3DC", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
            <div style={{ position: "absolute", top: "18px", right: "8%", left: "8%", height: "2px", background: "#E5E3DC", zIndex: 0 }} />
            <div style={{ position: "absolute", top: "18px", right: "8%", height: "2px", background: "#D4527E", zIndex: 0, width: progWidth, transition: "width 0.4s" }} />
            {STEPS.map(s => {
              const done = wizardStep > s.num;
              const active = wizardStep === s.num;
              return (
                <div key={s.num} style={{ flex: 1, textAlign: "center", cursor: done ? "pointer" : "default", position: "relative", zIndex: 1 }}
                  onClick={() => { if (done) setWizardStep(s.num); }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: done ? "#27500A" : active ? "#D4527E" : "#E5E3DC", color: (done || active) ? "white" : "#888780", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: "13px", fontWeight: 600, transition: "all 0.3s" }}>
                    {done ? "✓" : s.arabicNum}
                  </div>
                  <div style={{ fontSize: "11px", marginTop: "6px", color: done ? "#27500A" : active ? "#D4527E" : "#888780", fontWeight: (active || done) ? 600 : 400 }}>
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ════ الخطوة 1 ════ */}
        {wizardStep === 1 && (
          <>
            <div style={{ background: "white", border: "0.5px solid #E5E3DC", borderRadius: "12px", padding: "24px", marginBottom: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#2C2C2A", marginBottom: "16px", paddingBottom: "10px", borderBottom: "0.5px solid #E5E3DC" }}>بيانات الفاتورة الأساسية</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#888780", display: "block", marginBottom: "6px" }}>المورد <span style={{ color: "#D4527E" }}>*</span></label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <select value={newSupplierId} onChange={e => setNewSupplierId(e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", border: `0.5px solid ${newSupplierId ? "#E5E3DC" : "#D4527E"}`, borderRadius: "8px", fontSize: "13px", appearance: "none", background: "white", color: newSupplierId ? "#2C2C2A" : "#888780", cursor: "pointer" }}>
                        <option value="">اختر المورد...</option>
                        {activeSuppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                      </select>
                      <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#888780", fontSize: "10px", pointerEvents: "none" }}>▼</span>
                    </div>
                    <button onClick={() => setShowQuickSupplier(true)} title="إضافة مورد جديد"
                      style={{ padding: "0 12px", border: "0.5px solid #E5E3DC", borderRadius: "8px", background: "white", cursor: "pointer", color: "#D4527E", fontSize: "18px", fontWeight: 600 }}>+</button>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#888780", display: "block", marginBottom: "6px" }}>وجهة التخزين</label>
                  <div style={{ padding: "10px 12px", border: "0.5px solid #E5E3DC", borderRadius: "8px", fontSize: "13px", background: "#EAF3DE", color: "#27500A", fontWeight: 500 }}>
                    🏭 المخزن المركزي (تلقائي)
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#888780", display: "block", marginBottom: "6px" }}>طريقة الدفع <span style={{ color: "#D4527E" }}>*</span></label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {[{ val: "cash", label: "نقدًا" }, { val: "bank_transfer", label: "تحويل" }, { val: "credit", label: "آجل" }].map(opt => (
                      <div key={opt.val} onClick={() => setNewPayMethod(opt.val)} style={{ flex: 1, padding: "10px", border: newPayMethod === opt.val ? "2px solid #D4527E" : "0.5px solid #E5E3DC", borderRadius: "8px", textAlign: "center", cursor: "pointer", background: newPayMethod === opt.val ? "#FBEAF0" : "white", fontSize: "12px", color: newPayMethod === opt.val ? "#72243E" : "#888780", fontWeight: newPayMethod === opt.val ? 600 : 400, transition: "all 0.15s" }}>
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#888780", display: "block", marginBottom: "6px" }}>التاريخ <span style={{ color: "#D4527E" }}>*</span></label>
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "0.5px solid #E5E3DC", borderRadius: "8px", fontSize: "13px", color: "#2C2C2A", background: "white" }} />
                </div>
                {newPayMethod === "credit" && (
                  <div>
                    <label style={{ fontSize: "12px", color: "#888780", display: "block", marginBottom: "6px" }}>تاريخ الاستحقاق</label>
                    <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", border: "0.5px solid #E5E3DC", borderRadius: "8px", fontSize: "13px", color: "#2C2C2A", background: "white" }} />
                  </div>
                )}
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ fontSize: "12px", color: "#888780", display: "block", marginBottom: "6px" }}>ملاحظات</label>
                  <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: "0.5px solid #E5E3DC", borderRadius: "8px", fontSize: "13px", resize: "none", height: "64px", color: "#2C2C2A", background: "white", fontFamily: "inherit" }}
                    placeholder="ملاحظات اختيارية..." />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <button onClick={() => setWizardStep(2)} disabled={!canNext1}
                style={{ background: canNext1 ? "#D4527E" : "#E5E3DC", color: canNext1 ? "white" : "#888780", border: "none", padding: "12px 28px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: canNext1 ? "pointer" : "not-allowed" }}>
                التالي — إضافة المنتجات →
              </button>
            </div>
          </>
        )}

        {/* ════ الخطوة 2 ════ */}
        {wizardStep === 2 && (
          <>
            <div style={{ background: "white", border: "0.5px solid #E5E3DC", borderRadius: "12px", padding: "24px", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", paddingBottom: "10px", borderBottom: "0.5px solid #E5E3DC" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#2C2C2A" }}>إضافة المنتجات</div>
                <div style={{ fontSize: "12px", color: "#888780" }}>{modalItems.length} منتجات • {modalItems.reduce((s, i) => s + i.qty, 0)} قطعة</div>
              </div>

              {/* صف إضافة منتج */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 65px 85px 70px 65px auto", gap: "8px", alignItems: "end", marginBottom: "14px", padding: "16px", background: "#F7F7F5", borderRadius: "8px" }}>
                <div style={{ position: "relative" }}>
                  <label style={{ fontSize: "11px", color: "#888780", display: "block", marginBottom: "4px" }}>المنتج / SKU / باركود</label>
                  <input type="text" placeholder="ابحث أو اكتب اسم المنتج..."
                    value={modalNewName}
                    onChange={e => { const v = e.target.value; setModalNewName(v); setModalProductSearch(v); setModalNewSearchOpen(true); if (!v) { setModalManualProductId(""); setModalManualVariantId(null); } }}
                    onFocus={() => { if (modalNewName) setModalNewSearchOpen(true); }}
                    onBlur={() => setTimeout(() => setModalNewSearchOpen(false), 180)}
                    autoComplete="off"
                    style={{ width: "100%", padding: "9px 10px", border: "0.5px solid #E5E3DC", borderRadius: "6px", fontSize: "12px", background: "white" }} />
                  {modalNewSearchOpen && modalNewName.length >= 1 && (
                    <div style={{ position: "absolute", zIndex: 50, top: "100%", marginTop: "2px", left: 0, right: 0, border: "0.5px solid #E5E3DC", borderRadius: "8px", background: "white", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", maxHeight: "200px", overflowY: "auto" }}>
                      {(() => {
                        const q = modalNewName.toLowerCase();
                        const results = (allProducts as Product[]).filter(p => p.name.toLowerCase().includes(q) || (p as any).barcode?.toLowerCase().includes(q) || (p as any).sku?.toLowerCase().includes(q)).slice(0, 12);
                        return results.length > 0 ? results.map(p => (
                          <div key={p.id}
                            onMouseDown={() => { setModalManualProductId(String(p.id)); setModalManualVariantId(null); setModalManualCost(""); setModalNewName(p.name); setModalProductSearch(p.name); setModalNewSearchOpen(false); }}
                            style={{ padding: "8px 12px", fontSize: "12px", cursor: "pointer", borderBottom: "0.5px solid #F7F7F5", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#2C2C2A" }}>
                            <span style={{ fontWeight: modalManualProductId === String(p.id) ? 600 : 400 }}>{p.name}</span>
                            <span style={{ fontSize: "11px", color: "#888780", background: "#EAF3DE", padding: "2px 6px", borderRadius: "4px" }}>مسجل ✓</span>
                          </div>
                        )) : (
                          <div style={{ padding: "8px 12px", fontSize: "12px", color: "#888780" }}>سيُضاف كمنتج جديد ← "{modalNewName}"</div>
                        );
                      })()}
                    </div>
                  )}
                  {modalManualProductId && (
                    <div style={{ marginTop: "4px", fontSize: "11px", color: "#27500A", background: "#EAF3DE", padding: "3px 8px", borderRadius: "4px", display: "inline-block" }}>✓ منتج مسجل</div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#888780", display: "block", marginBottom: "4px" }}>الكمية</label>
                  <input type="text" inputMode="numeric" value={modalManualQty} onChange={e => setModalManualQty(e.target.value.replace(/[^0-9]/g, ""))}
                    style={{ width: "100%", padding: "9px 6px", border: "0.5px solid #E5E3DC", borderRadius: "6px", fontSize: "12px", textAlign: "center", background: "white", direction: "ltr" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#888780", display: "block", marginBottom: "4px" }}>سعر الوحدة</label>
                  <input type="text" inputMode="decimal" value={modalManualCost} onChange={e => setModalManualCost(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0"
                    style={{ width: "100%", padding: "9px 6px", border: "0.5px solid #E5E3DC", borderRadius: "6px", fontSize: "12px", textAlign: "center", background: "white", direction: "ltr" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#888780", display: "block", marginBottom: "4px" }}>اللون</label>
                  <input type="text" value={modalNewColor} placeholder="—" onChange={e => setModalNewColor(e.target.value)}
                    style={{ width: "100%", padding: "9px 4px", border: "0.5px solid #E5E3DC", borderRadius: "6px", fontSize: "12px", textAlign: "center", background: "white" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#888780", display: "block", marginBottom: "4px" }}>المقاس</label>
                  <input type="text" value={modalNewSize} placeholder="—" onChange={e => setModalNewSize(e.target.value)}
                    style={{ width: "100%", padding: "9px 4px", border: "0.5px solid #E5E3DC", borderRadius: "6px", fontSize: "12px", textAlign: "center", background: "white" }} />
                </div>
                <button
                  disabled={!modalNewName.trim() || !modalManualQty}
                  onClick={() => {
                    const prod = (allProducts as Product[]).find(p => String(p.id) === modalManualProductId);
                    const variant = modalManualVariants.find(v => v.id === modalManualVariantId);
                    if (modalManualProductId && prod) {
                      setModalItems(prev => {
                        if (modalManualVariantId) { const ex = prev.findIndex(i => i.variantId === modalManualVariantId); if (ex >= 0) return prev.map((i, n) => n === ex ? { ...i, qty: i.qty + (parseInt(modalManualQty)||1), unitCost: parseFloat(modalManualCost)||i.unitCost } : i); }
                        return [...prev, { uid: crypto.randomUUID(), variantId: modalManualVariantId, productId: Number(modalManualProductId), name: prod.name, barcode: variant?.barcode || "", color: modalNewColor || variant?.color || "", size: modalNewSize, qty: parseInt(modalManualQty)||1, unitCost: parseFloat(modalManualCost)||0, sellPrice: 0 }];
                      });
                    } else {
                      setModalItems(prev => [...prev, { uid: crypto.randomUUID(), variantId: null, productId: null, name: modalNewName.trim(), barcode: "", color: modalNewColor, size: modalNewSize, qty: parseInt(modalManualQty)||1, unitCost: parseFloat(modalManualCost)||0, sellPrice: 0 }]);
                    }
                    setModalNewName(""); setModalProductSearch(""); setModalManualProductId(""); setModalManualVariantId(null); setModalManualQty("1"); setModalManualCost(""); setModalNewSize(""); setModalNewColor(""); setModalManualSellPrice("");
                  }}
                  style={{ background: (!modalNewName.trim() || !modalManualQty) ? "#E5E3DC" : "#D4527E", color: (!modalNewName.trim() || !modalManualQty) ? "#888780" : "white", border: "none", padding: "9px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: (!modalNewName.trim() || !modalManualQty) ? "not-allowed" : "pointer", whiteSpace: "nowrap", alignSelf: "end" }}>
                  + إضافة
                </button>
              </div>

              {/* باركود */}
              {modalBarcodeFound ? (
                <div style={{ border: "0.5px solid #C0DD97", borderRadius: "8px", background: "#EAF3DE", padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "120px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#27500A" }}>✓ {modalBarcodeFound.name}</div>
                    <div style={{ fontSize: "11px", color: "#3B6D11", fontFamily: "monospace" }}>{modalBarcodeFound.barcode}{modalBarcodeFound.color && ` · ${modalBarcodeFound.color}`}{modalBarcodeFound.size && ` · ${modalBarcodeFound.size}`}</div>
                  </div>
                  <input type="number" value={modalBarcodeConfirmQty} min="1" onChange={e => setModalBarcodeConfirmQty(e.target.value)}
                    style={{ width: "65px", padding: "7px", border: "0.5px solid #C0DD97", borderRadius: "6px", fontSize: "12px", textAlign: "center", background: "white" }} placeholder="الكمية" />
                  <input type="number" value={modalBarcodeConfirmCost} step="0.001" onChange={e => setModalBarcodeConfirmCost(e.target.value)}
                    style={{ width: "90px", padding: "7px", border: "0.5px solid #C0DD97", borderRadius: "6px", fontSize: "12px", background: "white" }} placeholder="السعر" />
                  <button onClick={confirmBarcodeItem} style={{ background: "#27500A", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>تأكيد +</button>
                  <button onClick={() => setModalBarcodeFound(null)} style={{ background: "none", border: "none", color: "#888780", cursor: "pointer", fontSize: "18px", padding: "0 4px" }}>✕</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <input ref={modalBarcodeRef} type="text" value={modalBarcode} onChange={e => setModalBarcode(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleModalBarcode(modalBarcode); } }}
                    placeholder="امسح باركود هنا..." dir="ltr"
                    style={{ width: "190px", padding: "8px 10px", border: "0.5px solid #E5E3DC", borderRadius: "6px", fontSize: "12px", fontFamily: "monospace", background: "white" }} />
                  <button onClick={() => handleModalBarcode(modalBarcode)} disabled={modalBarcodeLoading || !modalBarcode.trim()}
                    style={{ padding: "8px 12px", border: "0.5px solid #E5E3DC", borderRadius: "6px", background: "white", fontSize: "12px", cursor: modalBarcode.trim() ? "pointer" : "not-allowed", color: "#888780" }}>
                    {modalBarcodeLoading ? "⏳" : "🔍 بحث"}
                  </button>
                  <BarcodeScanButton onScan={handleModalBarcode} />
                </div>
              )}

              {/* جدول المنتجات */}
              {modalItems.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "0.5px solid #E5E3DC" }}>
                      <td style={{ padding: "8px 6px", color: "#888780", fontWeight: 500 }}>#</td>
                      <td style={{ padding: "8px 6px", color: "#888780", fontWeight: 500 }}>المنتج</td>
                      <td style={{ padding: "8px 6px", color: "#888780", fontWeight: 500, textAlign: "center" }}>اللون</td>
                      <td style={{ padding: "8px 6px", color: "#888780", fontWeight: 500, textAlign: "center" }}>المقاس</td>
                      <td style={{ padding: "8px 6px", color: "#888780", fontWeight: 500, textAlign: "center" }}>الكمية</td>
                      <td style={{ padding: "8px 6px", color: "#888780", fontWeight: 500, textAlign: "center" }}>سعر الوحدة</td>
                      <td style={{ padding: "8px 6px", color: "#888780", fontWeight: 500, textAlign: "left" }}>الإجمالي</td>
                      <td style={{ padding: "8px 6px" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {modalItems.map((item, idx) => (
                      <tr key={item.uid} style={{ borderBottom: "0.5px solid #E5E3DC" }}>
                        <td style={{ padding: "8px 6px", color: "#888780" }}>{idx + 1}</td>
                        <td style={{ padding: "8px 6px", fontWeight: 500, color: "#2C2C2A" }}>{item.name}</td>
                        <td style={{ padding: "8px 6px", textAlign: "center" }}>
                          <input type="text" value={item.color || ""}
                            onChange={e => setModalItems(prev => prev.map(i => i.uid === item.uid ? { ...i, color: e.target.value } : i))}
                            style={{ width: "60px", padding: "4px", border: "0.5px solid #E5E3DC", borderRadius: "4px", fontSize: "11px", textAlign: "center" }} placeholder="—" />
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "center" }}>
                          <input type="text" value={item.size || ""}
                            onChange={e => setModalItems(prev => prev.map(i => i.uid === item.uid ? { ...i, size: e.target.value } : i))}
                            style={{ width: "55px", padding: "4px", border: "0.5px solid #E5E3DC", borderRadius: "4px", fontSize: "11px", textAlign: "center" }} placeholder="—" />
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "center" }}>
                          <input type="text" inputMode="numeric" value={item.qty}
                            onChange={e => setModalItems(prev => prev.map(i => i.uid === item.uid ? { ...i, qty: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 1 } : i))}
                            style={{ width: "55px", padding: "4px", border: "0.5px solid #E5E3DC", borderRadius: "4px", fontSize: "12px", textAlign: "center", direction: "ltr" }} />
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "center" }}>
                          <input type="text" inputMode="decimal" value={item.unitCost}
                            onChange={e => setModalItems(prev => prev.map(i => i.uid === item.uid ? { ...i, unitCost: parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0 } : i))}
                            style={{ width: "80px", padding: "4px", border: "0.5px solid #E5E3DC", borderRadius: "4px", fontSize: "12px", textAlign: "center", fontFamily: "monospace", direction: "ltr" }} />
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "left", fontFamily: "monospace", color: "#D4527E", fontWeight: 600 }}>ر.ع {omr(item.qty * item.unitCost)}</td>
                        <td style={{ padding: "8px 6px" }}>
                          <button onClick={() => setModalItems(prev => prev.filter(i => i.uid !== item.uid))}
                            style={{ background: "none", border: "none", color: "#CCCCCC", cursor: "pointer", fontSize: "16px" }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "1px solid #E5E3DC", background: "#F7F7F5" }}>
                      <td colSpan={4} style={{ padding: "10px 6px", fontWeight: 600, fontSize: "12px", color: "#2C2C2A" }}>الإجمالي الفرعي</td>
                      <td style={{ padding: "10px 6px", textAlign: "center", fontWeight: 600 }}>{modalItems.reduce((s, i) => s + i.qty, 0)}</td>
                      <td />
                      <td style={{ padding: "10px 6px", textAlign: "left", fontWeight: 700, color: "#D4527E", fontFamily: "monospace" }}>ر.ع {omr(wSubtotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div style={{ textAlign: "center", padding: "32px", color: "#888780" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px", opacity: 0.3 }}>📦</div>
                  <div style={{ fontSize: "13px" }}>لم تتم إضافة أي منتجات بعد</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setWizardStep(1)} style={{ background: "white", color: "#2C2C2A", border: "0.5px solid #E5E3DC", padding: "12px 24px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>← رجوع</button>
              <button onClick={() => setWizardStep(3)} disabled={!canNext2}
                style={{ background: canNext2 ? "#D4527E" : "#E5E3DC", color: canNext2 ? "white" : "#888780", border: "none", padding: "12px 28px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: canNext2 ? "pointer" : "not-allowed" }}>
                التالي — التكاليف الإضافية →
              </button>
            </div>
          </>
        )}

        {/* ════ الخطوة 3 ════ */}
        {wizardStep === 3 && (
          <>
            <div style={{ background: "white", border: "0.5px solid #E5E3DC", borderRadius: "12px", padding: "24px", marginBottom: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#2C2C2A", paddingBottom: "10px", borderBottom: "0.5px solid #E5E3DC", marginBottom: "4px" }}>
                التكاليف الإضافية <span style={{ fontSize: "11px", fontWeight: 400, color: "#888780" }}>(اختيارية)</span>
              </div>
              <div style={{ paddingTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {[
                  { label: "الشحن", val: newShipping, set: setNewShipping },
                  { label: "الجمارك", val: newCustoms, set: setNewCustoms },
                  { label: "التخليص", val: newClearance, set: setNewClearance },
                  { label: "أخرى", val: newOther, set: setNewOther },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label style={{ fontSize: "12px", color: "#888780", display: "block", marginBottom: "6px" }}>{label}</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", color: "#888780", whiteSpace: "nowrap" }}>ر.ع</span>
                      <input type="text" inputMode="decimal" value={val} onChange={e => set(e.target.value.replace(/[^0-9.]/g, ""))}
                        style={{ flex: 1, padding: "10px 12px", border: "0.5px solid #E5E3DC", borderRadius: "8px", fontSize: "13px", background: "white", direction: "ltr" }} />
                    </div>
                  </div>
                ))}
              </div>
              {/* ملخص 3 أعمدة */}
              <div style={{ marginTop: "16px", padding: "16px", background: "#F7F7F5", borderRadius: "8px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#888780", marginBottom: "4px" }}>المجموع الفرعي</div>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: "#2C2C2A", fontFamily: "monospace" }}>ر.ع {omr(wSubtotal)}</div>
                </div>
                <div style={{ borderRight: "0.5px solid #E5E3DC", borderLeft: "0.5px solid #E5E3DC" }}>
                  <div style={{ fontSize: "11px", color: "#888780", marginBottom: "4px" }}>التكاليف الإضافية</div>
                  <div style={{ fontSize: "14px", fontWeight: 500, color: "#BA7517", fontFamily: "monospace" }}>ر.ع {omr(wExtras)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#888780", marginBottom: "4px" }}>الإجمالي النهائي</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#D4527E", fontFamily: "monospace" }}>ر.ع {omr(wTotal)}</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setWizardStep(2)} style={{ background: "white", color: "#2C2C2A", border: "0.5px solid #E5E3DC", padding: "12px 24px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>← رجوع</button>
              <button onClick={() => setWizardStep(4)} style={{ background: "#D4527E", color: "white", border: "none", padding: "12px 28px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>التالي — المراجعة والاعتماد →</button>
            </div>
          </>
        )}

        {/* ════ الخطوة 4 ════ */}
        {wizardStep === 4 && (
          <>
            <div style={{ background: "white", border: "0.5px solid #E5E3DC", borderRadius: "12px", padding: "24px", marginBottom: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#2C2C2A", marginBottom: "16px", paddingBottom: "10px", borderBottom: "0.5px solid #E5E3DC" }}>مراجعة الفاتورة قبل الاعتماد</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                <div style={{ background: "#F7F7F5", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ fontSize: "11px", color: "#888780", marginBottom: "8px", fontWeight: 500 }}>بيانات الفاتورة</div>
                  <div style={{ fontSize: "12px", color: "#2C2C2A", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#888780" }}>ا��مورد</span><span style={{ fontWeight: 500 }}>{supplierName}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#888780" }}>الطريقة</span><span style={{ fontWeight: 500 }}>{newPayMethod === "cash" ? "نقدًا" : newPayMethod === "bank_transfer" ? "تحويل" : "آجل"}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#888780" }}>التاريخ</span><span style={{ fontWeight: 500 }}>{newDate}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#888780" }}>التخزين</span><span style={{ fontWeight: 500, color: "#3B6D11" }}>المخزن المركزي</span></div>
                    {newNotes && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#888780" }}>ملاحظات</span><span style={{ fontWeight: 500, maxWidth: "140px", textAlign: "left", wordBreak: "break-word" }}>{newNotes}</span></div>}
                  </div>
                </div>
                <div style={{ background: "#F7F7F5", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ fontSize: "11px", color: "#888780", marginBottom: "8px", fontWeight: 500 }}>ملخص مالي</div>
                  <div style={{ fontSize: "12px", color: "#2C2C2A", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#888780" }}>عدد الأصناف</span><span style={{ fontWeight: 500 }}>{modalItems.length}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#888780" }}>المجموع الفرعي</span><span style={{ fontWeight: 500, fontFamily: "monospace" }}>ر.ع {omr(wSubtotal)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#888780" }}>التكاليف الإضافية</span><span style={{ fontWeight: 500, color: "#BA7517", fontFamily: "monospace" }}>ر.ع {omr(wExtras)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "0.5px solid #E5E3DC", paddingTop: "6px", marginTop: "2px" }}>
                      <span style={{ fontWeight: 600 }}>الإجمالي النهائي</span>
                      <span style={{ fontWeight: 700, color: "#D4527E", fontFamily: "monospace" }}>ر.ع {omr(wTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* جدول الأصناف */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", color: "#888780", marginBottom: "8px", fontWeight: 500 }}>الأصناف ({modalItems.length})</div>
                {modalItems.length > 0 ? (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ borderBottom: "0.5px solid #E5E3DC" }}>
                        <td style={{ padding: "6px", color: "#888780" }}>#</td>
                        <td style={{ padding: "6px", color: "#888780" }}>المنتج</td>
                        <td style={{ padding: "6px", color: "#888780", textAlign: "center" }}>الكمية</td>
                        <td style={{ padding: "6px", color: "#888780", textAlign: "center" }}>سعر الوحدة</td>
                        <td style={{ padding: "6px", color: "#888780", textAlign: "left" }}>الإجمالي</td>
                      </tr>
                    </thead>
                    <tbody>
                      {modalItems.map((item, idx) => (
                        <tr key={item.uid} style={{ borderBottom: "0.5px solid #E5E3DC" }}>
                          <td style={{ padding: "6px", color: "#888780" }}>{idx + 1}</td>
                          <td style={{ padding: "6px", fontWeight: 500, color: "#2C2C2A" }}>{item.name}{item.size && <span style={{ fontSize: "11px", color: "#888780", marginRight: "4px" }}>({item.size})</span>}</td>
                          <td style={{ padding: "6px", textAlign: "center" }}>{item.qty}</td>
                          <td style={{ padding: "6px", textAlign: "center", fontFamily: "monospace" }}>{omr(item.unitCost)}</td>
                          <td style={{ padding: "6px", textAlign: "left", fontFamily: "monospace", color: "#D4527E", fontWeight: 600 }}>ر.ع {omr(item.qty * item.unitCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: "center", padding: "16px", color: "#888780", fontSize: "12px" }}>لم يتم إضافة منتجات</div>
                )}
              </div>
              {/* بانر التحقق */}
              <div style={{ background: "#EAF3DE", border: "0.5px solid #C0DD97", borderRadius: "8px", padding: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#3B6D11", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "white", fontSize: "11px", fontWeight: 700 }}>✓</span>
                </div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#3B6D11" }}>جميع التحققات ناجحة — بإمكانك الاعتماد</div>
                  <div style={{ fontSize: "11px", color: "#3B6D11", marginTop: "2px" }}>سيتم تحديث المخزون المركزي تلقائيًا بعد الاعتماد</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setWizardStep(3)} style={{ background: "white", color: "#2C2C2A", border: "0.5px solid #E5E3DC", padding: "12px 24px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>← رجوع</button>
              <div style={{ display: "flex", gap: "8px" }}>
                <button disabled={createMutation.isPending} onClick={() => { setWizardDirectApprove(false); createMutation.mutate(); }}
                  style={{ background: "white", color: "#2C2C2A", border: "0.5px solid #E5E3DC", padding: "12px 20px", borderRadius: "8px", fontSize: "13px", cursor: createMutation.isPending ? "not-allowed" : "pointer", opacity: createMutation.isPending ? 0.6 : 1 }}>
                  {createMutation.isPending && !wizardDirectApprove ? "جاري الحفظ..." : "حفظ كمسودة"}
                </button>
                <button disabled={createMutation.isPending || modalItems.length === 0} onClick={() => { setWizardDirectApprove(true); createMutation.mutate(); }}
                  style={{ background: "#27500A", color: "white", border: "none", padding: "12px 28px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: (createMutation.isPending || modalItems.length === 0) ? "not-allowed" : "pointer", opacity: (createMutation.isPending || modalItems.length === 0) ? 0.6 : 1 }}>
                  {createMutation.isPending && wizardDirectApprove ? "جاري الاعتماد..." : "اعتماد الفاتورة وتحديث المخزون"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Dialog: إضافة مورد سريع */}
        <Dialog open={showQuickSupplier} onOpenChange={setShowQuickSupplier}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{t("purchases.quick_supplier")}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1"><label className="text-sm font-medium">{t("purchases.supplier_name")} *</label><Input value={quickName} onChange={e => setQuickName(e.target.value)} /></div>
              <div className="space-y-1"><label className="text-sm font-medium">{t("purchases.phone")}</label><Input value={quickPhone} onChange={e => setQuickPhone(e.target.value)} placeholder="+968..." /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowQuickSupplier(false)}>{t("common.cancel")}</Button>
              <Button onClick={() => quickSupplierMutation.mutate()} disabled={!quickName.trim() || quickSupplierMutation.isPending}>{quickSupplierMutation.isPending ? t("common.loading") : t("common.add")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        </div>
      </div>
    );
  }
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold">{invoiceStats.total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">إجمالي الفواتير</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-primary">{omr(invoiceStats.amount)} <span className="text-sm">ر.ع</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">إجمالي المشتريات</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center cursor-pointer hover:border-amber-400/50" onClick={() => setInvStatus("pending")}>
          <p className="text-xl font-bold text-amber-500">{invoiceStats.pending} <span className="text-sm font-normal">({omr(invoiceStats.pendingAmt)})</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">المبالغ المعلقة</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center cursor-pointer hover:border-green-400/50" onClick={() => { setInvStatus("approved"); }}>
          <p className="text-lg font-bold text-green-600">{omr(invoiceStats.paidAmt)} <span className="text-sm">ر.ع</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">إجمالي المدفوع</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{todayCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">فواتير اليوم</p>
        </div>
        <div className="bg-card border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-purple-600">{allSuppliers.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">عدد الموردين</p>
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
        <Button className="gap-2 ms-auto" style={{ background: "#D4527E" }} onClick={() => { setWizardStep(1); setShowCreate(true); }} data-testid="button-new-purchase">
          <Plus className="w-4 h-4" /> {t("purchases.new_purchase")}
        </Button>
      </div>

      {/* شريط الحذف الجماعي */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} فاتورة محددة</span>
          <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => setShowBulkDelete(true)}>
            <Trash2 className="w-3 h-3" /> حذف المحددة
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>إلغاء التحديد</Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" className="h-4 w-4 cursor-pointer"
                    checked={sortedInvoices.length > 0 && sortedInvoices.every(i => selectedIds.has(i.id))}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(sortedInvoices.map(i => i.id)) : new Set())}
                  />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => { setSortCol("invoiceNumber"); setSortDir(d => sortCol === "invoiceNumber" && d === "asc" ? "desc" : "asc"); }}>
                  # {sortCol === "invoiceNumber" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </TableHead>
                <TableHead>{t("purchases.supplier")}</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => { setSortCol("invoiceDate"); setSortDir(d => sortCol === "invoiceDate" && d === "asc" ? "desc" : "asc"); }}>
                  {t("purchases.date")} {sortCol === "invoiceDate" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => { setSortCol("grandTotal"); setSortDir(d => sortCol === "grandTotal" && d === "asc" ? "desc" : "asc"); }}>
                  {t("purchases.grand_total")} {sortCol === "grandTotal" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </TableHead>
                <TableHead>طريقة الدفع</TableHead>
                <TableHead>تاريخ الاستحقاق</TableHead>
                <TableHead>{t("purchases.status")}</TableHead>
                <TableHead className="w-10 text-center" title="مرفق ورقي"><Upload className="w-3.5 h-3.5 mx-auto" /></TableHead>
                <TableHead>{t("purchases.table_actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedInvoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell>
                </TableRow>
              )}
              {sortedInvoices.map((inv) => (
                <TableRow key={inv.id} className={`cursor-pointer hover:bg-muted/30 ${selectedIds.has(inv.id) ? "bg-primary/5" : ""}`} onClick={() => setSelectedInvoice(inv.id)} data-testid={`row-purchase-${inv.id}`}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="h-4 w-4 cursor-pointer"
                      checked={selectedIds.has(inv.id)}
                      onChange={e => { e.stopPropagation(); setSelectedIds(prev => { const s = new Set(prev); e.target.checked ? s.add(inv.id) : s.delete(inv.id); return s; }); }}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
                  <TableCell>{supplierMap[inv.supplierId] || "—"}</TableCell>
                  <TableCell>{inv.invoiceDate}</TableCell>
                  <TableCell className="font-mono">{omr(inv.grandTotal)} {t("common.omr")}</TableCell>
                  <TableCell>
                    {(inv as any).paymentMethod === "cash" && <Badge variant="outline" className="text-xs border-emerald-400 text-emerald-700">نقداً</Badge>}
                    {(inv as any).paymentMethod === "bank_transfer" && <Badge variant="outline" className="text-xs border-blue-400 text-blue-700">تحويل بنكي</Badge>}
                    {(inv as any).paymentMethod === "cheque" && <Badge variant="outline" className="text-xs border-purple-400 text-purple-700">شيك</Badge>}
                    {(inv as any).paymentMethod === "credit" && <Badge variant="outline" className="text-xs border-orange-400 text-orange-700">آجل</Badge>}
                    {!(inv as any).paymentMethod && <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {(inv as any).dueDate ? (
                      <span className={(inv as any).paymentMethod === "credit" ? "text-orange-600 font-medium" : "text-muted-foreground"}>
                        {(inv as any).dueDate}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "pending" ? "outline" : "default"} className={inv.status === "pending" ? "border-amber-400 text-amber-600" : inv.status === "approved" ? "bg-green-600" : inv.status === "received" ? "bg-blue-600" : "bg-red-500"}>
                      {inv.status === "pending" ? t("purchases.pending") : inv.status === "approved" ? t("purchases.approved") : inv.status === "received" ? t("purchases.received") : t("purchases.cancelled")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {(inv as any).attachmentUrl
                      ? <span title="يوجد فاتورة ورقية مرفقة"><FileText className="w-4 h-4 text-emerald-500 mx-auto" /></span>
                      : <span className="text-muted-foreground/30 text-xs">—</span>}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()} className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs h-8" onClick={() => setSelectedInvoice(inv.id)}>
                      <FileText className="w-3.5 h-3.5" /> {t("purchases.open_invoice")}
                    </Button>
                    {inv.status === "pending" && canManage && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700" onClick={() => setShowDeleteConfirm(inv.id)} title="حذف">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

      {/* تأكيد حذف فردي */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-5 h-5" /> تأكيد الحذف</DialogTitle>
            <DialogDescription>سيتم حذف الفاتورة نهائياً. لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => { if (showDeleteConfirm) deleteMutation.mutate(showDeleteConfirm); }} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? t("common.loading") : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد حذف جماعي */}
      <Dialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-5 h-5" /> حذف {selectedIds.size} فاتورة</DialogTitle>
            <DialogDescription>سيتم حذف الفواتير المعلقة المحددة فقط. هذا الإجراء لا يمكن التراجع عنه.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDelete(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={async () => {
              for (const id of Array.from(selectedIds)) {
                const inv = safeInvoices.find(i => i.id === id);
                if (inv?.status === "pending") await deleteMutation.mutateAsync(id).catch(() => {});
              }
              setShowBulkDelete(false);
              setSelectedIds(new Set());
            }}>
              حذف المحددة
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
