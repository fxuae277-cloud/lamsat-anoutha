import { useState } from "react";
import { Plus, Users, UserCheck, Wallet, TrendingUp, ShoppingBag, KeyRound, Shield, BarChart3, AlertCircle, ArrowRightLeft, FileText, CreditCard, FileSpreadsheet, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fmtCurrency } from "@/lib/formatters";
import type { Branch } from "@shared/schema";

import { todayStr, monthAgoStr, fmt } from "./hr/helpers";
import { EmployeesTab } from "./hr/EmployeesTab";
import MonthlyMovementsTab from "./hr/MonthlyMovementsTab";
import PayrollSheetTab from "./hr/PayrollSheetTab";
import SalaryPaymentsTab from "./hr/SalaryPaymentsTab";
import RemainingTab from "./hr/RemainingTab";
import ReportsTab from "./hr/ReportsTab";
import FinancialProfileDialog from "./hr/FinancialProfileDialog";

export default function HR() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { data } = useAuth();
  const user = data?.user;
  const isOwnerAdmin = user?.role === "owner" || user?.role === "admin";

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

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentMonthRun = payrollRuns.find((r: any) => parseInt(r.month) === currentMonth && parseInt(r.year) === currentYear && r.status !== "cancelled");
  const totalSalary = usersList.reduce((s, u) => s + parseFloat(u.salary || "0"), 0);
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
              <p className="text-base font-bold text-blue-600">{fmtCurrency(currentMonthNet)} <span className="text-[10px] font-normal">{t("common.omr")}</span></p>
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
              <p className="text-base font-bold text-red-600">{fmtCurrency(currentMonthRemaining > 0 ? currentMonthRemaining : 0)} <span className="text-[10px] font-normal">{t("common.omr")}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" dir={lang === "ar" ? "rtl" : "ltr"}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 max-w-4xl">
          <TabsTrigger value="employees" className="gap-1 text-xs" data-testid="tab-employees">
            <Users className="w-3.5 h-3.5" />
            {t("hr.tab_employees")}
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-1 text-xs" data-testid="tab-movements">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            {t("hr.tab_financial_movements")}
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-1 text-xs" data-testid="tab-payroll">
            <FileText className="w-3.5 h-3.5" />
            {t("hr.tab_monthly_salaries")}
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1 text-xs" data-testid="tab-payments">
            <CreditCard className="w-3.5 h-3.5" />
            {t("hr.tab_payments")}
          </TabsTrigger>
          <TabsTrigger value="remaining" className="gap-1 text-xs" data-testid="tab-remaining">
            <Banknote className="w-3.5 h-3.5" />
            {t("hr.remaining_to_pay")}
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
          <MonthlyMovementsTab usersList={usersList} branchesList={branchesList} />
        </TabsContent>

        <TabsContent value="payroll">
          <PayrollSheetTab usersList={usersList} />
        </TabsContent>

        <TabsContent value="payments">
          <SalaryPaymentsTab usersList={usersList} />
        </TabsContent>

        <TabsContent value="remaining">
          <RemainingTab usersList={usersList} />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab usersList={usersList} branchesList={branchesList} />
        </TabsContent>
      </Tabs>

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
                    {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
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
                      {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
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
        usersList={usersList}
      />
    </div>
  );
}
