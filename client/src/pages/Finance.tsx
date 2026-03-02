import { useState } from "react";
import { Banknote, Building2, ArrowDownCircle, ArrowUpCircle, Calculator, Clock, TrendingUp, TrendingDown, AlertTriangle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Branch, CashLedger, BankLedger } from "@shared/schema";

const TYPE_LABELS: Record<string, string> = {
  sale: "مبيعات",
  expense: "مصروف",
  deposit: "إيداع",
  withdrawal: "سحب",
  shift_difference: "فرق صندوق",
  order: "طلب",
};

const TYPE_BADGE: Record<string, string> = {
  sale: "bg-green-100 text-green-800",
  expense: "bg-red-100 text-red-800",
  deposit: "bg-blue-100 text-blue-800",
  withdrawal: "bg-orange-100 text-orange-800",
  shift_difference: "bg-yellow-100 text-yellow-800",
  order: "bg-green-100 text-green-800",
};

function formatNum(v: string | number | null | undefined) {
  const n = parseFloat(String(v || "0"));
  return n.toFixed(3);
}

export default function Finance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");

  const branchIdParam = isAdmin && selectedBranch !== "all" ? `&branchId=${selectedBranch}` : "";

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: cashEntries = [] } = useQuery<CashLedger[]>({
    queryKey: ["/api/cash-ledger", selectedDate, selectedBranch],
    queryFn: () => fetch(`/api/cash-ledger?date=${selectedDate}${branchIdParam}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: bankEntries = [] } = useQuery<BankLedger[]>({
    queryKey: ["/api/bank-ledger", selectedDate, selectedBranch],
    queryFn: () => fetch(`/api/bank-ledger?date=${selectedDate}${branchIdParam}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/cash-ledger/summary", selectedDate, selectedBranch],
    queryFn: () => fetch(`/api/cash-ledger/summary?date=${selectedDate}${branchIdParam}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: closedShifts = [] } = useQuery<any[]>({
    queryKey: ["/api/shifts/closed", selectedDate, selectedBranch],
    queryFn: () => fetch(`/api/shifts/closed?date=${selectedDate}${branchIdParam}`, { credentials: "include" }).then(r => r.json()),
  });

  const depositMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cash-ledger/deposit", { amount: txAmount, note: txNote });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الإيداع بنجاح" });
      setDepositOpen(false);
      setTxAmount("");
      setTxNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-ledger/summary"] });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const withdrawalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cash-ledger/withdrawal", { amount: txAmount, note: txNote });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم السحب بنجاح" });
      setWithdrawalOpen(false);
      setTxAmount("");
      setTxNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-ledger/summary"] });
    },
    onError: (err: any) => toast({ title: "خطأ", description: err.message, variant: "destructive" }),
  });

  const branchName = (id: number) => branches.find(b => b.id === id)?.name || `فرع ${id}`;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary" data-testid="text-finance-title">المحاسبة اليومية</h1>
        <p className="text-muted-foreground text-sm">دفتر النقد والبنك وفرق الصندوق</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-center">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
            data-testid="input-finance-date"
          />
        </div>
        {isAdmin && (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-52" data-testid="select-finance-branch">
              <SelectValue placeholder="جميع الفروع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفروع</SelectItem>
              {branches.map(b => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={() => setDepositOpen(true)} data-testid="button-deposit">
          <ArrowDownCircle className="h-4 w-4 ml-1" />
          إيداع
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWithdrawalOpen(true)} data-testid="button-withdrawal">
          <ArrowUpCircle className="h-4 w-4 ml-1" />
          سحب
        </Button>
      </div>

      <Tabs defaultValue="cash" className="w-full">
        <TabsList className="w-full justify-center">
          <TabsTrigger value="cash" className="gap-1" data-testid="tab-cash-ledger">
            <Banknote className="h-4 w-4" />
            دفتر النقد
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-1" data-testid="tab-bank-ledger">
            <Building2 className="h-4 w-4" />
            دفتر البنك
          </TabsTrigger>
          <TabsTrigger value="shifts" className="gap-1" data-testid="tab-shift-diff">
            <Calculator className="h-4 w-4" />
            فرق الصندوق
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cash" className="space-y-4">
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">الافتتاحية</p>
                  <p className="text-lg font-bold" data-testid="text-opening-cash">{formatNum(summary.openingCash)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">مبيعات نقدية</p>
                  <p className="text-lg font-bold text-green-600" data-testid="text-cash-sales">{formatNum(summary.cashSales)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">مصروفات نقدية</p>
                  <p className="text-lg font-bold text-red-600" data-testid="text-cash-expenses">{formatNum(summary.cashExpenses)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">إيداعات</p>
                  <p className="text-lg font-bold text-blue-600" data-testid="text-deposits">{formatNum(summary.deposits)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">سحوبات</p>
                  <p className="text-lg font-bold text-orange-600" data-testid="text-withdrawals">{formatNum(summary.withdrawals)}</p>
                </CardContent>
              </Card>
              <Card className="border-primary">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">صافي النقد</p>
                  <p className="text-lg font-bold text-primary" data-testid="text-net-cash">{formatNum(summary.netCash)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">الوقت</TableHead>
                  {isAdmin && <TableHead className="text-right">الفرع</TableHead>}
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">وارد</TableHead>
                  <TableHead className="text-right">صادر</TableHead>
                  <TableHead className="text-right">الملاحظة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                      لا توجد حركات نقدية لهذا اليوم
                    </TableCell>
                  </TableRow>
                ) : cashEntries.map((entry, i) => (
                  <TableRow key={entry.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="text-sm">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" }) : "-"}
                    </TableCell>
                    {isAdmin && <TableCell className="text-sm">{branchName(entry.branchId)}</TableCell>}
                    <TableCell>
                      <Badge className={`text-xs ${TYPE_BADGE[entry.type] || "bg-gray-100 text-gray-800"}`} data-testid={`badge-type-${entry.id}`}>
                        {TYPE_LABELS[entry.type] || entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">{parseFloat(entry.amountIn || "0") > 0 ? formatNum(entry.amountIn) : "-"}</TableCell>
                    <TableCell className="text-red-600 font-medium">{parseFloat(entry.amountOut || "0") > 0 ? formatNum(entry.amountOut) : "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-48 truncate">{entry.note || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="bank" className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <Building2 className="h-8 w-8 text-amber-600 mx-auto mb-2" />
            <p className="font-medium text-amber-800">دفتر البنك — للقراءة فقط</p>
            <p className="text-sm text-amber-600">يتم تسجيل حركات البطاقة والتحويل البنكي تلقائياً من المبيعات والمصروفات</p>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">الوقت</TableHead>
                  {isAdmin && <TableHead className="text-right">الفرع</TableHead>}
                  <TableHead className="text-right">الطريقة</TableHead>
                  <TableHead className="text-right">وارد</TableHead>
                  <TableHead className="text-right">صادر</TableHead>
                  <TableHead className="text-right">الملاحظة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                      لا توجد حركات بنكية لهذا اليوم
                    </TableCell>
                  </TableRow>
                ) : bankEntries.map((entry, i) => (
                  <TableRow key={entry.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="text-sm">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" }) : "-"}
                    </TableCell>
                    {isAdmin && <TableCell className="text-sm">{branchName(entry.branchId)}</TableCell>}
                    <TableCell>
                      <Badge className="text-xs bg-indigo-100 text-indigo-800">
                        {entry.method === "card" ? "بطاقة" : entry.method === "bank_transfer" ? "تحويل بنكي" : entry.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">{parseFloat(entry.amountIn || "0") > 0 ? formatNum(entry.amountIn) : "-"}</TableCell>
                    <TableCell className="text-red-600 font-medium">{parseFloat(entry.amountOut || "0") > 0 ? formatNum(entry.amountOut) : "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-48 truncate">{entry.note || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="shifts" className="space-y-4">
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-green-200">
                <CardContent className="p-4 text-center">
                  <Calculator className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">المتوقع في الصندوق</p>
                  <p className="text-2xl font-bold text-green-700" data-testid="text-expected-closing">{formatNum(summary.expectedClosing)}</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200">
                <CardContent className="p-4 text-center">
                  <Banknote className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">الفعلي عند الإغلاق</p>
                  <p className="text-2xl font-bold text-blue-700" data-testid="text-actual-closing">{formatNum(summary.actualClosing)}</p>
                </CardContent>
              </Card>
              <Card className={`border-2 ${parseFloat(String(summary.totalDifference || 0)) === 0 ? "border-green-300" : "border-red-300"}`}>
                <CardContent className="p-4 text-center">
                  {parseFloat(String(summary.totalDifference || 0)) === 0 ? (
                    <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-2" />
                  )}
                  <p className="text-sm text-muted-foreground">إجمالي الفرق</p>
                  <p className={`text-2xl font-bold ${parseFloat(String(summary.totalDifference || 0)) === 0 ? "text-green-700" : "text-red-700"}`} data-testid="text-total-difference">
                    {formatNum(summary.totalDifference)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 bg-muted/30 border-b">
              <h3 className="font-semibold text-sm">الشفتات المغلقة — {selectedDate}</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  {isAdmin && <TableHead className="text-right">الفرع</TableHead>}
                  <TableHead className="text-right">الكاشير</TableHead>
                  <TableHead className="text-right">الجهاز</TableHead>
                  <TableHead className="text-right">الافتتاحية</TableHead>
                  <TableHead className="text-right">مبيعات نقدية</TableHead>
                  <TableHead className="text-right">المتوقع</TableHead>
                  <TableHead className="text-right">الفعلي</TableHead>
                  <TableHead className="text-right">الفرق</TableHead>
                  <TableHead className="text-right">وقت الإغلاق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedShifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 10 : 9} className="text-center text-muted-foreground py-8">
                      لا توجد شفتات مغلقة لهذا اليوم
                    </TableCell>
                  </TableRow>
                ) : closedShifts.map((s, i) => {
                  const diff = parseFloat(s.difference || "0");
                  return (
                    <TableRow key={s.id} data-testid={`row-shift-${s.id}`}>
                      <TableCell>{i + 1}</TableCell>
                      {isAdmin && <TableCell className="text-sm">{branchName(s.branchId)}</TableCell>}
                      <TableCell className="font-medium">{s.cashierName || "-"}</TableCell>
                      <TableCell className="text-sm">{s.terminalName}</TableCell>
                      <TableCell>{formatNum(s.openingCash)}</TableCell>
                      <TableCell className="text-green-600">{formatNum(s.totalCash)}</TableCell>
                      <TableCell>{formatNum(s.expectedCash)}</TableCell>
                      <TableCell className="font-medium">{formatNum(s.actualCash)}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${Math.abs(diff) < 0.002 ? "bg-green-100 text-green-800" : diff > 0 ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}`}>
                          {diff > 0 ? `+${formatNum(diff)}` : formatNum(diff)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.endedAt ? new Date(s.endedAt).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {summary && (
            <Card className="bg-muted/20">
              <CardContent className="p-4">
                <h4 className="font-semibold mb-3 text-sm">ملخص حركة الصندوق</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">الافتتاحية:</span>
                    <span className="font-medium">{formatNum(summary.openingCash)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">+ مبيعات نقدية:</span>
                    <span className="font-medium text-green-600">{formatNum(summary.cashSales)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">- مصروفات نقدية:</span>
                    <span className="font-medium text-red-600">{formatNum(summary.cashExpenses)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">+ إيداعات:</span>
                    <span className="font-medium text-blue-600">{formatNum(summary.deposits)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">- سحوبات:</span>
                    <span className="font-medium text-orange-600">{formatNum(summary.withdrawals)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">± فرق صندوق:</span>
                    <span className={`font-medium ${parseFloat(String(summary.shiftDifferences || 0)) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatNum(summary.shiftDifferences)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t-2 border-primary/30 flex justify-between">
                  <span className="font-bold">= صافي النقد:</span>
                  <span className="font-bold text-primary text-lg">{formatNum(summary.netCash)} ر.ع</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إيداع نقدي للصندوق</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">المبلغ (ر.ع)</label>
              <Input
                type="number"
                step="0.001"
                min="0.001"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="0.000"
                data-testid="input-deposit-amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظة</label>
              <Input
                value={txNote}
                onChange={(e) => setTxNote(e.target.value)}
                placeholder="سبب الإيداع"
                data-testid="input-deposit-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositOpen(false)}>إلغاء</Button>
            <Button onClick={() => depositMutation.mutate()} disabled={depositMutation.isPending || !txAmount} data-testid="button-confirm-deposit">
              تأكيد الإيداع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawalOpen} onOpenChange={setWithdrawalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>سحب نقدي من الصندوق</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">المبلغ (ر.ع)</label>
              <Input
                type="number"
                step="0.001"
                min="0.001"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="0.000"
                data-testid="input-withdrawal-amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظة</label>
              <Input
                value={txNote}
                onChange={(e) => setTxNote(e.target.value)}
                placeholder="سبب السحب"
                data-testid="input-withdrawal-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawalOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => withdrawalMutation.mutate()} disabled={withdrawalMutation.isPending || !txAmount} data-testid="button-confirm-withdrawal">
              تأكيد السحب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
