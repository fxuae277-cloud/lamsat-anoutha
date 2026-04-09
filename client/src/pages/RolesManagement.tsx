import { useState } from "react";
import { Shield, CheckCircle, XCircle, Save, Loader2, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type Role       = { id: number; name: string; description: string; is_active: boolean; permission_count: number };
type Permission = { id: number; code: string; name: string; category: string };

// ─── Category labels ──────────────────────────────────────────────────────────
const CAT_LABELS: Record<string, { label: string; color: string }> = {
  sales:     { label: "المبيعات",    color: "bg-green-100 text-green-800" },
  products:  { label: "المنتجات",   color: "bg-blue-100 text-blue-800" },
  inventory: { label: "المخزون",    color: "bg-amber-100 text-amber-800" },
  purchases: { label: "المشتريات",  color: "bg-orange-100 text-orange-800" },
  finance:   { label: "المالية",    color: "bg-purple-100 text-purple-800" },
  customers: { label: "العملاء",    color: "bg-cyan-100 text-cyan-800" },
  admin:     { label: "الإدارة",    color: "bg-red-100 text-red-800" },
};

const ROLE_COLORS: Record<string, string> = {
  owner: "border-pink-200 bg-pink-50",
  sales: "border-blue-200 bg-blue-50",
};

// ══════════════════════════════════════════════════════════════════════════════
export default function RolesManagement() {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [pendingPerms, setPendingPerms] = useState<Set<number>>(new Set());
  const [dirty, setDirty] = useState(false);

  // ── queries ────────────────────────────────────────────────────────────────
  const { data: roles = [], isLoading: loadingRoles } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: allPerms = [] } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: rolePerms = [], isLoading: loadingPerms } = useQuery<Permission[]>({
    queryKey: [`/api/roles/${selectedRole?.id}/permissions`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!selectedRole,
  });

  const rolesArr  : Role[]       = Array.isArray(roles)    ? roles    : [];
  const permsArr  : Permission[] = Array.isArray(allPerms) ? allPerms : [];
  const rolePermsArr: Permission[]= Array.isArray(rolePerms)? rolePerms: [];

  // ── when rolePerms load, init pendingPerms ─────────────────────────────────
  const currentPermIds = new Set(rolePermsArr.map(p => p.id));

  function selectRole(r: Role) {
    setSelectedRole(r);
    setDirty(false);
    // Will be set when rolePerms load via useEffect-like approach below
  }

  function togglePerm(permId: number) {
    if (selectedRole?.name === "owner") return; // owner is locked
    setPendingPerms(prev => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
    setDirty(true);
  }

  // Merge currentPermIds with pendingPerms for display
  const effectivePerms = dirty
    ? pendingPerms
    : currentPermIds;

  // ── save mutation ──────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selectedRole) return;
      const res = await apiRequest("PUT", `/api/roles/${selectedRole.id}/permissions`, {
        permissionIds: Array.from(effectivePerms),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم حفظ الصلاحيات" });
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: [`/api/roles/${selectedRole?.id}/permissions`] });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // Group permissions by category
  const grouped = permsArr.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const isOwner = selectedRole?.name === "owner";

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto" dir="rtl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Shield className="h-6 w-6" /> إدارة الأدوار والصلاحيات
        </h1>
        <p className="text-sm text-muted-foreground mt-1">تحديد ما يستطيع كل دور الوصول إليه في النظام</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Roles List */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">الأدوار</h2>
          {loadingRoles ? (
            <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
          ) : rolesArr.map(r => (
            <Card
              key={r.id}
              className={`rounded-2xl cursor-pointer transition-all hover:shadow-md border-2 ${
                selectedRole?.id === r.id
                  ? (ROLE_COLORS[r.name] || "border-primary bg-primary/5")
                  : "border-transparent hover:border-muted"
              }`}
              onClick={() => { selectRole(r); setPendingPerms(new Set()); }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-base">
                        {r.name === "owner" ? "المالك" : r.name === "sales" ? "البيع" : r.name}
                      </p>
                      {r.name === "owner" && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  </div>
                  <Badge className="shrink-0 text-xs bg-primary/10 text-primary border-0">
                    {r.permission_count} صلاحية
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Legend */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 space-y-1">
            <div className="flex items-center gap-1.5 font-medium"><Info className="h-3.5 w-3.5" /> ملاحظة</div>
            <p>صلاحيات المالك ثابتة ولا يمكن تعديلها.</p>
            <p>يمكن تخصيص صلاحيات دور "البيع" حسب الحاجة.</p>
          </div>
        </div>

        {/* Permissions Grid */}
        <div className="md:col-span-2">
          {!selectedRole ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <Shield className="h-12 w-12 opacity-20" />
              <p>اختر دوراً لعرض صلاحياته</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  صلاحيات دور "{selectedRole.name === "owner" ? "المالك" : "البيع"}"
                </h2>
                {!isOwner && dirty && (
                  <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-2">
                    {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    حفظ التغييرات
                  </Button>
                )}
                {isOwner && (
                  <Badge className="bg-gray-100 text-gray-600 border-0 gap-1">
                    <Lock className="h-3 w-3" /> محمي — غير قابل للتعديل
                  </Badge>
                )}
              </div>

              {loadingPerms ? (
                <div className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(grouped).map(([cat, perms]) => {
                    const catInfo = CAT_LABELS[cat] || { label: cat, color: "bg-gray-100 text-gray-700" };
                    const catEnabled = perms.filter(p => effectivePerms.has(p.id) || (isOwner && currentPermIds.has(p.id))).length;
                    return (
                      <Card key={cat} className="rounded-2xl border-0 shadow-sm">
                        <CardHeader className="pb-2 pt-3 px-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Badge className={`text-xs ${catInfo.color} border-0`}>{catInfo.label}</Badge>
                            </CardTitle>
                            <span className="text-xs text-muted-foreground">
                              {isOwner ? perms.length : catEnabled}/{perms.length}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 px-4 pb-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {perms.map(p => {
                              const checked = isOwner
                                ? currentPermIds.has(p.id)
                                : (dirty ? effectivePerms.has(p.id) : currentPermIds.has(p.id));
                              return (
                                <div
                                  key={p.id}
                                  className={`flex items-center gap-2.5 rounded-lg p-2 transition-colors cursor-pointer ${
                                    checked
                                      ? "bg-green-50 border border-green-100"
                                      : "bg-gray-50 border border-gray-100"
                                  } ${isOwner ? "cursor-default opacity-80" : "hover:bg-muted/50"}`}
                                  onClick={() => togglePerm(p.id)}
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={isOwner}
                                    className={checked ? "border-green-500 data-[state=checked]:bg-green-500" : ""}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{p.name}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{p.code}</p>
                                  </div>
                                  {checked
                                    ? <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                    : <XCircle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                                  }
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Summary */}
                  <div className="flex items-center justify-between text-sm bg-muted/30 rounded-xl p-3">
                    <span className="text-muted-foreground">إجمالي الصلاحيات المفعّلة</span>
                    <span className="font-bold text-primary">
                      {isOwner ? currentPermIds.size : (dirty ? effectivePerms.size : currentPermIds.size)} / {permsArr.length}
                    </span>
                  </div>

                  {!isOwner && dirty && (
                    <Button className="w-full gap-2" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                      {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      حفظ صلاحيات دور البيع
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
