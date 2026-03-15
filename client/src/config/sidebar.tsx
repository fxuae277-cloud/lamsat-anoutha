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
      { labelKey: "nav.pos", icon: ShoppingCart, path: "/pos" },
      { labelKey: "nav.orders", icon: ClipboardList, path: "/orders" },
      { labelKey: "nav.invoices", icon: ReceiptText, path: "/invoices" },
    ],
  },
  {
    sectionKey: "sidebar.section_master_data",
    items: [
      { labelKey: "nav.products", icon: Tag, path: "/products" },
      { labelKey: "nav.customers", icon: Users, path: "/customers" },
    ],
  },
  {
    sectionKey: "sidebar.section_inventory",
    items: [
      { labelKey: "nav.branchStock", icon: Warehouse, path: "/branch-stock" },
      { labelKey: "nav.inventory", icon: Boxes, path: "/inventory" },
      { labelKey: "nav.stockControl", icon: ClipboardCheck, path: "/stock-control" },
    ],
  },
  {
    sectionKey: "sidebar.section_purchasing",
    items: [
      { labelKey: "nav.suppliers", icon: Truck, path: "/suppliers" },
      { labelKey: "nav.returns", icon: RotateCcw, path: "/returns" },
    ],
  },
  {
    sectionKey: "sidebar.section_finance",
    items: [
      { labelKey: "nav.expenses", icon: Banknote, path: "/expenses" },
      { labelKey: "nav.finance", icon: Calculator, path: "/finance" },
      { labelKey: "nav.reports", icon: FileText, path: "/reports" },
    ],
  },
  {
    sectionKey: "sidebar.section_audit",
    items: [
      { labelKey: "nav.operations", icon: Activity, path: "/operations" },
      { labelKey: "nav.auditLog", icon: ShieldCheck, path: "/audit-log" },
    ],
  },
  {
    sectionKey: "sidebar.section_settings",
    items: [
      { labelKey: "nav.settings", icon: Settings, path: "/settings" },
      { labelKey: "nav.hr", icon: UserCog, path: "/hr" },
    ],
  },
];

export const EMPLOYEE_SIDEBAR: SidebarSection[] = [
  {
    sectionKey: "sidebar.section_operations",
    items: [
      { labelKey: "nav.pos", icon: ShoppingCart, path: "/pos" },
      { labelKey: "nav.orders", icon: ClipboardList, path: "/orders" },
      { labelKey: "nav.invoices", icon: ReceiptText, path: "/invoices" },
      { labelKey: "nav.customers", icon: Users, path: "/customers" },
      { labelKey: "nav.branchStock", icon: Warehouse, path: "/branch-stock" },
    ],
  },
];

export const EMPLOYEE_ALLOWED_PATHS = ["/pos", "/orders", "/invoices", "/customers", "/branch-stock"];

export function getSidebarForRole(role: string): SidebarSection[] {
  if (role === "owner" || role === "admin") return OWNER_SIDEBAR;
  return EMPLOYEE_SIDEBAR;
}
