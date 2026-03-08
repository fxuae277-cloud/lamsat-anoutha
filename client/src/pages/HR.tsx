import { useState, useRef } from "react";
import { Plus, Users, Building2, Phone, KeyRound, Wallet, Search, TrendingUp, ShoppingBag, Receipt, Clock, Edit, Eye, Shield, Hash, UserCheck, BarChart3, Calendar, FileText, Banknote, MinusCircle, CreditCard, CheckCircle2, RefreshCw, Percent, Printer, Download, FileSpreadsheet, DollarSign, CircleDollarSign, AlertCircle, User, ClipboardCheck, RotateCcw, XCircle, BookOpen, UserX, Pause, ArrowRightLeft, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fmtDate, fmtCurrency } from "@/lib/formatters";
import type { Branch } from "@shared/schema";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
const fmt = fmtCurrency;

function useMonthNames() {
  const { t } = useI18n();
  return [
    t("month_names.jan"), t("month_names.feb"), t("month_names.mar"), t("month_names.apr"), t("month_names.may"), t("month_names.jun"),
    t("month_names.jul"), t("month_names.aug"), t("month_names.sep"), t("month_names.oct"), t("month_names.nov"), t("month_names.dec"),
  ];
}

function statusBadgePayroll(status: string, t: (k: string) => string) {
  const map: Record<string, { cls: string; key: string }> = {
    draft: { cls: "bg-yellow-50 text-yellow-700 border-yellow-200", key: "hr.status_draft" },
    reviewed: { cls: "bg-blue-50 text-blue-700 border-blue-200", key: "hr.status_reviewed" },
    approved: { cls: "bg-green-50 text-green-700 border-green-200", key: "hr.status_approved" },
    partial: { cls: "bg-orange-50 text-orange-700 border-orange-200", key: "hr.status_partial" },
    paid: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", key: "hr.status_paid" },
    cancelled: { cls: "bg-gray-100 text-gray-500 border-gray-200", key: "hr.status_cancelled" },
  };
  const s = map[status] || map.draft;
  return <Badge variant="outline" className={s.cls}>{t(s.key)}</Badge>;
}

function paymentStatusBadge(status: string, t: (k: string) => string) {
  if (status === "paid") return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{t("hr.status_paid")}</Badge>;
  if (status === "partial") return <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">{t("hr.status_partial")}</Badge>;
  return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">{t("hr.status_unpaid")}</Badge>;
}

export default function HR() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwnerAdmin = user?.role === "owner" || user?.role === "admin";

  const ROLE_LABELS: Record<string, string> = {
    owner: t("hr.role_labels.owner"),
    admin: t("hr.role_labels.admin"),
    manager: t("hr.role_labels.manager"),
    cashier: t("hr.role_labels.cashier"),
    employee: t("hr.role_labels.employee"),
  };

  const ROLE_OPTIONS = [
    { value: "admin", label: t("hr.role_labels.admin") },
    { value: "manager", label: t("hr.role_labels.manager") },
    { value: "cashier", label: t("hr.role_labels.cashier") },
    { value: "employee", label: t("hr.role_labels.employee") },
  ];

  const SALARY_TYPE_LABELS: Record<string, string> = {
    monthly: t("hr.monthly"),
    daily: t("hr.salary_daily") || "Daily",
    commission: t("hr.salary_commission"),
  };

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [perfOpen, setPerfOpen] = useState(false);
  const [finProfileOpen, setFinProfileOpen] = useState(false);
  const [finProfileEmpId, setFinProfileEmpId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [perfFrom, setPerfFrom] = useState(monthAgoStr());
  const [perfTo, setPerfTo] = useState(todayStr());

  const [newUser, setNewUser] = useState({
    name: "", username: "", password: "", role: "cashier",
    branchId: "1", terminalName: "T1", pin: "", phone: "", salary: "",
    salaryType: "monthly", commissionRate: "",
  });

  const { data: usersList = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOwnerAdmin,
  });
  const { data: branchesList = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: payrollRuns = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll-runs"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOwnerAdmin,
  });

  const perfQueryKey = selectedUser ? `/api/reports/employee-performance/${selectedUser.id}?from=${perfFrom}&to=${perfTo}` : null;
  const { data: perfData } = useQuery<any>({
    queryKey: [perfQueryKey],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!perfQueryKey && perfOpen,
  });

  const branchMap = Object.fromEntries(branchesList.map(b => [b.id, b.name]));

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/users", {
        ...newUser,
        branchId: Number(newUser.branchId),
        salary: newUser.salary || "0",
        commissionRate: newUser.commissionRate || "0",
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.employee_added") });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAddOpen(false);
      setNewUser({ name: "", username: "", password: "", role: "cashier", branchId: "1", terminalName: "T1", pin: "", phone: "", salary: "", salaryType: "monthly", commissionRate: "" });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return;
      await apiRequest("PATCH", `/api/users/${selectedUser.id}`, {
        name: selectedUser.name,
        role: selectedUser.role,
        branchId: Number(selectedUser.branchId),
        terminalName: selectedUser.terminalName,
        isActive: selectedUser.isActive,
        pin: selectedUser.pin || null,
        phone: selectedUser.phone || null,
        salary: selectedUser.salary || "0",
        salaryType: selectedUser.salaryType || "monthly",
        commissionRate: selectedUser.commissionRate || "0",
        employmentStatus: selectedUser.employmentStatus || "active",
        openingAdvanceBalance: selectedUser.openingAdvanceBalance || "0",
        openingPayableBalance: selectedUser.openingPayableBalance || "0",
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.employee_updated") });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const filtered = usersList.filter(u => {
    if (!search) return true;
    return u.name.includes(search) || u.username.includes(search) || (u.phone || "").includes(search);
  });

  const activeCount = usersList.filter(u => u.isActive).length;
  const totalSalary = usersList.reduce((s, u) => s + parseFloat(u.salary || "0"), 0);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentMonthRun = payrollRuns.find((r: any) => parseInt(r.month) === currentMonth && parseInt(r.year) === currentYear);
  const currentMonthNet = currentMonthRun ? parseFloat(currentMonthRun.total_net || "0") : totalSalary;
  const currentMonthPaid = currentMonthRun ? parseFloat(currentMonthRun.total_paid || "0") : 0;
  const currentMonthRemaining = currentMonthNet - currentMonthPaid;

  if (!isOwnerAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-lg font-medium">{t("common.limited_access")}</p>
        <p className="text-sm mt-1">{t("common.admin_only")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-hr-title">{t("hr.title")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("hr.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t("hr.total_employees")}</p>
              <p className="text-lg font-bold" data-testid="text-total-employees">{usersList.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t("hr.active_employees")}</p>
              <p className="text-lg font-bold text-green-600">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t("hr.total_salary_current_month")}</p>
              <p className="text-base font-bold text-blue-600">{currentMonthNet.toFixed(3)} <span className="text-[10px] font-normal">{t("common.omr")}</span></p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{t("hr.remaining_for_current_month")}</p>
              <p className="text-base font-bold text-red-600">{currentMonthRemaining > 0 ? currentMonthRemaining.toFixed(3) : "0.000"} <span className="text-[10px] font-normal">{t("common.omr")}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" dir={lang === "ar" ? "rtl" : "ltr"}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 max-w-3xl">
          <TabsTrigger value="employees" className="gap-1 text-xs">
            <Users className="w-3.5 h-3.5" />
            {t("hr.tab_employees")}
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-1 text-xs">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            {t("hr.tab_movements")}
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1 text-xs">
            <CreditCard className="w-3.5 h-3.5" />
            {t("hr.tab_payments")}
          </TabsTrigger>
          <TabsTrigger value="outstanding" className="gap-1 text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            {t("hr.tab_outstanding")}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1 text-xs">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {t("hr.tab_reports")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <EmployeesTab
            usersList={filtered}
            branchMap={branchMap}
            branchesList={branchesList}
            search={search}
            setSearch={setSearch}
            onAdd={() => setAddOpen(true)}
            onEdit={(u: any) => { setSelectedUser({...u}); setEditOpen(true); }}
            onPerf={(u: any) => { setSelectedUser(u); setPerfOpen(true); }}
            onFinProfile={(u: any) => { setFinProfileEmpId(u.id); setFinProfileOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="movements">
          <MonthlyMovementsTab usersList={usersList} />
        </TabsContent>

        <TabsContent value="payments">
          <SalaryPaymentsTab usersList={usersList} />
        </TabsContent>

        <TabsContent value="outstanding">
          <OutstandingTab usersList={usersList} />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab usersList={usersList} branchMap={branchMap} branchesList={branchesList} />
        </TabsContent>
      </Tabs>

      {/* Add Employee Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{t("hr.add_employee_title")}</DialogTitle>
            <DialogDescription>{t("hr.add_employee_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.full_name")} *</label>
                <Input placeholder={t("hr.full_name_placeholder")} value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} data-testid="input-emp-name" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("settings.username_login")} *</label>
                <Input placeholder="ahmed" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} data-testid="input-emp-username" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("settings.password")} *</label>
                <Input type="password" placeholder={t("settings.min_6_chars")} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} data-testid="input-emp-password" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" />
                  {t("hr.pin")}
                </label>
                <Input placeholder="1234" maxLength={6} value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value.replace(/\D/g, "")})} data-testid="input-emp-pin" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("settings.role_label")}</label>
                <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v})}>
                  <SelectTrigger data-testid="select-emp-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("settings.branch_label")}</label>
                <Select value={newUser.branchId} onValueChange={v => setNewUser({...newUser, branchId: v})}>
                  <SelectTrigger data-testid="select-emp-branch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.salary_type")}</label>
                <Select value={newUser.salaryType} onValueChange={v => setNewUser({...newUser, salaryType: v})}>
                  <SelectTrigger data-testid="select-emp-salary-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t("hr.monthly")}</SelectItem>
                    <SelectItem value="daily">{t("hr.salary_daily")}</SelectItem>
                    <SelectItem value="commission">{t("hr.salary_commission")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" />
                  {t("hr.base_salary")}
                </label>
                <Input type="number" step="0.001" placeholder="0.000" value={newUser.salary} onChange={e => setNewUser({...newUser, salary: e.target.value})} data-testid="input-emp-salary" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5" />
                  {t("hr.commission_rate")}
                </label>
                <Input type="number" step="0.01" placeholder="0.00" value={newUser.commissionRate} onChange={e => setNewUser({...newUser, commissionRate: e.target.value})} data-testid="input-emp-commission" disabled={newUser.salaryType !== "commission"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("settings.terminal_name")}</label>
                <Input placeholder="POS-1" value={newUser.terminalName} onChange={e => setNewUser({...newUser, terminalName: e.target.value})} data-testid="input-emp-terminal" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {t("hr.phone")}
                </label>
                <Input placeholder="9XXXXXXX" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} data-testid="input-emp-phone" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newUser.name || !newUser.username || !newUser.password} data-testid="button-save-employee">
              {createMutation.isPending ? t("common.saving") : t("hr.save_employee")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("hr.edit_employee")}</DialogTitle>
            <DialogDescription>{t("hr.edit_employee_desc")}</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.full_name")}</label>
                  <Input value={selectedUser.name} onChange={e => setSelectedUser({...selectedUser, name: e.target.value})} data-testid="input-edit-name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("settings.role_label")}</label>
                  <Select value={selectedUser.role} onValueChange={v => setSelectedUser({...selectedUser, role: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("settings.branch_label")}</label>
                  <Select value={String(selectedUser.branchId)} onValueChange={v => setSelectedUser({...selectedUser, branchId: Number(v)})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("settings.terminal_name")}</label>
                  <Input value={selectedUser.terminalName || ""} onChange={e => setSelectedUser({...selectedUser, terminalName: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.salary_type")}</label>
                  <Select value={selectedUser.salaryType || "monthly"} onValueChange={v => setSelectedUser({...selectedUser, salaryType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">{t("hr.monthly")}</SelectItem>
                      <SelectItem value="daily">{t("hr.salary_daily")}</SelectItem>
                      <SelectItem value="commission">{t("hr.salary_commission")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.base_salary")}</label>
                  <Input type="number" step="0.001" value={selectedUser.salary || ""} onChange={e => setSelectedUser({...selectedUser, salary: e.target.value})} data-testid="input-edit-salary" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.commission_rate")}</label>
                  <Input type="number" step="0.01" value={selectedUser.commissionRate || ""} onChange={e => setSelectedUser({...selectedUser, commissionRate: e.target.value})} data-testid="input-edit-commission" disabled={selectedUser.salaryType !== "commission"} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    {t("hr.fin_pin_code")}
                  </label>
                  <Input placeholder="1234" maxLength={6} value={selectedUser.pin || ""} onChange={e => setSelectedUser({...selectedUser, pin: e.target.value.replace(/\D/g, "")})} data-testid="input-edit-pin" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.phone")}</label>
                  <Input value={selectedUser.phone || ""} onChange={e => setSelectedUser({...selectedUser, phone: e.target.value})} data-testid="input-edit-phone" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">{t("common.status")}:</label>
                <Button variant={selectedUser.isActive ? "default" : "outline"} size="sm" onClick={() => setSelectedUser({...selectedUser, isActive: true})} className={selectedUser.isActive ? "bg-green-600 hover:bg-green-700" : ""}>
                  {t("status_labels.active")}
                </Button>
                <Button variant={!selectedUser.isActive ? "destructive" : "outline"} size="sm" onClick={() => setSelectedUser({...selectedUser, isActive: false})}>
                  {t("status_labels.inactive")}
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.employment_status")}</label>
                <Select value={selectedUser.employmentStatus || "active"} onValueChange={v => setSelectedUser({...selectedUser, employmentStatus: v})}>
                  <SelectTrigger data-testid="select-employment-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("hr.emp_status_active")}</SelectItem>
                    <SelectItem value="suspended">{t("hr.emp_status_suspended")}</SelectItem>
                    <SelectItem value="terminated">{t("hr.emp_status_terminated")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.opening_advance_balance")}</label>
                  <Input type="number" step="0.001" placeholder="0.000" value={selectedUser.openingAdvanceBalance || ""} onChange={e => setSelectedUser({...selectedUser, openingAdvanceBalance: e.target.value})} data-testid="input-opening-advance" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.opening_payable_balance")}</label>
                  <Input type="number" step="0.001" placeholder="0.000" value={selectedUser.openingPayableBalance || ""} onChange={e => setSelectedUser({...selectedUser, openingPayableBalance: e.target.value})} data-testid="input-opening-payable" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-update-employee">
              {updateMutation.isPending ? t("common.saving") : t("common.save_changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Performance Dialog */}
      <Dialog open={perfOpen} onOpenChange={setPerfOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {t("hr.performance_report")}: {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>{t("hr.performance_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium">{t("common.from")}</label>
                <Input type="date" value={perfFrom} onChange={e => setPerfFrom(e.target.value)} />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium">{t("common.to")}</label>
                <Input type="date" value={perfTo} onChange={e => setPerfTo(e.target.value)} />
              </div>
            </div>
            {perfData?.performance && (
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <ShoppingBag className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">{t("hr.total_sales")}</p>
                    <p className="text-lg font-bold text-primary">{fmt(perfData.performance.salesTotal)}</p>
                    <p className="text-xs text-muted-foreground">{perfData.performance.salesCount} {t("common.transaction")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">{t("reports.total_profit")}</p>
                    <p className="text-lg font-bold text-green-600">{fmt(perfData.performance.grossProfit)}</p>
                    <p className="text-xs text-muted-foreground">{t("reports.product_margin")} {perfData.performance.margin}%</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <FinancialProfileDialog
        open={finProfileOpen}
        onOpenChange={setFinProfileOpen}
        employeeId={finProfileEmpId}
      />
    </div>
  );
}

/* ==================== EMPLOYEES TAB ==================== */
function EmployeesTab({ usersList, branchMap, branchesList, search, setSearch, onAdd, onEdit, onPerf, onFinProfile }: any) {
  const { t } = useI18n();

  const ROLE_LABELS: Record<string, string> = {
    owner: t("hr.role_labels.owner"),
    admin: t("hr.role_labels.admin"),
    manager: t("hr.role_labels.manager"),
    cashier: t("hr.role_labels.cashier"),
    employee: t("hr.role_labels.employee"),
  };

  const SALARY_TYPE_LABELS: Record<string, string> = {
    monthly: t("hr.monthly"),
    daily: t("hr.salary_daily") || "Daily",
    commission: t("hr.salary_commission"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder={t("hr.search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-employees" />
        </div>
        <Button className="gap-2" onClick={onAdd} data-testid="button-add-employee">
          <Plus className="w-4 h-4" />
          {t("hr.add_employee")}
        </Button>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("hr.table_name")}</TableHead>
              <TableHead>{t("common.branch")}</TableHead>
              <TableHead>{t("settings.role_label")}</TableHead>
              <TableHead>{t("hr.salary_type")}</TableHead>
              <TableHead>{t("hr.base_salary")}</TableHead>
              <TableHead>{t("hr.phone")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="w-[120px]">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersList.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("hr.no_employees")}</TableCell></TableRow>
            ) : usersList.map((u: any) => (
              <TableRow key={u.id} data-testid={`row-employee-${u.id}`}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-sm">{branchMap[u.branchId] || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{ROLE_LABELS[u.role] || u.role}</Badge></TableCell>
                <TableCell className="text-xs">{SALARY_TYPE_LABELS[u.salaryType] || u.salaryType}</TableCell>
                <TableCell className="font-medium">{fmt(u.salary)}</TableCell>
                <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                <TableCell>
                  {u.isActive ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{t("status_labels.active")}</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-600 text-xs">{t("status_labels.inactive")}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(u)} data-testid={`button-edit-${u.id}`} title={t("hr.edit_employee")}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600" onClick={() => onFinProfile(u)} data-testid={`button-fin-${u.id}`} title={t("hr.financial_profile")}>
                      <Wallet className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" onClick={() => onPerf(u)} data-testid={`button-perf-${u.id}`} title={t("hr.performance_report")}>
                      <BarChart3 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ==================== MONTHLY MOVEMENTS TAB ==================== */
function MonthlyMovementsTab({ usersList }: { usersList: any[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const MONTH_NAMES = useMonthNames();
  const [subTab, setSubTab] = useState<"all" | "advances" | "deductions">("all");
  const [filterEmp, setFilterEmp] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [addAdvOpen, setAddAdvOpen] = useState(false);
  const [addDedOpen, setAddDedOpen] = useState(false);
  const [empId, setEmpId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [deductionMode, setDeductionMode] = useState("full_next_payroll");
  const [installmentAmt, setInstallmentAmt] = useState("");
  const [reason, setReason] = useState("");
  const [deductionType, setDeductionType] = useState("one_time");
  const [monthRef, setMonthRef] = useState("");
  const now = new Date();

  const advUrl = filterEmp && filterEmp !== "__all__" ? `/api/employee-advances?employeeId=${filterEmp}` : "/api/employee-advances";
  const { data: advances = [] } = useQuery<any[]>({
    queryKey: [advUrl],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const dedUrl = filterEmp && filterEmp !== "__all__" ? `/api/employee-deductions?employeeId=${filterEmp}` : "/api/employee-deductions";
  const { data: deductions = [] } = useQuery<any[]>({
    queryKey: [dedUrl],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const createAdvMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/employee-advances", {
        employeeId: Number(empId), amount, date, note,
        deductionMode,
        installmentAmount: deductionMode === "fixed_installment" ? installmentAmt : undefined,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.advance_recorded") });
      queryClient.invalidateQueries({ queryKey: [advUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-advances"] });
      setAddAdvOpen(false);
      setEmpId(""); setAmount(""); setNote("");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const createDedMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/employee-deductions", {
        employeeId: Number(empId), amount, reason, date,
        deductionType,
        monthReference: deductionType === "one_time" && monthRef ? monthRef : null,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.deduction_recorded") });
      queryClient.invalidateQueries({ queryKey: [dedUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-deductions"] });
      setAddDedOpen(false);
      setEmpId(""); setAmount(""); setReason(""); setDeductionType("one_time"); setMonthRef("");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const totalAdvances = advances.reduce((s: number, a: any) => s + parseFloat(a.amount || "0"), 0);
  const totalAdvRepaid = advances.reduce((s: number, a: any) => s + parseFloat(a.total_repaid || "0"), 0);
  const totalAdvRemaining = advances.reduce((s: number, a: any) => s + parseFloat(a.remaining_amount || "0"), 0);
  const totalDeductions = deductions.reduce((s: number, d: any) => s + parseFloat(d.amount || "0"), 0);

  const filteredAdvances = advances.filter((a: any) => {
    if (filterStatus === "open") return parseFloat(a.remaining_amount || "0") > 0;
    if (filterStatus === "settled") return a.settled;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-blue-600">{t("hr.total_advances_amount")}</p>
          <p className="text-sm font-bold text-blue-700">{totalAdvances.toFixed(3)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-green-600">{t("hr.total_repaid")}</p>
          <p className="text-sm font-bold text-green-700">{totalAdvRepaid.toFixed(3)}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-red-600">{t("hr.total_remaining_advances")}</p>
          <p className="text-sm font-bold text-red-700">{totalAdvRemaining.toFixed(3)}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-orange-600">{t("hr.total_deductions")}</p>
          <p className="text-sm font-bold text-orange-700">{totalDeductions.toFixed(3)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Button variant={subTab === "all" ? "default" : "outline"} size="sm" onClick={() => setSubTab("all")}>{t("hr.movement_all")}</Button>
          <Button variant={subTab === "advances" ? "default" : "outline"} size="sm" onClick={() => setSubTab("advances")}>{t("hr.movement_advances")}</Button>
          <Button variant={subTab === "deductions" ? "default" : "outline"} size="sm" onClick={() => setSubTab("deductions")}>{t("hr.movement_deductions")}</Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-44" data-testid="select-filter-mov-emp"><SelectValue placeholder={t("hr.all_employees")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("hr.all_employees")}</SelectItem>
              {usersList.filter(u => u.role !== "owner").map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(subTab === "all" || subTab === "advances") && (
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("common.all")}</SelectItem>
                <SelectItem value="open">{t("hr.open_advances")}</SelectItem>
                <SelectItem value="settled">{t("hr.fully_settled")}</SelectItem>
              </SelectContent>
            </Select>
          )}
          {(subTab === "all" || subTab === "advances") && (
            <Button className="gap-1" size="sm" onClick={() => { setAddAdvOpen(true); setEmpId(""); setAmount(""); setNote(""); }} data-testid="button-add-advance">
              <Plus className="w-3.5 h-3.5" /> {t("hr.new_advance")}
            </Button>
          )}
          {(subTab === "all" || subTab === "deductions") && (
            <Button className="gap-1" size="sm" variant="outline" onClick={() => { setAddDedOpen(true); setEmpId(""); setAmount(""); setReason(""); }} data-testid="button-add-deduction">
              <Plus className="w-3.5 h-3.5" /> {t("hr.new_deduction")}
            </Button>
          )}
        </div>
      </div>

      {/* Advances Section */}
      {(subTab === "all" || subTab === "advances") && (
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-2 px-3 border-b bg-muted/20 flex items-center justify-between">
            <h4 className="text-sm font-bold flex items-center gap-1"><Banknote className="w-4 h-4 text-blue-600" /> {t("hr.movement_advances")} ({filteredAdvances.length})</h4>
          </div>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("common.employee")}</TableHead>
                <TableHead>{t("hr.advance_amount")}</TableHead>
                <TableHead>{t("hr.total_repaid")}</TableHead>
                <TableHead>{t("hr.remaining_amount")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("hr.deduction_mode")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAdvances.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">{t("hr.no_advances")}</TableCell></TableRow>
              ) : filteredAdvances.map((a: any) => {
                const remaining = parseFloat(a.remaining_amount || "0");
                const repaid = parseFloat(a.total_repaid || "0");
                const isPartial = !a.settled && repaid > 0;
                return (
                  <TableRow key={a.id} data-testid={`row-advance-${a.id}`}>
                    <TableCell className="font-medium">{a.employee_name}</TableCell>
                    <TableCell className="font-bold">{fmt(a.amount)}</TableCell>
                    <TableCell className="text-green-600">{fmt(a.total_repaid)}</TableCell>
                    <TableCell className={`font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>{remaining.toFixed(3)}</TableCell>
                    <TableCell className="text-sm">{fmtDate(a.date)}</TableCell>
                    <TableCell className="text-xs">
                      {a.deduction_mode === "fixed_installment" ? t("hr.mode_fixed_installment") :
                       a.deduction_mode === "manual" ? t("hr.mode_manual") : t("hr.mode_full_next_payroll")}
                    </TableCell>
                    <TableCell>
                      {a.settled ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{t("hr.settled")}</Badge>
                      ) : isPartial ? (
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">{t("hr.partial_repaid")}</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">{t("hr.unsettled")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{a.note || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Deductions Section */}
      {(subTab === "all" || subTab === "deductions") && (
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-2 px-3 border-b bg-muted/20 flex items-center justify-between">
            <h4 className="text-sm font-bold flex items-center gap-1"><MinusCircle className="w-4 h-4 text-red-600" /> {t("hr.movement_deductions")} ({deductions.length})</h4>
          </div>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("common.employee")}</TableHead>
                <TableHead>{t("common.amount")}</TableHead>
                <TableHead>{t("hr.reason")}</TableHead>
                <TableHead>{t("hr.deduction_type")}</TableHead>
                <TableHead>{t("hr.month_reference")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deductions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">{t("hr.no_deductions")}</TableCell></TableRow>
              ) : deductions.map((d: any) => (
                <TableRow key={d.id} data-testid={`row-deduction-${d.id}`}>
                  <TableCell className="font-medium">{d.employee_name}</TableCell>
                  <TableCell className="font-bold text-red-600">{fmt(d.amount)}</TableCell>
                  <TableCell className="text-sm">{d.reason}</TableCell>
                  <TableCell>
                    {d.deduction_type === "recurring" ? (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">{t("hr.recurring")}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">{t("hr.one_time")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{d.month_reference || "—"}</TableCell>
                  <TableCell className="text-sm">{fmtDate(d.date)}</TableCell>
                  <TableCell>
                    {d.applied_in_payroll_id ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{t("hr.applied")}</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">{t("hr.not_applied")}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Advance Dialog */}
      <Dialog open={addAdvOpen} onOpenChange={setAddAdvOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("hr.record_advance")}</DialogTitle>
            <DialogDescription>{t("hr.record_advance_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.employee")} *</label>
              <Select value={empId} onValueChange={setEmpId}>
                <SelectTrigger data-testid="select-advance-emp"><SelectValue placeholder={t("hr.select_employee")} /></SelectTrigger>
                <SelectContent>
                  {usersList.filter(u => u.role !== "owner").map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.amount_omr")} *</label>
                <Input type="number" step="0.001" placeholder="0.000" value={amount} onChange={e => setAmount(e.target.value)} data-testid="input-advance-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.date")} *</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-advance-date" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("hr.deduction_mode")}</label>
              <Select value={deductionMode} onValueChange={setDeductionMode}>
                <SelectTrigger data-testid="select-deduction-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_next_payroll">{t("hr.mode_full_next_payroll")}</SelectItem>
                  <SelectItem value="fixed_installment">{t("hr.mode_fixed_installment")}</SelectItem>
                  <SelectItem value="manual">{t("hr.mode_manual")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {deductionMode === "fixed_installment" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.installment_amount")}</label>
                <Input type="number" step="0.001" placeholder="0.000" value={installmentAmt} onChange={e => setInstallmentAmt(e.target.value)} data-testid="input-installment-amount" />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <Input placeholder={t("hr.advance_note_placeholder")} value={note} onChange={e => setNote(e.target.value)} data-testid="input-advance-note" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createAdvMutation.mutate()} disabled={createAdvMutation.isPending || !empId || !amount} data-testid="button-save-advance">
              {createAdvMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Deduction Dialog */}
      <Dialog open={addDedOpen} onOpenChange={setAddDedOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{t("hr.record_deduction")}</DialogTitle>
            <DialogDescription>{t("hr.record_deduction_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.employee")} *</label>
              <Select value={empId} onValueChange={setEmpId}>
                <SelectTrigger data-testid="select-deduction-emp"><SelectValue placeholder={t("hr.select_employee")} /></SelectTrigger>
                <SelectContent>
                  {usersList.filter(u => u.role !== "owner").map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.amount_omr")} *</label>
                <Input type="number" step="0.001" placeholder="0.000" value={amount} onChange={e => setAmount(e.target.value)} data-testid="input-deduction-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.date")} *</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-deduction-date" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("hr.deduction_type")}</label>
              <Select value={deductionType} onValueChange={setDeductionType}>
                <SelectTrigger data-testid="select-deduction-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">{t("hr.one_time")}</SelectItem>
                  <SelectItem value="recurring">{t("hr.recurring")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {deductionType === "one_time" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.month_reference")}</label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={monthRef ? monthRef.split("/")[0] : ""} onValueChange={m => setMonthRef(`${m}/${monthRef ? monthRef.split("/")[1] : now.getFullYear()}`)}>
                    <SelectTrigger data-testid="select-deduction-month"><SelectValue placeholder={t("hr.select_month")} /></SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder={String(now.getFullYear())} value={monthRef ? monthRef.split("/")[1] : ""} onChange={e => setMonthRef(`${monthRef ? monthRef.split("/")[0] : "1"}/${e.target.value}`)} data-testid="input-deduction-year" />
                </div>
                <p className="text-xs text-muted-foreground">{t("hr.month_reference_hint")}</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("hr.reason")} *</label>
              <Input placeholder={t("hr.deduction_reason_placeholder")} value={reason} onChange={e => setReason(e.target.value)} data-testid="input-deduction-reason" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createDedMutation.mutate()} disabled={createDedMutation.isPending || !empId || !amount || !reason} data-testid="button-save-deduction">
              {createDedMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== PAYROLL SHEET TAB ==================== */
function PayrollSheetTab({ usersList }: { usersList: any[] }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const slipRef = useRef<HTMLDivElement>(null);
  const MONTH_NAMES = useMonthNames();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const now = new Date();
  const [newMonth, setNewMonth] = useState(String(now.getMonth() + 1));
  const [newYear, setNewYear] = useState(String(now.getFullYear()));
  const [newNote, setNewNote] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payDate, setPayDate] = useState(todayStr());
  const [payNote, setPayNote] = useState("");
  const [payRefNo, setPayRefNo] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  const { data: payrollRuns = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll-runs"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const detailsKey = selectedRun ? `/api/payroll-runs/${selectedRun.id}/details-with-payments` : null;
  const { data: details = [] } = useQuery<any[]>({
    queryKey: [detailsKey],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedRun,
  });

  const summaryKey = selectedRun ? `/api/payroll-runs/${selectedRun.id}/summary` : null;
  const { data: summary } = useQuery<any>({
    queryKey: [summaryKey],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedRun && detailsOpen,
  });

  const paymentHistoryKey = selectedDetail ? `/api/payroll-detail/${selectedDetail.id}/payments` : null;
  const { data: paymentHistory = [] } = useQuery<any[]>({
    queryKey: [paymentHistoryKey],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedDetail && historyOpen,
  });

  const { data: previewData } = useQuery<any>({
    queryKey: [`/api/payroll/preview?month=${newMonth}&year=${newYear}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: previewOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/payroll-runs", {
        month: newMonth, year: Number(newYear), note: newNote,
        periodStart: newPeriodStart || undefined, periodEnd: newPeriodEnd || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.payroll_generated") });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      setCreateOpen(false); setPreviewOpen(false);
      setNewNote(""); setNewPeriodStart(""); setNewPeriodEnd("");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/regenerate`, {}); },
    onSuccess: () => {
      toast({ title: t("hr.payroll_recalculated") });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      if (selectedRun) { queryClient.invalidateQueries({ queryKey: [detailsKey] }); queryClient.invalidateQueries({ queryKey: [summaryKey] }); }
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/approve`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_approved") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const reviewMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/review`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_reviewed") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/reopen`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_reopened") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/cancel`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_cancelled") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDetail || !selectedRun) return;
      await apiRequest("POST", "/api/salary-payments", {
        payrollId: selectedRun.id, payrollDetailId: selectedDetail.id,
        employeeId: selectedDetail.employee_id, amount: payAmount,
        paymentDate: payDate, paymentMethod: payMethod,
        referenceNo: payRefNo || undefined, branchId: selectedDetail.branch_id, note: payNote,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.payment_recorded") });
      queryClient.invalidateQueries({ queryKey: [detailsKey] });
      queryClient.invalidateQueries({ queryKey: [summaryKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      setPayOpen(false); setPayAmount(""); setPayNote(""); setPayRefNo("");
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>${t("hr.payroll_sheet")}</title><style>
      body{font-family:Arial,sans-serif;padding:30px;direction:${lang === 'ar' ? 'rtl' : 'ltr'}}
      table{width:100%;border-collapse:collapse;margin:15px 0}
      th,td{border:1px solid #ddd;padding:8px;text-align:${lang === 'ar' ? 'right' : 'left'};font-size:12px}
      th{background:#f5f5f5;font-weight:bold}
      .header{text-align:center;margin-bottom:20px}
      .header h1{font-size:18px;margin:5px 0}
      .header h2{font-size:14px;color:#666;margin:5px 0}
      @media print{body{padding:15px}}
    </style></head><body>${printRef.current.innerHTML}<div style="margin-top:20px;font-size:11px;color:#888;text-align:center">${t("hr.print_date")}: ${new Date().toISOString().slice(0, 10)}</div></body></html>`);
    win.document.close(); win.print();
  };

  const handleSlipPrint = () => {
    if (!slipRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>${t("hr.salary_slip")}</title><style>
      body{font-family:Arial,sans-serif;padding:30px;direction:${lang === 'ar' ? 'rtl' : 'ltr'};max-width:600px;margin:0 auto}
      table{width:100%;border-collapse:collapse;margin:15px 0}
      th,td{border:1px solid #ddd;padding:10px;text-align:${lang === 'ar' ? 'right' : 'left'};font-size:13px}
      th{background:#f5f5f5;font-weight:bold;width:40%}
      .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:15px}
      .net{font-size:16px;font-weight:bold;color:#2563eb;text-align:center;margin:15px 0;padding:10px;background:#eff6ff;border-radius:8px}
    </style></head><body>${slipRef.current.innerHTML}<div style="margin-top:20px;font-size:11px;color:#888;text-align:center">${t("hr.print_date")}: ${new Date().toISOString().slice(0, 10)}</div></body></html>`);
    win.document.close(); win.print();
  };

  const handleExportExcel = () => {
    if (!details.length || !selectedRun) return;
    const monthName = MONTH_NAMES[parseInt(selectedRun.month) - 1];
    let csv = "\uFEFF";
    csv += [t("hr.table_employee"), t("common.branch"), t("hr.table_base_salary"), t("hr.table_commissions"), t("hr.gross_salary"), t("hr.table_deductions"), t("hr.table_advances"), t("hr.net_salary"), t("hr.payment_status"), t("hr.total_paid"), t("hr.remaining_amount")].join(",") + "\n";
    details.forEach((d: any) => {
      const gross = (parseFloat(d.basic_salary || "0") + parseFloat(d.commission || "0")).toFixed(3);
      csv += [d.employee_name, d.branch_name || "-", fmt(d.basic_salary), fmt(d.commission), gross, fmt(d.deductions), fmt(d.advances), fmt(d.net_salary), d.payment_status === "paid" ? t("hr.status_paid") : d.payment_status === "partial" ? t("hr.status_partial") : t("hr.status_unpaid"), fmt(d.total_paid), fmt(d.remaining)].join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `payroll_${monthName}_${selectedRun.year}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold">{t("hr.payroll_sheet_title")}</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-payroll">
              <Plus className="w-4 h-4" /> {t("hr.generate_payroll")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>{t("hr.generate_payroll_title")}</DialogTitle>
              <DialogDescription>{t("hr.generate_payroll_desc")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.select_month")}</label>
                  <Select value={newMonth} onValueChange={setNewMonth}>
                    <SelectTrigger data-testid="select-payroll-month"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.select_year")}</label>
                  <Input type="number" value={newYear} onChange={e => setNewYear(e.target.value)} data-testid="input-payroll-year" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.period_start")}</label>
                  <Input type="date" value={newPeriodStart} onChange={e => setNewPeriodStart(e.target.value)} data-testid="input-period-start" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.period_end")}</label>
                  <Input type="date" value={newPeriodEnd} onChange={e => setNewPeriodEnd(e.target.value)} data-testid="input-period-end" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.notes")}</label>
                <Input placeholder={t("hr.notes_placeholder")} value={newNote} onChange={e => setNewNote(e.target.value)} data-testid="input-payroll-note" />
              </div>

              {previewOpen && previewData && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="font-semibold">{t("hr.preview_title")}</div>
                  {previewData.warnings?.length > 0 && (
                    <div className="text-amber-600 text-xs space-y-1">
                      {previewData.warnings.map((w: string, i: number) => (
                        <div key={i}>! {t(`hr.warning_${w}`) || w}</div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center"><span className="text-xs text-muted-foreground">{t("hr.employees_count")}</span><br/><b>{previewData.totals?.employeeCount}</b></div>
                    <div className="text-center"><span className="text-xs text-muted-foreground">{t("hr.total_basic_salary")}</span><br/><b>{fmt(previewData.totals?.basic)}</b></div>
                    <div className="text-center"><span className="text-xs text-muted-foreground">{t("hr.net_salary")}</span><br/><b className="text-primary">{fmt(previewData.totals?.net)}</b></div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPreviewOpen(!previewOpen)} data-testid="button-preview-payroll">
                <Eye className="w-4 h-4 me-1" /> {t("hr.preview")}
              </Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-save-payroll">
                {createMutation.isPending ? t("hr.generating") : t("hr.generate_btn")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payroll Runs Table */}
      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("hr.table_month")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("hr.table_base_salary")}</TableHead>
              <TableHead>{t("hr.table_commissions")}</TableHead>
              <TableHead>{t("hr.table_deductions")}</TableHead>
              <TableHead>{t("hr.table_advances")}</TableHead>
              <TableHead>{t("hr.table_net")}</TableHead>
              <TableHead>{t("hr.total_paid")}</TableHead>
              <TableHead>{t("hr.remaining_to_pay")}</TableHead>
              <TableHead className="w-[150px]">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollRuns.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{t("hr.no_payroll")}</TableCell></TableRow>
            ) : payrollRuns.map((run: any) => {
              const totalPaid = parseFloat(run.total_paid || "0");
              const totalNet = parseFloat(run.total_net || "0");
              const remaining = totalNet - totalPaid;
              return (
                <TableRow key={run.id} data-testid={`row-payroll-${run.id}`}>
                  <TableCell className="font-medium">{MONTH_NAMES[parseInt(run.month) - 1]} {run.year}</TableCell>
                  <TableCell>{statusBadgePayroll(run.status, t)}</TableCell>
                  <TableCell>{fmt(run.total_basic)}</TableCell>
                  <TableCell className="text-blue-600">{fmt(run.total_commission)}</TableCell>
                  <TableCell className="text-red-600">{fmt(run.total_deductions)}</TableCell>
                  <TableCell className="text-red-600">{fmt(run.total_advances)}</TableCell>
                  <TableCell className="font-bold text-primary">{fmt(run.total_net)}</TableCell>
                  <TableCell className="text-green-600">{fmt(totalPaid)}</TableCell>
                  <TableCell className="font-bold text-red-600">{remaining > 0 ? remaining.toFixed(3) : "0.000"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedRun(run); setDetailsOpen(true); }} data-testid={`button-details-${run.id}`} title={t("hr.payroll_details")}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {run.status === "draft" && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => regenerateMutation.mutate(run.id)} title={t("hr.payroll_recalculated")}>
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" onClick={() => reviewMutation.mutate(run.id)} title={t("hr.review")}>
                            <ClipboardCheck className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={() => approveMutation.mutate(run.id)} title={t("hr.approve")}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {run.status === "reviewed" && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={() => approveMutation.mutate(run.id)} title={t("hr.approve")}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {["approved", "partial", "paid"].includes(run.status) && user?.role === "owner" && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600" onClick={() => reopenMutation.mutate(run.id)} title={t("hr.reopen")}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {["draft", "reviewed"].includes(run.status) && user?.role === "owner" && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => cancelMutation.mutate(run.id)} title={t("hr.cancel")}>
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Payroll Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[1100px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t("hr.payroll_details")} - {selectedRun && `${MONTH_NAMES[parseInt(selectedRun.month) - 1]} ${selectedRun.year}`}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              {selectedRun && statusBadgePayroll(selectedRun.status, t)}
              {selectedRun?.period_start && <span className="text-xs text-muted-foreground">({fmtDate(selectedRun.period_start)} - {fmtDate(selectedRun.period_end)})</span>}
            </DialogDescription>
          </DialogHeader>

          {summary && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-blue-600">{t("hr.total_basic_salary")}</p>
                <p className="text-sm font-bold text-blue-700">{fmt(summary.totalBasic)}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-indigo-600">{t("hr.total_commissions")}</p>
                <p className="text-sm font-bold text-indigo-700">{fmt(summary.totalCommission)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-red-600">{t("hr.total_deductions")}</p>
                <p className="text-sm font-bold text-red-700">{fmt(summary.totalDeductions)}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-orange-600">{t("hr.total_advances")}</p>
                <p className="text-sm font-bold text-orange-700">{fmt(summary.totalAdvances)}</p>
              </div>
              <div className="bg-primary/5 rounded-lg p-2 text-center">
                <p className="text-[10px] text-primary">{t("hr.total_net")}</p>
                <p className="text-sm font-bold text-primary">{fmt(summary.totalNet)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-green-600">{t("hr.total_paid")}</p>
                <p className="text-sm font-bold text-green-700">{fmt(summary.totalPaid)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-red-600">{t("hr.remaining_to_pay")}</p>
                <p className="text-sm font-bold text-red-700">{fmt(summary.totalRemaining)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-green-600">{t("hr.paid_employees")}</p>
                <p className="text-sm font-bold text-green-700">{summary.paidCount}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-orange-600">{t("hr.partial_employees")}</p>
                <p className="text-sm font-bold text-orange-700">{summary.partialCount}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-red-600">{t("hr.unpaid_employees")}</p>
                <p className="text-sm font-bold text-red-700">{summary.unpaidCount}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-1" onClick={handlePrint} data-testid="button-print-payroll">
              <Printer className="w-3.5 h-3.5" /> {t("hr.print")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleSlipPrint}>
              <Download className="w-3.5 h-3.5" /> {t("hr.export_pdf")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleExportExcel} data-testid="button-export-excel">
              <FileSpreadsheet className="w-3.5 h-3.5" /> {t("hr.export_excel")}
            </Button>
          </div>

          <div ref={printRef}>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("hr.table_employee")}</TableHead>
                  <TableHead>{t("common.branch")}</TableHead>
                  <TableHead>{t("hr.table_base_salary")}</TableHead>
                  <TableHead>{t("hr.table_commissions")}</TableHead>
                  <TableHead>{t("hr.gross_salary")}</TableHead>
                  <TableHead>{t("hr.table_deductions")}</TableHead>
                  <TableHead>{t("hr.table_advances")}</TableHead>
                  <TableHead>{t("hr.net_salary")}</TableHead>
                  <TableHead>{t("hr.payment_status")}</TableHead>
                  <TableHead>{t("hr.total_paid")}</TableHead>
                  <TableHead>{t("hr.remaining_to_pay")}</TableHead>
                  <TableHead className="w-[100px]">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-6 text-muted-foreground">{t("common.no_details")}</TableCell></TableRow>
                ) : details.map((d: any) => {
                  const gross = (parseFloat(d.basic_salary || "0") + parseFloat(d.commission || "0")).toFixed(3);
                  return (
                    <TableRow key={d.id} data-testid={`row-payroll-detail-${d.id}`}>
                      <TableCell className="font-medium">{d.employee_name}</TableCell>
                      <TableCell className="text-sm">{d.branch_name || "-"}</TableCell>
                      <TableCell>{fmt(d.basic_salary)}</TableCell>
                      <TableCell className="text-blue-600">{fmt(d.commission)}</TableCell>
                      <TableCell className="font-medium">{gross}</TableCell>
                      <TableCell className="text-red-600">{fmt(d.deductions)}</TableCell>
                      <TableCell className="text-red-600">{fmt(d.advances)}</TableCell>
                      <TableCell className="font-bold text-primary">{fmt(d.net_salary)}</TableCell>
                      <TableCell>{paymentStatusBadge(d.payment_status, t)}</TableCell>
                      <TableCell className="text-green-600">{fmt(d.total_paid)}</TableCell>
                      <TableCell className="text-red-600 font-bold">{fmt(d.remaining)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {selectedRun?.status === "approved" && d.payment_status !== "paid" && parseFloat(d.net_salary || "0") > 0 && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={() => { setSelectedDetail(d); setPayAmount(d.remaining); setPayOpen(true); }} data-testid={`button-pay-${d.id}`} title={t("hr.record_payment")}>
                              <DollarSign className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedDetail(d); setSlipOpen(true); }} title={t("hr.salary_slip")}>
                            <Receipt className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" onClick={() => { setSelectedDetail(d); setHistoryOpen(true); }} title={t("hr.view_payments")}>
                            <Clock className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="w-5 h-5 text-green-600" />
              {t("hr.record_payment_title")}
            </DialogTitle>
            <DialogDescription>{selectedDetail?.employee_name} - {t("hr.remaining_amount")}: {fmt(selectedDetail?.remaining)} {t("common.omr")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.current_payment_amount")} *</label>
                <Input type="number" step="0.001" value={payAmount} onChange={e => setPayAmount(e.target.value)} data-testid="input-pay-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.payment_date")} *</label>
                <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} data-testid="input-pay-date" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("hr.payment_method")}</label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger data-testid="select-pay-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">{t("hr.pay_bank")}</SelectItem>
                  <SelectItem value="cheque">{t("hr.pay_cheque")}</SelectItem>
                  <SelectItem value="wallet">{t("hr.pay_wallet")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("hr.transfer_reference")}</label>
              <Input placeholder={t("hr.reference_no_placeholder")} value={payRefNo} onChange={e => setPayRefNo(e.target.value)} data-testid="input-pay-refno" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <Input placeholder={t("hr.notes_placeholder")} value={payNote} onChange={e => setPayNote(e.target.value)} data-testid="input-pay-note" />
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between"><span>{t("hr.net_salary")}</span><span className="font-bold">{fmt(selectedDetail?.net_salary)}</span></div>
              <div className="flex justify-between"><span>{t("hr.previously_paid")}</span><span className="font-bold text-green-600">{fmt(selectedDetail?.total_paid)}</span></div>
              <div className="flex justify-between border-t mt-1 pt-1"><span>{t("hr.remaining_before_payment")}</span><span className="font-bold text-red-600">{fmt(selectedDetail?.remaining)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayAmount(selectedDetail?.remaining || "0"); }} data-testid="button-pay-full">
              {t("hr.pay_full")}
            </Button>
            <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending || !payAmount || parseFloat(payAmount) <= 0} data-testid="button-confirm-pay" className="bg-green-600 hover:bg-green-700">
              {payMutation.isPending ? t("common.saving") : t("hr.record_payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Slip Dialog */}
      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              {t("hr.salary_slip_title")}
            </DialogTitle>
            <DialogDescription>
              {selectedDetail?.employee_name} - {selectedRun && `${MONTH_NAMES[parseInt(selectedRun.month) - 1]} ${selectedRun.year}`}
            </DialogDescription>
          </DialogHeader>
          <div ref={slipRef}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #333", paddingBottom: 10, marginBottom: 15 }}>
              <h1 style={{ fontSize: 16, margin: "3px 0" }}>{t("hr.company_name")}</h1>
              <h2 style={{ fontSize: 13, color: "#666", margin: "3px 0" }}>
                {t("hr.salary_slip")} - {selectedRun && `${MONTH_NAMES[parseInt(selectedRun.month) - 1]} ${selectedRun.year}`}
              </h2>
            </div>
            {selectedDetail && (
              <Table>
                <TableBody>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_employee")}</TableCell><TableCell>{selectedDetail.employee_name}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("common.branch")}</TableCell><TableCell>{selectedDetail.branch_name || "-"}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_base_salary")}</TableCell><TableCell>{fmt(selectedDetail.basic_salary)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_commissions")}</TableCell><TableCell className="text-blue-600">{fmt(selectedDetail.commission)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.gross_salary")}</TableCell><TableCell className="font-bold">{(parseFloat(selectedDetail.basic_salary || "0") + parseFloat(selectedDetail.commission || "0")).toFixed(3)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_deductions")}</TableCell><TableCell className="text-red-600">-{fmt(selectedDetail.deductions)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.advance_deducted")}</TableCell><TableCell className="text-red-600">-{fmt(selectedDetail.advances)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow className="bg-primary/5"><TableCell className="font-bold">{t("hr.net_salary")}</TableCell><TableCell className="font-bold text-primary text-lg">{fmt(selectedDetail.net_salary)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.payment_status")}</TableCell><TableCell>{paymentStatusBadge(selectedDetail.payment_status, t)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.total_paid")}</TableCell><TableCell className="text-green-600 font-medium">{fmt(selectedDetail.total_paid)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.remaining_to_pay")}</TableCell><TableCell className="text-red-600 font-medium">{fmt(selectedDetail.remaining)} {t("common.omr")}</TableCell></TableRow>
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="gap-1" onClick={handleSlipPrint} data-testid="button-print-slip">
              <Printer className="w-3.5 h-3.5" /> {t("hr.print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              {t("hr.payment_history")} - {selectedDetail?.employee_name}
            </DialogTitle>
            <DialogDescription>
              {selectedRun && `${MONTH_NAMES[parseInt(selectedRun.month) - 1]} ${selectedRun.year}`}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("common.amount")}</TableHead>
                <TableHead>{t("hr.payment_date")}</TableHead>
                <TableHead>{t("hr.payment_method")}</TableHead>
                <TableHead>{t("hr.reference_no")}</TableHead>
                <TableHead>{t("hr.created_by")}</TableHead>
                <TableHead>{t("common.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{t("hr.no_payments")}</TableCell></TableRow>
              ) : paymentHistory.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-green-600">{fmt(p.amount)} {t("common.omr")}</TableCell>
                  <TableCell className="text-sm">{fmtDate(p.payment_date)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{t(`hr.pay_${p.payment_method}`) || p.payment_method}</Badge></TableCell>
                  <TableCell className="text-sm">{p.reference_no || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.paid_by_name || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {paymentHistory.length > 0 && (
            <div className="p-2 bg-green-50 rounded-lg text-center text-sm font-bold text-green-700">
              {t("hr.total_paid")}: {paymentHistory.reduce((s: number, p: any) => s + parseFloat(p.amount || "0"), 0).toFixed(3)} {t("common.omr")}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== SALARY PAYMENTS TAB ==================== */
function SalaryPaymentsTab({ usersList }: { usersList: any[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const MONTH_NAMES = useMonthNames();
  const printRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const [selMonth, setSelMonth] = useState(String(now.getMonth() + 1));
  const [selYear, setSelYear] = useState(String(now.getFullYear()));
  const [payOpen, setPayOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payDate, setPayDate] = useState(todayStr());
  const [payNote, setPayNote] = useState("");
  const [payRefNo, setPayRefNo] = useState("");
  const [filterEmp, setFilterEmp] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [createOpen, setCreateOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  const { data: payrollRuns = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll-runs"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const currentRun = payrollRuns.find((r: any) => String(r.month) === selMonth && String(r.year) === selYear && r.status !== "cancelled");

  const detailsKey = currentRun ? `/api/payroll-runs/${currentRun.id}/details-with-payments` : null;
  const { data: details = [] } = useQuery<any[]>({
    queryKey: [detailsKey],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!currentRun,
  });

  const paymentHistoryKey = selectedDetail ? `/api/payroll-detail/${selectedDetail.id}/payments` : null;
  const { data: paymentHistory = [] } = useQuery<any[]>({
    queryKey: [paymentHistoryKey],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedDetail && historyOpen,
  });

  const filteredDetails = details.filter((d: any) => {
    if (filterEmp !== "__all__" && String(d.employee_id) !== filterEmp) return false;
    if (filterStatus === "paid" && d.payment_status !== "paid") return false;
    if (filterStatus === "partial" && d.payment_status !== "partial") return false;
    if (filterStatus === "unpaid" && d.payment_status === "paid") return false;
    return true;
  });

  const totalNet = filteredDetails.reduce((s, d: any) => s + parseFloat(d.net_salary || "0"), 0);
  const totalPaid = filteredDetails.reduce((s, d: any) => s + parseFloat(d.total_paid || "0"), 0);
  const totalRemaining = filteredDetails.reduce((s, d: any) => s + parseFloat(d.remaining || "0"), 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/payroll-runs", {
        month: selMonth, year: Number(selYear), note: newNote,
        periodStart: newPeriodStart || undefined, periodEnd: newPeriodEnd || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.payroll_generated") });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      setCreateOpen(false); setNewNote(""); setNewPeriodStart(""); setNewPeriodEnd("");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/approve`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_approved") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const reviewMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/review`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_reviewed") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/reopen`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_reopened") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/cancel`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_cancelled") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/regenerate`, {}); },
    onSuccess: () => {
      toast({ title: t("hr.payroll_recalculated") });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      if (currentRun) { queryClient.invalidateQueries({ queryKey: [detailsKey] }); }
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDetail || !currentRun) return;
      await apiRequest("POST", "/api/salary-payments", {
        payrollId: currentRun.id, payrollDetailId: selectedDetail.id,
        employeeId: selectedDetail.employee_id, amount: payAmount,
        paymentDate: payDate, paymentMethod: payMethod,
        referenceNo: payRefNo || undefined, branchId: selectedDetail.branch_id, note: payNote,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.payment_saved") });
      queryClient.invalidateQueries({ queryKey: [detailsKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      setPayOpen(false); setPayAmount(""); setPayNote(""); setPayRefNo("");
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const slipRef = useRef<HTMLDivElement>(null);
  const { lang } = useI18n();
  const handleSlipPrint = () => {
    if (!slipRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>${t("hr.salary_slip")}</title><style>
      body{font-family:Arial,sans-serif;padding:30px;direction:${lang === 'ar' ? 'rtl' : 'ltr'};max-width:600px;margin:0 auto}
      table{width:100%;border-collapse:collapse;margin:15px 0}
      th,td{border:1px solid #ddd;padding:10px;text-align:${lang === 'ar' ? 'right' : 'left'};font-size:13px}
      th{background:#f5f5f5;font-weight:bold;width:40%}
      .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:15px}
      .net{font-size:16px;font-weight:bold;color:#2563eb;text-align:center;margin:15px 0;padding:10px;background:#eff6ff;border-radius:8px}
    </style></head><body>${slipRef.current.innerHTML}<div style="margin-top:20px;font-size:11px;color:#888;text-align:center">${t("hr.print_date")}: ${new Date().toISOString().slice(0, 10)}</div></body></html>`);
    win.document.close(); win.print();
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>${t("hr.payments_title")}</title><style>
      body{font-family:Arial,sans-serif;padding:30px;direction:${lang === 'ar' ? 'rtl' : 'ltr'}}
      table{width:100%;border-collapse:collapse;margin:15px 0}
      th,td{border:1px solid #ddd;padding:8px;text-align:${lang === 'ar' ? 'right' : 'left'};font-size:12px}
      th{background:#f5f5f5;font-weight:bold}
      .header{text-align:center;margin-bottom:20px}
      @media print{body{padding:15px}}
    </style></head><body><div class="header"><h1>${t("hr.payments_title")} - ${MONTH_NAMES[parseInt(selMonth) - 1]} ${selYear}</h1></div>${printRef.current.innerHTML}<div style="margin-top:20px;font-size:11px;color:#888;text-align:center">${t("hr.print_date")}: ${new Date().toISOString().slice(0, 10)}</div></body></html>`);
    win.document.close(); win.print();
  };

  const handleExportExcel = () => {
    if (!filteredDetails.length) return;
    let csv = "\uFEFF";
    csv += [t("hr.table_employee"), t("common.branch"), t("hr.table_base_salary"), t("hr.table_commissions"), t("hr.gross_salary"), t("hr.table_deductions"), t("hr.table_advances"), t("hr.net_salary"), t("hr.payment_status"), t("hr.total_paid"), t("hr.remaining_amount")].join(",") + "\n";
    filteredDetails.forEach((d: any) => {
      const gross = (parseFloat(d.basic_salary || "0") + parseFloat(d.commission || "0")).toFixed(3);
      csv += [d.employee_name, d.branch_name || "-", fmt(d.basic_salary), fmt(d.commission), gross, fmt(d.deductions), fmt(d.advances), fmt(d.net_salary), d.payment_status === "paid" ? t("hr.status_paid") : d.payment_status === "partial" ? t("hr.status_partial") : t("hr.status_unpaid"), fmt(d.total_paid), fmt(d.remaining)].join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `payroll_${MONTH_NAMES[parseInt(selMonth) - 1]}_${selYear}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold">{t("hr.payments_title")}</h3>
        <div className="flex gap-2 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium">{t("hr.select_month")}</label>
            <Select value={selMonth} onValueChange={setSelMonth}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t("hr.select_year")}</label>
            <Input type="number" className="w-24" value={selYear} onChange={e => setSelYear(e.target.value)} />
          </div>
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-44"><SelectValue placeholder={t("hr.all_employees")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("hr.all_employees")}</SelectItem>
              {usersList.filter(u => u.role !== "owner").map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.all")}</SelectItem>
              <SelectItem value="paid">{t("hr.status_paid")}</SelectItem>
              <SelectItem value="partial">{t("hr.status_partial")}</SelectItem>
              <SelectItem value="unpaid">{t("hr.status_unpaid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!currentRun ? (
        <div className="bg-card border rounded-xl p-8 text-center space-y-3">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">{t("hr.no_payroll_for_month")}</p>
          <Button className="gap-2" onClick={() => setCreateOpen(true)} data-testid="button-create-payroll">
            <Plus className="w-4 h-4" /> {t("hr.generate_payroll")}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {statusBadgePayroll(currentRun.status, t)}
              <span className="text-sm text-muted-foreground">{MONTH_NAMES[parseInt(currentRun.month) - 1]} {currentRun.year}</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {currentRun.status === "draft" && (
                <>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => regenerateMutation.mutate(currentRun.id)}>
                    <RefreshCw className="w-3 h-3" /> {t("hr.payroll_recalculated")}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1 text-xs text-blue-600" onClick={() => reviewMutation.mutate(currentRun.id)}>
                    <ClipboardCheck className="w-3 h-3" /> {t("hr.review")}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1 text-xs text-green-600" onClick={() => approveMutation.mutate(currentRun.id)}>
                    <CheckCircle2 className="w-3 h-3" /> {t("hr.approve")}
                  </Button>
                </>
              )}
              {currentRun.status === "reviewed" && (
                <Button variant="outline" size="sm" className="gap-1 text-xs text-green-600" onClick={() => approveMutation.mutate(currentRun.id)}>
                  <CheckCircle2 className="w-3 h-3" /> {t("hr.approve")}
                </Button>
              )}
              {["approved", "partial", "paid"].includes(currentRun.status) && user?.role === "owner" && (
                <Button variant="outline" size="sm" className="gap-1 text-xs text-amber-600" onClick={() => reopenMutation.mutate(currentRun.id)}>
                  <RotateCcw className="w-3 h-3" /> {t("hr.reopen")}
                </Button>
              )}
              {["draft", "reviewed"].includes(currentRun.status) && user?.role === "owner" && (
                <Button variant="outline" size="sm" className="gap-1 text-xs text-red-500" onClick={() => cancelMutation.mutate(currentRun.id)}>
                  <XCircle className="w-3 h-3" /> {t("hr.cancel")}
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handlePrint}>
                <Printer className="w-3 h-3" /> {t("hr.print")}
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleExportExcel} data-testid="button-export-excel">
                <FileSpreadsheet className="w-3 h-3" /> {t("hr.export_excel")}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-blue-600">{t("hr.total_net")}</p>
              <p className="text-sm font-bold text-blue-700">{totalNet.toFixed(3)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-green-600">{t("hr.total_paid")}</p>
              <p className="text-sm font-bold text-green-700">{totalPaid.toFixed(3)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-red-600">{t("hr.remaining_to_pay")}</p>
              <p className="text-sm font-bold text-red-700">{totalRemaining.toFixed(3)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-gray-600">{t("hr.payroll_count")}</p>
              <p className="text-sm font-bold text-gray-700">{filteredDetails.length}</p>
            </div>
          </div>

          <div className="bg-card border shadow-sm rounded-xl overflow-hidden" ref={printRef}>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("common.employee")}</TableHead>
                  <TableHead>{t("common.branch")}</TableHead>
                  <TableHead>{t("hr.table_base_salary")}</TableHead>
                  <TableHead>{t("hr.table_commissions")}</TableHead>
                  <TableHead>{t("hr.table_deductions")}</TableHead>
                  <TableHead>{t("hr.table_advances")}</TableHead>
                  <TableHead>{t("hr.net_salary")}</TableHead>
                  <TableHead>{t("hr.total_paid")}</TableHead>
                  <TableHead>{t("hr.remaining_to_pay")}</TableHead>
                  <TableHead>{t("hr.payment_status")}</TableHead>
                  <TableHead className="w-[130px]">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDetails.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">{t("hr.no_payment_data")}</TableCell></TableRow>
                ) : filteredDetails.map((d: any) => (
                  <TableRow key={d.id} data-testid={`row-payment-${d.id}`}>
                    <TableCell className="font-medium">{d.employee_name}</TableCell>
                    <TableCell className="text-sm">{d.branch_name || "-"}</TableCell>
                    <TableCell>{fmt(d.basic_salary)}</TableCell>
                    <TableCell className="text-blue-600">{fmt(d.commission)}</TableCell>
                    <TableCell className="text-red-600">{fmt(d.deductions)}</TableCell>
                    <TableCell className="text-red-600">{fmt(d.advances)}</TableCell>
                    <TableCell className="font-bold text-primary">{fmt(d.net_salary)}</TableCell>
                    <TableCell className="text-green-600 font-medium">{fmt(d.total_paid)}</TableCell>
                    <TableCell className="text-red-600 font-bold">{fmt(d.remaining)}</TableCell>
                    <TableCell>{paymentStatusBadge(d.payment_status, t)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {currentRun.status === "approved" && d.payment_status !== "paid" && parseFloat(d.net_salary || "0") > 0 && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={() => { setSelectedDetail(d); setPayAmount(d.remaining); setPayOpen(true); }} data-testid={`button-pay-emp-${d.id}`} title={t("hr.record_payment")}>
                            <DollarSign className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedDetail(d); setSlipOpen(true); }} title={t("hr.salary_slip")}>
                          <Receipt className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" onClick={() => { setSelectedDetail(d); setHistoryOpen(true); }} title={t("hr.view_payments")}>
                          <Clock className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Generate Payroll Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("hr.generate_payroll_title")}</DialogTitle>
            <DialogDescription>{t("hr.generate_payroll_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("hr.select_month")}</p>
                <p className="font-bold">{MONTH_NAMES[parseInt(selMonth) - 1]}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("hr.select_year")}</p>
                <p className="font-bold">{selYear}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.period_start")}</label>
                <Input type="date" value={newPeriodStart} onChange={e => setNewPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.period_end")}</label>
                <Input type="date" value={newPeriodEnd} onChange={e => setNewPeriodEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <Input placeholder={t("hr.notes_placeholder")} value={newNote} onChange={e => setNewNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-save-payroll">
              {createMutation.isPending ? t("hr.generating") : t("hr.generate_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="w-5 h-5 text-green-600" />
              {t("hr.record_payment_title")}
            </DialogTitle>
            <DialogDescription>{selectedDetail?.employee_name} - {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>{t("hr.net_salary")}</span><span className="font-bold">{fmt(selectedDetail?.net_salary)}</span></div>
              <div className="flex justify-between"><span>{t("hr.previously_paid")}</span><span className="font-bold text-green-600">{fmt(selectedDetail?.total_paid)}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="font-bold">{t("hr.remaining_before_payment")}</span><span className="font-bold text-red-600">{fmt(selectedDetail?.remaining)}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.current_payment_amount")} *</label>
                <Input type="number" step="0.001" value={payAmount} onChange={e => setPayAmount(e.target.value)} data-testid="input-salary-pay-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.payment_date")} *</label>
                <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} data-testid="input-salary-pay-date" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("hr.payment_method")}</label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">{t("hr.pay_bank")}</SelectItem>
                  <SelectItem value="cheque">{t("hr.pay_cheque")}</SelectItem>
                  <SelectItem value="wallet">{t("hr.pay_wallet")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("hr.transfer_reference")}</label>
              <Input placeholder={t("hr.reference_no_placeholder")} value={payRefNo} onChange={e => setPayRefNo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <Input placeholder={t("hr.notes_placeholder")} value={payNote} onChange={e => setPayNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayAmount(selectedDetail?.remaining || "0")}>{t("hr.pay_full")}</Button>
            <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending || !payAmount || parseFloat(payAmount) <= 0} className="bg-green-600 hover:bg-green-700">
              {payMutation.isPending ? t("common.saving") : t("hr.record_payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Slip Dialog */}
      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              {t("hr.salary_slip_title")}
            </DialogTitle>
            <DialogDescription>
              {selectedDetail?.employee_name} - {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}
            </DialogDescription>
          </DialogHeader>
          <div ref={slipRef}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #333", paddingBottom: 10, marginBottom: 15 }}>
              <h1 style={{ fontSize: 16, margin: "3px 0" }}>{t("hr.company_name")}</h1>
              <h2 style={{ fontSize: 13, color: "#666", margin: "3px 0" }}>
                {t("hr.salary_slip")} - {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}
              </h2>
            </div>
            {selectedDetail && (
              <Table>
                <TableBody>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_employee")}</TableCell><TableCell>{selectedDetail.employee_name}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("common.branch")}</TableCell><TableCell>{selectedDetail.branch_name || "-"}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_base_salary")}</TableCell><TableCell>{fmt(selectedDetail.basic_salary)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_commissions")}</TableCell><TableCell className="text-blue-600">{fmt(selectedDetail.commission)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.gross_salary")}</TableCell><TableCell className="font-bold">{(parseFloat(selectedDetail.basic_salary || "0") + parseFloat(selectedDetail.commission || "0")).toFixed(3)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_deductions")}</TableCell><TableCell className="text-red-600">-{fmt(selectedDetail.deductions)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.advance_deducted")}</TableCell><TableCell className="text-red-600">-{fmt(selectedDetail.advances)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow className="bg-primary/5"><TableCell className="font-bold">{t("hr.net_salary")}</TableCell><TableCell className="font-bold text-primary text-lg">{fmt(selectedDetail.net_salary)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.payment_status")}</TableCell><TableCell>{paymentStatusBadge(selectedDetail.payment_status, t)}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.total_paid")}</TableCell><TableCell className="text-green-600 font-medium">{fmt(selectedDetail.total_paid)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.remaining_to_pay")}</TableCell><TableCell className="text-red-600 font-medium">{fmt(selectedDetail.remaining)} {t("common.omr")}</TableCell></TableRow>
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="gap-1" onClick={handleSlipPrint} data-testid="button-print-slip">
              <Printer className="w-3.5 h-3.5" /> {t("hr.print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              {t("hr.payment_history")} - {selectedDetail?.employee_name}
            </DialogTitle>
            <DialogDescription>
              {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("common.amount")}</TableHead>
                <TableHead>{t("hr.payment_date")}</TableHead>
                <TableHead>{t("hr.payment_method")}</TableHead>
                <TableHead>{t("hr.reference_no")}</TableHead>
                <TableHead>{t("hr.created_by")}</TableHead>
                <TableHead>{t("common.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{t("hr.no_payments")}</TableCell></TableRow>
              ) : paymentHistory.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-green-600">{fmt(p.amount)} {t("common.omr")}</TableCell>
                  <TableCell className="text-sm">{fmtDate(p.payment_date)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{t(`hr.pay_${p.payment_method}`) || p.payment_method}</Badge></TableCell>
                  <TableCell className="text-sm">{p.reference_no || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.paid_by_name || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {paymentHistory.length > 0 && (
            <div className="p-2 bg-green-50 rounded-lg text-center text-sm font-bold text-green-700">
              {t("hr.total_paid")}: {paymentHistory.reduce((s: number, p: any) => s + parseFloat(p.amount || "0"), 0).toFixed(3)} {t("common.omr")}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== OUTSTANDING TAB ==================== */
function OutstandingTab({ usersList }: { usersList: any[] }) {
  const { t } = useI18n();
  const MONTH_NAMES = useMonthNames();
  const [activeReport, setActiveReport] = useState<"salaries" | "advances">("salaries");

  const { data: salaryOutstanding = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll/outstanding"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: activeReport === "salaries",
  });

  const { data: advanceOutstanding = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll/advances-outstanding"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: activeReport === "advances",
  });

  const totalSalaryRemaining = salaryOutstanding.reduce((s: number, r: any) => s + parseFloat(r.remaining || "0"), 0);
  const totalAdvanceRemaining = advanceOutstanding.reduce((s: number, r: any) => s + parseFloat(r.remaining_amount || "0"), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-50 rounded-lg p-4 text-center cursor-pointer border-2 transition-colors"
          style={{ borderColor: activeReport === "salaries" ? "#ef4444" : "transparent" }}
          onClick={() => setActiveReport("salaries")} data-testid="card-salary-outstanding">
          <p className="text-xs text-red-600">{t("hr.outstanding_salaries")}</p>
          <p className="text-xl font-bold text-red-700">{totalSalaryRemaining.toFixed(3)} {t("common.omr")}</p>
          <p className="text-xs text-red-500">{salaryOutstanding.length} {t("hr.records")}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center cursor-pointer border-2 transition-colors"
          style={{ borderColor: activeReport === "advances" ? "#f97316" : "transparent" }}
          onClick={() => setActiveReport("advances")} data-testid="card-advance-outstanding">
          <p className="text-xs text-orange-600">{t("hr.outstanding_advances")}</p>
          <p className="text-xl font-bold text-orange-700">{totalAdvanceRemaining.toFixed(3)} {t("common.omr")}</p>
          <p className="text-xs text-orange-500">{advanceOutstanding.length} {t("hr.records")}</p>
        </div>
      </div>

      {activeReport === "salaries" && (
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-3 border-b bg-muted/20">
            <h3 className="text-sm font-bold">{t("hr.outstanding_salaries_report")}</h3>
          </div>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("common.employee")}</TableHead>
                <TableHead>{t("common.branch")}</TableHead>
                <TableHead>{t("hr.table_month")}</TableHead>
                <TableHead>{t("hr.net_salary")}</TableHead>
                <TableHead>{t("hr.total_paid")}</TableHead>
                <TableHead>{t("hr.remaining_to_pay")}</TableHead>
                <TableHead>{t("hr.payment_status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salaryOutstanding.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("hr.no_outstanding_salaries")}</TableCell></TableRow>
              ) : salaryOutstanding.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.employee_name}</TableCell>
                  <TableCell className="text-sm">{r.branch_name || "—"}</TableCell>
                  <TableCell className="text-sm">{MONTH_NAMES[parseInt(r.month) - 1]} {r.year}</TableCell>
                  <TableCell className="font-bold">{fmt(r.net_salary)}</TableCell>
                  <TableCell className="text-green-600">{fmt(r.total_paid)}</TableCell>
                  <TableCell className="text-red-600 font-bold">{fmt(r.remaining)}</TableCell>
                  <TableCell>{paymentStatusBadge(r.paymentStatus, t)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {salaryOutstanding.length > 0 && (
            <div className="p-3 border-t bg-muted/30 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{salaryOutstanding.length} {t("hr.records")}</span>
              <span className="font-bold text-red-600">{t("hr.total_remaining")}: {totalSalaryRemaining.toFixed(3)} {t("common.omr")}</span>
            </div>
          )}
        </div>
      )}

      {activeReport === "advances" && (
        <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
          <div className="p-3 border-b bg-muted/20">
            <h3 className="text-sm font-bold">{t("hr.outstanding_advances_report")}</h3>
          </div>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("common.employee")}</TableHead>
                <TableHead>{t("common.branch")}</TableHead>
                <TableHead>{t("hr.advance_amount")}</TableHead>
                <TableHead>{t("hr.total_repaid")}</TableHead>
                <TableHead>{t("hr.remaining_amount")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("common.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advanceOutstanding.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("hr.no_outstanding_advances")}</TableCell></TableRow>
              ) : advanceOutstanding.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.employee_name}</TableCell>
                  <TableCell className="text-sm">{r.branch_name || "—"}</TableCell>
                  <TableCell className="font-bold">{fmt(r.amount)}</TableCell>
                  <TableCell className="text-green-600">{fmt(r.total_repaid)}</TableCell>
                  <TableCell className="text-red-600 font-bold">{fmt(r.remaining_amount)}</TableCell>
                  <TableCell className="text-sm">{fmtDate(r.date)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {advanceOutstanding.length > 0 && (
            <div className="p-3 border-t bg-muted/30 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{advanceOutstanding.length} {t("hr.records")}</span>
              <span className="font-bold text-orange-600">{t("hr.total_remaining")}: {totalAdvanceRemaining.toFixed(3)} {t("common.omr")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ==================== REPORTS TAB (includes Performance) ==================== */
function ReportsTab({ usersList, branchMap, branchesList }: any) {
  const { t } = useI18n();
  const MONTH_NAMES = useMonthNames();
  const [reportType, setReportType] = useState("employee_statement");
  const [empId, setEmpId] = useState("");
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const [rMonth, setRMonth] = useState(String(new Date().getMonth() + 1));
  const [rYear, setRYear] = useState(String(new Date().getFullYear()));
  const [selectedBranch, setSelectedBranch] = useState("__all__");

  const statementUrl = empId ? `/api/reports/employee-statement/${empId}?from=${from}&to=${to}` : null;
  const { data: statement } = useQuery<any>({
    queryKey: [statementUrl],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: reportType === "employee_statement" && !!empId,
  });

  const { data: payrollPayments } = useQuery<any>({
    queryKey: [`/api/reports/payroll-payments?month=${rMonth}&year=${rYear}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: reportType === "payroll_payments",
  });

  const { data: recurringDed } = useQuery<any[]>({
    queryKey: ["/api/reports/recurring-deductions"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: reportType === "recurring_deductions",
  });

  const { data: branchPayroll } = useQuery<any>({
    queryKey: [`/api/reports/payroll-by-branch?month=${rMonth}&year=${rYear}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: reportType === "branch_payroll",
  });

  const { data: comparison } = useQuery<any>({
    queryKey: [`/api/reports/payroll-comparison?year=${rYear}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: reportType === "payroll_comparison",
  });

  const { data: empReport = [] } = useQuery<any[]>({
    queryKey: [`/api/reports/profit/employees?from=${from}&to=${to}${selectedBranch && selectedBranch !== "__all__" ? `&branchId=${selectedBranch}` : ""}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: reportType === "performance",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">{t("hr.report_type")}</label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-56" data-testid="select-report-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="employee_statement">{t("hr.report_employee_statement")}</SelectItem>
              <SelectItem value="payroll_payments">{t("hr.report_payroll_payments")}</SelectItem>
              <SelectItem value="recurring_deductions">{t("hr.report_recurring_deductions")}</SelectItem>
              <SelectItem value="branch_payroll">{t("hr.report_branch_payroll")}</SelectItem>
              <SelectItem value="payroll_comparison">{t("hr.report_payroll_comparison")}</SelectItem>
              <SelectItem value="performance">{t("hr.performance_report")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {reportType === "employee_statement" && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("common.employee")}</label>
              <Select value={empId} onValueChange={setEmpId}>
                <SelectTrigger className="w-48"><SelectValue placeholder={t("hr.select_employee")} /></SelectTrigger>
                <SelectContent>
                  {usersList.filter((u: any) => u.role !== "owner").map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("hr.from_date")}</label>
              <Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("hr.to_date")}</label>
              <Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </>
        )}

        {["payroll_payments", "branch_payroll"].includes(reportType) && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("hr.select_month")}</label>
              <Select value={rMonth} onValueChange={setRMonth}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("hr.select_year")}</label>
              <Input type="number" className="w-24" value={rYear} onChange={e => setRYear(e.target.value)} />
            </div>
          </>
        )}

        {reportType === "payroll_comparison" && (
          <div className="space-y-1">
            <label className="text-xs font-medium">{t("hr.select_year")}</label>
            <Input type="number" className="w-24" value={rYear} onChange={e => setRYear(e.target.value)} />
          </div>
        )}

        {reportType === "performance" && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("hr.from_date")}</label>
              <Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("hr.to_date")}</label>
              <Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("common.branch")}</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-48"><SelectValue placeholder={t("common.all_branches")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("common.all_branches")}</SelectItem>
                  {(branchesList || []).map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        {reportType === "employee_statement" && statement && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-blue-600">{t("hr.total_earned")}</p>
                <p className="text-sm font-bold text-blue-700">{fmt(statement.summary?.totalEarned)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-green-600">{t("hr.total_paid")}</p>
                <p className="text-sm font-bold text-green-700">{fmt(statement.summary?.totalPaid)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-red-600">{t("hr.total_deducted")}</p>
                <p className="text-sm font-bold text-red-700">{fmt(statement.summary?.totalDeducted)}</p>
              </div>
            </div>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("hr.movement_type")}</TableHead>
                  <TableHead>{t("common.amount")}</TableHead>
                  <TableHead>{t("hr.balance_after")}</TableHead>
                  <TableHead>{t("common.notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(statement.entries || []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("common.no_data")}</TableCell></TableRow>
                ) : (statement.entries || []).map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{fmtDate(e.date)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{t(`hr.ledger_${e.movement_type}`) || e.movement_type}</Badge></TableCell>
                    <TableCell className={`font-bold ${parseFloat(e.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(e.amount)}</TableCell>
                    <TableCell className="font-medium">{fmt(e.balance_after)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.note || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {reportType === "payroll_payments" && (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("common.employee")}</TableHead>
                <TableHead>{t("common.amount")}</TableHead>
                <TableHead>{t("hr.payment_method")}</TableHead>
                <TableHead>{t("hr.reference_no")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("common.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!payrollPayments || (payrollPayments.payments || []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{t("common.no_data")}</TableCell></TableRow>
              ) : (payrollPayments.payments || []).map((p: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{p.employee_name || "—"}</TableCell>
                  <TableCell className="font-bold text-green-600">{fmt(p.amount)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{t(`hr.pay_${p.payment_method}`) || p.payment_method}</Badge></TableCell>
                  <TableCell className="text-sm">{p.reference_no || "—"}</TableCell>
                  <TableCell className="text-sm">{fmtDate(p.date)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {reportType === "recurring_deductions" && (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("common.employee")}</TableHead>
                <TableHead>{t("hr.deduction_type")}</TableHead>
                <TableHead>{t("common.amount")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!recurringDed || recurringDed.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">{t("common.no_data")}</TableCell></TableRow>
              ) : recurringDed.map((d: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{d.employee_name || "—"}</TableCell>
                  <TableCell>{d.type === "recurring" ? t("hr.recurring") : t("hr.one_time")}</TableCell>
                  <TableCell className="font-bold text-red-600">{fmt(d.amount)}</TableCell>
                  <TableCell>{d.is_active ? <Badge className="bg-green-100 text-green-700 text-xs">{t("status_labels.active")}</Badge> : <Badge variant="outline" className="text-xs">{t("status_labels.inactive")}</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {reportType === "branch_payroll" && (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("common.branch")}</TableHead>
                <TableHead>{t("hr.employees_count")}</TableHead>
                <TableHead>{t("hr.total_basic_salary")}</TableHead>
                <TableHead>{t("hr.table_commissions")}</TableHead>
                <TableHead>{t("hr.total_deductions")}</TableHead>
                <TableHead>{t("hr.net_salary")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!branchPayroll || (branchPayroll.branches || []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{t("common.no_data")}</TableCell></TableRow>
              ) : (branchPayroll.branches || []).map((b: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{b.branch_name || "—"}</TableCell>
                  <TableCell>{b.employee_count}</TableCell>
                  <TableCell>{fmt(b.total_basic)}</TableCell>
                  <TableCell className="text-blue-600">{fmt(b.total_commission)}</TableCell>
                  <TableCell className="text-red-600">{fmt(b.total_deductions)}</TableCell>
                  <TableCell className="font-bold text-primary">{fmt(b.total_net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {reportType === "payroll_comparison" && (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("hr.table_month")}</TableHead>
                <TableHead>{t("hr.employees_count")}</TableHead>
                <TableHead>{t("hr.total_basic_salary")}</TableHead>
                <TableHead>{t("hr.table_commissions")}</TableHead>
                <TableHead>{t("hr.net_salary")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!comparison || (comparison.months || []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("common.no_data")}</TableCell></TableRow>
              ) : (comparison.months || []).map((m: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{MONTH_NAMES[parseInt(m.month) - 1]}</TableCell>
                  <TableCell>{m.employee_count}</TableCell>
                  <TableCell>{fmt(m.total_basic)}</TableCell>
                  <TableCell className="text-blue-600">{fmt(m.total_commission)}</TableCell>
                  <TableCell className="font-bold text-primary">{fmt(m.total_net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {reportType === "performance" && (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("hr.table_employee")}</TableHead>
                <TableHead>{t("hr.table_orders_count")}</TableHead>
                <TableHead>{t("hr.table_total_sales")}</TableHead>
                <TableHead>{t("hr.table_cogs")}</TableHead>
                <TableHead>{t("hr.table_profit")}</TableHead>
                <TableHead>{t("hr.table_margin")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empReport.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.no_data")}</TableCell></TableRow>
              ) : empReport.map((e: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{e.name || e.cashier_name || "—"}</TableCell>
                  <TableCell>{e.count}</TableCell>
                  <TableCell>{fmt(e.total)}</TableCell>
                  <TableCell>{fmt(e.cogs)}</TableCell>
                  <TableCell className="text-green-600 font-medium">{fmt(e.profit)}</TableCell>
                  <TableCell>{e.margin}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {reportType === "employee_statement" && !empId && (
          <div className="p-8 text-center text-muted-foreground">{t("hr.select_employee_prompt")}</div>
        )}
      </div>
    </div>
  );
}

/* ==================== FINANCIAL PROFILE DIALOG ==================== */
function FinancialProfileDialog({ open, onOpenChange, employeeId }: { open: boolean; onOpenChange: (v: boolean) => void; employeeId: number | null }) {
  const { t } = useI18n();
  const MONTH_NAMES = useMonthNames();
  const [activeTab, setActiveTab] = useState<"summary" | "advances" | "deductions" | "salaries" | "payments" | "statement">("summary");

  const { data: profile } = useQuery<any>({
    queryKey: [employeeId ? `/api/employees/${employeeId}/financial-profile` : null],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open,
  });

  const { data: ledgerEntries = [] } = useQuery<any[]>({
    queryKey: [employeeId ? `/api/employees/${employeeId}/ledger` : null],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open && activeTab === "statement",
  });

  if (!profile) return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{t("hr.financial_profile")}</DialogTitle>
          <DialogDescription>{t("common.loading")}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );

  const emp = profile.employee;
  const adv = profile.advances;
  const ded = profile.deductions;
  const lp = profile.lastPayroll;
  const history = profile.payrollHistory || [];

  const tabBtns = [
    { key: "summary", label: t("hr.fin_tab_summary"), icon: <Wallet className="w-3 h-3" /> },
    { key: "advances", label: t("hr.fin_tab_advances"), icon: <Banknote className="w-3 h-3" /> },
    { key: "deductions", label: t("hr.fin_tab_deductions"), icon: <MinusCircle className="w-3 h-3" /> },
    { key: "salaries", label: t("hr.fin_tab_salaries"), icon: <FileText className="w-3 h-3" /> },
    { key: "payments", label: t("hr.fin_tab_payments"), icon: <CreditCard className="w-3 h-3" /> },
    { key: "statement", label: t("hr.fin_tab_statement"), icon: <BookOpen className="w-3 h-3" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-amber-600" />
            {t("hr.financial_profile")} - {emp.name}
          </DialogTitle>
          <DialogDescription>{emp.branch_name || ""} - {emp.role} {emp.pin ? `| PIN: ${emp.pin}` : ""}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 flex-wrap mb-3">
          {tabBtns.map(tb => (
            <Button key={tb.key} variant={activeTab === tb.key ? "default" : "outline"} size="sm" className="gap-1 text-xs" onClick={() => setActiveTab(tb.key as any)}>
              {tb.icon} {tb.label}
            </Button>
          ))}
        </div>

        {activeTab === "summary" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-blue-600">{t("hr.fin_basic_salary")}</p>
                <p className="text-sm font-bold text-blue-700">{fmt(emp.salary)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-red-600">{t("hr.fin_open_advances")}</p>
                <p className="text-sm font-bold text-red-700">{adv.remaining.toFixed(3)}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-orange-600">{t("hr.fin_total_deductions")}</p>
                <p className="text-sm font-bold text-orange-700">{ded.total.toFixed(3)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-600">{t("hr.fin_last_payment")}</p>
                <p className="text-sm font-bold text-gray-700">{fmtDate(profile.lastPaymentDate)}</p>
              </div>
            </div>
            {lp && (
              <div className="bg-primary/5 rounded-lg p-3">
                <h4 className="text-sm font-bold mb-2">{t("hr.fin_last_net_salary")}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">{t("hr.table_month")}:</span> <span className="font-medium">{MONTH_NAMES[parseInt(lp.month) - 1]} {lp.year}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.basic_salary")}:</span> <span className="font-medium">{fmt(lp.basicSalary)}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.table_commissions")}:</span> <span className="font-medium text-blue-600">{fmt(lp.commission)}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.table_deductions")}:</span> <span className="font-medium text-red-600">{fmt(lp.deductions)}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.net_salary")}:</span> <span className="font-bold text-primary">{fmt(lp.netSalary)}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.total_paid")}:</span> <span className="font-medium text-green-600">{fmt(lp.totalPaid)}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.remaining_to_pay")}:</span> <span className="font-bold text-red-600">{fmt(lp.remaining)}</span></div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "advances" && (
          <div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-blue-600">{t("hr.total_advances_amount")}</p>
                <p className="text-sm font-bold text-blue-700">{adv.total.toFixed(3)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-green-600">{t("hr.advances_repaid")}</p>
                <p className="text-sm font-bold text-green-700">{adv.repaid.toFixed(3)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-red-600">{t("hr.advances_remaining")}</p>
                <p className="text-sm font-bold text-red-700">{adv.remaining.toFixed(3)}</p>
              </div>
            </div>
            {adv.openAdvances.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t("common.amount")}</TableHead>
                    <TableHead>{t("hr.total_repaid")}</TableHead>
                    <TableHead>{t("hr.remaining_amount")}</TableHead>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("common.notes")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adv.openAdvances.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-bold">{fmt(a.amount)}</TableCell>
                      <TableCell className="text-green-600">{fmt(a.total_repaid)}</TableCell>
                      <TableCell className="text-red-600 font-bold">{fmt(a.remaining_amount)}</TableCell>
                      <TableCell className="text-sm">{fmtDate(a.date)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.note || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-6 text-muted-foreground">{t("hr.no_advance_data")}</div>
            )}
          </div>
        )}

        {activeTab === "deductions" && (
          <div>
            <div className="bg-red-50 rounded-lg p-3 text-center mb-3">
              <p className="text-[10px] text-red-600">{t("hr.fin_total_deductions")}</p>
              <p className="text-sm font-bold text-red-700">{ded.total.toFixed(3)}</p>
            </div>
            {ded.total > 0 ? (
              <p className="text-sm text-muted-foreground text-center">{t("hr.total_deductions")}: {ded.total.toFixed(3)}</p>
            ) : (
              <div className="text-center py-6 text-muted-foreground">{t("hr.no_deduction_data")}</div>
            )}
          </div>
        )}

        {activeTab === "salaries" && (
          <div>
            {history.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t("hr.table_month")}</TableHead>
                    <TableHead>{t("hr.net_salary")}</TableHead>
                    <TableHead>{t("hr.total_paid")}</TableHead>
                    <TableHead>{t("hr.remaining_to_pay")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{MONTH_NAMES[parseInt(h.month) - 1]} {h.year}</TableCell>
                      <TableCell className="font-bold">{fmt(h.netSalary)}</TableCell>
                      <TableCell className="text-green-600">{fmt(h.totalPaid)}</TableCell>
                      <TableCell className="text-red-600">{fmt(h.remaining)}</TableCell>
                      <TableCell>{paymentStatusBadge(h.paymentStatus, t)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-6 text-muted-foreground">{t("hr.no_salary_data")}</div>
            )}
          </div>
        )}

        {activeTab === "payments" && (
          <div>
            {history.length > 0 ? (
              <div className="space-y-2">
                {history.filter((h: any) => parseFloat(h.totalPaid || "0") > 0).map((h: any, i: number) => (
                  <div key={i} className="bg-green-50 rounded-lg p-2 flex justify-between items-center text-sm">
                    <span className="font-medium">{MONTH_NAMES[parseInt(h.month) - 1]} {h.year}</span>
                    <span className="text-green-700 font-bold">{fmt(h.totalPaid)} {t("common.omr")}</span>
                  </div>
                ))}
                {history.filter((h: any) => parseFloat(h.totalPaid || "0") > 0).length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">{t("hr.no_payment_data")}</div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">{t("hr.no_payment_data")}</div>
            )}
          </div>
        )}

        {activeTab === "statement" && (
          <div>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("hr.movement_type")}</TableHead>
                  <TableHead>{t("common.amount")}</TableHead>
                  <TableHead>{t("hr.balance_after")}</TableHead>
                  <TableHead>{t("common.notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("hr.no_ledger_entries")}</TableCell></TableRow>
                ) : ledgerEntries.map((le: any) => (
                  <TableRow key={le.id}>
                    <TableCell className="text-sm">{fmtDate(le.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {t(`hr.ledger_${le.movement_type}`) || le.movement_type}
                      </Badge>
                    </TableCell>
                    <TableCell className={`font-bold ${parseFloat(le.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(le.amount)}</TableCell>
                    <TableCell className="font-medium">{fmt(le.balance_after)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{le.note || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
