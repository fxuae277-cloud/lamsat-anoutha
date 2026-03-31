// ─── Payroll Types ────────────────────────────────────────────────────────────

export type EmployeeStatus = "active" | "inactive" | "suspended";

export interface Employee {
  id: number;
  name: string;
  position: string;
  branch: string;
  baseSalary: number;
  status: EmployeeStatus;
}

// ─── Financial Movements ──────────────────────────────────────────────────────

export type MovementType = "bonus" | "deduction" | "advance" | "overtime";
export type MovementStatus = "active" | "cancelled";

export interface FinancialMovement {
  id: number;
  employeeId: number;
  type: MovementType;
  amount: number;
  reason: string;
  date: string; // ISO date string "YYYY-MM-DD"
  createdBy: string;
  status: MovementStatus;
}

// ─── Payroll Payments ─────────────────────────────────────────────────────────

export type PaymentMethod = "bank_transfer" | "cash" | "cheque";

export interface PayrollPayment {
  id: number;
  employeeId: number;
  month: number; // 1–12
  year: number;
  amount: number;
  method: PaymentMethod;
  paidAt: string; // ISO date string
  paidBy: string;
}

// ─── Computed Payroll Row ─────────────────────────────────────────────────────

export type PaymentStatus = "paid" | "unpaid" | "partial";

export interface PayrollRow {
  employee: Employee;
  totalBonus: number;
  totalDeduction: number;
  totalAdvance: number;
  totalOvertime: number;
  netSalary: number;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  movements: FinancialMovement[];
  payments: PayrollPayment[];
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: number;
  action: string;
  entityType: "movement" | "payment" | "employee";
  entityId: number;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  userId: string;
  timestamp: string; // ISO datetime string
}

// ─── Context Type ─────────────────────────────────────────────────────────────

export interface AddMovementInput {
  employeeId: number;
  type: MovementType;
  amount: number;
  reason: string;
  date: string;
  createdBy: string;
}

export interface AddPaymentInput {
  employeeId: number;
  month: number;
  year: number;
  amount: number;
  method: PaymentMethod;
  paidBy: string;
}

export interface PayrollContextType {
  // State
  employees: Employee[];
  movements: FinancialMovement[];
  payments: PayrollPayment[];
  auditLogs: AuditLog[];
  payrollRows: PayrollRow[];
  selectedMonth: number;
  selectedYear: number;

  // Navigation
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;

  // Movement actions
  addMovement: (input: AddMovementInput) => void;
  cancelMovement: (movementId: number, cancelledBy: string) => void;

  // Payment actions
  addPayment: (input: AddPaymentInput) => void;
  bulkPayUnpaid: (method: PaymentMethod, paidBy: string, employeeIds?: number[]) => void;
}
