import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { api, setAccessToken } from '../services/api';
import type { User, Role } from '../types';
interface Auth {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}
const AuthContext = createContext<Auth | null>(null);
export const homeFor = (role: Role) =>
  role === 'STUDENT' ? '/dashboard' : role === 'SELLER' ? '/seller' : '/admin';
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  function logout() {
    setAccessToken(null);
    setUser(null);
  }
  useEffect(() => {
    window.addEventListener('session-expired', logout);
    return () => window.removeEventListener('session-expired', logout);
  }, []);
  async function login(email: string, password: string) {
    const result = await api<{ accessToken: string; user: User }>('/auth/login', {
      email,
      password,
    });
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Missing AuthProvider');
  return value;
}
export function Protected({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
