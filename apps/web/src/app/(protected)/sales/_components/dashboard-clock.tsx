'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { kuwaitDateOf, msUntilNextKuwaitMidnight } from '../_lib/kuwait-time';

/**
 * FMP-SALES-06 — keeps an open dashboard correct across midnight in Kuwait. The page shows the figures for the day and
 * month the SERVER computed (`serverToday`); when the Kuwait date moves on (including a new month or year) the page's
 * server data is re-read, so the month label and every month figure change together - the label is never changed on its
 * own. Checks run at the next Kuwait midnight, when the tab becomes visible again, and once a minute (timers are
 * unreliable while a laptop sleeps). A refresh is attempted at most every 20 seconds so a clock mismatch cannot loop.
 */
export function DashboardClock({ serverToday }: { serverToday: string }): null {
  const router = useRouter();
  const lastTry = useRef(0);

  useEffect(() => {
    function check(): void {
      const now = Date.now();
      if (kuwaitDateOf(now) === serverToday) return;
      if (now - lastTry.current < 20_000) return;
      lastTry.current = now;
      router.refresh();
    }
    const midnight = window.setTimeout(check, msUntilNextKuwaitMidnight(Date.now()) + 1500);
    const minute = window.setInterval(check, 60_000);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    check();
    return () => {
      window.clearTimeout(midnight);
      window.clearInterval(minute);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [serverToday, router]);

  return null;
}
