import type { ErectionChecklistDisplayStatus } from '@/lib/contracts-api';
import {
  ERECTION_CHECKLIST_DISPLAY_LABELS,
  ERECTION_CHECKLIST_BADGE_CLASSES,
} from '../../_lib/contract-erection-dashboard-helpers';

interface Props {
  status: ErectionChecklistDisplayStatus;
}

/** CM-71G — Step 6's own erection-checklist status badge, mirrors ErectionStartStatusBadge exactly. */
export function ErectionChecklistStatusBadge({ status }: Props): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${ERECTION_CHECKLIST_BADGE_CLASSES[status]}`}>
      {ERECTION_CHECKLIST_DISPLAY_LABELS[status]}
    </span>
  );
}
