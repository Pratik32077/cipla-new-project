import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import ManagersPage from "@/pages/managers";
import AllDoctorsPage from "@/pages/all-doctors";
import MyDoctorsPage from "@/pages/my-doctors";
import { useGetMe } from "@workspace/api-client-react";
import { type ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30000,
    },
  },
});

function ProtectedRoute({
  children,
  adminOnly = false,
  managerOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  managerOnly?: boolean;
}) {
  const { data: user, isLoading } = useGetMe();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  if (managerOnly && user.role !== "manager") {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/managers">
        <ProtectedRoute adminOnly>
          <ManagersPage />
        </ProtectedRoute>
      </Route>
      <Route path="/doctors">
        <ProtectedRoute adminOnly>
          <AllDoctorsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/my-doctors">
        <ProtectedRoute managerOnly>
          <MyDoctorsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/">
        <Redirect to="/login" />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
