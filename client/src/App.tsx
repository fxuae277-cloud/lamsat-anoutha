import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { useIsMobile } from "@/hooks/use-mobile";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { EMPLOYEE_ALLOWED_PATHS } from "@/config/sidebar";

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
import BranchStock from "@/pages/BranchStock";
import Customers from "@/pages/Customers";
import Accounts from "@/pages/Accounts";
import JournalEntries from "@/pages/JournalEntries";
import GeneralLedger from "@/pages/GeneralLedger";
import Categories from "@/pages/Categories";
import InventoryAlerts from "@/pages/InventoryAlerts";
import Branches from "@/pages/Branches";
import PurchaseReturns from "@/pages/PurchaseReturns";
import InventoryOverview from "@/pages/InventoryOverview";
import SuppliersPage from "@/pages/Suppliers";

import MobileEmployeeHome from "@/pages/mobile/MobileEmployeeHome";
import MobileOwnerHome from "@/pages/mobile/MobileOwnerHome";
import MobilePOS from "@/pages/mobile/MobilePOS";
import MobileShift from "@/pages/mobile/MobileShift";
import MobileInvoices from "@/pages/mobile/MobileInvoices";
import MobilePurchases from "@/pages/mobile/MobilePurchases";
import MobileTransfers from "@/pages/mobile/MobileTransfers";
import MobileStocktake from "@/pages/mobile/MobileStocktake";
import MobileMore from "@/pages/mobile/MobileMore";
import MobileCustomers from "@/pages/mobile/MobileCustomers";
import MobileProducts from "@/pages/mobile/MobileProducts";
import MobileInventory from "@/pages/mobile/MobileInventory";

import { ReactNode } from "react";
import { useEnglishDigits } from "@/lib/useEnglishDigits";

function RequireOwner({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "owner" && user?.role !== "admin") {
    return <Redirect to="/pos" />;
  }
  return <>{children}</>;
}

function MobileHome() {
  const { user } = useAuth();
  if (user?.role === "owner" || user?.role === "admin") {
    return <MobileOwnerHome />;
  }
  return <MobileEmployeeHome />;
}

function RequireMobileOwner({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "owner" && user?.role !== "admin") {
    return <Redirect to="/" />;
  }
  return <>{children}</>;
}

function MobileRouter() {
  return (
    <MobileLayout>
      <Switch>
        <Route path="/" component={MobileHome} />
        <Route path="/pos" component={MobilePOS} />
        <Route path="/invoices" component={MobileInvoices} />
        <Route path="/shift" component={MobileShift} />
        <Route path="/more" component={MobileMore} />
        <Route path="/purchases">
          <RequireMobileOwner><MobilePurchases /></RequireMobileOwner>
        </Route>
        <Route path="/transfers">
          <RequireMobileOwner><MobileTransfers /></RequireMobileOwner>
        </Route>
        <Route path="/stocktake">
          <RequireMobileOwner><MobileStocktake /></RequireMobileOwner>
        </Route>
        <Route path="/suppliers">
          <RequireMobileOwner><MobilePurchases /></RequireMobileOwner>
        </Route>
        <Route path="/products">
          <RequireMobileOwner><MobileProducts /></RequireMobileOwner>
        </Route>
        <Route path="/inventory">
          <RequireMobileOwner><MobileInventory /></RequireMobileOwner>
        </Route>
        <Route path="/customers" component={MobileCustomers} />
        <Route path="/branch-stock" component={BranchStock} />
        <Route path="/settings">
          <MobileMore />
        </Route>
        <Route path="/orders" component={MobileInvoices} />
        <Route path="/reports">
          <RequireMobileOwner><MobileMore /></RequireMobileOwner>
        </Route>
        <Route path="/expenses">
          <RequireMobileOwner><MobileMore /></RequireMobileOwner>
        </Route>
        <Route path="/accounts">
          <RequireMobileOwner><Accounts /></RequireMobileOwner>
        </Route>
        <Route path="/journal-entries">
          <RequireMobileOwner><JournalEntries /></RequireMobileOwner>
        </Route>
        <Route path="/general-ledger">
          <RequireMobileOwner><GeneralLedger /></RequireMobileOwner>
        </Route>
        <Route><Redirect to="/" /></Route>
      </Switch>
    </MobileLayout>
  );
}

function DesktopRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/pos" component={POS}/>
        <Route path="/orders" component={Orders}/>
        <Route path="/invoices" component={Invoices}/>
        <Route path="/customers" component={Customers}/>

        <Route path="/">
          <RequireOwner><Executive /></RequireOwner>
        </Route>
        <Route path="/executive-plus">
          <RequireOwner><ExecutivePlus /></RequireOwner>
        </Route>
        <Route path="/products">
          <RequireOwner><Products /></RequireOwner>
        </Route>
        <Route path="/branch-stock" component={BranchStock} />
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
          <RequireOwner><SuppliersPage /></RequireOwner>
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
        <Route path="/journal-entries">
          <RequireOwner><JournalEntries /></RequireOwner>
        </Route>
        <Route path="/accounts">
          <RequireOwner><Accounts /></RequireOwner>
        </Route>
        <Route path="/general-ledger">
          <RequireOwner><GeneralLedger /></RequireOwner>
        </Route>
        <Route path="/shift" component={POS} />
        <Route path="/more"><Redirect to="/" /></Route>
        <Route path="/transfers">
          <RequireOwner><Inventory /></RequireOwner>
        </Route>
        <Route path="/stocktake">
          <RequireOwner><StockControl /></RequireOwner>
        </Route>
        <Route path="/categories">
          <RequireOwner><Categories /></RequireOwner>
        </Route>
        <Route path="/inventory-alerts">
          <RequireOwner><InventoryAlerts /></RequireOwner>
        </Route>
        <Route path="/branches">
          <RequireOwner><Branches /></RequireOwner>
        </Route>
        <Route path="/purchase-returns">
          <RequireOwner><PurchaseReturns /></RequireOwner>
        </Route>
        <Route path="/inventory-overview">
          <RequireOwner><InventoryOverview /></RequireOwner>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function AuthenticatedRouter() {
  const { user, isLoading } = useAuth();
  const { t } = useI18n();
  const isMobile = useIsMobile();
  useEnglishDigits();

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

  if (isMobile) {
    return <MobileRouter />;
  }

  return <DesktopRouter />;
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
