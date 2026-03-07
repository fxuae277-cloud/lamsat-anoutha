import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, Truck, Tag, Boxes, Activity, Settings, Database,
  LogOut, UserCircle, ChevronLeft
} from "lucide-react";

export default function MobileMore() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const isOwner = user?.role === "owner" || user?.role === "admin";

  const ownerItems = [
    { icon: FileText, label: t("mobile.reports"), path: "/reports" },
    { icon: Truck, label: t("mobile.suppliers"), path: "/suppliers" },
    { icon: Tag, label: t("mobile.products"), path: "/products" },
    { icon: Boxes, label: t("mobile.inventory"), path: "/inventory" },
    { icon: Activity, label: t("mobile.activity_log"), path: "/audit-log" },
    { icon: Settings, label: t("mobile.settings"), path: "/settings" },
    { icon: Database, label: t("mobile.backups"), path: "/settings" },
  ];

  const employeeItems = [
    { icon: UserCircle, label: t("mobile.my_profile"), path: "/settings" },
  ];

  const menuItems = isOwner ? ownerItems : employeeItems;

  return (
    <div className="p-4 pb-24 space-y-3" dir="rtl">
      <div className="text-center py-4">
        <UserCircle className="w-16 h-16 mx-auto text-muted-foreground mb-2" />
        <h2 className="text-lg font-bold">{user?.name}</h2>
        <p className="text-sm text-muted-foreground">{user?.role === "owner" ? t("mobile.owner") : user?.role === "admin" ? t("mobile.admin") : t("mobile.employee")}</p>
      </div>

      <div className="space-y-2">
        {menuItems.map((item, idx) => (
          <Card key={idx} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setLocation(item.path)}>
            <CardContent className="p-4 flex items-center gap-3">
              <item.icon className="w-5 h-5 text-primary" />
              <span className="font-medium flex-1">{item.label}</span>
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        variant="destructive"
        className="w-full h-12 gap-2 mt-4"
        onClick={async () => { await logout(); }}
        data-testid="button-logout"
      >
        <LogOut className="w-5 h-5" />
        {t("mobile.logout")}
      </Button>
    </div>
  );
}
