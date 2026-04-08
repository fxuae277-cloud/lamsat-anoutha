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
    { value: "rent", label: t("expenses_page.categories.rent") },
    { value: "electricity", label: t("expenses_page.categories.electricity") },
    { value: "water", label: t("expenses_page.categories.water") },
    { value: "phone", label: t("expenses_page.categories.phone") },
    { value: "salary", label: t("expenses_page.categories.salary") },
    { value: "misc", label: t("expenses_page.categories.misc") },
    { value: "cleaning", label: t("expenses_page.categories.cleaning") },
    { value: "transport", label: t("expenses_page.categories.transport") },
    { value: "maintenance", label: t("expenses_page.categories.maintenance") },
    { value: "supplies", label: t("expenses_page.categories.supplies") },
    { value: "other", label: t("expenses_page.categories.other") },
  ];

  const categoryLabelMap = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.value, c.label]));

  const SOURCE_LABELS: Record<string, string> = {
    cash: t("payment_methods.cash"),
    card: t("payment_methods.card"),
    bank_transfer: t("payment_methods.bank_transfer"),
  };

  const TYPE_LABELS: Record<string, string> = {
    sale: t("finance_page.types.sale"),
    expense: t("finance_page.types.expense"),
    order_payment: t("finance_page.types.order"),
    shift_difference: t("finance_page.types.shift_difference"),
    deposit: t("finance_page.types.deposit"),
    withdrawal: t("finance_page.types.withdrawal"),
  };

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  function startOfMonthStr() {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }

  function fmt(v: string | number | null | undefined) {
    return parseFloat(String(v || "0")).toFixed(3);
  }

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: "", amount: "", source: "cash", notes: "" });
  const [fromDate, setFromDate] = useState(startOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [filterBranch, setFilterBranch] = useState("all");

  const queryBranchId = isOwnerAdmin && filterBranch !== "all" ? `&branchId=${filterBranch}` : "";
  const expensesQuery = `/api/expenses?from=${fromDate}&to=${toDate}${queryBranchId}`;
  const summaryQuery = `/api/expenses/summary?from=${fromDate}&to=${toDate}${queryBranchId}`;
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
      toast({ title: t("expenses_page.success_added"), description: t("expenses_page.success_added_desc") });
      queryClient.invalidateQueries({ queryKey: [expensesQuery] });
      queryClient.invalidateQueries({ queryKey: [summaryQuery] });
      queryClient.invalidateQueries({ queryKey: [cashLedgerQuery] });
      queryClient.invalidateQueries({ queryKey: [bankLedgerQuery] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setAddOpen(false);
      setNewExpense({ category: "", amount: "", source: "cash", notes: "" });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
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
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t("expenses_page.dialog_title")}</DialogTitle>
              <DialogDescription>{t("expenses_page.dialog_desc")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="text-xs">{t("expenses_page.branch_label")}</span>
                  </div>
                  <span className="font-bold text-sm">{userBranchName}</span>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span className="text-xs">{t("expenses_page.employee_label")}</span>
                  </div>
                  <span className="font-bold text-sm">{user?.name || "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("expenses_page.category_label")}</label>
                  <Select value={newExpense.category} onValueChange={v => setNewExpense({...newExpense, category: v})}>
                    <SelectTrigger data-testid="select-expense-category"><SelectValue placeholder={t("expenses_page.select_category")} /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("expenses_page.amount_label")}</label>
                  <Input type="number" step="0.001" placeholder="0.000" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} data-testid="input-expense-amount" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("expenses_page.payment_source")}</label>
                <Select value={newExpense.source} onValueChange={v => setNewExpense({...newExpense, source: v})}>
                  <SelectTrigger data-testid="select-expense-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("payment_methods.cash_drawer")}</SelectItem>
                    <SelectItem value="card">{t("payment_methods.card")}</SelectItem>
                    <SelectItem value="bank_transfer">{t("payment_methods.bank_transfer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("expenses_page.notes_label")}</label>
                <Input placeholder={t("expenses_page.notes_placeholder")} value={newExpense.notes} onChange={e => setNewExpense({...newExpense, notes: e.target.value})} data-testid="input-expense-notes" />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                {t("expenses_page.automatic_link_note")}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newExpense.category || !newExpense.amount} className="gap-2" data-testid="button-save-expense">
                {createMutation.isPending ? t("expenses_page.saving") : (
                  <>
                    <Receipt className="w-4 h-4" />
                    {t("expenses_page.save_btn")}
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
                  <p className="text-xs text-muted-foreground">{t("expenses_page.summary_total")}</p>
                  <p className="text-2xl font-bold text-red-600 mt-1" data-testid="text-expenses-total">{fmt(summary.total)} <span className="text-sm font-normal">{t("common.omr")}</span></p>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{summary.totalCount} {t("common.transactions")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("expenses_page.summary_cash")}</p>
                  <p className="text-xl font-bold mt-1">{fmt(summary.cash?.total)} <span className="text-sm font-normal">{t("common.omr")}</span></p>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{summary.cash?.count || 0} {t("common.transactions")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("expenses_page.summary_card_bank")}</p>
                  <p className="text-xl font-bold mt-1">{fmt(parseFloat(summary.card?.total || "0") + parseFloat(summary.bank?.total || "0"))} <span className="text-sm font-normal">{t("common.omr")}</span></p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{(summary.card?.count || 0) + (summary.bank?.count || 0)} {t("common.transactions")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("expenses_page.summary_top_cat")}</p>
                  {summary.byCategory && summary.byCategory.length > 0 ? (
                    <>
                      <p className="text-sm font-bold mt-1">{categoryLabelMap[summary.byCategory[0].category] || summary.byCategory[0].category}</p>
                      <p className="text-xs text-red-600 font-medium">{fmt(summary.byCategory[0].total)} {t("common.omr")}</p>
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

      <Tabs defaultValue="expenses" dir={lang === "ar" ? "rtl" : "ltr"}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="expenses" className="gap-1">
            <Receipt className="w-4 h-4" />
            {t("expenses_page.tab_expenses")}
          </TabsTrigger>
          <TabsTrigger value="cash_ledger" className="gap-1">
            <Wallet className="w-4 h-4" />
            {t("expenses_page.tab_cash_ledger")}
          </TabsTrigger>
          <TabsTrigger value="bank_ledger" className="gap-1">
            <CreditCard className="w-4 h-4" />
            {t("expenses_page.tab_bank_ledger")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
            <div className="p-4 border-b flex flex-wrap items-center gap-3 bg-muted/20">
              <div className="relative w-60">
                <Search className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                <Input placeholder={t("expenses_page.search_placeholder")} className={`${lang === "ar" ? "pr-9" : "pl-9"} bg-background`} value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-expenses" />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36 bg-background" data-testid="input-filter-from" />
                <span className="text-muted-foreground text-sm">—</span>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36 bg-background" data-testid="input-filter-to" />
              </div>
              {isOwnerAdmin && (
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="w-48 bg-background" data-testid="select-filter-branch">
                    <SelectValue placeholder={t("expenses_page.all_branches")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("expenses_page.all_branches")}</SelectItem>
                    {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[90px]">{t("expenses_page.table_date")}</TableHead>
                  <TableHead>{t("expenses_page.table_branch")}</TableHead>
                  <TableHead>{t("expenses_page.table_shift")}</TableHead>
                  <TableHead>{t("expenses_page.table_employee")}</TableHead>
                  <TableHead>{t("expenses_page.table_category")}</TableHead>
                  <TableHead>{t("expenses_page.table_source")}</TableHead>
                  <TableHead>{t("expenses_page.table_amount")}</TableHead>
                  <TableHead>{t("expenses_page.table_notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("expenses_page.no_expenses")}</TableCell></TableRow>
                ) : filteredExpenses.map((exp: any) => (
                  <TableRow key={exp.id} data-testid={`row-expense-${exp.id}`}>
                    <TableCell className="text-xs">{exp.date ? fmtDate(exp.date) : "—"}</TableCell>
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
                <span className="text-muted-foreground">{filteredExpenses.length} {t("expenses_page.count_suffix")}</span>
                <span className="font-bold text-red-600">
                  {t("expenses_page.total_footer")} {filteredExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount || "0"), 0).toFixed(3)} {t("common.omr")}
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
                  <TableHead>{t("expenses_page.table_date")}</TableHead>
                  <TableHead>{t("expenses_page.table_branch")}</TableHead>
                  <TableHead>{t("expenses_page.table_shift")}</TableHead>
                  <TableHead>{t("expenses_page.ledger_table_type")}</TableHead>
                  <TableHead>{t("expenses_page.ledger_table_in")}</TableHead>
                  <TableHead>{t("expenses_page.ledger_table_out")}</TableHead>
                  <TableHead>{t("expenses_page.table_notes")}</TableHead>
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
            <div className="p-8 text-center bg-muted/10 border-b">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-bold">{t("expenses_page.bank_readonly_note")}</h3>
              <p className="text-muted-foreground max-w-md mx-auto">{t("expenses_page.bank_readonly_desc")}</p>
            </div>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("expenses_page.table_date")}</TableHead>
                  <TableHead>{t("expenses_page.table_branch")}</TableHead>
                  <TableHead>{t("expenses_page.table_shift")}</TableHead>
                  <TableHead>{t("common.method")}</TableHead>
                  <TableHead>{t("expenses_page.ledger_table_in")}</TableHead>
                  <TableHead>{t("expenses_page.ledger_table_out")}</TableHead>
                  <TableHead>{t("common.reference")}</TableHead>
                  <TableHead>{t("expenses_page.table_notes")}</TableHead>
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
                      {entry.shiftId ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Hash className="w-3 h-3" />
                          {entry.shiftId}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {entry.method === "card" ? t("payment_methods.card") : t("payment_methods.bank_transfer")}
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
