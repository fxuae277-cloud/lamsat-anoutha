import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  Home, ShoppingCart, ReceiptText, Clock, MoreHorizontal,
  LayoutDashboard, Truck, ArrowRightLeft, ClipboardCheck
} from "lucide-react";

type NavItem = {
  icon: any;
  labelKey: string;
  path: string;
};

const EMPLOYEE_NAV: NavItem[] = [
  { icon: Home, labelKey: "mobile.nav_home", path: "/m" },
  { icon: ShoppingCart, labelKey: "mobile.nav_pos", path: "/m/pos" },
  { icon: ReceiptText, labelKey: "mobile.nav_invoices", path: "/m/invoices" },
  { icon: Clock, labelKey: "mobile.nav_shift", path: "/m/shift" },
  { icon: MoreHorizontal, labelKey: "mobile.nav_more", path: "/m/more" },
];

const OWNER_NAV: NavItem[] = [
  { icon: LayoutDashboard, labelKey: "mobile.nav_home", path: "/m" },
  { icon: Truck, labelKey: "mobile.nav_purchases", path: "/m/purchases" },
  { icon: ArrowRightLeft, labelKey: "mobile.nav_transfers", path: "/m/transfers" },
  { icon: ClipboardCheck, labelKey: "mobile.nav_stocktake", path: "/m/stocktake" },
  { icon: MoreHorizontal, labelKey: "mobile.nav_more", path: "/m/more" },
];

export function MobileLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [location, setLocation] = useLocation();

  const isOwner = user?.role === "owner" || user?.role === "admin";
  const navItems = isOwner ? OWNER_NAV : EMPLOYEE_NAV;

  const isActive = (path: string) => {
    if (path === "/m") return location === "/m";
    return location.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-bottom">
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
                data-testid={`nav-${item.path.replace("/m/", "").replace("/m", "home")}`}
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
