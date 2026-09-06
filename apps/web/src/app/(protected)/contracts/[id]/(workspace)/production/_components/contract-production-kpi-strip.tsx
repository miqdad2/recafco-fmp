import { Package, Factory, Truck, Warehouse, Target } from 'lucide-react';
import { DashboardKpiCard } from '../../../../dashboard/_components/dashboard-kpi-card';
import type { ContractProductionSummary } from '@/lib/contracts-api';
import { computePercentOfTotal, formatQty } from '../../../../_lib/contract-production-helpers';

const RING_SIZE = 76;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function fmtPercent(value: number): string {
  return `${value.toFixed(2)}% of total`;
}

interface Props {
  summary: ContractProductionSummary;
}

/**
 * CM-59 — six KPI cards for the Contract Detail Production Status tab. All
 * values come from ContractProductionSummary (server-computed from real BOQ
 * items + production tracking rows; 0 for a contract with no BOQ items — see
 * contract-boq-production.service.ts). The 6th card is a plain inline-SVG
 * ring (no chart library), matching the pattern already used by
 * ContractOverviewProgressCard on the Overview tab — a separate component
 * measuring a different ratio (BOQ produced/total here, vs. workflow task
 * completion there), so it is not reused directly.
 * CM-59B — labels reworded to "Casted / Produced" / "Stock / Not Delivered"
 * (slash, matching this unit's approved wording) rather than the earlier
 * parenthetical form; ring card's own padding/gap brought in line with
 * DashboardKpiCard's own p-4/gap-2 (the other 5 cards) so all six read as
 * one consistent row instead of the ring card looking slightly tighter.
 * Calculations untouched.
 */
export function ContractProductionKpiStrip({ summary }: Props): React.JSX.Element {
  const producedPercent = computePercentOfTotal(summary.producedQty, summary.totalQty);
  const deliveredPercent = computePercentOfTotal(summary.deliveredQty, summary.totalQty);
  const stockPercent = computePercentOfTotal(summary.stockNotDelivered, summary.totalQty);
  const remainingPercent = computePercentOfTotal(summary.remainingToCast, summary.totalQty);
  const progressPercent = Math.round(producedPercent);
  const ringOffset = RING_CIRCUMFERENCE - (progressPercent / 100) * RING_CIRCUMFERENCE;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <DashboardKpiCard label="Total Qty" value={formatQty(summary.totalQty)} icon={Package} accent="info" subtext="All items" status="ok" />
      <DashboardKpiCard label="Casted / Produced" value={formatQty(summary.producedQty)} icon={Factory} accent="success" subtext={fmtPercent(producedPercent)} status="ok" />
      <DashboardKpiCard label="Delivered" value={formatQty(summary.deliveredQty)} icon={Truck} accent="team-production" subtext={fmtPercent(deliveredPercent)} status="ok" />
      <DashboardKpiCard label="Stock / Not Delivered" value={formatQty(summary.stockNotDelivered)} icon={Warehouse} accent="warning" subtext={fmtPercent(stockPercent)} status="ok" />
      <DashboardKpiCard label="Remaining to Cast" value={formatQty(summary.remainingToCast)} icon={Target} accent="teal" subtext={fmtPercent(remainingPercent)} status="ok" />

      <div className="bg-surface rounded-xl border border-border shadow-sm h-full flex flex-col items-center justify-center gap-2 p-4">
        <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="shrink-0">
          <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS} fill="none" strokeWidth="7" className="stroke-surface-secondary" />
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={ringOffset}
            transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
            className="stroke-teal"
          />
          <text x={RING_CENTER} y={RING_CENTER + 4} textAnchor="middle" className="fill-text-primary text-sm font-extrabold">
            {progressPercent}%
          </text>
        </svg>
        <p className="text-xs font-medium text-text-secondary text-center leading-tight">Production Progress</p>
        <p className="text-[11px] text-text-muted">Casted / Total</p>
      </div>
    </div>
  );
}
