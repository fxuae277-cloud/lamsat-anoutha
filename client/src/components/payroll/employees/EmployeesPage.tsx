import { useState, useMemo } from "react";
import {
  Users,
  UserCheck,
  Wallet,
  AlertCircle,
  Search,
  Eye,
  Pencil,
  X,
  CreditCard,
} from "lucide-react";

import { usePayroll } from "@/hooks/usePayroll";
import type { EmployeeStatus, PaymentStatus, PayrollRow } from "@/lib/payroll-types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PINK = "#E91E63";

function formatOMR(amount: number): string {
  return `${amount.toFixed(3)} ر.ع`;
}

function statusLabel(status: EmployeeStatus): string {
  switch (status) {
    case "active":     return "نشط";
    case "inactive":   return "منتهي";
    case "suspended":  return "موقف";
  }
}

function statusBadge(status: EmployeeStatus) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 border">
          نشط
        </Badge>
      );
    case "suspended":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 border">
          موقف
        </Badge>
      );
    case "inactive":
      return (
        <Badge className="bg-gray-100 text-gray-600 border-gray-200 border">
          منتهي
        </Badge>
      );
  }
}

function paymentStatusLabel(s: PaymentStatus): string {
  switch (s) {
    case "paid":    return "مدفوع";
    case "partial": return "جزئي";
    case "unpaid":  return "غير مدفوع";
  }
}

function paymentStatusBadge(s: PaymentStatus) {
  switch (s) {
    case "paid":
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 border">
          مدفوع
        </Badge>
      );
    case "partial":
      return (
        <Badge className="bg-orange-100 text-orange-700 border-orange-200 border">
          جزئي
        </Badge>
      );
    case "unpaid":
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 border">
          غير مدفوع
        </Badge>
      );
  }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
}

function StatCard({ title, value, icon, iconBg }: StatCardProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate">{title}</p>
          <p className="text-xl font-bold mt-0.5 truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mobile Employee Card ─────────────────────────────────────────────────────

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
        {/* Top row */}
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelect(employee.id, !!v)}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base truncate">{employee.name}</p>
            <p className="text-sm text-muted-foreground truncate">{employee.position}</p>
            <p className="text-xs text-muted-foreground truncate">{employee.branch}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onView(employee.id)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(employee.id)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Bottom row */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <div className="flex items-center gap-2">
            {statusBadge(employee.status)}
            {paymentStatusBadge(row.paymentStatus)}
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {formatOMR(row.netSalary)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { employees, payrollRows, bulkPayUnpaid } = usePayroll();

  // Filters
  const [search, setSearch]               = useState("");
  const [branchFilter, setBranchFilter]   = useState<string>("all");
  const [statusFilter, setStatusFilter]   = useState<string>("all");
  const [payFilter, setPayFilter]         = useState<string>("all");

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Derived lists
  const branches = useMemo(
    () => Array.from(new Set(employees.map((e) => e.branch))),
    [employees]
  );

  const filtered = useMemo(() => {
    return payrollRows.filter((row) => {
      const { employee } = row;
      if (search && !employee.name.includes(search)) return false;
      if (branchFilter !== "all" && employee.branch !== branchFilter) return false;
      if (statusFilter !== "all" && employee.status !== statusFilter) return false;
      if (payFilter !== "all" && row.paymentStatus !== payFilter) return false;
      return true;
    });
  }, [payrollRows, search, branchFilter, statusFilter, payFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalSalaries = employees
      .filter((e) => e.status === "active")
      .reduce((s, e) => s + e.baseSalary, 0);
    const unpaidCount = payrollRows.filter(
      (r) => r.employee.status === "active" && r.paymentStatus === "unpaid"
    ).length;
    return {
      total: employees.length,
      active: employees.filter((e) => e.status === "active").length,
      totalSalaries,
      unpaidCount,
    };
  }, [employees, payrollRows]);

  // Selection handlers
  const allFilteredIds = filtered.map((r) => r.employee.id);
  const allSelected =
    allFilteredIds.length > 0 &&
    allFilteredIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(allFilteredIds));
    } else {
      setSelected(new Set());
    }
  }

  function toggleOne(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleBulkPay() {
    bulkPayUnpaid("bank_transfer", "المدير العام");
    clearSelection();
  }

  // Stub handlers (no-op — no detail/edit pages in 1B)
  function handleView(_id: number) {}
  function handleEdit(_id: number) {}

  return (
    <div dir="rtl" className="font-sans min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">الموظفون</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              إدارة بيانات الموظفين والرواتب
            </p>
          </div>
          <Button
            className="gap-2 text-white font-semibold shadow-md"
            style={{ backgroundColor: PINK }}
          >
            <span className="text-lg leading-none">+</span>
            إضافة موظف
          </Button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="إجمالي الموظفين"
            value={stats.total}
            iconBg="#fce4ec"
            icon={<Users className="h-5 w-5" style={{ color: PINK }} />}
          />
          <StatCard
            title="موظفون نشطون"
            value={stats.active}
            iconBg="#e8f5e9"
            icon={<UserCheck className="h-5 w-5 text-green-600" />}
          />
          <StatCard
            title="إجمالي الرواتب الشهرية"
            value={formatOMR(stats.totalSalaries)}
            iconBg="#e3f2fd"
            icon={<Wallet className="h-5 w-5 text-blue-600" />}
          />
          <StatCard
            title="رواتب غير مدفوعة"
            value={`${stats.unpaidCount} موظف`}
            iconBg="#fff3e0"
            icon={<AlertCircle className="h-5 w-5 text-orange-500" />}
          />
        </div>

        {/* ── Filters ── */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="البحث بالاسم..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9 text-right"
                />
              </div>

              {/* Branch */}
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="الفرع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفروع</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="suspended">موقف</SelectItem>
                  <SelectItem value="inactive">منتهي</SelectItem>
                </SelectContent>
              </Select>

              {/* Payment status */}
              <Select value={payFilter} onValueChange={setPayFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="حالة الراتب" />
                </SelectTrigger>
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

        {/* ── Bulk Action Bar ── */}
        {someSelected && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-white flex-wrap"
            style={{ backgroundColor: PINK }}
          >
            <span className="font-medium text-sm">
              تم تحديد {selected.size} موظف
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 font-medium"
                onClick={handleBulkPay}
              >
                <CreditCard className="h-4 w-4" />
                دفع الرواتب
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20 gap-1.5"
                onClick={clearSelection}
              >
                <X className="h-4 w-4" />
                إلغاء التحديد
              </Button>
            </div>
          </div>
        )}

        {/* ── Desktop Table ── */}
        <Card className="shadow-sm hidden md:block">
          <CardHeader className="px-4 py-3 border-b">
            <CardTitle className="text-base font-semibold">
              قائمة الموظفين
              <span className="text-muted-foreground font-normal text-sm mr-2">
                ({filtered.length})
              </span>
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10 text-right">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                </TableHead>
                <TableHead className="text-right font-semibold">الاسم</TableHead>
                <TableHead className="text-right font-semibold">الفرع</TableHead>
                <TableHead className="text-right font-semibold">المنصب</TableHead>
                <TableHead className="text-right font-semibold">الحالة</TableHead>
                <TableHead className="text-right font-semibold">الراتب الشهري</TableHead>
                <TableHead className="text-right font-semibold">حالة الراتب</TableHead>
                <TableHead className="text-right font-semibold w-20">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-12 text-muted-foreground"
                  >
                    لا توجد نتائج مطابقة للبحث
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const { employee } = row;
                  const isSelected = selected.has(employee.id);
                  return (
                    <TableRow
                      key={employee.id}
                      className={`transition-colors ${isSelected ? "bg-pink-50/60" : "hover:bg-muted/30"}`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(v) => toggleOne(employee.id, !!v)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{employee.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {employee.branch}
                      </TableCell>
                      <TableCell className="text-sm">{employee.position}</TableCell>
                      <TableCell>{statusBadge(employee.status)}</TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {formatOMR(row.netSalary)}
                      </TableCell>
                      <TableCell>{paymentStatusBadge(row.paymentStatus)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleView(employee.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleEdit(employee.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* ── Mobile Cards ── */}
        <div className="md:hidden space-y-3">
          {/* Mobile select-all */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => toggleAll(!!v)}
                id="select-all-mobile"
              />
              <label
                htmlFor="select-all-mobile"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                تحديد الكل ({filtered.length})
              </label>
            </div>
          )}

          {filtered.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-12 text-center text-muted-foreground">
                لا توجد نتائج مطابقة للبحث
              </CardContent>
            </Card>
          ) : (
            filtered.map((row) => (
              <MobileEmployeeCard
                key={row.employee.id}
                row={row}
                selected={selected.has(row.employee.id)}
                onSelect={toggleOne}
                onView={handleView}
                onEdit={handleEdit}
              />
            ))
          )}
        </div>

        {/* ── Footer legend ── */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pb-2">
            <span>
              الراتب الصافي = الراتب الأساسي + المكافآت + الإضافي − الخصومات − السلف
            </span>
            <span className="mr-auto">
              عرض {filtered.length} من {employees.length} موظف
            </span>
          </div>
        )}

      </div>
    </div>
  );
}

// Named export for convenience
export { statusLabel, paymentStatusLabel };
