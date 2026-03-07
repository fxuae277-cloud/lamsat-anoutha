import { useState, useRef } from "react";
import { Plus, Users, Building2, Phone, KeyRound, Wallet, Search, TrendingUp, ShoppingBag, Receipt, Clock, Edit, Eye, Shield, Hash, UserCheck, BarChart3, Calendar, FileText, Banknote, MinusCircle, CreditCard, CheckCircle2, RefreshCw, Percent, Printer, Download, FileSpreadsheet, DollarSign, CircleDollarSign, AlertCircle, User } from "lucide-react";
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
import type { Branch } from "@shared/schema";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
function fmt(v: string | number | null | undefined) {
  return parseFloat(String(v || "0")).toFixed(3);
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

  const MONTH_NAMES = [
    t("month_names.jan"), t("month_names.feb"), t("month_names.mar"), t("month_names.apr"), t("month_names.may"), t("month_names.jun"),
    t("month_names.jul"), t("month_names.aug"), t("month_names.sep"), t("month_names.oct"), t("month_names.nov"), t("month_names.dec"),
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
    return u.name.includes(search) || u.username.includes(search) || (u.phone || "").includes(search) || (u.pin || "").includes(search);
  });

  const activeCount = usersList.filter(u => u.isActive).length;
  const totalSalary = usersList.reduce((s, u) => s + parseFloat(u.salary || "0"), 0);

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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-hr-title">{t("hr.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("hr.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("hr.total_employees")}</p>
              <p className="text-xl font-bold" data-testid="text-total-employees">{usersList.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("hr.active_employees")}</p>
              <p className="text-xl font-bold text-green-600">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("hr.have_pin")}</p>
              <p className="text-xl font-bold text-blue-600">{usersList.filter(u => u.pin).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("hr.total_salary_budget")}</p>
              <p className="text-lg font-bold text-amber-600">{totalSalary.toFixed(3)} <span className="text-xs font-normal">{t("common.omr")}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" dir={lang === "ar" ? "rtl" : "ltr"}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 max-w-4xl">
          <TabsTrigger value="employees" className="gap-1 text-xs">
            <Users className="w-4 h-4" />
            {t("hr.tab_employees")}
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-1 text-xs">
            <FileText className="w-4 h-4" />
            {t("hr.tab_payroll")}
          </TabsTrigger>
          <TabsTrigger value="advances" className="gap-1 text-xs">
            <Banknote className="w-4 h-4" />
            {t("hr.tab_advances")}
          </TabsTrigger>
          <TabsTrigger value="deductions" className="gap-1 text-xs">
            <MinusCircle className="w-4 h-4" />
            {t("hr.tab_deductions")}
          </TabsTrigger>
          <TabsTrigger value="outstanding" className="gap-1 text-xs">
            <AlertCircle className="w-4 h-4" />
            {t("hr.tab_outstanding")}
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1 text-xs">
            <BarChart3 className="w-4 h-4" />
            {t("hr.tab_performance")}
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

        <TabsContent value="payroll">
          <PayrollTab usersList={usersList} />
        </TabsContent>

        <TabsContent value="advances">
          <AdvancesTab usersList={usersList} />
        </TabsContent>

        <TabsContent value="deductions">
          <DeductionsTab usersList={usersList} />
        </TabsContent>

        <TabsContent value="outstanding">
          <OutstandingTab usersList={usersList} />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceTab
            usersList={usersList}
            branchMap={branchMap}
            branchesList={branchesList}
          />
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
            <div className="grid grid-cols-3 gap-4">
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[550px]">
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
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    {t("hr.pin") || "PIN"}
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
                <Button
                  variant={selectedUser.isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedUser({...selectedUser, isActive: true})}
                  className={selectedUser.isActive ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {t("status_labels.active")}
                </Button>
                <Button
                  variant={!selectedUser.isActive ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setSelectedUser({...selectedUser, isActive: false})}
                >
                  {t("status_labels.inactive")}
                </Button>
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
              <div className="space-y-4">
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

function FinancialProfileDialog({ open, onOpenChange, employeeId }: { open: boolean; onOpenChange: (v: boolean) => void; employeeId: number | null }) {
  const { t, lang } = useI18n();
  const MONTH_NAMES = [
    t("month_names.jan"), t("month_names.feb"), t("month_names.mar"), t("month_names.apr"), t("month_names.may"), t("month_names.jun"),
    t("month_names.jul"), t("month_names.aug"), t("month_names.sep"), t("month_names.oct"), t("month_names.nov"), t("month_names.dec"),
  ];

  const { data: profile } = useQuery<any>({
    queryKey: [employeeId ? `/api/employees/${employeeId}/financial-profile` : null],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!employeeId && open,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-amber-600" />
            {t("hr.financial_profile")} - {emp.name}
          </DialogTitle>
          <DialogDescription>{emp.branch_name || ""} - {emp.role}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-blue-600">{t("hr.basic_salary")}</p>
              <p className="text-sm font-bold text-blue-700">{fmt(emp.salary)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-red-600">{t("hr.total_advances_amount")}</p>
              <p className="text-sm font-bold text-red-700">{adv.total.toFixed(3)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-green-600">{t("hr.advances_repaid")}</p>
              <p className="text-sm font-bold text-green-700">{adv.repaid.toFixed(3)}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-orange-600">{t("hr.advances_remaining")}</p>
              <p className="text-sm font-bold text-orange-700">{adv.remaining.toFixed(3)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-red-600">{t("hr.total_deductions")}</p>
              <p className="text-sm font-bold text-red-700">{ded.total.toFixed(3)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-gray-600">{t("hr.last_payment_date")}</p>
              <p className="text-sm font-bold text-gray-700">{profile.lastPaymentDate ? new Date(profile.lastPaymentDate + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar-OM" : "en-US") : "—"}</p>
            </div>
          </div>

          {adv.openAdvances.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-2">{t("hr.open_advances")}</h4>
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
                      <TableCell className="text-sm">{a.date ? new Date(a.date + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar-OM" : "en-US") : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.note || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {lp && (
            <div>
              <h4 className="text-sm font-bold mb-2">{t("hr.last_payroll_slip")}</h4>
              <div className="bg-primary/5 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">{t("hr.table_month")}:</span> <span className="font-medium">{MONTH_NAMES[parseInt(lp.month) - 1]} {lp.year}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.basic_salary")}:</span> <span className="font-medium">{fmt(lp.basicSalary)}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.table_commissions")}:</span> <span className="font-medium text-blue-600">{fmt(lp.commission)}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.table_deductions")}:</span> <span className="font-medium text-red-600">{fmt(lp.deductions)}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.table_advances")}:</span> <span className="font-medium text-red-600">{fmt(lp.advances)}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.net_salary")}:</span> <span className="font-bold text-primary">{fmt(lp.netSalary)}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.total_paid")}:</span> <span className="font-medium text-green-600">{fmt(lp.totalPaid)}</span></div>
                  <div><span className="text-muted-foreground">{t("hr.remaining_amount")}:</span> <span className="font-bold text-red-600">{fmt(lp.remaining)}</span></div>
                </div>
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-2">{t("hr.payroll_history")}</h4>
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t("hr.table_month")}</TableHead>
                    <TableHead>{t("hr.net_salary")}</TableHead>
                    <TableHead>{t("hr.total_paid")}</TableHead>
                    <TableHead>{t("hr.remaining_amount")}</TableHead>
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
                      <TableCell>
                        {h.paymentStatus === "paid" ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">{t("hr.payment_status_paid")}</Badge>
                        ) : h.paymentStatus === "partial" ? (
                          <Badge className="bg-orange-100 text-orange-700 text-xs">{t("hr.payment_status_partial")}</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">{t("hr.payment_status_unpaid")}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmployeesTab({ usersList, branchMap, branchesList, search, setSearch, onAdd, onEdit, onPerf, onFinProfile }: any) {
  const { t } = useI18n();
  return (
    <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
      <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
        <div className="relative w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t("hr.search_placeholder")} className="pr-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-hr" />
        </div>
        <Button className="gap-2 mr-auto" onClick={onAdd} data-testid="button-add-employee">
          <Plus className="w-4 h-4" />
          {t("hr.add_employee")}
        </Button>
      </div>

      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>{t("hr.table_name")}</TableHead>
            <TableHead>{t("settings.role_header")}</TableHead>
            <TableHead>{t("common.branch")}</TableHead>
            <TableHead>{t("hr.salary_type")}</TableHead>
            <TableHead>{t("hr.base_salary")}</TableHead>
            <TableHead>{t("hr.commission_rate_header")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
            <TableHead className="w-[100px]">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usersList.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("hr.no_employees")}</TableCell></TableRow>
          ) : usersList.map((u: any) => (
            <TableRow key={u.id} data-testid={`row-employee-${u.id}`}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {u.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.username}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={u.role === "owner" ? "default" : u.role === "admin" ? "secondary" : "outline"} className="text-xs">
                  {u.role === "owner" ? t("hr.role_labels.owner") : u.role === "admin" ? t("hr.role_labels.admin") : u.role === "manager" ? t("hr.role_labels.manager") : u.role === "cashier" ? t("hr.role_labels.cashier") : t("hr.role_labels.employee")}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{branchMap[u.branchId] || "-"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {u.salaryType === "monthly" ? t("hr.monthly") : u.salaryType === "daily" ? (t("hr.salary_daily")) : t("hr.salary_commission")}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{parseFloat(u.salary || "0").toFixed(3)}</TableCell>
              <TableCell className="text-sm">
                {u.salaryType === "commission" ? `${parseFloat(u.commissionRate || "0").toFixed(2)}%` : "—"}
              </TableCell>
              <TableCell>
                {u.isActive ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{t("status_labels.active")}</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">{t("status_labels.inactive")}</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(u)} data-testid={`button-edit-${u.id}`}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" onClick={() => onPerf(u)} data-testid={`button-perf-${u.id}`}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  {u.role !== "owner" && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600" onClick={() => onFinProfile(u)} data-testid={`button-fin-${u.id}`} title={t("hr.financial_profile")}>
                      <Wallet className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {usersList.length > 0 && (
        <div className="p-3 border-t bg-muted/30 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{usersList.length} {t("common.employee")}</span>
          <span className="font-bold text-amber-600">
            {t("hr.total_salary_budget")}: {usersList.reduce((s: number, u: any) => s + parseFloat(u.salary || "0"), 0).toFixed(3)} {t("common.omr")}
          </span>
        </div>
      )}
    </div>
  );
}

function PayrollTab({ usersList }: { usersList: any[] }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const slipRef = useRef<HTMLDivElement>(null);
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
  const [payMethod, setPayMethod] = useState("cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  const MONTH_NAMES = [
    t("month_names.jan"), t("month_names.feb"), t("month_names.mar"), t("month_names.apr"), t("month_names.may"), t("month_names.jun"),
    t("month_names.jul"), t("month_names.aug"), t("month_names.sep"), t("month_names.oct"), t("month_names.nov"), t("month_names.dec"),
  ];

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

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/payroll-runs", {
        month: newMonth, year: Number(newYear), note: newNote,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.payroll_generated") });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      setCreateOpen(false);
      setNewNote("");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/payroll-runs/${id}/regenerate`, {});
    },
    onSuccess: () => {
      toast({ title: t("hr.payroll_recalculated") });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      if (selectedRun) {
        queryClient.invalidateQueries({ queryKey: [detailsKey] });
        queryClient.invalidateQueries({ queryKey: [summaryKey] });
      }
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/payroll-runs/${id}/approve`, {});
    },
    onSuccess: () => {
      toast({ title: t("hr.payroll_approved") });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDetail || !selectedRun) return;
      await apiRequest("POST", "/api/salary-payments", {
        payrollId: selectedRun.id,
        payrollDetailId: selectedDetail.id,
        employeeId: selectedDetail.employee_id,
        amount: payAmount,
        paymentDate: payDate,
        paymentMethod: payMethod,
        branchId: selectedDetail.branch_id,
        note: payNote,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.payment_recorded") });
      queryClient.invalidateQueries({ queryKey: [detailsKey] });
      queryClient.invalidateQueries({ queryKey: [summaryKey] });
      setPayOpen(false);
      setPayAmount(""); setPayNote("");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
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
      .summary{display:flex;flex-wrap:wrap;gap:15px;margin:15px 0;font-size:13px}
      .summary div{flex:1;min-width:120px;padding:8px;background:#f8f8f8;border-radius:5px;text-align:center}
      .footer{margin-top:20px;font-size:11px;color:#888;text-align:center}
      .paid{color:green}.unpaid{color:red}.partial{color:orange}
      @media print{body{padding:15px}}
    </style></head><body>${printRef.current.innerHTML}<div class="footer">${t("hr.print_date")}: ${new Date().toLocaleDateString(lang === 'ar' ? 'ar-OM' : 'en-US')}</div></body></html>`);
    win.document.close();
    win.print();
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
      .header h1{font-size:18px;margin:5px 0}
      .header h2{font-size:14px;color:#666;margin:5px 0}
      .net{font-size:16px;font-weight:bold;color:#2563eb;text-align:center;margin:15px 0;padding:10px;background:#eff6ff;border-radius:8px}
      .footer{margin-top:20px;font-size:11px;color:#888;text-align:center}
      .status{padding:4px 12px;border-radius:12px;font-size:12px;display:inline-block}
      .paid{background:#dcfce7;color:#16a34a}.unpaid{background:#fee2e2;color:#dc2626}.partial{background:#fef3c7;color:#d97706}
    </style></head><body>${slipRef.current.innerHTML}<div class="footer">${t("hr.print_date")}: ${new Date().toLocaleDateString(lang === 'ar' ? 'ar-OM' : 'en-US')}</div></body></html>`);
    win.document.close();
    win.print();
  };

  const handleExportExcel = () => {
    if (!details.length || !selectedRun) return;
    const monthName = MONTH_NAMES[parseInt(selectedRun.month) - 1];
    let csv = "\uFEFF";
    csv += [t("hr.table_employee"), t("common.branch"), t("hr.table_base_salary"), t("hr.table_commissions"), t("hr.gross_salary"), t("hr.table_deductions"), t("hr.table_advances"), t("hr.net_salary"), t("hr.payment_status"), t("hr.total_paid"), t("hr.remaining_amount")].join(",") + "\n";
    details.forEach((d: any) => {
      const gross = (parseFloat(d.basic_salary || "0") + parseFloat(d.commission || "0")).toFixed(3);
      csv += [d.employee_name, d.branch_name || "-", fmt(d.basic_salary), fmt(d.commission), gross, fmt(d.deductions), fmt(d.advances), fmt(d.net_salary), d.payment_status === "paid" ? t("hr.payment_status_paid") : d.payment_status === "partial" ? t("hr.payment_status_partial") : t("hr.payment_status_unpaid"), fmt(d.total_paid), fmt(d.remaining)].join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payroll_${monthName}_${selectedRun.year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getPayrollRunStatus = (run: any) => {
    if (run.status === "draft") return "draft";
    return "approved";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold">{t("hr.payroll_title")}</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-payroll">
              <Plus className="w-4 h-4" />
              {t("hr.generate_payroll")}
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
                      {MONTH_NAMES.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("hr.select_year")}</label>
                  <Input type="number" value={newYear} onChange={e => setNewYear(e.target.value)} data-testid="input-payroll-year" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("common.notes")}</label>
                <Input placeholder={t("hr.notes_placeholder")} value={newNote} onChange={e => setNewNote(e.target.value)} data-testid="input-payroll-note" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-save-payroll">
                {createMutation.isPending ? t("hr.generating") : t("hr.generate_btn")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
              <TableHead>{t("hr.created_by")}</TableHead>
              <TableHead className="w-[150px]">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollRuns.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t("hr.no_payroll")}</TableCell></TableRow>
            ) : payrollRuns.map((run: any) => (
              <TableRow key={run.id} data-testid={`row-payroll-${run.id}`}>
                <TableCell className="font-medium">
                  {MONTH_NAMES[parseInt(run.month) - 1]} {run.year}
                </TableCell>
                <TableCell>
                  {run.status === "draft" ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{t("hr.payroll_status_draft")}</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 border-green-200">{t("hr.payroll_status_approved")}</Badge>
                  )}
                </TableCell>
                <TableCell>{fmt(run.total_basic)}</TableCell>
                <TableCell>{fmt(run.total_commission)}</TableCell>
                <TableCell className="text-red-600">{fmt(run.total_deductions)}</TableCell>
                <TableCell className="text-red-600">{fmt(run.total_advances)}</TableCell>
                <TableCell className="font-bold text-primary">{fmt(run.total_net)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{run.creator_name || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedRun(run); setDetailsOpen(true); }} data-testid={`button-details-${run.id}`} title={t("hr.payroll_details")}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {run.status === "draft" && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => regenerateMutation.mutate(run.id)} disabled={regenerateMutation.isPending} data-testid={`button-regen-${run.id}`}>
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={() => approveMutation.mutate(run.id)} disabled={approveMutation.isPending} data-testid={`button-approve-${run.id}`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[1100px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t("hr.payroll_details")} - {selectedRun && `${MONTH_NAMES[parseInt(selectedRun.month) - 1]} ${selectedRun.year}`}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              {selectedRun?.status === "draft" ? (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{t("hr.payroll_status_draft")}</Badge>
              ) : (
                <Badge className="bg-green-100 text-green-700 border-green-200">{t("hr.payroll_status_approved")}</Badge>
              )}
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
                <p className="text-[10px] text-red-600">{t("hr.total_remaining")}</p>
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
              <Printer className="w-3.5 h-3.5" />
              {t("hr.print")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleSlipPrint} data-testid="button-export-pdf">
              <Download className="w-3.5 h-3.5" />
              {t("hr.export_pdf")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={handleExportExcel} data-testid="button-export-excel">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {t("hr.export_excel")}
            </Button>
          </div>

          <div ref={printRef}>
            <div className="header hidden print:block" style={{ textAlign: "center", marginBottom: 15 }}>
              <h1 style={{ fontSize: 18, margin: "5px 0" }}>{t("hr.company_name")}</h1>
              <h2 style={{ fontSize: 14, color: "#666", margin: "5px 0" }}>
                {t("hr.payroll_sheet")} - {selectedRun && `${MONTH_NAMES[parseInt(selectedRun.month) - 1]} ${selectedRun.year}`}
              </h2>
            </div>
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
                  <TableHead className="w-[120px]">{t("hr.actions_col")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-6 text-muted-foreground">{t("common.no_details")}</TableCell></TableRow>
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
                      <TableCell>
                        {d.payment_status === "paid" ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{t("hr.payment_status_paid")}</Badge>
                        ) : d.payment_status === "partial" ? (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">{t("hr.payment_status_partial")}</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">{t("hr.payment_status_unpaid")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{fmt(d.total_paid)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {selectedRun?.status === "approved" && d.payment_status !== "paid" && parseFloat(d.net_salary || "0") > 0 && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={() => { setSelectedDetail(d); setPayAmount(d.remaining); setPayOpen(true); }} data-testid={`button-pay-${d.id}`} title={t("hr.record_payment")}>
                              <DollarSign className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedDetail(d); setSlipOpen(true); }} data-testid={`button-slip-${d.id}`} title={t("hr.salary_slip")}>
                            <Receipt className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" onClick={() => { setSelectedDetail(d); setHistoryOpen(true); }} data-testid={`button-history-${d.id}`} title={t("hr.view_payments")}>
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

          {details.length > 0 && summary && (
            <div className="p-3 bg-muted/30 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div><span className="text-muted-foreground">{t("hr.total_employees")}:</span> <span className="font-bold">{summary.employeeCount}</span></div>
              <div><span className="text-muted-foreground">{t("hr.total_basic_salary")}:</span> <span className="font-bold">{fmt(summary.totalBasic)}</span></div>
              <div><span className="text-muted-foreground">{t("hr.total_net")}:</span> <span className="font-bold text-primary">{fmt(summary.totalNet)}</span></div>
              <div><span className="text-muted-foreground">{t("hr.total_paid")}:</span> <span className="font-bold text-green-600">{fmt(summary.totalPaid)}</span></div>
              <div><span className="text-muted-foreground">{t("hr.total_remaining")}:</span> <span className="font-bold text-red-600">{fmt(summary.totalRemaining)}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                <label className="text-sm font-medium">{t("hr.payment_amount")} *</label>
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
                  <SelectItem value="cash">{t("hr.pay_cash")}</SelectItem>
                  <SelectItem value="bank_transfer">{t("hr.pay_bank")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <Input placeholder={t("hr.notes_placeholder")} value={payNote} onChange={e => setPayNote(e.target.value)} data-testid="input-pay-note" />
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between"><span>{t("hr.net_salary")}</span><span className="font-bold">{fmt(selectedDetail?.net_salary)}</span></div>
              <div className="flex justify-between"><span>{t("hr.total_paid")}</span><span className="font-bold text-green-600">{fmt(selectedDetail?.total_paid)}</span></div>
              <div className="flex justify-between border-t mt-1 pt-1"><span>{t("hr.remaining_amount")}</span><span className="font-bold text-red-600">{fmt(selectedDetail?.remaining)}</span></div>
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
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.table_advances")}</TableCell><TableCell className="text-red-600">-{fmt(selectedDetail.advances)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow className="bg-primary/5"><TableCell className="font-bold">{t("hr.net_salary")}</TableCell><TableCell className="font-bold text-primary text-lg">{fmt(selectedDetail.net_salary)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.payment_status")}</TableCell><TableCell>
                    {selectedDetail.payment_status === "paid" ? (
                      <Badge className="bg-green-100 text-green-700">{t("hr.payment_status_paid")}</Badge>
                    ) : selectedDetail.payment_status === "partial" ? (
                      <Badge className="bg-orange-100 text-orange-700">{t("hr.payment_status_partial")}</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700">{t("hr.payment_status_unpaid")}</Badge>
                    )}
                  </TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.total_paid")}</TableCell><TableCell className="text-green-600 font-medium">{fmt(selectedDetail.total_paid)} {t("common.omr")}</TableCell></TableRow>
                  <TableRow><TableCell className="font-medium bg-muted/50">{t("hr.remaining_amount")}</TableCell><TableCell className="text-red-600 font-medium">{fmt(selectedDetail.remaining)} {t("common.omr")}</TableCell></TableRow>
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="gap-1" onClick={handleSlipPrint} data-testid="button-print-slip">
              <Printer className="w-3.5 h-3.5" />
              {t("hr.print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[70vh] overflow-y-auto">
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
                <TableHead>{t("hr.created_by")}</TableHead>
                <TableHead>{t("common.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("hr.no_payments")}</TableCell></TableRow>
              ) : paymentHistory.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-green-600">{fmt(p.amount)} {t("common.omr")}</TableCell>
                  <TableCell className="text-sm">{p.payment_date ? new Date(p.payment_date + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar-OM" : "en-US") : "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{p.payment_method === "cash" ? t("hr.pay_cash") : t("hr.pay_bank")}</Badge></TableCell>
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

function AdvancesTab({ usersList }: { usersList: any[] }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [empId, setEmpId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [filterEmp, setFilterEmp] = useState("__all__");
  const [filterStatus, setFilterStatus] = useState("__all__");

  const url = filterEmp && filterEmp !== "__all__" ? `/api/employee-advances?employeeId=${filterEmp}` : "/api/employee-advances";
  const { data: advances = [] } = useQuery<any[]>({
    queryKey: [url],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/employee-advances", {
        employeeId: Number(empId), amount, date, note,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.advance_recorded") });
      queryClient.invalidateQueries({ queryKey: [url] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-advances"] });
      setAddOpen(false);
      setEmpId(""); setAmount(""); setNote("");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const totalAmount = advances.reduce((s: number, a: any) => s + parseFloat(a.amount || "0"), 0);
  const totalRepaid = advances.reduce((s: number, a: any) => s + parseFloat(a.total_repaid || "0"), 0);
  const totalRemaining = advances.reduce((s: number, a: any) => s + parseFloat(a.remaining_amount || "0"), 0);
  const openCount = advances.filter((a: any) => parseFloat(a.remaining_amount || "0") > 0).length;
  const settledCount = advances.filter((a: any) => a.settled).length;
  const partialCount = advances.filter((a: any) => !a.settled && parseFloat(a.total_repaid || "0") > 0).length;

  const filtered = advances.filter((a: any) => {
    if (filterStatus === "open") return parseFloat(a.remaining_amount || "0") > 0;
    if (filterStatus === "partial") return !a.settled && parseFloat(a.total_repaid || "0") > 0;
    if (filterStatus === "settled") return a.settled;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-blue-600">{t("hr.total_advances_amount")}</p>
          <p className="text-sm font-bold text-blue-700">{totalAmount.toFixed(3)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-green-600">{t("hr.total_repaid")}</p>
          <p className="text-sm font-bold text-green-700">{totalRepaid.toFixed(3)}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-red-600">{t("hr.total_remaining_advances")}</p>
          <p className="text-sm font-bold text-red-700">{totalRemaining.toFixed(3)}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-orange-600">{t("hr.open_advances")}</p>
          <p className="text-sm font-bold text-orange-700">{openCount}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-yellow-600">{t("hr.partial_repaid")}</p>
          <p className="text-sm font-bold text-yellow-700">{partialCount}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-green-600">{t("hr.fully_settled")}</p>
          <p className="text-sm font-bold text-green-700">{settledCount}</p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold">{t("hr.advances_title")}</h3>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36" data-testid="select-filter-advance-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.all")}</SelectItem>
              <SelectItem value="open">{t("hr.open_advances")}</SelectItem>
              <SelectItem value="partial">{t("hr.partial_repaid")}</SelectItem>
              <SelectItem value="settled">{t("hr.fully_settled")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-48" data-testid="select-filter-advance-emp"><SelectValue placeholder={t("hr.all_employees")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("hr.all_employees")}</SelectItem>
              {usersList.filter(u => u.role !== "owner").map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-advance">
                <Plus className="w-4 h-4" />
                {t("hr.new_advance")}
              </Button>
            </DialogTrigger>
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
                  <label className="text-sm font-medium">{t("common.notes")}</label>
                  <Input placeholder={t("hr.advance_note_placeholder")} value={note} onChange={e => setNote(e.target.value)} data-testid="input-advance-note" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !empId || !amount} data-testid="button-save-advance">
                  {createMutation.isPending ? t("common.saving") : t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>{t("common.employee")}</TableHead>
              <TableHead>{t("hr.advance_amount")}</TableHead>
              <TableHead>{t("hr.total_repaid")}</TableHead>
              <TableHead>{t("hr.remaining_amount")}</TableHead>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("common.notes")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("hr.created_by")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("hr.no_advances")}</TableCell></TableRow>
            ) : filtered.map((a: any) => {
              const remaining = parseFloat(a.remaining_amount || "0");
              const repaid = parseFloat(a.total_repaid || "0");
              const isPartial = !a.settled && repaid > 0;
              return (
                <TableRow key={a.id} data-testid={`row-advance-${a.id}`}>
                  <TableCell className="font-medium">{a.employee_name}</TableCell>
                  <TableCell className="font-bold">{fmt(a.amount)} {t("common.omr")}</TableCell>
                  <TableCell className="text-green-600 font-medium">{fmt(a.total_repaid)} {t("common.omr")}</TableCell>
                  <TableCell className={`font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>{remaining.toFixed(3)} {t("common.omr")}</TableCell>
                  <TableCell className="text-sm">{a.date ? new Date(a.date + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar-OM" : "en-US") : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.note || "—"}</TableCell>
                  <TableCell>
                    {a.settled ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{t("hr.settled")}</Badge>
                    ) : isPartial ? (
                      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">{t("hr.partial_repaid")}</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">{t("hr.unsettled")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.created_by_name || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DeductionsTab({ usersList }: { usersList: any[] }) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [empId, setEmpId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayStr());
  const [deductionType, setDeductionType] = useState("one_time");
  const [monthRef, setMonthRef] = useState("");
  const [filterEmp, setFilterEmp] = useState("__all__");

  const url = filterEmp && filterEmp !== "__all__" ? `/api/employee-deductions?employeeId=${filterEmp}` : "/api/employee-deductions";
  const { data: deductions = [] } = useQuery<any[]>({
    queryKey: [url],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const now = new Date();
  const MONTH_NAMES = [
    t("month_names.jan"), t("month_names.feb"), t("month_names.mar"), t("month_names.apr"), t("month_names.may"), t("month_names.jun"),
    t("month_names.jul"), t("month_names.aug"), t("month_names.sep"), t("month_names.oct"), t("month_names.nov"), t("month_names.dec"),
  ];

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/employee-deductions", {
        employeeId: Number(empId), amount, reason, date,
        deductionType,
        monthReference: deductionType === "one_time" && monthRef ? monthRef : null,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.deduction_recorded") });
      queryClient.invalidateQueries({ queryKey: [url] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-deductions"] });
      setAddOpen(false);
      setEmpId(""); setAmount(""); setReason(""); setDeductionType("one_time"); setMonthRef("");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const totalDeductions = deductions.reduce((s: number, d: any) => s + parseFloat(d.amount || "0"), 0);
  const appliedCount = deductions.filter((d: any) => d.applied_in_payroll_id).length;
  const notAppliedCount = deductions.filter((d: any) => !d.applied_in_payroll_id).length;
  const recurringCount = deductions.filter((d: any) => d.deduction_type === "recurring").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-red-600">{t("hr.total_deductions")}</p>
          <p className="text-sm font-bold text-red-700">{totalDeductions.toFixed(3)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-green-600">{t("hr.applied_deductions")}</p>
          <p className="text-sm font-bold text-green-700">{appliedCount}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-orange-600">{t("hr.pending_deductions")}</p>
          <p className="text-sm font-bold text-orange-700">{notAppliedCount}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-[10px] text-blue-600">{t("hr.recurring_deductions")}</p>
          <p className="text-sm font-bold text-blue-700">{recurringCount}</p>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold">{t("hr.deductions_title")}</h3>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-48" data-testid="select-filter-deduction-emp"><SelectValue placeholder={t("hr.all_employees")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("hr.all_employees")}</SelectItem>
              {usersList.filter(u => u.role !== "owner").map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-deduction">
                <Plus className="w-4 h-4" />
                {t("hr.new_deduction")}
              </Button>
            </DialogTrigger>
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
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !empId || !amount || !reason} data-testid="button-save-deduction">
                  {createMutation.isPending ? t("common.saving") : t("common.save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
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
              <TableHead>{t("hr.created_by")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deductions.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("hr.no_deductions")}</TableCell></TableRow>
            ) : deductions.map((d: any) => (
              <TableRow key={d.id} data-testid={`row-deduction-${d.id}`}>
                <TableCell className="font-medium">{d.employee_name}</TableCell>
                <TableCell className="font-bold text-red-600">{fmt(d.amount)} {t("common.omr")}</TableCell>
                <TableCell className="text-sm">{d.reason}</TableCell>
                <TableCell>
                  {d.deduction_type === "recurring" ? (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">{t("hr.recurring")}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">{t("hr.one_time")}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">{d.month_reference || "—"}</TableCell>
                <TableCell className="text-sm">{d.date ? new Date(d.date + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar-OM" : "en-US") : "—"}</TableCell>
                <TableCell>
                  {d.applied_in_payroll_id ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{t("hr.applied")}</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">{t("hr.not_applied")}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.created_by_name || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function OutstandingTab({ usersList }: { usersList: any[] }) {
  const { t, lang } = useI18n();
  const [activeReport, setActiveReport] = useState<"salaries" | "advances">("salaries");

  const MONTH_NAMES = [
    t("month_names.jan"), t("month_names.feb"), t("month_names.mar"), t("month_names.apr"), t("month_names.may"), t("month_names.jun"),
    t("month_names.jul"), t("month_names.aug"), t("month_names.sep"), t("month_names.oct"), t("month_names.nov"), t("month_names.dec"),
  ];

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
                <TableHead>{t("hr.remaining_amount")}</TableHead>
                <TableHead>{t("hr.payment_status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salaryOutstanding.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("hr.no_outstanding_salaries")}</TableCell></TableRow>
              ) : salaryOutstanding.map((r: any, i: number) => (
                <TableRow key={i} data-testid={`row-outstanding-salary-${i}`}>
                  <TableCell className="font-medium">{r.employee_name}</TableCell>
                  <TableCell className="text-sm">{r.branch_name || "—"}</TableCell>
                  <TableCell className="text-sm">{MONTH_NAMES[parseInt(r.month) - 1]} {r.year}</TableCell>
                  <TableCell className="font-bold">{fmt(r.net_salary)}</TableCell>
                  <TableCell className="text-green-600">{fmt(r.total_paid)}</TableCell>
                  <TableCell className="text-red-600 font-bold">{fmt(r.remaining)}</TableCell>
                  <TableCell>
                    {r.paymentStatus === "partial" ? (
                      <Badge className="bg-orange-100 text-orange-700 text-xs">{t("hr.payment_status_partial")}</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">{t("hr.payment_status_unpaid")}</Badge>
                    )}
                  </TableCell>
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
                <TableRow key={r.id} data-testid={`row-outstanding-advance-${r.id}`}>
                  <TableCell className="font-medium">{r.employee_name}</TableCell>
                  <TableCell className="text-sm">{r.branch_name || "—"}</TableCell>
                  <TableCell className="font-bold">{fmt(r.amount)}</TableCell>
                  <TableCell className="text-green-600">{fmt(r.total_repaid)}</TableCell>
                  <TableCell className="text-red-600 font-bold">{fmt(r.remaining_amount)}</TableCell>
                  <TableCell className="text-sm">{r.date ? new Date(r.date + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar-OM" : "en-US") : "—"}</TableCell>
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

function PerformanceTab({ usersList, branchMap, branchesList }: any) {
  const { t } = useI18n();
  const [selectedBranch, setSelectedBranch] = useState("__all__");
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());

  const { data: empReport = [] } = useQuery<any[]>({
    queryKey: [`/api/reports/profit/employees?from=${from}&to=${to}${selectedBranch && selectedBranch !== "__all__" ? `&branchId=${selectedBranch}` : ""}`],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">{t("reports.from")}</label>
          <Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">{t("reports.to")}</label>
          <Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">{t("common.branch")}</label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-48"><SelectValue placeholder={t("common.all_branches")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("common.all_branches")}</SelectItem>
              {branchesList.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
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
      </div>
    </div>
  );
}
