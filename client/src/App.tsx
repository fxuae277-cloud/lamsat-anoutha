import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";

// Import pages (we will create these next)
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Products from "@/pages/Products";
import Inventory from "@/pages/Inventory";
import Orders from "@/pages/Orders";
import Expenses from "@/pages/Expenses";
import Settings from "@/pages/Settings";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard}/>
        <Route path="/pos" component={POS}/>
        <Route path="/products" component={Products}/>
        <Route path="/inventory" component={Inventory}/>
        <Route path="/orders" component={Orders}/>
        <Route path="/expenses" component={Expenses}/>
        <Route path="/settings" component={Settings}/>
        {/* Placeholder for other routes */}
        <Route path="/customers">
          <div className="p-8 text-center text-muted-foreground">صفحة العملاء (قيد التطوير)</div>
        </Route>
        <Route path="/suppliers">
          <div className="p-8 text-center text-muted-foreground">صفحة الموردون (قيد التطوير)</div>
        </Route>
        <Route path="/hr">
          <div className="p-8 text-center text-muted-foreground">صفحة الرواتب والموظفين (قيد التطوير)</div>
        </Route>
        <Route path="/finance">
          <div className="p-8 text-center text-muted-foreground">صفحة المالية (قيد التطوير)</div>
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
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
