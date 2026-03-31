import { useState, useMemo } from "react";
import {
  Printer,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle2,
} from "lucide-react";

import { usePayroll }               from "@/hooks/usePayroll";
import type { PaymentMethod, PayrollRow } from "@/lib/payroll-types";
import { paymentStatusLabel }        from "@/components/payroll/employees/EmployeesPage";

import { Button }           from "@/components/ui/button";
import { Input }            from "@/components/ui/input";
import { Badge }            from "@/components/ui/badge";
import { Progress }         from "@/components/ui/progress";
import { Textarea }         from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

const NOW   = new Date();
const YEARS = [NOW.getFullYear() - 1, NOW.getFullYear(), NOW.getFullYear() + 1];
const PINK  = "#E91E63";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:          "نقداً",
  bank_transfer: "تحويل بنكي",
  cheque:        "شيك",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function omr(n: number) {
  return `${n.toFixed(3)} ر.ع`;
}

function paymentStatusBadge(status: PayrollRow["paymentStatus"]) {
  switch (status) {
    case "paid":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 border">{paymentStatusLabel("paid")}</Badge>;
    case "partial":
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 border">{paymentStatusLabel("partial")}</Badge>;
    case "unpaid":
      return <Badge className="bg-red-100 text-red-700 border-red-200 border">{paymentStatusLabel("unpaid")}</Badge>;
  }
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  sub?: React.ReactNode;
}

function SummaryCard({ title, value, icon, iconBg, iconColor, sub }: SummaryCardProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: iconBg, color: iconColor }}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-base font-bold tabular-nums mt-0.5 truncate">{value}</p>
          </div>
        </div>
        {sub && <div>{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ─── Pay Dialog ───────────────────────────────────────────────────────────────

interface PayDialogProps {
  row: PayrollRow | null;
  month: number;
  year: number;
  onClose: () => void;
}

function PayDialog({ row, month, year, onClose }: PayDialogProps) {
  const { addPayment } = usePayroll();

  const remaining = row ? Math.max(0, row.netSalary - row.amountPaid) : 0;

  const [amount, setAmount]   = useState<string>(remaining.toFixed(3));
  const [method, setMethod]   = useState<PaymentMethod>("bank_transfer");
  const [note, setNote]       = useState("");
  const [error, setError]     = useState("");

  // Sync amount when row changes (dialog re-keyed at usage site)
  const open = row !== null;

  function handleClose() {
    setAmount(remaining.toFixed(3));
    setMethod("bank_transfer");
    setNote("");
    setError("");
    onClose();
  }

  function handleSubmit() {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("يرجى إدخال مبلغ صحيح أكبر من صفر");
      return;
    }
    if (!row) return;

    addPayment({
      employeeId: row.employee.id,
      month,
      year,
      amount: parsed,
      method,
      paidBy: "المستخدم الحالي",
    });
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[440px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5" style={{ color: PINK }} />
            تسجيل دفعة راتب
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ستُحدَّث حالة الراتب فوراً بعد التسجيل
          </DialogDescription>
        </DialogHeader>

        {row && (
          <div className="space-y-4 py-1">
            {/* Employee (readonly) */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-0.5">
              <p className="font-semibold text-sm">{row.employee.name}</p>
              <p className="text-xs text-muted-foreground">{row.employee.position}</p>
            </div>

            {/* Net / Remaining (readonly) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">صافي الراتب</label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium tabular-nums text-right">
                  {omr(row.netSalary)}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">المبلغ المطلوب</label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium tabular-nums text-right">
                  {omr(remaining)}
                </div>
              </div>
            </div>

            {/* Amount (editable) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">المبلغ المدفوع (ر.ع)</label>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(""); }}
                className="text-right tabular-nums"
              />
            </div>

            {/* Method */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">طريقة الدفع</label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                    <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">ملاحظة (اختياري)</label>
              <Textarea
                placeholder="ملاحظات إضافية..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-right resize-none"
                rows={2}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            onClick={handleSubmit}
            className="text-white gap-1.5"
            style={{ backgroundColor: PINK }}
          >
            <CheckCircle2 className="h-4 w-4" />
            تأكيد الدفع
          </Button>
          <Button variant="outline" onClick={handleClose}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PayrollSheetPage() {
  const {
    payrollRows,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    bulkPayUnpaid,
  } = usePayroll();

  const [payRow, setPayRow]   = useState<PayrollRow | null>(null);
  const [payKey, setPayKey]   = useState(0);

  function openPay(row: PayrollRow) {
    setPayRow(row);
    setPayKey((k) => k + 1);
  }

  function closePay() {
    setPayRow(null);
  }

  function handleBulkPay() {
    bulkPayUnpaid("bank_transfer", "المستخدم الحالي");
  }

  function handlePrint() {
    window.print();
  }

  // Summary totals
  const totals = useMemo(() => {
    const activeRows = payrollRows.filter((r) => r.employee.status === "active");
    const base        = activeRows.reduce((s, r) => s + r.employee.baseSalary, 0);
    const bonuses     = activeRows.reduce((s, r) => s + r.totalBonus + r.totalOvertime, 0);
    const deductions  = activeRows.reduce((s, r) => s + r.totalDeduction + r.totalAdvance, 0);
    const net         = activeRows.reduce((s, r) => s + r.netSalary, 0);
    const paid        = activeRows.reduce((s, r) => s + r.amountPaid, 0);
    const paidPct     = net > 0 ? Math.round((paid / net) * 100) : 0;
    return { base, bonuses, deductions, net, paid, paidPct };
  }, [payrollRows]);

  // Footer totals (all rows in table, including inactive)
  const footerTotals = useMemo(() => ({
    base:       payrollRows.reduce((s, r) => s + r.employee.baseSalary, 0),
    bonuses:    payrollRows.reduce((s, r) => s + r.totalBonus + r.totalOvertime, 0),
    deductions: payrollRows.reduce((s, r) => s + r.totalDeduction + r.totalAdvance, 0),
    net:        payrollRows.reduce((s, r) => s + r.netSalary, 0),
    paid:       payrollRows.reduce((s, r) => s + r.amountPaid, 0),
  }), [payrollRows]);

  const unpaidCount = payrollRows.filter(
    (r) => r.employee.status === "active" && r.paymentStatus !== "paid"
  ).length;

  return (
    <>
      {/* ── Print styles ──────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #payroll-print-area,
          #payroll-print-area * { visibility: visible; }
          #payroll-print-area { position: absolute; inset: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div dir="rtl" className="font-sans min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" id="payroll-print-area">

          {/* ── Header ── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">كشف الرواتب</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {MONTHS_AR[selectedMonth - 1]} {selectedYear}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              {/* Month selector */}
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

              {/* Year selector */}
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

              {/* Print */}
              <Button variant="outline" className="gap-1.5" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                طباعة / PDF
              </Button>

              {/* Bulk pay */}
              <Button
                className="gap-1.5 text-white"
                style={{ backgroundColor: PINK }}
                disabled={unpaidCount === 0}
                onClick={handleBulkPay}
              >
                <CreditCard className="h-4 w-4" />
                دفع الكل
                {unpaidCount > 0 && (
                  <span className="bg-white/25 rounded-full px-1.5 py-0.5 text-xs font-bold">
                    {unpaidCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <SummaryCard
              title="إجمالي الرواتب الأساسية"
              value={omr(totals.base)}
              iconBg="#fce4ec"
              iconColor={PINK}
              icon={<Wallet className="h-4 w-4" />}
            />
            <SummaryCard
              title="إجمالي المستحقات والعمولات"
              value={omr(totals.bonuses)}
              iconBg="#e8f5e9"
              iconColor="#4CAF50"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <SummaryCard
              title="إجمالي الخصومات والسلف"
              value={omr(totals.deductions)}
              iconBg="#fff3e0"
              iconColor="#FF9800"
              icon={<TrendingDown className="h-4 w-4" />}
            />
            <SummaryCard
              title="صافي الرواتب"
              value={omr(totals.net)}
              iconBg="#e3f2fd"
              iconColor="#2196F3"
              icon={<DollarSign className="h-4 w-4" />}
            />
            <SummaryCard
              title="نسبة المدفوع"
              value={`${totals.paidPct}%`}
              iconBg="#f3e5f5"
              iconColor="#9C27B0"
              icon={<CheckCircle2 className="h-4 w-4" />}
              sub={
                <Progress
                  value={totals.paidPct}
                  className="h-1.5"
                  style={{ "--tw-bg-opacity": "1" } as React.CSSProperties}
                />
              }
            />
          </div>

          {/* ── Payroll table ── */}
          <Card className="shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-right font-semibold min-w-[160px]">الموظف</TableHead>
                    <TableHead className="text-right font-semibold">الراتب الأساسي</TableHead>
                    <TableHead className="text-right font-semibold">المستحقات</TableHead>
                    <TableHead className="text-right font-semibold">الخصومات</TableHead>
                    <TableHead
                      className="text-right font-semibold"
                      style={{ color: PINK }}
                    >
                      صافي الراتب
                    </TableHead>
                    <TableHead className="text-right font-semibold">حالة الدفع</TableHead>
                    <TableHead className="text-right font-semibold">المبلغ المدفوع</TableHead>
                    <TableHead className="text-right font-semibold w-20 no-print">
                      إجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {payrollRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        لا توجد بيانات لهذه الفترة
                      </TableCell>
                    </TableRow>
                  ) : (
                    payrollRows.map((row) => {
                      const isPaid = row.paymentStatus === "paid";
                      return (
                        <TableRow
                          key={row.employee.id}
                          className={`hover:bg-muted/20 transition-colors ${
                            row.employee.status !== "active" ? "opacity-50" : ""
                          }`}
                        >
                          {/* Employee */}
                          <TableCell>
                            <p className="font-medium text-sm leading-tight">
                              {row.employee.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {row.employee.position}
                            </p>
                          </TableCell>

                          {/* Base salary */}
                          <TableCell className="tabular-nums text-sm">
                            {omr(row.employee.baseSalary)}
                          </TableCell>

                          {/* Bonuses (+) */}
                          <TableCell className="tabular-nums text-sm text-green-700">
                            {row.totalBonus + row.totalOvertime > 0
                              ? `+${omr(row.totalBonus + row.totalOvertime)}`
                              : "—"}
                          </TableCell>

                          {/* Deductions (-) */}
                          <TableCell className="tabular-nums text-sm text-red-600">
                            {row.totalDeduction + row.totalAdvance > 0
                              ? `-${omr(row.totalDeduction + row.totalAdvance)}`
                              : "—"}
                          </TableCell>

                          {/* Net salary (highlighted) */}
                          <TableCell>
                            <span
                              className="font-bold tabular-nums text-sm px-2 py-0.5 rounded"
                              style={{ color: PINK, backgroundColor: "#fce4ec" }}
                            >
                              {omr(row.netSalary)}
                            </span>
                          </TableCell>

                          {/* Payment status */}
                          <TableCell>{paymentStatusBadge(row.paymentStatus)}</TableCell>

                          {/* Amount paid */}
                          <TableCell className="tabular-nums text-sm text-muted-foreground">
                            {row.amountPaid > 0 ? omr(row.amountPaid) : "—"}
                          </TableCell>

                          {/* Action */}
                          <TableCell className="no-print">
                            <Button
                              size="sm"
                              variant={isPaid ? "ghost" : "outline"}
                              className="text-xs h-7 gap-1"
                              disabled={
                                isPaid || row.employee.status !== "active"
                              }
                              style={
                                isPaid
                                  ? undefined
                                  : { borderColor: PINK, color: PINK }
                              }
                              onClick={() => openPay(row)}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              {isPaid ? "مدفوع" : "دفع"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>

                {/* ── Footer totals ── */}
                {payrollRows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 bg-muted/50 font-bold text-sm">
                      <td className="px-4 py-3 text-right">
                        الإجمالي
                        <span className="text-xs font-normal text-muted-foreground mr-1">
                          ({payrollRows.length} موظف)
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{omr(footerTotals.base)}</td>
                      <td className="px-4 py-3 tabular-nums text-green-700">
                        {footerTotals.bonuses > 0 ? `+${omr(footerTotals.bonuses)}` : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-red-600">
                        {footerTotals.deductions > 0
                          ? `-${omr(footerTotals.deductions)}`
                          : "—"}
                      </td>
                      <td
                        className="px-4 py-3 tabular-nums font-extrabold"
                        style={{ color: PINK }}
                      >
                        {omr(footerTotals.net)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {totals.paidPct}% مدفوع
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {omr(footerTotals.paid)}
                      </td>
                      <td className="no-print" />
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          </Card>

          {/* ── Footer note ── */}
          <p className="text-xs text-muted-foreground pb-2">
            صافي الراتب = الراتب الأساسي + المستحقات + العمولات − الخصومات − السلف
          </p>

        </div>
      </div>

      {/* ── Pay Dialog ── */}
      <PayDialog
        key={payKey}
        row={payRow}
        month={selectedMonth}
        year={selectedYear}
        onClose={closePay}
      />
    </>
  );
}
