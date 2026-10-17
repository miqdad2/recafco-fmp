'use client';

import { useSearchParams } from 'next/navigation';
import { Printer, Download } from 'lucide-react';

const secondaryBtn =
  'inline-flex items-center gap-1.5 h-10 px-4 rounded-md border border-border bg-surface text-text-primary text-sm font-medium hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus';

// No "New Closeout Request" button by design — requests start from Contract Detail → Request Closeout.
export function CloseoutActionsBar(): React.JSX.Element {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const exportHref = `/contracts/closeouts/export${qs ? `?${qs}` : ''}`;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className={secondaryBtn}
        title="Print the current filtered register (use your browser's Save as PDF option for a PDF copy)"
      >
        <Printer className="size-4 shrink-0" aria-hidden="true" />
        Print
      </button>
      <a href={exportHref} className={secondaryBtn} title="Export the current filtered register as CSV (opens in Excel)">
        <Download className="size-4 shrink-0" aria-hidden="true" />
        Export CSV
      </a>
    </div>
  );
}
