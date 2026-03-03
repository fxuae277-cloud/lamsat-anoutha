// client/src/config/sidebar.tsx
import {
  LayoutDashboard,
  Gauge,
  TrendingUp,
  ShoppingCart,
  Tag,
  Boxes,
  ReceiptText,
  Users,
  Truck,
  Banknote,
  RotateCcw,
  ClipboardList,
  Calculator,
  UserCog,
  FileText,
  Activity,
  ShieldCheck,
  Settings,
} from "lucide-react";

export type UserRole = "OWNER" | "EMPLOYEE";

export type SidebarItem = {
  label: string;
  path: string;
  icon: any;
  // من يقدر يشوفها؟
  roles: UserRole[];
};

export type SidebarSection = {
  section: string;
  items: SidebarItem[];
};

/**
 * ✅ هيكلة المالك (إدارة كاملة)
 * - لوحة تحكم واحدة فقط (بدون تكرار 3 لوحات)
 * - صفحات حساسة للمالك فقط: الإعدادات، التقارير، الرواتب، سجل العمليات، المراجعة
 */
export const OWNER_SIDEBAR: SidebarSection[] = [
  {
    section: "الإدارة",
    items: [
      {
        label: "لوحة التحكم",
        icon: LayoutDashboard,
        path: "/dashboard",
        roles: ["OWNER"],
      },
      {
        label: "لوحة الإدارة التنفيذية",
        icon: Gauge,
        path: "/executive",
        roles: ["OWNER"],
      },
      {
        label: "لوحة الاستثمار",
        icon: TrendingUp,
        path: "/investment",
        roles: ["OWNER"],
      },
    ],
  },
  {
    section: "التشغيل",
    items: [
      {
        label: "نقطة البيع (POS)",
        icon: ShoppingCart,
        path: "/pos",
        roles: ["OWNER"],
      },
      {
        label: "فواتير نقطة البيع",
        icon: ReceiptText,
        path: "/pos-invoices",
        roles: ["OWNER"],
      },
      {
        label: "المنتجات والأسعار",
        icon: Tag,
        path: "/products",
        roles: ["OWNER"],
      },
      { label: "المخزون", icon: Boxes, path: "/inventory", roles: ["OWNER"] },
      {
        label: "الطلبات",
        icon: ClipboardList,
        path: "/orders",
        roles: ["OWNER"],
      },
      { label: "العملاء", icon: Users, path: "/customers", roles: ["OWNER"] },
      {
        label: "الموردون والمشتريات",
        icon: Truck,
        path: "/suppliers",
        roles: ["OWNER"],
      },
      {
        label: "المصروفات",
        icon: Banknote,
        path: "/expenses",
        roles: ["OWNER"],
      },
      {
        label: "المرتجعات",
        icon: RotateCcw,
        path: "/returns",
        roles: ["OWNER"],
      },
      {
        label: "الجرد والتسويات",
        icon: ClipboardList,
        path: "/stock-adjustments",
        roles: ["OWNER"],
      },
      {
        label: "المحاسبة اليومية",
        icon: Calculator,
        path: "/daily-ledger",
        roles: ["OWNER"],
      },
    ],
  },
  {
    section: "الرقابة والتقارير",
    items: [
      {
        label: "الرواتب والموظفين",
        icon: UserCog,
        path: "/payroll",
        roles: ["OWNER"],
      },
      {
        label: "التقارير المالية",
        icon: FileText,
        path: "/reports",
        roles: ["OWNER"],
      },
      {
        label: "آخر العمليات",
        icon: Activity,
        path: "/activity-log",
        roles: ["OWNER"],
      },
      {
        label: "سجل المراجعة",
        icon: ShieldCheck,
        path: "/audit-log",
        roles: ["OWNER"],
      },
    ],
  },
  {
    section: "",
    items: [
      {
        label: "الإعدادات",
        icon: Settings,
        path: "/settings",
        roles: ["OWNER"],
      },
    ],
  },
];

/**
 * ✅ هيكلة الموظف (مختص للعمل فقط)
 * - لا يرى ولا يدخل: الإعدادات/التقارير/الرواتب/المراجعة/لوحات الإدارة
 * - فقط ما يحتاجه لعمله اليومي
 */
export const EMPLOYEE_SIDEBAR: SidebarSection[] = [
  {
    section: "التشغيل",
    items: [
      {
        label: "نقطة البيع (POS)",
        icon: ShoppingCart,
        path: "/pos",
        roles: ["EMPLOYEE"],
      },
      {
        label: "الطلبات",
        icon: ClipboardList,
        path: "/orders",
        roles: ["EMPLOYEE"],
      },
      {
        label: "فواتير نقطة البيع",
        icon: ReceiptText,
        path: "/pos-invoices",
        roles: ["EMPLOYEE"],
      },
      {
        label: "العملاء",
        icon: Users,
        path: "/customers",
        roles: ["EMPLOYEE"],
      },
      {
        label: "المرتجعات",
        icon: RotateCcw,
        path: "/returns",
        roles: ["EMPLOYEE"],
      },
    ],
  },
];

// استخدم هذه الدالة في الـ Sidebar component
export function getSidebarForRole(role: UserRole): SidebarSection[] {
  return role === "OWNER" ? OWNER_SIDEBAR : EMPLOYEE_SIDEBAR;
}
