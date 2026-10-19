//src\context\auth.tsx
import { createSignal, createContext, useContext, onCleanup } from 'solid-js';
import { apiFetch, setUnauthorizedHandler } from '../api/client';

interface User {
  id: string;
  email: string;
  username?: string;
  firstName: string;
  isMainAdmin?: boolean;
  telegramId?: number;   // ✅ ADD
}

interface AuthContextType {
  user: () => User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: () => boolean;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>();

export function AuthProvider(props: { children: any }) {
  const [user, setUser] = createSignal<User | null>(null);
  const [loading, setLoading] = createSignal(true);

  const checkAuth = async () => {
    try {
      const data = await apiFetch<{ user: User }>('/admin/me');
      setUser(data.user);
      return true;
    } catch (error: any) {
      console.error('[checkAuth] error:', error);
      // If token is invalid or expired, clear it
      localStorage.removeItem('admin_token');
      setUser(null);
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ user: User; token: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    // Store token
    localStorage.setItem('admin_token', data.token);
    setUser(data.user);
    startSessionCheck();
  };

  const logout = async () => {
    await apiFetch('/admin/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('admin_token');
    setUser(null);
    stopSessionCheck();
  };

  let intervalId: number;
  const startSessionCheck = () => {
    stopSessionCheck();
    intervalId = setInterval(async () => {
      try {
        await apiFetch('/admin/me');
      } catch (error) {
        // If unauthorized, stop checking and redirect to login
        stopSessionCheck();
        setUser(null);
        window.location.href = '/login';
      }
    }, 5 * 60 * 1000); // every 5 minutes
  };

  const stopSessionCheck = () => {
    if (intervalId) clearInterval(intervalId);
  };

  // Set global unauthorized handler to show popups
  setUnauthorizedHandler((reason) => {
    if (window.location.pathname === '/login') return;

    if (reason === 'duplicate') {
      window.dispatchEvent(new CustomEvent('duplicate-session'));
    } else if (reason === 'expired') {
      window.dispatchEvent(new CustomEvent('session-expired'));
    } else {
      logout().then(() => (window.location.href = '/login'));
    }
  });

  // Initial check
  checkAuth().finally(() => setLoading(false));
  onCleanup(stopSessionCheck);

  const value: AuthContextType = {
    user,
    login,
    logout,
    loading,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}