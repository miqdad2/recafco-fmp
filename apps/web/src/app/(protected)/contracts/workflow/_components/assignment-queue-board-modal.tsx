'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';

interface Props {
  contractId: string;
  contractReference: string;
  contractTitle: string;
  counterpartyName: string;
  unassignedCount: number;
  closeHref: string;
  children: React.ReactNode;
}

/**
 * CM-52C — large focused modal for a selected contract's assignment board,
 * replacing the previous below-the-cards inline panel so the Assign Work
 * landing page (summary cards, contract picker, advanced filters, contract
 * cards, needing-setup section) stays visible and never grows long. Opened
 * purely by the existing ?mode=assignment&contractId=<id> query params
 * (assignment-queue-view.tsx already computes the selected contract's data
 * only when contractId is present), so a direct link with both params —
 * including the contract card's own "Assign Tasks" link — opens this modal
 * automatically with no extra wiring. Closing navigates to closeHref (the
 * same buildAssignmentHref helper with contractId cleared), a real
 * navigation rather than client-only state, so the URL always reflects
 * what's open. Mirrors WorkflowBoardModal (CM-52) for the "All Workflows"
 * page — same structure, same reasoning.
 */
export function AssignmentQueueBoardModal({
  contractId,
  contractReference,
  contractTitle,
  counterpartyName,
  unassignedCount,
  closeHref,
  children,
}: Props): React.JSX.Element {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') router.push(closeHref);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [router, closeHref]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-3 lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-queue-board-modal-title"
    >
      <div className="flex h-full w-full max-w-[1800px] flex-col rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 id="assignment-queue-board-modal-title" className="text-sm font-semibold text-text-primary">
              Assign Workflow Tasks
            </h2>
            <p className="mt-1 text-xs text-text-secondary truncate">
              <span className="font-mono text-accent">{contractReference}</span> · {contractTitle} · {counterpartyName}
            </p>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent whitespace-nowrap">
                {unassignedCount} unassigned task{unassignedCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/contracts/${contractId}`}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Open Contract Detail
            </Link>
            <Link
              href={closeHref}
              aria-label="Close"
              className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <X className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
