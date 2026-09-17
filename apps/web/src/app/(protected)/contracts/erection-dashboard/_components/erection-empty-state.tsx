import Link from 'next/link';
import { HardHat } from 'lucide-react';

/** CM-71B — shown when the work queue has zero rows (no contract in scope has Erection in scope, an issued method statement, or an ERECTION workflow task). */
export function ErectionEmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface py-16 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-secondary text-text-muted">
        <HardHat className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold text-text-primary">No erection contracts found</p>
        <p className="text-xs text-text-secondary mt-1">Contracts with Erection scope will appear here once created.</p>
      </div>
      <Link
        href="/contracts"
        className="mt-2 inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
      >
        Go to Contract List
      </Link>
    </div>
  );
}
