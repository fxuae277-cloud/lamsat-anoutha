import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard,
  Gauge,
  LineChart,
  Calculator, 
  Tags, 
  Package, 
  ShoppingCart, 
  Users, 
  Truck, 
  Receipt,
  FileText,
  UserCircle, 
  PieChart, 
  Settings,
  LogOut,
  Banknote,
  RotateCcw,
  Shield,
  Activity,
  ClipboardCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type NavItem = {
  href: string;
  labelKey: string;
  icon: any;
  adminOnly?: boolean;
  managerOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/executive", labelKey: "nav.executive", icon: Gauge, adminOnly: true },
  { href: "/executive-plus", labelKey: "nav.executivePlus", icon: LineChart, adminOnly: true },
  { href: "/pos", labelKey: "nav.pos", icon: Calculator },
  { href: "/products", labelKey: "nav.products", icon: Tags },
  { href: "/inventory", labelKey: "nav.inventory", icon: Package },
  { href: "/invoices", labelKey: "nav.invoices", icon: FileText },
  { href: "/orders", labelKey: "nav.orders", icon: ShoppingCart },
  { href: "/customers", labelKey: "nav.customers", icon: Users },
  { href: "/suppliers", labelKey: "nav.suppliers", icon: Truck, managerOnly: true },
  { href: "/expenses", labelKey: "nav.expenses", icon: Receipt },
  { href: "/returns", labelKey: "nav.returns", icon: RotateCcw },
  { href: "/stock-control", labelKey: "nav.stockControl", icon: ClipboardCheck, managerOnly: true },
  { href: "/finance", labelKey: "nav.finance", icon: Banknote },
  { href: "/hr", labelKey: "nav.hr", icon: UserCircle },
  { href: "/reports", labelKey: "nav.reports", icon: PieChart },
  { href: "/operations", labelKey: "nav.operations", icon: Activity },
  { href: "/audit-log", labelKey: "nav.auditLog", icon: Shield, adminOnly: true },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const initial = user?.name?.charAt(0) || "؟";
  const roleLabel = t(`sidebar.role_${user?.role || "employee"}`);

  return (
    <aside className="w-64 bg-sidebar border-e border-sidebar-border h-full flex flex-col shadow-sm">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <img src="/logo.png" alt="شعار" className="w-10 h-10 object-contain" />
          {t("app.name")}
        </h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.filter((item) => {
          if (item.adminOnly && user?.role !== "owner" && user?.role !== "admin") return false;
          if (item.managerOnly && (user?.role === "cashier" || user?.role === "employee")) return false;
          return true;
        }).map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
                <Icon className="w-5 h-5" />
                {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-sidebar-user">{user?.name} ({roleLabel})</p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-sidebar-branch">{user?.terminalName}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title={t("sidebar.logout")}
            data-testid="button-sidebar-logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
