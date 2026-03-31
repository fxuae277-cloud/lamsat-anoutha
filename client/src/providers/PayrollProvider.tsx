import { createContext, useReducer, useMemo, type ReactNode } from "react";
import type {
  Employee,
  FinancialMovement,
  PayrollPayment,
  AuditLog,
  PayrollRow,
  PayrollContextType,
  AddMovementInput,
  AddPaymentInput,
  PaymentMethod,
  MovementStatus,
} from "../lib/payroll-types";
import {
  dummyEmployees,
  dummyMovements,
  dummyPayments,
} from "../lib/payroll-dummy-data";

// ─── Context ──────────────────────────────────────────────────────────────────

export const PayrollContext = createContext<PayrollContextType | null>(null);

// ─── State Shape ──────────────────────────────────────────────────────────────

interface PayrollState {
  employees: Employee[];
  movements: FinancialMovement[];
  payments: PayrollPayment[];
  auditLogs: AuditLog[];
  selectedMonth: number;
  selectedYear: number;
  nextMovementId: number;
  nextPaymentId: number;
  nextAuditId: number;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_MONTH"; payload: number }
  | { type: "SET_YEAR"; payload: number }
  | { type: "ADD_MOVEMENT"; payload: FinancialMovement; audit: AuditLog }
  | { type: "CANCEL_MOVEMENT"; movementId: number; audit: AuditLog }
  | { type: "ADD_PAYMENT"; payload: PayrollPayment; audit: AuditLog }
  | { type: "BULK_PAY"; payments: PayrollPayment[]; audits: AuditLog[] };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: PayrollState, action: Action): PayrollState {
  switch (action.type) {
    case "SET_MONTH":
      return { ...state, selectedMonth: action.payload };

    case "SET_YEAR":
      return { ...state, selectedYear: action.payload };

    case "ADD_MOVEMENT":
      return {
        ...state,
        movements: [...state.movements, action.payload],
        auditLogs: [...state.auditLogs, action.audit],
        nextMovementId: state.nextMovementId + 1,
        nextAuditId: state.nextAuditId + 1,
      };

    case "CANCEL_MOVEMENT":
      return {
        ...state,
        movements: state.movements.map((m) =>
          m.id === action.movementId
            ? { ...m, status: "cancelled" as MovementStatus }
            : m
        ),
        auditLogs: [...state.auditLogs, action.audit],
        nextAuditId: state.nextAuditId + 1,
      };

    case "ADD_PAYMENT":
      return {
        ...state,
        payments: [...state.payments, action.payload],
        auditLogs: [...state.auditLogs, action.audit],
        nextPaymentId: state.nextPaymentId + 1,
        nextAuditId: state.nextAuditId + 1,
      };

    case "BULK_PAY":
      return {
        ...state,
        payments: [...state.payments, ...action.payments],
        auditLogs: [...state.auditLogs, ...action.audits],
        nextPaymentId: state.nextPaymentId + action.payments.length,
        nextAuditId: state.nextAuditId + action.audits.length,
      };

    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computePayrollRows(
  employees: Employee[],
  movements: FinancialMovement[],
  payments: PayrollPayment[],
  month: number,
  year: number
): PayrollRow[] {
  return employees.map((employee) => {
    const empMovements = movements.filter(
      (m) =>
        m.employeeId === employee.id &&
        m.status === "active" &&
        new Date(m.date).getMonth() + 1 === month &&
        new Date(m.date).getFullYear() === year
    );

    const empPayments = payments.filter(
      (p) =>
        p.employeeId === employee.id &&
        p.month === month &&
        p.year === year
    );

    const totalBonus = empMovements
      .filter((m) => m.type === "bonus")
      .reduce((sum, m) => sum + m.amount, 0);

    const totalOvertime = empMovements
      .filter((m) => m.type === "overtime")
      .reduce((sum, m) => sum + m.amount, 0);

    const totalDeduction = empMovements
      .filter((m) => m.type === "deduction")
      .reduce((sum, m) => sum + m.amount, 0);

    const totalAdvance = empMovements
      .filter((m) => m.type === "advance")
      .reduce((sum, m) => sum + m.amount, 0);

    const netSalary =
      employee.baseSalary +
      totalBonus +
      totalOvertime -
      totalDeduction -
      totalAdvance;

    const amountPaid = empPayments.reduce((sum, p) => sum + p.amount, 0);

    let paymentStatus: PayrollRow["paymentStatus"] = "unpaid";
    if (amountPaid >= netSalary) {
      paymentStatus = "paid";
    } else if (amountPaid > 0) {
      paymentStatus = "partial";
    }

    return {
      employee,
      totalBonus,
      totalDeduction,
      totalAdvance,
      totalOvertime,
      netSalary,
      paymentStatus,
      amountPaid,
      movements: empMovements,
      payments: empPayments,
    };
  });
}

// ─── Initial State ────────────────────────────────────────────────────────────

const now = new Date();
const initialState: PayrollState = {
  employees: dummyEmployees,
  movements: dummyMovements,
  payments: dummyPayments,
  auditLogs: [],
  selectedMonth: now.getMonth() + 1,
  selectedYear: now.getFullYear(),
  nextMovementId:
    Math.max(0, ...dummyMovements.map((m) => m.id)) + 1,
  nextPaymentId:
    Math.max(0, ...dummyPayments.map((p) => p.id)) + 1,
  nextAuditId: 1,
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PayrollProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const payrollRows = useMemo(
    () =>
      computePayrollRows(
        state.employees,
        state.movements,
        state.payments,
        state.selectedMonth,
        state.selectedYear
      ),
    [
      state.employees,
      state.movements,
      state.payments,
      state.selectedMonth,
      state.selectedYear,
    ]
  );

  const setSelectedMonth = (month: number) =>
    dispatch({ type: "SET_MONTH", payload: month });

  const setSelectedYear = (year: number) =>
    dispatch({ type: "SET_YEAR", payload: year });

  const addMovement = (input: AddMovementInput) => {
    const movement: FinancialMovement = {
      id: state.nextMovementId,
      ...input,
      status: "active",
    };
    const audit: AuditLog = {
      id: state.nextAuditId,
      action: "add_movement",
      entityType: "movement",
      entityId: movement.id,
      oldValue: null,
      newValue: movement as unknown as Record<string, unknown>,
      userId: input.createdBy,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: "ADD_MOVEMENT", payload: movement, audit });
  };

  const cancelMovement = (movementId: number, cancelledBy: string) => {
    const existing = state.movements.find((m) => m.id === movementId);
    if (!existing) return;
    const audit: AuditLog = {
      id: state.nextAuditId,
      action: "cancel_movement",
      entityType: "movement",
      entityId: movementId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: { ...existing, status: "cancelled" } as unknown as Record<string, unknown>,
      userId: cancelledBy,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: "CANCEL_MOVEMENT", movementId, audit });
  };

  const addPayment = (input: AddPaymentInput) => {
    const payment: PayrollPayment = {
      id: state.nextPaymentId,
      ...input,
      paidAt: new Date().toISOString(),
    };
    const audit: AuditLog = {
      id: state.nextAuditId,
      action: "add_payment",
      entityType: "payment",
      entityId: payment.id,
      oldValue: null,
      newValue: payment as unknown as Record<string, unknown>,
      userId: input.paidBy,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: "ADD_PAYMENT", payload: payment, audit });
  };

  const bulkPayUnpaid = (method: PaymentMethod, paidBy: string) => {
    const unpaidRows = payrollRows.filter(
      (row) =>
        row.employee.status === "active" &&
        row.paymentStatus !== "paid" &&
        row.netSalary > 0
    );

    let paymentIdCounter = state.nextPaymentId;
    let auditIdCounter = state.nextAuditId;

    const newPayments: PayrollPayment[] = [];
    const newAudits: AuditLog[] = [];

    for (const row of unpaidRows) {
      const remaining = row.netSalary - row.amountPaid;
      if (remaining <= 0) continue;

      const payment: PayrollPayment = {
        id: paymentIdCounter++,
        employeeId: row.employee.id,
        month: state.selectedMonth,
        year: state.selectedYear,
        amount: remaining,
        method,
        paidAt: new Date().toISOString(),
        paidBy,
      };

      const audit: AuditLog = {
        id: auditIdCounter++,
        action: "bulk_pay",
        entityType: "payment",
        entityId: payment.id,
        oldValue: null,
        newValue: payment as unknown as Record<string, unknown>,
        userId: paidBy,
        timestamp: new Date().toISOString(),
      };

      newPayments.push(payment);
      newAudits.push(audit);
    }

    if (newPayments.length > 0) {
      dispatch({ type: "BULK_PAY", payments: newPayments, audits: newAudits });
    }
  };

  const value: PayrollContextType = {
    employees: state.employees,
    movements: state.movements,
    payments: state.payments,
    auditLogs: state.auditLogs,
    payrollRows,
    selectedMonth: state.selectedMonth,
    selectedYear: state.selectedYear,
    setSelectedMonth,
    setSelectedYear,
    addMovement,
    cancelMovement,
    addPayment,
    bulkPayUnpaid,
  };

  return (
    <PayrollContext.Provider value={value}>
      {children}
    </PayrollContext.Provider>
  );
}
