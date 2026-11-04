import { router } from 'expo-router';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getProfile, login as apiLogin, logout as apiLogout, register as apiRegister, User } from '@/lib/api';
import { clearTokens, getAccessToken } from '@/lib/auth-storage';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (token) setUser(await getProfile());
    } catch {
      await clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async login(email, password) {
      const result = await apiLogin(email, password);
      setUser(result.user);
      router.replace('/(tabs)');
    },
    async register(name, email, password) {
      const result = await apiRegister(name, email, password);
      setUser(result.user);
      router.replace('/(tabs)');
    },
    async logout() {
      setUser(null);
      router.replace('/login');
      void apiLogout().catch(() => undefined);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider');
  return context;
}
