import type { Employee, FinancialMovement, PayrollPayment } from "./payroll-types";

// ─── موظفون ───────────────────────────────────────────────────────────────────

export const dummyEmployees: Employee[] = [
  {
    id: 1,
    name: "محمد بن سالم الراشدي",
    position: "مدير الفرع",
    branch: "الفرع الرئيسي - مسقط",
    baseSalary: 800,
    status: "active",
  },
  {
    id: 2,
    name: "فاطمة بنت خالد البلوشي",
    position: "أمين الصندوق",
    branch: "الفرع الرئيسي - مسقط",
    baseSalary: 450,
    status: "active",
  },
  {
    id: 3,
    name: "أحمد بن ناصر المعمري",
    position: "مسؤول المبيعات",
    branch: "فرع صلالة",
    baseSalary: 500,
    status: "active",
  },
  {
    id: 4,
    name: "مريم بنت علي الحارثي",
    position: "موظفة خدمة عملاء",
    branch: "فرع صحار",
    baseSalary: 380,
    status: "active",
  },
  {
    id: 5,
    name: "يوسف بن سعيد الكندي",
    position: "مساعد مخزن",
    branch: "الفرع الرئيسي - مسقط",
    baseSalary: 320,
    status: "inactive",
  },
];

// ─── حركات مالية ─────────────────────────────────────────────────────────────

export const dummyMovements: FinancialMovement[] = [
  // مكافآت - شهر مارس 2025
  {
    id: 1,
    employeeId: 1,
    type: "bonus",
    amount: 100,
    reason: "مكافأة أداء ممتاز - الربع الأول",
    date: "2025-03-01",
    createdBy: "المدير العام",
    status: "active",
  },
  {
    id: 2,
    employeeId: 2,
    type: "bonus",
    amount: 50,
    reason: "مكافأة دوام منتظم",
    date: "2025-03-05",
    createdBy: "المدير العام",
    status: "active",
  },
  {
    id: 3,
    employeeId: 3,
    type: "overtime",
    amount: 75,
    reason: "عمل إضافي - نهاية الشهر",
    date: "2025-03-28",
    createdBy: "مدير الفرع",
    status: "active",
  },
  // خصومات - شهر مارس 2025
  {
    id: 4,
    employeeId: 4,
    type: "deduction",
    amount: 30,
    reason: "غياب بدون إذن - يومان",
    date: "2025-03-10",
    createdBy: "مدير الموارد البشرية",
    status: "active",
  },
  {
    id: 5,
    employeeId: 5,
    type: "deduction",
    amount: 20,
    reason: "تأخر متكرر",
    date: "2025-03-15",
    createdBy: "مدير الفرع",
    status: "cancelled",
  },
  // سلف
  {
    id: 6,
    employeeId: 2,
    type: "advance",
    amount: 100,
    reason: "سلفة لظروف شخصية",
    date: "2025-03-12",
    createdBy: "مدير الفرع",
    status: "active",
  },
  {
    id: 7,
    employeeId: 1,
    type: "advance",
    amount: 200,
    reason: "سلفة طارئة - مصاريف طبية",
    date: "2025-03-20",
    createdBy: "المدير العام",
    status: "active",
  },
  // الشهر السابق - فبراير 2025
  {
    id: 8,
    employeeId: 3,
    type: "bonus",
    amount: 60,
    reason: "مكافأة تجاوز الهدف البيعي",
    date: "2025-02-25",
    createdBy: "مدير الفرع",
    status: "active",
  },
  {
    id: 9,
    employeeId: 1,
    type: "overtime",
    amount: 80,
    reason: "عمل إضافي - الجرد الشهري",
    date: "2025-02-28",
    createdBy: "المدير العام",
    status: "active",
  },
];

// ─── مدفوعات رواتب ────────────────────────────────────────────────────────────

export const dummyPayments: PayrollPayment[] = [
  // رواتب فبراير 2025 - مدفوعة بالكامل
  {
    id: 1,
    employeeId: 1,
    month: 2,
    year: 2025,
    amount: 880, // 800 + 80 overtime
    method: "bank_transfer",
    paidAt: "2025-03-01T09:00:00.000Z",
    paidBy: "المدير العام",
  },
  {
    id: 2,
    employeeId: 2,
    month: 2,
    year: 2025,
    amount: 450,
    method: "bank_transfer",
    paidAt: "2025-03-01T09:15:00.000Z",
    paidBy: "المدير العام",
  },
  {
    id: 3,
    employeeId: 3,
    month: 2,
    year: 2025,
    amount: 560, // 500 + 60 bonus
    method: "bank_transfer",
    paidAt: "2025-03-01T09:30:00.000Z",
    paidBy: "المدير العام",
  },
  {
    id: 4,
    employeeId: 4,
    month: 2,
    year: 2025,
    amount: 380,
    method: "cash",
    paidAt: "2025-03-02T10:00:00.000Z",
    paidBy: "مدير الفرع",
  },
];
