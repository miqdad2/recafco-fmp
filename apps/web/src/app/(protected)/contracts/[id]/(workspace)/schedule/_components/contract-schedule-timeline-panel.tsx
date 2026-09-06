import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ContractScheduleStageKey, ContractScheduleStageRow } from '@/lib/contracts-api';
import { STAGE_KEY_LABELS, formatScheduleDate, formatDelayDays, delayDaysClassName } from '../../../../_lib/contract-schedule-detail-helpers';
import { ContractScheduleStatusBadge } from './contract-schedule-status-badge';

interface Props {
  contractId: string;
  stages: ContractScheduleStageRow[];
}

const TABLE_COLUMNS = ['Stage', 'Responsible Team', 'Planned Start', 'Planned End', 'Actual Start', 'Actual End', 'Delay', 'Status', 'Source', 'Action'];

// CM-68A — each real stage's "View" action links to the real workspace tab
// its actual data is genuinely sourced from (same reasoning as the Activity/
// Blocking Items tabs' own Action columns) — Contract Sign and Estimation
// Sheet have no dedicated tab of their own, so they link to Overview.
const STAGE_ACTION_SEGMENT: Record<ContractScheduleStageKey, string> = {
  CONTRACT_SIGN: '',
  ADVANCE_PAYMENT: 'payments',
  DRAWING_APPROVAL: 'workflow',
  ESTIMATION_SHEET: '',
  CASTING_PRODUCTION: 'production',
  DELIVERY: 'workflow',
  ERECTION: 'workflow',
  FINAL_CLOSEOUT: 'closeout',
};

function formatQty(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('en-GB', { maximumFractionDigits: 3 });
}

/**
 * CM-68A — Planned vs Actual Timeline. Planned columns come from the real
 * ContractScheduleItem row for this stage (or "—" when no planned entry
 * exists yet for it); Actual/Source columns are the real, derived-only
 * values from ContractSchedulePlanService — never fabricated, "—"/"Not
 * available"/"Not linked yet" whenever no real source is safely
 * identifiable. Casting / Production shows its real planned quantity/molds
 * and real produced quantity as compact subtext under the stage name (no
 * separate columns, per this unit's own "expanded row, tooltip, or compact
 * subtext" allowance) — Molds Produced always shows "—" since no real
 * per-mold count field exists anywhere in this app.
 */
export function ContractScheduleTimelinePanel({ contractId, stages }: Props): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-4">
      <h2 className="text-sm font-semibold text-text-primary mb-3">Planned vs Actual Timeline</h2>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-240 divide-y divide-border text-xs">
          <thead className="border-b-2 border-border-strong">
            <tr className="bg-surface-secondary">
              {TABLE_COLUMNS.map((col) => (
                <th key={col} className="px-2.5 py-2 text-left font-bold uppercase tracking-wide text-text-primary whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {stages.map((stage) => (
              <tr key={stage.stageKey} className="hover:bg-surface-secondary/50 transition-colors">
                <td className="px-2.5 py-1.5 whitespace-nowrap">
                  <p className="text-text-primary font-medium">{stage.stageName || STAGE_KEY_LABELS[stage.stageKey]}</p>
                  {stage.stageKey === 'CASTING_PRODUCTION' && (
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Planned: {formatQty(stage.plannedQuantity)} / Molds {formatQty(stage.plannedMolds)} · Produced: {formatQty(stage.producedQuantity)} / Molds {formatQty(stage.moldsProduced)}
                    </p>
                  )}
                </td>
                <td className="px-2.5 py-1.5 whitespace-nowrap text-text-secondary">{stage.responsibleTeam ?? '—'}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap text-text-secondary">{formatScheduleDate(stage.plannedStartDate)}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap text-text-secondary">{formatScheduleDate(stage.plannedEndDate)}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap text-text-primary">{formatScheduleDate(stage.actualStartDate)}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap text-text-primary">{formatScheduleDate(stage.actualEndDate)}</td>
                <td className={`px-2.5 py-1.5 whitespace-nowrap font-medium ${delayDaysClassName(stage.delayDays)}`}>{formatDelayDays(stage.delayDays)}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap"><ContractScheduleStatusBadge status={stage.status} /></td>
                <td className="px-2.5 py-1.5 whitespace-nowrap text-text-muted" title={stage.source}>{stage.source}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap">
                  {STAGE_ACTION_SEGMENT[stage.stageKey] !== '' ? (
                    <Link
                      href={`/contracts/${contractId}/${STAGE_ACTION_SEGMENT[stage.stageKey]}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-text-secondary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus"
                      title={`Open ${STAGE_KEY_LABELS[stage.stageKey]} source`}
                    >
                      View
                      <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
