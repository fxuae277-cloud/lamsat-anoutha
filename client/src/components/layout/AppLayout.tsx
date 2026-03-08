import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { toEnDigits } from "@/lib/formatters";

export function AppLayout({ children }: { children: ReactNode }) {
  const { t, lang } = useI18n();

  const headerDate = toEnDigits(
    new Date().toLocaleDateString(lang === "ar" ? "ar-u-nu-latn" : "en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  );

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
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-muted-foreground hover:bg-accent rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full"></span>
            </button>
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
