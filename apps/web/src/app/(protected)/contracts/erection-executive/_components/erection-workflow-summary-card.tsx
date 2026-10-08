import Link from 'next/link';
import type { ErectionDashboardKpis } from '@/lib/contracts-api';

interface Props {
  kpis: ErectionDashboardKpis | undefined;
}

/**
 * FMP-UI-34 — "Do not remove existing old erection workflow" + "reduce it
 * from the main dashboard if it takes too much space": this unit's own
 * Option B, a small summary card instead of the full
 * `ErectionWorkflowStatusDashboard` (KPI grid + Needs Attention + Recent
 * Activity) this page used to render as its ENTIRE body. 3 real figures,
 * straight from the same `contractsApi.erectionDashboard()` data that
 * component already computed — `totalErectionContracts` ("Contracts in
 * workflow"), `delayedAttentionRequired` ("Overdue workflow items"),
 * `submittedForApproval` ("Waiting approval") — never a new query. The
 * full workflow dashboard is one click away via "Open Erection Workflow",
 * never removed, never hidden behind a permission change.
 */
export function ErectionWorkflowSummaryCard({ kpis }: Props): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Erection Workflow</h2>
      <ul className="mt-3 space-y-2">
        <li className="flex items-center justify-between gap-3 text-sm">
          <span className="text-text-secondary">Contracts in workflow</span>
          <span className="text-lg font-bold text-text-primary">{kpis?.totalErectionContracts ?? '—'}</span>
        </li>
        <li className="flex items-center justify-between gap-3 text-sm">
          <span className="text-text-secondary">Overdue workflow items</span>
          <span className={`text-lg font-bold ${(kpis?.delayedAttentionRequired ?? 0) > 0 ? 'text-error' : 'text-text-primary'}`}>
            {kpis?.delayedAttentionRequired ?? '—'}
          </span>
        </li>
        <li className="flex items-center justify-between gap-3 text-sm">
          <span className="text-text-secondary">Waiting approval</span>
          <span className="text-lg font-bold text-text-primary">{kpis?.submittedForApproval ?? '—'}</span>
        </li>
      </ul>
      <Link
        href="/contracts/erection-dashboard"
        className="mt-3 inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
      >
        Open Erection Workflow
      </Link>
    </div>
  );
}
