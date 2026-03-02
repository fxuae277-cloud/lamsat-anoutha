import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Branch, City } from "@shared/schema";
import { UserPlus, Pencil, KeyRound, ShieldCheck, Eye, EyeOff, Lock, UserCircle, Settings2, Building2, MapPin } from "lucide-react";

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
      setOldPassword("");
      setNewPassword("");
      setShowOldPass(false);
      setShowChangeNewPass(false);
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

  const roleLabel = ROLE_LABELS[currentUser?.role || ""] || currentUser?.role || "";
  const userBranch = branchesList.find(b => b.id === currentUser?.branchId);

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-in fade-in duration-300">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">الإعدادات</h1>
        <p className="text-muted-foreground mt-1">إدارة حسابك، المستخدمين، والإعدادات العامة</p>
      </div>

      <Tabs defaultValue="account" dir="rtl" className="space-y-6">
        <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap gap-1">
          <TabsTrigger value="account" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-account">
            <UserCircle className="w-4 h-4" />
            حسابي
          </TabsTrigger>
          {isOwnerOrAdmin && (
            <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-users">
              <ShieldCheck className="w-4 h-4" />
              المستخدمون
            </TabsTrigger>
          )}
          <TabsTrigger value="general" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-general">
            <Settings2 className="w-4 h-4" />
            الإعدادات العامة
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-branches">
            <Building2 className="w-4 h-4" />
            الفروع والمدن
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserCircle className="w-5 h-5" />
                معلومات الحساب
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/30 rounded-lg border text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold mx-auto mb-2">
                    {currentUser?.name?.charAt(0) || "؟"}
                  </div>
                  <p className="font-bold text-sm">{currentUser?.name}</p>
                  <p className="text-xs text-muted-foreground">@{currentUser?.username}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">الدور</p>
                  <p className="font-bold text-sm">{roleLabel}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">الفرع</p>
                  <p className="font-bold text-sm">{userBranch?.name || "-"}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">الجهاز</p>
                  <p className="font-bold text-sm" dir="ltr">{currentUser?.terminalName || "-"}</p>
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
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label>كلمة المرور الحالية</Label>
                  <div className="relative">
                    <Input
                      type={showOldPass ? "text" : "password"}
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور الحالية"
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
                      placeholder="أدخل كلمة المرور الجديدة (6 أحرف على الأقل)"
                      data-testid="input-new-password"
                    />
                    <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowChangeNewPass(!showChangeNewPass)}>
                      {showChangeNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  onClick={() => changePasswordMutation.mutate()}
                  disabled={changePasswordMutation.isPending || !oldPassword || newPassword.length < 6}
                  className="gap-2"
                  data-testid="button-confirm-change-password"
                >
                  <KeyRound className="w-4 h-4" />
                  {changePasswordMutation.isPending ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isOwnerOrAdmin && (
          <TabsContent value="users" className="space-y-6">
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
                    <DialogHeader>
                      <DialogTitle>إضافة مستخدم جديد</DialogTitle>
                      <DialogDescription>أدخل بيانات المستخدم الجديد لإضافته إلى النظام</DialogDescription>
                    </DialogHeader>
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
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-right p-3 font-medium">المستخدم</th>
                        <th className="text-right p-3 font-medium">الدور</th>
                        <th className="text-right p-3 font-medium">الفرع</th>
                        <th className="text-right p-3 font-medium">الجهاز</th>
                        <th className="text-center p-3 font-medium">الحالة</th>
                        <th className="text-center p-3 font-medium">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {usersList.map(u => {
                        const branch = branchesList.find(b => b.id === u.branchId);
                        return (
                          <tr key={u.id} className={u.isActive ? "" : "bg-red-50/30 opacity-60"} data-testid={`row-user-${u.id}`}>
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${u.isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                                  {u.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{u.name}</p>
                                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                                {ROLE_LABELS[u.role] || u.role}
                              </span>
                            </td>
                            <td className="p-3 text-sm">{branch?.name || "-"}</td>
                            <td className="p-3 text-sm" dir="ltr">{u.terminalName}</td>
                            <td className="p-3 text-center">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${u.isActive ? "bg-green-500" : "bg-red-400"}`} title={u.isActive ? "مفعّل" : "معطّل"} />
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditUser(u)} title="تعديل" data-testid={`button-edit-user-${u.id}`}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openResetPassword(u)} title="إعادة تعيين كلمة المرور" data-testid={`button-reset-pass-${u.id}`}>
                                  <KeyRound className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="general" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="branches" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                الفروع النشطة
              </CardTitle>
              {isOwnerOrAdmin && (
                <Dialog open={addBranchOpen} onOpenChange={setAddBranchOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-branch">إضافة فرع</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>إضافة فرع جديد</DialogTitle>
                      <DialogDescription>أدخل بيانات الفرع الجديد</DialogDescription>
                    </DialogHeader>
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
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-bold">{branch.name} {branch.isMain && <span className="text-xs text-primary font-normal mr-1">(رئيسي)</span>}</p>
                        <p className="text-sm text-muted-foreground">{branch.address || "-"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                المدن المرتبطة بالفروع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {citiesList.map(city => {
                  const branch = branchesList.find(b => b.id === city.branchId);
                  return (
                    <div key={city.id} className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg text-sm">
                      <span className="font-medium">{city.name}</span>
                      <span className="text-muted-foreground text-xs">{branch?.name || "-"}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل المستخدم: {editUser?.name}</DialogTitle>
            <DialogDescription>تعديل بيانات المستخدم @{editUser?.username}</DialogDescription>
          </DialogHeader>
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
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
            <DialogDescription>إعادة تعيين كلمة مرور المستخدم @{resetPassUser?.username}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  type={showResetPass ? "text" : "password"}
                  value={resetPassValue}
                  onChange={e => setResetPassValue(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  data-testid="input-reset-password"
                />
                <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowResetPass(!showResetPass)}>
                  {showResetPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
    </div>
  );
}
