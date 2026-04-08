import { useState } from "react";
import { Calendar, Download, Banknote, CreditCard, Building2, TrendingUp, TrendingDown, DollarSign, BarChart3, Package, ShoppingBag, Eye, Layers, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Branch } from "@shared/schema";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonthStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function omr(val: string | number | null) {
  if (val === null || val === undefined) return "0.000";
  return parseFloat(String(val)).toFixed(3);
}

function fmtDateTime(ts: string | null, _lang: string) {
  if (!ts) return "-";
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()} ${hours}:${mins}`;
}

function fmtTime(ts: string | null, lang: string) {
  if (!ts) return "-";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function downloadCSV(filename: string, rows: any[][]) {
  const bom = "\uFEFF";
  const csv = bom + rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pmLabel(method: string, t: (k: string) => string) {
  if (method === "cash") return t("reports.cash_sales");
  if (method === "card") return t("reports.card_sales");
  if (method === "bank_transfer") return t("reports.bank_sales");
  return method;
}

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub?: string; icon: any; color: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
            <p className={`text-xl font-bold ${color}`}>{value} <span className="text-xs font-normal">OMR</span></p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.replace("text-", "bg-")}/10`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div className="text-center py-16 text-muted-foreground space-y-2">
      <BarChart3 className="w-12 h-12 mx-auto opacity-30" />
      <p className="font-medium">{t("reports.no_data_date")}</p>
      <p className="text-sm">{t("reports.no_data_hint")}</p>
    </div>
  );
}

function OverviewTab({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const { t, lang } = useI18n();
  const params = `from=${from}&to=${to}${branchId ? `&branchId=${branchId}` : ""}`;
  const { data: report, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/overview", from, to, branchId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/overview?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  function exportCSV() {
    if (!report) return;
    downloadCSV(`overview-${from}-${to}.csv`, [
      [t("reports.tab_overview"), `${from} → ${to}`],
      [],
      [t("reports.item_label"), t("reports.amount_omr"), t("reports.count_label")],
      [t("reports.cash_sales"), report.salesCash.total, report.salesCash.count],
      [t("reports.card_sales"), report.salesCard.total, report.salesCard.count],
      [t("reports.bank_sales"), report.salesBankTransfer.total, report.salesBankTransfer.count],
      [t("reports.total_sales"), report.totalSales, report.invoiceCount],
      [],
      [t("reports.cogs"), report.cogsTotal],
      [t("reports.gross_profit"), report.grossProfit],
      [t("reports.total_expenses"), report.totalExpenses],
      [t("reports.net_profit"), report.netProfit],
    ]);
  }

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t("reports.loading_report")}</div>;
  if (!report) return <EmptyState t={t} />;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} data-testid="button-export-overview-csv">
          <Download className="w-4 h-4" />{t("reports.export_csv")}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title={t("reports.cash_sales")} value={omr(report.salesCash.total)} sub={`${report.salesCash.count} ${t("reports.invoice_count")}`} icon={Banknote} color="text-green-600" />
        <StatCard title={t("reports.card_sales")} value={omr(report.salesCard.total)} sub={`${report.salesCard.count} ${t("reports.invoice_count")}`} icon={CreditCard} color="text-blue-600" />
        <StatCard title={t("reports.bank_sales")} value={omr(report.salesBankTransfer.total)} sub={`${report.salesBankTransfer.count} ${t("reports.invoice_count")}`} icon={Building2} color="text-purple-600" />
        <StatCard title={t("reports.total_sales")} value={omr(report.totalSales)} sub={`${report.invoiceCount} ${t("reports.invoice_count")}`} icon={TrendingUp} color="text-emerald-600" />
      </div>

      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />{t("reports.profit_analysis")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 bg-white rounded-lg border text-center" data-testid="stat-total-sales">
              <p className="text-xs text-muted-foreground">{t("reports.total_sales")}</p>
              <p className="text-lg font-bold text-emerald-600 mt-1">{omr(report.totalSales)}</p>
              <p className="text-[10px] text-muted-foreground">OMR</p>
            </div>
            <div className="p-3 bg-white rounded-lg border text-center" data-testid="stat-cogs">
              <p className="text-xs text-muted-foreground">{t("reports.cogs")}</p>
              <p className="text-lg font-bold text-orange-600 mt-1">{omr(report.cogsTotal)}</p>
              <p className="text-[10px] text-muted-foreground">OMR</p>
            </div>
            <div className="p-3 bg-white rounded-lg border text-center" data-testid="stat-gross-profit">
              <p className="text-xs text-muted-foreground">{t("reports.gross_profit")}</p>
              <p className={`text-lg font-bold mt-1 ${parseFloat(report.grossProfit) >= 0 ? "text-blue-600" : "text-red-600"}`}>{omr(report.grossProfit)}</p>
              <p className="text-[10px] text-muted-foreground">OMR</p>
            </div>
            <div className="p-3 bg-white rounded-lg border text-center" data-testid="stat-expenses">
              <p className="text-xs text-muted-foreground">{t("reports.total_expenses")}</p>
              <p className="text-lg font-bold text-red-600 mt-1">{omr(report.totalExpenses)}</p>
              <p className="text-[10px] text-muted-foreground">OMR</p>
            </div>
            <div className="p-3 bg-white rounded-lg border-2 border-primary/30 text-center" data-testid="stat-net-profit">
              <p className="text-xs text-muted-foreground font-medium">{t("reports.net_profit")}</p>
              <p className={`text-xl font-bold mt-1 ${parseFloat(report.netProfit) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{omr(report.netProfit)}</p>
              <p className="text-[10px] text-muted-foreground">OMR</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("reports.cash_summary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 bg-muted/30 rounded-lg border text-center">
              <p className="text-xs text-muted-foreground">{t("reports.opening_balance")}</p>
              <p className="text-lg font-bold mt-1">{omr(report.openingCash)} <span className="text-xs font-normal">OMR</span></p>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg border text-center">
              <p className="text-xs text-muted-foreground">{t("reports.cash_closing_est")}</p>
              <p className="text-lg font-bold mt-1">{omr(report.cashClosingBalance)} <span className="text-xs font-normal">OMR</span></p>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg border text-center">
              <p className="text-xs text-muted-foreground">{t("reports.total_differences")}</p>
              <p className={`text-lg font-bold mt-1 ${parseFloat(report.differencesSum) === 0 ? "text-green-600" : "text-red-600"}`}>
                {omr(report.differencesSum)} <span className="text-xs font-normal">OMR</span>
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg border text-center">
              <p className="text-xs text-muted-foreground">{t("reports.shifts_label")}</p>
              <p className="text-lg font-bold mt-1">{report.shiftsCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SalesTab({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const { t, lang } = useI18n();
  const [pmFilter, setPmFilter] = useState<string>("all");
  const params = `from=${from}&to=${to}${branchId ? `&branchId=${branchId}` : ""}${pmFilter !== "all" ? `&paymentMethod=${pmFilter}` : ""}`;

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/sales-list", from, to, branchId, pmFilter],
    queryFn: async () => {
      const res = await fetch(`/api/reports/sales-list?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  function exportCSV() {
    if (!data) return;
    downloadCSV(`sales-${from}-${to}.csv`, [
      [t("reports.tab_sales"), `${from} → ${to}`],
      [],
      [t("reports.table_invoice"), t("reports.table_date"), t("reports.table_branch"), t("reports.table_cashier"), t("reports.table_subtotal"), t("reports.table_discount"), t("reports.table_vat"), t("reports.table_total"), t("reports.table_payment")],
      ...data.rows.map((r: any) => [
        r.invoiceNumber || r.id, fmtDateTime(r.createdAt, lang), r.branchName, r.cashierName,
        omr(r.subtotal), omr(r.discount), omr(r.vat), omr(r.total), r.paymentMethod,
      ]),
      [],
      [t("reports.grand_total"), "", "", "", "", "", "", data.summary.totalSales],
    ]);
  }

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t("reports.loading_report")}</div>;
  if (!data || data.rows.length === 0) return <EmptyState t={t} />;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={pmFilter} onValueChange={setPmFilter}>
            <SelectTrigger className="w-44" data-testid="select-sales-pm-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("reports.all_methods")}</SelectItem>
              <SelectItem value="cash">{t("reports.cash_sales")}</SelectItem>
              <SelectItem value="card">{t("reports.card_sales")}</SelectItem>
              <SelectItem value="bank_transfer">{t("reports.bank_sales")}</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{data.summary.count} {t("reports.invoice_count")}</Badge>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} data-testid="button-export-sales-csv">
          <Download className="w-4 h-4" />{t("reports.export_csv")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard title={t("reports.total_sales")} value={omr(data.summary.totalSales)} icon={TrendingUp} color="text-emerald-600" />
        <StatCard title={t("reports.total_discount")} value={omr(data.summary.totalDiscount)} icon={TrendingDown} color="text-orange-500" />
        <StatCard title={t("reports.total_vat")} value={omr(data.summary.totalVat)} icon={DollarSign} color="text-blue-600" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("reports.table_invoice")}</TableHead>
                  <TableHead>{t("reports.table_date")}</TableHead>
                  <TableHead>{t("reports.table_branch")}</TableHead>
                  <TableHead>{t("reports.table_cashier")}</TableHead>
                  <TableHead className="text-center">{t("reports.table_subtotal")}</TableHead>
                  <TableHead className="text-center">{t("reports.table_discount")}</TableHead>
                  <TableHead className="text-center">{t("reports.table_vat")}</TableHead>
                  <TableHead className="text-center">{t("reports.table_total")}</TableHead>
                  <TableHead>{t("reports.table_payment")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row: any) => (
                  <TableRow key={`${row.type}-${row.id}`} data-testid={`row-sale-${row.id}`}>
                    <TableCell className="font-mono text-sm">{row.invoiceNumber || `#${row.id}`}</TableCell>
                    <TableCell className="text-sm">{fmtDateTime(row.createdAt, lang)}</TableCell>
                    <TableCell className="text-sm">{row.branchName}</TableCell>
                    <TableCell className="text-sm">{row.cashierName}</TableCell>
                    <TableCell className="text-center font-mono">{omr(row.subtotal)}</TableCell>
                    <TableCell className="text-center font-mono text-orange-500">{omr(row.discount)}</TableCell>
                    <TableCell className="text-center font-mono">{omr(row.vat)}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{omr(row.total)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{pmLabel(row.paymentMethod, t)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentsTab({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const { t, lang } = useI18n();
  const params = `from=${from}&to=${to}${branchId ? `&branchId=${branchId}` : ""}`;
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/payments-report", from, to, branchId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/payments-report?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  function exportCSV() {
    if (!data) return;
    downloadCSV(`payments-${from}-${to}.csv`, [
      [t("reports.tab_payments"), `${from} → ${to}`],
      [],
      [t("reports.pm_method"), t("reports.pm_count"), t("reports.pm_total"), t("reports.pm_percentage")],
      ...data.methods.map((m: any) => [pmLabel(m.method, t), m.count, m.total, `${m.percentage}%`]),
      [],
      [t("reports.grand_total"), "", data.grandTotal],
    ]);
  }

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t("reports.loading_report")}</div>;
  if (!data || data.methods.length === 0) return <EmptyState t={t} />;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} data-testid="button-export-payments-csv">
          <Download className="w-4 h-4" />{t("reports.export_csv")}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.methods.map((m: any) => (
          <StatCard
            key={m.method}
            title={pmLabel(m.method, t)}
            value={omr(m.total)}
            sub={`${m.count} ${t("reports.invoice_count")} (${m.percentage}%)`}
            icon={m.method === "cash" ? Banknote : m.method === "card" ? CreditCard : Building2}
            color={m.method === "cash" ? "text-green-600" : m.method === "card" ? "text-blue-600" : "text-purple-600"}
          />
        ))}
        <StatCard title={t("reports.grand_total")} value={omr(data.grandTotal)} icon={TrendingUp} color="text-emerald-700" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("reports.payment_methods_summary")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t("reports.pm_method")}</TableHead>
                <TableHead className="text-center">{t("reports.pm_count")}</TableHead>
                <TableHead className="text-center">{t("reports.pm_total")}</TableHead>
                <TableHead className="text-center">{t("reports.pm_percentage")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.methods.map((m: any) => (
                <TableRow key={m.method}>
                  <TableCell className="font-medium">{pmLabel(m.method, t)}</TableCell>
                  <TableCell className="text-center">{m.count}</TableCell>
                  <TableCell className="text-center font-mono font-bold">{omr(m.total)} OMR</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{m.percentage}%</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data.transactions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("reports.payment_transactions")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t("reports.table_invoice")}</TableHead>
                    <TableHead>{t("reports.table_date")}</TableHead>
                    <TableHead>{t("reports.table_branch")}</TableHead>
                    <TableHead>{t("reports.table_cashier")}</TableHead>
                    <TableHead>{t("reports.table_payment")}</TableHead>
                    <TableHead className="text-center">{t("reports.table_total")}</TableHead>
                    <TableHead>{t("reports.table_ref")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((txn: any) => (
                    <TableRow key={txn.id}>
                      <TableCell className="font-mono text-sm">{txn.invoiceNumber || `#${txn.id}`}</TableCell>
                      <TableCell className="text-sm">{fmtDateTime(txn.createdAt, lang)}</TableCell>
                      <TableCell className="text-sm">{txn.branchName}</TableCell>
                      <TableCell className="text-sm">{txn.cashierName}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{pmLabel(txn.method, t)}</Badge></TableCell>
                      <TableCell className="text-center font-mono font-bold">{omr(txn.total)}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{txn.bankTxnId || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ShiftsTab({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const { t, lang } = useI18n();
  const [detailShiftId, setDetailShiftId] = useState<number | null>(null);
  const params = `from=${from}&to=${to}${branchId ? `&branchId=${branchId}` : ""}`;

  const { data: shiftsData = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/reports/shifts-report", from, to, branchId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/shifts-report?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const { data: shiftDetails } = useQuery<any>({
    queryKey: ["/api/reports/shift-details", detailShiftId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/shift-details/${detailShiftId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!detailShiftId,
  });

  function exportCSV() {
    downloadCSV(`shifts-${from}-${to}.csv`, [
      [t("reports.tab_shifts"), `${from} → ${to}`],
      [],
      ["#", t("reports.table_branch"), t("reports.table_cashier"), t("reports.terminal_label"), t("reports.start_label"), t("reports.end_label"), t("reports.table_status"), t("reports.opening_balance"), t("reports.total_sales"), t("reports.shift_expected"), t("reports.shift_actual"), t("reports.difference")],
      ...shiftsData.map((s: any) => [
        s.id, s.branchName, s.cashierName, s.terminalName,
        fmtDateTime(s.startedAt, lang), s.endedAt ? fmtDateTime(s.endedAt, lang) : "-",
        s.status, omr(s.openingCash), omr(s.totalSales), omr(s.expectedCash), omr(s.actualCash), omr(s.difference),
      ]),
    ]);
  }

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t("reports.loading_report")}</div>;
  if (shiftsData.length === 0) return <EmptyState t={t} />;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{shiftsData.length} {t("reports.shifts_label")}</Badge>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} data-testid="button-export-shifts-csv">
          <Download className="w-4 h-4" />{t("reports.export_csv")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("reports.table_branch")}</TableHead>
                  <TableHead>{t("reports.table_cashier")}</TableHead>
                  <TableHead>{t("reports.terminal_label")}</TableHead>
                  <TableHead>{t("reports.start_label")}</TableHead>
                  <TableHead>{t("reports.end_label")}</TableHead>
                  <TableHead>{t("reports.table_status")}</TableHead>
                  <TableHead className="text-center">{t("reports.opening_balance")}</TableHead>
                  <TableHead className="text-center">{t("reports.total_sales")}</TableHead>
                  <TableHead className="text-center">{t("reports.difference")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shiftsData.map((s: any) => (
                  <TableRow key={s.id} data-testid={`row-shift-${s.id}`}>
                    <TableCell className="font-mono">{s.id}</TableCell>
                    <TableCell>{s.branchName}</TableCell>
                    <TableCell>{s.cashierName || "-"}</TableCell>
                    <TableCell>{s.terminalName}</TableCell>
                    <TableCell className="text-sm">{fmtDateTime(s.startedAt, lang)}</TableCell>
                    <TableCell className="text-sm">{s.endedAt ? fmtDateTime(s.endedAt, lang) : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "open" ? "default" : "secondary"} className={s.status === "open" ? "bg-green-100 text-green-700 border-green-200" : ""}>
                        {s.status === "open" ? t("reports.open") : t("reports.closed")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">{omr(s.openingCash)}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{omr(s.totalSales)}</TableCell>
                    <TableCell className="text-center font-mono">
                      {s.status === "closed" ? (
                        <span className={parseFloat(s.difference || "0") === 0 ? "text-green-600" : "text-red-600"}>
                          {omr(s.difference)}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setDetailShiftId(s.id)} data-testid={`button-shift-details-${s.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detailShiftId} onOpenChange={(open) => { if (!open) setDetailShiftId(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("reports.shift_details_title").replace("{0}", String(detailShiftId || ""))}</DialogTitle>
          </DialogHeader>
          {shiftDetails && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg border text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span><strong>{t("reports.cashier_label")}:</strong> {shiftDetails.cashierName || "-"}</span>
                  <span><strong>{t("reports.terminal_label")}:</strong> {shiftDetails.shift?.terminalName}</span>
                  <span><strong>{t("reports.start_label")}:</strong> {fmtDateTime(shiftDetails.shift?.startedAt, lang)}</span>
                  <span><strong>{t("reports.end_label")}:</strong> {shiftDetails.shift?.endedAt ? fmtDateTime(shiftDetails.shift.endedAt, lang) : t("reports.open")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard title={t("reports.cash_sales")} value={omr(shiftDetails.salesCash?.total)} icon={Banknote} color="text-green-600" />
                <StatCard title={t("reports.card_sales")} value={omr(shiftDetails.salesCard?.total)} icon={CreditCard} color="text-blue-600" />
                <StatCard title={t("reports.total_sales")} value={omr(shiftDetails.totalSales)} icon={TrendingUp} color="text-emerald-600" />
                <StatCard title={t("reports.net_profit")} value={omr(shiftDetails.netTotal)} icon={DollarSign} color={parseFloat(shiftDetails.netTotal || "0") >= 0 ? "text-emerald-700" : "text-red-700"} />
              </div>

              {shiftDetails.sales?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("reports.shift_invoices")} ({shiftDetails.sales.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead>{t("reports.table_invoice")}</TableHead>
                          <TableHead>{t("reports.table_time")}</TableHead>
                          <TableHead className="text-center">{t("reports.table_total")}</TableHead>
                          <TableHead>{t("reports.table_payment")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shiftDetails.sales.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-sm">{s.invoiceNumber || `#${s.id}`}</TableCell>
                            <TableCell className="text-sm">{fmtTime(s.createdAt, lang)}</TableCell>
                            <TableCell className="text-center font-mono font-bold">{omr(s.total)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{pmLabel(s.paymentMethod, t)}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {shiftDetails.expenses?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("reports.shift_expenses")} ({shiftDetails.expenses.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead>{t("reports.category_label")}</TableHead>
                          <TableHead className="text-center">{t("reports.amount_label")}</TableHead>
                          <TableHead>{t("reports.source_label")}</TableHead>
                          <TableHead>{t("reports.note_label")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shiftDetails.expenses.map((e: any) => (
                          <TableRow key={e.id}>
                            <TableCell>{e.category}</TableCell>
                            <TableCell className="text-center font-mono text-red-600">{omr(e.amount)}</TableCell>
                            <TableCell>{e.source}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{e.note || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {shiftDetails.shift?.status === "closed" && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("reports.cash_recon")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">{t("reports.opening_balance")}</TableCell>
                          <TableCell className="font-mono">{omr(shiftDetails.openingCash)} OMR</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-green-600">{t("reports.plus_cash_sales")}</TableCell>
                          <TableCell className="font-mono text-green-600">+{omr(shiftDetails.salesCash?.total)} OMR</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium text-red-600">{t("reports.minus_cash_expenses")}</TableCell>
                          <TableCell className="font-mono text-red-600">-{omr(shiftDetails.expensesCash?.total)} OMR</TableCell>
                        </TableRow>
                        <TableRow className="border-t-2">
                          <TableCell className="font-bold">{t("reports.expected_cash")}</TableCell>
                          <TableCell className="font-mono font-bold">{omr(shiftDetails.expectedCash)} OMR</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{t("reports.actual_cash")}</TableCell>
                          <TableCell className="font-mono">{omr(shiftDetails.actualCash)} OMR</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-bold">{t("reports.difference")}</TableCell>
                          <TableCell className={`font-mono font-bold ${parseFloat(shiftDetails.difference || "0") === 0 ? "text-green-600" : "text-red-600"}`}>
                            {omr(shiftDetails.difference)} OMR
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductsTab({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const { t } = useI18n();
  const params = `from=${from}&to=${to}${branchId ? `&branchId=${branchId}` : ""}`;
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/reports/products-report", from, to, branchId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/products-report?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  function exportCSV() {
    downloadCSV(`products-${from}-${to}.csv`, [
      [t("reports.tab_products"), `${from} → ${to}`],
      [],
      [t("reports.product_name"), t("reports.product_qty"), t("reports.product_revenue"), t("reports.product_cost"), t("reports.product_profit"), t("reports.product_margin")],
      ...data.map((p: any) => [p.productName, p.quantity, p.revenue, p.cost, p.profit, `${p.margin || 0}%`]),
    ]);
  }

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t("reports.loading_report")}</div>;
  if (data.length === 0) return <EmptyState t={t} />;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{data.length} {t("reports.product_name")}</Badge>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} data-testid="button-export-products-csv">
          <Download className="w-4 h-4" />{t("reports.export_csv")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("reports.product_name")}</TableHead>
                  <TableHead className="text-center">{t("reports.product_qty")}</TableHead>
                  <TableHead className="text-center">{t("reports.product_revenue")}</TableHead>
                  <TableHead className="text-center">{t("reports.product_cost")}</TableHead>
                  <TableHead className="text-center">{t("reports.product_profit")}</TableHead>
                  <TableHead className="text-center">{t("reports.product_margin")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p: any, idx: number) => {
                  const profit = parseFloat(p.profit || "0");
                  const margin = parseFloat(p.margin || "0");
                  return (
                    <TableRow key={p.productId || idx} data-testid={`row-product-${p.productId}`}>
                      <TableCell className="font-medium">{p.productName}</TableCell>
                      <TableCell className="text-center">{p.quantity}</TableCell>
                      <TableCell className="text-center font-mono">{omr(p.revenue)}</TableCell>
                      <TableCell className="text-center font-mono text-orange-600">{omr(p.cost)}</TableCell>
                      <TableCell className={`text-center font-mono font-bold ${profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>{omr(p.profit)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={margin >= 20 ? "default" : margin >= 0 ? "secondary" : "destructive"} className={margin >= 20 ? "bg-green-100 text-green-700" : ""}>
                          {margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CategoriesTab({ from, to, branchId }: { from: string; to: string; branchId?: number }) {
  const { t } = useI18n();
  const params = `from=${from}&to=${to}${branchId ? `&branchId=${branchId}` : ""}`;
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/reports/categories-report", from, to, branchId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/categories-report?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  function exportCSV() {
    downloadCSV(`categories-${from}-${to}.csv`, [
      [t("reports.tab_categories"), `${from} → ${to}`],
      [],
      [t("reports.category_name"), t("reports.category_qty"), t("reports.category_revenue"), t("reports.category_cost"), t("reports.category_profit"), t("reports.margin")],
      ...data.map((c: any) => [c.categoryName, c.qtySold, c.revenue, c.cogs, c.profit, `${c.margin}%`]),
    ]);
  }

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t("reports.loading_report")}</div>;
  if (data.length === 0) return <EmptyState t={t} />;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{data.length} {t("reports.category_name")}</Badge>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} data-testid="button-export-categories-csv">
          <Download className="w-4 h-4" />{t("reports.export_csv")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("reports.category_name")}</TableHead>
                  <TableHead className="text-center">{t("reports.category_qty")}</TableHead>
                  <TableHead className="text-center">{t("reports.category_revenue")}</TableHead>
                  <TableHead className="text-center">{t("reports.category_cost")}</TableHead>
                  <TableHead className="text-center">{t("reports.category_profit")}</TableHead>
                  <TableHead className="text-center">{t("reports.margin")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c: any, idx: number) => {
                  const profit = parseFloat(c.profit || "0");
                  const margin = parseFloat(c.margin || "0");
                  return (
                    <TableRow key={c.categoryId || idx} data-testid={`row-category-${c.categoryId}`}>
                      <TableCell className="font-medium">{c.categoryName}</TableCell>
                      <TableCell className="text-center">{c.qtySold}</TableCell>
                      <TableCell className="text-center font-mono">{omr(c.revenue)}</TableCell>
                      <TableCell className="text-center font-mono text-orange-600">{omr(c.cogs)}</TableCell>
                      <TableCell className={`text-center font-mono font-bold ${profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>{omr(c.profit)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={margin >= 20 ? "default" : margin >= 0 ? "secondary" : "destructive"} className={margin >= 20 ? "bg-green-100 text-green-700" : ""}>
                          {margin}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BranchesTab({ from, to }: { from: string; to: string }) {
  const { t } = useI18n();
  const params = `from=${from}&to=${to}`;
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/branch-comparison-range", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/branch-comparison-range?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  function exportCSV() {
    if (!data) return;
    downloadCSV(`branches-${from}-${to}.csv`, [
      [t("reports.tab_branches"), `${from} → ${to}`],
      [],
      [t("reports.branch_name"), t("reports.revenue"), t("reports.cost"), t("reports.gross_profit"), t("reports.total_expenses"), t("reports.net_profit"), t("reports.margin")],
      ...data.branches.map((b: any) => [b.branchName, b.totalSales, b.cogsTotal, b.grossProfit, b.totalExpenses, b.netProfit, `${b.margin}%`]),
    ]);
  }

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t("reports.loading_report")}</div>;
  if (!data || data.branches.length === 0) return <EmptyState t={t} />;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} data-testid="button-export-branches-csv">
          <Download className="w-4 h-4" />{t("reports.export_csv")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("reports.branch_comp_title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>{t("reports.branch_name")}</TableHead>
                  <TableHead className="text-center">{t("reports.revenue")}</TableHead>
                  <TableHead className="text-center">{t("reports.cost")}</TableHead>
                  <TableHead className="text-center">{t("reports.gross_profit")}</TableHead>
                  <TableHead className="text-center">{t("reports.total_expenses")}</TableHead>
                  <TableHead className="text-center">{t("reports.net_profit")}</TableHead>
                  <TableHead className="text-center">{t("reports.margin")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.branches.map((b: any) => (
                  <TableRow key={b.branchId} data-testid={`row-branch-${b.branchId}`}>
                    <TableCell className="font-medium">{b.branchName}</TableCell>
                    <TableCell className="text-center font-mono">{omr(b.totalSales)}</TableCell>
                    <TableCell className="text-center font-mono text-orange-600">{omr(b.cogsTotal)}</TableCell>
                    <TableCell className="text-center font-mono text-blue-600">{omr(b.grossProfit)}</TableCell>
                    <TableCell className="text-center font-mono text-red-500">{omr(b.totalExpenses)}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-emerald-700">{omr(b.netProfit)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{b.margin}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Reports() {
  const { t } = useI18n();
  const { data: authData } = useAuth();
  const user = authData?.user;
  const isOwner = user?.role === "owner" || user?.role === "admin";

  const [fromDate, setFromDate] = useState(startOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const branchId = selectedBranch !== "all" ? Number(selectedBranch) : undefined;

  const tabs = [
    { id: "overview", label: t("reports.tab_overview"), icon: BarChart3 },
    { id: "sales", label: t("reports.tab_sales"), icon: ShoppingBag },
    { id: "payments", label: t("reports.tab_payments"), icon: CreditCard },
    { id: "shifts", label: t("reports.tab_shifts"), icon: Calendar },
    { id: "products", label: t("reports.tab_products"), icon: Package },
    { id: "categories", label: t("reports.tab_categories"), icon: Layers },
    ...(isOwner ? [{ id: "branches", label: t("reports.tab_branches"), icon: GitBranch }] : []),
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-reports-title">{t("reports.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("reports.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("reports.from_label")}</label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-44" data-testid="input-from-date" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("reports.to_label")}</label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-44" data-testid="input-to-date" />
            </div>
            {activeTab !== "branches" && (
              <div className="space-y-1 min-w-[200px]">
                <label className="text-sm font-medium">{t("reports.branch_label")}</label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger data-testid="select-report-branch"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("reports.all_branches")}</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1.5 text-sm" data-testid={`tab-${tab.id}`}>
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          <TabsContent value="overview" className="mt-0">
            <OverviewTab from={fromDate} to={toDate} branchId={branchId} />
          </TabsContent>
          <TabsContent value="sales" className="mt-0">
            <SalesTab from={fromDate} to={toDate} branchId={branchId} />
          </TabsContent>
          <TabsContent value="payments" className="mt-0">
            <PaymentsTab from={fromDate} to={toDate} branchId={branchId} />
          </TabsContent>
          <TabsContent value="shifts" className="mt-0">
            <ShiftsTab from={fromDate} to={toDate} branchId={branchId} />
          </TabsContent>
          <TabsContent value="products" className="mt-0">
            <ProductsTab from={fromDate} to={toDate} branchId={branchId} />
          </TabsContent>
          <TabsContent value="categories" className="mt-0">
            <CategoriesTab from={fromDate} to={toDate} branchId={branchId} />
          </TabsContent>
          {isOwner && (
            <TabsContent value="branches" className="mt-0">
              <BranchesTab from={fromDate} to={toDate} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
