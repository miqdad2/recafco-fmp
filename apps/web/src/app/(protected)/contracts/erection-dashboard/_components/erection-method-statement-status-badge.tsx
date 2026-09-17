import type { ErectionMethodStatementDisplayStatus } from '@/lib/contracts-api';
import {
  ERECTION_METHOD_STATEMENT_DISPLAY_LABELS,
  ERECTION_METHOD_STATEMENT_BADGE_CLASSES,
} from '../../_lib/contract-erection-dashboard-helpers';

interface Props {
  status: ErectionMethodStatementDisplayStatus;
}

export function ErectionMethodStatementStatusBadge({ status }: Props): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${ERECTION_METHOD_STATEMENT_BADGE_CLASSES[status]}`}>
      {ERECTION_METHOD_STATEMENT_DISPLAY_LABELS[status]}
    </span>
  );
}
