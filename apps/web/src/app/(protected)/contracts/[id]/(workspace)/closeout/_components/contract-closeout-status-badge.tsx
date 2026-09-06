import { CLOSURE_STATUS_LABELS, CLOSURE_STATUS_BADGE_CLASSES, type ClosureStatus } from '../../../../_lib/contract-closeout-detail-helpers';

// CM-67D — stronger badge (bolder text, more padding) so the real closeout
// status reads clearly as the headline of the Status card. Same real status
// value, same real color family — presentation only.
export function ContractCloseoutStatusBadge({ status }: { status: ClosureStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-bold whitespace-nowrap ${CLOSURE_STATUS_BADGE_CLASSES[status]}`}>
      {CLOSURE_STATUS_LABELS[status]}
    </span>
  );
}
