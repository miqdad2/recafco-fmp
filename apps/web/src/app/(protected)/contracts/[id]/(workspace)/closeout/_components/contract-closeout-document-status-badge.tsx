import type { ContractDocumentObligationStatus } from '@/lib/contracts-api';
import { DOCUMENT_OBLIGATION_STATUS_LABELS } from '../../../../_lib/contract-document-obligation-helpers';

// CM-67E — this unit's own explicit color spec: Submitted green, Pending
// amber, Expiring Soon purple/orange, Expired/Overdue red, Not Required and
// Cancelled gray. Deliberately NOT reusing DOCUMENT_OBLIGATION_STATUS_BADGE_CLASSES
// (contract-document-obligation-helpers.ts) as-is — that map colors
// EXPIRING_SOON with `accent` (this theme's brand red, per the CM-64C
// finding, never meant for a calm/non-urgent badge), which doesn't match
// either this task's "purple" request or CM-64C's own rule. Uses
// team-production (real indigo, this app's established purple substitute —
// there is no literal purple token) instead. Scoped to this Closeout
// section only; the Documents & Obligations tab's own badge is unchanged
// (out of scope for this unit — see the final report for this finding).
const CLOSEOUT_DOCUMENT_STATUS_BADGE_CLASSES: Record<ContractDocumentObligationStatus, string> = {
  PENDING: 'bg-warning-light text-warning',
  SUBMITTED: 'bg-success-light text-success',
  EXPIRING_SOON: 'bg-team-production-light text-team-production',
  EXPIRED_OVERDUE: 'bg-error-light text-error',
  NOT_REQUIRED: 'bg-surface-secondary text-text-muted',
  CANCELLED: 'bg-surface-secondary text-text-muted',
};

export function ContractCloseoutDocumentStatusBadge({ status }: { status: ContractDocumentObligationStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${CLOSEOUT_DOCUMENT_STATUS_BADGE_CLASSES[status]}`}>
      {DOCUMENT_OBLIGATION_STATUS_LABELS[status]}
    </span>
  );
}
