// ─── Payroll Types ────────────────────────────────────────────────────────────
// Kept backwards-compatible with existing page components.
// The PayrollProvider transforms DB responses (snake_case) to these types.

export type EmployeeStatus = "active" | "inactive" | "suspended";

export interface Employee {
  id: number;
  name: string;
  position: string;    // mapped from users.role
  branch: string;      // mapped from branches.name
  branch_id?: number;  // optional; used for filtering
  baseSalary: number;  // parsed float from users.salary
  status: EmployeeStatus;
}

// ─── Financial Movements ──────────────────────────────────────────────────────

// DB "commission" movements are mapped to "bonus" at the frontend layer.
// DB has no "overtime" table; legacy overtime movements stay in dummy data.
export type MovementType = "bonus" | "deduction" | "advance" | "overtime";
export type MovementStatus = "active" | "cancelled";

export interface FinancialMovement {
  id: number;
  employeeId: number;
  type: MovementType;
  amount: number;
  reason: string;
  date: string;           // "YYYY-MM-DD"
  createdBy: string;      // display name of creator
  status: MovementStatus;
  sourceTable?: string;   // DB origin table (optional; used by Provider for cancel)
}

// ─── Payroll Payments ─────────────────────────────────────────────────────────

export type PaymentMethod = "bank_transfer" | "cash" | "cheque";

export interface PayrollPayment {
  id: number;
  employeeId: number;
  month: number;
  year: number;
  amount: number;
  method: PaymentMethod;
  paidAt: string;    // ISO date string
  paidBy: string;    // display name of payer
}

// ─── Computed Payroll Row ─────────────────────────────────────────────────────

export type PaymentStatus = "paid" | "unpaid" | "partial";

export interface PayrollRow {
  employee: Employee;
  totalBonus: number;      // includes DB commissions mapped as bonuses
  totalDeduction: number;
  totalAdvance: number;
  totalOvertime: number;   // always 0 from DB (no overtime table); kept for page compat
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
  entityType: string;
  entityId: number;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  userId: string;
  timestamp: string;
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface AddMovementInput {
  employeeId: number;
  type: MovementType;
  amount: number;
  reason: string;
  date: string;
  createdBy: string;  // name string as used by pages; Provider converts to ID
}

export interface AddPaymentInput {
  employeeId: number;
  month: number;
  year: number;
  amount: number;
  method: PaymentMethod;
  paidBy: string;   // name string as used by pages; Provider uses default user ID
}

// ─── Context Type ─────────────────────────────────────────────────────────────

export interface PayrollContextType {
  // State
  employees: Employee[];
  movements: FinancialMovement[];
  payments: PayrollPayment[];
  auditLogs: AuditLog[];     // kept for backwards compat (always empty — use DB reports)
  payrollRows: PayrollRow[];
  selectedMonth: number;
  selectedYear: number;
  isLoading: boolean;

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
