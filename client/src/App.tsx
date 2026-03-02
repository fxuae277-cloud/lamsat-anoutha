import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import { AppLayout } from "@/components/layout/AppLayout";

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

function AuthenticatedRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">جارٍ التحميل...</p>
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
        <Route path="/" component={Dashboard}/>
        <Route path="/executive" component={Executive}/>
        <Route path="/executive-plus" component={ExecutivePlus}/>
        <Route path="/pos" component={POS}/>
        <Route path="/products" component={Products}/>
        <Route path="/inventory" component={Inventory}/>
        <Route path="/invoices" component={Invoices}/>
        <Route path="/orders" component={Orders}/>
        <Route path="/expenses" component={Expenses}/>
        <Route path="/settings" component={Settings}/>
        <Route path="/customers">
          <div className="p-8 text-center text-muted-foreground">صفحة العملاء (قيد التطوير)</div>
        </Route>
        <Route path="/suppliers" component={Purchases}/>
        <Route path="/purchases" component={Purchases}/>
        <Route path="/hr">
          <div className="p-8 text-center text-muted-foreground">صفحة الرواتب والموظفين (قيد التطوير)</div>
        </Route>
        <Route path="/reports" component={Reports}/>
        <Route path="/finance" component={Reports}/>
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
        <AuthProvider>
          <AuthenticatedRouter />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
