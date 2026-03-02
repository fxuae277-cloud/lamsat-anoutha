import { useState } from "react";
import { Plus, Receipt, Search, Wallet, CreditCard, Building2, Calendar, UserCheck, Hash, TrendingDown, Banknote, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Branch, CashLedger, BankLedger } from "@shared/schema";

const EXPENSE_CATEGORIES = [
  { value: "rent", label: "إيجار" },
  { value: "electricity", label: "كهرباء" },
  { value: "water", label: "ماء" },
  { value: "phone", label: "هواتف" },
  { value: "salary", label: "رواتب" },
  { value: "misc", label: "نثريات" },
  { value: "cleaning", label: "منظفات" },
  { value: "transport", label: "مواصلات" },
  { value: "maintenance", label: "صيانة" },
  { value: "supplies", label: "مستلزمات" },
  { value: "other", label: "أخرى" },
];

const categoryLabelMap = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.value, c.label]));

const SOURCE_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  bank_transfer: "تحويل بنكي",
};

const TYPE_LABELS: Record<string, string> = {
  sale: "بيع",
  expense: "مصروف",
  order_payment: "دفع طلب",
  shift_difference: "فرق شفت",
  deposit: "إيداع",
  withdrawal: "سحب",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(v: string | number | null | undefined) {
  return parseFloat(String(v || "0")).toFixed(3);
}

export default function Expenses() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isOwnerAdmin = user?.role === "owner" || user?.role === "admin";

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: "", amount: "", source: "cash", notes: "" });
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterBranch, setFilterBranch] = useState("all");

  const queryBranchId = isOwnerAdmin && filterBranch !== "all" ? `&branchId=${filterBranch}` : "";
  const expensesQuery = `/api/expenses?date=${filterDate}${queryBranchId}`;
  const summaryQuery = `/api/expenses/summary?date=${filterDate}${queryBranchId}`;
  const cashLedgerQuery = `/api/ledger/cash`;
  const bankLedgerQuery = `/api/ledger/bank`;

  const { data: expensesList = [] } = useQuery<any[]>({ queryKey: [expensesQuery], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: summary } = useQuery<any>({ queryKey: [summaryQuery], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: branchesList = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: cashLedgerList = [] } = useQuery<CashLedger[]>({ queryKey: [cashLedgerQuery], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: bankLedgerList = [] } = useQuery<BankLedger[]>({ queryKey: [bankLedgerQuery], queryFn: getQueryFn({ on401: "throw" }) });

  const branchMap = Object.fromEntries(branchesList.map(b => [b.id, b.name]));
  const userBranchName = user?.branchId ? branchMap[user.branchId] : "—";

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/expenses", {
        amount: newExpense.amount,
        source: newExpense.source,
        category: newExpense.category,
        notes: newExpense.notes || null,
      });
    },
    onSuccess: () => {
      toast({ title: "تمت الإضافة", description: "تم تسجيل المصروف وربطه بالفرع والشفت." });
      queryClient.invalidateQueries({ queryKey: [expensesQuery] });
      queryClient.invalidateQueries({ queryKey: [summaryQuery] });
      queryClient.invalidateQueries({ queryKey: [cashLedgerQuery] });
      queryClient.invalidateQueries({ queryKey: [bankLedgerQuery] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setAddOpen(false);
      setNewExpense({ category: "", amount: "", source: "cash", notes: "" });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const filteredExpenses = expensesList.filter(exp => {
    if (!search) return true;
    const cat = categoryLabelMap[exp.category] || exp.category;
    return cat.includes(search) || (exp.notes || "").includes(search) || (exp.createdByName || "").includes(search);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-expenses-title">المصروفات</h1>
          <p className="text-muted-foreground mt-1">إدارة مصروفات الفروع مع الربط التلقائي بالشفت والفرع</p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-rose-600 hover:bg-rose-700 text-white" data-testid="button-add-expense">
              <Plus className="w-4 h-4" />
              إضافة مصروف
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>تسجيل مصروف جديد</DialogTitle>
              <DialogDescription>يُسجّل المصروف تلقائياً على الفرع والشفت المفتوح ويدخل في التقارير والدفاتر</DialogDescription>
            </DialogHeader>
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
                  <label className="text-sm font-medium">التصنيف</label>
                  <Select value={newExpense.category} onValueChange={v => setNewExpense({...newExpense, category: v})}>
                    <SelectTrigger data-testid="select-expense-category"><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">المبلغ (OMR)</label>
                  <Input type="number" step="0.001" placeholder="0.000" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} data-testid="input-expense-amount" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">مصدر الدفع</label>
                <Select value={newExpense.source} onValueChange={v => setNewExpense({...newExpense, source: v})}>
                  <SelectTrigger data-testid="select-expense-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي (من الصندوق)</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">ملاحظات / سبب المصروف</label>
                <Input placeholder="مثال: شراء مستلزمات تنظيف..." value={newExpense.notes} onChange={e => setNewExpense({...newExpense, notes: e.target.value})} data-testid="input-expense-notes" />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>ملاحظة:</strong> سيتم ربط المصروف تلقائياً بالشفت المفتوح حالياً (إن وجد) ويظهر في تقرير اليوم والدفاتر المالية.
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newExpense.category || !newExpense.amount} className="gap-2" data-testid="button-save-expense">
                {createMutation.isPending ? "جارِ الحفظ..." : (
                  <>
                    <Receipt className="w-4 h-4" />
                    حفظ المصروف
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي المصروفات</p>
                  <p className="text-2xl font-bold text-red-600 mt-1" data-testid="text-expenses-total">{fmt(summary.total)} <span className="text-sm font-normal">ر.ع</span></p>
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
                  <p className="text-xs text-muted-foreground">بطاقة + تحويل</p>
                  <p className="text-xl font-bold mt-1">{fmt(parseFloat(summary.card?.total || "0") + parseFloat(summary.bank?.total || "0"))} <span className="text-sm font-normal">ر.ع</span></p>
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
                  <p className="text-xs text-muted-foreground">أعلى تصنيف</p>
                  {summary.byCategory && summary.byCategory.length > 0 ? (
                    <>
                      <p className="text-sm font-bold mt-1">{categoryLabelMap[summary.byCategory[0].category] || summary.byCategory[0].category}</p>
                      <p className="text-xs text-red-600 font-medium">{fmt(summary.byCategory[0].total)} ر.ع</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">—</p>
                  )}
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <PieChart className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="expenses" dir="rtl">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="expenses" className="gap-1">
            <Receipt className="w-4 h-4" />
            المصروفات
          </TabsTrigger>
          <TabsTrigger value="cash_ledger" className="gap-1">
            <Wallet className="w-4 h-4" />
            سجل النقدي
          </TabsTrigger>
          <TabsTrigger value="bank_ledger" className="gap-1">
            <CreditCard className="w-4 h-4" />
            سجل البنك
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <div className="p-4 border-b flex flex-wrap items-center gap-3 bg-muted/20">
              <div className="relative w-60">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث..." className="pr-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-expenses" />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-44 bg-background" data-testid="input-filter-date" />
              </div>
              {isOwnerAdmin && (
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="w-48 bg-background" data-testid="select-filter-branch">
                    <SelectValue placeholder="كل الفروع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفروع</SelectItem>
                    {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[90px]">التاريخ</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>الشفت</TableHead>
                  <TableHead>الموظف</TableHead>
                  <TableHead>التصنيف</TableHead>
                  <TableHead>المصدر</TableHead>
                  <TableHead>المبلغ (OMR)</TableHead>
                  <TableHead>الملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد مصروفات في هذا التاريخ</TableCell></TableRow>
                ) : filteredExpenses.map((exp: any) => (
                  <TableRow key={exp.id} data-testid={`row-expense-${exp.id}`}>
                    <TableCell className="text-xs">{exp.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-primary/5 text-xs">
                        {exp.branchName || branchMap[exp.branchId] || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {exp.shiftId ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Hash className="w-3 h-3" />
                          {exp.shiftId}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{exp.createdByName || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted">
                        {categoryLabelMap[exp.category] || exp.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={exp.source === "cash" ? "default" : "secondary"} className="text-xs">
                        {SOURCE_LABELS[exp.source] || exp.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-red-600">{parseFloat(exp.amount).toFixed(3)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate text-xs" title={exp.notes || ""}>
                      {exp.notes || "-"}
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

        <TabsContent value="cash_ledger">
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>الشفت</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>وارد (OMR)</TableHead>
                  <TableHead>صادر (OMR)</TableHead>
                  <TableHead>الملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashLedgerList.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد حركات نقدية</TableCell></TableRow>
                ) : cashLedgerList.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-cash-ledger-${entry.id}`}>
                    <TableCell className="text-xs">{entry.date}</TableCell>
                    <TableCell>{branchMap[entry.branchId] || "-"}</TableCell>
                    <TableCell>
                      {entry.shiftId ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Hash className="w-3 h-3" />
                          {entry.shiftId}
                        </Badge>
                      ) : "—"}
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

        <TabsContent value="bank_ledger">
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>الشفت</TableHead>
                  <TableHead>الطريقة</TableHead>
                  <TableHead>وارد (OMR)</TableHead>
                  <TableHead>صادر (OMR)</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>الملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankLedgerList.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد حركات بنكية</TableCell></TableRow>
                ) : bankLedgerList.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-bank-ledger-${entry.id}`}>
                    <TableCell className="text-xs">{entry.date}</TableCell>
                    <TableCell>{branchMap[entry.branchId] || "-"}</TableCell>
                    <TableCell>
                      {entry.shiftId ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Hash className="w-3 h-3" />
                          {entry.shiftId}
                        </Badge>
                      ) : "—"}
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
    </div>
  );
}
