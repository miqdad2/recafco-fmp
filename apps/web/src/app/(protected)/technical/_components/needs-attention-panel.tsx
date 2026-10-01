import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ArrowUpRight } from 'lucide-react';
import type { TechnicalAttentionItem, TechnicalAttentionReason } from '@/lib/technical-api';
import { TECHNICAL_STAGE_LABELS } from '@/lib/technical-api';
import { stageBadgeClasses, stageHref } from '../_lib/technical-format';

interface Props {
  items: TechnicalAttentionItem[];
}

const REASON_LABELS: Record<TechnicalAttentionReason, string> = {
  OVERDUE_PLANNED_REVIEW: 'Overdue Planned Review',
  URGENT_PRIORITY: 'Urgent Priority',
  DRAWING_RECEIVED_NOT_COMPLETED: 'Drawing Received — Not Completed',
  CLARIFICATION_REQUESTED: 'Clarification Requested',
  WAITING_APPROVAL_TOO_LONG: 'Waiting Approval Too Long',
  OVERDUE_TARGET_APPROVAL: 'Overdue Target Approval Date',
  OVERDUE_EXPECTED_APPROVAL: 'Overdue Expected Approval Date',
  OVERDUE_FD_ISSUE_DATE: 'Overdue FD Issue Date',
};

// FMP-TECH-01C, polished in FMP-TECH-05 — every row here is a real
// TechnicalWorkflow/TechnicalDrawing/TechnicalApproval/TechnicalFdIssuance
// condition computed by TechnicalService.getDashboard (overdue planned
// review, urgent priority, a step left uncompleted, an unresolved
// clarification request, stuck too long at Getting Approval, or an overdue
// approval/FD-issue date) — never a fabricated/sample warning. `stage` was
// added to the response shape in FMP-TECH-05 so each row can show which
// stage the issue belongs to without a separate lookup.
export function NeedsAttentionPanel({ items }: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-success/40 bg-success-light p-4 text-sm text-success">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        All Technical workflow items are currently on track.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${item.contractId}-${item.reason}-${i}`}
          className="flex items-start justify-between gap-3 rounded-lg border border-warning/40 bg-warning-light px-3.5 py-3 text-sm"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-semibold text-text-primary">{item.jobOrderNo ?? item.referenceNumber}</p>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${stageBadgeClasses(item.stage)}`}>
                  {TECHNICAL_STAGE_LABELS[item.stage]}
                </span>
              </div>
              <p className="mt-0.5 text-text-secondary">{item.projectName}</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                <span className="font-medium">{REASON_LABELS[item.reason]}:</span> {item.detail}
              </p>
            </div>
          </div>
          {/* FMP-TECH-05P — links directly to the item's own stage page
              (it always has a real `stage` and an in-progress workflow),
              rather than the workflow overview, matching the "Open Stage"
              label/behavior used by the jobs table above. */}
          <Link
            href={stageHref(item.contractId, item.stage)}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-warning/50 bg-surface px-2.5 py-1 text-xs font-semibold text-warning hover:bg-warning-light"
          >
            Open Stage
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
