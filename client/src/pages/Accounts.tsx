import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn, parseServerError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Account, AccountType } from "@shared/schema";
import { ACCOUNT_TYPES } from "@shared/schema";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import {
  Plus, Edit2, Database, ChevronRight, ChevronDown, Landmark,
  BookOpen, ListOrdered, Eye, CheckCircle2, Clock, RefreshCw,
  ArrowUpRight, ArrowDownLeft, Filter,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayStr()        { return new Date().toISOString().slice(0, 10); }
function startOfYearStr()  { const d = new Date(); d.setMonth(0, 1); return d.toISOString().slice(0, 10); }
function fmtOMR(v: any)    {
  const n = parseFloat(String(v || "0"));
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " ر.ع";
}
function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ar-OM", { year: "numeric", month: "short", day: "2-digit" });
}

const TYPE_AR: Record<string, string> = {
  asset: "أصول", liability: "خصوم", equity: "حقوق ملكية",
  revenue: "إيرادات", expense: "مصروفات",
};
const TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-100 text-blue-800",
  liability: "bg-red-100 text-red-800",
  equity: "bg-green-100 text-green-800",
  revenue: "bg-emerald-100 text-emerald-800",
  expense: "bg-orange-100 text-orange-800",
};
const SOURCE_AR: Record<string, string> = {
  sale: "مبيعات", purchase: "مشتريات", expense: "مصروف",
  return: "مرتجع", salary: "رواتب", manual: "يدوي",
  supplier_payment: "دفع مورد", advance: "سلفة",
};

interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
  balance?: number;
  total_debit?: number;
  total_credit?: number;
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Accounts() {
  const { toast } = useToast();
  const { data: authData } = useAuth();
  const user = authData?.user;
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  // ── filters ───────────────────────────────────────────────────────────────
  const [from, setFrom]   = useState(startOfYearStr());
  const [to,   setTo]     = useState(todayStr());
  const [applied, setApplied] = useState({ from: startOfYearStr(), to: todayStr() });

  // ── account form ──────────────────────────────────────────────────────────
  const [isAddOpen, setIsAddOpen]   = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const [form, setForm] = useState({
    code: "", name: "", nameEn: "",
    type: "asset" as AccountType, parentId: "" as string | number, level: 1,
  });

  // ── ledger dialog ─────────────────────────────────────────────────────────
  const [ledgerAccount, setLedgerAccount] = useState<any | null>(null);

  // ── journal entry dialog ──────────────────────────────────────────────────
  const [viewEntry, setViewEntry] = useState<any | null>(null);

  // ── journal filters ────────────────────────────────────────────────────────
  const [jFrom, setJFrom] = useState(startOfYearStr());
  const [jTo,   setJTo]   = useState(todayStr());
  const [jStatus, setJStatus] = useState("all");
  const [jApplied, setJApplied] = useState({ from: startOfYearStr(), to: todayStr(), status: "all" });

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: _accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const accounts: Account[] = Array.isArray(_accounts) ? _accounts : [];

  const { data: _balances = [] } = useQuery<any[]>({
    queryKey: [`/api/accounts/with-balances?from=${applied.from}&to=${applied.to}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAdmin,
  });
  const balances: any[] = Array.isArray(_balances) ? _balances : [];

  // map accountId → balance row
  const balanceMap = useMemo(() => {
    const m: Record<number, any> = {};
    balances.forEach(b => { m[b.id] = b; });
    return m;
  }, [balances]);

  const { data: _ledger = [] } = useQuery<any[]>({
    queryKey: [`/api/accounts/${ledgerAccount?.id}/ledger?from=${applied.from}&to=${applied.to}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!ledgerAccount && isAdmin,
  });
  const ledger: any[] = Array.isArray(_ledger) ? _ledger : [];

  const { data: _entries = [] } = useQuery<any[]>({
    queryKey: [
      `/api/journal-entries?from=${jApplied.from}&to=${jApplied.to}` +
      (jApplied.status !== "all" ? `&status=${jApplied.status}` : "")
    ],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: isAdmin,
  });
  const entries: any[] = Array.isArray(_entries) ? _entries : [];

  const { data: entryDetail } = useQuery<any>({
    queryKey: [`/api/journal-entries/${viewEntry?.id}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!viewEntry,
  });

  // ── mutations ─────────────────────────────────────────────────────────────
  const seedMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/accounts/seed")).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "تم تهيئة دليل الحسابات الافتراضي" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/accounts", data);
      if (!res.ok) throw new Error(await parseServerError(res));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setIsAddOpen(false); resetForm();
      toast({ title: "تم إضافة الحساب" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/accounts/${id}`, data);
      if (!res.ok) throw new Error(await parseServerError(res));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setIsEditOpen(false); setEditingAccount(null); resetForm();
      toast({ title: "تم تعديل الحساب" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const postMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/journal-entries/${id}/post`);
      if (!res.ok) throw new Error(await parseServerError(res));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts/with-balances"] });
      toast({ title: "تم ترحيل القيد بنجاح" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  // ── helpers ───────────────────────────────────────────────────────────────
  const resetForm = () => setForm({ code: "", name: "", nameEn: "", type: "asset", parentId: "", level: 1 });

  const handleEdit = (acc: Account) => {
    if (acc.isSystem) return;
    setEditingAccount(acc);
    setForm({ code: acc.code, name: acc.name, nameEn: acc.nameEn || "", type: acc.type as AccountType, parentId: acc.parentId || "", level: acc.level || 1 });
    setIsEditOpen(true);
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── tree building ─────────────────────────────────────────────────────────
  const accountTree = useMemo(() => {
    const nodes: Record<number, AccountTreeNode> = {};
    const roots: AccountTreeNode[] = [];
    accounts.forEach(a => { nodes[a.id] = { ...a, children: [], ...(balanceMap[a.id] || {}) }; });
    accounts.forEach(a => {
      if (a.parentId && nodes[a.parentId]) nodes[a.parentId].children.push(nodes[a.id]);
      else roots.push(nodes[a.id]);
    });
    const sort = (arr: AccountTreeNode[]) => {
      arr.sort((a, b) => a.code.localeCompare(b.code));
      arr.forEach(n => sort(n.children));
    };
    sort(roots);
    return roots;
  }, [accounts, balanceMap]);

  const flatAccounts = useMemo(() => {
    const list: Account[] = [];
    const traverse = (nodes: AccountTreeNode[]) => nodes.forEach(n => { list.push(n); traverse(n.children); });
    traverse(accountTree);
    return list;
  }, [accountTree]);

  // ── render account row ─────────────────────────────────────────────────────
  const renderRow = (node: AccountTreeNode, depth = 0): React.ReactNode => {
    const expanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const bal = parseFloat(String(node.balance ?? 0));
    const hasMovements = (node.total_debit || 0) > 0 || (node.total_credit || 0) > 0;

    return (
      <React.Fragment key={node.id}>
        <TableRow className="hover:bg-pink-50/30 group">
          {/* الكود */}
          <TableCell className="font-mono text-xs">
            <div className="flex items-center" style={{ paddingRight: `${depth * 20}px` }}>
              {hasChildren ? (
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0 ml-1" onClick={() => toggleExpand(node.id)}>
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>
              ) : <div className="w-6" />}
              <span className="font-mono text-primary/80">{node.code}</span>
            </div>
          </TableCell>
          {/* الاسم */}
          <TableCell className={`font-medium ${depth === 0 ? "font-bold" : ""}`}>{node.name}</TableCell>
          {/* النوع */}
          <TableCell>
            <Badge className={`text-[10px] ${TYPE_COLORS[node.type] || ""}`}>{TYPE_AR[node.type] || node.type}</Badge>
          </TableCell>
          {/* المدين */}
          <TableCell className="text-right text-xs tabular-nums">
            {(node.total_debit ?? 0) > 0 ? parseFloat(String(node.total_debit)).toFixed(3) : "—"}
          </TableCell>
          {/* الدائن */}
          <TableCell className="text-right text-xs tabular-nums">
            {(node.total_credit ?? 0) > 0 ? parseFloat(String(node.total_credit)).toFixed(3) : "—"}
          </TableCell>
          {/* الرصيد */}
          <TableCell className="text-right font-semibold tabular-nums">
            {hasMovements
              ? <span className={bal >= 0 ? "text-green-700" : "text-red-600"}>{fmtOMR(bal)}</span>
              : <span className="text-muted-foreground text-xs">—</span>}
          </TableCell>
          {/* إجراءات */}
          <TableCell className="text-left">
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {hasMovements && (
                <Button variant="ghost" size="icon" className="h-7 w-7" title="كشف الحساب"
                  onClick={() => setLedgerAccount({ id: node.id, name: node.name, code: node.code, type: node.type })}>
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                </Button>
              )}
              {!node.isSystem && (
                <Button variant="ghost" size="icon" className="h-7 w-7" title="تعديل" onClick={() => handleEdit(node)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
              {node.isSystem && <Badge variant="secondary" className="text-[9px]">نظام</Badge>}
            </div>
          </TableCell>
        </TableRow>
        {expanded && node.children.map(c => renderRow(c, depth + 1))}
      </React.Fragment>
    );
  };

  // ── totals ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const byType: Record<string, number> = {};
    balances.forEach(b => {
      byType[b.type] = (byType[b.type] || 0) + parseFloat(String(b.balance || 0));
    });
    return byType;
  }, [balances]);

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
          <Landmark className="w-6 h-6" /> دليل الحسابات
        </h1>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <Database className="w-4 h-4 ml-2" /> تهيئة الحسابات الافتراضية
            </Button>
          )}
          <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> حساب جديد
          </Button>
        </div>
      </div>

      <Tabs defaultValue="chart" dir="rtl">
        <TabsList className="mb-3">
          <TabsTrigger value="chart"   className="gap-1"><Landmark className="h-4 w-4" />دليل الحسابات</TabsTrigger>
          <TabsTrigger value="journal" className="gap-1"><ListOrdered className="h-4 w-4" />القيود اليومية</TabsTrigger>
        </TabsList>

        {/* ══ دليل الحسابات ══════════════════════════════════════════════════ */}
        <TabsContent value="chart" className="space-y-4">
          {/* فلتر الفترة */}
          {isAdmin && (
            <div className="flex flex-wrap gap-3 items-center bg-muted/30 rounded-xl px-4 py-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">الفترة:</span>
              <DateInput value={from} onChange={e => setFrom(e.target.value)} className="w-36" />
              <span className="text-muted-foreground">—</span>
              <DateInput value={to}   onChange={e => setTo(e.target.value)}   className="w-36" />
              <Button size="sm" onClick={() => setApplied({ from, to })}>
                <RefreshCw className="h-3.5 w-3.5 ml-1" /> تطبيق
              </Button>
              <span className="text-xs text-muted-foreground mr-auto">
                الأرصدة من القيود المرحّلة فقط
              </span>
            </div>
          )}

          {/* KPI */}
          {isAdmin && Object.keys(totals).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(["asset","liability","equity","revenue","expense"] as const).map(t => (
                <Card key={t} className="rounded-xl shadow-sm">
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-1">{TYPE_AR[t]}</p>
                    <p className={`text-sm font-bold tabular-nums ${
                      (totals[t] || 0) >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {fmtOMR(totals[t] || 0)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* جدول الحسابات */}
          <Card className="rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-right w-36">الكود</TableHead>
                      <TableHead className="text-right">اسم الحساب</TableHead>
                      <TableHead className="text-right w-28">النوع</TableHead>
                      <TableHead className="text-right w-32">المدين ر.ع</TableHead>
                      <TableHead className="text-right w-32">الدائن ر.ع</TableHead>
                      <TableHead className="text-right w-36">الرصيد ر.ع</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          لا توجد حسابات — اضغط "تهيئة الحسابات الافتراضية"
                        </TableCell>
                      </TableRow>
                    ) : accountTree.map(root => renderRow(root))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ القيود اليومية ═════════════════════════════════════════════════ */}
        <TabsContent value="journal" className="space-y-4">
          {/* فلاتر */}
          <div className="flex flex-wrap gap-3 items-center bg-muted/30 rounded-xl px-4 py-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <DateInput value={jFrom} onChange={e => setJFrom(e.target.value)} className="w-36" />
            <span className="text-muted-foreground">—</span>
            <DateInput value={jTo}   onChange={e => setJTo(e.target.value)}   className="w-36" />
            <Select value={jStatus} onValueChange={setJStatus}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="draft">مسودة</SelectItem>
                <SelectItem value="posted">مرحّل</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setJApplied({ from: jFrom, to: jTo, status: jStatus })}>
              <RefreshCw className="h-3.5 w-3.5 ml-1" /> تطبيق
            </Button>
            <span className="mr-auto text-sm font-medium text-muted-foreground">{entries.length} قيد</span>
          </div>

          <Card className="rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-right">رقم القيد</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">البيان</TableHead>
                    <TableHead className="text-right">المصدر</TableHead>
                    <TableHead className="text-right">المدين</TableHead>
                    <TableHead className="text-right">الدائن</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        لا توجد قيود في هذه الفترة
                      </TableCell>
                    </TableRow>
                  ) : entries.map((e: any) => (
                    <TableRow key={e.id} className="hover:bg-pink-50/30">
                      <TableCell className="font-mono text-xs text-primary">{e.entry_number}</TableCell>
                      <TableCell className="text-xs">{fmtDate(e.date)}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{e.description}</TableCell>
                      <TableCell>
                        <Badge className="text-[10px] bg-gray-100 text-gray-700">
                          {SOURCE_AR[e.source_type] || e.source_type || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-orange-700">
                        {parseFloat(e.total_debit || 0).toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-blue-700">
                        {parseFloat(e.total_credit || 0).toFixed(3)}
                      </TableCell>
                      <TableCell>
                        {e.status === "posted"
                          ? <Badge className="text-[10px] bg-green-100 text-green-800 gap-1"><CheckCircle2 className="h-3 w-3" />مرحّل</Badge>
                          : <Badge className="text-[10px] bg-yellow-100 text-yellow-800 gap-1"><Clock className="h-3 w-3" />مسودة</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewEntry(e)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {e.status === "draft" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600"
                              title="ترحيل القيد"
                              onClick={() => postMutation.mutate(e.id)}
                              disabled={postMutation.isPending}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog: كشف الحساب ──────────────────────────────────────────────── */}
      <Dialog open={!!ledgerAccount} onOpenChange={o => !o && setLedgerAccount(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              كشف حساب — {ledgerAccount?.code} {ledgerAccount?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              من {applied.from} إلى {applied.to} — القيود المرحّلة فقط
            </DialogDescription>
          </DialogHeader>

          {ledger.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">لا توجد حركات في هذه الفترة</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">رقم القيد</TableHead>
                    <TableHead className="text-right">البيان</TableHead>
                    <TableHead className="text-right">مدين</TableHead>
                    <TableHead className="text-right">دائن</TableHead>
                    <TableHead className="text-right">الرصيد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((row: any, i: number) => {
                    const isDebit  = parseFloat(row.debit  || 0) > 0;
                    const balance  = parseFloat(row.running_balance || 0);
                    return (
                      <TableRow key={i} className="hover:bg-pink-50/20">
                        <TableCell className="text-xs">{fmtDate(row.date)}</TableCell>
                        <TableCell className="font-mono text-xs text-primary">{row.entry_number}</TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate">
                          {row.line_desc || row.description}
                          {row.source_type && (
                            <Badge className="text-[9px] mr-1 bg-gray-100 text-gray-600">
                              {SOURCE_AR[row.source_type] || row.source_type}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {isDebit ? (
                            <span className="flex items-center justify-end gap-1 text-orange-700">
                              <ArrowUpRight className="h-3 w-3" />
                              {parseFloat(row.debit).toFixed(3)}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {!isDebit && parseFloat(row.credit || 0) > 0 ? (
                            <span className="flex items-center justify-end gap-1 text-blue-700">
                              <ArrowDownLeft className="h-3 w-3" />
                              {parseFloat(row.credit).toFixed(3)}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums text-xs ${balance >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {fmtOMR(balance)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {/* إجمالي */}
              <div className="flex justify-between items-center px-4 py-3 bg-muted/30 border-t text-sm font-bold">
                <span>الرصيد الختامي</span>
                <span className={`tabular-nums ${parseFloat(ledger[ledger.length - 1]?.running_balance || 0) >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {fmtOMR(ledger[ledger.length - 1]?.running_balance)}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: تفاصيل القيد ───────────────────────────────────────────── */}
      <Dialog open={!!viewEntry} onOpenChange={o => !o && setViewEntry(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" />
              قيد رقم {viewEntry?.entry_number}
            </DialogTitle>
            <DialogDescription>
              {fmtDate(viewEntry?.date)} — {viewEntry?.description}
            </DialogDescription>
          </DialogHeader>

          {entryDetail ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className={entryDetail.status === "posted" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                  {entryDetail.status === "posted" ? "مرحّل" : "مسودة"}
                </Badge>
                {entryDetail.source_type && (
                  <Badge className="bg-gray-100 text-gray-700">
                    {SOURCE_AR[entryDetail.source_type] || entryDetail.source_type}
                  </Badge>
                )}
              </div>

              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-right">الحساب</TableHead>
                    <TableHead className="text-right">البيان</TableHead>
                    <TableHead className="text-right">مدين</TableHead>
                    <TableHead className="text-right">دائن</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entryDetail.lines || []).map((line: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{line.account_code} - {line.account_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{line.description || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-orange-700">
                        {parseFloat(line.debit || 0) > 0 ? parseFloat(line.debit).toFixed(3) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-blue-700">
                        {parseFloat(line.credit || 0) > 0 ? parseFloat(line.credit).toFixed(3) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* إجمالي */}
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell colSpan={2} className="text-right">الإجمالي</TableCell>
                    <TableCell className="text-right tabular-nums text-orange-700">
                      {parseFloat(entryDetail.total_debit || 0).toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-blue-700">
                      {parseFloat(entryDetail.total_credit || 0).toFixed(3)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {entryDetail.status === "draft" && (
                <div className="flex justify-end">
                  <Button onClick={() => { postMutation.mutate(entryDetail.id); setViewEntry(null); }}
                    disabled={postMutation.isPending} className="gap-2">
                    <CheckCircle2 className="h-4 w-4" /> ترحيل القيد
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: إضافة / تعديل حساب ────────────────────────────────────── */}
      <Dialog open={isAddOpen || isEditOpen} onOpenChange={open => {
        if (!open) { setIsAddOpen(false); setIsEditOpen(false); setEditingAccount(null); }
      }}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? "تعديل حساب" : "إضافة حساب جديد"}</DialogTitle>
            <DialogDescription>أدخل بيانات الحساب</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            {[
              { id: "code",   label: "الرمز",      field: "code" },
              { id: "name",   label: "الاسم (ع)",   field: "name" },
              { id: "nameEn", label: "الاسم (EN)",  field: "nameEn" },
            ].map(({ id, label, field }) => (
              <div key={id} className="grid grid-cols-4 items-center gap-3">
                <Label htmlFor={id} className="text-right">{label}</Label>
                <Input id={id} value={(form as any)[field]}
                  onChange={e => setForm({ ...form, [field]: e.target.value })}
                  className="col-span-3" />
              </div>
            ))}
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">النوع</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as AccountType })}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_AR[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label className="text-right">الحساب الأب</Label>
              <Select value={form.parentId ? String(form.parentId) : "none"}
                onValueChange={v => setForm({ ...form, parentId: v === "none" ? "" : parseInt(v) })}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— بدون —</SelectItem>
                  {flatAccounts.filter(a => a.id !== editingAccount?.id).map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-3">
              <Label htmlFor="level" className="text-right">المستوى</Label>
              <Input id="level" type="number" value={form.level}
                onChange={e => setForm({ ...form, level: parseInt(e.target.value) })}
                className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}>إلغاء</Button>
            <Button onClick={() => {
              const data = { ...form, parentId: form.parentId === "" ? null : form.parentId };
              isEditOpen && editingAccount
                ? updateMutation.mutate({ id: editingAccount.id, data })
                : createMutation.mutate(data);
            }} disabled={createMutation.isPending || updateMutation.isPending}>
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
