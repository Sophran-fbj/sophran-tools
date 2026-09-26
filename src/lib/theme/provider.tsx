'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { DEFAULT_THEME, isThemeName, THEME_STORAGE_KEY, type ThemeName } from '@/lib/theme';

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeChangedEvent = 'sophran-theme-changed';

function subscribe(callback: () => void) {
  window.addEventListener(themeChangedEvent, callback);
  return () => window.removeEventListener(themeChangedEvent, callback);
}

function getThemeSnapshot(): ThemeName {
  const current = document.documentElement.dataset.theme;
  return isThemeName(current) ? current : DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, () => DEFAULT_THEME);

  function setTheme(nextTheme: ThemeName) {
    document.documentElement.dataset.theme = nextTheme;
    window.dispatchEvent(new Event(themeChangedEvent));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Theme switching still works when storage is disabled.
    }
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
