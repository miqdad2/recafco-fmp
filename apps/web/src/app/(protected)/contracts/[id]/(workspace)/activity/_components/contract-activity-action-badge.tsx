import { CirclePlus, PencilLine, ArrowRightLeft, Paperclip, MessageSquare, ShieldCheck } from 'lucide-react';
import type { ActivityType } from '../../../../_lib/contract-activity-helpers';

const ICON_BY_TYPE: Record<ActivityType, typeof CirclePlus> = {
  CONTRACT_CREATED: CirclePlus,
  CONTRACT_UPDATED: PencilLine,
  STATUS_CHANGED: ArrowRightLeft,
  DOCUMENT_UPLOADED: Paperclip,
  PAYMENT_UPDATED: PencilLine,
  WORKFLOW_UPDATED: PencilLine,
  VARIATION_UPDATED: PencilLine,
  CLAIM_UPDATED: PencilLine,
  RISK_UPDATED: PencilLine,
  ISSUE_UPDATED: PencilLine,
  CLOSEOUT_ACTION: ShieldCheck,
  OTHER: MessageSquare,
};

/** CM-66 — small icon + real action label for the table's "Activity / Action" column. Neutral styling — this is not a status/priority badge, just a labeled icon. */
export function ContractActivityActionBadge({ type, label }: { type: ActivityType; label: string }): React.JSX.Element {
  const Icon = ICON_BY_TYPE[type];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-text-primary whitespace-nowrap">
      <Icon className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
      {label}
    </span>
  );
}
