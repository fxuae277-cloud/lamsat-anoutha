import { useState, useRef } from "react";
import { Plus, Users, Building2, Phone, KeyRound, Wallet, Search, TrendingUp, ShoppingBag, Receipt, Clock, Edit, Eye, Shield, Hash, UserCheck, BarChart3, Calendar, FileText, Banknote, MinusCircle, CreditCard, CheckCircle2, RefreshCw, Percent, Printer, Download, FileSpreadsheet, DollarSign, CircleDollarSign, AlertCircle, User, ClipboardCheck, RotateCcw, XCircle, BookOpen, UserX, Pause, ArrowRightLeft, Filter, Save } from "lucide-react";
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
  const currentMonthRun = payrollRuns.find((r: any) => parseInt(r.month) === currentMonth && parseInt(r.year) === currentYear && r.status !== "cancelled");
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
          <TabsTrigger value="employees" className="gap-1 text-xs" data-testid="tab-employees">
            <Users className="w-3.5 h-3.5" />
            {t("hr.tab_employees")}
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-1 text-xs" data-testid="tab-movements">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            {t("hr.tab_financial_movements")}
          </TabsTrigger>
          <TabsTrigger value="salaries" className="gap-1 text-xs" data-testid="tab-salaries">
            <FileText className="w-3.5 h-3.5" />
            {t("hr.tab_monthly_salaries")}
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1 text-xs" data-testid="tab-payments">
            <CreditCard className="w-3.5 h-3.5" />
            {t("hr.tab_payments")}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1 text-xs" data-testid="tab-reports">
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
          <FinancialMovementsTab usersList={usersList} branchesList={branchesList} />
        </TabsContent>

        <TabsContent value="salaries">
          <MonthlySalariesTab usersList={usersList} />
        </TabsContent>

        <TabsContent value="payments">
          <SalaryPaymentsTab usersList={usersList} />
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
                <label className="text-sm font-medium flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" />{t("hr.pin")}</label>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.base_salary")}</label>
                <Input type="number" step="0.001" placeholder="0.000" value={newUser.salary} onChange={e => setNewUser({...newUser, salary: e.target.value})} data-testid="input-emp-salary" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.commission_rate")}</label>
                <Input type="number" step="0.01" placeholder="0.00" value={newUser.commissionRate} onChange={e => setNewUser({...newUser, commissionRate: e.target.value})} data-testid="input-emp-commission" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("settings.terminal_name")}</label>
                <Input placeholder="POS-1" value={newUser.terminalName} onChange={e => setNewUser({...newUser, terminalName: e.target.value})} data-testid="input-emp-terminal" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.phone")}</label>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.base_salary")}</label>
                  <Input type="number" step="0.001" value={selectedUser.salary || ""} onChange={e => setSelectedUser({...selectedUser, salary: e.target.value})} data-testid="input-edit-salary" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.commission_rate")}</label>
                  <Input type="number" step="0.01" value={selectedUser.commissionRate || ""} onChange={e => setSelectedUser({...selectedUser, commissionRate: e.target.value})} data-testid="input-edit-commission" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.fin_pin_code")}</label>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="ps-9" placeholder={t("hr.search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-emp" />
        </div>
        <Button className="gap-1" onClick={onAdd} data-testid="button-add-employee">
          <Plus className="w-4 h-4" />
          {t("hr.add_employee")}
        </Button>
      </div>
      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("hr.full_name")}</TableHead>
              <TableHead>{t("settings.branch_label")}</TableHead>
              <TableHead>{t("settings.role_label")}</TableHead>
              <TableHead>{t("hr.base_salary")}</TableHead>
              <TableHead>{t("hr.phone")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersList.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("hr.no_employees")}</TableCell></TableRow>
            ) : usersList.map((u: any) => (
              <TableRow key={u.id} data-testid={`row-emp-${u.id}`}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-sm">{branchMap[u.branchId] || "-"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{ROLE_LABELS[u.role] || u.role}</Badge></TableCell>
                <TableCell className="font-medium">{fmt(u.salary)} {t("common.omr")}</TableCell>
                <TableCell className="text-sm">{u.phone || "-"}</TableCell>
                <TableCell>
                  {u.isActive ? (
                    <Badge className="bg-green-100 text-green-700 text-xs">{t("status_labels.active")}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-500 text-xs">{t("status_labels.inactive")}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(u)} title={t("common.edit")} data-testid={`button-edit-emp-${u.id}`}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" onClick={() => onFinProfile(u)} title={t("hr.financial_profile")} data-testid={`button-fin-${u.id}`}>
                      <Wallet className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" onClick={() => onPerf(u)} title={t("hr.performance_report")} data-testid={`button-perf-${u.id}`}>
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

/* ==================== FINANCIAL MOVEMENTS TAB ==================== */
function FinancialMovementsTab({ usersList, branchesList }: { usersList: any[]; branchesList: Branch[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const MONTH_NAMES = useMonthNames();
  const now = new Date();
  const [filterType, setFilterType] = useState("__all__");
  const [filterEmp, setFilterEmp] = useState("__all__");
  const [filterMonth, setFilterMonth] = useState(String(now.getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()));
  const [addAdvanceOpen, setAddAdvanceOpen] = useState(false);
  const [addDeductionOpen, setAddDeductionOpen] = useState(false);
  const [advEmpId, setAdvEmpId] = useState("");
  const [advAmount, setAdvAmount] = useState("");
  const [advDate, setAdvDate] = useState(todayStr());
  const [advNote, setAdvNote] = useState("");
  const [dedEmpId, setDedEmpId] = useState("");
  const [dedAmount, setDedAmount] = useState("");
  const [dedDate, setDedDate] = useState(todayStr());
  const [dedReason, setDedReason] = useState("");
  const [dedMonth, setDedMonth] = useState(String(now.getMonth() + 1));

  const employees = usersList.filter(u => u.role !== "owner");

  const { data: advances = [] } = useQuery<any[]>({
    queryKey: ["/api/employee-advances"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const { data: deductions = [] } = useQuery<any[]>({
    queryKey: ["/api/employee-deductions"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const advanceMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/employee-advances", {
        employeeId: Number(advEmpId), amount: advAmount, date: advDate, note: advNote,
        deductionMode: "full_next_payroll",
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.advance_recorded") });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-advances"] });
      setAddAdvanceOpen(false); setAdvEmpId(""); setAdvAmount(""); setAdvNote("");
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const deductionMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/employee-deductions", {
        employeeId: Number(dedEmpId), amount: dedAmount, date: dedDate, reason: dedReason,
        deductionType: "one_time", monthReference: `${filterYear}-${dedMonth.padStart(2, "0")}`,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.deduction_recorded") });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-deductions"] });
      setAddDeductionOpen(false); setDedEmpId(""); setDedAmount(""); setDedReason("");
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const empMap = Object.fromEntries(usersList.map(u => [u.id, u.name]));

  const allMovements: any[] = [];
  advances.forEach((a: any) => {
    const d = new Date(a.date);
    allMovements.push({
      id: `adv-${a.id}`, type: "advance", employeeId: a.employee_id,
      employeeName: a.employee_name || empMap[a.employee_id] || "-",
      amount: a.amount, date: a.date, month: String(d.getMonth() + 1), year: String(d.getFullYear()),
      note: a.note, status: a.settled ? t("hr.settled") : t("hr.unsettled"),
      createdBy: a.created_by_name || "-", raw: a,
    });
  });
  deductions.forEach((d: any) => {
    const dt = new Date(d.date);
    const mr = d.month_reference || "";
    const mParts = mr.split("-");
    allMovements.push({
      id: `ded-${d.id}`, type: "deduction", employeeId: d.employee_id,
      employeeName: d.employee_name || empMap[d.employee_id] || "-",
      amount: d.amount, date: d.date,
      month: mParts.length === 2 ? String(parseInt(mParts[1])) : String(dt.getMonth() + 1),
      year: mParts.length === 2 ? mParts[0] : String(dt.getFullYear()),
      note: d.reason, status: d.applied_in_payroll_id ? t("hr.applied") : t("hr.not_applied"),
      createdBy: d.created_by_name || "-", raw: d,
    });
  });

  allMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = allMovements.filter(m => {
    if (filterType !== "__all__" && m.type !== filterType) return false;
    if (filterEmp !== "__all__" && String(m.employeeId) !== filterEmp) return false;
    if (m.month !== filterMonth || m.year !== filterYear) return false;
    return true;
  });

  const totalAdvances = filtered.filter(m => m.type === "advance").reduce((s, m) => s + parseFloat(m.amount || "0"), 0);
  const totalDeductions = filtered.filter(m => m.type === "deduction").reduce((s, m) => s + parseFloat(m.amount || "0"), 0);

  const typeLabel = (type: string) => {
    if (type === "advance") return t("hr.movement_type_advance");
    if (type === "deduction") return t("hr.movement_type_deduction");
    if (type === "commission") return t("hr.movement_type_commission");
    if (type === "entitlement") return t("hr.movement_type_entitlement");
    return type;
  };

  const typeBadge = (type: string) => {
    if (type === "advance") return <Badge className="bg-red-100 text-red-700 text-xs">{typeLabel(type)}</Badge>;
    if (type === "deduction") return <Badge className="bg-orange-100 text-orange-700 text-xs">{typeLabel(type)}</Badge>;
    if (type === "commission") return <Badge className="bg-blue-100 text-blue-700 text-xs">{typeLabel(type)}</Badge>;
    return <Badge className="bg-green-100 text-green-700 text-xs">{typeLabel(type)}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold">{t("hr.financial_movements_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("hr.financial_movements_subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="gap-1 bg-red-600 hover:bg-red-700" onClick={() => setAddAdvanceOpen(true)} data-testid="button-add-advance">
            <Plus className="w-3.5 h-3.5" /> {t("hr.record_advance")}
          </Button>
          <Button size="sm" className="gap-1 bg-orange-600 hover:bg-orange-700" onClick={() => setAddDeductionOpen(true)} data-testid="button-add-deduction">
            <Plus className="w-3.5 h-3.5" /> {t("hr.record_deduction")}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-end">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("hr.all_types")}</SelectItem>
            <SelectItem value="advance">{t("hr.movement_type_advance")}</SelectItem>
            <SelectItem value="deduction">{t("hr.movement_type_deduction")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEmp} onValueChange={setFilterEmp}>
          <SelectTrigger className="w-44"><SelectValue placeholder={t("hr.all_employees")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("hr.all_employees")}</SelectItem>
            {employees.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="number" className="w-24" value={filterYear} onChange={e => setFilterYear(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-red-600">{t("hr.total_advances")}</p>
          <p className="text-sm font-bold text-red-700">{totalAdvances.toFixed(3)}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-orange-600">{t("hr.total_deductions")}</p>
          <p className="text-sm font-bold text-orange-700">{totalDeductions.toFixed(3)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-gray-600">{t("hr.total_movements")}</p>
          <p className="text-sm font-bold text-gray-700">{filtered.length}</p>
        </div>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("common.employee")}</TableHead>
              <TableHead>{t("hr.movement_type")}</TableHead>
              <TableHead>{t("common.amount")}</TableHead>
              <TableHead>{t("hr.month_reference")}</TableHead>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("hr.reason")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("hr.created_by")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("hr.no_ledger_entries")}</TableCell></TableRow>
            ) : filtered.map((m: any) => (
              <TableRow key={m.id} data-testid={`row-movement-${m.id}`}>
                <TableCell className="font-medium">{m.employeeName}</TableCell>
                <TableCell>{typeBadge(m.type)}</TableCell>
                <TableCell className="font-bold">{fmt(m.amount)}</TableCell>
                <TableCell>{MONTH_NAMES[parseInt(m.month) - 1]} {m.year}</TableCell>
                <TableCell>{fmtDate(m.date)}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">{m.note || "-"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{m.status}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.createdBy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add Advance Dialog */}
      <Dialog open={addAdvanceOpen} onOpenChange={setAddAdvanceOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("hr.record_advance")}</DialogTitle>
            <DialogDescription>{t("hr.record_advance_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.employee")} *</label>
              <Select value={advEmpId} onValueChange={setAdvEmpId}>
                <SelectTrigger><SelectValue placeholder={t("hr.select_employee_prompt")} /></SelectTrigger>
                <SelectContent>{employees.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.amount")} *</label>
                <Input type="number" step="0.001" value={advAmount} onChange={e => setAdvAmount(e.target.value)} data-testid="input-advance-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.date")} *</label>
                <Input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <Input placeholder={t("hr.advance_note_placeholder")} value={advNote} onChange={e => setAdvNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => advanceMutation.mutate()} disabled={advanceMutation.isPending || !advEmpId || !advAmount} data-testid="button-save-advance">
              {advanceMutation.isPending ? t("common.saving") : t("hr.record_advance")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Deduction Dialog */}
      <Dialog open={addDeductionOpen} onOpenChange={setAddDeductionOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("hr.record_deduction")}</DialogTitle>
            <DialogDescription>{t("hr.record_deduction_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.employee")} *</label>
              <Select value={dedEmpId} onValueChange={setDedEmpId}>
                <SelectTrigger><SelectValue placeholder={t("hr.select_employee_prompt")} /></SelectTrigger>
                <SelectContent>{employees.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.amount")} *</label>
                <Input type="number" step="0.001" value={dedAmount} onChange={e => setDedAmount(e.target.value)} data-testid="input-deduction-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("hr.month_reference")}</label>
                <Select value={dedMonth} onValueChange={setDedMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.date")} *</label>
                <Input type="date" value={dedDate} onChange={e => setDedDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("hr.reason")} *</label>
              <Input placeholder={t("hr.notes_placeholder")} value={dedReason} onChange={e => setDedReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => deductionMutation.mutate()} disabled={deductionMutation.isPending || !dedEmpId || !dedAmount || !dedReason} data-testid="button-save-deduction">
              {deductionMutation.isPending ? t("common.saving") : t("hr.record_deduction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== MONTHLY SALARIES TAB ==================== */
function MonthlySalariesTab({ usersList }: { usersList: any[] }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const MONTH_NAMES = useMonthNames();
  const printRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const [selMonth, setSelMonth] = useState(String(now.getMonth() + 1));
  const [selYear, setSelYear] = useState(String(now.getFullYear()));
  const [createOpen, setCreateOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [slipOpen, setSlipOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);

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

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/payroll-runs", { month: selMonth, year: Number(selYear), note: newNote });
    },
    onSuccess: () => {
      toast({ title: t("hr.payroll_generated") });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      setCreateOpen(false); setNewNote("");
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/approve`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_approved") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); queryClient.invalidateQueries({ queryKey: [detailsKey] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const reviewMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/review`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_reviewed") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/cancel`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_cancelled") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/reopen`, {}); },
    onSuccess: () => { toast({ title: t("hr.payroll_reopened") }); queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] }); },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("POST", `/api/payroll-runs/${id}/regenerate`, {}); },
    onSuccess: () => {
      toast({ title: t("hr.payroll_recalculated") });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: [detailsKey] });
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }); },
  });

  const totalBasic = details.reduce((s, d: any) => s + parseFloat(d.basic_salary || "0"), 0);
  const totalCommissions = details.reduce((s, d: any) => s + parseFloat(d.commission || "0"), 0);
  const totalDeductions = details.reduce((s, d: any) => s + parseFloat(d.deductions || "0"), 0);
  const totalAdvances = details.reduce((s, d: any) => s + parseFloat(d.advances || "0"), 0);
  const totalNet = details.reduce((s, d: any) => s + parseFloat(d.net_salary || "0"), 0);
  const totalPaid = details.reduce((s, d: any) => s + parseFloat(d.total_paid || "0"), 0);
  const totalRemaining = totalNet - totalPaid;

  const slipRef = useRef<HTMLDivElement>(null);
  const handleSlipPrint = () => {
    if (!slipRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>${t("hr.salary_slip")}</title><style>body{font-family:Arial,sans-serif;padding:30px;max-width:600px;margin:0 auto}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:10px;text-align:${lang === 'ar' ? 'right' : 'left'};font-size:13px}th{background:#f5f5f5;font-weight:bold;width:40%}.net{font-size:16px;font-weight:bold;color:#2563eb;text-align:center;margin:15px 0;padding:10px;background:#eff6ff;border-radius:8px}</style></head><body>${slipRef.current.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>${t("hr.monthly_salaries_title")}</title><style>body{font-family:Arial,sans-serif;padding:30px}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:8px;text-align:${lang === 'ar' ? 'right' : 'left'};font-size:12px}th{background:#f5f5f5;font-weight:bold}.header{text-align:center;margin-bottom:20px}</style></head><body><div class="header"><h1>${t("hr.monthly_salaries_title")} - ${MONTH_NAMES[parseInt(selMonth) - 1]} ${selYear}</h1></div>${printRef.current.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  const handleExport = () => {
    if (!details.length) return;
    let csv = "\uFEFF";
    csv += [t("common.employee"), t("common.branch"), t("hr.table_base_salary"), t("hr.table_commissions"), t("hr.table_deductions"), t("hr.table_advances"), t("hr.net_salary"), t("hr.total_paid"), t("hr.remaining_to_pay"), t("hr.payment_status")].join(",") + "\n";
    details.forEach((d: any) => {
      csv += [d.employee_name, d.branch_name || "-", fmt(d.basic_salary), fmt(d.commission), fmt(d.deductions), fmt(d.advances), fmt(d.net_salary), fmt(d.total_paid), fmt(d.remaining), d.payment_status === "paid" ? t("hr.status_paid") : d.payment_status === "partial" ? t("hr.status_partial") : t("hr.status_unpaid")].join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `salaries_${selMonth}_${selYear}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold">{t("hr.monthly_salaries_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("hr.monthly_salaries_subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          <Select value={selMonth} onValueChange={setSelMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" className="w-24" value={selYear} onChange={e => setSelYear(e.target.value)} />
        </div>
      </div>

      {!currentRun ? (
        <div className="bg-card border rounded-xl p-8 text-center space-y-3">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">{t("hr.no_salary_record")}</p>
          <Button className="gap-2" onClick={() => setCreateOpen(true)} data-testid="button-create-payroll">
            <Plus className="w-4 h-4" /> {t("hr.calculate_salaries")}
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
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleExport} data-testid="button-export-salaries">
                <FileSpreadsheet className="w-3 h-3" /> {t("hr.export_excel")}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-indigo-600">{t("hr.total_basic_salary")}</p>
              <p className="text-sm font-bold text-indigo-700">{totalBasic.toFixed(3)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-blue-600">{t("hr.total_commissions")}</p>
              <p className="text-sm font-bold text-blue-700">{totalCommissions.toFixed(3)}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-orange-600">{t("hr.total_deductions")}</p>
              <p className="text-sm font-bold text-orange-700">{totalDeductions.toFixed(3)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-red-600">{t("hr.total_advances")}</p>
              <p className="text-sm font-bold text-red-700">{totalAdvances.toFixed(3)}</p>
            </div>
            <div className="bg-primary/5 rounded-lg p-3 text-center">
              <p className="text-[10px] text-primary">{t("hr.total_net")}</p>
              <p className="text-sm font-bold text-primary">{totalNet.toFixed(3)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-green-600">{t("hr.total_paid")}</p>
              <p className="text-sm font-bold text-green-700">{totalPaid.toFixed(3)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-red-600">{t("hr.remaining_to_pay")}</p>
              <p className="text-sm font-bold text-red-700">{totalRemaining > 0 ? totalRemaining.toFixed(3) : "0.000"}</p>
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
                  <TableHead>{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">{t("hr.no_salary_data")}</TableCell></TableRow>
                ) : details.map((d: any) => (
                  <TableRow key={d.id} data-testid={`row-salary-${d.id}`}>
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
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setSelectedDetail(d); setSlipOpen(true); }}>
                        <Receipt className="w-3.5 h-3.5" /> {t("hr.salary_slip_view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Create Payroll Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("hr.generate_payroll_title")}</DialogTitle>
            <DialogDescription>{t("hr.generate_payroll_desc")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("hr.filter_month")}</p>
                <p className="font-bold">{MONTH_NAMES[parseInt(selMonth) - 1]}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("hr.filter_year")}</p>
                <p className="font-bold">{selYear}</p>
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

      {/* Salary Slip Dialog */}
      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              {t("hr.salary_slip_title")}
            </DialogTitle>
            <DialogDescription>{selectedDetail?.employee_name} - {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</DialogDescription>
          </DialogHeader>
          <div ref={slipRef}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #333", paddingBottom: 10, marginBottom: 15 }}>
              <h1 style={{ fontSize: 16, margin: "3px 0" }}>{t("hr.company_name")}</h1>
              <h2 style={{ fontSize: 13, color: "#666", margin: "3px 0" }}>{t("hr.salary_slip")} - {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</h2>
            </div>
            {selectedDetail && (
              <Table>
                <TableBody>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("common.employee")}</TableCell><TableCell>{selectedDetail.employee_name}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("common.branch")}</TableCell><TableCell>{selectedDetail.branch_name || "-"}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_base_salary")}</TableCell><TableCell>{fmt(selectedDetail.basic_salary)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_commissions")}</TableCell><TableCell className="text-blue-600">{fmt(selectedDetail.commission)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_deductions")}</TableCell><TableCell className="text-red-600">-{fmt(selectedDetail.deductions)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_advances")}</TableCell><TableCell className="text-red-600">-{fmt(selectedDetail.advances)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow className="bg-primary/5"><TableCell className="font-bold">{t("hr.net_salary")}</TableCell><TableCell className="font-bold text-primary text-lg">{fmt(selectedDetail.net_salary)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.total_paid")}</TableCell><TableCell className="text-green-600">{fmt(selectedDetail.total_paid)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.remaining_to_pay")}</TableCell><TableCell className="text-red-600 font-bold">{fmt(selectedDetail.remaining)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.payment_status")}</TableCell><TableCell>{paymentStatusBadge(selectedDetail.payment_status, t)}</TableCell></TableRow>
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
    </div>
  );
}

/* ==================== SALARY PAYMENTS TAB ==================== */
function SalaryPaymentsTab({ usersList }: { usersList: any[] }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const MONTH_NAMES = useMonthNames();
  const now = new Date();
  const [selMonth, setSelMonth] = useState(String(now.getMonth() + 1));
  const [selYear, setSelYear] = useState(String(now.getFullYear()));
  const [filterEmp, setFilterEmp] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [payOpen, setPayOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payDate, setPayDate] = useState(todayStr());
  const [payNote, setPayNote] = useState("");
  const [payRefNo, setPayRefNo] = useState("");

  const employees = usersList.filter(u => u.role !== "owner");

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
    if (filterStatus === "unpaid" && d.payment_status !== "unpaid") return false;
    return true;
  });

  const totalNet = filteredDetails.reduce((s, d: any) => s + parseFloat(d.net_salary || "0"), 0);
  const totalPaid = filteredDetails.reduce((s, d: any) => s + parseFloat(d.total_paid || "0"), 0);
  const totalRemaining = filteredDetails.reduce((s, d: any) => s + parseFloat(d.remaining || "0"), 0);

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
  const handleSlipPrint = () => {
    if (!slipRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>${t("hr.salary_slip")}</title><style>body{font-family:Arial,sans-serif;padding:30px;max-width:600px;margin:0 auto}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:10px;text-align:${lang === 'ar' ? 'right' : 'left'};font-size:13px}th{background:#f5f5f5;font-weight:bold;width:40%}</style></head><body>${slipRef.current.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold">{t("hr.payments_title")}</h3>
          <p className="text-xs text-muted-foreground">{t("hr.payments_subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          <Select value={selMonth} onValueChange={setSelMonth}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" className="w-24" value={selYear} onChange={e => setSelYear(e.target.value)} />
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-44"><SelectValue placeholder={t("hr.all_employees")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("hr.all_employees")}</SelectItem>
              {employees.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
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
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
          <p>{t("hr.no_payroll_for_month")}</p>
        </div>
      ) : (
        <>
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

          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("common.employee")}</TableHead>
                  <TableHead>{t("common.branch")}</TableHead>
                  <TableHead>{t("hr.net_salary")}</TableHead>
                  <TableHead>{t("hr.total_paid")}</TableHead>
                  <TableHead>{t("hr.remaining_to_pay")}</TableHead>
                  <TableHead>{t("hr.payment_status")}</TableHead>
                  <TableHead className="w-[280px]">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDetails.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("hr.no_payment_data")}</TableCell></TableRow>
                ) : filteredDetails.map((d: any) => {
                  const remaining = parseFloat(d.remaining || "0");
                  const allowedStatuses = ["approved", "partial", "reviewed"];
                  const canPay = allowedStatuses.includes(currentRun.status) && d.payment_status !== "paid" && remaining > 0;
                  return (
                    <TableRow key={d.id} data-testid={`row-payment-${d.id}`}>
                      <TableCell className="font-medium">{d.employee_name}</TableCell>
                      <TableCell className="text-sm">{d.branch_name || "-"}</TableCell>
                      <TableCell className="font-bold text-primary">{fmt(d.net_salary)}</TableCell>
                      <TableCell className="text-green-600 font-medium">{fmt(d.total_paid)}</TableCell>
                      <TableCell className="text-red-600 font-bold">{fmt(d.remaining)}</TableCell>
                      <TableCell>{paymentStatusBadge(d.payment_status, t)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            size="sm"
                            className={canPay ? "h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-xs font-bold px-3" : "h-8 gap-1.5 text-xs font-bold px-3"}
                            variant={canPay ? "default" : "outline"}
                            disabled={!canPay}
                            onClick={() => { setSelectedDetail(d); setPayAmount(d.remaining); setPayDate(todayStr()); setPayMethod("bank_transfer"); setPayNote(""); setPayRefNo(""); setPayOpen(true); }}
                            data-testid={`button-pay-${d.id}`}
                          >
                            <DollarSign className="w-3.5 h-3.5" /> {t("hr.register_payment")}
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => { setSelectedDetail(d); setHistoryOpen(true); }}>
                            <Clock className="w-3 h-3" /> {t("hr.payment_log")}
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => { setSelectedDetail(d); setSlipOpen(true); }}>
                            <Receipt className="w-3 h-3" /> {t("hr.salary_slip_view")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="w-5 h-5 text-green-600" />
              {t("hr.record_payment_title")}
            </DialogTitle>
            <DialogDescription>{selectedDetail?.employee_name} - {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>{t("common.employee")}</span><span className="font-bold">{selectedDetail?.employee_name}</span></div>
              <div className="flex justify-between"><span>{t("hr.filter_month")}</span><span className="font-bold">{MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</span></div>
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
                  <SelectItem value="cash">{t("hr.pay_cash")}</SelectItem>
                  <SelectItem value="bank_transfer">{t("hr.pay_bank")}</SelectItem>
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
            <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending || !payAmount || parseFloat(payAmount) <= 0} className="bg-green-600 hover:bg-green-700" data-testid="button-confirm-payment">
              {payMutation.isPending ? t("common.saving") : t("hr.register_payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Slip Dialog */}
      <Dialog open={slipOpen} onOpenChange={setSlipOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5 text-primary" />{t("hr.salary_slip_title")}</DialogTitle>
            <DialogDescription>{selectedDetail?.employee_name} - {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</DialogDescription>
          </DialogHeader>
          <div ref={slipRef}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #333", paddingBottom: 10, marginBottom: 15 }}>
              <h1 style={{ fontSize: 16, margin: "3px 0" }}>{t("hr.company_name")}</h1>
              <h2 style={{ fontSize: 13, color: "#666", margin: "3px 0" }}>{t("hr.salary_slip")} - {MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</h2>
            </div>
            {selectedDetail && (
              <Table>
                <TableBody>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("common.employee")}</TableCell><TableCell>{selectedDetail.employee_name}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("common.branch")}</TableCell><TableCell>{selectedDetail.branch_name || "-"}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_base_salary")}</TableCell><TableCell>{fmt(selectedDetail.basic_salary)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_commissions")}</TableCell><TableCell className="text-blue-600">{fmt(selectedDetail.commission)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_deductions")}</TableCell><TableCell className="text-red-600">-{fmt(selectedDetail.deductions)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_advances")}</TableCell><TableCell className="text-red-600">-{fmt(selectedDetail.advances)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow className="bg-primary/5"><TableCell className="font-bold">{t("hr.net_salary")}</TableCell><TableCell className="font-bold text-primary text-lg">{fmt(selectedDetail.net_salary)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.total_paid")}</TableCell><TableCell className="text-green-600">{fmt(selectedDetail.total_paid)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.remaining_to_pay")}</TableCell><TableCell className="text-red-600 font-bold">{fmt(selectedDetail.remaining)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.payment_status")}</TableCell><TableCell>{paymentStatusBadge(selectedDetail.payment_status, t)}</TableCell></TableRow>
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            {selectedDetail && parseFloat(selectedDetail.remaining || "0") > 0 && ["approved", "partial", "reviewed"].includes(currentRun?.status) && (
              <Button className="gap-1 bg-green-600 hover:bg-green-700" onClick={() => { setSlipOpen(false); setPayAmount(selectedDetail.remaining); setPayDate(todayStr()); setPayMethod("bank_transfer"); setPayNote(""); setPayRefNo(""); setPayOpen(true); }}>
                <DollarSign className="w-3.5 h-3.5" /> {t("hr.register_payment")}
              </Button>
            )}
            <Button variant="outline" className="gap-1" onClick={handleSlipPrint}>
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
            <DialogDescription>{MONTH_NAMES[parseInt(selMonth) - 1]} {selYear}</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("common.amount")}</TableHead>
                <TableHead>{t("hr.payment_date")}</TableHead>
                <TableHead>{t("hr.payment_method")}</TableHead>
                <TableHead>{t("hr.reference_no")}</TableHead>
                <TableHead>{t("common.notes")}</TableHead>
                <TableHead>{t("hr.created_by")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{t("hr.no_payments")}</TableCell></TableRow>
              ) : paymentHistory.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-green-600">{fmt(p.amount)} {t("common.omr")}</TableCell>
                  <TableCell className="text-sm">{fmtDate(p.payment_date)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{p.payment_method === "cash" ? t("hr.pay_cash") : t("hr.pay_bank")}</Badge></TableCell>
                  <TableCell className="text-sm">{p.reference_no || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.note || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.paid_by_name || "-"}</TableCell>
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

/* ==================== REPORTS TAB ==================== */
function ReportsTab({ usersList, branchMap, branchesList }: any) {
  const { t, lang } = useI18n();
  const MONTH_NAMES = useMonthNames();
  const now = new Date();
  const [reportType, setReportType] = useState("monthly_salaries");
  const [selMonth, setSelMonth] = useState(String(now.getMonth() + 1));
  const [selYear, setSelYear] = useState(String(now.getFullYear()));
  const [selEmp, setSelEmp] = useState("__all__");
  const [selBranch, setSelBranch] = useState("__all__");
  const [fromDate, setFromDate] = useState(monthAgoStr());
  const [toDate, setToDate] = useState(todayStr());
  const printRef = useRef<HTMLDivElement>(null);
  const employees = usersList.filter((u: any) => u.role !== "owner");

  const { data: payrollRuns = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll-runs"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const currentRun = payrollRuns.find((r: any) => String(r.month) === selMonth && String(r.year) === selYear && r.status !== "cancelled");
  const detailsKey = currentRun ? `/api/payroll-runs/${currentRun.id}/details-with-payments` : null;
  const { data: salaryDetails = [] } = useQuery<any[]>({
    queryKey: [detailsKey],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!currentRun && reportType === "monthly_salaries",
  });

  const { data: outstandingData = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll/outstanding"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: reportType === "remaining_salaries",
  });

  const stmtEmpId = selEmp !== "__all__" ? selEmp : null;
  const stmtKey = stmtEmpId ? `/api/reports/employee-statement/${stmtEmpId}?from=${fromDate}&to=${toDate}` : null;
  const { data: stmtData } = useQuery<any>({
    queryKey: [stmtKey],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!stmtKey && reportType === "employee_account",
  });

  const payReportKey = `/api/reports/payroll-payments?from=${fromDate}&to=${toDate}`;
  const { data: paymentReportData = [] } = useQuery<any[]>({
    queryKey: [payReportKey],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: reportType === "salary_payments",
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const title = reportType === "monthly_salaries" ? t("hr.report_monthly_salaries") : reportType === "salary_payments" ? t("hr.report_salary_payments") : reportType === "remaining_salaries" ? t("hr.report_remaining_salaries") : t("hr.report_employee_account");
    w.document.write(`<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:30px}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{border:1px solid #ddd;padding:8px;text-align:${lang === 'ar' ? 'right' : 'left'};font-size:12px}th{background:#f5f5f5;font-weight:bold}.header{text-align:center;margin-bottom:20px}</style></head><body><div class="header"><h1>${title}</h1></div>${printRef.current.innerHTML}</body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold">{t("hr.tab_reports")}</h3>
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handlePrint}>
          <Printer className="w-3 h-3" /> {t("hr.print")}
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap items-end">
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly_salaries">{t("hr.report_monthly_salaries")}</SelectItem>
            <SelectItem value="salary_payments">{t("hr.report_salary_payments")}</SelectItem>
            <SelectItem value="remaining_salaries">{t("hr.report_remaining_salaries")}</SelectItem>
            <SelectItem value="employee_account">{t("hr.report_employee_account")}</SelectItem>
          </SelectContent>
        </Select>

        {(reportType === "monthly_salaries") && (
          <>
            <Select value={selMonth} onValueChange={setSelMonth}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTH_NAMES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" className="w-24" value={selYear} onChange={e => setSelYear(e.target.value)} />
          </>
        )}

        {(reportType === "salary_payments" || reportType === "employee_account") && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("hr.from_date")}</label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">{t("hr.to_date")}</label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
            </div>
          </>
        )}

        {reportType === "employee_account" && (
          <Select value={selEmp} onValueChange={setSelEmp}>
            <SelectTrigger className="w-44"><SelectValue placeholder={t("hr.select_employee_prompt")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("hr.select_employee_prompt")}</SelectItem>
              {employees.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div ref={printRef}>
        {/* Report: Monthly Salaries */}
        {reportType === "monthly_salaries" && (
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            {!currentRun ? (
              <div className="p-8 text-center text-muted-foreground">{t("hr.no_salary_record")}</div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t("common.employee")}</TableHead>
                    <TableHead>{t("hr.table_base_salary")}</TableHead>
                    <TableHead>{t("hr.table_commissions")}</TableHead>
                    <TableHead>{t("hr.table_deductions")}</TableHead>
                    <TableHead>{t("hr.table_advances")}</TableHead>
                    <TableHead>{t("hr.net_salary")}</TableHead>
                    <TableHead>{t("hr.total_paid")}</TableHead>
                    <TableHead>{t("hr.remaining_to_pay")}</TableHead>
                    <TableHead>{t("hr.payment_status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryDetails.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.employee_name}</TableCell>
                      <TableCell>{fmt(d.basic_salary)}</TableCell>
                      <TableCell className="text-blue-600">{fmt(d.commission)}</TableCell>
                      <TableCell className="text-red-600">{fmt(d.deductions)}</TableCell>
                      <TableCell className="text-red-600">{fmt(d.advances)}</TableCell>
                      <TableCell className="font-bold">{fmt(d.net_salary)}</TableCell>
                      <TableCell className="text-green-600">{fmt(d.total_paid)}</TableCell>
                      <TableCell className="text-red-600 font-bold">{fmt(d.remaining)}</TableCell>
                      <TableCell>{paymentStatusBadge(d.payment_status, t)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* Report: Salary Payments */}
        {reportType === "salary_payments" && (
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("common.employee")}</TableHead>
                  <TableHead>{t("common.amount")}</TableHead>
                  <TableHead>{t("hr.payment_date")}</TableHead>
                  <TableHead>{t("hr.payment_method")}</TableHead>
                  <TableHead>{t("hr.reference_no")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentReportData.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("hr.no_payments")}</TableCell></TableRow>
                ) : paymentReportData.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.employee_name}</TableCell>
                    <TableCell className="font-bold text-green-600">{fmt(p.amount)} {t("common.omr")}</TableCell>
                    <TableCell>{fmtDate(p.payment_date)}</TableCell>
                    <TableCell>{p.payment_method === "cash" ? t("hr.pay_cash") : t("hr.pay_bank")}</TableCell>
                    <TableCell>{p.reference_no || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Report: Remaining Salaries */}
        {reportType === "remaining_salaries" && (
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("common.employee")}</TableHead>
                  <TableHead>{t("common.branch")}</TableHead>
                  <TableHead>{t("hr.filter_month")}</TableHead>
                  <TableHead>{t("hr.net_salary")}</TableHead>
                  <TableHead>{t("hr.total_paid")}</TableHead>
                  <TableHead>{t("hr.remaining_to_pay")}</TableHead>
                  <TableHead>{t("hr.payment_status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstandingData.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("hr.no_outstanding_salaries")}</TableCell></TableRow>
                ) : outstandingData.map((d: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{d.employee_name}</TableCell>
                    <TableCell>{d.branch_name || "-"}</TableCell>
                    <TableCell>{MONTH_NAMES[parseInt(d.month) - 1]} {d.year}</TableCell>
                    <TableCell className="font-bold">{fmt(d.net_salary)}</TableCell>
                    <TableCell className="text-green-600">{fmt(d.total_paid)}</TableCell>
                    <TableCell className="text-red-600 font-bold">{fmt(d.remaining)}</TableCell>
                    <TableCell>{paymentStatusBadge(d.paymentStatus, t)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Report: Employee Account Statement */}
        {reportType === "employee_account" && (
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            {!stmtEmpId ? (
              <div className="p-8 text-center text-muted-foreground">{t("hr.select_employee_prompt")}</div>
            ) : !stmtData ? (
              <div className="p-8 text-center text-muted-foreground">{t("hr.no_salary_data")}</div>
            ) : (
              <>
                {stmtData.summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-blue-600">{t("hr.total_earned")}</p>
                      <p className="text-sm font-bold text-blue-700">{parseFloat(stmtData.summary.totalEarned || "0").toFixed(3)}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-red-600">{t("hr.total_deducted")}</p>
                      <p className="text-sm font-bold text-red-700">{parseFloat(stmtData.summary.totalDeducted || "0").toFixed(3)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-green-600">{t("hr.total_paid")}</p>
                      <p className="text-sm font-bold text-green-700">{parseFloat(stmtData.summary.totalPaid || "0").toFixed(3)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <p className="text-[10px] text-orange-600">{t("hr.remaining_to_pay")}</p>
                      <p className="text-sm font-bold text-orange-700">{parseFloat(stmtData.summary.totalRemaining || "0").toFixed(3)}</p>
                    </div>
                  </div>
                )}
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
                    {(stmtData.entries || []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("hr.no_ledger_entries")}</TableCell></TableRow>
                    ) : (stmtData.entries || []).map((e: any) => {
                      const typeMap: Record<string, string> = {
                        payroll_generated: t("hr.ledger_payroll_generated"),
                        payroll_payment: t("hr.ledger_payroll_payment"),
                        advance_given: t("hr.ledger_advance_given"),
                        advance_repayment_from_payroll: t("hr.ledger_advance_repayment_from_payroll"),
                        deduction_applied: t("hr.ledger_deduction_applied"),
                        commission: t("hr.ledger_commission"),
                        bonus: t("hr.ledger_bonus"),
                        manual_adjustment: t("hr.ledger_manual_adjustment"),
                      };
                      return (
                        <TableRow key={e.id}>
                          <TableCell>{fmtDate(e.date)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{typeMap[e.movement_type] || e.movement_type}</Badge></TableCell>
                          <TableCell className={parseFloat(e.amount) >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{fmt(e.amount)}</TableCell>
                          <TableCell>{fmt(e.balance_after)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.note || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== FINANCIAL PROFILE DIALOG ==================== */
function FinancialProfileDialog({ open, onOpenChange, employeeId }: { open: boolean; onOpenChange: (v: boolean) => void; employeeId: number | null }) {
  const { t, lang } = useI18n();
  const MONTH_NAMES = useMonthNames();
  const [subTab, setSubTab] = useState("summary");

  const { data: profile } = useQuery<any>({
    queryKey: [`/api/employees/${employeeId}/financial-profile`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open,
  });

  const { data: advances = [] } = useQuery<any[]>({
    queryKey: [`/api/employee-advances?employeeId=${employeeId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open && subTab === "advances",
  });

  const { data: deductions = [] } = useQuery<any[]>({
    queryKey: [`/api/employee-deductions?employeeId=${employeeId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open && subTab === "deductions",
  });

  const { data: ledger = [] } = useQuery<any[]>({
    queryKey: [`/api/employees/${employeeId}/ledger`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open && subTab === "statement",
  });

  if (!employeeId) return null;

  const empName = profile?.employee?.name || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            {t("hr.financial_profile")} - {empName}
          </DialogTitle>
          <DialogDescription>{t("hr.fin_summary_title")}</DialogDescription>
        </DialogHeader>

        <Tabs value={subTab} onValueChange={setSubTab} dir={lang === "ar" ? "rtl" : "ltr"}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary" className="text-xs">{t("hr.fin_tab_summary")}</TabsTrigger>
            <TabsTrigger value="advances" className="text-xs">{t("hr.fin_tab_advances")}</TabsTrigger>
            <TabsTrigger value="deductions" className="text-xs">{t("hr.fin_tab_deductions")}</TabsTrigger>
            <TabsTrigger value="statement" className="text-xs">{t("hr.fin_tab_statement")}</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            {profile ? (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-indigo-50 rounded-lg p-3">
                  <p className="text-[10px] text-indigo-600">{t("hr.fin_basic_salary")}</p>
                  <p className="text-sm font-bold text-indigo-700">{fmt(profile.employee?.salary)} {t("common.omr")}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-[10px] text-red-600">{t("hr.fin_open_advances")}</p>
                  <p className="text-sm font-bold text-red-700">{fmt(profile.advances?.totalUnsettled)} {t("common.omr")}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-[10px] text-orange-600">{t("hr.fin_total_deductions")}</p>
                  <p className="text-sm font-bold text-orange-700">{fmt(profile.deductions?.totalPending)} {t("common.omr")}</p>
                </div>
                <div className="bg-primary/5 rounded-lg p-3">
                  <p className="text-[10px] text-primary">{t("hr.fin_last_net_salary")}</p>
                  <p className="text-sm font-bold text-primary">{fmt(profile.lastPayroll?.netSalary)} {t("common.omr")}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-[10px] text-green-600">{t("hr.fin_total_paid")}</p>
                  <p className="text-sm font-bold text-green-700">{fmt(profile.lastPayroll?.totalPaid)} {t("common.omr")}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-[10px] text-red-600">{t("hr.fin_remaining")}</p>
                  <p className="text-sm font-bold text-red-700">{fmt(profile.lastPayroll?.remaining)} {t("common.omr")}</p>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">{t("hr.no_salary_data")}</div>
            )}
          </TabsContent>

          <TabsContent value="advances">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("common.amount")}</TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">{t("hr.no_advance_data")}</TableCell></TableRow>
                ) : advances.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-bold text-red-600">{fmt(a.amount)} {t("common.omr")}</TableCell>
                    <TableCell>{fmtDate(a.date)}</TableCell>
                    <TableCell>{a.settled ? <Badge className="bg-green-100 text-green-700 text-xs">{t("hr.settled")}</Badge> : <Badge variant="outline" className="text-red-500 text-xs">{t("hr.unsettled")}</Badge>}</TableCell>
                    <TableCell className="text-sm">{a.note || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="deductions">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("common.amount")}</TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("hr.reason")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductions.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">{t("hr.no_deduction_data")}</TableCell></TableRow>
                ) : deductions.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-bold text-orange-600">{fmt(d.amount)} {t("common.omr")}</TableCell>
                    <TableCell>{fmtDate(d.date)}</TableCell>
                    <TableCell className="text-sm">{d.reason}</TableCell>
                    <TableCell>{d.applied_in_payroll_id ? <Badge className="bg-green-100 text-green-700 text-xs">{t("hr.applied")}</Badge> : <Badge variant="outline" className="text-xs">{t("hr.not_applied")}</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="statement">
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
                {ledger.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("hr.no_ledger_entries")}</TableCell></TableRow>
                ) : ledger.map((e: any) => {
                  const typeMap: Record<string, string> = {
                    payroll_generated: t("hr.ledger_payroll_generated"),
                    payroll_payment: t("hr.ledger_payroll_payment"),
                    advance_given: t("hr.ledger_advance_given"),
                    advance_repayment_from_payroll: t("hr.ledger_advance_repayment_from_payroll"),
                    deduction_applied: t("hr.ledger_deduction_applied"),
                    commission: t("hr.ledger_commission"),
                    bonus: t("hr.ledger_bonus"),
                    manual_adjustment: t("hr.ledger_manual_adjustment"),
                  };
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{fmtDate(e.date)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{typeMap[e.movement_type] || e.movement_type}</Badge></TableCell>
                      <TableCell className={parseFloat(e.amount) >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{fmt(e.amount)}</TableCell>
                      <TableCell>{fmt(e.balance_after)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.note || "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
