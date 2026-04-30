import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Banknote, CreditCard, Building2, TrendingUp, Package, Wallet,
  ArrowDownToLine, ArrowUpFromLine, RefreshCw, Plus, AlertTriangle,
  BarChart2, ShieldCheck, DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { parseServerError } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtOMR(v: string | number | null | undefined) {
  const n = parseFloat(String(v ?? "0"));
  return `${isNaN(n) ? "0.000" : n.toFixed(3)} ر.ع`;
}
function fmtNum(v: string | number | null | undefined) {
  return parseFloat(String(v ?? "0")).toFixed(3);
}
function pct(profit: string | number, selling: string | number) {
  const s = parseFloat(String(selling));
  const p = parseFloat(String(profit));
  if (!s) return "0.00";
  return ((p / s) * 100).toFixed(2);
}
function branchCity(address?: string | null) {
  if (!address) return "";
  return address.split("،")[0].replace("ولاية", "").trim();
}
function branchLabel(name: string, address?: string | null) {
  const city = branchCity(address);
  if (!city || name.includes(city)) return name;
  return `${name} - ${city}`;
}

const TXN_TYPES: Record<string, { color: string; icon: any }> = {
  BRANCH_CASH_TRANSFER_TO_OWNER: { color: "bg-green-100 text-green-800",  icon: ArrowDownToLine },
  OWNER_DEPOSIT_TO_BANK:         { color: "bg-blue-100 text-blue-800",    icon: Building2 },
  OWNER_WITHDRAWAL:              { color: "bg-red-100 text-red-800",      icon: ArrowUpFromLine },
  MANUAL_ADJUSTMENT_IN:          { color: "bg-purple-100 text-purple-800", icon: Plus },
  MANUAL_ADJUSTMENT_OUT:         { color: "bg-orange-100 text-orange-800", icon: RefreshCw },
};

interface KpiProps { title: string; value: string; icon: any; color: string; sub?: string; }
function KpiCard({ title, value, icon: Icon, color, sub }: KpiProps) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className={`w-8 h-8 ${color} opacity-80`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── main component ────────────────────────────────────────────────────────────
export default function OwnerFinancialSummary() {
  const { toast } = useToast();
  const { t } = useI18n();
  const qc = useQueryClient();

  // filters for transactions
  const [txnBranch, setTxnBranch] = useState("all");
  const [txnFrom,   setTxnFrom]   = useState("");
  const [txnTo,     setTxnTo]     = useState("");

  // new transaction dialog
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "BRANCH_CASH_TRANSFER_TO_OWNER",
    branchId: "",
    amount: "",
    paymentMethod: "cash",
    referenceNo: "",
    note: "",
  });

  // ── queries ──────────────────────────────────────────────────────────────
  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ["/api/owner/financial-summary"],
    queryFn: async () => {
      const r = await fetch("/api/owner/financial-summary", { credentials: "include" });
      if (!r.ok) throw new Error(await parseServerError(r));
      return r.json();
    },
  });

  const txnParams = new URLSearchParams({ limit: "200" });
  if (txnBranch !== "all") txnParams.set("branchId", txnBranch);
  if (txnFrom) txnParams.set("from", txnFrom);
  if (txnTo)   txnParams.set("to", txnTo);

  const { data: transactions = [], isLoading: txnLoading } = useQuery<any[]>({
    queryKey: ["/api/owner/transactions", txnBranch, txnFrom, txnTo],
    queryFn: async () => {
      const r = await fetch(`/api/owner/transactions?${txnParams}`, { credentials: "include" });
      if (!r.ok) throw new Error(await parseServerError(r));
      return r.json();
    },
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const r = await fetch("/api/branches", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  // ── mutation ──────────────────────────────────────────────────────────────
  const createTxn = useMutation({
    mutationFn: async (body: any) => {
      const r = await fetch("/api/owner/transactions", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await parseServerError(r));
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/owner/financial-summary"] });
      qc.invalidateQueries({ queryKey: ["/api/owner/transactions"] });
      setShowDialog(false);
      setForm({ date: new Date().toISOString().slice(0, 10), type: "BRANCH_CASH_TRANSFER_TO_OWNER", branchId: "", amount: "", paymentMethod: "cash", referenceNo: "", note: "" });
      toast({ title: t("finance:ownerFinancial.txn_saved") });
    },
    onError: (e: any) => toast({ title: t("finance:ownerFinancial.error"), description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast({ title: t("finance:ownerFinancial.error"), description: t("finance:ownerFinancial.invalid_amount"), variant: "destructive" }); return;
    }
    createTxn.mutate({
      date: form.date, type: form.type,
      branchId: form.branchId || undefined,
      amount: parseFloat(form.amount),
      paymentMethod: form.paymentMethod,
      referenceNo: form.referenceNo || undefined,
      note: form.note || undefined,
    });
  };

  const s = summary?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            {t("finance:ownerFinancial.page_title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("finance:ownerFinancial.page_subtitle")}</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" /> {t("finance:ownerFinancial.record_txn_btn")}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">{t("finance:ownerFinancial.loading")}</div>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">{t("finance:ownerFinancial.tab_overview")}</TabsTrigger>
            <TabsTrigger value="branches">{t("finance:ownerFinancial.tab_branches")}</TabsTrigger>
            <TabsTrigger value="inventory">{t("finance:ownerFinancial.tab_inventory")}</TabsTrigger>
            <TabsTrigger value="ledger">{t("finance:ownerFinancial.tab_ledger")}</TabsTrigger>
          </TabsList>

          {/* ── Overview ──────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4">

            {/* Row 1: Cash side */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">💵 {t("finance:ownerFinancial.cash_side")}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard title={t("finance:ownerFinancial.kpi_branch_cash")} value={fmtOMR((summary?.branches ?? []).reduce((s: number, b: any) => s + Math.max(0, parseFloat(b.currentCash)), 0))}
                  icon={Banknote}   color="text-green-600" sub={t("finance:ownerFinancial.kpi_branch_cash_sub")} />
                <KpiCard title={t("finance:ownerFinancial.kpi_owner_cash")} value={fmtOMR(s?.ownerCash)}
                  icon={Wallet}     color="text-emerald-600"
                  sub={s?.receivedFromBranches !== "0.000" ? `${t("finance:ownerFinancial.kpi_owner_cash_received")} ${fmtOMR(s?.receivedFromBranches)}` : t("finance:ownerFinancial.kpi_owner_cash_none")} />
                <KpiCard title={t("finance:ownerFinancial.kpi_total_expenses")} value={fmtOMR(s?.totalExpenses)}
                  icon={ArrowUpFromLine} color="text-red-500" sub={t("finance:ownerFinancial.kpi_total_expenses_sub")} />
                <KpiCard title={t("finance:ownerFinancial.kpi_total_withdrawals")} value={fmtOMR(s?.totalWithdrawals)}
                  icon={ArrowUpFromLine} color="text-orange-500" sub={t("finance:ownerFinancial.kpi_total_withdrawals_sub")} />
              </div>
            </div>

            {/* Row 2: Bank side */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">🏦 {t("finance:ownerFinancial.bank_side")}</p>
              <Card className="border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("finance:ownerFinancial.bank_balance_label")}</p>
                      <p className="text-2xl font-bold text-blue-600">{fmtOMR(s?.ownerBankBalance)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("finance:ownerFinancial.bank_balance_sub")}</p>
                    </div>
                    <Building2 className="w-10 h-10 text-blue-400" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><CreditCard className="w-3 h-3" />{t("finance:ownerFinancial.bank_card_sales")}</p>
                      <p className="font-bold text-purple-600 text-sm">{fmtOMR(s?.bankFromCard)}</p>
                      <p className="text-xs text-green-600">{t("finance:ownerFinancial.bank_direct_in")}</p>
                    </div>
                    <div className="text-center border-r">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Building2 className="w-3 h-3" />{t("finance:ownerFinancial.bank_transfers")}</p>
                      <p className="font-bold text-indigo-600 text-sm">{fmtOMR(s?.bankFromTransfer)}</p>
                      <p className="text-xs text-green-600">{t("finance:ownerFinancial.bank_direct_in")}</p>
                    </div>
                    <div className="text-center border-r">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><ArrowDownToLine className="w-3 h-3" />{t("finance:ownerFinancial.bank_branch_deposits")}</p>
                      <p className="font-bold text-blue-600 text-sm">{fmtOMR(s?.bankFromDeposits)}</p>
                      <p className="text-xs text-green-600">{t("finance:ownerFinancial.bank_branch_deposited")}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><ArrowUpFromLine className="w-3 h-3" />{t("finance:ownerFinancial.bank_sent_to_branches")}</p>
                      <p className="font-bold text-red-500 text-sm">{fmtOMR(s?.bankSentToBranches)}</p>
                      <p className="text-xs text-red-500">{t("finance:ownerFinancial.bank_owner_sent")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Row 3: Final balance */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("finance:ownerFinancial.total_company_balance")}</p>
                    <p className="text-3xl font-bold text-primary">{fmtOMR(s?.totalAvailable)}</p>
                  </div>
                  <DollarSign className="w-10 h-10 text-primary/50" />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="text-green-700 font-medium">{t("finance:ownerFinancial.formula_cash")} ({fmtOMR(s?.totalCashOnHand)})</span>
                  {" + "}<span className="text-blue-700 font-medium">{t("finance:ownerFinancial.formula_bank")} ({fmtOMR(s?.ownerBankBalance)})</span>
                  {" − "}<span className="text-red-700 font-medium">{t("finance:ownerFinancial.formula_expenses")} ({fmtOMR(s?.totalExpenses)})</span>
                  {" − "}<span className="text-orange-700 font-medium">{t("finance:ownerFinancial.formula_withdrawals")} ({fmtOMR(s?.totalWithdrawals)})</span>
                  {" = "}<span className="text-primary font-bold">{fmtOMR(s?.totalAvailable)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Owner cash detail */}
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  {t("finance:ownerFinancial.owner_cash_account")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
                  <div className="bg-green-50 dark:bg-green-950/30 rounded p-3">
                    <p className="text-muted-foreground text-xs">↑ {t("finance:ownerFinancial.owner_received_cash")}</p>
                    <p className="font-bold text-green-600 text-base">{fmtOMR(s?.receivedFromBranches)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("finance:ownerFinancial.owner_received_cash_note")}</p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-950/30 rounded p-3">
                    <p className="text-muted-foreground text-xs">↓ {t("finance:ownerFinancial.owner_sent_cash")}</p>
                    <p className="font-bold text-orange-600 text-base">{fmtOMR(s?.cashSentToBranches)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("finance:ownerFinancial.owner_sent_cash_note")}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-3">
                    <p className="text-muted-foreground text-xs">↓ {t("finance:ownerFinancial.owner_deposited_bank")}</p>
                    <p className="font-bold text-blue-600 text-base">{fmtOMR(s?.depositedToBank)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("finance:ownerFinancial.owner_deposited_bank_note")}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/30 rounded p-3">
                    <p className="text-muted-foreground text-xs">↓ {t("finance:ownerFinancial.owner_personal_withdrawals")}</p>
                    <p className="font-bold text-red-600 text-base">{fmtOMR(s?.totalWithdrawals)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("finance:ownerFinancial.owner_withdrawal_note")}</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-3 md:col-span-2">
                    <p className="text-muted-foreground text-xs">= {t("finance:ownerFinancial.owner_cash_on_hand")}</p>
                    <p className="font-bold text-emerald-700 text-xl">{fmtOMR(s?.ownerCash)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("finance:ownerFinancial.formula_received")} ({fmtOMR(s?.receivedFromBranches)}) − {t("finance:ownerFinancial.formula_sent")} ({fmtOMR(s?.cashSentToBranches)}) − {t("finance:ownerFinancial.formula_deposited")} ({fmtOMR(s?.depositedToBank)}) − {t("finance:ownerFinancial.formula_withdrawn")} ({fmtOMR(s?.totalWithdrawals)})
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Branch Cash Balances ───────────────────────────────────── */}
          <TabsContent value="branches" className="space-y-4">
            <div className="grid gap-4">
              {(summary?.branches ?? []).map((b: any) => {
                const current = parseFloat(b.currentCash);
                return (
                  <Card key={b.id}>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{branchLabel(b.name, b.address)}</span>
                        <Badge variant={current >= 0 ? "outline" : "destructive"}
                          className={current >= 0 ? "text-green-700 border-green-400" : ""}>
                          {t("finance:ownerFinancial.balance_label")}: {fmtOMR(b.currentCash)}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">{t("finance:ownerFinancial.branch_opening")}</p>
                          <p className="font-bold">{fmtOMR(b.openingCash)}</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">{t("finance:ownerFinancial.branch_cash_sales")}</p>
                          <p className="font-bold text-green-700">{fmtOMR(b.cashSales)}</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">{t("finance:ownerFinancial.branch_cash_expenses")}</p>
                          <p className="font-bold text-red-600">{fmtOMR(b.cashExpenses)}</p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">{t("finance:ownerFinancial.branch_transferred_to_owner")}</p>
                          <p className="font-bold text-orange-600">{fmtOMR(b.transferredToOwner)}</p>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">{t("finance:ownerFinancial.branch_current_balance")}</p>
                          <p className={`font-bold ${current >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtOMR(b.currentCash)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm mt-2">
                        <div className="bg-purple-50 dark:bg-purple-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">{t("finance:ownerFinancial.branch_card_sales")}</p>
                          <p className="font-bold text-purple-700">{fmtOMR(b.cardSales)}</p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded p-2">
                          <p className="text-muted-foreground text-xs">{t("finance:ownerFinancial.branch_bank_transfer_sales")}</p>
                          <p className="font-bold text-indigo-700">{fmtOMR(b.bankTransferSales)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {t("finance:ownerFinancial.branch_formula")}: {t("finance:ownerFinancial.formula_opening")} ({fmtOMR(b.openingCash)}) + {t("finance:ownerFinancial.formula_cash")} ({fmtOMR(b.cashSales)}) − {t("finance:ownerFinancial.formula_expenses")} ({fmtOMR(b.cashExpenses)}) − {t("finance:ownerFinancial.formula_transferred")} ({fmtOMR(b.transferredToOwner)}) = <strong>{fmtOMR(b.currentCash)}</strong>
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Inventory Value ────────────────────────────────────────── */}
          <TabsContent value="inventory" className="space-y-4">
            {/* Top summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard title={t("finance:ownerFinancial.inv_total_qty")} value={fmtNum(summary?.inventory?.totalQty)} icon={Package} color="text-blue-600" />
              <KpiCard title={t("finance:ownerFinancial.inv_total_cost")} value={fmtOMR(summary?.inventory?.totalCost)} icon={Banknote} color="text-orange-600" />
              <KpiCard title={t("finance:ownerFinancial.inv_total_selling")} value={fmtOMR(summary?.inventory?.totalSelling)} icon={TrendingUp} color="text-green-600" />
              <KpiCard title={t("finance:ownerFinancial.inv_expected_profit")} value={fmtOMR(summary?.inventory?.expectedProfit)} icon={DollarSign} color="text-primary"
                sub={`${t("finance:ownerFinancial.inv_margin")} ${summary?.inventory?.profitMargin ?? 0}%`} />
            </div>

            {/* By branch */}
            <Card>
              <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">{t("finance:ownerFinancial.inv_by_branch_title")}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("finance:ownerFinancial.col_branch")}</TableHead>
                      <TableHead className="text-center">{t("finance:ownerFinancial.col_qty")}</TableHead>
                      <TableHead className="text-center">{t("finance:ownerFinancial.col_cost_value")}</TableHead>
                      <TableHead className="text-center">{t("finance:ownerFinancial.col_selling_value")}</TableHead>
                      <TableHead className="text-center">{t("finance:ownerFinancial.col_expected_profit")}</TableHead>
                      <TableHead className="text-center">{t("finance:ownerFinancial.col_margin")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(summary?.inventoryByBranch ?? []).map((r: any) => {
                      const profit  = parseFloat(r.expectedProfit);
                      const selling = parseFloat(r.sellingValue);
                      return (
                        <TableRow key={r.branchId}>
                          <TableCell className="font-medium">{r.branchName}</TableCell>
                          <TableCell className="text-center">{fmtNum(r.qty)}</TableCell>
                          <TableCell className="text-center">{fmtOMR(r.costValue)}</TableCell>
                          <TableCell className="text-center">{fmtOMR(r.sellingValue)}</TableCell>
                          <TableCell className="text-center">
                            <span className={profit >= 0 ? "text-green-600" : "text-red-600"}>{fmtOMR(r.expectedProfit)}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{pct(profit, selling)}%</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Ledger ────────────────────────────────────────────────── */}
          <TabsContent value="ledger" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">{t("finance:ownerFinancial.filter_branch")}</Label>
                <Select value={txnBranch} onValueChange={setTxnBranch}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("finance:ownerFinancial.filter_all_branches")}</SelectItem>
                    {branches.map((b: any) => (
                      <SelectItem key={b.id} value={String(b.id)}>{branchLabel(b.name, b.address)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("finance:ownerFinancial.filter_from")}</Label>
                <Input type="date" value={txnFrom} onChange={e => setTxnFrom(e.target.value)} className="w-36" />
              </div>
              <div>
                <Label className="text-xs">{t("finance:ownerFinancial.filter_to")}</Label>
                <Input type="date" value={txnTo} onChange={e => setTxnTo(e.target.value)} className="w-36" />
              </div>
              <Button variant="outline" size="sm" onClick={() => { setTxnBranch("all"); setTxnFrom(""); setTxnTo(""); }}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("finance:ownerFinancial.col_date")}</TableHead>
                      <TableHead>{t("finance:ownerFinancial.col_type")}</TableHead>
                      <TableHead>{t("finance:ownerFinancial.col_branch")}</TableHead>
                      <TableHead>{t("finance:ownerFinancial.col_payment_method")}</TableHead>
                      <TableHead>{t("finance:ownerFinancial.col_from")}</TableHead>
                      <TableHead>{t("finance:ownerFinancial.col_to")}</TableHead>
                      <TableHead className="text-center">{t("finance:ownerFinancial.col_amount")}</TableHead>
                      <TableHead>{t("finance:ownerFinancial.col_reference")}</TableHead>
                      <TableHead>{t("finance:ownerFinancial.col_notes")}</TableHead>
                      <TableHead>{t("finance:ownerFinancial.col_user")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txnLoading ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">{t("finance:ownerFinancial.loading")}</TableCell></TableRow>
                    ) : transactions.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">{t("finance:ownerFinancial.no_transactions")}</TableCell></TableRow>
                    ) : transactions.map((tx: any) => {
                      const meta = TXN_TYPES[tx.type] ?? { color: "bg-gray-100 text-gray-800", icon: AlertTriangle };
                      const Icon = meta.icon;
                      const label = TXN_TYPES[tx.type] ? t(`finance:ownerTxnTypes.${tx.type}`) : tx.type;
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm whitespace-nowrap">{tx.date}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${meta.color}`}>
                              <Icon className="w-3 h-3" />{label}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{tx.branch_name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{
                            tx.payment_method === "cash" ? t("finance:ownerFinancial.method_cash") :
                            tx.payment_method === "card" ? t("finance:ownerFinancial.method_card") :
                            tx.payment_method === "bank_transfer" ? t("finance:ownerFinancial.method_bank_transfer") : tx.payment_method
                          }</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.from_account ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.to_account ?? "—"}</TableCell>
                          <TableCell className="text-center font-bold">{fmtOMR(tx.amount)}</TableCell>
                          <TableCell className="text-xs">{tx.reference_no ?? "—"}</TableCell>
                          <TableCell className="text-xs max-w-32 truncate">{tx.note ?? "—"}</TableCell>
                          <TableCell className="text-xs">{tx.created_by_name ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ── New Transaction Dialog ─────────────────────────────────────── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("finance:ownerFinancial.dialog_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("finance:ownerFinancial.field_date")}</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>{t("finance:ownerFinancial.field_txn_type")}</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(TXN_TYPES).map((k) => (
                      <SelectItem key={k} value={k}>{t(`finance:ownerTxnTypes.${k}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(form.type === "BRANCH_CASH_TRANSFER_TO_OWNER") && (
              <div>
                <Label>{t("finance:ownerFinancial.field_branch")}</Label>
                <Select value={form.branchId} onValueChange={v => setForm(f => ({ ...f, branchId: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("finance:ownerFinancial.select_branch_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b: any) => (
                      <SelectItem key={b.id} value={String(b.id)}>{branchLabel(b.name, b.address)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("finance:ownerFinancial.field_amount")}</Label>
                <Input type="number" step="0.001" min="0" placeholder="0.000"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>{t("finance:ownerFinancial.field_payment_method")}</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("finance:ownerFinancial.method_cash")}</SelectItem>
                    <SelectItem value="card">{t("finance:ownerFinancial.method_card")}</SelectItem>
                    <SelectItem value="bank_transfer">{t("finance:ownerFinancial.method_bank_transfer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>{t("finance:ownerFinancial.field_reference")}</Label>
              <Input placeholder={t("finance:ownerFinancial.reference_placeholder")}
                value={form.referenceNo} onChange={e => setForm(f => ({ ...f, referenceNo: e.target.value }))} />
            </div>
            <div>
              <Label>{t("finance:ownerFinancial.field_notes")}</Label>
              <Input placeholder={t("finance:ownerFinancial.notes_placeholder")}
                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>

            {/* Preview of what will happen */}
            {form.type === "BRANCH_CASH_TRANSFER_TO_OWNER" && form.amount && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-sm space-y-1">
                <p className="font-medium text-green-800">{t("finance:ownerFinancial.preview_what_happens")}</p>
                <p className="text-green-700">✓ {t("finance:ownerFinancial.preview_branch_deduct", { amount: fmtOMR(form.amount) })}</p>
                <p className="text-green-700">✓ {t("finance:ownerFinancial.preview_owner_add", { amount: fmtOMR(form.amount) })}</p>
                <p className="text-green-700">✓ {t("finance:ownerFinancial.preview_recorded")}</p>
              </div>
            )}
            {form.type === "OWNER_DEPOSIT_TO_BANK" && form.amount && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-sm space-y-1">
                <p className="font-medium text-blue-800">{t("finance:ownerFinancial.preview_what_happens")}</p>
                <p className="text-blue-700">✓ {t("finance:ownerFinancial.preview_owner_deduct", { amount: fmtOMR(form.amount) })}</p>
                <p className="text-blue-700">✓ {t("finance:ownerFinancial.preview_bank_add", { amount: fmtOMR(form.amount) })}</p>
              </div>
            )}
            {form.type === "OWNER_WITHDRAWAL" && form.amount && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm space-y-1">
                <p className="font-medium text-red-800">{t("finance:ownerFinancial.preview_what_happens")}</p>
                <p className="text-red-700">✓ {t("finance:ownerFinancial.preview_withdrawal_deduct", { amount: fmtOMR(form.amount) })}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{t("finance:ownerFinancial.cancel_btn")}</Button>
            <Button onClick={handleSubmit} disabled={createTxn.isPending}>
              {createTxn.isPending ? t("finance:ownerFinancial.saving") : t("finance:ownerFinancial.save_txn_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
