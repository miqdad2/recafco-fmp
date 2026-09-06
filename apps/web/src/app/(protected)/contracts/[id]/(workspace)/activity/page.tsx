import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { computeActivitySummary } from '../../../_lib/contract-activity-helpers';
import { ContractActivityKpiStrip } from './_components/contract-activity-kpi-strip';
import { ContractActivityPanel } from './_components/contract-activity-panel';

export const metadata: Metadata = { title: 'Activity / Audit History — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * CM-66 — Contract Detail Activity / Audit History, simplified approved-
 * design build. Reuses the existing ContractActivity table (already written
 * to by contract create/update/status-change/closeout actions since an
 * earlier unit) and additively logs Payments/Documents & Obligations/
 * Variations/Claims/Risks/Issues create+update too (see
 * contract-activity-log.ts on the backend) — no new table, no migration.
 * No Contract Summary card, no "Activity by Type" donut chart, no "Top
 * Users by Activity" card, no Quick Links card, no Back to Contract/Go to
 * Closeout buttons, no IP Address column — none of those are backed by
 * real reliable data (no per-contract analytics/ranking exists anywhere in
 * this app, and IP address is not captured by the write paths this unit
 * touches), and the user is already inside the contract workspace with the
 * layout's own header providing contract context.
 *
 * Historical limitation: this unit's newly-added logging (Payments,
 * Documents & Obligations, Variations, Claims, Risks, Issues) only covers
 * actions taken FROM THIS POINT FORWARD — no history is fabricated for
 * records created before this unit shipped. A contract's Overview/Closeout
 * activity has been logged since an earlier unit and so has deeper history
 * already.
 */
export default async function ContractActivityTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const activities = await contractsApi.listActivities(id).catch(() => []);
  const summary = computeActivitySummary(activities);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Activity / Audit History</h1>
          <p className="text-xs text-text-secondary mt-0.5">Track all activities, updates and actions performed in this contract.</p>
        </div>
        <a
          href={`/contracts/${id}/activity/export`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          title="Export this contract's activity log as CSV (opens in Excel)"
        >
          <Download className="size-3.5 shrink-0" aria-hidden="true" />
          Export Excel
        </a>
      </div>

      <ContractActivityKpiStrip summary={summary} />

      <ContractActivityPanel contractId={id} activities={activities} />
    </div>
  );
}
