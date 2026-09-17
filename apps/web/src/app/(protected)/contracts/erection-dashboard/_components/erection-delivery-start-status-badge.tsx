import type { ErectionDeliveryStartDisplayStatus } from '@/lib/contracts-api';
import {
  ERECTION_DELIVERY_START_DISPLAY_LABELS,
  ERECTION_DELIVERY_START_BADGE_CLASSES,
} from '../../_lib/contract-erection-dashboard-helpers';

interface Props {
  status: ErectionDeliveryStartDisplayStatus;
}

/** CM-71E — Step 4's own delivery-start status badge, mirrors ErectionScheduleStatusBadge exactly. */
export function ErectionDeliveryStartStatusBadge({ status }: Props): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${ERECTION_DELIVERY_START_BADGE_CLASSES[status]}`}>
      {ERECTION_DELIVERY_START_DISPLAY_LABELS[status]}
    </span>
  );
}
