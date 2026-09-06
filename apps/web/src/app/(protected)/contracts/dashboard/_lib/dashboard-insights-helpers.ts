// ---------------------------------------------------------------------------
// CM-54 — Pure, presentation-agnostic helpers for the approved-design
// Contract Manager Dashboard. Kept dependency-free (no React import) so they
// can be unit tested directly, matching the pattern used by
// ../../_lib/contract-ui-helpers.ts.
// ---------------------------------------------------------------------------

import { CONTRACT_CLAIM_STATUS_OPTIONS, optionLabel } from '../../_lib/contract-ui-helpers';
import type { ContractDashboardData, TeamWorkflowOverview, ClaimStatusCount } from '@/lib/contracts-api';

// ---------------------------------------------------------------------------
// KWD currency formatting — compact "M"/"K" notation for KPI cards/charts,
// matching the approved design ("KWD 125.00M"). Returns "—" for missing
// values so a loading/unavailable state never renders a fake number.
// ---------------------------------------------------------------------------

export function formatKwdCompact(value: number | undefined, withPrefix = true): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  const prefix = withPrefix ? 'KWD ' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${prefix}${(value / 1_000).toFixed(2)}K`;
  return `${prefix}${value.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Progress by Discipline — derived from the same TeamWorkflowOverview[]
// (WORKFLOW_TEAMS grouping) the Workflow Load panel already used pre-CM-54.
// No word "Physical" anywhere; no invented month-over-month delta (this
// system has no historical snapshot to compare against).
// ---------------------------------------------------------------------------

export interface DisciplineProgressRow {
  key: string;
  label: string;
  percent: number;
  completedTasks: number;
  totalTasks: number;
}

const DISCIPLINE_TEAMS: { team: TeamWorkflowOverview['team']; label: string }[] = [
  { team: 'TECHNICAL', label: 'Technical Progress' },
  { team: 'PRODUCTION', label: 'Production Progress' },
  { team: 'ERECTION', label: 'Erection Progress' },
];

function percentOf(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

/** Overall = every team's tasks (including QS_COMMERCIAL), not just the 3 named disciplines shown as bars. */
export function computeOverallProgressPercent(overview: TeamWorkflowOverview[]): number {
  const completed = overview.reduce((sum, o) => sum + o.completedTasks, 0);
  const total = overview.reduce((sum, o) => sum + o.completedTasks + o.openTasks, 0);
  return percentOf(completed, total);
}

export function computeDisciplineProgress(overview: TeamWorkflowOverview[]): DisciplineProgressRow[] {
  const rows: DisciplineProgressRow[] = DISCIPLINE_TEAMS.map(({ team, label }) => {
    const o = overview.find((t) => t.team === team);
    const completedTasks = o?.completedTasks ?? 0;
    const totalTasks = completedTasks + (o?.openTasks ?? 0);
    return { key: team, label, percent: percentOf(completedTasks, totalTasks), completedTasks, totalTasks };
  });
  const overallCompleted = overview.reduce((sum, o) => sum + o.completedTasks, 0);
  const overallTotal = overview.reduce((sum, o) => sum + o.completedTasks + o.openTasks, 0);
  rows.push({
    key: 'OVERALL', label: 'Overall Progress',
    percent: percentOf(overallCompleted, overallTotal), completedTasks: overallCompleted, totalTasks: overallTotal,
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Contracts by Status — the base dashboard's `metrics` block. totalExpiring
// and totalExpired are SUBSETS of totalActive (same ContractStatus.ACTIVE
// rows, refined by renewalNoticeDate/endDate — see
// apps/api/src/contracts/contracts.service.ts getDashboard/getSummary),
// never a separate population. Segments here are made mutually exclusive by
// subtracting them back out of totalActive, so counts/percentages sum to
// the real total instead of double-counting (a bug present in the older,
// unused ContractKpiGrid fallback component — not repeated here). Only real
// derived lifecycle statuses are shown; there is no At Risk / Delayed / On
// Hold status in this schema.
// CM-69H — CANCELLED is deliberately excluded from BOTH functions below.
// `totalContractsFromMetrics` is the "Total Working Contracts" KPI — per
// this unit's own explicit business rule ("working statuses: DRAFT, ACTIVE;
// do not include CANCELLED, CLOSED, TERMINATED"), it now counts ONLY Draft +
// Active, not the full historical count. `buildContractsByStatusSegments`
// backs the "Contracts by Status" donut, which still legitimately shows
// Terminated/Closed as real portfolio composition (a manager reasonably
// wants that context) — only Cancelled (an audit/void record, never active
// working data) is dropped from this chart, so a batch of cancelled test
// contracts can never dominate or appear as if it were real working data;
// when every other status is zero the donut's own existing empty-state
// handling (`DonutChart`: total===0) takes over automatically. Cancelled
// contracts remain fully visible for audit via Contract List's Lifecycle
// Status filter (CM-69C) and the dashboard's own small "Cancelled
// Contracts" note (contracts/dashboard/page.tsx), never hidden entirely.
// ---------------------------------------------------------------------------

export interface StatusSegment {
  key: string;
  label: string;
  count: number;
}

export function totalContractsFromMetrics(metrics: ContractDashboardData['metrics']): number {
  return metrics.totalDraft + metrics.totalActive;
}

export function buildContractsByStatusSegments(metrics: ContractDashboardData['metrics']): StatusSegment[] {
  const activeOnly = Math.max(0, metrics.totalActive - metrics.totalExpiring - metrics.totalExpired);
  return [
    { key: 'DRAFT', label: 'Draft', count: metrics.totalDraft },
    { key: 'ACTIVE', label: 'Active', count: activeOnly },
    { key: 'EXPIRING', label: 'Expiring Soon', count: metrics.totalExpiring },
    { key: 'EXPIRED', label: 'Expired', count: metrics.totalExpired },
    { key: 'TERMINATED', label: 'Terminated', count: metrics.totalTerminated },
    { key: 'CLOSED', label: 'Closed', count: metrics.totalClosed },
  ];
}

// ---------------------------------------------------------------------------
// Claims Status Overview — PARTIALLY_APPROVED is already excluded server-side
// (countClaimsByStatus in contract-dashboard.service.ts); this only maps the
// remaining real statuses to their display labels and drops zero-count rows
// so the legend never shows a status nobody's claims are currently in.
// ---------------------------------------------------------------------------

export function buildClaimsStatusSegments(counts: ClaimStatusCount[]): StatusSegment[] {
  return counts
    .filter((c) => c.count > 0)
    .map((c) => ({ key: c.status, label: optionLabel(CONTRACT_CLAIM_STATUS_OPTIONS, c.status), count: c.count }))
    .sort((a, b) => b.count - a.count);
}
