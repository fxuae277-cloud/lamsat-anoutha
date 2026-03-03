import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider, useI18n } from "@/lib/i18n";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import { AppLayout } from "@/components/layout/AppLayout";
import { EMPLOYEE_ALLOWED_PATHS } from "@/config/sidebar";

import Dashboard from "@/pages/Dashboard";
import Executive from "@/pages/Executive";
import ExecutivePlus from "@/pages/ExecutivePlus";
import POS from "@/pages/POS";
import Products from "@/pages/Products";
import Inventory from "@/pages/Inventory";
import Orders from "@/pages/Orders";
import Expenses from "@/pages/Expenses";
import Settings from "@/pages/Settings";
import Reports from "@/pages/Reports";
import Purchases from "@/pages/Purchases";
import Invoices from "@/pages/Invoices";
import Finance from "@/pages/Finance";
import HR from "@/pages/HR";
import Returns from "@/pages/Returns";
import AuditLog from "@/pages/AuditLog";
import Operations from "@/pages/Operations";
import StockControl from "@/pages/StockControl";
import { ReactNode } from "react";

function RequireOwner({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "owner" && user?.role !== "admin") {
    return <Redirect to="/pos" />;
  }
  return <>{children}</>;
}

function AuthenticatedRouter() {
  const { user, isLoading } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{t("app.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/pos" component={POS}/>
        <Route path="/orders" component={Orders}/>
        <Route path="/invoices" component={Invoices}/>
        <Route path="/customers">
          <div className="p-8 text-center text-muted-foreground">{t("app.customers_coming_soon")}</div>
        </Route>

        <Route path="/">
          <RequireOwner><Dashboard /></RequireOwner>
        </Route>
        <Route path="/executive">
          <RequireOwner><Executive /></RequireOwner>
        </Route>
        <Route path="/executive-plus">
          <RequireOwner><ExecutivePlus /></RequireOwner>
        </Route>
        <Route path="/products">
          <RequireOwner><Products /></RequireOwner>
        </Route>
        <Route path="/inventory">
          <RequireOwner><Inventory /></RequireOwner>
        </Route>
        <Route path="/expenses">
          <RequireOwner><Expenses /></RequireOwner>
        </Route>
        <Route path="/settings">
          <RequireOwner><Settings /></RequireOwner>
        </Route>
        <Route path="/suppliers">
          <RequireOwner><Purchases /></RequireOwner>
        </Route>
        <Route path="/purchases">
          <RequireOwner><Purchases /></RequireOwner>
        </Route>
        <Route path="/hr">
          <RequireOwner><HR /></RequireOwner>
        </Route>
        <Route path="/returns">
          <RequireOwner><Returns /></RequireOwner>
        </Route>
        <Route path="/reports">
          <RequireOwner><Reports /></RequireOwner>
        </Route>
        <Route path="/finance">
          <RequireOwner><Finance /></RequireOwner>
        </Route>
        <Route path="/stock-control">
          <RequireOwner><StockControl /></RequireOwner>
        </Route>
        <Route path="/operations">
          <RequireOwner><Operations /></RequireOwner>
        </Route>
        <Route path="/audit-log">
          <RequireOwner><AuditLog /></RequireOwner>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <I18nProvider>
          <AuthProvider>
            <AuthenticatedRouter />
          </AuthProvider>
        </I18nProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
