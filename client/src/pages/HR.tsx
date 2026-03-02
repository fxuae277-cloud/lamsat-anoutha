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
import type { Branch } from "@shared/schema";

const ROLE_LABELS: Record<string, string> = {
  owner: "مالك",
  admin: "مدير",
  manager: "مدير فرع",
  cashier: "كاشير",
  employee: "موظف",
};

const ROLE_OPTIONS = [
  { value: "admin", label: "مدير" },
  { value: "manager", label: "مدير فرع" },
  { value: "cashier", label: "كاشير" },
  { value: "employee", label: "موظف" },
];

const SALARY_TYPE_LABELS: Record<string, string> = {
  monthly: "شهري",
  daily: "يومي",
  commission: "نسبة مبيعات",
};

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

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
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwnerAdmin = user?.role === "owner" || user?.role === "admin";

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
      toast({ title: "تم إضافة الموظف بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAddOpen(false);
      setNewUser({ name: "", username: "", password: "", role: "cashier", branchId: "1", terminalName: "T1", pin: "", phone: "", salary: "", salaryType: "monthly", commissionRate: "" });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
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
      toast({ title: "تم تحديث بيانات الموظف" });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
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
        <p className="text-lg font-medium">صلاحية محدودة</p>
        <p className="text-sm mt-1">هذه الصفحة متاحة فقط للمالك والمدير</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-hr-title">الموظفين والرواتب</h1>
          <p className="text-muted-foreground mt-1">إدارة الموظفين، الرواتب، السلف والخصومات</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الموظفين</p>
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
              <p className="text-xs text-muted-foreground">نشط</p>
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
              <p className="text-xs text-muted-foreground">لديهم PIN</p>
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
              <p className="text-xs text-muted-foreground">إجمالي الرواتب</p>
              <p className="text-lg font-bold text-amber-600">{totalSalary.toFixed(3)} <span className="text-xs font-normal">ر.ع</span></p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" dir="rtl">
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
          <TabsTrigger value="employees" className="gap-1 text-xs">
            <Users className="w-4 h-4" />
            الموظفين
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-1 text-xs">
            <FileText className="w-4 h-4" />
            كشوف الرواتب
          </TabsTrigger>
          <TabsTrigger value="advances" className="gap-1 text-xs">
            <Banknote className="w-4 h-4" />
            السلف
          </TabsTrigger>
          <TabsTrigger value="deductions" className="gap-1 text-xs">
            <MinusCircle className="w-4 h-4" />
            الخصومات
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1 text-xs">
            <BarChart3 className="w-4 h-4" />
            الأداء
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
            <DialogTitle>إضافة موظف جديد</DialogTitle>
            <DialogDescription>أدخل بيانات الموظف الأساسية</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">الاسم الكامل *</label>
                <Input placeholder="أحمد محمد" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} data-testid="input-emp-name" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">اسم المستخدم *</label>
                <Input placeholder="ahmed" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} data-testid="input-emp-username" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">كلمة المرور *</label>
                <Input type="password" placeholder="6 أحرف على الأقل" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} data-testid="input-emp-password" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" />
                  رقم PIN
                </label>
                <Input placeholder="1234" maxLength={6} value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value.replace(/\D/g, "")})} data-testid="input-emp-pin" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">الدور</label>
                <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v})}>
                  <SelectTrigger data-testid="select-emp-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">الفرع</label>
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
                <label className="text-sm font-medium">نوع الراتب</label>
                <Select value={newUser.salaryType} onValueChange={v => setNewUser({...newUser, salaryType: v})}>
                  <SelectTrigger data-testid="select-emp-salary-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">شهري</SelectItem>
                    <SelectItem value="daily">يومي</SelectItem>
                    <SelectItem value="commission">نسبة مبيعات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" />
                  الراتب (OMR)
                </label>
                <Input type="number" step="0.001" placeholder="0.000" value={newUser.salary} onChange={e => setNewUser({...newUser, salary: e.target.value})} data-testid="input-emp-salary" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5" />
                  نسبة العمولة %
                </label>
                <Input type="number" step="0.01" placeholder="0.00" value={newUser.commissionRate} onChange={e => setNewUser({...newUser, commissionRate: e.target.value})} data-testid="input-emp-commission" disabled={newUser.salaryType !== "commission"} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">الجهاز</label>
                <Input placeholder="POS-1" value={newUser.terminalName} onChange={e => setNewUser({...newUser, terminalName: e.target.value})} data-testid="input-emp-terminal" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  الهاتف
                </label>
                <Input placeholder="9XXXXXXX" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} data-testid="input-emp-phone" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newUser.name || !newUser.username || !newUser.password} data-testid="button-save-employee">
              {createMutation.isPending ? "جارِ الحفظ..." : "حفظ الموظف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الموظف</DialogTitle>
            <DialogDescription>تعديل البيانات الشخصية والوظيفية</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الاسم</label>
                  <Input value={selectedUser.name} onChange={e => setSelectedUser({...selectedUser, name: e.target.value})} data-testid="input-edit-name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الدور</label>
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
                  <label className="text-sm font-medium">الفرع</label>
                  <Select value={String(selectedUser.branchId)} onValueChange={v => setSelectedUser({...selectedUser, branchId: Number(v)})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الجهاز</label>
                  <Input value={selectedUser.terminalName || ""} onChange={e => setSelectedUser({...selectedUser, terminalName: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">نوع الراتب</label>
                  <Select value={selectedUser.salaryType || "monthly"} onValueChange={v => setSelectedUser({...selectedUser, salaryType: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">شهري</SelectItem>
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="commission">نسبة مبيعات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الراتب (OMR)</label>
                  <Input type="number" step="0.001" value={selectedUser.salary || ""} onChange={e => setSelectedUser({...selectedUser, salary: e.target.value})} data-testid="input-edit-salary" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">نسبة العمولة %</label>
                  <Input type="number" step="0.01" value={selectedUser.commissionRate || ""} onChange={e => setSelectedUser({...selectedUser, commissionRate: e.target.value})} data-testid="input-edit-commission" disabled={selectedUser.salaryType !== "commission"} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    PIN
                  </label>
                  <Input placeholder="1234" maxLength={6} value={selectedUser.pin || ""} onChange={e => setSelectedUser({...selectedUser, pin: e.target.value.replace(/\D/g, "")})} data-testid="input-edit-pin" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الهاتف</label>
                  <Input value={selectedUser.phone || ""} onChange={e => setSelectedUser({...selectedUser, phone: e.target.value})} data-testid="input-edit-phone" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">الحالة:</label>
                <Button
                  variant={selectedUser.isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedUser({...selectedUser, isActive: true})}
                  className={selectedUser.isActive ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  نشط
                </Button>
                <Button
                  variant={!selectedUser.isActive ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setSelectedUser({...selectedUser, isActive: false})}
                >
                  متوقف
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-update-employee">
              {updateMutation.isPending ? "جارِ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={perfOpen} onOpenChange={setPerfOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              تقرير أداء: {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>عرض تفصيلي لأداء الموظف خلال الفترة المحددة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium">من</label>
                <Input type="date" value={perfFrom} onChange={e => setPerfFrom(e.target.value)} />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium">إلى</label>
                <Input type="date" value={perfTo} onChange={e => setPerfTo(e.target.value)} />
              </div>
            </div>
            {perfData?.performance && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <ShoppingBag className="w-5 h-5 text-primary mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
                      <p className="text-lg font-bold text-primary">{fmt(perfData.performance.salesTotal)}</p>
                      <p className="text-xs text-muted-foreground">{perfData.performance.salesCount} عملية</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">الربح الإجمالي</p>
                      <p className="text-lg font-bold text-green-600">{fmt(perfData.performance.grossProfit)}</p>
                      <p className="text-xs text-muted-foreground">هامش {perfData.performance.margin}%</p>
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
  return (
    <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
      <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
        <div className="relative w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الهاتف أو PIN..." className="pr-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-hr" />
        </div>
        <Button className="gap-2 mr-auto" onClick={onAdd} data-testid="button-add-employee">
          <Plus className="w-4 h-4" />
          إضافة موظف
        </Button>
      </div>

      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>الموظف</TableHead>
            <TableHead>الدور</TableHead>
            <TableHead>الفرع</TableHead>
            <TableHead>نوع الراتب</TableHead>
            <TableHead>الراتب (OMR)</TableHead>
            <TableHead>العمولة %</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead className="w-[100px]">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usersList.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا يوجد موظفين</TableCell></TableRow>
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
                  {ROLE_LABELS[u.role] || u.role}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{branchMap[u.branchId] || "-"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {SALARY_TYPE_LABELS[u.salaryType || "monthly"] || "شهري"}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{parseFloat(u.salary || "0").toFixed(3)}</TableCell>
              <TableCell className="text-sm">
                {u.salaryType === "commission" ? `${parseFloat(u.commissionRate || "0").toFixed(2)}%` : "—"}
              </TableCell>
              <TableCell>
                {u.isActive ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">نشط</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">متوقف</Badge>
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
          <span className="text-muted-foreground">{usersList.length} موظف</span>
          <span className="font-bold text-amber-600">
            إجمالي الرواتب: {usersList.reduce((s: number, u: any) => s + parseFloat(u.salary || "0"), 0).toFixed(3)} ر.ع
          </span>
        </div>
      )}
    </div>
  );
}

function PayrollTab({ usersList }: { usersList: any[] }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const now = new Date();
  const [newMonth, setNewMonth] = useState(String(now.getMonth() + 1));
  const [newYear, setNewYear] = useState(String(now.getFullYear()));
  const [newNote, setNewNote] = useState("");

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
      toast({ title: "تم إنشاء كشف الرواتب بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      setCreateOpen(false);
      setNewNote("");
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/payroll-runs/${id}/regenerate`, {});
    },
    onSuccess: () => {
      toast({ title: "تم إعادة احتساب الكشف" });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      if (selectedRun) queryClient.invalidateQueries({ queryKey: [`/api/payroll-runs/${selectedRun.id}/details`] });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/payroll-runs/${id}/approve`, {});
    },
    onSuccess: () => {
      toast({ title: "تم اعتماد كشف الرواتب" });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">كشوف الرواتب</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-payroll">
              <Plus className="w-4 h-4" />
              كشف رواتب جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>إنشاء كشف رواتب</DialogTitle>
              <DialogDescription>اختر الشهر والسنة وسيتم احتساب الرواتب تلقائياً</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الشهر</label>
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
                  <label className="text-sm font-medium">السنة</label>
                  <Input type="number" value={newYear} onChange={e => setNewYear(e.target.value)} data-testid="input-payroll-year" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ملاحظات</label>
                <Input placeholder="ملاحظات اختيارية" value={newNote} onChange={e => setNewNote(e.target.value)} data-testid="input-payroll-note" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-save-payroll">
                {createMutation.isPending ? "جارِ الإنشاء..." : "إنشاء واحتساب"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>الشهر</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>إجمالي الأساسي</TableHead>
              <TableHead>العمولات</TableHead>
              <TableHead>الخصومات</TableHead>
              <TableHead>السلف</TableHead>
              <TableHead>صافي الرواتب</TableHead>
              <TableHead>أُنشئ بواسطة</TableHead>
              <TableHead className="w-[150px]">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollRuns.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد كشوف رواتب بعد</TableCell></TableRow>
            ) : payrollRuns.map((run: any) => (
              <TableRow key={run.id} data-testid={`row-payroll-${run.id}`}>
                <TableCell className="font-medium">
                  {MONTH_NAMES[parseInt(run.month) - 1]} {run.year}
                </TableCell>
                <TableCell>
                  {run.status === "draft" ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">مسودة</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 border-green-200">معتمد</Badge>
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
              تفاصيل كشف الرواتب - {selectedRun && `${MONTH_NAMES[parseInt(selectedRun.month) - 1]} ${selectedRun.year}`}
            </DialogTitle>
            <DialogDescription>
              {selectedRun?.status === "draft" ? "مسودة - لم يُعتمد بعد" : "معتمد"}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>الموظف</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead>الراتب الأساسي</TableHead>
                <TableHead>العمولة</TableHead>
                <TableHead>الخصومات</TableHead>
                <TableHead>السلف</TableHead>
                <TableHead>صافي الراتب</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">لا توجد تفاصيل</TableCell></TableRow>
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
              <span>{details.length} موظف</span>
              <span className="text-primary">
                إجمالي الصافي: {details.reduce((s: number, d: any) => s + parseFloat(d.net_salary || "0"), 0).toFixed(3)} ر.ع
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdvancesTab({ usersList }: { usersList: any[] }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [empId, setEmpId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [filterEmp, setFilterEmp] = useState("");

  const url = filterEmp ? `/api/employee-advances?employeeId=${filterEmp}` : "/api/employee-advances";
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
      toast({ title: "تم تسجيل السلفة بنجاح" });
      queryClient.invalidateQueries({ queryKey: [url] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-advances"] });
      setAddOpen(false);
      setEmpId(""); setAmount(""); setNote("");
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const totalUnsettled = advances.filter((a: any) => !a.settled).reduce((s: number, a: any) => s + parseFloat(a.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">سلف الموظفين</h3>
          <p className="text-sm text-muted-foreground">إجمالي السلف غير المسددة: <span className="font-bold text-red-600">{totalUnsettled.toFixed(3)} ر.ع</span></p>
        </div>
        <div className="flex gap-2">
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-48" data-testid="select-filter-advance-emp"><SelectValue placeholder="كل الموظفين" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">كل الموظفين</SelectItem>
              {usersList.filter(u => u.role !== "owner").map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-advance">
                <Plus className="w-4 h-4" />
                سلفة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>تسجيل سلفة</DialogTitle>
                <DialogDescription>تسجيل سلفة جديدة لموظف</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الموظف *</label>
                  <Select value={empId} onValueChange={setEmpId}>
                    <SelectTrigger data-testid="select-advance-emp"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                    <SelectContent>
                      {usersList.filter(u => u.role !== "owner").map(u => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">المبلغ (OMR) *</label>
                    <Input type="number" step="0.001" placeholder="0.000" value={amount} onChange={e => setAmount(e.target.value)} data-testid="input-advance-amount" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">التاريخ *</label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-advance-date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">ملاحظات</label>
                  <Input placeholder="سبب السلفة" value={note} onChange={e => setNote(e.target.value)} data-testid="input-advance-note" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !empId || !amount} data-testid="button-save-advance">
                  {createMutation.isPending ? "جارِ الحفظ..." : "حفظ السلفة"}
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
              <TableHead>الموظف</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الملاحظات</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>أُنشئ بواسطة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {advances.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد سلف مسجلة</TableCell></TableRow>
            ) : advances.map((a: any) => (
              <TableRow key={a.id} data-testid={`row-advance-${a.id}`}>
                <TableCell className="font-medium">{a.employee_name}</TableCell>
                <TableCell className="font-bold">{fmt(a.amount)} ر.ع</TableCell>
                <TableCell className="text-sm">{a.date}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.note || "—"}</TableCell>
                <TableCell>
                  {a.settled ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">مسددة</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">غير مسددة</Badge>
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
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [empId, setEmpId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayStr());
  const [filterEmp, setFilterEmp] = useState("");

  const url = filterEmp ? `/api/employee-deductions?employeeId=${filterEmp}` : "/api/employee-deductions";
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
      toast({ title: "تم تسجيل الخصم بنجاح" });
      queryClient.invalidateQueries({ queryKey: [url] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-deductions"] });
      setAddOpen(false);
      setEmpId(""); setAmount(""); setReason("");
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">خصومات الموظفين</h3>
        <div className="flex gap-2">
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-48" data-testid="select-filter-deduction-emp"><SelectValue placeholder="كل الموظفين" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">كل الموظفين</SelectItem>
              {usersList.filter(u => u.role !== "owner").map(u => (
                <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-deduction">
                <Plus className="w-4 h-4" />
                خصم جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>تسجيل خصم</DialogTitle>
                <DialogDescription>تسجيل خصم جديد على موظف</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الموظف *</label>
                  <Select value={empId} onValueChange={setEmpId}>
                    <SelectTrigger data-testid="select-deduction-emp"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                    <SelectContent>
                      {usersList.filter(u => u.role !== "owner").map(u => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">المبلغ (OMR) *</label>
                    <Input type="number" step="0.001" placeholder="0.000" value={amount} onChange={e => setAmount(e.target.value)} data-testid="input-deduction-amount" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">التاريخ *</label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-deduction-date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">السبب *</label>
                  <Input placeholder="سبب الخصم" value={reason} onChange={e => setReason(e.target.value)} data-testid="input-deduction-reason" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !empId || !amount || !reason} data-testid="button-save-deduction">
                  {createMutation.isPending ? "جارِ الحفظ..." : "حفظ الخصم"}
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
              <TableHead>الموظف</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>السبب</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>أُنشئ بواسطة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deductions.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد خصومات مسجلة</TableCell></TableRow>
            ) : deductions.map((d: any) => (
              <TableRow key={d.id} data-testid={`row-deduction-${d.id}`}>
                <TableCell className="font-medium">{d.employee_name}</TableCell>
                <TableCell className="font-bold text-red-600">{fmt(d.amount)} ر.ع</TableCell>
                <TableCell className="text-sm">{d.reason}</TableCell>
                <TableCell className="text-sm">{d.date}</TableCell>
                <TableCell>
                  {d.applied_in_payroll_id ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">مُطبّق</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">غير مُطبّق</Badge>
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
  const [selectedBranch, setSelectedBranch] = useState("");
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());

  const { data: empReport = [] } = useQuery<any[]>({
    queryKey: [`/api/reports/profit/employees?from=${from}&to=${to}${selectedBranch ? `&branchId=${selectedBranch}` : ""}`],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">من</label>
          <Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">إلى</label>
          <Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">الفرع</label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-48"><SelectValue placeholder="كل الفروع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">كل الفروع</SelectItem>
              {branchesList.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>الموظف</TableHead>
              <TableHead>عدد المبيعات</TableHead>
              <TableHead>إجمالي المبيعات</TableHead>
              <TableHead>التكلفة</TableHead>
              <TableHead>الربح</TableHead>
              <TableHead>الهامش %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empReport.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
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
