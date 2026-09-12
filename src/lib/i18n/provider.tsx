'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { messages, type Locale, type Messages } from './messages';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Messages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');

  useEffect(() => {
    const restorePreference = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem('txray-locale');
        if (saved === 'zh' || saved === 'en') setLocaleState(saved);
      } catch {
        // Storage can be disabled; Chinese remains the deterministic default.
      }
    }, 0);
    return () => window.clearTimeout(restorePreference);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (next: Locale) => {
      setLocaleState(next);
      try {
        window.localStorage.setItem('txray-locale', next);
      } catch {
        // The in-memory preference still works for this tab.
      }
    };

    return { locale, setLocale, t: messages[locale] };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
