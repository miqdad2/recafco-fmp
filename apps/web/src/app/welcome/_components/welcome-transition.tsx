'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const REDIRECT_DELAY_MS = 1800;

/**
 * FMP-UI-Login-Polish — a short branded transition between signing in and
 * landing on the real dashboard. Auto-continues to `/` (which itself
 * already redirects to `/dashboard`) after ~1.8s; a small "Continue now"
 * link is kept as a fallback for the rare case navigation doesn't fire on
 * its own, so an older user is never left staring at a screen that looks
 * stuck.
 *
 * FMP-UI-12 — copy split into "Welcome to" / "RECAFCO Factory Operations
 * System". Every color here is a semantic token (`bg-background`,
 * `text-text-primary`, `text-text-secondary`, `text-text-muted`,
 * `border-border`) — dark mode already applies with zero changes, since
 * FMP-UI-11's `.dark` overrides are exactly these tokens.
 *
 * FMP-UI-12E — visual refresh: bigger logo, "Welcome to" de-emphasized
 * (smaller/lighter) so "RECAFCO Factory Operations System" reads as the
 * dominant headline, and the logo/text blocks fade+slide in as two
 * separate, slightly staggered groups (`delay-150` on the text) instead of
 * one single block.
 *
 * FMP-UI-12G — merged the 2-tier heading back into a single sentence,
 * "Welcome to RECAFCO Factory Operations System", sized to stay on one
 * line on desktop (`lg:whitespace-nowrap`, widened container at `lg`/`xl`
 * so the line actually has room to fit) while wrapping normally on mobile.
 *
 * FMP-UI-12F — removed the once-per-tab `sessionStorage` guard (and the
 * `force` prop that existed only to bypass it) that FMP-UI-12B/12C/12D
 * built up: it was fixing a genuine "flag persists across a whole tab"
 * problem, but the fix kept re-breaking (Enter-key submission, then a
 * stale dev server) and each round of debugging made the actual behavior
 * harder to reason about. This screen is only ever reached right after a
 * real successful login (`login/actions.ts` is the only place that
 * `redirect()`s here) — there is no legitimate scenario where landing on
 * `/welcome` should silently skip rendering it, so the simplest correct
 * behavior is to always show it, every time.
 */
export function WelcomeTransition(): React.JSX.Element {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Mount with the fade/rise-in styles already applied one tick later, so
    // the transition actually animates from its initial state instead of
    // rendering already-visible.
    const showFrame = requestAnimationFrame(() => setVisible(true));
    const redirectTimer = setTimeout(() => {
      router.replace('/');
    }, REDIRECT_DELAY_MS);
    return () => {
      cancelAnimationFrame(showFrame);
      clearTimeout(redirectTimer);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div
        className={`flex flex-col items-center transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
      >
        <div className="inline-flex rounded-3xl border border-border bg-white p-6 shadow-lg">
          <img src="/recafco-logo.png" alt="RECAFCO" width={193} height={150} className="h-20 w-auto sm:h-24" />
        </div>
      </div>

      <div
        className={`mt-8 max-w-xl transition-all delay-150 duration-700 ease-out lg:max-w-4xl xl:max-w-6xl ${visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
      >
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-4xl lg:whitespace-nowrap lg:text-4xl xl:text-5xl">
          Welcome to RECAFCO Factory Operations System
        </h1>
        <p className="mt-4 text-sm text-text-muted sm:text-base">Preparing your workspace…</p>
      </div>

      <button
        type="button"
        onClick={() => router.replace('/')}
        className="mt-10 text-xs text-text-muted underline-offset-2 hover:text-text-secondary hover:underline focus:outline-none focus-visible:underline"
      >
        Continue now
      </button>
    </div>
  );
}
