export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/**
 * FMP-UI-11 — single source of truth for the localStorage key name, shared
 * by the anti-flash blocking script in `app/layout.tsx` (which must inline
 * this as a literal string — it runs before any JS module loads) and
 * `ThemeProvider`. Keeping the literal in both places byte-for-byte
 * identical is the actual reason this constant exists as a named export
 * instead of just being typed inline twice.
 */
export const THEME_STORAGE_KEY = 'recafco-theme';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Reads the stored preference, defaulting to "system" per this unit's own spec — never throws, even where storage is unavailable (private browsing, blocked cookies/storage). */
export function readStoredThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
  } catch {
    // Storage unavailable — fall through to the default.
  }
  return 'system';
}

export function writeStoredThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage unavailable — the preference just won't survive a refresh this session.
  }
}

/** "system" resolves to whatever the OS/browser currently reports; "light"/"dark" are an explicit override that ignores it. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}
