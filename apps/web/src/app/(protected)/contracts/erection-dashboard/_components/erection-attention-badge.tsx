import type { ErectionAttentionStatus } from '@/lib/contracts-api';
import { ERECTION_ATTENTION_LABELS, ERECTION_ATTENTION_BADGE_CLASSES } from '../../_lib/contract-erection-dashboard-helpers';

interface Props {
  attention: ErectionAttentionStatus;
}

export function ErectionAttentionBadge({ attention }: Props): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${ERECTION_ATTENTION_BADGE_CLASSES[attention]}`}>
      {ERECTION_ATTENTION_LABELS[attention]}
    </span>
  );
}
