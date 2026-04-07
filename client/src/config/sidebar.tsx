import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  ReceiptText,
  Tag,
  Users,
  Boxes,
  ClipboardCheck,
  Truck,
  RotateCcw,
  Banknote,
  Calculator,
  FileText,
  Activity,
  ShieldCheck,
  Settings,
  UserCog,
  BookOpen,
  FileSpreadsheet,
  BookMarked,
  Warehouse,
  FolderOpen,
  AlertTriangle,
  GitBranch,
  ArrowLeftRight,
  PackageSearch,
  PackageX,
  Wallet,
  TrendingUp,
  CreditCard,
} from "lucide-react";

export type SidebarItem = {
  labelKey: string;
  path: string;
  icon: any;
};

export type SidebarSection = {
  sectionKey: string;
  items: SidebarItem[];
};

export const OWNER_SIDEBAR: SidebarSection[] = [
  {
    sectionKey: "sidebar.section_dashboard",
    items: [
      { labelKey: "nav.dashboard", icon: LayoutDashboard, path: "/" },
    ],
  },
  {
    sectionKey: "sidebar.section_operations",
    items: [
      { labelKey: "nav.pos",       icon: ShoppingCart, path: "/pos" },
      { labelKey: "nav.orders",    icon: ClipboardList, path: "/orders" },
      { labelKey: "nav.invoices",  icon: ReceiptText,  path: "/invoices" },
      { labelKey: "nav.customers", icon: Users,        path: "/customers" },
    ],
  },

  // ── البيانات الأساسية ──────────────────────────────────────────────
  {
    sectionKey: "sidebar.section_basic_data",
    items: [
      { labelKey: "nav.branches",    icon: GitBranch,  path: "/branches" },
      { labelKey: "nav.categories",  icon: FolderOpen, path: "/categories" },
      { labelKey: "nav.suppliers",   icon: Truck,      path: "/suppliers" },
      { labelKey: "nav.products",    icon: Tag,        path: "/products" },
    ],
  },

  // ── العمليات ───────────────────────────────────────────────────────
  {
    sectionKey: "sidebar.section_wh_operations",
    items: [
      { labelKey: "nav.purchases",       icon: FileSpreadsheet, path: "/purchases" },
      { labelKey: "nav.purchaseReturns", icon: PackageX,        path: "/purchase-returns" },
      { labelKey: "nav.transfers",       icon: ArrowLeftRight,  path: "/transfers" },
    ],
  },

  // ── المخزون ────────────────────────────────────────────────────────
  {
    sectionKey: "sidebar.section_wh_stock",
    items: [
      { labelKey: "nav.inventoryOverview", icon: PackageSearch, path: "/inventory-overview" },
      { labelKey: "nav.branchStock",       icon: Warehouse,     path: "/branch-stock" },
      { labelKey: "nav.inventoryAlerts",   icon: AlertTriangle, path: "/inventory-alerts" },
      { labelKey: "nav.stockControl",      icon: ClipboardCheck, path: "/stocktake" },
    ],
  },

  {
    sectionKey: "sidebar.section_finance",
    items: [
      { labelKey: "nav.expenses", icon: Banknote,    path: "/expenses" },
      { labelKey: "nav.finance",  icon: Calculator,  path: "/finance" },
      { labelKey: "nav.returns",  icon: RotateCcw,   path: "/returns" },
      { labelKey: "nav.reports",  icon: FileText,    path: "/reports" },
    ],
  },
  {
    sectionKey: "sidebar.section_audit",
    items: [
      { labelKey: "nav.operations", icon: Activity,    path: "/operations" },
      { labelKey: "nav.auditLog",   icon: ShieldCheck, path: "/audit-log" },
    ],
  },
  {
    sectionKey: "sidebar.section_settings",
    items: [
      { labelKey: "nav.settings", icon: Settings, path: "/settings" },
      { labelKey: "nav.hr",       icon: UserCog,  path: "/hr" },
    ],
  },
  {
    sectionKey: "sidebar.section_payroll",
    items: [
      { labelKey: "nav.payrollEmployees",  icon: Users,        path: "/payroll/employees" },
      { labelKey: "nav.payrollMovements",  icon: TrendingUp,   path: "/payroll/movements" },
      { labelKey: "nav.payrollSheet",      icon: FileSpreadsheet, path: "/payroll/sheet" },
      { labelKey: "nav.payrollSummary",    icon: Wallet,       path: "/payroll/summary" },
      { labelKey: "nav.payrollPayments",   icon: CreditCard,   path: "/payroll/payments" },
    ],
  },
];

export const EMPLOYEE_SIDEBAR: SidebarSection[] = [
  {
    sectionKey: "sidebar.section_operations",
    items: [
      { labelKey: "nav.pos",       icon: ShoppingCart, path: "/pos" },
      { labelKey: "nav.orders",    icon: ClipboardList, path: "/orders" },
      { labelKey: "nav.invoices",  icon: ReceiptText,  path: "/invoices" },
      { labelKey: "nav.customers", icon: Users,        path: "/customers" },
      { labelKey: "nav.branchStock", icon: Warehouse,  path: "/branch-stock" },
    ],
  },
];

export const EMPLOYEE_ALLOWED_PATHS = ["/pos", "/orders", "/invoices", "/customers", "/branch-stock"];

export function getSidebarForRole(role: string): SidebarSection[] {
  if (role === "owner" || role === "admin") return OWNER_SIDEBAR;
  return EMPLOYEE_SIDEBAR;
}
