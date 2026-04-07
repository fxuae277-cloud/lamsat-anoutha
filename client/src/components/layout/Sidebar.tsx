import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useLogout } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getSidebarForRole } from "@/config/sidebar";

export function Sidebar() {
  const [location] = useLocation();
  const { data } = useAuth();
  const user = data?.user;
  const logoutMutation = useLogout();
  const { t } = useI18n();

  const initial = user?.name?.charAt(0) || "?";
  const roleLabel = t(`sidebar.role_${user?.role || "employee"}`);
  const sections = getSidebarForRole(user?.role || "employee");

  // Open the section that contains the current active route on first render
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    sections.forEach((section) => {
      const hasActive = section.items.some(
        (item) =>
          location === item.path ||
          (item.path !== "/" && location.startsWith(item.path + "/"))
      );
      if (hasActive) init[section.sectionKey] = true;
    });
    return init;
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isSectionActive = (items: { path: string }[]) =>
    items.some(
      (item) =>
        location === item.path ||
        (item.path !== "/" && location.startsWith(item.path + "/"))
    );

  return (
    <aside className="w-64 bg-sidebar border-e border-sidebar-border h-full flex flex-col shadow-sm">
      {/* Header */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          {t("app.name")}
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {sections.map((section) => {
          const isOpen = openSections[section.sectionKey];
          const active = isSectionActive(section.items);
          const isSingle = section.items.length === 1;
          const singleItem = section.items[0];

          // Single-item section → plain link (no accordion)
          if (isSingle) {
            const isActive =
              location === singleItem.path ||
              (singleItem.path !== "/" &&
                location.startsWith(singleItem.path + "/"));
            const Icon = singleItem.icon;
            return (
              <div key={section.sectionKey}>
                <Link
                  href={singleItem.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-base font-semibold",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {t(singleItem.labelKey)}
                </Link>
              </div>
            );
          }

          // Multi-item section → collapsible accordion
          return (
            <div key={section.sectionKey}>
              <button
                onClick={() => toggleSection(section.sectionKey)}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2.5 rounded-md transition-colors text-sm",
                  active
                    ? "text-primary font-semibold"
                    : "text-muted-foreground font-medium hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <span className="text-sm font-bold tracking-wide">
                  {t(section.sectionKey)}
                </span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 shrink-0 transition-transform duration-200",
                    isOpen ? "rotate-180" : ""
                  )}
                />
              </button>

              {/* Animated children */}
              <div
                className="overflow-hidden"
                style={{
                  maxHeight: isOpen ? `${section.items.length * 44}px` : "0px",
                  transition: "max-height 0.25s ease",
                }}
              >
                <div className="mt-0.5 space-y-0.5 ps-2">
                  {section.items.map((item) => {
                    const isActive =
                      location === item.path ||
                      (item.path !== "/" &&
                        location.startsWith(item.path + "/"));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-base font-medium",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        {t(item.labelKey)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0 text-sm">
            {initial}
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-sm font-semibold truncate leading-tight" data-testid="text-sidebar-user">
              {user?.name}
            </p>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium leading-none">
                {roleLabel}
              </span>
              {(user as any)?.branchName && (
                <span className="text-[10px] text-muted-foreground truncate leading-none">
                  {(user as any).branchName}
                </span>
              )}
              {user?.terminalName && (
                <span className="text-[10px] text-muted-foreground leading-none" data-testid="text-sidebar-branch">
                  · {user.terminalName}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
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
