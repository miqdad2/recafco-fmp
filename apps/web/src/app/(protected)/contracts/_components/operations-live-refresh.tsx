'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getOperationsFingerprintAction } from '../operations-actions';

interface Props {
  /** Contracts shown on this screen. */
  contractIds: string[];
  /** How often to ask FMP whether anything changed. This reads FMP's own database only, never the source. */
  everySeconds?: number;
}

/**
 * FMP-OPS-02 — keeps an open screen (Contract List, Overview, department tabs) in step with the accepted
 * snapshots. Every few seconds it asks FMP for a cheap fingerprint of the visible contracts; the page is reloaded
 * only when the fingerprint changes (a new accepted snapshot, a new retrieval time, a delayed/recovered state).
 * It never contacts the Operations system, so many viewers cause no extra source requests. Paused while the browser
 * tab is hidden and re-checked the moment it becomes visible again.
 */
export function OperationsLiveRefresh({ contractIds, everySeconds = 15 }: Props): React.JSX.Element {
  const router = useRouter();
  const last = useRef<string | null>(null);
  const busy = useRef(false);
  const key = contractIds.join(',');

  useEffect(() => {
    if (key === '') return;
    let cancelled = false;
    async function check(): Promise<void> {
      if (busy.current || document.visibilityState !== 'visible') return;
      busy.current = true;
      try {
        const fp = await getOperationsFingerprintAction(key.split(','));
        if (cancelled || fp === null) return; // keep the screen as it is when FMP itself is unreachable
        const serialised = JSON.stringify(fp);
        if (last.current !== null && last.current !== serialised) router.refresh();
        last.current = serialised;
      } finally {
        busy.current = false;
      }
    }
    void check();
    const id = setInterval(() => void check(), Math.max(3, everySeconds) * 1000);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, everySeconds, router]);

  return <span className="sr-only" data-operations-live-refresh={`every-${everySeconds}s`} />;
}
