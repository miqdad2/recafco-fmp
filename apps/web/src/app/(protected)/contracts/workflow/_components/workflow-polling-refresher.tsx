'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const POLL_INTERVAL_MS = 20_000;

/**
 * Silent 20-second polling refresh (CM-32 "real-time" definition for this
 * unit — no WebSocket/SSE). Renders nothing; router.refresh() re-runs the
 * enclosing Server Component tree in place without a full page reload or
 * losing client-side state like an open drawer's scroll position.
 */
export function WorkflowPollingRefresher(): null {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
