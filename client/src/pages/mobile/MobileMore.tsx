import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, Truck, Tag, Boxes, Activity, Settings, Database,
  LogOut, UserCircle, ChevronLeft, Users, ArrowRightLeft,
  ClipboardCheck, ShoppingCart, ReceiptText, DollarSign,
} from "lucide-react";

export default function MobileMore() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const isOwner = user?.role === "owner" || user?.role === "admin";

  const ownerItems = [
    { icon: ShoppingCart, label: t("mobile.nav_pos"), path: "/pos" },
    { icon: ReceiptText, label: t("mobile.nav_invoices"), path: "/invoices" },
    { icon: Users, label: t("mobile.nav_customers"), path: "/customers" },
    { icon: Tag, label: t("mobile.products"), path: "/products" },
    { icon: Boxes, label: t("mobile.inventory"), path: "/inventory" },
    { icon: Truck, label: t("mobile.nav_purchases"), path: "/purchases" },
    { icon: ArrowRightLeft, label: t("mobile.nav_transfers"), path: "/transfers" },
    { icon: ClipboardCheck, label: t("mobile.nav_stocktake"), path: "/stocktake" },
    { icon: DollarSign, label: t("mobile.expenses"), path: "/expenses" },
    { icon: FileText, label: t("mobile.reports"), path: "/reports" },
    { icon: Activity, label: t("mobile.activity_log"), path: "/audit-log" },
    { icon: Settings, label: t("mobile.settings"), path: "/settings" },
    { icon: Database, label: t("mobile.backups"), path: "/settings" },
  ];

  const employeeItems = [
    { icon: ShoppingCart, label: t("mobile.nav_pos"), path: "/pos" },
    { icon: ReceiptText, label: t("mobile.nav_invoices"), path: "/invoices" },
    { icon: Users, label: t("mobile.nav_customers"), path: "/customers" },
    { icon: UserCircle, label: t("mobile.my_profile"), path: "/settings" },
  ];

  const menuItems = isOwner ? ownerItems : employeeItems;

  return (
    <div className="p-4 pb-24 space-y-3" dir="rtl">
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
          <UserCircle className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-lg font-bold">{user?.name}</h2>
        <p className="text-sm text-muted-foreground">{user?.role === "owner" ? t("mobile.owner") : user?.role === "admin" ? t("mobile.admin") : t("mobile.employee")}</p>
      </div>

      <div className="space-y-2">
        {menuItems.map((item, idx) => (
          <Card key={idx} className="cursor-pointer active:scale-[0.98] transition-transform" onClick={() => setLocation(item.path)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="font-medium flex-1 text-base">{item.label}</span>
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        variant="destructive"
        className="w-full h-14 gap-2 mt-4 text-base"
        onClick={async () => { await logout(); }}
        data-testid="button-logout"
      >
        <LogOut className="w-5 h-5" />
        {t("mobile.logout")}
      </Button>
    </div>
  );
}
