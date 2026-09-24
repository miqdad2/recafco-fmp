'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from './theme-provider';
import type { ThemePreference } from '@/lib/theme';

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * FMP-UI-11 — the platform's appearance-mode selector: Light / Dark /
 * System. Placed on the login page per this unit's own "near login card
 * footer or top-right" instruction; the preference it sets applies
 * platform-wide via `ThemeProvider` + the `.dark` class it toggles on
 * `<html>`, so no equivalent control needs to exist inside the dashboard
 * for the chosen theme to keep applying there too.
 */
export function ThemeToggle(): React.JSX.Element {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 shadow-sm"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={[
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nav',
              active
                ? 'bg-nav text-white'
                : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
            ].join(' ')}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
