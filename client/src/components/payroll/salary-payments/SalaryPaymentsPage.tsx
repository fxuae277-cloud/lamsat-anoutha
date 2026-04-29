import { useState, useMemo } from "react";
import {
  Search, CreditCard, Users, CheckCircle2,
  AlertCircle, ChevronDown,
} from "lucide-react";

import { usePayroll }                from "@/hooks/usePayroll";
import type { PaymentMethod, PayrollRow } from "@/lib/payroll-types";

import { Button }                    from "@/components/ui/button";
import { Input }                     from "@/components/ui/input";
import { Badge }                     from "@/components/ui/badge";
import { Progress }                  from "@/components/ui/progress";
import { Textarea }                  from "@/components/ui/textarea";
import { Card, CardContent }         from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { PageHeader }         from "@/components/payroll/shared/PageHeader";
import { StatCard }           from "@/components/payroll/shared/StatCard";
import { EmptyState }         from "@/components/payroll/shared/EmptyState";
import { PaymentStatusBadge } from "@/components/payroll/shared/PayrollBadge";
import { usePayrollToast }    from "@/components/payroll/shared/usePayrollToast";
import { MONTHS_AR, YEARS, formatOMR, METHOD_LABELS } from "@/components/payroll/shared/payrollUtils";

// ─── Constants ────────────────────────────────────────────────────────────────

const PINK  = "#E91E63";
const GREEN = "#4CAF50";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function omr(n: number)             { return formatOMR(n); }
function pct(a: number, b: number)  { return b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0; }

// ─── Payment Dialog ───────────────────────────────────────────────────────────

interface PaymentDialogProps {
  open: boolean;
  preRow: PayrollRow | null;
  month: number;
  year: number;
  onClose: () => void;
}

function PaymentDialog({ open, preRow, month, year, onClose }: PaymentDialogProps) {
  const { employees, payrollRows, addPayment } = usePayroll();
  const toast = usePayrollToast();

  const [empId,        setEmpId]       = useState<string>(preRow ? String(preRow.employee.id) : "");
  const [amount,       setAmount]      = useState<string>("");
  const [method,       setMethod]      = useState<PaymentMethod>("bank_transfer");
  const [note,         setNote]        = useState("");
  const [error,        setError]       = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const liveRow = useMemo(
    () => payrollRows.find((r) => String(r.employee.id) === empId) ?? null,
    [payrollRows, empId]
  );

  const remaining = liveRow ? Math.max(0, liveRow.netSalary - liveRow.amountPaid) : 0;

  function handleEmpChange(id: string) {
    setEmpId(id);
    const row = payrollRows.find((r) => String(r.employee.id) === id);
    if (row) {
      const rem = Math.max(0, row.netSalary - row.amountPaid);
      setAmount(rem.toFixed(3));
    } else {
      setAmount("");
    }
    setError("");
  }

  function handleClose() {
    setEmpId(preRow ? String(preRow.employee.id) : "");
    setAmount("");
    setMethod("bank_transfer");
    setNote("");
    setError("");
    setIsSubmitting(false);
    onClose();
  }

  function handleSubmit() {
    if (!empId) { setError("يرجى اختيار الموظف"); return; }
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("يرجى إدخال مبلغ صحيح أكبر من صفر");
      return;
    }

    setIsSubmitting(true);
    const empName = liveRow?.employee.name;
    addPayment({
      employeeId: parseInt(empId),
      month, year,
      amount: parsed,
      method,
      paidBy: "المستخدم الحالي",
    });
    toast.successPayment(empName, omr(parsed));
    setIsSubmitting(false);
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[460px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5" style={{ color: PINK }} />
            تسجيل دفعة راتب
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ستُحدَّث حالة الدفع فوراً في كشف الرواتب
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Employee */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الموظف</label>
            {preRow ? (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="font-semibold text-sm">{preRow.employee.name}</p>
                <p className="text-xs text-muted-foreground">{preRow.employee.position}</p>
              </div>
            ) : (
              <Select value={empId} onValueChange={handleEmpChange}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر موظفاً..." />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((e) => e.status === "active")
                    .map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.name} — {e.position}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Readonly info */}
          {liveRow && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">صافي الراتب</label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium tabular-nums text-start">
                  {omr(liveRow.netSalary)}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">المدفوع مسبقاً</label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium tabular-nums text-start">
                  {liveRow.amountPaid > 0 ? omr(liveRow.amountPaid) : "—"}
                </div>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              المبلغ الآن (ر.ع)
              {remaining > 0 && (
                <span className="text-xs text-muted-foreground font-normal me-2">
                  المتبقي: {omr(remaining)}
                </span>
              )}
            </label>
            <Input
              type="number" min="0.001" step="0.001"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(""); }}
              className="text-start tabular-nums"
              placeholder="0.000"
            />
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">طريقة الدفع</label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              className="text-start resize-none" rows={2}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="text-white gap-1.5"
            style={{ backgroundColor: PINK }}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting ? "جاري التسجيل..." : "تأكيد الدفع"}
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Partial Dialog ──────────────────────────────────────────────────────

interface BulkPartialDialogProps {
  open: boolean;
  unpaidRows: PayrollRow[];
  month: number;
  year: number;
  onClose: () => void;
}

function BulkPartialDialog({ open, unpaidRows, month, year, onClose }: BulkPartialDialogProps) {
  const { addPayment } = usePayroll();
  const toast = usePayrollToast();

  type Mode = "percentage" | "fixed";
  const [mode,         setMode]        = useState<Mode>("percentage");
  const [value,        setValue]       = useState<string>("50");
  const [method,       setMethod]      = useState<PaymentMethod>("bank_transfer");
  const [error,        setError]       = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleClose() {
    setMode("percentage");
    setValue("50");
    setMethod("bank_transfer");
    setError("");
    setIsSubmitting(false);
    onClose();
  }

  const preview = useMemo(() => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return [];
    return unpaidRows
      .filter((r) => r.employee.status === "active")
      .map((r) => {
        const remaining = Math.max(0, r.netSalary - r.amountPaid);
        const pay = mode === "percentage"
          ? parseFloat(((num / 100) * remaining).toFixed(3))
          : Math.min(num, remaining);
        return { row: r, pay: Math.max(0, pay) };
      })
      .filter((x) => x.pay > 0);
  }, [unpaidRows, mode, value]);

  const previewTotal = preview.reduce((s, x) => s + x.pay, 0);

  function handleConfirm() {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) { setError("يرجى إدخال قيمة صحيحة"); return; }
    if (preview.length === 0)   { setError("لا توجد رواتب غير مدفوعة"); return; }

    setIsSubmitting(true);
    for (const { row, pay } of preview) {
      addPayment({
        employeeId: row.employee.id,
        month, year,
        amount: pay,
        method,
        paidBy: "المستخدم الحالي",
      });
    }
    toast.successBulkPay(preview.length);
    setIsSubmitting(false);
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-orange-500" />
            دفعة جماعية جزئية
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            حدد نسبة أو مبلغاً ثابتاً لكل موظف غير مدفوع
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Mode toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "percentage"
                  ? "bg-orange-500 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted/50"
              }`}
              onClick={() => setMode("percentage")}
            >
              نسبة مئوية %
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "fixed"
                  ? "bg-orange-500 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted/50"
              }`}
              onClick={() => setMode("fixed")}
            >
              مبلغ ثابت ر.ع
            </button>
          </div>

          {/* Value input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {mode === "percentage" ? "النسبة (%) من المتبقي لكل موظف" : "المبلغ (ر.ع) لكل موظف"}
            </label>
            <div className="flex gap-2">
              <Input
                type="number" min="0.001"
                step={mode === "percentage" ? "1" : "0.001"}
                max={mode === "percentage" ? "100" : undefined}
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(""); }}
                className="text-start tabular-nums flex-1"
              />
              <span className="flex items-center text-sm text-muted-foreground px-2">
                {mode === "percentage" ? "%" : "ر.ع"}
              </span>
            </div>
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">طريقة الدفع</label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">معاينة المبالغ</label>
                <span className="text-xs text-muted-foreground">
                  الإجمالي: <strong className="text-foreground tabular-nums">{omr(previewTotal)}</strong>
                </span>
              </div>
              <div className="rounded-lg border divide-y max-h-[200px] overflow-y-auto">
                {preview.map(({ row, pay }) => (
                  <div key={row.employee.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium leading-tight">{row.employee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        متبقي: {omr(Math.max(0, row.netSalary - row.amountPaid))}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-orange-600">{omr(pay)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            onClick={handleConfirm}
            disabled={preview.length === 0 || isSubmitting}
            className="text-white gap-1.5 bg-orange-500 hover:bg-orange-600"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting ? "جاري الدفع..." : `تأكيد الدفع الجزئي (${preview.length})`}
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalaryPaymentsPage() {
  const {
    payrollRows,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    bulkPayUnpaid,
  } = usePayroll();
  const toast = usePayrollToast();

  // Dialogs
  const [singleOpen,      setSingleOpen]      = useState(false);
  const [singleKey,       setSingleKey]       = useState(0);
  const [singleRow,       setSingleRow]       = useState<PayrollRow | null>(null);
  const [bulkPartialOpen, setBulkPartialOpen] = useState(false);
  const [bulkPartialKey,  setBulkPartialKey]  = useState(0);

  // Filters
  const [search,     setSearch]     = useState("");
  const [statusFilt, setStatusFilt] = useState<string>("all");

  function openSingle(row: PayrollRow | null) {
    setSingleRow(row);
    setSingleKey((k) => k + 1);
    setSingleOpen(true);
  }

  function openBulkPartial() {
    setBulkPartialKey((k) => k + 1);
    setBulkPartialOpen(true);
  }

  const unpaidRows = useMemo(
    () => payrollRows.filter(
      (r) => r.employee.status === "active" && r.paymentStatus !== "paid" && r.netSalary > 0
    ),
    [payrollRows]
  );

  const summary = useMemo(() => {
    const paid         = payrollRows.reduce((s, r) => s + r.amountPaid, 0);
    const net          = payrollRows.reduce((s, r) => s + r.netSalary, 0);
    const remaining    = Math.max(0, net - paid);
    const pendingCount = payrollRows.filter(
      (r) => r.employee.status === "active" && r.paymentStatus !== "paid"
    ).length;
    return { paid, remaining, pendingCount };
  }, [payrollRows]);

  const filtered = useMemo(() => {
    return payrollRows.filter((r) => {
      if (search     && !r.employee.name.includes(search)) return false;
      if (statusFilt !== "all" && r.paymentStatus !== statusFilt) return false;
      return true;
    });
  }, [payrollRows, search, statusFilt]);

  function handleBulkFull(method: PaymentMethod) {
    const count = unpaidRows.length;
    bulkPayUnpaid(method, "المستخدم الحالي");
    toast.successBulkPay(count);
  }

  const monthYearSelectors = (
    <div className="flex flex-wrap items-center gap-2">
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
        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div dir="rtl" className="font-sans min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        <PageHeader
          title="متابعة دفع الرواتب"
          subtitle={`${MONTHS_AR[selectedMonth - 1]} ${selectedYear}`}
          actions={monthYearSelectors}
        />

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="إجمالي المدفوع"
            value={omr(summary.paid)}
            color="blue"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            title="إجمالي المتبقي"
            value={omr(summary.remaining)}
            color={summary.remaining > 0 ? "red" : "grey"}
            icon={<AlertCircle className="h-4 w-4" />}
          />
          <StatCard
            title="غير مدفوع / جزئي"
            value={`${summary.pendingCount} موظف`}
            color="orange"
            icon={<Users className="h-4 w-4" />}
            sub={
              summary.pendingCount > 0 && (
                <Badge className="mt-1 bg-orange-100 text-orange-700 border-orange-200 border text-xs w-fit">
                  يحتاج متابعة
                </Badge>
              )
            }
          />
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-wrap gap-3">
          <Button
            className="gap-2 text-white"
            style={{ backgroundColor: PINK }}
            onClick={() => openSingle(null)}
          >
            <CreditCard className="h-4 w-4" />
            تسجيل دفعة
          </Button>

          <Button
            className="gap-2 text-white"
            style={{ backgroundColor: GREEN }}
            disabled={unpaidRows.length === 0}
            onClick={() => handleBulkFull("bank_transfer")}
          >
            <CheckCircle2 className="h-4 w-4" />
            دفعة جماعية كاملة
            {unpaidRows.length > 0 && (
              <span className="bg-white/25 rounded-full px-1.5 text-xs font-bold">
                {unpaidRows.length}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            className="gap-2 border-orange-400 text-orange-600 hover:bg-orange-50"
            disabled={unpaidRows.length === 0}
            onClick={openBulkPartial}
          >
            <Users className="h-4 w-4" />
            دفعة جماعية جزئية
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-1 text-sm">
                طريقة الدفع الجماعي
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <DropdownMenuItem
                  key={m}
                  disabled={unpaidRows.length === 0}
                  onSelect={() => handleBulkFull(m)}
                >
                  {METHOD_LABELS[m]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Filters ── */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="البحث باسم الموظف..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pe-9 text-start"
                />
              </div>
              <Select value={statusFilt} onValueChange={setStatusFilt}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="حالة الدفع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="unpaid">غير مدفوع</SelectItem>
                  <SelectItem value="partial">جزئي</SelectItem>
                  <SelectItem value="paid">مدفوع</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ── Table ── */}
        <Card className="shadow-sm">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-base">
              سجل الرواتب
              <span className="text-muted-foreground font-normal text-sm me-2">
                ({filtered.length})
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-start font-semibold min-w-[160px]">الموظف</TableHead>
                  <TableHead className="text-start font-semibold">الفرع</TableHead>
                  <TableHead className="text-start font-semibold">الصافي</TableHead>
                  <TableHead className="text-start font-semibold text-blue-600">المدفوع</TableHead>
                  <TableHead className="text-start font-semibold text-red-600">المتبقي</TableHead>
                  <TableHead className="text-start font-semibold min-w-[120px]">نسبة الدفع</TableHead>
                  <TableHead className="text-start font-semibold">الحالة</TableHead>
                  <TableHead className="text-start font-semibold w-20">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState message="لا توجد بيانات تطابق الفلتر" />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => {
                    const remaining  = Math.max(0, row.netSalary - row.amountPaid);
                    const paidPct    = pct(row.amountPaid, row.netSalary);
                    const isPaid     = row.paymentStatus === "paid";
                    const isInactive = row.employee.status !== "active";
                    return (
                      <TableRow
                        key={row.employee.id}
                        className={`hover:bg-muted/20 transition-colors text-sm ${isInactive ? "opacity-50" : ""}`}
                      >
                        <TableCell>
                          <p className="font-medium leading-tight">{row.employee.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{row.employee.position}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[140px] truncate">
                          {row.employee.branch}
                        </TableCell>
                        <TableCell className="tabular-nums font-medium">
                          {omr(row.netSalary)}
                        </TableCell>
                        <TableCell className="tabular-nums text-blue-600">
                          {row.amountPaid > 0 ? omr(row.amountPaid) : "—"}
                        </TableCell>
                        <TableCell>
                          {remaining > 0 ? (
                            <span className="tabular-nums font-semibold text-red-600">
                              {omr(remaining)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-[110px]">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{paidPct}%</span>
                            </div>
                            <Progress
                              value={paidPct}
                              className="h-1.5"
                              style={
                                isPaid
                                  ? { "--tw-bg-opacity": "1" } as React.CSSProperties
                                  : undefined
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={row.paymentStatus} />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            disabled={isPaid || isInactive}
                            style={
                              !isPaid && !isInactive
                                ? { borderColor: PINK, color: PINK }
                                : undefined
                            }
                            onClick={() => openSingle(row)}
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
            </Table>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-xs text-muted-foreground pb-2">
          عرض {filtered.length} من {payrollRows.length} موظف
        </p>

      </div>

      {/* ── Single Pay Dialog ── */}
      <PaymentDialog
        key={singleKey}
        open={singleOpen}
        preRow={singleRow}
        month={selectedMonth}
        year={selectedYear}
        onClose={() => setSingleOpen(false)}
      />

      {/* ── Bulk Partial Dialog ── */}
      <BulkPartialDialog
        key={bulkPartialKey}
        open={bulkPartialOpen}
        unpaidRows={unpaidRows}
        month={selectedMonth}
        year={selectedYear}
        onClose={() => setBulkPartialOpen(false)}
      />
    </div>
  );
}
