import { computeDisciplineProgress } from '../_lib/dashboard-insights-helpers';
import type { TeamWorkflowOverview } from '@/lib/contracts-api';

interface Props {
  overview: TeamWorkflowOverview[];
}

// CM-54 — "Progress by Discipline" card (word "Physical" removed per the
// approved-design change request). Bars are real completed/total workflow
// task ratios per team, computed in dashboard-insights-helpers.ts — no
// month-over-month delta shown, since this system has no historical
// snapshot to compute one honestly against.
// CM-54C — visual-only polish: thicker bars, more header/row breathing
// room. Same percentages, same computeDisciplineProgress() source.
// CM-54D — header spacing tightened a notch to match the rest of the final
// tightening pass. Same percentages/source, no calculation change.
export function DisciplineProgressPanel({ overview }: Props): React.JSX.Element {
  const rows = computeDisciplineProgress(overview);

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-primary mb-4">Progress by Discipline</h2>
      <div className="space-y-3.5">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={row.key === 'OVERALL' ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary'}>{row.label}</span>
              <span className="font-semibold text-text-primary tabular-nums">{row.percent}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-surface-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${row.key === 'OVERALL' ? 'bg-warning' : 'bg-info'}`}
                style={{ width: `${row.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
