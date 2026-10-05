import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { initAdmin as initAdminApi, login as loginApi } from '../api/auth';
import { TOKEN_KEY, USERNAME_KEY } from '../api/client';

interface AuthContextValue {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  /** Desktop first-run: creates the admin account, then signs in. */
  setup: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persist(username: string, token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() =>
    localStorage.getItem(USERNAME_KEY),
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: !!username,
      username,
      login: async (u: string, p: string) => {
        const res = await loginApi(u, p);
        persist(res.username, res.accessToken);
        setUsername(res.username);
      },
      setup: async (u: string, p: string) => {
        const res = await initAdminApi(u, p);
        persist(res.username, res.accessToken);
        setUsername(res.username);
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USERNAME_KEY);
        setUsername(null);
      },
    }),
    [username],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
