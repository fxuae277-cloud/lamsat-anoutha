import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  Home, ShoppingCart, ReceiptText, Clock, MoreHorizontal,
  LayoutDashboard, Boxes, Users
} from "lucide-react";

type NavItem = {
  icon: any;
  labelKey: string;
  path: string;
};

const EMPLOYEE_NAV: NavItem[] = [
  { icon: Home, labelKey: "mobile.nav_home", path: "/" },
  { icon: ShoppingCart, labelKey: "mobile.nav_pos", path: "/pos" },
  { icon: ReceiptText, labelKey: "mobile.nav_invoices", path: "/invoices" },
  { icon: Clock, labelKey: "mobile.nav_shift", path: "/shift" },
  { icon: MoreHorizontal, labelKey: "mobile.nav_more", path: "/more" },
];

const OWNER_NAV: NavItem[] = [
  { icon: LayoutDashboard, labelKey: "mobile.nav_home", path: "/" },
  { icon: ShoppingCart, labelKey: "mobile.nav_pos", path: "/pos" },
  { icon: Boxes, labelKey: "mobile.nav_inventory", path: "/inventory" },
  { icon: Users, labelKey: "mobile.nav_customers", path: "/customers" },
  { icon: MoreHorizontal, labelKey: "mobile.nav_more", path: "/more" },
];

export function MobileLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [location, setLocation] = useLocation();

  const isOwner = user?.role === "owner" || user?.role === "admin";
  const navItems = isOwner ? OWNER_NAV : EMPLOYEE_NAV;

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto pb-20">
        {children}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                onClick={() => setLocation(item.path)}
                data-testid={`nav-${item.path === "/" ? "home" : item.path.slice(1)}`}
              >
                <item.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
