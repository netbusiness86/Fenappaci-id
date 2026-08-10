import { createContext, useContext, useEffect } from 'react';
import { useGetMe, getGetMeQueryKey, login as apiLogin, logout as apiLogout } from '@workspace/api-client-react';
import type { AuthUser, LoginInput } from '@workspace/api-client-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user, isLoading: isUserLoading, error } = useGetMe({
    query: {
      retry: false,
    }
  });

  const loginMutation = useMutation({
    mutationFn: (data: LoginInput) => apiLogin(data),
    onSuccess: (data) => {
      queryClient.setQueryData(getGetMeQueryKey(), data);
      setLocation('/tableau-de-bord');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiLogout(),
    onSuccess: () => {
      queryClient.setQueryData(getGetMeQueryKey(), null);
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setLocation('/login');
    },
  });

  const isLoading = isUserLoading || loginMutation.isPending || logoutMutation.isPending;
  const isError401 = error && (error as any).status === 401;
  const isAuthenticated = !!user && !isError401;

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        isAuthenticated,
        login: async (data) => {
          return await loginMutation.mutateAsync(data);
        },
        logout: async () => {
          await logoutMutation.mutateAsync();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
