import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { request } from '../lib/api.js';
import { setLanguage } from '../i18n/index.js';

const SettingsContext = createContext(null);

const THEME_KEY = 'idt.theme';

const DEFAULTS = {
  appName: 'Ikizamini cyo Gutwara',
  defaultLanguage: 'rw',
  enabledLanguages: ['rw', 'en'],
  passingScorePercent: 80,
  examQuestionCount: 50,
  examDurationMinutes: 45,
  practiceDefaultCount: 20,
  allowRegistration: true,
  requireEmailVerification: false,
  maintenanceMode: false,
  announcement: '',
};

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(theme, reduceMotion) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', dark);
  root.classList.toggle('reduce-motion', Boolean(reduceMotion));
}

export function SettingsProvider({ children }) {
  const [config, setConfig] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState(readTheme);
  const [reduceMotion, setReduceMotion] = useState(() => {
    try {
      return localStorage.getItem('idt.reduceMotion') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let active = true;
    request({ url: '/config' })
      .then((data) => {
        if (active && data) {
          setConfig((prev) => ({ ...prev, ...data }));
          if (data.defaultLanguage) setLanguage(data.defaultLanguage);
        }
      })
      .catch(() => {
        /* keep defaults */
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      request({ url: '/config' })
        .then((data) => data && setConfig((p) => ({ ...p, ...data })))
        .catch(() => {});
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  useEffect(() => {
    applyTheme(theme, reduceMotion);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(theme, reduceMotion);
    mq?.addEventListener?.('change', handler);
    return () => mq?.removeEventListener?.('change', handler);
  }, [theme, reduceMotion]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleReduceMotion = useCallback((next) => {
    setReduceMotion(next);
    try {
      localStorage.setItem('idt.reduceMotion', String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      config,
      loading,
      theme,
      setTheme,
      reduceMotion,
      setReduceMotion: toggleReduceMotion,
      refresh: () => request({ url: '/config' }).then((data) => data && setConfig((p) => ({ ...p, ...data }))),
    }),
    [config, loading, theme, setTheme, reduceMotion, toggleReduceMotion],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export default SettingsContext;
