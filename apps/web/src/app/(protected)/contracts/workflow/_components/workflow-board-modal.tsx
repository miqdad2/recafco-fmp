'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { ContractWorkflowDetail, ContractPerson } from '@/lib/contracts-api';
import { WorkflowStatusBadge } from './workflow-status-badge';
import { WorkflowContractHeader } from './workflow-contract-header';
import { WorkflowBoard } from './workflow-board';

interface Props {
  contractId: string;
  detail: ContractWorkflowDetail;
  closeHref: string;
  people: ContractPerson[];
  canManage: boolean;
  canUpdateAssigned: boolean;
  currentUserId: string | null;
  emptyMessage?: string;
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  TERMINATED: 'Terminated',
  CLOSED: 'Closed',
};

/**
 * CM-52 — large focused modal for a selected contract's workflow board,
 * replacing the previous below-the-table inline section so the "All
 * Workflows" / Overdue table itself never grows long. Opened purely by the
 * existing ?contractId=<id> query param (page.tsx already fetches
 * ContractWorkflowDetail only when that param is present), so any existing
 * link that routes with contractId — dashboard shortcuts, contract-list
 * links — opens this modal automatically with no extra wiring. Closing
 * navigates to closeHref (the same buildHref helper with contractId
 * cleared), which is a real navigation rather than client-only state so the
 * URL always reflects what's open.
 */
export function WorkflowBoardModal({
  contractId,
  detail,
  closeHref,
  people,
  canManage,
  canUpdateAssigned,
  currentUserId,
  emptyMessage,
}: Props): React.JSX.Element {
  const router = useRouter();
  const { contract, progress } = detail;
  const unassignedTasks = detail.tasks.filter((t) => !t.responsibleUserId).length;

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
      aria-labelledby="workflow-board-modal-title"
    >
      <div className="flex h-full w-full max-w-[1800px] flex-col rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 id="workflow-board-modal-title" className="text-sm font-semibold text-text-primary">
              Contract Workflow Board
            </h2>
            <p className="mt-1 text-xs text-text-secondary truncate">
              <span className="font-mono text-accent">{contract.referenceNumber}</span> · {contract.title} · {contract.counterpartyName}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-muted">
                {CONTRACT_STATUS_LABELS[contract.status] ?? contract.status}
              </span>
              <WorkflowStatusBadge status={progress.workflowStatus} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/contracts/${contract.id}`}
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

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          <WorkflowContractHeader detail={detail} />

          {progress.total > 0 && (
            <dl className="grid grid-cols-2 sm:grid-cols-5 gap-4 rounded-lg border border-border bg-surface p-4">
              <div>
                <dt className="text-xs text-text-muted">Total Tasks</dt>
                <dd className="text-sm font-medium text-text-primary mt-0.5">{progress.total}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Completed</dt>
                <dd className="text-sm font-medium text-text-primary mt-0.5">{progress.completed}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">In Progress</dt>
                <dd className="text-sm font-medium text-text-primary mt-0.5">{progress.inProgress}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Overdue</dt>
                <dd className="text-sm font-medium mt-0.5">
                  {progress.overdue > 0 ? <span className="text-error">{progress.overdue}</span> : progress.overdue}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Unassigned</dt>
                <dd className="text-sm font-medium text-text-primary mt-0.5">{unassignedTasks}</dd>
              </div>
            </dl>
          )}

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Team Task Board</h3>
            <WorkflowBoard
              contractId={contractId}
              tasks={detail.tasks}
              people={people}
              canManage={canManage}
              canUpdateAssigned={canUpdateAssigned}
              currentUserId={currentUserId}
              contractReference={contract.referenceNumber}
              contractTitle={contract.title}
              {...(emptyMessage ? { emptyMessage } : {})}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
