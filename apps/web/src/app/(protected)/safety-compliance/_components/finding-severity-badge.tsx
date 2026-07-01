import type { FindingSeverity } from '../../../../lib/safety-api';

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  LOW:      'bg-success-light text-success',
  MEDIUM:   'bg-warning-light text-warning',
  HIGH:     'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-danger-light text-danger',
};

const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  LOW:      'Low',
  MEDIUM:   'Medium',
  HIGH:     'High',
  CRITICAL: 'Critical',
};

interface Props {
  severity: FindingSeverity;
  className?: string | undefined;
}

export function FindingSeverityBadge({ severity, className = '' }: Props): React.JSX.Element {
  const style = SEVERITY_STYLES[severity] ?? 'bg-surface-secondary text-text-muted';
  const label = SEVERITY_LABELS[severity] ?? severity;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style} ${className}`}
      aria-label={`Severity: ${label}`}
    >
      {label}
    </span>
  );
}
