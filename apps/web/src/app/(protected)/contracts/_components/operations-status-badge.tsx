import type { MonitoringState } from '@/lib/operations-api';
import { STATE_LABELS, STATE_TONES, TONE_CLASSES } from '../_lib/operations-progress-helpers';

/**
 * FMP-OPS-02 — the operational connection state of a contract, in words (never colour alone). It is deliberately
 * separate from the commercial contract status badge, which it never replaces or changes.
 */
export function OperationsStatusBadge({ state, className = '' }: { state: MonitoringState; className?: string }): React.JSX.Element {
  return (
    <span
      data-operations-state={state}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[STATE_TONES[state]]} ${className}`}
    >
      {STATE_LABELS[state]}
    </span>
  );
}
