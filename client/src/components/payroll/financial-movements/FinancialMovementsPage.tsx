import { useState, useMemo } from "react";
import {
  TrendingUp,
  Star,
  TrendingDown,
  Banknote,
  Search,
  ChevronDown,
  ChevronUp,
  Ban,
  History,
} from "lucide-react";

import { usePayroll } from "@/hooks/usePayroll";
import type {
  MovementType,
  FinancialMovement,
  AuditLog,
} from "@/lib/payroll-types";

import { Button }           from "@/components/ui/button";
import { Input }            from "@/components/ui/input";
import { Badge }            from "@/components/ui/badge";
import { Textarea }         from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from "@/components/ui/collapsible";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

const MOVEMENT_META: Record<MovementType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  bonus:     { label: "مستحق",  color: "#4CAF50", bg: "#e8f5e9", icon: <TrendingUp  className="h-4 w-4" /> },
  overtime:  { label: "عمولة",  color: "#2196F3", bg: "#e3f2fd", icon: <Star        className="h-4 w-4" /> },
  deduction: { label: "خصم",    color: "#FF9800", bg: "#fff3e0", icon: <TrendingDown className="h-4 w-4" /> },
  advance:   { label: "سلفة",   color: "#F44336", bg: "#ffebee", icon: <Banknote    className="h-4 w-4" /> },
};

function formatOMR(n: number) {
  return `${n.toFixed(3)} ر.ع`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ar-OM", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("ar-OM", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const NOW = new Date();
const YEARS = [NOW.getFullYear() - 1, NOW.getFullYear(), NOW.getFullYear() + 1];

// ─── Movement Type Badge ──────────────────────────────────────────────────────

function MovementTypeBadge({ type }: { type: MovementType }) {
  const m = MOVEMENT_META[type];
  return (
    <Badge
      className="gap-1 border"
      style={{ backgroundColor: m.bg, color: m.color, borderColor: m.color + "44" }}
    >
      {m.icon}
      {m.label}
    </Badge>
  );
}

// ─── Movement Status Badge ────────────────────────────────────────────────────

function MovementStatusBadge({ status }: { status: FinancialMovement["status"] }) {
  if (status === "active") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 border">نشط</Badge>
    );
  }
  return (
    <Badge className="bg-gray-100 text-gray-500 border-gray-200 border">ملغي</Badge>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title, value, type,
}: { title: string; value: number; type: MovementType }) {
  const m = MOVEMENT_META[type];
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: m.bg, color: m.color }}
        >
          {m.icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          <p className="text-lg font-bold mt-0.5 tabular-nums truncate">{formatOMR(value)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Add Movement Dialog ──────────────────────────────────────────────────────

interface AddDialogProps {
  open: boolean;
  initialType: MovementType;
  onClose: () => void;
}

function AddMovementDialog({ open, initialType, onClose }: AddDialogProps) {
  const { employees, addMovement, selectedMonth, selectedYear } = usePayroll();

  const [employeeId, setEmployeeId] = useState<string>("");
  const [type, setType]             = useState<MovementType>(initialType);
  const [amount, setAmount]         = useState<string>("");
  const [month, setMonth]           = useState<string>(String(selectedMonth));
  const [year, setYear]             = useState<string>(String(selectedYear));
  const [reason, setReason]         = useState<string>("");
  const [error, setError]           = useState<string>("");

  // Sync initialType when dialog reopens with different button
  // (handled by key on dialog — see usage)

  function reset() {
    setEmployeeId("");
    setType(initialType);
    setAmount("");
    setMonth(String(selectedMonth));
    setYear(String(selectedYear));
    setReason("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!employeeId) { setError("يرجى اختيار الموظف"); return; }
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("يرجى إدخال مبلغ صحيح أكبر من صفر");
      return;
    }
    if (!reason.trim()) { setError("يرجى إدخال ملاحظة أو سبب"); return; }

    const m  = parseInt(month);
    const y  = parseInt(year);
    const day = `${y}-${String(m).padStart(2, "0")}-01`;

    addMovement({
      employeeId: parseInt(employeeId),
      type,
      amount: parsedAmount,
      reason: reason.trim(),
      date: day,
      createdBy: "المستخدم الحالي",
    });

    handleClose();
  }

  const meta = MOVEMENT_META[type];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: meta.color }}
            >
              {meta.icon}
            </span>
            إضافة {meta.label}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            ستُضاف الحركة وتُحسب تلقائياً في صافي راتب الموظف
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Employee */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الموظف</label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر موظفاً..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name} — {e.position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">النوع</label>
            <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MOVEMENT_META) as MovementType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {MOVEMENT_META[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">المبلغ (ر.ع)</label>
            <Input
              type="number"
              min="0"
              step="0.001"
              placeholder="0.000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-right"
            />
          </div>

          {/* Month + Year */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الشهر</label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS_AR.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">السنة</label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الملاحظة / السبب</label>
            <Textarea
              placeholder="أدخل سبب الحركة المالية..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-right resize-none"
              rows={3}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            onClick={handleSubmit}
            className="text-white"
            style={{ backgroundColor: meta.color }}
          >
            إضافة
          </Button>
          <Button variant="outline" onClick={handleClose}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Audit Log Row ────────────────────────────────────────────────────────────

function AuditLogRow({ log, employeeName }: { log: AuditLog; employeeName: string }) {
  const actionLabel: Record<string, string> = {
    add_movement:    "إضافة حركة",
    cancel_movement: "إلغاء حركة",
    add_payment:     "تسجيل دفعة",
    bulk_pay:        "دفع جماعي",
  };

  const amount = (log.newValue?.amount ?? log.oldValue?.amount) as number | undefined;

  return (
    <TableRow className="text-sm">
      <TableCell className="font-medium">
        {actionLabel[log.action] ?? log.action}
      </TableCell>
      <TableCell className="text-muted-foreground">{employeeName}</TableCell>
      <TableCell className="tabular-nums">
        {amount !== undefined ? formatOMR(amount) : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {formatDateTime(log.timestamp)}
      </TableCell>
    </TableRow>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancialMovementsPage() {
  const {
    employees,
    movements,
    auditLogs,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    cancelMovement,
  } = usePayroll();

  // Dialog state
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [dialogType, setDialogType]         = useState<MovementType>("bonus");
  const [dialogKey, setDialogKey]           = useState(0); // remount on new open

  // Filters
  const [search, setSearch]                 = useState("");
  const [empFilter, setEmpFilter]           = useState<string>("all");
  const [typeFilter, setTypeFilter]         = useState<string>("all");

  // Audit log
  const [auditOpen, setAuditOpen]           = useState(false);

  function openDialog(type: MovementType) {
    setDialogType(type);
    setDialogKey((k) => k + 1); // remount to reset form
    setDialogOpen(true);
  }

  // Employee lookup map
  const empMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

  // Stats: active movements for selected month/year
  const monthMovements = useMemo(
    () =>
      movements.filter(
        (m) =>
          m.status === "active" &&
          new Date(m.date).getMonth() + 1 === selectedMonth &&
          new Date(m.date).getFullYear() === selectedYear
      ),
    [movements, selectedMonth, selectedYear]
  );

  const stats = useMemo(() => {
    const sum = (type: MovementType) =>
      monthMovements
        .filter((m) => m.type === type)
        .reduce((s, m) => s + m.amount, 0);
    return {
      bonus:     sum("bonus"),
      overtime:  sum("overtime"),
      deduction: sum("deduction"),
      advance:   sum("advance"),
    };
  }, [monthMovements]);

  // Filtered table rows (all movements, not just current month)
  const filtered = useMemo(() => {
    return movements.filter((m) => {
      const emp = empMap.get(m.employeeId);
      const name = emp?.name ?? "";
      if (search && !name.includes(search) && !m.reason.includes(search)) return false;
      if (empFilter !== "all" && String(m.employeeId) !== empFilter) return false;
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      const d = new Date(m.date);
      if (d.getMonth() + 1 !== selectedMonth) return false;
      if (d.getFullYear() !== selectedYear) return false;
      return true;
    });
  }, [movements, empMap, search, empFilter, typeFilter, selectedMonth, selectedYear]);

  // Audit rows that relate to movements
  const movementAuditLogs = useMemo(
    () =>
      auditLogs
        .filter((l) => l.entityType === "movement")
        .slice()
        .reverse(),
    [auditLogs]
  );

  return (
    <div dir="rtl" className="font-sans min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold">الحركات المالية</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            إدارة المستحقات والعمولات والخصومات والسلف
          </p>
        </div>

        {/* ── Action Buttons ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              { type: "bonus",     label: "تسجيل مستحق" },
              { type: "overtime",  label: "عمولة"        },
              { type: "deduction", label: "خصم"          },
              { type: "advance",   label: "سلفة"         },
            ] as { type: MovementType; label: string }[]
          ).map(({ type, label }) => {
            const m = MOVEMENT_META[type];
            return (
              <Button
                key={type}
                onClick={() => openDialog(type)}
                className="h-14 gap-2 text-white font-semibold shadow-md flex-col sm:flex-row"
                style={{ backgroundColor: m.color }}
              >
                <span className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full">
                  {m.icon}
                </span>
                <span>{label}</span>
              </Button>
            );
          })}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="إجمالي المستحقات" value={stats.bonus}     type="bonus"     />
          <StatCard title="إجمالي العمولات"  value={stats.overtime}  type="overtime"  />
          <StatCard title="إجمالي الخصومات" value={stats.deduction} type="deduction" />
          <StatCard title="إجمالي السلف"     value={stats.advance}   type="advance"   />
        </div>

        {/* ── Filters ── */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="البحث بالاسم أو السبب..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9 text-right"
                />
              </div>

              {/* Employee filter */}
              <Select value={empFilter} onValueChange={setEmpFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="الموظف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الموظفين</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Type filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {(Object.keys(MOVEMENT_META) as MovementType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {MOVEMENT_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Month */}
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS_AR.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Year */}
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ── Movements Table ── */}
        <Card className="shadow-sm">
          <CardHeader className="px-4 py-3 border-b">
            <CardTitle className="text-base font-semibold">
              سجل الحركات
              <span className="text-muted-foreground font-normal text-sm mr-2">
                ({filtered.length})
              </span>
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-right font-semibold">الموظف</TableHead>
                <TableHead className="text-right font-semibold">النوع</TableHead>
                <TableHead className="text-right font-semibold">المبلغ</TableHead>
                <TableHead className="text-right font-semibold hidden sm:table-cell">الشهر / السنة</TableHead>
                <TableHead className="text-right font-semibold hidden md:table-cell">الملاحظة</TableHead>
                <TableHead className="text-right font-semibold">الحالة</TableHead>
                <TableHead className="text-right font-semibold hidden lg:table-cell">تاريخ الإضافة</TableHead>
                <TableHead className="text-right font-semibold w-20">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    لا توجد حركات مالية لهذه الفترة
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const emp = empMap.get(m.employeeId);
                  const d = new Date(m.date);
                  const monthName = MONTHS_AR[d.getMonth()];
                  return (
                    <TableRow key={m.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{emp?.name ?? `موظف #${m.employeeId}`}</p>
                          <p className="text-xs text-muted-foreground">{emp?.position}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <MovementTypeBadge type={m.type} />
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums text-sm">
                        {formatOMR(m.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                        {monthName} {d.getFullYear()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
                        {m.reason}
                      </TableCell>
                      <TableCell>
                        <MovementStatusBadge status={m.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                        {formatDate(m.date)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-40"
                          disabled={m.status === "cancelled"}
                          onClick={() => cancelMovement(m.id, "المستخدم الحالي")}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          إلغاء
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* ── Audit Log (Collapsible) ── */}
        <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
          <Card className="shadow-sm">
            <CollapsibleTrigger asChild>
              <CardHeader className="px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    سجل المراجعة
                    <span className="text-muted-foreground font-normal text-sm">
                      ({movementAuditLogs.length})
                    </span>
                  </CardTitle>
                  {auditOpen
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="border-t">
                {movementAuditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    لا توجد سجلات مراجعة بعد
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-right font-semibold">الإجراء</TableHead>
                        <TableHead className="text-right font-semibold">الموظف</TableHead>
                        <TableHead className="text-right font-semibold">المبلغ</TableHead>
                        <TableHead className="text-right font-semibold">التوقيت</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movementAuditLogs.map((log) => {
                        const entityId = (log.newValue?.employeeId ?? log.oldValue?.employeeId) as number | undefined;
                        const emp = entityId !== undefined ? empMap.get(entityId) : undefined;
                        return (
                          <AuditLogRow
                            key={log.id}
                            log={log}
                            employeeName={emp?.name ?? "—"}
                          />
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>

      </div>

      {/* ── Add Movement Dialog ── */}
      <AddMovementDialog
        key={dialogKey}
        open={dialogOpen}
        initialType={dialogType}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
