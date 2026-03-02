import { useState } from "react";
import { Plus, Users, Building2, Phone, KeyRound, Wallet, Search, TrendingUp, ShoppingBag, Receipt, Clock, Edit, Eye, Shield, Hash, UserCheck, BarChart3, Calendar } from "lucide-react";
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
      });
    },
    onSuccess: () => {
      toast({ title: "تم إضافة الموظف بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAddOpen(false);
      setNewUser({ name: "", username: "", password: "", role: "cashier", branchId: "1", terminalName: "T1", pin: "", phone: "", salary: "" });
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
          <p className="text-muted-foreground mt-1">إدارة الموظفين، PIN، الرواتب، وتقارير الأداء</p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-employee">
              <Plus className="w-4 h-4" />
              إضافة موظف
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>إضافة موظف جديد</DialogTitle>
              <DialogDescription>أدخل بيانات الموظف الأساسية ورقم PIN للتعريف السريع</DialogDescription>
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
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" />
                    الراتب (OMR)
                  </label>
                  <Input type="number" step="0.001" placeholder="0.000" value={newUser.salary} onChange={e => setNewUser({...newUser, salary: e.target.value})} data-testid="input-emp-salary" />
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
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="employees" className="gap-1">
            <Users className="w-4 h-4" />
            قائمة الموظفين
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1">
            <BarChart3 className="w-4 h-4" />
            تقارير الأداء
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
              <div className="relative w-72">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث بالاسم أو الهاتف أو PIN..." className="pr-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-hr" />
              </div>
            </div>

            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>الجهاز</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>الراتب (OMR)</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-[120px]">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا يوجد موظفين</TableCell></TableRow>
                ) : filtered.map((u: any) => (
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
                    <TableCell className="text-sm text-muted-foreground">{u.terminalName}</TableCell>
                    <TableCell>
                      {u.pin ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-xs">
                          <KeyRound className="w-3 h-3" />
                          {u.pin}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                    <TableCell className="font-medium">{parseFloat(u.salary || "0").toFixed(3)}</TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">نشط</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">متوقف</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedUser({...u}); setEditOpen(true); }} data-testid={`button-edit-${u.id}`}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" onClick={() => { setSelectedUser(u); setPerfOpen(true); }} data-testid={`button-perf-${u.id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filtered.length > 0 && (
              <div className="p-3 border-t bg-muted/30 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{filtered.length} موظف</span>
                <span className="font-bold text-amber-600">
                  إجمالي الرواتب: {filtered.reduce((s: number, u: any) => s + parseFloat(u.salary || "0"), 0).toFixed(3)} ر.ع
                </span>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceTab
            usersList={usersList}
            branchMap={branchMap}
            branchesList={branchesList}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">الراتب</label>
                  <Input type="number" step="0.001" value={selectedUser.salary || ""} onChange={e => setSelectedUser({...selectedUser, salary: e.target.value})} data-testid="input-edit-salary" />
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
                  <Card>
                    <CardContent className="p-3 text-center">
                      <Receipt className="w-5 h-5 text-red-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">المصروفات المسجلة</p>
                      <p className="text-lg font-bold text-red-600">{fmt(perfData.performance.expensesTotal)}</p>
                      <p className="text-xs text-muted-foreground">{perfData.performance.expensesCount} مصروف</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">الشفتات</p>
                      <p className="text-lg font-bold text-blue-600">{perfData.performance.shiftsCount}</p>
                      <p className="text-xs text-muted-foreground">
                        فرق: <span className={parseFloat(perfData.performance.shiftsDifference) < 0 ? "text-red-600" : "text-green-600"}>
                          {fmt(perfData.performance.shiftsDifference)}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="border rounded-lg overflow-hidden text-sm">
                  <div className="bg-muted/30 px-4 py-2 font-bold border-b">تفاصيل المبيعات</div>
                  <div className="divide-y">
                    <div className="flex justify-between px-4 py-2">
                      <span className="text-muted-foreground">مبيعات نقطة البيع (POS)</span>
                      <span className="font-medium">{fmt(perfData.performance.posSalesTotal)} ({perfData.performance.posSalesCount})</span>
                    </div>
                    <div className="flex justify-between px-4 py-2">
                      <span className="text-muted-foreground">مبيعات الطلبات</span>
                      <span className="font-medium">{fmt(perfData.performance.ordersSalesTotal)} ({perfData.performance.ordersSalesCount})</span>
                    </div>
                    <div className="flex justify-between px-4 py-2">
                      <span className="text-muted-foreground">تكلفة البضاعة (COGS)</span>
                      <span className="font-medium text-amber-600">{fmt(perfData.performance.cogsTotal)}</span>
                    </div>
                  </div>
                </div>

                {perfData.employee && (
                  <div className="border rounded-lg overflow-hidden text-sm">
                    <div className="bg-muted/30 px-4 py-2 font-bold border-b">بيانات الموظف</div>
                    <div className="divide-y">
                      <div className="flex justify-between px-4 py-2">
                        <span className="text-muted-foreground">الفرع</span>
                        <span>{branchMap[perfData.employee.branchId] || "-"}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2">
                        <span className="text-muted-foreground">الدور</span>
                        <span>{ROLE_LABELS[perfData.employee.role] || perfData.employee.role}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2">
                        <span className="text-muted-foreground">الراتب</span>
                        <span className="font-medium">{fmt(perfData.employee.salary)} ر.ع</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PerformanceTab({ usersList, branchMap, branchesList }: { usersList: any[]; branchMap: Record<number, string>; branchesList: Branch[] }) {
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const [branchFilter, setBranchFilter] = useState("all");

  const branchId = branchFilter !== "all" ? Number(branchFilter) : undefined;
  const queryKey = `/api/reports/profit/employees?from=${from}&to=${to}${branchId ? `&branchId=${branchId}` : ""}`;

  const { data: perfList = [] } = useQuery<any[]>({
    queryKey: [queryKey],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium">من</label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">إلى</label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
        </div>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="كل الفروع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفروع</SelectItem>
            {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>الموظف</TableHead>
              <TableHead>عدد العمليات</TableHead>
              <TableHead>المبيعات (OMR)</TableHead>
              <TableHead>التكلفة (OMR)</TableHead>
              <TableHead>الربح (OMR)</TableHead>
              <TableHead>الهامش %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perfList.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
            ) : perfList.map((emp: any, i: number) => (
              <TableRow key={emp.employeeId} data-testid={`row-perf-${emp.employeeId}`}>
                <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{emp.employeeName}</TableCell>
                <TableCell>{emp.ordersCount}</TableCell>
                <TableCell className="font-medium text-primary">{fmt(emp.salesTotal)}</TableCell>
                <TableCell className="text-amber-600">{fmt(emp.cogsTotal)}</TableCell>
                <TableCell className="font-bold text-green-600">{fmt(emp.grossProfit)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={parseFloat(emp.margin) > 30 ? "bg-green-50 text-green-700" : parseFloat(emp.margin) > 15 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}>
                    {emp.margin}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
