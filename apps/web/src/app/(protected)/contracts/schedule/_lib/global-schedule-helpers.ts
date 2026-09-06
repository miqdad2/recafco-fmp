import type { ContractScheduleOverviewRow, ContractScheduleOverviewStatus } from '@/lib/contracts-api';

// ---------------------------------------------------------------------------
// CM-68B — Global Contract Schedule Overview. Pure, dependency-free display
// + client-side filter helpers (matching the ../../_lib/root-dashboard-helpers.ts
// pattern). All status/delay/team/milestone VALUES are real, computed
// server-side (contract-schedule-overview.service.ts) — these helpers only
// format/filter what's already there, never recompute or invent anything.
// ---------------------------------------------------------------------------

export const SCHEDULE_STATUS_LABELS: Record<ContractScheduleOverviewStatus, string> = {
  Delayed: 'Delayed',
  'On Track': 'On Track',
  'Not Planned': 'Not Planned',
  Completed: 'Completed',
  Attention: 'Attention',
};

export const SCHEDULE_STATUS_BADGE_CLASSES: Record<ContractScheduleOverviewStatus, string> = {
  Delayed: 'bg-error-light text-error',
  'On Track': 'bg-info-light text-info',
  'Not Planned': 'bg-surface-secondary text-text-muted',
  Completed: 'bg-success-light text-success',
  Attention: 'bg-warning-light text-warning',
};

export const TEAM_FILTER_OPTIONS = ['Technical', 'Production', 'Delivery / Erection', 'Finance', 'Contract Management'] as const;
export type TeamFilterOption = (typeof TEAM_FILTER_OPTIONS)[number];

export type DueFilter = 'DUE_THIS_WEEK' | 'OVERDUE' | 'NO_PLANNED_DATE';

export function formatScheduleOverviewDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatOverviewDelayDays(delayDays: number | null): string {
  if (delayDays === null) return '—';
  if (delayDays === 0) return 'On time';
  if (delayDays > 0) return `+${delayDays}d`;
  return `${delayDays}d`;
}

export function overviewDelayDaysClassName(delayDays: number | null): string {
  if (delayDays === null) return 'text-text-muted';
  if (delayDays > 0) return 'text-error';
  if (delayDays < 0) return 'text-success';
  return 'text-text-secondary';
}

export interface OverviewFilters {
  search: string;
  status: ContractScheduleOverviewStatus | '';
  team: TeamFilterOption | '';
  due: DueFilter | '';
}

export function filterOverviewRows(rows: ContractScheduleOverviewRow[], filters: OverviewFilters, today: string): ContractScheduleOverviewRow[] {
  const q = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (q) {
      const haystack = `${row.contractNumber} ${row.projectName} ${row.clientName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filters.status && row.scheduleStatus !== filters.status) return false;

    if (filters.team && row.blockingTeam !== filters.team) return false;

    if (filters.due === 'NO_PLANNED_DATE' && row.nextMilestoneDate !== null) return false;
    if (filters.due === 'DUE_THIS_WEEK') {
      if (!row.nextMilestoneDate) return false;
      const days = Math.round((Date.parse(row.nextMilestoneDate) - Date.parse(today)) / 86_400_000);
      if (!(days >= 0 && days <= 7)) return false;
    }
    if (filters.due === 'OVERDUE') {
      if (row.delayDays === null || row.delayDays <= 0) return false;
    }

    return true;
  });
}
