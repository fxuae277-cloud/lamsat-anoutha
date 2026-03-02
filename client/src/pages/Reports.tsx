import { useState } from "react";
import { Calendar, Clock, Download, Banknote, CreditCard, Building2, TrendingUp, TrendingDown, DollarSign, ArrowLeftRight, BarChart3, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { Branch } from "@shared/schema";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(ts: string | null) {
  if (!ts) return "-";
  return new Date(ts).toLocaleTimeString("ar-OM", { hour: "2-digit", minute: "2-digit" });
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
          <label className="text-sm font-medium">التاريخ</label>
          <Input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedShiftId(""); }} className="w-44" data-testid="input-shift-report-date" />
        </div>
        <div className="space-y-1 min-w-[220px]">
          <label className="text-sm font-medium">اختر الشفت</label>
          <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
            <SelectTrigger data-testid="select-shift-report"><SelectValue placeholder="اختر شفت..." /></SelectTrigger>
            <SelectContent>
              {dayShifts.length === 0 && (
                <div className="p-3 text-center text-sm text-muted-foreground">لا توجد شفتات في هذا اليوم</div>
              )}
              {dayShifts.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  #{s.id} - {s.cashierName || "—"} ({s.terminalName}) - {fmtTime(s.startedAt)}
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
              <span><strong>الشفت:</strong> #{report.shift.id}</span>
              <span><strong>الكاشير:</strong> {report.cashierName || "—"}</span>
              <span><strong>الجهاز:</strong> {report.shift.terminalName}</span>
              <span><strong>الفرع:</strong> {branchMap[report.shift.branchId] || "—"}</span>
              <span><strong>البداية:</strong> {fmtTime(report.shift.startedAt)}</span>
              <span><strong>النهاية:</strong> {report.shift.endedAt ? fmtTime(report.shift.endedAt) : "مفتوح"}</span>
              <Badge variant={report.shift.status === "open" ? "default" : "secondary"}>
                {report.shift.status === "open" ? "مفتوح" : "مغلق"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="مبيعات نقدي" value={omr(report.salesCash.total)} sub={`${report.salesCash.count} عملية`} icon={Banknote} color="text-green-600" />
            <StatCard title="مبيعات بطاقة" value={omr(report.salesCard.total)} sub={`${report.salesCard.count} عملية`} icon={CreditCard} color="text-blue-600" />
            <StatCard title="تحويل بنكي" value={omr(report.salesBankTransfer.total)} sub={`${report.salesBankTransfer.count} عملية`} icon={Building2} color="text-purple-600" />
            <StatCard title="إجمالي المبيعات" value={omr(report.totalSales)} icon={TrendingUp} color="text-emerald-600" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="مصروفات نقدي" value={omr(report.expensesCash.total)} sub={`${report.expensesCash.count} مصروف`} icon={TrendingDown} color="text-red-500" />
            <StatCard title="مصروفات بنكي" value={omr(report.expensesBank.total)} sub={`${report.expensesBank.count} مصروف`} icon={TrendingDown} color="text-orange-500" />
            <StatCard title="إجمالي المصروفات" value={omr(report.totalExpenses)} icon={TrendingDown} color="text-red-600" />
            <StatCard title="صافي الربح" value={omr(report.netTotal)} icon={DollarSign} color={parseFloat(report.netTotal) >= 0 ? "text-emerald-700" : "text-red-700"} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">تسوية الصندوق النقدي</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">رصيد الافتتاح</TableCell>
                    <TableCell className="text-left font-mono">{omr(report.openingCash)} OMR</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-green-600">+ مبيعات نقدي</TableCell>
                    <TableCell className="text-left font-mono text-green-600">+{omr(report.salesCash.total)} OMR</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-red-600">- مصروفات نقدي</TableCell>
                    <TableCell className="text-left font-mono text-red-600">-{omr(report.expensesCash.total)} OMR</TableCell>
                  </TableRow>
                  <TableRow className="border-t-2">
                    <TableCell className="font-bold">المتوقع في الصندوق</TableCell>
                    <TableCell className="text-left font-mono font-bold">{omr(report.expectedCash)} OMR</TableCell>
                  </TableRow>
                  {report.actualCash !== null && (
                    <>
                      <TableRow>
                        <TableCell className="font-medium">الفعلي في الصندوق</TableCell>
                        <TableCell className="text-left font-mono">{omr(report.actualCash)} OMR</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold">الفرق</TableCell>
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
        <div className="text-center py-12 text-muted-foreground">جارٍ تحميل التقرير...</div>
      )}
      {!selectedShiftId && (
        <div className="text-center py-12 text-muted-foreground">اختر شفتاً لعرض التقرير</div>
      )}
    </div>
  );
}

function DailyReport() {
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
      ["التقرير اليومي", report.date, selectedBranch !== "all" ? branchMap[Number(selectedBranch)] || "" : "جميع الفروع"],
      [],
      ["البند", "المبلغ (OMR)", "العدد"],
      ["مبيعات نقدي", report.salesCash.total, report.salesCash.count],
      ["مبيعات بطاقة", report.salesCard.total, report.salesCard.count],
      ["تحويل بنكي", report.salesBankTransfer.total, report.salesBankTransfer.count],
      ["إجمالي المبيعات", report.totalSales, ""],
      [],
      ["تكلفة البضاعة المباعة", report.cogsTotal, ""],
      ["إجمالي الربح", report.grossProfit, ""],
      [],
      ["مصروفات نقدي", report.expensesCash.total, report.expensesCash.count],
      ["مصروفات بنكي", report.expensesBank.total, report.expensesBank.count],
      ["إجمالي المصروفات", report.totalExpenses, ""],
      [],
      ["صافي الربح", report.netProfit, ""],
      [],
      ["رصيد افتتاح نقدي", report.openingCash, ""],
      ["رصيد إغلاق نقدي (تقديري)", report.cashClosingBalance, ""],
      ["مجموع الفروقات", report.differencesSum, ""],
      [],
      ["الشفتات"],
      ["#", "الكاشير", "الجهاز", "البداية", "النهاية", "الحالة", "المبيعات", "رصيد الافتتاح"],
      ...report.shifts.map((s: any) => [
        s.id,
        "",
        s.terminalName,
        s.startedAt ? new Date(s.startedAt).toLocaleTimeString("ar-OM") : "",
        s.endedAt ? new Date(s.endedAt).toLocaleTimeString("ar-OM") : "مفتوح",
        s.status === "open" ? "مفتوح" : "مغلق",
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
          <label className="text-sm font-medium">التاريخ</label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" data-testid="input-daily-report-date" />
        </div>
        <div className="space-y-1 min-w-[200px]">
          <label className="text-sm font-medium">الفرع</label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger data-testid="select-daily-branch"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفروع</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {report && (
          <Button variant="outline" className="gap-2" onClick={exportCSV} data-testid="button-export-csv">
            <Download className="w-4 h-4" />
            تصدير CSV
          </Button>
        )}
      </div>

      {report && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="مبيعات نقدي" value={omr(report.salesCash.total)} sub={`${report.salesCash.count} عملية`} icon={Banknote} color="text-green-600" />
            <StatCard title="مبيعات بطاقة" value={omr(report.salesCard.total)} sub={`${report.salesCard.count} عملية`} icon={CreditCard} color="text-blue-600" />
            <StatCard title="تحويل بنكي" value={omr(report.salesBankTransfer.total)} sub={`${report.salesBankTransfer.count} عملية`} icon={Building2} color="text-purple-600" />
            <StatCard title="إجمالي المبيعات" value={omr(report.totalSales)} icon={TrendingUp} color="text-emerald-600" />
          </div>

          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                تحليل الربحية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-white rounded-lg border text-center" data-testid="stat-total-sales">
                  <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
                  <p className="text-lg font-bold text-emerald-600 mt-1">{omr(report.totalSales)}</p>
                  <p className="text-[10px] text-muted-foreground">OMR</p>
                </div>
                <div className="p-3 bg-white rounded-lg border text-center" data-testid="stat-cogs">
                  <p className="text-xs text-muted-foreground">تكلفة البضاعة (COGS)</p>
                  <p className="text-lg font-bold text-orange-600 mt-1">{omr(report.cogsTotal)}</p>
                  <p className="text-[10px] text-muted-foreground">OMR</p>
                </div>
                <div className="p-3 bg-white rounded-lg border text-center" data-testid="stat-gross-profit">
                  <p className="text-xs text-muted-foreground">إجمالي الربح</p>
                  <p className={`text-lg font-bold mt-1 ${parseFloat(report.grossProfit) >= 0 ? "text-blue-600" : "text-red-600"}`}>{omr(report.grossProfit)}</p>
                  <p className="text-[10px] text-muted-foreground">OMR</p>
                </div>
                <div className="p-3 bg-white rounded-lg border text-center" data-testid="stat-expenses">
                  <p className="text-xs text-muted-foreground">المصروفات</p>
                  <p className="text-lg font-bold text-red-600 mt-1">{omr(report.totalExpenses)}</p>
                  <p className="text-[10px] text-muted-foreground">OMR</p>
                </div>
                <div className="p-3 bg-white rounded-lg border-2 border-primary/30 text-center" data-testid="stat-net-profit">
                  <p className="text-xs text-muted-foreground font-medium">صافي الربح</p>
                  <p className={`text-xl font-bold mt-1 ${parseFloat(report.netProfit) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{omr(report.netProfit)}</p>
                  <p className="text-[10px] text-muted-foreground">OMR</p>
                </div>
              </div>
              <div className="mt-3 p-2 bg-white rounded border text-xs text-muted-foreground text-center">
                المبيعات - التكلفة = إجمالي الربح | إجمالي الربح - المصروفات = صافي الربح
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard title="مصروفات نقدي" value={omr(report.expensesCash.total)} sub={`${report.expensesCash.count}`} icon={TrendingDown} color="text-red-500" />
            <StatCard title="مصروفات بنكي" value={omr(report.expensesBank.total)} sub={`${report.expensesBank.count}`} icon={TrendingDown} color="text-orange-500" />
            <StatCard title="صافي اليوم (مبيعات - مصروفات)" value={omr(report.net)} icon={DollarSign} color={parseFloat(report.net) >= 0 ? "text-emerald-700" : "text-red-700"} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ملخص الصندوق النقدي</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg border text-center">
                  <p className="text-xs text-muted-foreground">رصيد الافتتاح</p>
                  <p className="text-lg font-bold mt-1">{omr(report.openingCash)} <span className="text-xs font-normal">OMR</span></p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border text-center">
                  <p className="text-xs text-muted-foreground">رصيد الإغلاق (تقديري)</p>
                  <p className="text-lg font-bold mt-1">{omr(report.cashClosingBalance)} <span className="text-xs font-normal">OMR</span></p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border text-center">
                  <p className="text-xs text-muted-foreground">مجموع الفروقات</p>
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
                <CardTitle className="text-base">الشفتات ({report.shifts.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>الجهاز</TableHead>
                      <TableHead>البداية</TableHead>
                      <TableHead>النهاية</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>المبيعات</TableHead>
                      <TableHead>رصيد الافتتاح</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.shifts.map((s: any) => (
                      <TableRow key={s.id} data-testid={`row-shift-${s.id}`}>
                        <TableCell className="font-mono">{s.id}</TableCell>
                        <TableCell>{branchMap[s.branchId] || "—"}</TableCell>
                        <TableCell>{s.terminalName}</TableCell>
                        <TableCell>{fmtTime(s.startedAt)}</TableCell>
                        <TableCell>{s.endedAt ? fmtTime(s.endedAt) : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === "open" ? "default" : "secondary"} className={s.status === "open" ? "bg-green-100 text-green-700 border-green-200" : ""}>
                            {s.status === "open" ? "مفتوح" : "مغلق"}
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
        <div className="text-center py-12 text-muted-foreground">اختر تاريخاً لعرض التقرير اليومي</div>
      )}
    </div>
  );
}

function BranchComparison() {
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
      ["مقارنة الفروع", report.date],
      [],
      ["الفرع", "المبيعات", "التكلفة (COGS)", "إجمالي الربح", "المصروفات", "صافي الربح"],
      ...report.branches.map((b: any) => [
        b.branchName,
        b.totalSales,
        b.cogsTotal,
        b.grossProfit,
        b.totalExpenses,
        b.netProfit,
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

  const totals = report?.branches?.reduce((acc: any, b: any) => ({
    totalSales: acc.totalSales + parseFloat(b.totalSales),
    cogsTotal: acc.cogsTotal + parseFloat(b.cogsTotal),
    grossProfit: acc.grossProfit + parseFloat(b.grossProfit),
    totalExpenses: acc.totalExpenses + parseFloat(b.totalExpenses),
    netProfit: acc.netProfit + parseFloat(b.netProfit),
  }), { totalSales: 0, cogsTotal: 0, grossProfit: 0, totalExpenses: 0, netProfit: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">التاريخ</label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" data-testid="input-branch-comparison-date" />
        </div>
        {report && (
          <Button variant="outline" className="gap-2" onClick={exportCSV} data-testid="button-export-branch-csv">
            <Download className="w-4 h-4" />
            تصدير CSV
          </Button>
        )}
      </div>

      {report && report.branches && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard title="إجمالي المبيعات" value={omr(totals.totalSales)} icon={TrendingUp} color="text-emerald-600" />
            <StatCard title="التكلفة (COGS)" value={omr(totals.cogsTotal)} icon={Package} color="text-orange-600" />
            <StatCard title="إجمالي الربح" value={omr(totals.grossProfit)} icon={BarChart3} color="text-blue-600" />
            <StatCard title="المصروفات" value={omr(totals.totalExpenses)} icon={TrendingDown} color="text-red-600" />
            <StatCard title="صافي الربح" value={omr(totals.netProfit)} icon={DollarSign} color={totals.netProfit >= 0 ? "text-emerald-700" : "text-red-700"} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                مقارنة الفروع - {report.date}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>الفرع</TableHead>
                      <TableHead className="text-center">المبيعات</TableHead>
                      <TableHead className="text-center">التكلفة (COGS)</TableHead>
                      <TableHead className="text-center">إجمالي الربح</TableHead>
                      <TableHead className="text-center">المصروفات</TableHead>
                      <TableHead className="text-center">صافي الربح</TableHead>
                      <TableHead className="text-center">هامش الربح %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.branches.map((b: any) => {
                      const margin = parseFloat(b.totalSales) > 0
                        ? ((parseFloat(b.netProfit) / parseFloat(b.totalSales)) * 100).toFixed(1)
                        : "0.0";
                      return (
                        <TableRow key={b.branchId} data-testid={`row-branch-${b.branchId}`}>
                          <TableCell className="font-medium">{b.branchName}</TableCell>
                          <TableCell className="text-center font-mono text-emerald-600">{omr(b.totalSales)}</TableCell>
                          <TableCell className="text-center font-mono text-orange-600">{omr(b.cogsTotal)}</TableCell>
                          <TableCell className="text-center font-mono text-blue-600">{omr(b.grossProfit)}</TableCell>
                          <TableCell className="text-center font-mono text-red-600">{omr(b.totalExpenses)}</TableCell>
                          <TableCell className={`text-center font-mono font-bold ${parseFloat(b.netProfit) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {omr(b.netProfit)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={parseFloat(margin) >= 0 ? "default" : "destructive"} className={parseFloat(margin) >= 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                              {margin}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2 bg-muted/30 font-bold">
                      <TableCell>المجموع</TableCell>
                      <TableCell className="text-center font-mono text-emerald-600">{omr(totals.totalSales)}</TableCell>
                      <TableCell className="text-center font-mono text-orange-600">{omr(totals.cogsTotal)}</TableCell>
                      <TableCell className="text-center font-mono text-blue-600">{omr(totals.grossProfit)}</TableCell>
                      <TableCell className="text-center font-mono text-red-600">{omr(totals.totalExpenses)}</TableCell>
                      <TableCell className={`text-center font-mono ${totals.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {omr(totals.netProfit)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={totals.netProfit >= 0 ? "default" : "destructive"} className={totals.netProfit >= 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                          {totals.totalSales > 0 ? ((totals.netProfit / totals.totalSales) * 100).toFixed(1) : "0.0"}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!report && (
        <div className="text-center py-12 text-muted-foreground">اختر تاريخاً لعرض مقارنة الفروع</div>
      )}
    </div>
  );
}

export default function Reports() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-reports-title">التقارير المالية</h1>
        <p className="text-muted-foreground mt-1">تقارير الشفتات والتقارير اليومية مع تحليل الربحية ومقارنة الفروع.</p>
      </div>

      <Tabs defaultValue="shift" dir="rtl">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="shift" className="gap-1">
            <Clock className="w-4 h-4" />
            تقرير الشفت
          </TabsTrigger>
          <TabsTrigger value="daily" className="gap-1">
            <Calendar className="w-4 h-4" />
            التقرير اليومي
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-1" data-testid="tab-branch-comparison">
            <ArrowLeftRight className="w-4 h-4" />
            مقارنة الفروع
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shift">
          <ShiftReport />
        </TabsContent>
        <TabsContent value="daily">
          <DailyReport />
        </TabsContent>
        <TabsContent value="branches">
          <BranchComparison />
        </TabsContent>
      </Tabs>
    </div>
  );
}
