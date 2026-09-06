import type { ActivitySource } from '../../../../_lib/contract-activity-helpers';

const SOURCE_BADGE_CLASSES: Record<ActivitySource, string> = {
  Overview: 'bg-info-light text-info',
  Payments: 'bg-success-light text-success',
  'Workflow & Team Tasks': 'bg-team-production-light text-team-production',
  'Variations / Change Orders': 'bg-warning-light text-warning',
  Claims: 'bg-teal-light text-teal',
  'Risk Assessment': 'bg-error-light text-error',
  'Documents & Obligations': 'bg-teal-light text-teal',
  'Issue Log': 'bg-warning-light text-warning',
  Attachments: 'bg-info-light text-info',
  Closeout: 'bg-surface-secondary text-text-secondary',
};

/** CM-66 — source (workspace tab) badge for the Activity / Audit History table. */
export function ContractActivitySourceBadge({ source }: { source: ActivitySource }): React.JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${SOURCE_BADGE_CLASSES[source]}`}>
      {source}
    </span>
  );
}
