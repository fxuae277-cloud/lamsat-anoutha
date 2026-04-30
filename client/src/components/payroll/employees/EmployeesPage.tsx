import { useState, useMemo } from "react";
import { Users, UserCheck, Wallet, AlertCircle, Search, Eye, Pencil, X, CreditCard } from "lucide-react";

import { usePayroll }        from "@/hooks/usePayroll";
import type { PayrollRow }   from "@/lib/payroll-types";
import { useI18n }           from "@/lib/i18n";

import { Button }            from "@/components/ui/button";
import { Input }             from "@/components/ui/input";
import { Checkbox }          from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { PageHeader }          from "@/components/payroll/shared/PageHeader";
import { StatCard }            from "@/components/payroll/shared/StatCard";
import { EmptyState }          from "@/components/payroll/shared/EmptyState";
import { EmployeeStatusBadge, PaymentStatusBadge } from "@/components/payroll/shared/PayrollBadge";
import { usePayrollToast }     from "@/components/payroll/shared/usePayrollToast";
import { formatOMR }           from "@/components/payroll/shared/payrollUtils";

const PINK = "#E91E63";
function omr(n: number) { return formatOMR(n); }

interface MobileCardProps {
  row: PayrollRow;
  selected: boolean;
  onSelect: (id: number, checked: boolean) => void;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
}

function MobileEmployeeCard({ row, selected, onSelect, onView, onEdit }: MobileCardProps) {
  const { employee } = row;
  return (
    <Card className={`shadow-sm transition-colors ${selected ? "border-[#E91E63] bg-pink-50/40" : ""}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox checked={selected} onCheckedChange={(v) => onSelect(employee.id, !!v)} className="mt-1" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base truncate">{employee.name}</p>
            <p className="text-sm text-muted-foreground truncate">{employee.position}</p>
            <p className="text-xs text-muted-foreground truncate">{employee.branch}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onView(employee.id)}><Eye className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(employee.id)}><Pencil className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <div className="flex items-center gap-2">
            <EmployeeStatusBadge status={employee.status} />
            <PaymentStatusBadge status={row.paymentStatus} />
          </div>
          <span className="text-sm font-medium text-muted-foreground">{omr(row.netSalary)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EmployeesPage() {
  const { employees, payrollRows, bulkPayUnpaid } = usePayroll();
  const toast = usePayrollToast();
  const { t } = useI18n();
  const NS = "payroll:employees";

  const [search, setSearch]             = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payFilter, setPayFilter]       = useState("all");
  const [selected, setSelected]         = useState<Set<number>>(new Set());

  const branches = useMemo(
    () => Array.from(new Set(employees.map((e) => e.branch))),
    [employees]
  );

  const filtered = useMemo(() => payrollRows.filter((row) => {
    const { employee } = row;
    if (search && !employee.name.includes(search)) return false;
    if (branchFilter !== "all" && employee.branch !== branchFilter) return false;
    if (statusFilter !== "all" && employee.status !== statusFilter) return false;
    if (payFilter !== "all" && row.paymentStatus !== payFilter) return false;
    return true;
  }), [payrollRows, search, branchFilter, statusFilter, payFilter]);

  const stats = useMemo(() => {
    const totalSalaries = employees.filter((e) => e.status === "active").reduce((s, e) => s + e.baseSalary, 0);
    const unpaidCount = payrollRows.filter((r) => r.employee.status === "active" && r.paymentStatus === "unpaid").length;
    return { total: employees.length, active: employees.filter((e) => e.status === "active").length, totalSalaries, unpaidCount };
  }, [employees, payrollRows]);

  const allFilteredIds = filtered.map((r) => r.employee.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll(checked: boolean) { setSelected(checked ? new Set(allFilteredIds) : new Set()); }
  function toggleOne(id: number, checked: boolean) {
    setSelected((prev) => { const next = new Set(prev); checked ? next.add(id) : next.delete(id); return next; });
  }
  function clearSelection() { setSelected(new Set()); }

  function handleBulkPay() {
    const ids = Array.from(selected);
    const count = payrollRows.filter(
      (r) => ids.includes(r.employee.id) && r.paymentStatus !== "paid"
    ).length;
    bulkPayUnpaid("bank_transfer", t(`${NS}.currentUserLabel`), ids);
    toast.successBulkPay(count);
    clearSelection();
  }

  function handleView(_id: number) {}
  function handleEdit(_id: number) {}

  return (
    <div className="font-sans min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        <PageHeader
          title={t(`${NS}.title`)}
          subtitle={t(`${NS}.subtitle`)}
          actions={
            <Button className="gap-2 text-white font-semibold" style={{ backgroundColor: PINK }}>
              <span className="text-lg leading-none">+</span>{t(`${NS}.addEmployee`)}
            </Button>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={t(`${NS}.statTotal`)}          value={stats.total}                                           color="pink"   icon={<Users className="h-4 w-4" />} />
          <StatCard title={t(`${NS}.statActive`)}         value={stats.active}                                          color="green"  icon={<UserCheck className="h-4 w-4" />} />
          <StatCard title={t(`${NS}.statTotalSalaries`)}  value={omr(stats.totalSalaries)}                              color="blue"   icon={<Wallet className="h-4 w-4" />} />
          <StatCard title={t(`${NS}.statUnpaid`)}         value={t(`${NS}.unpaidUnit`, { count: stats.unpaidCount })}   color="orange" icon={<AlertCircle className="h-4 w-4" />} />
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input placeholder={t(`${NS}.searchPlaceholder`)} value={search} onChange={(e) => setSearch(e.target.value)} className="pe-9 text-start" />
              </div>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder={t(`${NS}.branch`)} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(`${NS}.allBranches`)}</SelectItem>
                  {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder={t(`${NS}.status`)} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(`${NS}.allStatuses`)}</SelectItem>
                  <SelectItem value="active">{t(`${NS}.statusActive`)}</SelectItem>
                  <SelectItem value="suspended">{t(`${NS}.statusSuspended`)}</SelectItem>
                  <SelectItem value="inactive">{t(`${NS}.statusInactive`)}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={payFilter} onValueChange={setPayFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder={t(`${NS}.payStatus`)} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(`${NS}.allStatuses`)}</SelectItem>
                  <SelectItem value="paid">{t(`${NS}.payPaid`)}</SelectItem>
                  <SelectItem value="partial">{t(`${NS}.payPartial`)}</SelectItem>
                  <SelectItem value="unpaid">{t(`${NS}.payUnpaid`)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {someSelected && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-white flex-wrap" style={{ backgroundColor: PINK }}>
            <span className="font-medium text-sm">{t(`${NS}.selectedCount`, { count: selected.size })}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" className="gap-1.5 font-medium" onClick={handleBulkPay}>
                <CreditCard className="h-4 w-4" />{t(`${NS}.payAll`)}
              </Button>
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 gap-1.5" onClick={clearSelection}>
                <X className="h-4 w-4" />{t(`${NS}.clearSelection`)}
              </Button>
            </div>
          </div>
        )}

        <Card className="shadow-sm hidden md:block">
          <CardHeader className="px-4 py-3 border-b">
            <CardTitle className="text-base font-semibold">
              {t(`${NS}.listTitle`)}
              <span className="text-muted-foreground font-normal text-sm me-2">({filtered.length})</span>
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10 text-start">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
                </TableHead>
                <TableHead className="text-start font-semibold">{t(`${NS}.thName`)}</TableHead>
                <TableHead className="text-start font-semibold">{t(`${NS}.thBranch`)}</TableHead>
                <TableHead className="text-start font-semibold">{t(`${NS}.thPosition`)}</TableHead>
                <TableHead className="text-start font-semibold">{t(`${NS}.thStatus`)}</TableHead>
                <TableHead className="text-start font-semibold">{t(`${NS}.thMonthlySalary`)}</TableHead>
                <TableHead className="text-start font-semibold">{t(`${NS}.thPayStatus`)}</TableHead>
                <TableHead className="text-start font-semibold w-20">{t(`${NS}.thActions`)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState message={t(`${NS}.emptyResults`)} />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const { employee } = row;
                  const isSelected = selected.has(employee.id);
                  return (
                    <TableRow key={employee.id} className={`transition-colors ${isSelected ? "bg-pink-50/60" : "hover:bg-muted/30"}`}>
                      <TableCell><Checkbox checked={isSelected} onCheckedChange={(v) => toggleOne(employee.id, !!v)} /></TableCell>
                      <TableCell><p className="font-medium">{employee.name}</p></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{employee.branch}</TableCell>
                      <TableCell className="text-sm">{employee.position}</TableCell>
                      <TableCell><EmployeeStatusBadge status={employee.status} /></TableCell>
                      <TableCell className="font-medium tabular-nums">{omr(row.netSalary)}</TableCell>
                      <TableCell><PaymentStatusBadge status={row.paymentStatus} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleView(employee.id)}><Eye className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(employee.id)}><Pencil className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        <div className="md:hidden space-y-3">
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} id="select-all-mobile" />
              <label htmlFor="select-all-mobile" className="text-sm text-muted-foreground cursor-pointer">
                {t(`${NS}.selectAll`, { count: filtered.length })}
              </label>
            </div>
          )}
          {filtered.length === 0
            ? <EmptyState message={t(`${NS}.emptyResults`)} />
            : filtered.map((row) => (
                <MobileEmployeeCard
                  key={row.employee.id} row={row}
                  selected={selected.has(row.employee.id)}
                  onSelect={toggleOne} onView={handleView} onEdit={handleEdit}
                />
              ))
          }
        </div>

        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground pb-2">
            {t(`${NS}.footerText`, { shown: filtered.length, total: employees.length })}
          </p>
        )}
      </div>
    </div>
  );
}
