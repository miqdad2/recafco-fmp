'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  resolveTheme,
  readStoredThemePreference,
  writeStoredThemePreference,
} from '@/lib/theme';
import type { ThemePreference, ResolvedTheme } from '@/lib/theme';

interface ThemeContextValue {
  /** The user's stored choice — "light", "dark", or "system". */
  preference: ThemePreference;
  /** What "system" actually resolves to right now — always a concrete light/dark, never "system" itself. */
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/**
 * FMP-UI-11 — platform-wide appearance mode. The blocking script in
 * `app/layout.tsx` already set the correct `.dark` class on `<html>` before
 * this component ever mounts (avoiding a flash of the wrong theme on
 * load) — this provider's job from here on is just to keep that in sync
 * with (a) the user explicitly changing their preference via `ThemeToggle`,
 * and (b) the OS-level preference changing live while "System" is active
 * (e.g. the OS switches to dark mode at sunset while this tab stays open).
 * Preference is persisted to localStorage only — no cookie, no database
 * field, no server round-trip; this is a pure client-side display
 * preference, never read by any auth/session/permission logic.
 */
export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    const stored = readStoredThemePreference();
    setPreferenceState(stored);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyFromPreference = (pref: ThemePreference): void => {
      const resolved = resolveTheme(pref, media.matches);
      setResolvedTheme(resolved);
      applyResolvedTheme(resolved);
    };
    applyFromPreference(stored);

    // Only matters while "System" is active — a manual Light/Dark choice
    // should never be silently overridden by a later OS-level change.
    const handleSystemChange = (): void => {
      setPreferenceState((current) => {
        if (current === 'system') applyFromPreference('system');
        return current;
      });
    };
    media.addEventListener('change', handleSystemChange);
    return () => media.removeEventListener('change', handleSystemChange);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeStoredThemePreference(next);
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved = resolveTheme(next, systemPrefersDark);
    setResolvedTheme(resolved);
    applyResolvedTheme(resolved);
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
