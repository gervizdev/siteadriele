import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AdminWrapper from "@/pages/admin-wrapper";
import PaymentPage from "@/pages/payment";
import MyAppointmentsPage from "@/pages/my-appointments";
import PaymentSuccess from "@/pages/payment-success";
import PaymentFailure from "@/pages/payment-failure";
import PaymentPending from "@/pages/payment-pending";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={AdminWrapper} />
      <Route path="/pagamento" component={PaymentPage} />
      <Route path="/meus-agendamentos" component={MyAppointmentsPage} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/payment-failure" component={PaymentFailure} />
      <Route path="/payment-pending" component={PaymentPending} />
      <Route component={NotFound} />
    </Switch>
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
