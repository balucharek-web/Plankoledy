import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'planer_koledy_theme';

function readStoredTheme(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw;
    }
  } catch {
    // Ignore storage access errors in private mode
  }
  return 'system';
}

function resolveDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useThemeMode() {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readStoredTheme);
  const [isDark, setIsDark] = useState<boolean>(() => resolveDark(preference));

  const applyTheme = useCallback((pref: ThemePreference) => {
    const dark = resolveDark(pref);
    setIsDark(dark);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', dark);
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) {
        themeMeta.setAttribute('content', dark ? '#0F172A' : '#B45309');
      }
    }
  }, []);

  useEffect(() => {
    applyTheme(preference);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Ignore storage access errors
    }

    if (preference !== 'system' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [preference, applyTheme]);

  const setThemePreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
  }, []);

  const toggleLightDark = useCallback(() => {
    setPreferenceState((prev) => {
      const currentlyDark = resolveDark(prev);
      return currentlyDark ? 'light' : 'dark';
    });
  }, []);

  return {
    themePreference: preference,
    isDark,
    setThemePreference,
    toggleLightDark,
  };
}
