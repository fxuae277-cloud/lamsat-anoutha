import { Badge } from "@/components/ui/badge";
import type { EmployeeStatus, PaymentStatus, MovementType } from "@/lib/payroll-types";

// ─── Payment Status ───────────────────────────────────────────────────────────

const PAYMENT_STATUS_MAP: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  paid:    { label: "مدفوع",      className: "bg-blue-100 text-blue-700 border-blue-200 border"    },
  partial: { label: "جزئي",       className: "bg-orange-100 text-orange-700 border-orange-200 border" },
  unpaid:  { label: "غير مدفوع", className: "bg-red-100 text-red-700 border-red-200 border"       },
};

export function paymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_MAP[status].label;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { label, className } = PAYMENT_STATUS_MAP[status];
  return <Badge className={`${className} text-xs`}>{label}</Badge>;
}

// ─── Employee Status ──────────────────────────────────────────────────────────

const EMPLOYEE_STATUS_MAP: Record<
  EmployeeStatus,
  { label: string; className: string }
> = {
  active:    { label: "نشط",   className: "bg-green-100 text-green-700 border-green-200 border"  },
  suspended: { label: "موقف",  className: "bg-yellow-100 text-yellow-700 border-yellow-200 border" },
  inactive:  { label: "منتهي", className: "bg-gray-100 text-gray-600 border-gray-200 border"     },
};

export function employeeStatusLabel(status: EmployeeStatus): string {
  return EMPLOYEE_STATUS_MAP[status].label;
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const { label, className } = EMPLOYEE_STATUS_MAP[status];
  return <Badge className={`${className} text-xs`}>{label}</Badge>;
}

// ─── Movement Type ────────────────────────────────────────────────────────────

const MOVEMENT_TYPE_MAP: Record<
  MovementType,
  { label: string; color: string; bg: string }
> = {
  bonus:     { label: "مستحق", color: "#4CAF50", bg: "#e8f5e9" },
  overtime:  { label: "عمولة", color: "#2196F3", bg: "#e3f2fd" },
  deduction: { label: "خصم",   color: "#FF9800", bg: "#fff3e0" },
  advance:   { label: "سلفة",  color: "#F44336", bg: "#ffebee" },
};

export function movementTypeLabel(type: MovementType): string {
  return MOVEMENT_TYPE_MAP[type].label;
}

export function movementTypeMeta(type: MovementType) {
  return MOVEMENT_TYPE_MAP[type];
}

export function MovementTypeBadge({ type }: { type: MovementType }) {
  const { label, color, bg } = MOVEMENT_TYPE_MAP[type];
  return (
    <Badge
      className="border text-xs"
      style={{ backgroundColor: bg, color, borderColor: color + "44" }}
    >
      {label}
    </Badge>
  );
}

// ─── Movement Status ──────────────────────────────────────────────────────────

export function MovementStatusBadge({ status }: { status: "active" | "cancelled" }) {
  return status === "active"
    ? <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">نشط</Badge>
    : <Badge className="bg-gray-100 text-gray-500 border-gray-200 border text-xs">ملغي</Badge>;
}
