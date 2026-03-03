import {
  LayoutDashboard,
  Gauge,
  ShoppingCart,
  FileText,
  RotateCcw,
  Package,
  Boxes,
  ClipboardCheck,
  Users,
  Truck,
  Receipt,
  Wallet,
  UserCog,
  BarChart3,
  Activity,
  ShieldCheck,
  Settings,
} from "lucide-react";

export const sidebarItems = [
  // ===== القيادة =====
  {
    section: "القيادة والتحكم",
    items: [
      {
        label: "لوحة التحكم",
        icon: LayoutDashboard,
        path: "/dashboard",
      },
      {
        label: "لوحة الإدارة",
        icon: Gauge,
        path: "/management",
      },
    ],
  },

  // ===== المبيعات =====
  {
    section: "المبيعات والتشغيل",
    items: [
      {
        label: "نقطة البيع (POS)",
        icon: ShoppingCart,
        path: "/pos",
      },
      {
        label: "فواتير البيع",
        icon: FileText,
        path: "/sales-invoices",
      },
      {
        label: "المرتجعات",
        icon: RotateCcw,
        path: "/returns",
      },
    ],
  },

  // ===== المنتجات =====
  {
    section: "المنتجات والمخزون",
    items: [
      {
        label: "المنتجات والأسعار",
        icon: Package,
        path: "/products",
      },
      {
        label: "المخزون",
        icon: Boxes,
        path: "/inventory",
      },
      {
        label: "الجرد والتسويات",
        icon: ClipboardCheck,
        path: "/stock-adjustments",
      },
    ],
  },

  // ===== العلاقات =====
  {
    section: "العلاقات التجارية",
    items: [
      {
        label: "العملاء",
        icon: Users,
        path: "/customers",
      },
      {
        label: "الموردون والمشتريات",
        icon: Truck,
        path: "/suppliers",
      },
    ],
  },

  // ===== المالية =====
  {
    section: "المالية",
    items: [
      {
        label: "المصروفات",
        icon: Receipt,
        path: "/expenses",
      },
      {
        label: "المحاسبة اليومية",
        icon: Wallet,
        path: "/daily-ledger",
      },
      {
        label: "الرواتب والموظفين",
        icon: UserCog,
        path: "/payroll",
      },
      {
        label: "التقارير المالية",
        icon: BarChart3,
        path: "/financial-reports",
      },
    ],
  },

  // ===== الرقابة =====
  {
    section: "الرقابة",
    items: [
      {
        label: "آخر العمليات",
        icon: Activity,
        path: "/activity-log",
      },
      {
        label: "سجل المراجعة",
        icon: ShieldCheck,
        path: "/audit-log",
      },
    ],
  },

  // ===== الإعدادات =====
  {
    section: "",
    items: [
      {
        label: "الإعدادات",
        icon: Settings,
        path: "/settings",
      },
    ],
  },
];
