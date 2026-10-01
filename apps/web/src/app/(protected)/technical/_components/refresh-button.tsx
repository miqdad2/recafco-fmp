'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';

// FMP-TECH-01C — a plain client-side refresh (router.refresh() re-runs this
// Server Component page's own data fetch) — no new endpoint, no client
// state duplicated from the server response.
export function RefreshButton(): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-secondary disabled:opacity-50"
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
      Refresh
    </button>
  );
}
