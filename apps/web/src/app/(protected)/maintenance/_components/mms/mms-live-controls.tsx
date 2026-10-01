'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';

/** Never poll MMS (via FMP) faster than this, whatever the server sends. */
const MIN_REFRESH_SECONDS = 15;

interface Props {
  /** Auto-refresh interval from the FMP API (MMS_LIVE_REFRESH_SECONDS, default 30). */
  refreshSeconds: number;
  /** Poll only when there is data to refresh or a transient outage to recover from. */
  autoRefresh: boolean;
}

// FMP-MAINT-01/02 — near-real-time refresh for the live MMS dashboard. Both the
// manual button and the timed poll use router.refresh(), which re-runs the
// Server Component's own fetch of GET /maintenance/dashboard/live — no client
// state duplicated from the server response, no websocket. Polling is
// suspended while the tab is hidden and refreshes once immediately when it
// becomes visible again.
export function MmsLiveControls({ refreshSeconds, autoRefresh }: Props): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const intervalMs = Math.max(MIN_REFRESH_SECONDS, refreshSeconds) * 1000;

  useEffect(() => {
    if (!autoRefresh) return;
    let timer: number | undefined;
    const tick = (): void => startTransition(() => router.refresh());
    const start = (): void => {
      if (timer === undefined) timer = window.setInterval(tick, intervalMs);
    };
    const stop = (): void => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        tick();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autoRefresh, intervalMs, router]);

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
      {isPending ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
