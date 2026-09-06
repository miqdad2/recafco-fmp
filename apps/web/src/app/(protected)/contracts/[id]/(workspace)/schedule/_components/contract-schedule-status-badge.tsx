import type { ContractScheduleStageStatus } from '@/lib/contracts-api';
import { STAGE_STATUS_LABELS, STAGE_STATUS_BADGE_CLASSES } from '../../../../_lib/contract-schedule-detail-helpers';

export function ContractScheduleStatusBadge({ status }: { status: ContractScheduleStageStatus }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STAGE_STATUS_BADGE_CLASSES[status]}`}>
      {STAGE_STATUS_LABELS[status]}
    </span>
  );
}
