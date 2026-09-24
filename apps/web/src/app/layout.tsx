import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { ThemeProvider } from './_components/theme-provider';

export const metadata: Metadata = {
  title: 'RECAFCO Factory Management Platform',
  description: 'Internal factory operations platform',
};

// FMP-UI-11 — sets the correct `.dark` class on `<html>` BEFORE React
// hydrates, so there is no flash of the wrong theme on load. Must be a
// plain inline script (no imports — nothing has loaded yet) and its
// storage key literal ('recafco-theme') must stay byte-for-byte identical
// to `THEME_STORAGE_KEY` in `src/lib/theme.ts`; `ThemeProvider` reads the
// same key afterward and keeps everything in sync from then on. Wrapped in
// try/catch so a browser that blocks storage still renders (falls back to
// the OS preference for that one paint).
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('recafco-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || (stored !== 'light' && prefersDark);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-FOUC theme script — must run before hydration; a literal constant, no user input involved. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
