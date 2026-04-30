import { useState, useMemo, type ReactNode } from "react";
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
  AuditLog,
} from "@/lib/payroll-types";
import { useI18n } from "@/lib/i18n";

import { Button }           from "@/components/ui/button";
import { Input }            from "@/components/ui/input";
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

import { PageHeader }       from "@/components/payroll/shared/PageHeader";
import { StatCard }         from "@/components/payroll/shared/StatCard";
import { EmptyState }       from "@/components/payroll/shared/EmptyState";
import { MovementTypeBadge, MovementStatusBadge } from "@/components/payroll/shared/PayrollBadge";
import { usePayrollToast }  from "@/components/payroll/shared/usePayrollToast";
import { MONTHS_AR, YEARS, formatOMR } from "@/components/payroll/shared/payrollUtils";

const MOVEMENT_META_BASE: Record<MovementType, { color: string; bg: string; icon: ReactNode; metaKey: string }> = {
  bonus:     { color: "#4CAF50", bg: "#e8f5e9", icon: <TrendingUp  className="h-4 w-4" />, metaKey: "metaBonus" },
  overtime:  { color: "#2196F3", bg: "#e3f2fd", icon: <Star        className="h-4 w-4" />, metaKey: "metaOvertime" },
  deduction: { color: "#FF9800", bg: "#fff3e0", icon: <TrendingDown className="h-4 w-4" />, metaKey: "metaDeduction" },
  advance:   { color: "#F44336", bg: "#ffebee", icon: <Banknote    className="h-4 w-4" />, metaKey: "metaAdvance" },
};

function formatDate(iso: string) {
  if (!iso) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

function formatDateTime(iso: string) {
  if (!iso) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()} ${hours}:${mins}`;
}

interface AddDialogProps {
  open: boolean;
  initialType: MovementType;
  onClose: () => void;
}

function AddMovementDialog({ open, initialType, onClose }: AddDialogProps) {
  const { employees, addMovement, selectedMonth, selectedYear } = usePayroll();
  const toast = usePayrollToast();
  const { t } = useI18n();
  const NS = "payroll:movements";
  const NS_EMP = "payroll:employees";

  const [employeeId,    setEmployeeId]    = useState<string>("");
  const [type,          setType]          = useState<MovementType>(initialType);
  const [amount,        setAmount]        = useState<string>("");
  const [month,         setMonth]         = useState<string>(String(selectedMonth));
  const [year,          setYear]          = useState<string>(String(selectedYear));
  const [reason,        setReason]        = useState<string>("");
  const [error,         setError]         = useState<string>("");
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  function reset() {
    setEmployeeId("");
    setType(initialType);
    setAmount("");
    setMonth(String(selectedMonth));
    setYear(String(selectedYear));
    setReason("");
    setError("");
    setIsSubmitting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!employeeId) { setError(t(`${NS}.errorSelectEmployee`)); return; }
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError(t(`${NS}.errorPositiveAmount`));
      return;
    }
    if (!reason.trim()) { setError(t(`${NS}.errorReason`)); return; }

    setIsSubmitting(true);
    const m   = parseInt(month);
    const y   = parseInt(year);
    const day = `${y}-${String(m).padStart(2, "0")}-01`;

    const emp = employees.find((e) => String(e.id) === employeeId);

    addMovement({
      employeeId: parseInt(employeeId),
      type,
      amount: parsedAmount,
      reason: reason.trim(),
      date: day,
      createdBy: t(`${NS_EMP}.currentUserLabel`),
    });

    toast.successAdd(emp?.name);
    setIsSubmitting(false);
    handleClose();
  }

  const meta = MOVEMENT_META_BASE[type];
  const typeLabel = t(`${NS}.${meta.metaKey}`);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: meta.color }}
            >
              {meta.icon}
            </span>
            {t(`${NS}.addPrefix`, { type: typeLabel })}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t(`${NS}.dialogDesc`)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t(`${NS}.employeeLabel`)}</label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder={t(`${NS}.selectEmployee`)} />
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t(`${NS}.typeLabel`)}</label>
            <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MOVEMENT_META_BASE) as MovementType[]).map((mt) => (
                  <SelectItem key={mt} value={mt}>
                    {t(`${NS}.${MOVEMENT_META_BASE[mt].metaKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t(`${NS}.amountLabel`)}</label>
            <Input
              type="number"
              min="0"
              step="0.001"
              placeholder={t(`${NS}.amountPlaceholder`)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-start"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t(`${NS}.monthLabel`)}</label>
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
              <label className="text-sm font-medium">{t(`${NS}.yearLabel`)}</label>
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t(`${NS}.reasonLabel`)}</label>
            <Textarea
              placeholder={t(`${NS}.reasonPlaceholder`)}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-start resize-none"
              rows={3}
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
            className="text-white"
            style={{ backgroundColor: meta.color }}
          >
            {isSubmitting ? t(`${NS}.submitting`) : t(`${NS}.submit`)}
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t(`${NS}.dialogCancel`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditLogRow({ log, employeeName }: { log: AuditLog; employeeName: string }) {
  const { t } = useI18n();
  const NS = "payroll:movements";

  const actionLabelKeys: Record<string, string> = {
    add_movement:    "auditAddMovement",
    cancel_movement: "auditCancelMovement",
    add_payment:     "auditAddPayment",
    bulk_pay:        "auditBulkPay",
  };

  const amount = (log.newValue?.amount ?? log.oldValue?.amount) as number | undefined;
  const labelKey = actionLabelKeys[log.action];

  return (
    <TableRow className="text-sm">
      <TableCell className="font-medium">
        {labelKey ? t(`${NS}.${labelKey}`) : log.action}
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
  const toast = usePayrollToast();
  const { t } = useI18n();
  const NS = "payroll:movements";
  const NS_EMP = "payroll:employees";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<MovementType>("bonus");
  const [dialogKey,  setDialogKey]  = useState(0);

  const [search,     setSearch]     = useState("");
  const [empFilter,  setEmpFilter]  = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [auditOpen, setAuditOpen] = useState(false);

  function openDialog(type: MovementType) {
    setDialogType(type);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  const empMap = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees]
  );

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
      monthMovements.filter((m) => m.type === type).reduce((s, m) => s + m.amount, 0);
    return {
      bonus:     sum("bonus"),
      overtime:  sum("overtime"),
      deduction: sum("deduction"),
      advance:   sum("advance"),
    };
  }, [monthMovements]);

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      const emp  = empMap.get(m.employeeId);
      const name = emp?.name ?? "";
      if (search && !name.includes(search) && !m.reason.includes(search)) return false;
      if (empFilter  !== "all" && String(m.employeeId) !== empFilter) return false;
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      const d = new Date(m.date);
      if (d.getMonth() + 1 !== selectedMonth) return false;
      if (d.getFullYear() !== selectedYear)   return false;
      return true;
    });
  }, [movements, empMap, search, empFilter, typeFilter, selectedMonth, selectedYear]);

  const movementAuditLogs = useMemo(
    () => auditLogs.filter((l) => l.entityType === "movement").slice().reverse(),
    [auditLogs]
  );

  function handleCancel(id: number) {
    const m   = movements.find((mv) => mv.id === id);
    const emp = m ? empMap.get(m.employeeId) : undefined;
    cancelMovement(id, t(`${NS_EMP}.currentUserLabel`));
    toast.successCancel(emp?.name);
  }

  return (
    <div className="font-sans min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        <PageHeader
          title={t(`${NS}.title`)}
          subtitle={t(`${NS}.subtitle`)}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              { type: "bonus",     labelKey: "registerBonus" },
              { type: "overtime",  labelKey: "bonusBtn"      },
              { type: "deduction", labelKey: "deductionBtn"  },
              { type: "advance",   labelKey: "advanceBtn"    },
            ] as { type: MovementType; labelKey: string }[]
          ).map(({ type, labelKey }) => {
            const m = MOVEMENT_META_BASE[type];
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
                <span>{t(`${NS}.${labelKey}`)}</span>
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={t(`${NS}.statBonus`)}     value={formatOMR(stats.bonus)}     color="green"  icon={<TrendingUp  className="h-4 w-4" />} />
          <StatCard title={t(`${NS}.statOvertime`)}  value={formatOMR(stats.overtime)}  color="blue"   icon={<Star        className="h-4 w-4" />} />
          <StatCard title={t(`${NS}.statDeduction`)} value={formatOMR(stats.deduction)} color="orange" icon={<TrendingDown className="h-4 w-4" />} />
          <StatCard title={t(`${NS}.statAdvance`)}   value={formatOMR(stats.advance)}   color="red"    icon={<Banknote    className="h-4 w-4" />} />
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={t(`${NS}.searchPlaceholder`)}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pe-9 text-start"
                />
              </div>

              <Select value={empFilter} onValueChange={setEmpFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t(`${NS}.employeeFilter`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(`${NS}.allEmployees`)}</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t(`${NS}.typeFilter`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(`${NS}.allTypes`)}</SelectItem>
                  {(Object.keys(MOVEMENT_META_BASE) as MovementType[]).map((mt) => (
                    <SelectItem key={mt} value={mt}>
                      {t(`${NS}.${MOVEMENT_META_BASE[mt].metaKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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

        <Card className="shadow-sm">
          <CardHeader className="px-4 py-3 border-b">
            <CardTitle className="text-base font-semibold">
              {t(`${NS}.listTitle`)}
              <span className="text-muted-foreground font-normal text-sm me-2">
                ({filtered.length})
              </span>
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-start font-semibold">{t(`${NS}.thEmployee`)}</TableHead>
                <TableHead className="text-start font-semibold">{t(`${NS}.thType`)}</TableHead>
                <TableHead className="text-start font-semibold">{t(`${NS}.thAmount`)}</TableHead>
                <TableHead className="text-start font-semibold hidden sm:table-cell">{t(`${NS}.thMonth`)}</TableHead>
                <TableHead className="text-start font-semibold hidden md:table-cell">{t(`${NS}.thNote`)}</TableHead>
                <TableHead className="text-start font-semibold">{t(`${NS}.thStatus`)}</TableHead>
                <TableHead className="text-start font-semibold hidden lg:table-cell">{t(`${NS}.thAdded`)}</TableHead>
                <TableHead className="text-start font-semibold w-20">{t(`${NS}.thAction`)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState message={t(`${NS}.empty`)} />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const emp = empMap.get(m.employeeId);
                  const d   = new Date(m.date);
                  const monthName = MONTHS_AR[d.getMonth()];
                  return (
                    <TableRow key={m.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{emp?.name ?? t(`${NS}.employeeFallback`, { id: m.employeeId })}</p>
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
                          onClick={() => handleCancel(m.id)}
                        >
                          <Ban className="h-3.5 w-3.5" />
                          {t(`${NS}.cancel`)}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
          <Card className="shadow-sm">
            <CollapsibleTrigger asChild>
              <CardHeader className="px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    {t(`${NS}.auditTitle`)}
                    <span className="text-muted-foreground font-normal text-sm">
                      ({movementAuditLogs.length})
                    </span>
                  </CardTitle>
                  {auditOpen
                    ? <ChevronUp   className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="border-t">
                {movementAuditLogs.length === 0 ? (
                  <EmptyState message={t(`${NS}.emptyAudit`)} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-start font-semibold">{t(`${NS}.thAuditAction`)}</TableHead>
                        <TableHead className="text-start font-semibold">{t(`${NS}.thAuditEmployee`)}</TableHead>
                        <TableHead className="text-start font-semibold">{t(`${NS}.thAuditAmount`)}</TableHead>
                        <TableHead className="text-start font-semibold">{t(`${NS}.thAuditTime`)}</TableHead>
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

      <AddMovementDialog
        key={dialogKey}
        open={dialogOpen}
        initialType={dialogType}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
