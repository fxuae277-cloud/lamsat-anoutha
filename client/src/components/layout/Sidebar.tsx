import { Link, useLocation } from "wouter";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getSidebarForRole } from "@/config/sidebar";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const initial = user?.name?.charAt(0) || "?";
  const roleLabel = t(`sidebar.role_${user?.role || "employee"}`);
  const sections = getSidebarForRole(user?.role || "employee");

  return (
    <aside className="w-64 bg-sidebar border-e border-sidebar-border h-full flex flex-col shadow-sm">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          {t("app.name")}
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {sections.map((section) => (
          <div key={section.sectionKey}>
            {section.sectionKey && (
              <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t(section.sectionKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path + "/"));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
