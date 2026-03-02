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
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/executive", label: "لوحة الإدارة التنفيذية", icon: Gauge, adminOnly: true },
  { href: "/executive-plus", label: "لوحة الاستثمار+", icon: LineChart, adminOnly: true },
  { href: "/pos", label: "نقطة البيع (POS)", icon: Calculator },
  { href: "/products", label: "المنتجات والأسعار", icon: Tags },
  { href: "/inventory", label: "المخزون", icon: Package },
  { href: "/invoices", label: "فواتير نقطة البيع", icon: FileText },
  { href: "/orders", label: "الطلبات", icon: ShoppingCart },
  { href: "/customers", label: "العملاء", icon: Users },
  { href: "/suppliers", label: "الموردون والمشتريات", icon: Truck, managerOnly: true },
  { href: "/expenses", label: "المصروفات", icon: Receipt },
  { href: "/hr", label: "الرواتب والموظفين", icon: UserCircle },
  { href: "/reports", label: "التقارير المالية", icon: PieChart },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "مالك",
  cashier: "كاشير",
  employee: "موظف",
  admin: "مدير",
};

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const initial = user?.name?.charAt(0) || "؟";
  const roleLabel = ROLE_LABELS[user?.role || ""] || user?.role || "";

  return (
    <aside className="w-64 bg-sidebar border-e border-sidebar-border h-full flex flex-col shadow-sm">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <span className="bg-primary/10 text-primary p-2 rounded-lg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </span>
          لمسة أنوثة
        </h1>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.filter((item: any) => {
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
                {item.label}
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
            title="تسجيل الخروج"
            data-testid="button-sidebar-logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
