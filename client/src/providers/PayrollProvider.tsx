import { createContext, useState, useMemo, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Employee,
  FinancialMovement,
  PayrollPayment,
  PayrollRow,
  AuditLog,
  PayrollContextType,
  AddMovementInput,
  AddPaymentInput,
  PaymentMethod,
} from "../lib/payroll-types";

// ─── Context ──────────────────────────────────────────────────────────────────

export const PayrollContext = createContext<PayrollContextType | null>(null);

// ─── DB → Frontend transformers ───────────────────────────────────────────────

function toEmployee(row: any): Employee {
  const empStatus = row.employment_status;
  const status =
    empStatus === "active" ? "active" :
    empStatus === "suspended" ? "suspended" : "inactive";
  return {
    id:         row.id,
    name:       row.name,
    position:   row.role ?? "",
    branch:     row.branch_name ?? "",
    branch_id:  row.branch_id,
    baseSalary: parseFloat(row.salary ?? "0"),
    status,
  };
}

function toMovement(row: any): FinancialMovement {
  // DB "commission" (from employee_commissions) maps to "bonus" at the frontend layer,
  // since both are positive additions and there is no "commission" MovementType in the UI.
  const type: FinancialMovement["type"] =
    row.type === "commission" ? "bonus"    :
    row.type === "bonus"      ? "bonus"    :
    row.type === "advance"    ? "advance"  :
    row.type === "deduction"  ? "deduction": "bonus";
  return {
    id:          row.id,
    employeeId:  row.employee_id,
    type,
    amount:      typeof row.amount === "number" ? row.amount : parseFloat(row.amount ?? "0"),
    reason:      row.reason ?? "",
    date:        row.date,
    createdBy:   row.created_by_name ?? "",
    status:      (row.status === "cancelled" ? "cancelled" : "active") as FinancialMovement["status"],
    sourceTable: row.source_table,
  };
}

function toPayment(row: any): PayrollPayment {
  const monthNum = typeof row.month === "string" ? parseInt(row.month, 10) : (row.month ?? 0);
  return {
    id:         row.id,
    employeeId: row.employee_id,
    month:      monthNum,
    year:       row.year,
    amount:     typeof row.amount === "number" ? row.amount : parseFloat(row.amount ?? "0"),
    method:     row.payment_method as PayrollPayment["method"],
    paidAt:     row.payment_date ?? row.created_at ?? new Date().toISOString(),
    paidBy:     row.paid_by_name ?? "",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computePayrollRows(
  employees: Employee[],
  movements: FinancialMovement[],
  payments: PayrollPayment[]
): PayrollRow[] {
  return employees.map((employee) => {
    const empMovements = movements.filter(
      (m) => m.employeeId === employee.id && m.status === "active"
    );
    const empPayments = payments.filter((p) => p.employeeId === employee.id);

    const totalBonus     = empMovements.filter((m) => m.type === "bonus").reduce((s, m) => s + m.amount, 0);
    const totalDeduction = empMovements.filter((m) => m.type === "deduction").reduce((s, m) => s + m.amount, 0);
    const totalAdvance   = empMovements.filter((m) => m.type === "advance").reduce((s, m) => s + m.amount, 0);

    const netSalary  = Math.max(0, employee.baseSalary + totalBonus - totalDeduction - totalAdvance);
    const amountPaid = empPayments.reduce((s, p) => s + p.amount, 0);

    let paymentStatus: PayrollRow["paymentStatus"] = "unpaid";
    if (netSalary === 0 || amountPaid >= netSalary) paymentStatus = "paid";
    else if (amountPaid > 0) paymentStatus = "partial";

    return {
      employee,
      totalBonus,
      totalDeduction,
      totalAdvance,
      totalOvertime: 0,  // no overtime table in DB; kept for page compat
      netSalary,
      paymentStatus,
      amountPaid,
      movements: empMovements,
      payments:  empPayments,
    };
  });
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const FALLBACK_USER_ID = 1; // used when pages pass string names instead of IDs

export function PayrollProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: rawEmployees = [], isLoading: loadingEmp } = useQuery<any[]>({
    queryKey: ["payroll-employees"],
    queryFn: () => fetch("/api/payroll/ui/employees").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: rawMovements = [], isLoading: loadingMov } = useQuery<any[]>({
    queryKey: ["payroll-movements", selectedMonth, selectedYear],
    queryFn: () =>
      fetch(`/api/payroll/ui/movements?month=${selectedMonth}&year=${selectedYear}`).then((r) => r.json()),
    staleTime: 60 * 1000,
  });

  const { data: rawPayments = [], isLoading: loadingPay } = useQuery<any[]>({
    queryKey: ["payroll-payments", selectedMonth, selectedYear],
    queryFn: () =>
      fetch(`/api/payroll/ui/payments?month=${selectedMonth}&year=${selectedYear}`).then((r) => r.json()),
    staleTime: 60 * 1000,
  });

  const isLoading = loadingEmp || loadingMov || loadingPay;

  // ── Transformed data ──────────────────────────────────────────────────────

  const employees = useMemo(() => rawEmployees.map(toEmployee), [rawEmployees]);
  const movements = useMemo(() => rawMovements.map(toMovement), [rawMovements]);
  const payments  = useMemo(() => rawPayments.map(toPayment),   [rawPayments]);
  const auditLogs: AuditLog[] = []; // kept for backwards compat; use DB reports for audit

  const payrollRows = useMemo(
    () => computePayrollRows(employees, movements, payments),
    [employees, movements, payments]
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const movPeriodKeys = ["payroll-movements", selectedMonth, selectedYear] as const;
  const payPeriodKeys = ["payroll-payments",  selectedMonth, selectedYear] as const;

  const addMovementMut = useMutation({
    mutationFn: (input: AddMovementInput) => {
      const createdBy = isNaN(parseInt(input.createdBy)) ? FALLBACK_USER_ID : parseInt(input.createdBy);
      return fetch("/api/payroll/ui/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:       input.type,
          employeeId: input.employeeId,
          amount:     input.amount,
          reason:     input.reason,
          date:       input.date,
          createdBy,
        }),
      }).then((r) => r.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: movPeriodKeys }),
  });

  const cancelMovementMut = useMutation({
    mutationFn: ({ movementId, cancelledBy }: { movementId: number; cancelledBy: string }) => {
      const movement = movements.find((m) => m.id === movementId);
      const sourceTable = movement?.sourceTable ?? "employee_advances";
      const cancelledById = isNaN(parseInt(cancelledBy)) ? FALLBACK_USER_ID : parseInt(cancelledBy);
      return fetch(`/api/payroll/ui/movements/${sourceTable}/${movementId}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelledBy: cancelledById }),
      }).then((r) => r.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: movPeriodKeys }),
  });

  const addPaymentMut = useMutation({
    mutationFn: (input: AddPaymentInput) => {
      const paidBy = isNaN(parseInt(input.paidBy)) ? FALLBACK_USER_ID : parseInt(input.paidBy);
      return fetch("/api/payroll/ui/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId:    input.employeeId,
          month:         input.month,
          year:          input.year,
          amount:        input.amount,
          paymentMethod: input.method,
          paidBy,
        }),
      }).then((r) => r.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payPeriodKeys }),
  });

  const bulkPayMut = useMutation({
    mutationFn: (payload: { method: PaymentMethod; paidBy: string; employeeIds?: number[] }) => {
      const paidBy = isNaN(parseInt(payload.paidBy)) ? FALLBACK_USER_ID : parseInt(payload.paidBy);
      return fetch("/api/payroll/ui/bulk-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds:   payload.employeeIds ?? employees.map((e) => e.id),
          month:         selectedMonth,
          year:          selectedYear,
          paymentMethod: payload.method,
          paidBy,
        }),
      }).then((r) => r.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: payPeriodKeys }),
  });

  // ── Context value ─────────────────────────────────────────────────────────

  const value: PayrollContextType = {
    employees,
    movements,
    payments,
    auditLogs,
    payrollRows,
    selectedMonth,
    selectedYear,
    isLoading,
    setSelectedMonth,
    setSelectedYear,
    addMovement:    (input) => { addMovementMut.mutate(input); },
    cancelMovement: (movementId, cancelledBy) => { cancelMovementMut.mutate({ movementId, cancelledBy }); },
    addPayment:     (input) => { addPaymentMut.mutate(input); },
    bulkPayUnpaid:  (method, paidBy, employeeIds) => { bulkPayMut.mutate({ method, paidBy, employeeIds }); },
  };

  return (
    <PayrollContext.Provider value={value}>
      {children}
    </PayrollContext.Provider>
  );
}
