import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request } from '../lib/api.js';
import storage from '../lib/storage.js';
import { STAFF_ROLES } from '../lib/constants.js';

const AuthContext = createContext(null);
const SESSION_KEY = 'idt.hasSession';

function setSessionFlag(value) {
  try {
    if (value) localStorage.setItem(SESSION_KEY, '1');
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function hasSessionFlag() {
  try {
    return localStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(() => hasSessionFlag());

  const applySession = useCallback((data) => {
    if (data?.accessToken) storage.setToken(data.accessToken);
    if (data?.user) setUser(data.user);
    setSessionFlag(true);
  }, []);

  const clearSession = useCallback(() => {
    storage.clear();
    setSessionFlag(false);
    setUser(null);
    setUnreadNotifications(0);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!hasSessionFlag()) {
        setLoading(false);
        return;
      }
      try {
        const data = await request({ url: '/me' });
        if (!active) return;
        setUser(data.user);
        setUnreadNotifications(data.unreadNotifications || 0);
      } catch {
        if (active) clearSession();
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [clearSession]);

  useEffect(() => {
    const handler = () => clearSession();
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [clearSession]);

  const login = useCallback(
    async (credentials) => {
      const data = await request({ method: 'post', url: '/auth/login', data: credentials });
      if (data?.twoFactorRequired || data?.twoFactorSetupRequired) return data;
      applySession(data);
      return data;
    },
    [applySession],
  );

  const loginTwoFactor = useCallback(
    async (payload) => {
      const data = await request({ method: 'post', url: '/auth/login/2fa', data: payload });
      applySession(data);
      return data;
    },
    [applySession],
  );

  const register = useCallback(
    async (payload) => {
      const data = await request({ method: 'post', url: '/auth/register', data: payload });
      applySession(data);
      return data;
    },
    [applySession],
  );

  const verifyEmail = useCallback(
    async (payload) => {
      const data = await request({ method: 'post', url: '/auth/verify-email', data: payload });
      applySession(data);
      return data;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await request({ method: 'post', url: '/auth/logout' });
    } catch {
      /* ignore */
    }
    clearSession();
  }, [clearSession]);

  const refreshMe = useCallback(async () => {
    const data = await request({ url: '/me' });
    setUser(data.user);
    setUnreadNotifications(data.unreadNotifications || 0);
    return data.user;
  }, []);

  const value = useMemo(() => {
    const permissions = user?.permissions || [];
    const isStaff = user ? STAFF_ROLES.includes(user.role) : false;
    const can = (permission) => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
      return permissions.includes(permission);
    };
    return {
      user,
      setUser,
      loading,
      isAuthenticated: Boolean(user),
      isStaff,
      unreadNotifications,
      setUnreadNotifications,
      can,
      login,
      loginTwoFactor,
      register,
      verifyEmail,
      logout,
      refreshMe,
      clearSession,
    };
  }, [user, loading, unreadNotifications, login, loginTwoFactor, register, verifyEmail, logout, refreshMe, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
