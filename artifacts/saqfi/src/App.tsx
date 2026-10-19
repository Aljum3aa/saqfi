import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useGetSession, getGetSessionQueryKey, type Session } from '@workspace/api-client-react';
import { LangProvider } from '@/lib/i18n';
import { CurrencyProvider } from '@/lib/currency';
import { Shell, Mark } from '@/components/shell';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Budget from '@/pages/budget';
import Contracts from '@/pages/contracts';
import Payroll from '@/pages/payroll';
import Transactions from '@/pages/transactions';
import PlayerHome from '@/pages/player';
import Bonuses from '@/pages/bonuses';
import Approvals from '@/pages/approvals';
import Audit from '@/pages/audit';
import Market from '@/pages/market';
import Payments from '@/pages/payments';
import Afford from '@/pages/afford';
import InvoicePage from '@/pages/invoice';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5000 } } });

function Gate() {
  /* Sponsor payment links are public: no session needed */
  const [loc] = useLocation();
  const inv = loc.match(/^\/invoice\/([^/]+)\/([^/?#]+)/);
  if (inv) return <InvoicePage id={inv[1]} token={inv[2]} />;
  return <SessionGate />;
}

function SessionGate() {
  const q = useGetSession({ query: { queryKey: getGetSessionQueryKey(), retry: false, refetchInterval: 60000 } });
  if (q.isLoading) {
    return <div className="min-h-[100dvh] grid place-items-center"><div className="animate-pulse"><Mark size={48} /></div></div>;
  }
  const session = q.data;
  if (!session || !session.authenticated) return <Login />;
  return <Shell session={session}><Router session={session} /></Shell>;
}

function Router({ session }: { session: Session }) {
  if (session.role === 'player') {
    return (
      <RoutedErrorBoundary>
        <Switch>
          <Route>{() => <PlayerHome session={session} />}</Route>
        </Switch>
      </RoutedErrorBoundary>
    );
  }
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/">{() => <Dashboard session={session} />}</Route>
        <Route path="/dashboard">{() => <Dashboard session={session} />}</Route>
        <Route path="/budget">{() => <Budget session={session} />}</Route>
        <Route path="/contracts">{() => <Contracts session={session} />}</Route>
        <Route path="/payroll">{() => <Payroll session={session} />}</Route>
        <Route path="/transactions">{() => <Transactions session={session} />}</Route>
        <Route path="/bonuses">{() => <Bonuses session={session} />}</Route>
        <Route path="/approvals">{() => <Approvals session={session} />}</Route>
        <Route path="/audit">{() => <Audit session={session} />}</Route>
        <Route path="/market">{() => <Market session={session} />}</Route>
        <Route path="/payments">{() => <Payments session={session} />}</Route>
        <Route path="/afford">{() => <Afford session={session} />}</Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <CurrencyProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Gate />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
        </CurrencyProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}

export default App;
