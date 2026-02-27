import { useState } from "react";
import { Plus, Receipt, Search, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Expense, Branch } from "@shared/schema";

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

export default function Expenses() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ branchId: "", category: "", amount: "", date: new Date().toISOString().split('T')[0], notes: "" });

  const { data: expensesList = [] } = useQuery<Expense[]>({ queryKey: ["/api/expenses"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: branchesList = [] } = useQuery<Branch[]>({ queryKey: ["/api/branches"], queryFn: getQueryFn({ on401: "throw" }) });

  const branchMap = Object.fromEntries(branchesList.map(b => [b.id, b.name]));

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/expenses", {
        ...newExpense,
        branchId: parseInt(newExpense.branchId),
      });
    },
    onSuccess: () => {
      toast({ title: "تمت الإضافة", description: "تم تسجيل المصروف." });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setAddOpen(false);
      setNewExpense({ branchId: "", category: "", amount: "", date: new Date().toISOString().split('T')[0], notes: "" });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-expenses-title">المصروفات</h1>
          <p className="text-muted-foreground mt-1">سجل نفقات الفروع التشغيلية والإدارية.</p>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الفرع</label>
                  <Select value={newExpense.branchId} onValueChange={v => setNewExpense({...newExpense, branchId: v})}>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                    <SelectContent>
                      {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">التاريخ</label>
                  <Input type="date" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">التصنيف</label>
                  <Select value={newExpense.category} onValueChange={v => setNewExpense({...newExpense, category: v})}>
                    <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
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
                <label className="text-sm font-medium">ملاحظات / تفاصيل</label>
                <Input placeholder="اكتب تفاصيل المصروف..." value={newExpense.notes} onChange={e => setNewExpense({...newExpense, notes: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newExpense.branchId || !newExpense.category || !newExpense.amount} data-testid="button-save-expense">
                {createMutation.isPending ? "جارِ الحفظ..." : "حفظ المصروف"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
          <div className="relative w-72">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث في المصروفات..." className="pr-9 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>الفرع</TableHead>
              <TableHead>التصنيف</TableHead>
              <TableHead>المبلغ (OMR)</TableHead>
              <TableHead>الملاحظات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expensesList.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد مصروفات</TableCell></TableRow>
            ) : expensesList.map((exp) => (
              <TableRow key={exp.id}>
                <TableCell>{exp.date}</TableCell>
                <TableCell>{branchMap[exp.branchId] || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-muted">
                    {categoryLabelMap[exp.category] || exp.category}
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
    </div>
  );
}
