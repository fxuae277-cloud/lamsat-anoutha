import { ReactNode } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { Search, Languages } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { NotificationBell } from "./NotificationBell";

// Routes that should fill the entire viewport without the standard
// admin chrome (top search bar + page padding). Cashier/POS screens.
const FULL_BLEED_ROUTES = ["/pos", "/shift"];

export function AppLayout({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const [location] = useLocation();
  const isFullBleed = FULL_BLEED_ROUTES.some(
    (p) => location === p || location.startsWith(p + "/")
  );

  if (isFullBleed) {
    // Cashier mode: keep the navigation sidebar visible but drop the top
    // search/language header and the page padding so the POS can fill 100%
    // of the available vertical and horizontal space.
    return (
      <div className="flex w-screen h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;
  const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;
  const now = new Date();
  const headerDate = lang === "ar"
    ? `${t(`day_names.${DAY_KEYS[now.getDay()]}`)}، ${now.getDate()} ${t(`month_names.${MONTH_KEYS[now.getMonth()]}`)} ${now.getFullYear()}`
    : now.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4 w-96">
            <div className="relative w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder={t("app.search_placeholder")} 
                className="pr-10 bg-muted/50 border-transparent focus-visible:bg-background"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs font-semibold border-dashed hover:border-solid"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              title={lang === "ar" ? "Switch to English" : "التبديل للعربية"}
            >
              <Languages className="h-3.5 w-3.5" />
              {lang === "ar" ? "EN" : "عر"}
            </Button>
            <NotificationBell />
            <div className="text-sm font-medium text-muted-foreground">
              {headerDate}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
