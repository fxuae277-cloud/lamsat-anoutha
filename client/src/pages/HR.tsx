import { useState } from "react";
import { Plus, Users, Building2, Phone, KeyRound, Wallet, Search, TrendingUp, ShoppingBag, Receipt, Clock, Edit, Eye, Shield, Hash, UserCheck, BarChart3, Calendar, FileText, Banknote, MinusCircle, CreditCard, CheckCircle2, RefreshCw, Percent } from "lucide-react";
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
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
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
    </div>
  );
}

function EmployeesTab({ usersList, branchMap, branchesList, search, setSearch, onAdd, onEdit, onPerf }: any) {
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
  const { t } = useI18n();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const now = new Date();
  const [newMonth, setNewMonth] = useState(String(now.getMonth() + 1));
  const [newYear, setNewYear] = useState(String(now.getFullYear()));
  const [newNote, setNewNote] = useState("");

  const MONTH_NAMES = [
    t("month_names.jan"), t("month_names.feb"), t("month_names.mar"), t("month_names.apr"), t("month_names.may"), t("month_names.jun"),
    t("month_names.jul"), t("month_names.aug"), t("month_names.sep"), t("month_names.oct"), t("month_names.nov"), t("month_names.dec"),
  ];
  const { data: payrollRuns = [] } = useQuery<any[]>({
    queryKey: ["/api/payroll-runs"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: details = [] } = useQuery<any[]>({
    queryKey: [`/api/payroll-runs/${selectedRun?.id}/details`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedRun,
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
      if (selectedRun) queryClient.invalidateQueries({ queryKey: [`/api/payroll-runs/${selectedRun.id}/details`] });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{t("status_labels.draft")}</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 border-green-200">{t("status_labels.approved")}</Badge>
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
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedRun(run); setDetailsOpen(true); }} data-testid={`button-details-${run.id}`}>
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
        <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t("hr.payroll_details")} - {selectedRun && `${MONTH_NAMES[parseInt(selectedRun.month) - 1]} ${selectedRun.year}`}
            </DialogTitle>
            <DialogDescription>
              {selectedRun?.status === "draft" ? (t("status_labels.draft_desc")) : t("status_labels.approved")}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("hr.table_employee")}</TableHead>
                <TableHead>{t("common.branch")}</TableHead>
                <TableHead>{t("hr.table_base_salary")}</TableHead>
                <TableHead>{t("hr.table_commissions")}</TableHead>
                <TableHead>{t("hr.table_deductions")}</TableHead>
                <TableHead>{t("hr.table_advances")}</TableHead>
                <TableHead>{t("hr.table_net")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">{t("common.no_details")}</TableCell></TableRow>
              ) : details.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.employee_name}</TableCell>
                  <TableCell className="text-sm">{d.branch_name || "-"}</TableCell>
                  <TableCell>{fmt(d.basic_salary)}</TableCell>
                  <TableCell className="text-blue-600">{fmt(d.commission)}</TableCell>
                  <TableCell className="text-red-600">{fmt(d.deductions)}</TableCell>
                  <TableCell className="text-red-600">{fmt(d.advances)}</TableCell>
                  <TableCell className="font-bold text-primary">{fmt(d.net_salary)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {details.length > 0 && (
            <div className="p-3 bg-muted/30 rounded-lg flex items-center justify-between text-sm font-bold">
              <span>{details.length} {t("common.employee")}</span>
              <span className="text-primary">
                {t("hr.total_net")}: {details.reduce((s: number, d: any) => s + parseFloat(d.net_salary || "0"), 0).toFixed(3)} {t("common.omr")}
              </span>
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

  const totalUnsettled = advances.filter((a: any) => !a.settled).reduce((s: number, a: any) => s + parseFloat(a.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">{t("hr.advances_title")}</h3>
          <p className="text-sm text-muted-foreground">{t("hr.total_unsettled")}: <span className="font-bold text-red-600">{totalUnsettled.toFixed(3)} {t("common.omr")}</span></p>
        </div>
        <div className="flex gap-2">
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
              <TableHead>{t("common.amount")}</TableHead>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("common.notes")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("hr.created_by")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {advances.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("hr.no_advances")}</TableCell></TableRow>
            ) : advances.map((a: any) => (
              <TableRow key={a.id} data-testid={`row-advance-${a.id}`}>
                <TableCell className="font-medium">{a.employee_name}</TableCell>
                <TableCell className="font-bold">{fmt(a.amount)} {t("common.omr")}</TableCell>
                <TableCell className="text-sm">{a.date ? new Date(a.date + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar-OM" : "en-US") : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.note || "—"}</TableCell>
                <TableCell>
                  {a.settled ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{t("hr.settled")}</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">{t("hr.unsettled")}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.created_by_name || "—"}</TableCell>
              </TableRow>
            ))}
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
  const [filterEmp, setFilterEmp] = useState("__all__");

  const url = filterEmp && filterEmp !== "__all__" ? `/api/employee-deductions?employeeId=${filterEmp}` : "/api/employee-deductions";
  const { data: deductions = [] } = useQuery<any[]>({
    queryKey: [url],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/employee-deductions", {
        employeeId: Number(empId), amount, reason, date,
      });
    },
    onSuccess: () => {
      toast({ title: t("hr.deduction_recorded") });
      queryClient.invalidateQueries({ queryKey: [url] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-deductions"] });
      setAddOpen(false);
      setEmpId(""); setAmount(""); setReason("");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">{t("hr.deductions_title")}</h3>
        <div className="flex gap-2">
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
            <DialogContent className="sm:max-w-[400px]">
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
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("hr.created_by")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deductions.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("hr.no_deductions")}</TableCell></TableRow>
            ) : deductions.map((d: any) => (
              <TableRow key={d.id} data-testid={`row-deduction-${d.id}`}>
                <TableCell className="font-medium">{d.employee_name}</TableCell>
                <TableCell className="font-bold text-red-600">{fmt(d.amount)} {t("common.omr")}</TableCell>
                <TableCell className="text-sm">{d.reason}</TableCell>
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
