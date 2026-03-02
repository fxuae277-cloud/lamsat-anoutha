import { useState } from "react";
import { Plus, Receipt, Search, Wallet, CreditCard, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Expense, Branch, CashLedger, BankLedger } from "@shared/schema";

const EXPENSE_CATEGORIES = [
  { value: "rent", label: "إيجار" },
  { value: "electricity", label: "كهرباء" },
  { value: "water", label: "ماء" },
  { value: "phone", label: "هواتف" },
  { value: "salary", label: "رواتب" },
  { value: "misc", label: "نثريات" },
  { value: "cleaning", label: "منظفات" },
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
};

export default function Expenses() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: "", amount: "", source: "cash", notes: "" });

  const { data: expensesList = [] } = useQuery<Expense[]>({ queryKey: ["/api/expenses"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: branchesList = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: cashLedgerList = [] } = useQuery<CashLedger[]>({ queryKey: ["/api/ledger/cash"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: bankLedgerList = [] } = useQuery<BankLedger[]>({ queryKey: ["/api/ledger/bank"], queryFn: getQueryFn({ on401: "throw" }) });

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
      toast({ title: "تمت الإضافة", description: "تم تسجيل المصروف." });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger/cash"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ledger/bank"] });
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
    return cat.includes(search) || (exp.notes || "").includes(search);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-expenses-title">المصروفات والحركات المالية</h1>
          <p className="text-muted-foreground mt-1">سجل نفقات الفروع وسجل الحركات النقدية والبنكية.</p>
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
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="p-3 bg-muted/50 rounded-lg border text-sm">
                <span className="text-muted-foreground">الفرع: </span>
                <span className="font-medium">{userBranchName}</span>
                <span className="text-muted-foreground mr-4">  |  يُسجّل تلقائياً على الشفت المفتوح</span>
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
                <label className="text-sm font-medium">ملاحظات / تفاصيل</label>
                <Input placeholder="اكتب تفاصيل المصروف..." value={newExpense.notes} onChange={e => setNewExpense({...newExpense, notes: e.target.value})} data-testid="input-expense-notes" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newExpense.category || !newExpense.amount} data-testid="button-save-expense">
                {createMutation.isPending ? "جارِ الحفظ..." : "حفظ المصروف"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
            <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
              <div className="relative w-72">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث في المصروفات..." className="pr-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-expenses" />
              </div>
            </div>

            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>التصنيف</TableHead>
                  <TableHead>المصدر</TableHead>
                  <TableHead>المبلغ (OMR)</TableHead>
                  <TableHead>الملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد مصروفات</TableCell></TableRow>
                ) : filteredExpenses.map((exp) => (
                  <TableRow key={exp.id} data-testid={`row-expense-${exp.id}`}>
                    <TableCell>{exp.date}</TableCell>
                    <TableCell>{branchMap[exp.branchId] || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted">
                        {categoryLabelMap[exp.category] || exp.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={exp.source === "cash" ? "default" : "secondary"}>
                        {SOURCE_LABELS[exp.source] || exp.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-red-600">{parseFloat(exp.amount).toFixed(3)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate" title={exp.notes || ""}>
                      {exp.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="cash_ledger">
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>وارد (OMR)</TableHead>
                  <TableHead>صادر (OMR)</TableHead>
                  <TableHead>الملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashLedgerList.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد حركات نقدية</TableCell></TableRow>
                ) : cashLedgerList.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-cash-ledger-${entry.id}`}>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>{branchMap[entry.branchId] || "-"}</TableCell>
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
                    <TableCell className="text-muted-foreground max-w-[200px] truncate" title={entry.note || ""}>
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
                  <TableHead>الطريقة</TableHead>
                  <TableHead>وارد (OMR)</TableHead>
                  <TableHead>صادر (OMR)</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>الملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankLedgerList.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد حركات بنكية</TableCell></TableRow>
                ) : bankLedgerList.map((entry) => (
                  <TableRow key={entry.id} data-testid={`row-bank-ledger-${entry.id}`}>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>{branchMap[entry.branchId] || "-"}</TableCell>
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
                    <TableCell className="text-muted-foreground">{entry.refId || "-"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate" title={entry.note || ""}>
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
