import { useState, useMemo } from "react";
import { Search, Printer, Wallet, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";

import { usePayroll }          from "@/hooks/usePayroll";
import type { PayrollRow }     from "@/lib/payroll-types";

import { Button }              from "@/components/ui/button";
import { Input }               from "@/components/ui/input";
import { Badge }               from "@/components/ui/badge";
import { Card, CardContent }   from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

const NOW   = new Date();
const YEARS = [NOW.getFullYear() - 1, NOW.getFullYear(), NOW.getFullYear() + 1];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function omr(n: number): string {
  return `${n.toFixed(3)} ر.ع`;
}

function num(n: number): string {
  return n > 0 ? omr(n) : "—";
}

function PaymentBadge({ status }: { status: PayrollRow["paymentStatus"] }) {
  switch (status) {
    case "paid":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 border text-xs">مدفوع</Badge>;
    case "partial":
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 border text-xs">جزئي</Badge>;
    case "unpaid":
      return <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">غير مدفوع</Badge>;
  }
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

function StatCard({ title, value, icon, iconBg, iconColor }: StatCardProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          <p className="text-base font-bold tabular-nums mt-0.5 truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PayrollSummaryPage() {
  const {
    payrollRows,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
  } = usePayroll();

  const [search, setSearch] = useState("");

  // Filter by name only — all data still comes from payrollRows
  const filtered = useMemo(
    () =>
      search.trim()
        ? payrollRows.filter((r) => r.employee.name.includes(search.trim()))
        : payrollRows,
    [payrollRows, search]
  );

  // Summary totals over ALL rows (not filtered)
  const totals = useMemo(() => {
    const gross    = payrollRows.reduce((s, r) => s + r.employee.baseSalary, 0);
    const net      = payrollRows.reduce((s, r) => s + r.netSalary, 0);
    const paid     = payrollRows.reduce((s, r) => s + r.amountPaid, 0);
    const remaining = net - paid;
    return { gross, net, paid, remaining };
  }, [payrollRows]);

  // Footer totals over FILTERED rows
  const footer = useMemo(() => ({
    base:       filtered.reduce((s, r) => s + r.employee.baseSalary, 0),
    bonus:      filtered.reduce((s, r) => s + r.totalBonus, 0),
    overtime:   filtered.reduce((s, r) => s + r.totalOvertime, 0),
    deduction:  filtered.reduce((s, r) => s + r.totalDeduction, 0),
    advance:    filtered.reduce((s, r) => s + r.totalAdvance, 0),
    net:        filtered.reduce((s, r) => s + r.netSalary, 0),
    paid:       filtered.reduce((s, r) => s + r.amountPaid, 0),
    remaining:  filtered.reduce((s, r) => s + Math.max(0, r.netSalary - r.amountPaid), 0),
  }), [filtered]);

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #summary-print-area, #summary-print-area * { visibility: visible; }
          #summary-print-area { position: absolute; inset: 0; }
          .no-print { display: none !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>

      <div dir="rtl" className="font-sans min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" id="summary-print-area">

          {/* ── Header ── */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">ملخص الرواتب</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {MONTHS_AR[selectedMonth - 1]} {selectedYear}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS_AR.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" className="gap-1.5" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
            </div>
          </div>

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="إجمالي الراتب الإجمالي"
              value={omr(totals.gross)}
              iconBg="#f5f5f5"
              iconColor="#616161"
              icon={<Wallet className="h-4 w-4" />}
            />
            <StatCard
              title="إجمالي الصافي"
              value={omr(totals.net)}
              iconBg="#e8f5e9"
              iconColor="#4CAF50"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              title="إجمالي المدفوع"
              value={omr(totals.paid)}
              iconBg="#e3f2fd"
              iconColor="#2196F3"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatCard
              title="إجمالي المتبقي"
              value={omr(totals.remaining)}
              iconBg={totals.remaining > 0 ? "#ffebee" : "#f5f5f5"}
              iconColor={totals.remaining > 0 ? "#F44336" : "#9E9E9E"}
              icon={<AlertCircle className="h-4 w-4" />}
            />
          </div>

          {/* ── Search ── */}
          <div className="relative max-w-sm no-print">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="البحث باسم الموظف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9 text-right"
            />
          </div>

          {/* ── Table ── */}
          <Card className="shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-right font-semibold min-w-[150px]">الموظف</TableHead>
                    <TableHead className="text-right font-semibold min-w-[140px]">الفرع / الدور</TableHead>
                    <TableHead className="text-right font-semibold">الراتب الأساسي</TableHead>
                    <TableHead className="text-right font-semibold text-green-700">المستحقات</TableHead>
                    <TableHead className="text-right font-semibold text-green-700">العمولات</TableHead>
                    <TableHead className="text-right font-semibold text-orange-600">الخصومات</TableHead>
                    <TableHead className="text-right font-semibold text-orange-600">السلف</TableHead>
                    <TableHead className="text-right font-semibold text-green-700 min-w-[110px]">الصافي</TableHead>
                    <TableHead className="text-right font-semibold text-blue-600">المدفوع</TableHead>
                    <TableHead className="text-right font-semibold text-red-600 min-w-[100px]">المتبقي</TableHead>
                    <TableHead className="text-right font-semibold">الحالة</TableHead>
                    <TableHead className="text-right font-semibold w-16 no-print">طباعة</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                        لا توجد بيانات تطابق البحث
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => {
                      const remaining = Math.max(0, row.netSalary - row.amountPaid);
                      return (
                        <TableRow
                          key={row.employee.id}
                          className={`hover:bg-muted/20 transition-colors text-sm ${
                            row.employee.status !== "active" ? "opacity-50" : ""
                          }`}
                        >
                          {/* Name */}
                          <TableCell>
                            <p className="font-medium leading-tight">{row.employee.name}</p>
                          </TableCell>

                          {/* Branch / Role */}
                          <TableCell className="text-muted-foreground">
                            <p className="text-xs leading-tight truncate max-w-[160px]">
                              {row.employee.branch}
                            </p>
                            <p className="text-xs text-muted-foreground/70 leading-tight truncate max-w-[160px]">
                              {row.employee.position}
                            </p>
                          </TableCell>

                          {/* Base salary */}
                          <TableCell className="tabular-nums">{omr(row.employee.baseSalary)}</TableCell>

                          {/* Bonus */}
                          <TableCell className="tabular-nums text-green-700">
                            {num(row.totalBonus)}
                          </TableCell>

                          {/* Overtime */}
                          <TableCell className="tabular-nums text-green-700">
                            {num(row.totalOvertime)}
                          </TableCell>

                          {/* Deduction */}
                          <TableCell className="tabular-nums text-orange-600">
                            {num(row.totalDeduction)}
                          </TableCell>

                          {/* Advance */}
                          <TableCell className="tabular-nums text-orange-600">
                            {num(row.totalAdvance)}
                          </TableCell>

                          {/* Net (highlighted green) */}
                          <TableCell>
                            <span className="font-bold tabular-nums px-2 py-0.5 rounded bg-green-50 text-green-700">
                              {omr(row.netSalary)}
                            </span>
                          </TableCell>

                          {/* Paid */}
                          <TableCell className="tabular-nums text-blue-600">
                            {num(row.amountPaid)}
                          </TableCell>

                          {/* Remaining (highlighted red if > 0) */}
                          <TableCell>
                            {remaining > 0 ? (
                              <span className="font-semibold tabular-nums px-2 py-0.5 rounded bg-red-50 text-red-600">
                                {omr(remaining)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Status badge */}
                          <TableCell>
                            <PaymentBadge status={row.paymentStatus} />
                          </TableCell>

                          {/* Print row */}
                          <TableCell className="no-print">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => window.print()}
                              title={`طباعة - ${row.employee.name}`}
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>

                {/* ── Footer totals ── */}
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 bg-muted/50 font-bold text-sm">
                      <td className="px-4 py-3 text-right" colSpan={2}>
                        الإجمالي
                        <span className="text-xs font-normal text-muted-foreground mr-1">
                          ({filtered.length} من {payrollRows.length} موظف)
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{omr(footer.base)}</td>
                      <td className="px-4 py-3 tabular-nums text-green-700">{num(footer.bonus)}</td>
                      <td className="px-4 py-3 tabular-nums text-green-700">{num(footer.overtime)}</td>
                      <td className="px-4 py-3 tabular-nums text-orange-600">{num(footer.deduction)}</td>
                      <td className="px-4 py-3 tabular-nums text-orange-600">{num(footer.advance)}</td>
                      <td className="px-4 py-3">
                        <span className="font-extrabold tabular-nums px-2 py-0.5 rounded bg-green-50 text-green-700">
                          {omr(footer.net)}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-blue-600">{num(footer.paid)}</td>
                      <td className="px-4 py-3">
                        {footer.remaining > 0 ? (
                          <span className="font-extrabold tabular-nums px-2 py-0.5 rounded bg-red-50 text-red-600">
                            {omr(footer.remaining)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3" />
                      <td className="no-print" />
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          </Card>

          {/* ── Footer note ── */}
          <p className="text-xs text-muted-foreground pb-2 no-print">
            الصافي = الأساسي + المستحقات + العمولات − الخصومات − السلف &nbsp;·&nbsp;
            المتبقي = الصافي − المدفوع
          </p>

        </div>
      </div>
    </>
  );
}
