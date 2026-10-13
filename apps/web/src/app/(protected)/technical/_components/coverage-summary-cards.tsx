import type { ElementCoverageSummary } from '@/lib/technical-api';
import { drawingReadiness } from '../_lib/drawing-file-ui';

/**
 * FMP-TECH-27/29 — Total Elements, Group Drawings Uploaded, Individual Drawings Uploaded, Waiting Final Drawing
 * and Ready to Release for the Drawing Groups step.
 */
export function CoverageSummaryCards({ summary }: { summary: ElementCoverageSummary }): React.JSX.Element {
  const cards = [
    { label: 'Total Elements', value: summary.totalElements, warn: false },
    { label: 'Group Drawings Uploaded', value: summary.coveredByGroup, warn: false },
    { label: 'Individual Drawings Uploaded', value: summary.coveredIndividually, warn: false },
    { label: 'Waiting Final Drawing', value: summary.notCovered, warn: summary.notCovered > 0 },
    { label: 'Ready to Release', value: summary.readyToRelease, warn: false },
  ];
  return (
    <dl aria-label="Final drawings" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-border bg-surface px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">{c.label}</dt>
          <dd className={`mt-1 text-2xl font-bold tabular-nums ${c.warn ? 'text-warning' : 'text-text-primary'}`}>{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * FMP-TECH-30 — one clear line about release readiness: either every element has a final drawing, or some are
 * still waiting. Nothing is shown while there are no elements.
 */
export function DrawingReadinessBanner({ summary }: { summary: Pick<ElementCoverageSummary, 'totalElements' | 'notCovered'> }): React.JSX.Element | null {
  const readiness = drawingReadiness(summary);
  if (!readiness) return null;
  return (
    <p role="status" className={`rounded-md border px-4 py-2.5 text-sm ${readiness.ready ? 'border-success bg-success-light text-success' : 'border-warning/40 bg-warning-light text-warning'}`}>
      {readiness.message}
    </p>
  );
}
