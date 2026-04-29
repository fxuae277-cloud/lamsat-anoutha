import { useState, useMemo } from "react";
import { Users, UserCheck, Wallet, AlertCircle, Search, Eye, Pencil, X, CreditCard } from "lucide-react";

import { usePayroll }        from "@/hooks/usePayroll";
import type { PayrollRow }   from "@/lib/payroll-types";

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

// ─── Constants ────────────────────────────────────────────────────────────────

const PINK = "#E91E63";
function omr(n: number) { return formatOMR(n); }

// ─── Mobile Card ──────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { employees, payrollRows, bulkPayUnpaid } = usePayroll();
  const toast = usePayrollToast();

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
    bulkPayUnpaid("bank_transfer", "المستخدم الحالي", ids);
    toast.successBulkPay(count);
    clearSelection();
  }

  function handleView(_id: number) {}
  function handleEdit(_id: number) {}

  return (
    <div dir="rtl" className="font-sans min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        <PageHeader
          title="الموظفون"
          subtitle="إدارة بيانات الموظفين والرواتب"
          actions={
            <Button className="gap-2 text-white font-semibold" style={{ backgroundColor: PINK }}>
              <span className="text-lg leading-none">+</span>إضافة موظف
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="إجمالي الموظفين"       value={stats.total}                    color="pink"   icon={<Users className="h-4 w-4" />} />
          <StatCard title="موظفون نشطون"           value={stats.active}                   color="green"  icon={<UserCheck className="h-4 w-4" />} />
          <StatCard title="إجمالي الرواتب الشهرية" value={omr(stats.totalSalaries)}       color="blue"   icon={<Wallet className="h-4 w-4" />} />
          <StatCard title="رواتب غير مدفوعة"       value={`${stats.unpaidCount} موظف`}   color="orange" icon={<AlertCircle className="h-4 w-4" />} />
        </div>

        {/* Filters */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="البحث بالاسم..." value={search} onChange={(e) => setSearch(e.target.value)} className="pe-9 text-start" />
              </div>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="الفرع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفروع</SelectItem>
                  {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="suspended">موقف</SelectItem>
                  <SelectItem value="inactive">منتهي</SelectItem>
                </SelectContent>
              </Select>
              <Select value={payFilter} onValueChange={setPayFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="حالة الراتب" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="paid">مدفوع</SelectItem>
                  <SelectItem value="partial">جزئي</SelectItem>
                  <SelectItem value="unpaid">غير مدفوع</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bulk bar */}
        {someSelected && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-white flex-wrap" style={{ backgroundColor: PINK }}>
            <span className="font-medium text-sm">تم تحديد {selected.size} موظف</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" className="gap-1.5 font-medium" onClick={handleBulkPay}>
                <CreditCard className="h-4 w-4" />دفع الرواتب
              </Button>
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 gap-1.5" onClick={clearSelection}>
                <X className="h-4 w-4" />إلغاء التحديد
              </Button>
            </div>
          </div>
        )}

        {/* Desktop table */}
        <Card className="shadow-sm hidden md:block">
          <CardHeader className="px-4 py-3 border-b">
            <CardTitle className="text-base font-semibold">
              قائمة الموظفين
              <span className="text-muted-foreground font-normal text-sm me-2">({filtered.length})</span>
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10 text-start">
                  <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
                </TableHead>
                <TableHead className="text-start font-semibold">الاسم</TableHead>
                <TableHead className="text-start font-semibold">الفرع</TableHead>
                <TableHead className="text-start font-semibold">المنصب</TableHead>
                <TableHead className="text-start font-semibold">الحالة</TableHead>
                <TableHead className="text-start font-semibold">الراتب الشهري</TableHead>
                <TableHead className="text-start font-semibold">حالة الراتب</TableHead>
                <TableHead className="text-start font-semibold w-20">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState message="لا توجد نتائج مطابقة للبحث أو الفلتر المحدد" />
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

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} id="select-all-mobile" />
              <label htmlFor="select-all-mobile" className="text-sm text-muted-foreground cursor-pointer">
                تحديد الكل ({filtered.length})
              </label>
            </div>
          )}
          {filtered.length === 0
            ? <EmptyState message="لا توجد نتائج مطابقة للبحث أو الفلتر المحدد" />
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
            عرض {filtered.length} من {employees.length} موظف &nbsp;·&nbsp;
            الصافي = الأساسي + المستحقات + العمولات − الخصومات − السلف
          </p>
        )}
      </div>
    </div>
  );
}

