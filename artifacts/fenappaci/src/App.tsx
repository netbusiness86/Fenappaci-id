import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
  Redirect,
} from 'wouter';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Shell } from '@/components/layout/Shell';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import MyProducers from '@/pages/MyProducers';
import Identify from '@/pages/Identify';
import EditProducteur from '@/pages/EditProducteur';
import DetailProducteur from '@/pages/DetailProducteur';
import SearchPage from '@/pages/Search';
import Profile from '@/pages/Profile';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

// Redirect root to Dashboard or Login based on auth
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return null;
  
  if (isAuthenticated) {
    return <Redirect to="/tableau-de-bord" />;
  } else {
    return <Redirect to="/login" />;
  }
}

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={RootRedirect} />
          <Route path="/login" component={Login} />
          
          {/* Protected Routes */}
          <Route path="/tableau-de-bord">
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          </Route>
          <Route path="/mes-producteurs">
            <ProtectedRoute><MyProducers /></ProtectedRoute>
          </Route>
          <Route path="/identifier">
            <ProtectedRoute><Identify /></ProtectedRoute>
          </Route>
          <Route path="/producteurs/:id/modifier">
            <ProtectedRoute><EditProducteur /></ProtectedRoute>
          </Route>
          <Route path="/producteurs/:id">
            <ProtectedRoute><DetailProducteur /></ProtectedRoute>
          </Route>
          <Route path="/rechercher">
            <ProtectedRoute><SearchPage /></ProtectedRoute>
          </Route>
          <Route path="/profil">
            <ProtectedRoute><Profile /></ProtectedRoute>
          </Route>

          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
