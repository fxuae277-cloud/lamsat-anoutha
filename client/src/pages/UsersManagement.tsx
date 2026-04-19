import { useState } from "react";
import {
  UserPlus, Pencil, KeyRound, Trash2, ToggleLeft, ToggleRight,
  Search, Filter, Shield, Building2, CheckCircle, XCircle,
  Eye, EyeOff, Loader2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/formatters";

// ─── Types ────────────────────────────────────────────────────────────────────
type SafeUser = {
  id: number; username: string; name: string; role: string;
  branchId: number; terminalName: string; isActive: boolean;
  phone?: string; last_login?: string; role_id?: number;
};
type Branch  = { id: number; name: string; address?: string };
type Role    = { id: number; name: string; description: string; permission_count: number };

// ─── helpers ──────────────────────────────────────────────────────────────────
const ROLE_MAP: Record<string, { label: string; color: string }> = {
  owner: { label: "المالك",  color: "bg-pink-100 text-pink-800 border-pink-200" },
  sales: { label: "البيع",   color: "bg-blue-100 text-blue-800 border-blue-200" },
  admin: { label: "مدير",    color: "bg-purple-100 text-purple-800" },
  cashier:{ label: "كاشير",  color: "bg-green-100 text-green-800" },
  employee:{ label: "موظف",  color: "bg-gray-100 text-gray-700" },
};

function validatePassword(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8)                        errors.push("8 أحرف على الأقل");
  if (!/[A-Z]/.test(pw))                   errors.push("حرف كبير واحد على الأقل");
  if (!/[a-z]/.test(pw))                   errors.push("حرف صغير واحد على الأقل");
  if (!/[0-9]/.test(pw))                   errors.push("رقم واحد على الأقل");
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) errors.push("رمز خاص واحد على الأقل");
  return errors;
}

function branchLabel(b: Branch) {
  return b.address ? `${b.name} - ${b.address}` : b.name;
}

// ── empty form ────────────────────────────────────────────────────────────────
const emptyForm = {
  name: "", username: "", password: "", confirmPassword: "",
  role: "sales", branchId: "", terminalName: "T1",
  phone: "", isActive: true,
};

// ══════════════════════════════════════════════════════════════════════════════
export default function UsersManagement() {
  const { toast } = useToast();
  const { data: authData } = useAuth();
  const me = authData?.user;

  // ── state ──────────────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState("");
  const [filterRole,    setFilterRole]    = useState("all");
  const [filterBranch,  setFilterBranch]  = useState("all");
  const [filterStatus,  setFilterStatus]  = useState("all");
  const [showPass,      setShowPass]      = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);

  const [addOpen,       setAddOpen]       = useState(false);
  const [editOpen,      setEditOpen]      = useState(false);
  const [resetOpen,     setResetOpen]     = useState(false);
  const [deleteOpen,    setDeleteOpen]    = useState(false);
  const [selectedUser,  setSelectedUser]  = useState<SafeUser | null>(null);

  const [form,          setForm]          = useState({ ...emptyForm });
  const [newPw,         setNewPw]         = useState("");
  const [showNewPw,     setShowNewPw]     = useState(false);
  const [pwErrors,      setPwErrors]      = useState<string[]>([]);

  // ── queries ────────────────────────────────────────────────────────────────
  const { data: users = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const usersArr  : SafeUser[] = Array.isArray(users)   ? users   : [];
  const branchArr : Branch[]   = Array.isArray(branches) ? branches : [];
  const rolesArr  : Role[]     = Array.isArray(roles)    ? roles    : [];

  // ── filtered list ──────────────────────────────────────────────────────────
  const filtered = usersArr.filter(u => {
    const q = search.toLowerCase();
    if (q && !u.name.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q)) return false;
    if (filterRole   !== "all" && u.role !== filterRole)                           return false;
    if (filterBranch !== "all" && String(u.branchId) !== filterBranch)            return false;
    if (filterStatus === "active"   && !u.isActive)                               return false;
    if (filterStatus === "inactive" && u.isActive)                                return false;
    return true;
  });

  // ── mutations ──────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/users"] });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => { toast({ title: "تم إضافة المستخدم" }); setAddOpen(false); setForm({ ...emptyForm }); invalidate(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => { toast({ title: "تم التعديل" }); setEditOpen(false); invalidate(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const resetPwMut = useMutation({
    mutationFn: async ({ id, pw }: { id: number; pw: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}/reset-password`, { newPassword: pw });
      return res.json();
    },
    onSuccess: () => { toast({ title: "تم إعادة تعيين كلمة المرور" }); setResetOpen(false); setNewPw(""); invalidate(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/users/${id}/toggle`, {});
      return res.json();
    },
    onSuccess: (data) => { toast({ title: data.isActive ? "تم تفعيل المستخدم" : "تم إلغاء التفعيل" }); invalidate(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => { toast({ title: "تم إلغاء تفعيل المستخدم" }); setDeleteOpen(false); invalidate(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // ── handlers ───────────────────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...emptyForm, branchId: branchArr[0] ? String(branchArr[0].id) : "" });
    setPwErrors([]);
    setAddOpen(true);
  }

  function openEdit(u: SafeUser) {
    setSelectedUser(u);
    setForm({
      name: u.name, username: u.username, password: "", confirmPassword: "",
      role: u.role, branchId: String(u.branchId), terminalName: u.terminalName || "T1",
      phone: u.phone || "", isActive: u.isActive,
    });
    setEditOpen(true);
  }

  function handleAdd() {
    const errs = validatePassword(form.password);
    if (errs.length) { setPwErrors(errs); return; }
    if (form.password !== form.confirmPassword) { setPwErrors(["كلمات المرور غير متطابقة"]); return; }
    setPwErrors([]);
    createMut.mutate({
      name: form.name.trim(),
      username: form.username.trim(),
      password: form.password,
      role: form.role,
      branchId: Number(form.branchId),
      terminalName: form.terminalName || "T1",
      phone: form.phone || undefined,
      isActive: form.isActive,
    });
  }

  function handleEdit() {
    if (!selectedUser) return;
    updateMut.mutate({
      id: selectedUser.id,
      data: {
        name: form.name.trim(),
        role: form.role,
        branchId: Number(form.branchId),
        terminalName: form.terminalName || "T1",
        phone: form.phone || undefined,
        isActive: form.isActive,
      },
    });
  }

  function handleReset() {
    if (!selectedUser || !newPw) return;
    const errs = validatePassword(newPw);
    if (errs.length) { toast({ title: "كلمة المرور ضعيفة", description: errs.join(" — "), variant: "destructive" }); return; }
    resetPwMut.mutate({ id: selectedUser.id, pw: newPw });
  }

  // ── KPI cards ──────────────────────────────────────────────────────────────
  const total   = usersArr.length;
  const active  = usersArr.filter(u => u.isActive).length;
  const owners  = usersArr.filter(u => u.role === "owner").length;
  const sales   = usersArr.filter(u => u.role === "sales" || u.role === "cashier" || u.role === "employee").length;

  const getBranchName = (id: number) => {
    const b = branchArr.find(b => b.id === id);
    return b ? branchLabel(b) : `فرع ${id}`;
  };

  const roleInfo = (role: string) => ROLE_MAP[role] ?? { label: role, color: "bg-gray-100 text-gray-700" };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto" dir="rtl">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Users className="h-6 w-6" /> إدارة المستخدمين
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة حسابات المستخدمين وصلاحياتهم</p>
        </div>
        <Button onClick={openAdd} className="gap-2 rounded-xl">
          <UserPlus className="h-4 w-4" /> إضافة مستخدم
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي المستخدمين", value: total,  color: "text-primary",     bg: "bg-pink-50" },
          { label: "نشط",               value: active, color: "text-green-700",   bg: "bg-green-50" },
          { label: "ملاك",              value: owners, color: "text-purple-700",  bg: "bg-purple-50" },
          { label: "بيع",               value: sales,  color: "text-blue-700",    bg: "bg-blue-50" },
        ].map(k => (
          <Card key={k.label} className={`rounded-2xl ${k.bg}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو اسم المستخدم..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9 rounded-xl"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="الدور" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأدوار</SelectItem>
            {rolesArr.map(r => (
              <SelectItem key={r.id} value={r.name}>{roleInfo(r.name).label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-48 rounded-xl"><SelectValue placeholder="الفرع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفروع</SelectItem>
            {branchArr.map(b => <SelectItem key={b.id} value={String(b.id)}>{branchLabel(b)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="inactive">موقوف</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-pink-50">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-right w-10">#</TableHead>
              <TableHead className="text-right">الاسم الكامل</TableHead>
              <TableHead className="text-right">اسم المستخدم</TableHead>
              <TableHead className="text-right">الدور</TableHead>
              <TableHead className="text-right">الفرع</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">آخر دخول</TableHead>
              <TableHead className="text-right w-32">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              </TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                لا يوجد مستخدمون
              </TableCell></TableRow>
            ) : filtered.map((u, i) => {
              const ri = roleInfo(u.role);
              return (
                <TableRow key={u.id} className={`hover:bg-pink-50/30 ${!u.isActive ? "opacity-60" : ""}`}>
                  <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{u.name}</div>
                    {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{u.username}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs border ${ri.color}`}>{ri.label}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{getBranchName(u.branchId)}</TableCell>
                  <TableCell>
                    {u.isActive
                      ? <span className="flex items-center gap-1 text-green-700 text-sm"><CheckCircle className="h-3.5 w-3.5" /> نشط</span>
                      : <span className="flex items-center gap-1 text-red-600 text-sm"><XCircle className="h-3.5 w-3.5" /> موقوف</span>
                    }
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.last_login ? fmtDateTime(u.last_login) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(u)} title="تعديل">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setSelectedUser(u); setResetOpen(true); }} title="إعادة تعيين كلمة المرور">
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleMut.mutate(u.id)} title={u.isActive ? "إلغاء التفعيل" : "تفعيل"}>
                        {u.isActive ? <ToggleRight className="h-3.5 w-3.5 text-green-600" /> : <ToggleLeft className="h-3.5 w-3.5 text-gray-400" />}
                      </Button>
                      {me?.id !== u.id && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => { setSelectedUser(u); setDeleteOpen(true); }} title="حذف">
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* ── Dialog: إضافة مستخدم ─────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> إضافة مستخدم جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الاسم الكامل <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="محمد علي" className="mt-1" />
              </div>
              <div>
                <Label>اسم المستخدم <span className="text-red-500">*</span></Label>
                <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="mohammed" className="mt-1" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>كلمة المرور <span className="text-red-500">*</span></Label>
                <div className="relative mt-1">
                  <Input type={showPass ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="pl-9" dir="ltr" />
                  <button type="button" className="absolute left-2 top-2.5 text-muted-foreground" onClick={() => setShowPass(p => !p)}>
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>تأكيد كلمة المرور <span className="text-red-500">*</span></Label>
                <div className="relative mt-1">
                  <Input type={showConfirm ? "text" : "password"} value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} className="pl-9" dir="ltr" />
                  <button type="button" className="absolute left-2 top-2.5 text-muted-foreground" onClick={() => setShowConfirm(p => !p)}>
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            {pwErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 space-y-0.5">
                {pwErrors.map(e => <p key={e}>• {e}</p>)}
              </div>
            )}
            <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-100 rounded-lg p-2">
              يجب أن تحتوي كلمة المرور على: 8 أحرف • حرف كبير • حرف صغير • رقم • رمز خاص
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الدور <span className="text-red-500">*</span></Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rolesArr.length > 0
                      ? rolesArr.map(r => <SelectItem key={r.id} value={r.name}>{roleInfo(r.name).label} — {r.description}</SelectItem>)
                      : <>
                          <SelectItem value="owner">المالك</SelectItem>
                          <SelectItem value="admin">المدير</SelectItem>
                          <SelectItem value="cashier">كاشير</SelectItem>
                          <SelectItem value="sales">البيع</SelectItem>
                        </>
                    }
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الفرع <span className="text-red-500">*</span></Label>
                <Select value={form.branchId} onValueChange={v => setForm(f => ({ ...f, branchId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    {branchArr.map(b => <SelectItem key={b.id} value={String(b.id)}>{branchLabel(b)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>رقم الهاتف</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+968 9999 9999" className="mt-1" dir="ltr" />
              </div>
              <div>
                <Label>الجهاز / النافذة</Label>
                <Input value={form.terminalName} onChange={e => setForm(f => ({ ...f, terminalName: e.target.value }))} placeholder="T1" className="mt-1" dir="ltr" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch id="add-active" checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label htmlFor="add-active">نشط عند الإنشاء</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={handleAdd} disabled={createMut.isPending} className="gap-2">
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              إضافة المستخدم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: تعديل مستخدم ─────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary flex items-center gap-2">
              <Pencil className="h-5 w-5" /> تعديل المستخدم
            </DialogTitle>
            <DialogDescription>{selectedUser?.username}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الاسم الكامل</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الدور</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rolesArr.length > 0
                      ? rolesArr.map(r => <SelectItem key={r.id} value={r.name}>{roleInfo(r.name).label}</SelectItem>)
                      : <>
                          <SelectItem value="owner">المالك</SelectItem>
                          <SelectItem value="admin">المدير</SelectItem>
                          <SelectItem value="cashier">كاشير</SelectItem>
                          <SelectItem value="sales">البيع</SelectItem>
                        </>
                    }
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الفرع</Label>
                <Select value={form.branchId} onValueChange={v => setForm(f => ({ ...f, branchId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {branchArr.map(b => <SelectItem key={b.id} value={String(b.id)}>{branchLabel(b)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>رقم الهاتف</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1" dir="ltr" />
              </div>
              <div>
                <Label>الجهاز / النافذة</Label>
                <Input value={form.terminalName} onChange={e => setForm(f => ({ ...f, terminalName: e.target.value }))} className="mt-1" dir="ltr" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="edit-active" checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label htmlFor="edit-active">الحساب نشط</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={handleEdit} disabled={updateMut.isPending} className="gap-2">
              {updateMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: إعادة تعيين كلمة المرور ─────────────────────────────── */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> إعادة تعيين كلمة المرور</DialogTitle>
            <DialogDescription>{selectedUser?.name}</DialogDescription>
          </DialogHeader>
          <div>
            <Label>كلمة المرور الجديدة</Label>
            <div className="relative mt-1">
              <Input type={showNewPw ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} className="pl-9" dir="ltr" placeholder="الحد الأدنى 8 أحرف" />
              <button type="button" className="absolute left-2 top-2.5 text-muted-foreground" onClick={() => setShowNewPw(p => !p)}>
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">8 أحرف • حرف كبير • رقم • رمز خاص</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setResetOpen(false); setNewPw(""); }}>إلغاء</Button>
            <Button onClick={handleReset} disabled={resetPwMut.isPending || !newPw} className="gap-2">
              {resetPwMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              تعيين
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: تأكيد الحذف ──────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" /> إلغاء تفعيل المستخدم
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء تفعيل <strong>{selectedUser?.name}</strong>؟
              <br />
              سيتم إلغاء وصوله نهائياً ولن يتمكن من تسجيل الدخول.
              <br />
              <span className="text-amber-600 text-xs mt-1 block">يمكنك إعادة التفعيل لاحقاً من زر التبديل.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => selectedUser && deleteMut.mutate(selectedUser.id)}
            >
              إلغاء التفعيل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
