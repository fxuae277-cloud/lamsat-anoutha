import { useState } from "react";
import { Plus, Receipt, Search, Wallet, CreditCard, Building2, Calendar, UserCheck, Hash, TrendingDown, Banknote, PieChart, Edit2, Trash2, Printer, Copy, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Card, CardContent } from "@/components/ui/card";
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
import type { Branch, CashLedger, BankLedger } from "@shared/schema";
import { fmtDate } from "@/lib/formatters";

export default function Expenses() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { data } = useAuth();
  const user = data?.user;
  const isOwnerAdmin = user?.role === "owner" || user?.role === "admin";

  const EXPENSE_CATEGORIES = [
    { value: "supplies",      label: "مستلزمات (تنظيف وتغليف وأكياس)" },
    { value: "rent",          label: "إيجار (إيجار المتجر الشهري)" },
    { value: "salary",        label: "رواتب (رواتب الموظفين)" },
    { value: "transport",     label: "مواصلات (توصيل وبنزين)" },
    { value: "maintenance",   label: "صيانة (مكيفات وإضاءة)" },
    { value: "electricity",   label: "كهرباء ومياه (فواتير شهرية)" },
    { value: "phone",         label: "اتصالات (إنترنت وهاتف)" },
    { value: "marketing",     label: "تسويق (إعلانات وتصميم)" },
    { value: "shipping",      label: "شحن (شحن بضائع)" },
    { value: "taxes",         label: "ضرائب ورسوم (رسوم حكومية)" },
    { value: "other",         label: "أخرى (مصروف غير مصنف)" },
  ];

  const categoryLabelMap = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.value, c.label.split(" (")[0]]));
  const categoryLabelFull = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.value, c.label]));

  const SOURCE_LABELS: Record<string, string> = {
    cash: "نقدي (من الصندوق)",
    card: "بطاقة",
    bank_transfer: "تحويل بنكي",
  };

  const TYPE_LABELS: Record<string, string> = {
    sale: t("finance_page.types.sale"),
    expense: t("finance_page.types.expense"),
    order_payment: t("finance_page.types.order"),
    shift_difference: t("finance_page.types.shift_difference"),
    deposit: t("finance_page.types.deposit"),
    withdrawal: t("finance_page.types.withdrawal"),
  };

  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function startOfMonthStr() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }
  function fmt(v: string | number | null | undefined) {
    return parseFloat(String(v || "0")).toFixed(3);
  }

  const emptyForm = { category: "", amount: "", source: "cash", notes: "", date: todayStr() };
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [newExpense, setNewExpense] = useState(emptyForm);
  const [editExpense, setEditExpense] = useState(emptyForm);
  const [fromDate, setFromDate] = useState(startOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSource, setFilterSource] = useState("all");

  const queryBranchId = isOwnerAdmin && filterBranch !== "all" ? `&branchId=${filterBranch}` : "";
  const expensesQuery = `/api/expenses?from=${fromDate}&to=${toDate}${queryBranchId}`;
  const summaryQuery = `/api/expenses/summary?from=${fromDate}&to=${toDate}${queryBranchId}`;

  const { data: expensesList = [] } = useQuery<any[]>({ queryKey: [expensesQuery], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: summary } = useQuery<any>({ queryKey: [summaryQuery], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: branchesList = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: cashLedgerList = [] } = useQuery<CashLedger[]>({ queryKey: ["/api/ledger/cash"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: bankLedgerList = [] } = useQuery<BankLedger[]>({ queryKey: ["/api/ledger/bank"], queryFn: getQueryFn({ on401: "throw" }) });

  const branchMap = Object.fromEntries(branchesList.map(b => [b.id, b.address ? `${b.name} - ${b.address}` : b.name]));
  const userBranchName = user?.branchId ? branchMap[user.branchId] : "—";

  function invalidateExpenses() {
    queryClient.invalidateQueries({ queryKey: [expensesQuery] });
    queryClient.invalidateQueries({ queryKey: [summaryQuery] });
    queryClient.invalidateQueries({ queryKey: ["/api/ledger/cash"] });
    queryClient.invalidateQueries({ queryKey: ["/api/ledger/bank"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/expenses", {
        amount: newExpense.amount,
        source: newExpense.source,
        category: newExpense.category,
        notes: newExpense.notes || null,
        date: newExpense.date,
      });
    },
    onSuccess: () => {
      toast({ title: "تم إضافة المصروف", description: "تم تسجيل المصروف وربطه بالفرع والشفت." });
      invalidateExpenses();
      setAddOpen(false);
      setNewExpense(emptyForm);
    },
    onError: (err: Error) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/expenses/${editingExpense?.id}`, {
        amount: editExpense.amount,
        source: editExpense.source,
        category: editExpense.category,
        notes: editExpense.notes || null,
        date: editExpense.date,
      });
    },
    onSuccess: () => {
      toast({ title: "تم تحديث المصروف" });
      invalidateExpenses();
      setEditOpen(false);
      setEditingExpense(null);
    },
    onError: (err: Error) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      toast({ title: "تم حذف المصروف" });
      invalidateExpenses();
      setDeleteConfirmId(null);
    },
    onError: (err: Error) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  function openEdit(exp: any) {
    setEditingExpense(exp);
    setEditExpense({
      category: exp.category || "",
      amount: parseFloat(exp.amount || "0").toFixed(3),
      source: exp.source || "cash",
      notes: exp.notes || "",
      date: exp.date || todayStr(),
    });
    setEditOpen(true);
  }

  function printReceipt(exp: any) {
    const w = window.open("", "_blank", "width=400,height=500");
    if (!w) return;
    const cat = categoryLabelMap[exp.category] || exp.category;
    const src = SOURCE_LABELS[exp.source] || exp.source;
    w.document.write(`
      <html dir="rtl"><head><title>إيصال مصروف</title>
      <style>body{font-family:Cairo,sans-serif;font-size:14px;padding:20px;} h2{color:#E91E63;} table{width:100%;border-collapse:collapse;margin-top:10px;} td{padding:6px 8px;border-bottom:1px solid #eee;} .amount{font-size:20px;font-weight:bold;color:#E91E63;} .footer{text-align:center;color:#aaa;font-size:11px;margin-top:20px;}</style>
      </head><body>
      <h2>لمسة أنوثة — إيصال مصروف</h2>
      <table>
        <tr><td>رقم المصروف</td><td><b>#${exp.id}</b></td></tr>
        <tr><td>التاريخ</td><td>${fmtDate(exp.date)}</td></tr>
        <tr><td>الفرع</td><td>${exp.branchName || branchMap[exp.branchId] || "-"}</td></tr>
        <tr><td>الموظف</td><td>${exp.createdByName || "-"}</td></tr>
        <tr><td>التصنيف</td><td>${cat}</td></tr>
        <tr><td>طريقة الدفع</td><td>${src}</td></tr>
        <tr><td>الملاحظات</td><td>${exp.notes || "-"}</td></tr>
        <tr><td>المبلغ</td><td class="amount">${parseFloat(exp.amount || "0").toFixed(3)} ر.ع</td></tr>
      </table>
      <p class="footer">طُبع بتاريخ ${new Date().toLocaleDateString("en-GB")} — لمسة أنوثة للإكسسوارات</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  function copyExpense(exp: any) {
    setNewExpense({
      category: exp.category || "",
      amount: parseFloat(exp.amount || "0").toFixed(3),
      source: exp.source || "cash",
      notes: exp.notes || "",
      date: todayStr(),
    });
    setAddOpen(true);
  }

  function clearFilters() {
    setSearch("");
    setFromDate(startOfMonthStr());
    setToDate(todayStr());
    setFilterBranch("all");
    setFilterCategory("all");
    setFilterSource("all");
  }

  const filteredExpenses = expensesList.filter(exp => {
    const cat = categoryLabelMap[exp.category] || exp.category;
    if (search && !cat.includes(search) && !(exp.notes || "").includes(search) && !(exp.createdByName || "").includes(search)) return false;
    if (filterCategory !== "all" && exp.category !== filterCategory) return false;
    if (filterSource !== "all" && exp.source !== filterSource) return false;
    return true;
  });

  const expenseFormContent = (values: typeof emptyForm, setValues: (v: typeof emptyForm) => void) => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Building2 className="w-3.5 h-3.5" />
            <span className="text-xs">الفرع</span>
          </div>
          <span className="font-bold text-sm">{userBranchName}</span>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <UserCheck className="w-3.5 h-3.5" />
            <span className="text-xs">الموظف</span>
          </div>
          <span className="font-bold text-sm">{user?.name || "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">التصنيف *</label>
          <Select value={values.category} onValueChange={v => setValues({ ...values, category: v })}>
            <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">المبلغ (ر.ع) *</label>
          <Input type="number" step="0.001" placeholder="0.000" value={values.amount}
            onChange={e => setValues({ ...values, amount: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">التاريخ</label>
          <DateInput value={values.date}
            onChange={e => setValues({ ...values, date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">طريقة الدفع</label>
          <Select value={values.source} onValueChange={v => setValues({ ...values, source: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">💵 نقدي (يخصم من الصندوق)</SelectItem>
              <SelectItem value="bank_transfer">🏦 تحويل بنكي (يخصم من البنك)</SelectItem>
              <SelectItem value="card">💳 بطاقة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">الملاحظات</label>
        <Input placeholder="وصف المصروف أو تفاصيل إضافية..." value={values.notes}
          onChange={e => setValues({ ...values, notes: e.target.value })} />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        💡 المصروف النقدي يُخصم تلقائياً من الصندوق | المصروف بالتحويل يُخصم من الحساب البنكي
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-expenses-title">{t("expenses_page.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("expenses_page.subtitle")}</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-rose-600 hover:bg-rose-700 text-white" data-testid="button-add-expense">
              <Plus className="w-4 h-4" />
              {t("expenses_page.add_expense")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>إضافة مصروف جديد</DialogTitle>
              <DialogDescription>سيتم ربط المصروف تلقائياً بالشفت المفتوح حالياً إن وجد</DialogDescription>
            </DialogHeader>
            {expenseFormContent(newExpense, setNewExpense)}
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newExpense.category || !newExpense.amount}
                className="gap-2 bg-rose-600 hover:bg-rose-700 text-white"
                data-testid="button-save-expense">
                {createMutation.isPending ? "جارٍ الحفظ..." : <><Receipt className="w-4 h-4" />حفظ المصروف</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("expenses_page.summary_total")}</p>
                  <p className="text-2xl font-bold text-red-600 mt-1" data-testid="text-expenses-total">
                    {fmt(summary.total)} <span className="text-sm font-normal">ر.ع</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{summary.totalCount} عملية</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">مصروفات نقدية</p>
                  <p className="text-xl font-bold mt-1">{fmt(summary.cash?.total)} <span className="text-sm font-normal">ر.ع</span></p>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{summary.cash?.count || 0} عملية</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">مصروفات التحويل</p>
                  <p className="text-xl font-bold mt-1">
                    {fmt(parseFloat(summary.card?.total || "0") + parseFloat(summary.bank?.total || "0"))} <span className="text-sm font-normal">ر.ع</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{(summary.card?.count || 0) + (summary.bank?.count || 0)} عملية</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">أعلى تصنيف مصروف</p>
                  {summary.byCategory && summary.byCategory.length > 0 ? (
                    <>
                      <p className="text-sm font-bold mt-1">{categoryLabelMap[summary.byCategory[0].category] || summary.byCategory[0].category}</p>
                      <p className="text-xs text-red-600 font-medium">{fmt(summary.byCategory[0].total)} ر.ع</p>
                    </>
                  ) : <p className="text-sm text-muted-foreground mt-1">—</p>}
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <PieChart className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="expenses" dir={lang === "ar" ? "rtl" : "ltr"}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="expenses" className="gap-1">
            <Receipt className="w-4 h-4" />{t("expenses_page.tab_expenses")}
          </TabsTrigger>
          <TabsTrigger value="cash_ledger" className="gap-1">
            <Wallet className="w-4 h-4" />{t("expenses_page.tab_cash_ledger")}
          </TabsTrigger>
          <TabsTrigger value="bank_ledger" className="gap-1">
            <CreditCard className="w-4 h-4" />{t("expenses_page.tab_bank_ledger")}
          </TabsTrigger>
        </TabsList>

        {/* ===== Expenses Tab ===== */}
        <TabsContent value="expenses">
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            {/* Filters */}
            <div className="p-4 border-b flex flex-wrap items-center gap-3 bg-muted/20">
              {/* Search */}
              <div className="relative w-52">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث..." className="pr-9 bg-background" value={search}
                  onChange={e => setSearch(e.target.value)} data-testid="input-search-expenses" />
              </div>
              {/* Date range */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <DateInput value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="w-36 bg-background" data-testid="input-filter-from" />
                <span className="text-muted-foreground text-sm">—</span>
                <DateInput value={toDate} onChange={e => setToDate(e.target.value)}
                  className="w-36 bg-background" data-testid="input-filter-to" />
              </div>
              {/* Branch filter */}
              {isOwnerAdmin && (
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="w-44 bg-background" data-testid="select-filter-branch">
                    <SelectValue placeholder="كل الفروع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {/* Category filter */}
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-44 bg-background">
                  <Filter className="w-3.5 h-3.5 ml-1" /><SelectValue placeholder="كل التصنيفات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل التصنيفات</SelectItem>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label.split(" (")[0]}</SelectItem>)}
                </SelectContent>
              </Select>
              {/* Source filter */}
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-40 bg-background">
                  <SelectValue placeholder="كل المصادر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المصادر</SelectItem>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                </SelectContent>
              </Select>
              {/* Clear filters */}
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />مسح الفلاتر
              </Button>
            </div>

            {/* Table */}
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[90px]">التاريخ</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>الشفت</TableHead>
                  <TableHead>الموظف</TableHead>
                  <TableHead>التصنيف</TableHead>
                  <TableHead>المصدر</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الملاحظات</TableHead>
                  <TableHead className="w-[130px] text-center">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      <Receipt className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p>لا توجد مصروفات مطابقة للفلاتر المحددة</p>
                    </TableCell>
                  </TableRow>
                ) : filteredExpenses.map((exp: any) => (
                  <TableRow key={exp.id} className="hover:bg-rose-50/30 transition-colors" data-testid={`row-expense-${exp.id}`}>
                    <TableCell className="text-xs font-mono">{exp.date ? fmtDate(exp.date) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-primary/5 text-xs">
                        {exp.branchName || branchMap[exp.branchId] || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {exp.shiftId ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Hash className="w-3 h-3" />{exp.shiftId}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell><span className="text-sm font-medium">{exp.createdByName || "—"}</span></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted text-xs">
                        {categoryLabelMap[exp.category] || exp.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={exp.source === "cash" ? "default" : "secondary"} className="text-xs">
                        {exp.source === "cash" ? "نقدي" : exp.source === "bank_transfer" ? "تحويل" : "بطاقة"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-red-600">{parseFloat(exp.amount).toFixed(3)} <span className="text-xs font-normal text-muted-foreground">ر.ع</span></TableCell>
                    <TableCell className="text-muted-foreground max-w-[180px] truncate text-xs" title={exp.notes || ""}>
                      {exp.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {/* Edit */}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                          title="تعديل" onClick={() => openEdit(exp)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        {/* Print */}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-50"
                          title="طباعة إيصال" onClick={() => printReceipt(exp)}>
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        {/* Copy */}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:bg-amber-50"
                          title="نسخ (إنشاء مشابه)" onClick={() => copyExpense(exp)}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        {/* Delete */}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-50"
                          title="حذف" onClick={() => setDeleteConfirmId(exp.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredExpenses.length > 0 && (
              <div className="p-3 border-t bg-muted/30 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{filteredExpenses.length} مصروف</span>
                <span className="font-bold text-red-600">
                  الإجمالي: {filteredExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount || "0"), 0).toFixed(3)} ر.ع
                </span>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== Cash Ledger Tab ===== */}
        <TabsContent value="cash_ledger">
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>الشفت</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>وارد</TableHead>
                  <TableHead>صادر</TableHead>
                  <TableHead>الملاحظة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashLedgerList.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("expenses_page.no_cash_entries")}</TableCell></TableRow>
                ) : cashLedgerList.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-cash-ledger-${entry.id}`}>
                    <TableCell className="text-xs">{entry.date ? fmtDate(entry.date) : "—"}</TableCell>
                    <TableCell>{branchMap[entry.branchId] || "-"}</TableCell>
                    <TableCell>
                      {entry.shiftId ? <Badge variant="secondary" className="text-xs gap-1"><Hash className="w-3 h-3" />{entry.shiftId}</Badge> : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        entry.type === "sale" || entry.type === "order_payment" ? "bg-green-50 text-green-700 border-green-200" :
                        entry.type === "expense" ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-yellow-50 text-yellow-700 border-yellow-200"
                      }>
                        {TYPE_LABELS[entry.type] || entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {parseFloat(entry.amountIn || "0") > 0 ? `+${parseFloat(entry.amountIn!).toFixed(3)}` : "-"}
                    </TableCell>
                    <TableCell className="font-medium text-red-600">
                      {parseFloat(entry.amountOut || "0") > 0 ? `-${parseFloat(entry.amountOut!).toFixed(3)}` : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate text-xs" title={entry.note || ""}>
                      {entry.note || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ===== Bank Ledger Tab ===== */}
        <TabsContent value="bank_ledger">
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <div className="p-6 text-center bg-muted/10 border-b">
              <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <h3 className="text-base font-bold">{t("expenses_page.bank_readonly_note")}</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">{t("expenses_page.bank_readonly_desc")}</p>
            </div>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>الشفت</TableHead>
                  <TableHead>الطريقة</TableHead>
                  <TableHead>وارد</TableHead>
                  <TableHead>صادر</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>الملاحظة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankLedgerList.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("expenses_page.no_bank_entries")}</TableCell></TableRow>
                ) : bankLedgerList.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-bank-ledger-${entry.id}`}>
                    <TableCell className="text-xs">{entry.date ? fmtDate(entry.date) : "—"}</TableCell>
                    <TableCell>{branchMap[entry.branchId] || "-"}</TableCell>
                    <TableCell>
                      {entry.shiftId ? <Badge variant="secondary" className="text-xs gap-1"><Hash className="w-3 h-3" />{entry.shiftId}</Badge> : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {entry.method === "card" ? "بطاقة" : "تحويل بنكي"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {parseFloat(entry.amountIn || "0") > 0 ? `+${parseFloat(entry.amountIn!).toFixed(3)}` : "-"}
                    </TableCell>
                    <TableCell className="font-medium text-red-600">
                      {parseFloat(entry.amountOut || "0") > 0 ? `-${parseFloat(entry.amountOut!).toFixed(3)}` : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{entry.refId || "-"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate text-xs" title={entry.note || ""}>
                      {entry.note || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={v => { setEditOpen(v); if (!v) setEditingExpense(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>تعديل المصروف #{editingExpense?.id}</DialogTitle>
            <DialogDescription>تعديل بيانات المصروف</DialogDescription>
          </DialogHeader>
          {expenseFormContent(editExpense, setEditExpense)}
          <DialogFooter>
            <Button onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !editExpense.category || !editExpense.amount}
              className="gap-2">
              {updateMutation.isPending ? "جارٍ الحفظ..." : <><Edit2 className="w-4 h-4" />حفظ التعديلات</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={v => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف المصروف #{deleteConfirmId}؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}>
              <Trash2 className="w-4 h-4 ml-1" />
              {deleteMutation.isPending ? "جارٍ الحذف..." : "حذف نهائياً"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
