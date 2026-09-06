import { CHECKLIST_STATUS_LABELS, CHECKLIST_STATUS_BADGE_CLASSES, type ChecklistStatus } from '../../../../_lib/contract-closeout-detail-helpers';

export function ContractCloseoutChecklistStatusBadge({ status }: { status: ChecklistStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${CHECKLIST_STATUS_BADGE_CLASSES[status]}`}>
      {CHECKLIST_STATUS_LABELS[status]}
    </span>
  );
}
