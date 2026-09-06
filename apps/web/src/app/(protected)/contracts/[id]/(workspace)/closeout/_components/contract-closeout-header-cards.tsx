import { CheckCircle2, AlertTriangle, Clock, FileEdit, XCircle, Archive } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ClosureStatus, ChecklistProgress } from '../../../../_lib/contract-closeout-detail-helpers';
import { ContractCloseoutStatusBadge } from './contract-closeout-status-badge';

interface Props {
  status: ClosureStatus;
  blockingCount: number;
  progress: ChecklistProgress;
}

// CM-67C — one real icon/color per real status, matching CLOSURE_STATUS_BADGE_CLASSES's
// color family exactly, instead of the old binary "ready vs everything else" treatment —
// a manager can now tell Rejected from Not Ready from Under Review at a glance.
const STATUS_ICON: Record<ClosureStatus, LucideIcon> = {
  NOT_READY: AlertTriangle,
  READY: CheckCircle2,
  DRAFT: FileEdit,
  SUBMITTED: Clock,
  UNDER_REVIEW: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  CLOSED: Archive,
  CANCELLED: XCircle,
};

const STATUS_ICON_CLASSES: Record<ClosureStatus, string> = {
  NOT_READY: 'bg-warning-light text-warning',
  READY: 'bg-success-light text-success',
  DRAFT: 'bg-surface-secondary text-text-secondary',
  SUBMITTED: 'bg-info-light text-info',
  UNDER_REVIEW: 'bg-warning-light text-warning',
  APPROVED: 'bg-success-light text-success',
  REJECTED: 'bg-error-light text-error',
  CLOSED: 'bg-surface-secondary text-text-muted',
  CANCELLED: 'bg-surface-secondary text-text-muted',
};

const PROGRESS_STAT_CLASSES = {
  completed: 'bg-success-light text-success',
  pending: 'bg-warning-light text-warning',
  notRequired: 'bg-surface-secondary text-text-muted',
  blocked: 'bg-error-light text-error',
} as const;

/**
 * CM-67 — Closeout Status + Closeout Progress, side by side per the
 * approved design. Status text is derived from the real blocking-item
 * count (never a fixed message) and the real checklist progress
 * (completed/pending/not-required/blocked), matching computeChecklistProgress()
 * exactly — no invented percentage.
 * CM-67C — visual-only polish: per-status icon/color (was a plain ready/
 * not-ready binary) and the 4 progress counts now render as colored chips
 * instead of plain numbers, for stronger at-a-glance scanability. Same real
 * status value and same real progress numbers — nothing computed changed.
 * CM-67D — readability pass: the status badge itself is bolder (see
 * contract-closeout-status-badge.tsx), and the progress percent/chip
 * numbers are one size larger (text-base→text-xl / text-lg) for easier
 * scanning. Same real values throughout.
 */
export function ContractCloseoutHeaderCards({ status, blockingCount, progress }: Props): React.JSX.Element {
  const Icon = STATUS_ICON[status];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <section className="rounded-lg border border-border bg-surface shadow-sm p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Closeout Status</h2>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center justify-center size-10 rounded-full shrink-0 ${STATUS_ICON_CLASSES[status]}`}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <ContractCloseoutStatusBadge status={status} />
            <p className="text-xs text-text-secondary mt-1.5">
              {blockingCount === 0
                ? 'No outstanding items — this contract is ready for closeout.'
                : `${blockingCount} blocking ${blockingCount === 1 ? 'item needs' : 'items need'} to be resolved before closing.`}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-sm p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Closeout Progress</h2>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2 rounded-full bg-surface-secondary overflow-hidden">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="text-xl font-bold text-text-primary tabular-nums shrink-0">{progress.percent}%</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <div className={`rounded-md px-1.5 py-1.5 text-center ${PROGRESS_STAT_CLASSES.completed}`}>
            <p className="text-lg font-bold leading-none">{progress.completed}</p>
            <p className="text-[11px] font-medium mt-1">Completed</p>
          </div>
          <div className={`rounded-md px-1.5 py-1.5 text-center ${PROGRESS_STAT_CLASSES.pending}`}>
            <p className="text-lg font-bold leading-none">{progress.pending}</p>
            <p className="text-[11px] font-medium mt-1">Pending</p>
          </div>
          <div className={`rounded-md px-1.5 py-1.5 text-center ${PROGRESS_STAT_CLASSES.notRequired}`}>
            <p className="text-lg font-bold leading-none">{progress.notRequired}</p>
            <p className="text-[11px] font-medium mt-1">Not Req.</p>
          </div>
          <div className={`rounded-md px-1.5 py-1.5 text-center ${PROGRESS_STAT_CLASSES.blocked}`}>
            <p className="text-lg font-bold leading-none">{progress.blocked}</p>
            <p className="text-[11px] font-medium mt-1">Blocked</p>
          </div>
        </div>
      </section>
    </div>
  );
}
