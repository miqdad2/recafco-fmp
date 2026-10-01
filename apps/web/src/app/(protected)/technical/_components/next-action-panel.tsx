import Link from 'next/link';
import { Target, CheckCircle2 } from 'lucide-react';
import type { TechnicalDashboardData } from '@/lib/technical-api';

interface Props {
  dashboard: TechnicalDashboardData;
}

/**
 * FMP-TECH-05, reworded FMP-TECH-05P — "Next Action Focus": a single
 * manager-friendly sentence telling the viewer what to look at first,
 * derived purely from data the dashboard already fetched — no new query,
 * no invented recommendation. Priority order (the ticket's own explicit
 * list): Needs Attention, then Waiting Approval pending, then SD &
 * Calculation pending, then Drawing Received pending, then a calm empty
 * state — later stages are checked first because a job order stuck closer
 * to completion is usually the more urgent thing for a manager to look at
 * than one just starting. FD Issuance is deliberately not part of this
 * chain (it's the last stage — "N jobs are in FD Issuance" isn't an
 * actionable focus item the way the earlier stages are).
 */
export function NextActionPanel({ dashboard }: Props): React.JSX.Element {
  const { needsAttention, stageBreakdown } = dashboard;

  if (needsAttention.length > 0) {
    const top = needsAttention[0]!;
    const count = needsAttention.length;
    return (
      <div className="flex h-full flex-col justify-between rounded-lg border border-warning/40 bg-warning-light p-4">
        <div className="flex items-start gap-2.5">
          <Target className="mt-0.5 size-4.5 shrink-0 text-warning" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning">Next Action Focus</p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {count} job{count === 1 ? '' : 's'} need{count === 1 ? 's' : ''} attention. Most urgent: {top.jobOrderNo ?? top.referenceNumber} — {top.detail}
            </p>
          </div>
        </div>
        <Link href={`/technical/jobs/${top.contractId}`} className="mt-3 self-start text-xs font-semibold text-warning hover:underline">
          Open this workflow →
        </Link>
      </div>
    );
  }

  if (stageBreakdown.GETTING_APPROVAL > 0) {
    const count = stageBreakdown.GETTING_APPROVAL;
    return (
      <div className="flex h-full flex-col justify-between rounded-lg border border-info/40 bg-info-light p-4">
        <div className="flex items-start gap-2.5">
          <Target className="mt-0.5 size-4.5 shrink-0 text-info" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-info">Next Action Focus</p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {count} job order{count === 1 ? ' is' : 's are'} waiting for an approval decision.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (stageBreakdown.SD_CALCULATION_SUBMISSION > 0) {
    const count = stageBreakdown.SD_CALCULATION_SUBMISSION;
    return (
      <div className="flex h-full flex-col justify-between rounded-lg border border-info/40 bg-info-light p-4">
        <div className="flex items-start gap-2.5">
          <Target className="mt-0.5 size-4.5 shrink-0 text-info" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-info">Next Action Focus</p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {count} job order{count === 1 ? ' is' : 's are'} waiting for SD & Calculation submission.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (stageBreakdown.DRAWING_RECEIVED > 0) {
    const count = stageBreakdown.DRAWING_RECEIVED;
    return (
      <div className="flex h-full flex-col justify-between rounded-lg border border-info/40 bg-info-light p-4">
        <div className="flex items-start gap-2.5">
          <Target className="mt-0.5 size-4.5 shrink-0 text-info" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-info">Next Action Focus</p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {count} job order{count === 1 ? ' is' : 's are'} waiting for Drawing Received completion.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between rounded-lg border border-success/40 bg-success-light p-4">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-success">Next Action Focus</p>
          <p className="mt-1 text-sm font-medium text-text-primary">No urgent Technical action currently.</p>
        </div>
      </div>
    </div>
  );
}
