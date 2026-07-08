import { useState, useEffect, useCallback } from 'react';
import { login as apiLogin, register as apiRegister, getMe, User } from '../services/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setIsLoading(false); return; }
    getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const token = await apiLogin(email, password);
    localStorage.setItem('token', token);
    const me = await getMe();
    setUser(me);
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    const token = await apiRegister(email, username, password);
    localStorage.setItem('token', token);
    const me = await getMe();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return { user, isLoading, login, register, logout };
}
