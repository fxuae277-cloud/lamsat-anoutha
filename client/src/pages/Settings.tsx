import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import type { Branch, User, City } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();
  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: "", address: "" });
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", name: "", role: "employee", branchId: "" });

  const { data: branchesList = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: usersList = [] } = useQuery<User[]>({ queryKey: ["/api/users"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: citiesList = [] } = useQuery<City[]>({ queryKey: ["/api/cities"], queryFn: getQueryFn({ on401: "throw" }) });

  const createBranchMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/branches", newBranch);
    },
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
        ...newUser,
        branchId: newUser.branchId ? parseInt(newUser.branchId) : null,
      });
    },
    onSuccess: () => {
      toast({ title: "تمت الإضافة" });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAddUserOpen(false);
      setNewUser({ username: "", password: "", name: "", role: "employee", branchId: "" });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const ROLE_LABELS: Record<string, string> = { owner: "مالك", cashier: "كاشير", employee: "موظف" };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">الإعدادات العامة</h1>
        <p className="text-muted-foreground mt-1">تكوين إعدادات النظام، الفروع، والضرائب.</p>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">الفروع النشطة</CardTitle>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">المستخدمون والصلاحيات</CardTitle>
          <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-user">إضافة مستخدم</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إضافة مستخدم جديد</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم</Label>
                    <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>اسم المستخدم</Label>
                    <Input value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>كلمة المرور</Label>
                    <Input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>الدور</Label>
                    <select className="w-full border rounded-md h-9 px-3 text-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                      <option value="owner">مالك</option>
                      <option value="cashier">كاشير</option>
                      <option value="employee">موظف</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الفرع</Label>
                  <select className="w-full border rounded-md h-9 px-3 text-sm" value={newUser.branchId} onChange={e => setNewUser({...newUser, branchId: e.target.value})}>
                    <option value="">بدون فرع</option>
                    {branchesList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createUserMutation.mutate()} disabled={createUserMutation.isPending || !newUser.name || !newUser.username || !newUser.password}>حفظ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {usersList.map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                </div>
                <span className="text-sm px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
