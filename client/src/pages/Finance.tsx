import { useState } from "react";
import {
  Banknote, Building2, ArrowDownCircle, ArrowUpCircle, Calculator,
  TrendingUp, TrendingDown, AlertTriangle, Calendar, Printer,
  Download, RefreshCw, Wallet, CreditCard, Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Branch, CashLedger, BankLedger } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { fmtTime } from "@/lib/formatters";
import { DateInput } from "@/components/ui/date-input";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmt(v: string | number | null | undefined) {
  return parseFloat(String(v || "0")).toFixed(3);
}
function fmtOMR(v: string | number | null | undefined) {
  const n = parseFloat(String(v || "0"));
  return n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " ر.ع";
}

const TYPE_BADGE: Record<string, string> = {
  sale:             "bg-green-100 text-green-800",
  expense:          "bg-red-100 text-red-800",
  deposit:          "bg-blue-100 text-blue-800",
  withdrawal:       "bg-orange-100 text-orange-800",
  shift_difference: "bg-yellow-100 text-yellow-800",
  order:            "bg-green-100 text-green-800",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, border = false }:
  { label: string; value: string; icon: any; color: string; border?: boolean }) {
  return (
    <Card className={`rounded-2xl shadow-sm ${border ? "border-2 border-primary/40" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
            <p className={`font-bold text-lg leading-tight ${color}`}>{value}</p>
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color.replace("text-", "bg-")}/10`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
export default function Finance() {
  const { data } = useAuth();
  const user = data?.user;
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const [selectedDate,   setSelectedDate]   = useState(new Date().toISOString().slice(0, 10));
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [depositOpen,    setDepositOpen]    = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [txAmount,       setTxAmount]       = useState("");
  const [txNote,         setTxNote]         = useState("");

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

  // ── حساب الرصيد الجاري ─────────────────────────────────────────────────
  const openingBalance = parseFloat(summary?.openingCash || "0");
  let running = openingBalance;
  const cashWithBalance = cashEntries.map(e => {
    running += parseFloat(e.amountIn || "0") - parseFloat(e.amountOut || "0");
    return { ...e, runningBalance: running.toFixed(3) };
  });

  const depositMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cash-ledger/deposit", { amount: txAmount, note: txNote });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("finance.deposit_success") });
      setDepositOpen(false); setTxAmount(""); setTxNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-ledger/summary"] });
    },
    onError: (err: any) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  const withdrawalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cash-ledger/withdrawal", { amount: txAmount, note: txNote });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("finance.withdrawal_success") });
      setWithdrawalOpen(false); setTxAmount(""); setTxNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/cash-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-ledger/summary"] });
    },
    onError: (err: any) => toast({ title: t("common.error"), description: err.message, variant: "destructive" }),
  });

  const branchName = (id: number) => {
    const b = branches.find(b => b.id === id);
    if (!b) return `${t("finance.branch_prefix")} ${id}`;
    return b.address ? `${b.name} - ${b.address}` : b.name;
  };

  // ── طباعة الكشف النقدي ─────────────────────────────────────────────────
  function printCashStatement() {
    const rows = cashWithBalance.map((e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${e.createdAt ? fmtTime(e.createdAt) : "-"}</td>
        <td>${t(`finance:transactionTypes.${e.type}`)}</td>
        <td style="color:green">${parseFloat(e.amountIn || "0") > 0 ? fmt(e.amountIn) : "-"}</td>
        <td style="color:red">${parseFloat(e.amountOut || "0") > 0 ? fmt(e.amountOut) : "-"}</td>
        <td><b>${e.runningBalance}</b></td>
        <td>${e.note || "-"}</td>
      </tr>`).join("");

    // i18n-ignore-block-start — Arabic-only print receipt HTML template
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>كشف الصندوق — ${selectedDate}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
  h2 { text-align: center; color: #E91E63; margin-bottom: 4px; }
  p.sub { text-align: center; color: #666; margin-bottom: 16px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; }
  th { background: #fce4ec; font-weight: bold; }
  tr:nth-child(even) { background: #fafafa; }
  .summary { margin-top: 16px; padding: 10px; background: #f5f5f5; border-radius: 6px; }
  .summary div { display: flex; justify-content: space-between; padding: 3px 0; }
  .net { font-weight: bold; font-size: 14px; border-top: 2px solid #E91E63; margin-top: 6px; padding-top: 6px; }
</style>
</head>
<body>
<h2>لمسة أنوثة — كشف الصندوق اليومي</h2>
<p class="sub">التاريخ: ${selectedDate}${selectedBranch !== "all" ? ` | الفرع: ${branchName(Number(selectedBranch))}` : ""}</p>
<table>
  <thead><tr><th>#</th><th>الوقت</th><th>النوع</th><th>وارد</th><th>صادر</th><th>الرصيد الجاري</th><th>ملاحظة</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="summary">
  <div><span>رصيد الافتتاح:</span><span>${fmt(summary?.openingCash)} ر.ع</span></div>
  <div><span>+ مبيعات نقدية:</span><span style="color:green">${fmt(summary?.cashSales)} ر.ع</span></div>
  <div><span>- مصروفات نقدية:</span><span style="color:red">${fmt(summary?.cashExpenses)} ر.ع</span></div>
  <div><span>+ إيداعات:</span><span>${fmt(summary?.deposits)} ر.ع</span></div>
  <div><span>- سحوبات:</span><span>${fmt(summary?.withdrawals)} ر.ع</span></div>
  <div class="net"><span>= صافي النقد المتوقع:</span><span style="color:#E91E63">${fmt(summary?.netCash)} ر.ع</span></div>
</div>
</body></html>`;
    // i18n-ignore-block-end

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
          <Calculator className="h-6 w-6" /> {t("finance.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("finance.subtitle")}</p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 items-center justify-center">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <DateInput value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" />
        </div>
        {isAdmin && (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t("finance.all_branches")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("finance.all_branches")}</SelectItem>
              {branches.map(b => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}{b.address ? ` - ${b.address}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={() => setDepositOpen(true)}>
          <ArrowDownCircle className="h-4 w-4 ms-1" /> {t("finance.deposit")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWithdrawalOpen(true)}>
          <ArrowUpCircle className="h-4 w-4 ms-1" /> {t("finance.withdrawal")}
        </Button>
        <Button variant="outline" size="sm" onClick={printCashStatement}>
          <Printer className="h-4 w-4 ms-1" /> {t("common.print")}
        </Button>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label={t("finance.opening_cash")}  value={fmtOMR(summary.openingCash)}   icon={Wallet}      color="text-gray-700" />
          <KpiCard label={t("finance.cash_sales")}    value={fmtOMR(summary.cashSales)}     icon={TrendingUp}  color="text-green-600" />
          <KpiCard label={t("finance.cash_expenses")} value={fmtOMR(summary.cashExpenses)}  icon={TrendingDown} color="text-red-600" />
          <KpiCard label={t("finance.deposits")}      value={fmtOMR(summary.deposits)}      icon={ArrowDownCircle} color="text-blue-600" />
          <KpiCard label={t("finance.withdrawals")}   value={fmtOMR(summary.withdrawals)}   icon={ArrowUpCircle}   color="text-orange-600" />
          <KpiCard label={t("finance.net_cash")}      value={fmtOMR(summary.netCash)}       icon={Calculator}  color="text-primary" border />
        </div>
      )}

      <Tabs defaultValue="cash" className="w-full" dir="rtl">
        <TabsList className="w-full justify-center gap-1">
          <TabsTrigger value="cash"   className="gap-1"><Banknote className="h-4 w-4" />{t("finance.tab_cash_ledger")}</TabsTrigger>
          <TabsTrigger value="bank"   className="gap-1"><Building2 className="h-4 w-4" />{t("finance.tab_bank_ledger")}</TabsTrigger>
          <TabsTrigger value="shifts" className="gap-1"><Calculator className="h-4 w-4" />{t("finance.tab_shift_diff")}</TabsTrigger>
        </TabsList>

        {/* ══ دفتر النقدي ══════════════════════════════════════════════════ */}
        <TabsContent value="cash" className="space-y-3">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-pink-50">
            <div className="p-3 bg-muted/20 border-b flex justify-between items-center">
              <span className="text-sm font-semibold">{t("finance.cash_movements_header")} — {selectedDate}</span>
              <span className="text-xs text-muted-foreground">{cashWithBalance.length} {t("finance.movements_count")}</span>
            </div>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-start w-10">#</TableHead>
                  <TableHead className="text-start">{t("finance.table_time")}</TableHead>
                  {isAdmin && <TableHead className="text-start">{t("finance.table_branch")}</TableHead>}
                  <TableHead className="text-start">{t("finance.table_type")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_in")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_out")}</TableHead>
                  <TableHead className="text-start font-bold text-primary">{t("finance.previous_balance")}</TableHead>
                  <TableHead className="text-start">{t("common.employee")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_note")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* رصيد الافتتاح */}
                {summary && parseFloat(summary.openingCash) !== 0 && (
                  <TableRow className="bg-gray-50 text-xs">
                    <TableCell>—</TableCell>
                    <TableCell>00:00</TableCell>
                    {isAdmin && <TableCell>—</TableCell>}
                    <TableCell><Badge className="text-xs bg-gray-100 text-gray-700">{t("finance.previous_balance")}</Badge></TableCell>
                    <TableCell className="text-blue-600">{fmt(summary.openingCash)}</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell className="font-bold text-primary">{fmt(summary.openingCash)}</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell className="text-muted-foreground">{t("finance.carried_balance")}</TableCell>
                  </TableRow>
                )}
                {cashWithBalance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="text-center text-muted-foreground py-10">
                      {t("finance.no_cash_entries")}
                    </TableCell>
                  </TableRow>
                ) : cashWithBalance.map((entry: any, i) => (
                  <TableRow key={entry.id} className="hover:bg-pink-50/30">
                    <TableCell className="text-xs">{i + 1}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {entry.createdAt ? fmtTime(entry.createdAt) : "-"}
                    </TableCell>
                    {isAdmin && <TableCell className="text-xs">{branchName(entry.branchId)}</TableCell>}
                    <TableCell>
                      <Badge className={`text-xs ${TYPE_BADGE[entry.type] || "bg-gray-100 text-gray-800"}`}>
                        {t(`finance:transactionTypes.${entry.type}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {parseFloat(entry.amountIn || "0") > 0 ? fmt(entry.amountIn) : "—"}
                    </TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {parseFloat(entry.amountOut || "0") > 0 ? fmt(entry.amountOut) : "—"}
                    </TableCell>
                    <TableCell className="font-bold text-primary text-sm">
                      {entry.runningBalance}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(entry as any).userName || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-36 truncate">
                      {entry.note || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* ملخص الوردية */}
          {summary && (
            <Card className="bg-gradient-to-br from-pink-50 to-white rounded-2xl border-pink-100">
              <CardContent className="p-4">
                <h4 className="font-bold text-sm mb-3 text-primary">{t("finance.day_summary")}</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {[
                    { label: t("finance.summary_opening"),          value: fmt(summary.openingCash),   color: "text-gray-700" },
                    { label: t("finance.summary_cash_sales"),        value: fmt(summary.cashSales),     color: "text-green-600" },
                    { label: t("finance.summary_cash_expenses"),     value: fmt(summary.cashExpenses),  color: "text-red-600" },
                    { label: t("finance.summary_deposits"),          value: fmt(summary.deposits),      color: "text-blue-600" },
                    { label: t("finance.summary_withdrawals"),       value: fmt(summary.withdrawals),   color: "text-orange-600" },
                    { label: t("finance.summary_shift_differences"), value: fmt(summary.shiftDifferences), color: "text-yellow-700" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between border-b border-pink-50 pb-1">
                      <span className="text-muted-foreground text-xs">{label}</span>
                      <span className={`font-medium text-xs ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t-2 border-primary/20 flex justify-between items-center">
                  <span className="font-bold">{t("finance.summary_net_cash")}</span>
                  <span className="font-extrabold text-primary text-lg">{fmtOMR(summary.netCash)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ دفتر البنك ═══════════════════════════════════════════════════ */}
        <TabsContent value="bank" className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <Building2 className="h-7 w-7 text-amber-600 mx-auto mb-2" />
            <p className="font-medium text-amber-800">{t("finance.bank_readonly_title")}</p>
            <p className="text-xs text-amber-600">{t("finance.bank_readonly_desc")}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-amber-50">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-start">#</TableHead>
                  <TableHead className="text-start">{t("finance.table_time")}</TableHead>
                  {isAdmin && <TableHead className="text-start">{t("finance.table_branch")}</TableHead>}
                  <TableHead className="text-start">{t("finance.table_method")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_in")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_out")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_note")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-10">
                      {t("finance.no_bank_entries")}
                    </TableCell>
                  </TableRow>
                ) : bankEntries.map((entry, i) => (
                  <TableRow key={entry.id} className="hover:bg-amber-50/30">
                    <TableCell className="text-xs">{i + 1}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {entry.createdAt ? fmtTime(entry.createdAt) : "-"}
                    </TableCell>
                    {isAdmin && <TableCell className="text-xs">{branchName(entry.branchId)}</TableCell>}
                    <TableCell>
                      <Badge className={`text-xs ${entry.method === "card" ? "bg-purple-100 text-purple-800" : "bg-indigo-100 text-indigo-800"}`}>
                        {entry.method === "card" ? t("finance.card_label") : entry.method === "bank_transfer" ? t("finance.bank_transfer_label") : entry.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {parseFloat(entry.amountIn || "0") > 0 ? fmt(entry.amountIn) : "—"}
                    </TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {parseFloat(entry.amountOut || "0") > 0 ? fmt(entry.amountOut) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-40 truncate">
                      {entry.note || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {bankEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("finance.total_incoming")}</p>
                <p className="font-bold text-green-700">
                  {bankEntries.reduce((s, e) => s + parseFloat(e.amountIn || "0"), 0).toFixed(3)} ر.ع
                </p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("finance.total_outgoing")}</p>
                <p className="font-bold text-red-700">
                  {bankEntries.reduce((s, e) => s + parseFloat(e.amountOut || "0"), 0).toFixed(3)} ر.ع
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══ الورديات ════════════════════════════════════════════════════ */}
        <TabsContent value="shifts" className="space-y-3">
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-green-200 rounded-2xl">
                <CardContent className="p-4 text-center">
                  <Calculator className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">{t("finance.expected_balance")}</p>
                  <p className="text-2xl font-bold text-green-700">{fmt(summary.expectedClosing)}</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 rounded-2xl">
                <CardContent className="p-4 text-center">
                  <Banknote className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">{t("finance.actual_balance")}</p>
                  <p className="text-2xl font-bold text-blue-700">{fmt(summary.actualClosing)}</p>
                </CardContent>
              </Card>
              <Card className={`border-2 rounded-2xl ${Math.abs(parseFloat(String(summary.totalDifference || 0))) < 0.002 ? "border-green-300" : "border-red-300"}`}>
                <CardContent className="p-4 text-center">
                  {Math.abs(parseFloat(String(summary.totalDifference || 0))) < 0.002
                    ? <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    : <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-2" />}
                  <p className="text-xs text-muted-foreground">{t("finance.shift_diff_label")}</p>
                  <p className={`text-2xl font-bold ${Math.abs(parseFloat(String(summary.totalDifference || 0))) < 0.002 ? "text-green-700" : "text-red-700"}`}>
                    {fmt(summary.totalDifference)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-pink-50">
            <div className="p-3 bg-muted/20 border-b">
              <h3 className="font-semibold text-sm">{t("finance.closed_shifts_title")} {selectedDate}</h3>
            </div>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-start">#</TableHead>
                  {isAdmin && <TableHead className="text-start">{t("finance.table_branch")}</TableHead>}
                  <TableHead className="text-start">{t("finance.table_cashier")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_terminal")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_opening")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_cash_sales")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_expected")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_actual")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_difference")}</TableHead>
                  <TableHead className="text-start">{t("finance.table_close_time")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedShifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 10 : 9} className="text-center text-muted-foreground py-10">
                      {t("finance.no_closed_shifts")}
                    </TableCell>
                  </TableRow>
                ) : closedShifts.map((s, i) => {
                  const diff = parseFloat(s.difference || "0");
                  return (
                    <TableRow key={s.id} className="hover:bg-pink-50/30">
                      <TableCell className="text-xs">{i + 1}</TableCell>
                      {isAdmin && <TableCell className="text-xs">{branchName(s.branchId)}</TableCell>}
                      <TableCell className="font-medium">{s.cashierName || "—"}</TableCell>
                      <TableCell className="text-xs">{s.terminalName}</TableCell>
                      <TableCell>{fmt(s.openingCash)}</TableCell>
                      <TableCell className="text-green-600">{fmt(s.totalCash)}</TableCell>
                      <TableCell>{fmt(s.expectedCash)}</TableCell>
                      <TableCell className="font-medium">{fmt(s.actualCash)}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${Math.abs(diff) < 0.002 ? "bg-green-100 text-green-800" : diff > 0 ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}`}>
                          {diff > 0 ? `+${fmt(diff)}` : fmt(diff)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {s.endedAt ? fmtTime(s.endedAt) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── نافذة الإيداع ────────────────────────────────────────────────── */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-blue-600" /> {t("finance.deposit_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t("finance.amount_label")}</label>
              <Input type="number" step="0.001" min="0.001" value={txAmount}
                onChange={e => setTxAmount(e.target.value)} placeholder="0.000" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("finance.deposit_reason_label")}</label>
              <Input value={txNote} onChange={e => setTxNote(e.target.value)}
                placeholder={t("finance.deposit_placeholder")} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => depositMutation.mutate()} disabled={depositMutation.isPending || !txAmount}>
              {t("finance.confirm_deposit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── نافذة السحب ──────────────────────────────────────────────────── */}
      <Dialog open={withdrawalOpen} onOpenChange={setWithdrawalOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-orange-600" /> {t("finance.withdrawal_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t("finance.amount_label")}</label>
              <Input type="number" step="0.001" min="0.001" value={txAmount}
                onChange={e => setTxAmount(e.target.value)} placeholder="0.000" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("finance.withdrawal_reason_label")}</label>
              <Input value={txNote} onChange={e => setTxNote(e.target.value)}
                placeholder={t("finance.withdrawal_placeholder")} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawalOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => withdrawalMutation.mutate()} disabled={withdrawalMutation.isPending || !txAmount}>
              {t("finance.confirm_withdrawal")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
