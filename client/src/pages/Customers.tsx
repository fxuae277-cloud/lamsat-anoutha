import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Customer, Branch } from "@shared/schema";
import { format } from "date-fns";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Users, UserPlus, Search, Phone, ShoppingBag, MoreHorizontal,
  Eye, Edit2, Trash2, FileText, Printer, Download, MessageSquare,
  Star, UserCheck, UserX, ArrowUpDown, ChevronLeft, ChevronRight,
  RotateCcw, Store,
} from "lucide-react";

type KpiData = {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  newThisMonth: number;
  totalPurchases: number;
  topCustomer: { id: number; name: string; phone: string; total_spent: string } | null;
};

type CustomerDetail = Customer & {
  invoices: any[];
  returns: any[];
  topBranch: string | null;
  returnsTotal: number;
  returnsCount: number;
  avgInvoice: number;
};

type StatementData = {
  customer: Customer;
  entries: any[];
  summary: {
    totalSales: number;
    totalReturns: number;
    netAmount: number;
    operationCount: number;
    avgInvoice: number;
    salesCount: number;
    returnsCount: number;
  };
};

const PAGE_SIZE = 15;

export default function Customers() {
  const { t } = useI18n();
  const { data } = useAuth();
  const user = data?.user;
  const { toast } = useToast();
  const isOwner = user?.role === "owner" || user?.role === "admin";

  const [search, setSearch] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [sortBy, setSortBy] = useState<string>("lastVisit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [detailCustomerId, setDetailCustomerId] = useState<number | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [statementCustomerId, setStatementCustomerId] = useState<number | null>(null);
  const [stmtFrom, setStmtFrom] = useState("");
  const [stmtTo, setStmtTo] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const [addForm, setAddForm] = useState({ name: "", phone: "", notes: "", branchId: "", active: true });
  const [editForm, setEditForm] = useState({ name: "", phone: "", notes: "", branchId: "", active: true });

  const printRef = useRef<HTMLDivElement>(null);

  const { data: kpis } = useQuery<KpiData>({
    queryKey: ["/api/customers/kpis"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: customerDetail } = useQuery<CustomerDetail>({
    queryKey: [`/api/customers/${detailCustomerId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!detailCustomerId,
  });

  const stmtQueryStr = statementCustomerId
    ? `/api/customers/${statementCustomerId}/statement${stmtFrom || stmtTo ? `?${stmtFrom ? `from=${stmtFrom}` : ""}${stmtFrom && stmtTo ? "&" : ""}${stmtTo ? `to=${stmtTo}` : ""}` : ""}`
    : "";
  const { data: statementData } = useQuery<StatementData>({
    queryKey: [stmtQueryStr],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!statementCustomerId && isStatementOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/customers", data);
      if (!res.ok) { const body = await res.json(); throw new Error(body.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/kpis"] });
      setIsAddOpen(false);
      setAddForm({ name: "", phone: "", notes: "", branchId: "", active: true });
      toast({ title: t("customers.customer_created") });
    },
    onError: (err: Error) => {
      toast({ title: err.message === "phone_exists" ? t("customers.phone_exists") : t("customers.error"), description: err.message !== "phone_exists" ? err.message : undefined, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/customers/${id}`, data);
      if (!res.ok) { const body = await res.json(); throw new Error(body.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/kpis"] });
      if (detailCustomerId) queryClient.invalidateQueries({ queryKey: [`/api/customers/${detailCustomerId}`] });
      setIsEditOpen(false);
      toast({ title: t("customers.customer_updated") });
    },
    onError: (err: Error) => {
      toast({ title: err.message === "phone_exists" ? t("customers.phone_exists") : t("customers.error"), description: err.message !== "phone_exists" ? err.message : undefined, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { const res = await apiRequest("DELETE", `/api/customers/${id}`); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers/kpis"] });
      setDeleteConfirm(null);
      toast({ title: t("customers.customer_deleted") });
    },
  });

  const filtered = useMemo(() => {
    let list = [...customers];
    if (search) list = list.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));
    if (phoneSearch) list = list.filter(c => c.phone?.includes(phoneSearch));
    if (statusFilter === "active") list = list.filter(c => c.active !== false);
    if (statusFilter === "inactive") list = list.filter(c => c.active === false);
    if (statusFilter === "new") {
      const ms = new Date(); ms.setDate(1); ms.setHours(0,0,0,0);
      list = list.filter(c => c.createdAt && new Date(c.createdAt) >= ms);
    }
    if (statusFilter === "top") list = list.sort((a, b) => parseFloat(b.totalSpent || "0") - parseFloat(a.totalSpent || "0")).slice(0, 20);
    if (branchFilter !== "all") list = list.filter(c => c.branchId === parseInt(branchFilter));
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a: any, b: any) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "") * dir;
      if (sortBy === "totalSpent") return (parseFloat(a.totalSpent || "0") - parseFloat(b.totalSpent || "0")) * dir;
      if (sortBy === "visits") return ((a.visits || 0) - (b.visits || 0)) * dir;
      if (sortBy === "lastVisit") return ((a.lastVisit ? new Date(a.lastVisit).getTime() : 0) - (b.lastVisit ? new Date(b.lastVisit).getTime() : 0)) * dir;
      return 0;
    });
    return list;
  }, [customers, search, phoneSearch, statusFilter, branchFilter, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toggleSort = (col: string) => { if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(col); setSortDir("desc"); } setPage(1); };
  const openDetail = (id: number) => { setDetailCustomerId(id); setIsDetailOpen(true); };
  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditForm({ name: c.name || "", phone: c.phone || "", notes: (c as any).notes || "", branchId: c.branchId ? String(c.branchId) : "", active: c.active !== false });
    setIsEditOpen(true);
  };
  const openStatement = (id: number) => { setStatementCustomerId(id); setStmtFrom(""); setStmtTo(""); setIsStatementOpen(true); };
  const setStmtQuickRange = (range: string) => {
    const now = new Date(); const to = format(now, "yyyy-MM-dd");
    if (range === "month") { const d = new Date(now.getFullYear(), now.getMonth(), 1); setStmtFrom(format(d, "yyyy-MM-dd")); setStmtTo(to); }
    else if (range === "30") { const d = new Date(now); d.setDate(d.getDate() - 30); setStmtFrom(format(d, "yyyy-MM-dd")); setStmtTo(to); }
    else if (range === "90") { const d = new Date(now); d.setDate(d.getDate() - 90); setStmtFrom(format(d, "yyyy-MM-dd")); setStmtTo(to); }
    else { setStmtFrom(""); setStmtTo(""); }
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${t("customers.statement")}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Inter:wght@400;700&display=swap" rel="stylesheet">
<style>@font-face{font-family:'DigitsEN';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf) format('truetype');unicode-range:U+0020-007F}@font-face{font-family:'DigitsEN';font-style:normal;font-weight:700;src:url(https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf) format('truetype');unicode-range:U+0020-007F}</style>
<style>*{margin:0;padding:0;box-sizing:border-box;font-family:'DigitsEN','Cairo',sans-serif}body{padding:20mm;direction:rtl;color:#333}
.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:15px}.header h1{font-size:22px;margin-bottom:5px}.header p{font-size:12px;color:#666}
.info{display:flex;justify-content:space-between;margin-bottom:15px;font-size:13px}.info div{flex:1}
table{width:100%;border-collapse:collapse;margin:15px 0;font-size:12px}th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f5f5f5;font-weight:bold}
.summary{margin-top:15px;display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.summary-item{background:#f9f9f9;padding:10px;border-radius:5px;text-align:center}
.summary-item .label{font-size:11px;color:#666}.summary-item .value{font-size:16px;font-weight:bold;margin-top:3px}
.footer{margin-top:30px;text-align:center;font-size:11px;color:#999;border-top:1px solid #ddd;padding-top:10px}
@media print{body{padding:10mm}}</style></head><body>${el.innerHTML}
<div class="footer">${t("customers.print_date")}: ${format(new Date(), "yyyy-MM-dd HH:mm")} | لمسة أنوثة</div></body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  const handleWhatsApp = () => {
    const c = statementData?.customer || customerDetail;
    if (!c?.phone) { toast({ title: t("customers.no_phone"), variant: "destructive" }); return; }
    const phone = c.phone.startsWith("968") ? c.phone : `968${c.phone}`;
    const msg = encodeURIComponent(`السلام عليكم،\nهذا كشف حساب مشترياتكم من لمسة أنوثة${stmtFrom ? ` للفترة من ${stmtFrom}` : ""}${stmtTo ? ` إلى ${stmtTo}` : ""}.\nالإجمالي: ${(statementData?.summary?.netAmount || 0).toFixed(3)} ر.ع.\nشكراً لتعاملكم معنا. 💜`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const f3 = (n: number | string | null | undefined) => parseFloat(String(n || "0")).toFixed(3);
  const fD = (d: any) => d ? format(new Date(d), "yyyy-MM-dd") : "---";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Users className="w-6 h-6 text-primary" />
            {t("customers.page_title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("customers.page_subtitle")}</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-customer" className="gap-2">
          <UserPlus className="w-4 h-4" />{t("customers.add_customer")}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardContent className="p-4 text-center">
          <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold" data-testid="text-kpi-total">{kpis?.totalCustomers || 0}</p>
          <p className="text-xs text-muted-foreground">{t("customers.kpi_total")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <UserPlus className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
          <p className="text-2xl font-bold">{kpis?.newThisMonth || 0}</p>
          <p className="text-xs text-muted-foreground">{t("customers.kpi_new")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <ShoppingBag className="w-5 h-5 mx-auto mb-1 text-blue-600" />
          <p className="text-2xl font-bold">{f3(kpis?.totalPurchases)}</p>
          <p className="text-xs text-muted-foreground">{t("customers.kpi_purchases")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Star className="w-5 h-5 mx-auto mb-1 text-yellow-600" />
          <p className="text-sm font-bold truncate">{kpis?.topCustomer?.name || "---"}</p>
          <p className="text-xs text-muted-foreground">{t("customers.kpi_top")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <UserCheck className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
          <p className="text-2xl font-bold">{kpis?.activeCustomers || 0}</p>
          <p className="text-xs text-muted-foreground">{t("customers.kpi_active")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <UserX className="w-5 h-5 mx-auto mb-1 text-red-600" />
          <p className="text-2xl font-bold">{kpis?.inactiveCustomers || 0}</p>
          <p className="text-xs text-muted-foreground">{t("customers.kpi_inactive")}</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t("customers.search_name")} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pe-10" data-testid="input-search-name" />
        </div>
        <div className="relative w-44">
          <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t("customers.search_phone")} value={phoneSearch} onChange={e => { setPhoneSearch(e.target.value); setPage(1); }} className="pe-10" data-testid="input-search-phone" />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("customers.filter_all")}</SelectItem>
            <SelectItem value="active">{t("customers.filter_active")}</SelectItem>
            <SelectItem value="inactive">{t("customers.filter_inactive")}</SelectItem>
            <SelectItem value="top">{t("customers.filter_top")}</SelectItem>
            <SelectItem value="new">{t("customers.filter_new")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={v => { setBranchFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44" data-testid="select-branch-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("customers.all_branches")}</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}><span className="flex items-center gap-1">{t("customers.name")} <ArrowUpDown className="w-3 h-3" /></span></TableHead>
                <TableHead>{t("customers.phone")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("customers.invoice_count")}</TableHead>
                <TableHead className="cursor-pointer hidden md:table-cell" onClick={() => toggleSort("visits")}><span className="flex items-center gap-1">{t("customers.visits")} <ArrowUpDown className="w-3 h-3" /></span></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("totalSpent")}><span className="flex items-center gap-1">{t("customers.total_spent")} <ArrowUpDown className="w-3 h-3" /></span></TableHead>
                <TableHead className="hidden lg:table-cell">{t("customers.avg_invoice")}</TableHead>
                <TableHead className="cursor-pointer hidden md:table-cell" onClick={() => toggleSort("lastVisit")}><span className="flex items-center gap-1">{t("customers.last_visit")} <ArrowUpDown className="w-3 h-3" /></span></TableHead>
                <TableHead className="hidden lg:table-cell">{t("customers.status")}</TableHead>
                <TableHead className="w-12">{t("customers.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8">{t("customers.no_customers")}</TableCell></TableRow>
              ) : (
                paginated.map(c => {
                  const spent = parseFloat(c.totalSpent || "0");
                  const avg = (c.invoiceCount || c.visits || 0) > 0 ? spent / (c.invoiceCount || c.visits || 1) : 0;
                  return (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(c.id)} data-testid={`row-customer-${c.id}`}>
                      <TableCell className="font-medium">{c.name || "---"}</TableCell>
                      <TableCell dir="ltr" className="text-start font-mono text-sm">{c.phone || "---"}</TableCell>
                      <TableCell className="hidden md:table-cell">{c.invoiceCount || 0}</TableCell>
                      <TableCell className="hidden md:table-cell">{c.visits || 0}</TableCell>
                      <TableCell className="font-semibold">{f3(spent)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{f3(avg)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{fD(c.lastVisit)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={c.active !== false ? "default" : "secondary"} className="text-xs">{c.active !== false ? t("customers.active") : t("customers.inactive")}</Badge>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" data-testid={`button-actions-${c.id}`}><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(c.id)}><Eye className="w-4 h-4 ms-2" />{t("customers.view_details")}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(c)}><Edit2 className="w-4 h-4 ms-2" />{t("customers.edit")}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openStatement(c.id)}><FileText className="w-4 h-4 ms-2" />{t("customers.statement")}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isOwner && <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm(c.id)}><Trash2 className="w-4 h-4 ms-2" />{t("customers.delete")}</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">{t("customers.showing")} {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} {t("customers.of")} {filtered.length}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronRight className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5" />{t("customers.customer_detail")}</DialogTitle></DialogHeader>
          {customerDetail && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="md:col-span-1">
                  <CardContent className="p-4 space-y-3">
                    <div className="text-center pb-3 border-b">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2"><Users className="w-8 h-8 text-primary" /></div>
                      <h3 className="text-lg font-bold" data-testid="text-detail-name">{customerDetail.name || "---"}</h3>
                      <p className="text-sm text-muted-foreground font-mono" dir="ltr">{customerDetail.phone || "---"}</p>
                      <Badge variant={customerDetail.active !== false ? "default" : "secondary"} className="mt-2">{customerDetail.active !== false ? t("customers.active") : t("customers.inactive")}</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("customers.created_at")}</span><span>{fD(customerDetail.createdAt)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("customers.last_visit")}</span><span>{fD(customerDetail.lastVisit)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("customers.visits")}</span><span>{customerDetail.visits || 0}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("customers.invoice_count")}</span><span>{customerDetail.invoiceCount || customerDetail.invoices?.length || 0}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("customers.total_spent")}</span><span className="font-bold text-primary">{f3(customerDetail.totalSpent)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">{t("customers.avg_invoice")}</span><span>{f3(customerDetail.avgInvoice)}</span></div>
                      {customerDetail.topBranch && <div className="flex justify-between"><span className="text-muted-foreground">{t("customers.top_branch")}</span><span className="flex items-center gap-1"><Store className="w-3 h-3" />{customerDetail.topBranch}</span></div>}
                      {(customerDetail as any).notes && <div className="pt-2 border-t"><span className="text-muted-foreground text-xs">{t("customers.notes")}</span><p className="text-sm mt-1">{(customerDetail as any).notes}</p></div>}
                    </div>
                  </CardContent>
                </Card>
                <div className="md:col-span-2 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { setIsDetailOpen(false); openEdit(customerDetail); }}><Edit2 className="w-3 h-3" />{t("customers.edit")}</Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { setIsDetailOpen(false); openStatement(customerDetail.id); }}><FileText className="w-3 h-3" />{t("customers.statement")}</Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                      if (!customerDetail.phone) { toast({ title: t("customers.no_phone"), variant: "destructive" }); return; }
                      const ph = customerDetail.phone.startsWith("968") ? customerDetail.phone : `968${customerDetail.phone}`;
                      window.open(`https://wa.me/${ph}`, "_blank");
                    }}><MessageSquare className="w-3 h-3" />{t("customers.whatsapp")}</Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">{f3(customerDetail.totalSpent)}</p><p className="text-xs text-muted-foreground">{t("customers.total_spent")}</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{customerDetail.invoiceCount || customerDetail.invoices?.length || 0}</p><p className="text-xs text-muted-foreground">{t("customers.invoice_count")}</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{customerDetail.returnsCount || 0}</p><p className="text-xs text-muted-foreground">{t("customers.returns_count")}</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-red-600">{f3(customerDetail.returnsTotal)}</p><p className="text-xs text-muted-foreground">{t("customers.returns_total")}</p></CardContent></Card>
                  </div>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">{t("customers.invoices_list")}</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>{t("customers.invoice_number")}</TableHead>
                            <TableHead>{t("customers.date")}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t("customers.branch")}</TableHead>
                            <TableHead>{t("customers.amount")}</TableHead>
                            <TableHead className="hidden sm:table-cell">{t("customers.payment_method")}</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {(!customerDetail.invoices || customerDetail.invoices.length === 0) ? (
                              <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">{t("customers.no_invoices")}</TableCell></TableRow>
                            ) : customerDetail.invoices.map((inv: any) => (
                              <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                                <TableCell className="font-mono font-medium">#{inv.invoice_number}</TableCell>
                                <TableCell className="text-sm">{fD(inv.created_at)}</TableCell>
                                <TableCell className="hidden sm:table-cell text-sm">{inv.branch_name}</TableCell>
                                <TableCell className="font-semibold">{f3(inv.total)}</TableCell>
                                <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="text-xs">{inv.payment_method === "cash" ? t("customers.cash") : inv.payment_method === "card" ? t("customers.card") : t("customers.bank_transfer")}</Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                  {customerDetail.returns && customerDetail.returns.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><RotateCcw className="w-4 h-4" />{t("customers.returns")}</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>{t("customers.invoice_number")}</TableHead>
                            <TableHead>{t("customers.date")}</TableHead>
                            <TableHead>{t("customers.amount")}</TableHead>
                            <TableHead>{t("customers.reason")}</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {customerDetail.returns.map((r: any) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-mono">#{r.invoice_number}</TableCell>
                                <TableCell className="text-sm">{fD(r.created_at)}</TableCell>
                                <TableCell className="font-semibold text-red-600">-{f3(r.refund_amount)}</TableCell>
                                <TableCell className="text-sm">{r.reason || "---"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />{t("customers.statement")}</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2 items-end border-b pb-4">
            <div><Label className="text-xs">{t("customers.from_date")}</Label><DateInput value={stmtFrom} onChange={e => setStmtFrom(e.target.value)} className="w-40" /></div>
            <div><Label className="text-xs">{t("customers.to_date")}</Label><DateInput value={stmtTo} onChange={e => setStmtTo(e.target.value)} className="w-40" /></div>
            <div className="flex gap-1">
              <Button size="sm" variant={!stmtFrom && !stmtTo ? "default" : "outline"} onClick={() => setStmtQuickRange("all")}>{t("customers.all_periods")}</Button>
              <Button size="sm" variant="outline" onClick={() => setStmtQuickRange("month")}>{t("customers.this_month")}</Button>
              <Button size="sm" variant="outline" onClick={() => setStmtQuickRange("30")}>{t("customers.last_30")}</Button>
              <Button size="sm" variant="outline" onClick={() => setStmtQuickRange("90")}>{t("customers.last_90")}</Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1" onClick={handlePrint}><Printer className="w-3 h-3" />{t("customers.print")}</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={handlePrint}><Download className="w-3 h-3" />{t("customers.download_pdf")}</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={handleWhatsApp}><MessageSquare className="w-3 h-3" />{t("customers.send_whatsapp")}</Button>
          </div>
          <div ref={printRef}>
            {statementData && (
              <>
                <div style={{ textAlign: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #e5e7eb" }}>
                  <h2 style={{ fontSize: 18, fontWeight: "bold" }}>{t("common.name")}</h2>
                  <p style={{ fontSize: 13, color: "#6b7280" }}>{t("customers.statement")}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                  <div><span className="text-muted-foreground">{t("customers.name")}:</span> <strong>{statementData.customer.name}</strong></div>
                  <div><span className="text-muted-foreground">{t("customers.phone")}:</span> <strong dir="ltr">{statementData.customer.phone}</strong></div>
                  {stmtFrom && <div><span className="text-muted-foreground">{t("customers.from_date")}:</span> <strong>{stmtFrom}</strong></div>}
                  {stmtTo && <div><span className="text-muted-foreground">{t("customers.to_date")}:</span> <strong>{stmtTo}</strong></div>}
                </div>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{t("customers.date")}</TableHead>
                    <TableHead>{t("customers.invoice_number")}</TableHead>
                    <TableHead>{t("customers.operation_type")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("customers.branch")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("customers.payment_method")}</TableHead>
                    <TableHead>{t("customers.amount")}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {statementData.entries.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">{t("customers.no_data")}</TableCell></TableRow>
                    ) : statementData.entries.map((e: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{fD(e.created_at)}</TableCell>
                        <TableCell className="font-mono">#{e.invoice_number}</TableCell>
                        <TableCell><Badge variant={e.type === "sale" ? "default" : "destructive"} className="text-xs">{e.type === "sale" ? t("customers.type_sale") : t("customers.type_return")}</Badge></TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{e.branch_name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{e.payment_method === "cash" ? t("customers.cash") : e.payment_method === "card" ? t("customers.card") : e.payment_method ? t("customers.bank_transfer") : "---"}</TableCell>
                        <TableCell className={`font-semibold ${e.type === "return" ? "text-red-600" : ""}`}>{e.type === "return" ? "-" : ""}{f3(e.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t">
                  <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-emerald-600">{f3(statementData.summary.totalSales)}</p><p className="text-xs text-muted-foreground">{t("customers.total_sales")}</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-red-600">{f3(statementData.summary.totalReturns)}</p><p className="text-xs text-muted-foreground">{t("customers.total_returns")}</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">{f3(statementData.summary.netAmount)}</p><p className="text-xs text-muted-foreground">{t("customers.net_amount")}</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{statementData.summary.operationCount}</p><p className="text-xs text-muted-foreground">{t("customers.operation_count")}</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{f3(statementData.summary.avgInvoice)}</p><p className="text-xs text-muted-foreground">{t("customers.avg_invoice")}</p></CardContent></Card>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" />{t("customers.add_customer")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("customers.name")} *</Label><Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} data-testid="input-add-name" /></div>
            <div><Label>{t("customers.phone")} *</Label><Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" className="text-start" data-testid="input-add-phone" /></div>
            <div><Label>{t("customers.notes")}</Label><Textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div><Label>{t("customers.default_branch")}</Label>
              <Select value={addForm.branchId} onValueChange={v => setAddForm(f => ({ ...f, branchId: v }))}>
                <SelectTrigger><SelectValue placeholder={t("customers.select_branch")} /></SelectTrigger>
                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => {
              if (!addForm.name.trim()) { toast({ title: t("customers.name_required"), variant: "destructive" }); return; }
              if (!addForm.phone.trim()) { toast({ title: t("customers.phone_required"), variant: "destructive" }); return; }
              createMutation.mutate({ name: addForm.name.trim(), phone: addForm.phone.trim(), notes: addForm.notes || undefined, branchId: addForm.branchId ? parseInt(addForm.branchId) : undefined, active: true });
            }} disabled={createMutation.isPending} data-testid="button-submit-add">{createMutation.isPending ? t("common.saving") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit2 className="w-5 h-5" />{t("customers.edit_customer")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("customers.name")} *</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} data-testid="input-edit-name" /></div>
            <div><Label>{t("customers.phone")} *</Label><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" className="text-start" data-testid="input-edit-phone" /></div>
            <div><Label>{t("customers.notes")}</Label><Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div><Label>{t("customers.default_branch")}</Label>
              <Select value={editForm.branchId} onValueChange={v => setEditForm(f => ({ ...f, branchId: v }))}>
                <SelectTrigger><SelectValue placeholder={t("customers.select_branch")} /></SelectTrigger>
                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Label>{t("customers.status")}</Label>
              <Badge variant={editForm.active ? "default" : "secondary"} className="cursor-pointer" onClick={() => setEditForm(f => ({ ...f, active: !f.active }))}>{editForm.active ? t("customers.active") : t("customers.inactive")}</Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => {
              if (!editForm.name.trim()) { toast({ title: t("customers.name_required"), variant: "destructive" }); return; }
              if (!editForm.phone.trim()) { toast({ title: t("customers.phone_required"), variant: "destructive" }); return; }
              updateMutation.mutate({ id: editingCustomer!.id, data: { name: editForm.name.trim(), phone: editForm.phone.trim(), notes: editForm.notes || undefined, branchId: editForm.branchId ? parseInt(editForm.branchId) : undefined, active: editForm.active } });
            }} disabled={updateMutation.isPending} data-testid="button-submit-edit">{updateMutation.isPending ? t("common.saving") : t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2"><Trash2 className="w-5 h-5" />{t("customers.confirm_delete")}</DialogTitle>
            <DialogDescription>{t("customers.confirm_delete_desc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? t("common.saving") : t("customers.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
