import { useState } from "react";
import { Calendar, Clock, Download, Banknote, CreditCard, Building2, TrendingUp, TrendingDown, DollarSign, ArrowLeftRight, BarChart3, Package, FileSpreadsheet, FileText, Users, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { Branch } from "@shared/schema";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function fmtTime(ts: string | null, lang: string) {
  if (!ts) return "-";
  return new Date(ts).toLocaleTimeString(lang === "ar" ? "ar-OM" : "en-US", { hour: "2-digit", minute: "2-digit" });
}

function omr(val: string | number | null) {
  if (val === null || val === undefined) return "0.000";
  return parseFloat(String(val)).toFixed(3);
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

function ShiftReport() {
  const { t, lang } = useI18n();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]));

  const { data: dayShifts = [] } = useQuery<any[]>({
    queryKey: ["/api/reports/shifts-by-date", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/shifts-by-date?date=${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!selectedDate,
  });

  const { data: report } = useQuery<any>({
    queryKey: ["/api/reports/shift", selectedShiftId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/shift?shiftId=${selectedShiftId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!selectedShiftId,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("reports.date_label")}</label>
          <Input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedShiftId(""); }} className="w-44" data-testid="input-shift-report-date" />
        </div>
        <div className="space-y-1 min-w-[220px]">
          <label className="text-sm font-medium">{t("reports.select_shift")}</label>
          <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
            <SelectTrigger data-testid="select-shift-report"><SelectValue placeholder={t("reports.select_shift_placeholder")} /></SelectTrigger>
            <SelectContent>
              {dayShifts.length === 0 && (
                <div className="p-3 text-center text-sm text-muted-foreground">{t("reports.no_shifts_day")}</div>
              )}
              {dayShifts.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  #{s.id} - {s.cashierName || "—"} ({s.terminalName}) - {fmtTime(s.startedAt, lang)}
                  {s.status === "open" ? " 🟢" : " 🔴"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {report && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="p-4 bg-muted/30 rounded-xl border space-y-1 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span><strong>{t("reports.shift_prefix")}:</strong> #{report.shift.id}</span>
              <span><strong>{t("reports.cashier_label")}:</strong> {report.cashierName || "—"}</span>
              <span><strong>{t("reports.terminal_label")}:</strong> {report.shift.terminalName}</span>
              <span><strong>{t("reports.branch_label")}:</strong> {branchMap[report.shift.branchId] || "—"}</span>
              <span><strong>{t("reports.start_label")}:</strong> {fmtTime(report.shift.startedAt, lang)}</span>
              <span><strong>{t("reports.end_label")}:</strong> {report.shift.endedAt ? fmtTime(report.shift.endedAt, lang) : t("reports.open")}</span>
              <Badge variant={report.shift.status === "open" ? "default" : "secondary"}>
                {report.shift.status === "open" ? t("reports.open") : t("reports.closed")}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title={t("reports.cash_sales")} value={omr(report.salesCash.total)} sub={`${report.salesCash.count} ${t("common.transaction")}`} icon={Banknote} color="text-green-600" />
            <StatCard title={t("reports.card_sales")} value={omr(report.salesCard.total)} sub={`${report.salesCard.count} ${t("common.transaction")}`} icon={CreditCard} color="text-blue-600" />
            <StatCard title={t("reports.bank_sales")} value={omr(report.salesBankTransfer.total)} sub={`${report.salesBankTransfer.count} ${t("common.transaction")}`} icon={Building2} color="text-purple-600" />
            <StatCard title={t("reports.total_sales_report")} value={omr(report.totalSales)} icon={TrendingUp} color="text-emerald-600" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title={t("reports.cash_expenses")} value={omr(report.expensesCash.total)} sub={`${report.expensesCash.count} ${t("nav.expenses")}`} icon={TrendingDown} color="text-red-500" />
            <StatCard title={t("reports.bank_expenses")} value={omr(report.expensesBank.total)} sub={`${report.expensesBank.count} ${t("nav.expenses")}`} icon={TrendingDown} color="text-orange-500" />
            <StatCard title={t("reports.total_expenses")} value={omr(report.totalExpenses)} icon={TrendingDown} color="text-red-600" />
            <StatCard title={t("reports.net_profit")} value={omr(report.netTotal)} icon={DollarSign} color={parseFloat(report.netTotal) >= 0 ? "text-emerald-700" : "text-red-700"} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("reports.cash_recon")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">{t("reports.opening_balance")}</TableCell>
                    <TableCell className="text-left font-mono">{omr(report.openingCash)} OMR</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-green-600">{t("reports.plus_cash_sales")}</TableCell>
                    <TableCell className="text-left font-mono text-green-600">+{omr(report.salesCash.total)} OMR</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-red-600">{t("reports.minus_cash_expenses")}</TableCell>
                    <TableCell className="text-left font-mono text-red-600">-{omr(report.expensesCash.total)} OMR</TableCell>
                  </TableRow>
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold">{t("reports.expected_cash")}</TableCell>
                    <TableCell className="text-left font-mono font-bold">{omr(report.expectedCash)} OMR</TableCell>
                  </TableRow>
                  {report.actualCash !== null && (
                    <>
                      <TableRow>
                        <TableCell className="font-medium">{t("reports.actual_cash")}</TableCell>
                        <TableCell className="text-left font-mono">{omr(report.actualCash)} OMR</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold">{t("reports.difference")}</TableCell>
                        <TableCell className={`text-left font-mono font-bold ${parseFloat(report.difference || "0") === 0 ? "text-green-600" : "text-red-600"}`}>
                          {omr(report.difference)} OMR
                          {parseFloat(report.difference || "0") === 0 && " ✓"}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {!report && selectedShiftId && (
        <div className="text-center py-12 text-muted-foreground">{t("reports.loading_report")}</div>
      )}
      {!selectedShiftId && (
        <div className="text-center py-12 text-muted-foreground">{t("reports.select_shift_to_view")}</div>
      )}
    </div>
  );
}

function DailyReport() {
  const { t, lang } = useI18n();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]));

  const branchParam = selectedBranch !== "all" ? `&branchId=${selectedBranch}` : "";
  const { data: report } = useQuery<any>({
    queryKey: ["/api/reports/daily", selectedDate, selectedBranch],
    queryFn: async () => {
      const res = await fetch(`/api/reports/daily?date=${selectedDate}${branchParam}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!selectedDate,
  });

  function exportCSV() {
    if (!report) return;
    const bom = "\uFEFF";
    const rows = [
      [t("reports.daily_report_title"), report.date, selectedBranch !== "all" ? branchMap[Number(selectedBranch)] || "" : t("reports.all_branches")],
      [],
      [t("reports.item_label"), t("reports.amount_omr"), t("reports.count_label")],
      [t("reports.cash_sales"), report.salesCash.total, report.salesCash.count],
      [t("reports.card_sales"), report.salesCard.total, report.salesCard.count],
      [t("reports.bank_sales"), report.salesBankTransfer.total, report.salesBankTransfer.count],
      [t("reports.total_sales_report"), report.totalSales, ""],
      [],
      [t("reports.cogs"), report.cogsTotal, ""],
      [t("reports.gross_profit"), report.grossProfit, ""],
      [],
      [t("reports.cash_expenses"), report.expensesCash.total, report.expensesCash.count],
      [t("reports.bank_expenses"), report.expensesBank.total, report.expensesBank.count],
      [t("reports.total_expenses"), report.totalExpenses, ""],
      [],
      [t("reports.net_profit"), report.netProfit, ""],
      [],
      [t("reports.opening_balance"), report.openingCash, ""],
      [t("reports.cash_closing_est"), report.cashClosingBalance, ""],
      [t("reports.total_differences"), report.differencesSum, ""],
      [],
      [t("reports.shifts_label")],
      ["#", t("reports.cashier_label"), t("reports.terminal_label"), t("reports.start_label"), t("reports.end_label"), t("common.status"), t("reports.revenue"), t("reports.opening_balance")],
      ...report.shifts.map((s: any) => [
        s.id,
        "",
        s.terminalName,
        s.startedAt ? new Date(s.startedAt).toLocaleTimeString(lang === "ar" ? "ar-OM" : "en-US") : "",
        s.endedAt ? new Date(s.endedAt).toLocaleTimeString(lang === "ar" ? "ar-OM" : "en-US") : t("reports.open"),
        s.status === "open" ? t("reports.open") : t("reports.closed"),
        omr(s.totalSales),
        omr(s.openingCash),
      ]),
    ];
    const csv = bom + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-report-${report.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("reports.date_label")}</label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" data-testid="input-daily-report-date" />
        </div>
        <div className="space-y-1 min-w-[200px]">
          <label className="text-sm font-medium">{t("reports.branch_label")}</label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger data-testid="select-daily-branch"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("reports.all_branches")}</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {report && (
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCSV} data-testid="button-export-csv">
              <Download className="w-4 h-4" />
              {t("reports.export_csv")}
            </Button>
            <Button variant="outline" className="gap-2" data-testid="button-export-xlsx"
              onClick={() => window.open(`/api/exports/daily.xlsx?date=${selectedDate}${branchParam}`, "_blank")}>
              <FileSpreadsheet className="w-4 h-4" />
              {t("reports.export_excel")}
            </Button>
            <Button variant="outline" className="gap-2" data-testid="button-export-pdf"
              onClick={() => window.open(`/api/exports/daily.pdf?date=${selectedDate}${branchParam}`, "_blank")}>
              <FileText className="w-4 h-4" />
              {t("reports.export_pdf")}
            </Button>
          </div>
        )}
      </div>

      {report && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title={t("reports.cash_sales")} value={omr(report.salesCash.total)} sub={`${report.salesCash.count} ${t("common.transaction")}`} icon={Banknote} color="text-green-600" />
            <StatCard title={t("reports.card_sales")} value={omr(report.salesCard.total)} sub={`${report.salesCard.count} ${t("common.transaction")}`} icon={CreditCard} color="text-blue-600" />
            <StatCard title={t("reports.bank_sales")} value={omr(report.salesBankTransfer.total)} sub={`${report.salesBankTransfer.count} ${t("common.transaction")}`} icon={Building2} color="text-purple-600" />
            <StatCard title={t("reports.total_sales_report")} value={omr(report.totalSales)} icon={TrendingUp} color="text-emerald-600" />
          </div>

          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                {t("reports.profit_analysis")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-white rounded-lg border text-center" data-testid="stat-total-sales">
                  <p className="text-xs text-muted-foreground">{t("reports.total_sales_report")}</p>
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
                  <p className="text-xs text-muted-foreground">{t("nav.expenses")}</p>
                  <p className="text-lg font-bold text-red-600 mt-1">{omr(report.totalExpenses)}</p>
                  <p className="text-[10px] text-muted-foreground">OMR</p>
                </div>
                <div className="p-3 bg-white rounded-lg border-2 border-primary/30 text-center" data-testid="stat-net-profit">
                  <p className="text-xs text-muted-foreground font-medium">{t("reports.net_profit")}</p>
                  <p className={`text-xl font-bold mt-1 ${parseFloat(report.netProfit) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{omr(report.netProfit)}</p>
                  <p className="text-[10px] text-muted-foreground">OMR</p>
                </div>
              </div>
              {lang === "ar" && (
                <div className="mt-3 p-2 bg-white rounded border text-xs text-muted-foreground text-center">
                  {t("reports.profit_formula")}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard title={t("reports.cash_expenses")} value={omr(report.expensesCash.total)} sub={`${report.expensesCash.count}`} icon={TrendingDown} color="text-red-500" />
            <StatCard title={t("reports.bank_expenses")} value={omr(report.expensesBank.total)} sub={`${report.expensesBank.count}`} icon={TrendingDown} color="text-orange-500" />
            <StatCard title={t("reports.net_today")} value={omr(report.net)} icon={DollarSign} color={parseFloat(report.net) >= 0 ? "text-emerald-700" : "text-red-700"} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("reports.cash_summary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    {parseFloat(report.differencesSum) === 0 && " ✓"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {report.shifts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("reports.shifts_count").replace("{0}", report.shifts.length)}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t("reports.branch_label")}</TableHead>
                      <TableHead>{t("reports.terminal_label")}</TableHead>
                      <TableHead>{t("reports.start_label")}</TableHead>
                      <TableHead>{t("reports.end_label")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("reports.revenue")}</TableHead>
                      <TableHead>{t("reports.opening_balance")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.shifts.map((s: any) => (
                      <TableRow key={s.id} data-testid={`row-shift-${s.id}`}>
                        <TableCell className="font-mono">{s.id}</TableCell>
                        <TableCell>{branchMap[s.branchId] || "—"}</TableCell>
                        <TableCell>{s.terminalName}</TableCell>
                        <TableCell>{fmtTime(s.startedAt, lang)}</TableCell>
                        <TableCell>{s.endedAt ? fmtTime(s.endedAt, lang) : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === "open" ? "default" : "secondary"} className={s.status === "open" ? "bg-green-100 text-green-700 border-green-200" : ""}>
                            {s.status === "open" ? t("reports.open") : t("reports.closed")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{omr(s.totalSales)}</TableCell>
                        <TableCell className="font-mono">{omr(s.openingCash)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!report && (
        <div className="text-center py-12 text-muted-foreground">{t("reports.select_date")}</div>
      )}
    </div>
  );
}

function BranchComparison() {
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const { data: report } = useQuery<any>({
    queryKey: ["/api/reports/branch-comparison", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/branch-comparison?date=${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!selectedDate,
  });

  function exportCSV() {
    if (!report) return;
    const bom = "\uFEFF";
    const rows = [
      [t("reports.branch_comp_title"), report.date],
      [],
      [t("reports.branch_label"), t("reports.revenue"), t("reports.cost"), t("reports.gross_profit"), t("nav.expenses"), t("reports.net_profit")],
      ...report.branches.map((b: any) => [
        b.branchName,
        b.totalSales,
        b.cogsTotal,
        b.grossProfit,
        b.totalExpenses,
        b.netProfit
      ]),
    ];
    const csv = bom + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch-comparison-${report.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("reports.date_label")}</label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" data-testid="input-branch-comp-date" />
        </div>
        {report && (
          <Button variant="outline" className="gap-2" onClick={exportCSV} data-testid="button-export-branch-csv">
            <Download className="w-4 h-4" />
            {t("reports.export_csv")}
          </Button>
        )}
      </div>

      {report && report.branches.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.branch_comp_title")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.branch_label")}</TableHead>
                  <TableHead className="text-center">{t("reports.revenue")}</TableHead>
                  <TableHead className="text-center">{t("reports.cost")}</TableHead>
                  <TableHead className="text-center">{t("reports.gross_profit")}</TableHead>
                  <TableHead className="text-center">{t("nav.expenses")}</TableHead>
                  <TableHead className="text-center">{t("reports.net_profit")}</TableHead>
                  <TableHead className="text-center">{t("reports.margin")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.branches.map((b: any) => (
                  <TableRow key={b.branchId} data-testid={`row-branch-${b.branchId}`}>
                    <TableCell className="font-medium">{b.branchName}</TableCell>
                    <TableCell className="text-center font-mono">{omr(b.totalSales)}</TableCell>
                    <TableCell className="text-center font-mono text-orange-600">{omr(b.cogsTotal)}</TableCell>
                    <TableCell className="text-center font-mono text-blue-600">{omr(b.grossProfit)}</TableCell>
                    <TableCell className="text-center font-mono text-red-500">{omr(b.totalExpenses)}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-emerald-700">{omr(b.netProfit)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{b.profitMargin}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : report ? (
        <div className="text-center py-12 text-muted-foreground">{t("reports.no_data_date")}</div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">{t("reports.select_date")}</div>
      )}
    </div>
  );
}

function ProductReport() {
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const { data: report } = useQuery<any>({
    queryKey: ["/api/reports/products", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/products?date=${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!selectedDate,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("reports.date_label")}</label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" data-testid="input-product-report-date" />
        </div>
      </div>

      {report && report.products.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.top_products")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.product_name")}</TableHead>
                  <TableHead className="text-center">{t("reports.qty_sold")}</TableHead>
                  <TableHead className="text-center">{t("reports.revenue")}</TableHead>
                  <TableHead className="text-center">{t("reports.cost")}</TableHead>
                  <TableHead className="text-center">{t("reports.product_profit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.products.map((p: any) => (
                  <TableRow key={p.productId} data-testid={`row-product-${p.productId}`}>
                    <TableCell className="font-medium">{p.productName}</TableCell>
                    <TableCell className="text-center">{p.quantity}</TableCell>
                    <TableCell className="text-center font-mono">{omr(p.revenue)}</TableCell>
                    <TableCell className="text-center font-mono text-orange-600">{omr(p.cost)}</TableCell>
                    <TableCell className="text-center font-mono text-emerald-700">{omr(p.profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : report ? (
        <div className="text-center py-12 text-muted-foreground">{t("reports.no_data_date")}</div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">{t("reports.select_date")}</div>
      )}
    </div>
  );
}

function CategoryReport() {
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const { data: report } = useQuery<any>({
    queryKey: ["/api/reports/categories", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/categories?date=${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!selectedDate,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("reports.date_label")}</label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" data-testid="input-category-report-date" />
        </div>
      </div>

      {report && report.categories.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.category_comp")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.category_name")}</TableHead>
                  <TableHead className="text-center">{t("reports.qty_sold")}</TableHead>
                  <TableHead className="text-center">{t("reports.revenue")}</TableHead>
                  <TableHead className="text-center">{t("reports.cost")}</TableHead>
                  <TableHead className="text-center">{t("reports.category_profit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.categories.map((c: any) => (
                  <TableRow key={c.category} data-testid={`row-category-${c.category}`}>
                    <TableCell className="font-medium">{c.category || "—"}</TableCell>
                    <TableCell className="text-center">{c.quantity}</TableCell>
                    <TableCell className="text-center font-mono">{omr(c.revenue)}</TableCell>
                    <TableCell className="text-center font-mono text-orange-600">{omr(c.cost)}</TableCell>
                    <TableCell className="text-center font-mono text-emerald-700">{omr(c.profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : report ? (
        <div className="text-center py-12 text-muted-foreground">{t("reports.no_data_date")}</div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">{t("reports.select_date")}</div>
      )}
    </div>
  );
}

function PaymentReport() {
  const { t } = useI18n();
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const { data: report } = useQuery<any>({
    queryKey: ["/api/reports/payments", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/payments?date=${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    enabled: !!selectedDate,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("reports.date_label")}</label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" data-testid="input-payment-report-date" />
        </div>
      </div>

      {report && report.methods.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.payment_methods_summary")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.pm_method")}</TableHead>
                  <TableHead className="text-center">{t("reports.pm_count")}</TableHead>
                  <TableHead className="text-center">{t("reports.pm_total")}</TableHead>
                  <TableHead className="text-center">{t("reports.pm_percentage")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.methods.map((m: any) => (
                  <TableRow key={m.method} data-testid={`row-payment-${m.method}`}>
                    <TableCell className="font-medium">
                      {m.method === "cash" ? t("payment_methods.cash") :
                       m.method === "card" ? t("payment_methods.card") :
                       m.method === "bank_transfer" ? t("payment_methods.bank_transfer") : m.method}
                    </TableCell>
                    <TableCell className="text-center">{m.count}</TableCell>
                    <TableCell className="text-center font-mono">{omr(m.total)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{m.percentage}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : report ? (
        <div className="text-center py-12 text-muted-foreground">{t("reports.no_data_date")}</div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">{t("reports.select_date")}</div>
      )}
    </div>
  );
}

export default function Reports() {
  const { t } = useI18n();
  const { user } = useAuth();

  if (user?.role !== "owner" && user?.role !== "admin") {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Clock className="w-16 h-16 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">{t("executive.unauthorized")}</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("reports.title")}</h1>
        <p className="text-muted-foreground">{t("reports.subtitle")}</p>
      </div>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="daily" className="gap-2" data-testid="tab-daily">
            <BarChart3 className="w-4 h-4" />
            {t("reports.daily_sales")}
          </TabsTrigger>
          <TabsTrigger value="shift" className="gap-2" data-testid="tab-shift">
            <Clock className="w-4 h-4" />
            {t("reports.shift_reports")}
          </TabsTrigger>
          <TabsTrigger value="product" className="gap-2" data-testid="tab-product">
            <Package className="w-4 h-4" />
            {t("reports.product_reports")}
          </TabsTrigger>
          <TabsTrigger value="category" className="gap-2" data-testid="tab-category">
            <FileSpreadsheet className="w-4 h-4" />
            {t("reports.category_reports")}
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-2" data-testid="tab-branches">
            <Building2 className="w-4 h-4" />
            {t("reports.branch_compare")}
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2" data-testid="tab-payments">
            <CreditCard className="w-4 h-4" />
            {t("reports.payment_reports")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4"><DailyReport /></TabsContent>
        <TabsContent value="shift" className="space-y-4"><ShiftReport /></TabsContent>
        <TabsContent value="product" className="space-y-4"><ProductReport /></TabsContent>
        <TabsContent value="category" className="space-y-4"><CategoryReport /></TabsContent>
        <TabsContent value="branches" className="space-y-4"><BranchComparison /></TabsContent>
        <TabsContent value="payments" className="space-y-4"><PaymentReport /></TabsContent>
      </Tabs>
    </div>
  );
}