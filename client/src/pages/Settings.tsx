import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Branch, City } from "@shared/schema";
import { UserPlus, Pencil, KeyRound, ShieldCheck, Eye, EyeOff, Lock } from "lucide-react";

type SafeUser = {
  id: number;
  username: string;
  name: string;
  role: string;
  branchId: number;
  terminalName: string;
  isActive: boolean;
};

const ROLE_LABELS: Record<string, string> = { owner: "مالك", admin: "مدير", cashier: "كاشير", employee: "موظف" };
const ROLE_OPTIONS = [
  { value: "owner", label: "مالك" },
  { value: "admin", label: "مدير" },
  { value: "cashier", label: "كاشير" },
  { value: "employee", label: "موظف" },
];

export default function Settings() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isOwnerOrAdmin = currentUser?.role === "owner" || currentUser?.role === "admin";

  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: "", address: "" });

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", username: "", password: "", role: "cashier", branchId: "1", terminalName: "POS-1" });
  const [showNewPass, setShowNewPass] = useState(false);

  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUser, setEditUser] = useState<SafeUser | null>(null);

  const [resetPassOpen, setResetPassOpen] = useState(false);
  const [resetPassUser, setResetPassUser] = useState<SafeUser | null>(null);
  const [resetPassValue, setResetPassValue] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);

  const [changePassOpen, setChangePassOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showChangeNewPass, setShowChangeNewPass] = useState(false);

  const { data: branchesList = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: usersList = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOwnerOrAdmin,
  });
  const { data: citiesList = [] } = useQuery<City[]>({ queryKey: ["/api/cities"], queryFn: getQueryFn({ on401: "throw" }) });

  const createBranchMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/branches", newBranch); },
    onSuccess: () => {
      toast({ title: "تمت الإضافة" });
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setAddBranchOpen(false);
      setNewBranch({ name: "", address: "" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/users", {
        name: newUser.name,
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
        branchId: parseInt(newUser.branchId) || 1,
        terminalName: newUser.terminalName || "T1",
      });
    },
    onSuccess: () => {
      toast({ title: "تم إنشاء المستخدم بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAddUserOpen(false);
      setNewUser({ name: "", username: "", password: "", role: "cashier", branchId: "1", terminalName: "POS-1" });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      await apiRequest("PATCH", `/api/users/${editUser.id}`, {
        name: editUser.name,
        role: editUser.role,
        branchId: editUser.branchId,
        terminalName: editUser.terminalName,
        isActive: editUser.isActive,
      });
    },
    onSuccess: () => {
      toast({ title: "تم تحديث المستخدم" });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditUserOpen(false);
      setEditUser(null);
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!resetPassUser) return;
      await apiRequest("PATCH", `/api/users/${resetPassUser.id}/reset-password`, { newPassword: resetPassValue });
    },
    onSuccess: () => {
      toast({ title: "تم إعادة تعيين كلمة المرور" });
      setResetPassOpen(false);
      setResetPassUser(null);
      setResetPassValue("");
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/change-password", { oldPassword, newPassword });
    },
    onSuccess: () => {
      toast({ title: "تم تغيير كلمة المرور بنجاح" });
      setChangePassOpen(false);
      setOldPassword("");
      setNewPassword("");
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const openEditUser = (u: SafeUser) => {
    setEditUser({ ...u });
    setEditUserOpen(true);
  };

  const openResetPassword = (u: SafeUser) => {
    setResetPassUser(u);
    setResetPassValue("");
    setShowResetPass(false);
    setResetPassOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">الإعدادات العامة</h1>
        <p className="text-muted-foreground mt-1">تكوين إعدادات النظام، الفروع، والمستخدمين.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">إعدادات المنشأة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم المنشأة التجاري</Label>
              <Input defaultValue="لمسة أنوثة إكسسوارات لوى" />
            </div>
            <div className="space-y-2">
              <Label>العملة الافتراضية</Label>
              <Input defaultValue="ريال عماني (OMR)" disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الضرائب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base">ضريبة القيمة المضافة (VAT)</Label>
              <p className="text-sm text-muted-foreground">يتم احتسابها تلقائياً في نقطة البيع.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold">5%</span>
              <Switch defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="w-5 h-5" />
            تغيير كلمة المرور
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">تغيير كلمة المرور الخاصة بحسابك ({currentUser?.name})</p>
          <Dialog open={changePassOpen} onOpenChange={setChangePassOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-change-password">
                <KeyRound className="w-4 h-4" />
                تغيير كلمة المرور
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>تغيير كلمة المرور</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>كلمة المرور الحالية</Label>
                  <div className="relative">
                    <Input
                      type={showOldPass ? "text" : "password"}
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      data-testid="input-old-password"
                    />
                    <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowOldPass(!showOldPass)}>
                      {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>كلمة المرور الجديدة</Label>
                  <div className="relative">
                    <Input
                      type={showChangeNewPass ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      data-testid="input-new-password"
                    />
                    <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowChangeNewPass(!showChangeNewPass)}>
                      {showChangeNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">6 أحرف على الأقل</p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => changePasswordMutation.mutate()}
                  disabled={changePasswordMutation.isPending || !oldPassword || newPassword.length < 6}
                  data-testid="button-confirm-change-password"
                >
                  {changePasswordMutation.isPending ? "جارٍ التغيير..." : "تأكيد التغيير"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">الفروع النشطة</CardTitle>
          {isOwnerOrAdmin && (
            <Dialog open={addBranchOpen} onOpenChange={setAddBranchOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-branch">إضافة فرع</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>إضافة فرع جديد</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>اسم الفرع</Label>
                    <Input value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>العنوان</Label>
                    <Input value={newBranch.address} onChange={e => setNewBranch({...newBranch, address: e.target.value})} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createBranchMutation.mutate()} disabled={createBranchMutation.isPending || !newBranch.name}>حفظ</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {branchesList.map(branch => (
              <div key={branch.id} className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
                <div>
                  <p className="font-bold">{branch.name} {branch.isMain && "(رئيسي)"}</p>
                  <p className="text-sm text-muted-foreground">{branch.address || "-"}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isOwnerOrAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              المستخدمون والصلاحيات
            </CardTitle>
            <Dialog open={addUserOpen} onOpenChange={(open) => { setAddUserOpen(open); if (!open) setShowNewPass(false); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5" data-testid="button-add-user">
                  <UserPlus className="w-4 h-4" />
                  إضافة موظف
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>إضافة مستخدم جديد</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>الاسم الكامل</Label>
                      <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} data-testid="input-new-user-name" />
                    </div>
                    <div className="space-y-2">
                      <Label>اسم المستخدم (للدخول)</Label>
                      <Input value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} dir="ltr" className="text-left" data-testid="input-new-user-username" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          type={showNewPass ? "text" : "password"}
                          value={newUser.password}
                          onChange={e => setNewUser({...newUser, password: e.target.value})}
                          data-testid="input-new-user-password"
                        />
                        <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNewPass(!showNewPass)}>
                          {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>الدور</Label>
                      <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v})}>
                        <SelectTrigger data-testid="select-new-user-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>الفرع</Label>
                      <Select value={newUser.branchId} onValueChange={v => setNewUser({...newUser, branchId: v})}>
                        <SelectTrigger data-testid="select-new-user-branch"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>اسم الجهاز (Terminal)</Label>
                      <Input value={newUser.terminalName} onChange={e => setNewUser({...newUser, terminalName: e.target.value})} dir="ltr" className="text-left" data-testid="input-new-user-terminal" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createUserMutation.mutate()}
                    disabled={createUserMutation.isPending || !newUser.name || !newUser.username || newUser.password.length < 6}
                    data-testid="button-confirm-add-user"
                  >
                    {createUserMutation.isPending ? "جارٍ الإضافة..." : "إضافة المستخدم"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {usersList.map(u => {
                const branch = branchesList.find(b => b.id === u.branchId);
                return (
                  <div key={u.id} className={`flex items-center justify-between p-3 border rounded-lg ${u.isActive ? "bg-muted/30" : "bg-red-50/50 opacity-60"}`} data-testid={`row-user-${u.id}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${u.isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{u.name}</p>
                        <p className="text-xs text-muted-foreground">@{u.username} · {branch?.name || "-"} · {u.terminalName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${u.isActive ? "bg-primary/10 text-primary" : "bg-red-100 text-red-600"}`}>
                        {u.isActive ? ROLE_LABELS[u.role] || u.role : "معطّل"}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditUser(u)} data-testid={`button-edit-user-${u.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openResetPassword(u)} data-testid={`button-reset-pass-${u.id}`}>
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل المستخدم: {editUser?.name}</DialogTitle></DialogHeader>
          {editUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input value={editUser.name} onChange={e => setEditUser({...editUser, name: e.target.value})} data-testid="input-edit-user-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الدور</Label>
                  <Select value={editUser.role} onValueChange={v => setEditUser({...editUser, role: v})}>
                    <SelectTrigger data-testid="select-edit-user-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الفرع</Label>
                  <Select value={editUser.branchId.toString()} onValueChange={v => setEditUser({...editUser, branchId: parseInt(v)})}>
                    <SelectTrigger data-testid="select-edit-user-branch"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>اسم الجهاز (Terminal)</Label>
                <Input value={editUser.terminalName} onChange={e => setEditUser({...editUser, terminalName: e.target.value})} dir="ltr" className="text-left" data-testid="input-edit-user-terminal" />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label>الحساب مفعّل</Label>
                <Switch checked={editUser.isActive} onCheckedChange={v => setEditUser({...editUser, isActive: v})} data-testid="switch-edit-user-active" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => updateUserMutation.mutate()} disabled={updateUserMutation.isPending} data-testid="button-confirm-edit-user">
              {updateUserMutation.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPassOpen} onOpenChange={setResetPassOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>إعادة تعيين كلمة المرور: {resetPassUser?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">أدخل كلمة المرور الجديدة للمستخدم @{resetPassUser?.username}</p>
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  type={showResetPass ? "text" : "password"}
                  value={resetPassValue}
                  onChange={e => setResetPassValue(e.target.value)}
                  data-testid="input-reset-password"
                />
                <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowResetPass(!showResetPass)}>
                  {showResetPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">6 أحرف على الأقل</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => resetPasswordMutation.mutate()}
              disabled={resetPasswordMutation.isPending || resetPassValue.length < 6}
              data-testid="button-confirm-reset-password"
            >
              {resetPasswordMutation.isPending ? "جارٍ التعيين..." : "إعادة تعيين"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">المدن المرتبطة بالفروع</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {citiesList.map(city => {
              const branch = branchesList.find(b => b.id === city.branchId);
              return (
                <div key={city.id} className="flex items-center justify-between p-2 bg-muted/30 border rounded-lg text-sm">
                  <span className="font-medium">{city.name}</span>
                  <span className="text-muted-foreground text-xs">{branch?.name || "-"}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
