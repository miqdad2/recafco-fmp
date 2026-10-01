import { TECHNICAL_STAGE_ORDER, TECHNICAL_STAGE_LABELS } from '@/lib/technical-api';
import type { TechnicalStage } from '@/lib/technical-api';
import { stageBarClasses } from '../_lib/technical-format';

interface Props {
  stageBreakdown: Record<TechnicalStage, number>;
}

// FMP-TECH-01C, polished in FMP-TECH-05 — a compact 4-step workflow load
// indicator straight from TechnicalService.getDashboard's own per-stage
// counts (the SAME numbers the KPI cards above already show — no separate
// query, no invented distribution). Each step shows a numbered badge, the
// stage label, the count, and a share-of-total bar/percentage.
export function StageProgressOverview({ stageBreakdown }: Props): React.JSX.Element {
  const total = TECHNICAL_STAGE_ORDER.reduce((sum, s) => sum + stageBreakdown[s], 0);

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
        No active job orders across the 4 Technical stages yet.
      </div>
    );
  }

  return (
    <div className="h-full rounded-lg border border-border bg-surface p-4">
      {/* FMP-TECH-05P — total active count, so a manager doesn't have to
          mentally sum the 4 rows below to know how many job orders are
          actually mid-workflow right now. */}
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2.5">
        <span className="text-xs font-medium text-text-secondary">Total active workflows</span>
        <span className="text-sm font-bold text-text-primary">{total}</span>
      </div>
      <ol className="space-y-3">
        {TECHNICAL_STAGE_ORDER.map((stage, i) => {
          const count = stageBreakdown[stage];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={stage}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-[11px] font-semibold text-text-secondary">
                    {i + 1}
                  </span>
                  <span className="truncate text-sm font-medium text-text-primary">{TECHNICAL_STAGE_LABELS[stage]}</span>
                </div>
                <span className="shrink-0 text-xs text-text-muted">
                  <span className="font-semibold text-text-primary">{count}</span> · {pct}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-secondary">
                <div className={`h-1.5 rounded-full ${stageBarClasses(stage)}`} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
