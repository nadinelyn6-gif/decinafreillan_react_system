import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';
import { clearToken, getToken, setToken, UNAUTHORIZED_EVENT } from '../lib/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(() => (getToken() ? 'restoring' : 'signed-out'));
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('signed-out');
    setError('');
  }, []);

  // Restore the session from a token saved in a previous visit.
  useEffect(() => {
    if (!getToken()) return undefined;

    let cancelled = false;
    api.me().then(
      (data) => {
        if (cancelled) return;
        setUser(data.user);
        setStatus('signed-in');
      },
      () => {
        if (cancelled) return;
        signOut();
      }
    );

    return () => {
      cancelled = true;
    };
  }, [signOut]);

  // Any 401 from a protected endpoint ends the session.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);

  const login = useCallback(async (email, password) => {
    setError('');
    try {
      const data = await api.login({ email, password });
      setToken(data.token);
      setUser(data.user);
      setStatus('signed-in');
      return true;
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
      return false;
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    setError('');
    try {
      const data = await api.register({ name, email, password });
      setToken(data.token);
      setUser(data.user);
      setStatus('signed-in');
      return true;
    } catch (err) {
      setError(err.message || 'Unable to create the account.');
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* the local sign-out still needs to happen */
    }
    signOut();
  }, [signOut]);

  const value = useMemo(
    () => ({ status, user, error, setError, login, register, logout, signOut }),
    [status, user, error, login, register, logout, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
