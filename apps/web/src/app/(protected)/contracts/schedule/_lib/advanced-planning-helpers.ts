import type { ContractScheduleCalendarStage, ContractScheduleOverviewRow } from '@/lib/contracts-api';

// ---------------------------------------------------------------------------
// FMP-PLANNING-01 — Advanced Planning calendar. Pure, display-only helpers
// over the planned stages the schedule overview already returns. Nothing is
// recomputed or invented: planned dates, actual end dates and delay days are
// the server's real values; the calendar status below is a straight reading
// of them (completed / past planned end / within 7 days / otherwise planned).
// ---------------------------------------------------------------------------

export const CALENDAR_TEAMS = [
  'Contract Management',
  'Technical',
  'Production',
  'Storage Yard & Delivery',
  'Erection',
  'Finance',
  'Quality Control',
  'Other',
] as const;
export type CalendarTeam = (typeof CALENDAR_TEAMS)[number];

export const CALENDAR_STATUSES = ['Planned', 'Due This Week', 'Delayed', 'Completed'] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

/** Subtle, readable team accents (left border + dot). Token-based so they follow the theme. */
export const TEAM_ACCENT_CLASSES: Record<CalendarTeam, string> = {
  'Contract Management': 'border-l-accent',
  Technical: 'border-l-info',
  Production: 'border-l-warning',
  'Storage Yard & Delivery': 'border-l-success',
  Erection: 'border-l-error',
  Finance: 'border-l-text-secondary',
  'Quality Control': 'border-l-border-strong',
  Other: 'border-l-border',
};

export const CALENDAR_STATUS_BADGE_CLASSES: Record<CalendarStatus, string> = {
  Planned: 'bg-info-light text-info',
  'Due This Week': 'bg-warning-light text-warning',
  Delayed: 'bg-error-light text-error',
  Completed: 'bg-success-light text-success',
};

export interface CalendarItem {
  id: string;
  contractId: string;
  contractNumber: string;
  jobOrderNumber: string | null;
  projectName: string;
  clientName: string;
  stageName: string;
  stageKey: ContractScheduleCalendarStage['stageKey'];
  team: CalendarTeam;
  /** The responsible team exactly as saved (free text), for edit prefill. */
  responsibleTeamRaw: string | null;
  plannedQuantity: number | null;
  plannedMolds: number | null;
  /** The date the item sits on: planned start, falling back to planned end. */
  date: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualEndDate: string | null;
  delayDays: number | null;
  remarks: string | null;
  status: CalendarStatus;
  scheduleUrl: string;
  contractUrl: string;
}

/** Maps the free-text responsible team onto a calendar category; falls back to the stage where the text is ambiguous or empty. */
export function normalizeTeam(raw: string | null, stageKey: ContractScheduleCalendarStage['stageKey']): CalendarTeam {
  const t = (raw ?? '').trim().toLowerCase();
  if (t.includes('contract')) return 'Contract Management';
  if (t.includes('technical') || t.includes('engineering')) return 'Technical';
  if (t.includes('quality') || t === 'qc' || t.includes('qa')) return 'Quality Control';
  if (t.includes('finance') || t.includes('account')) return 'Finance';
  if (t.includes('storage') || (t.includes('delivery') && !t.includes('erection'))) return 'Storage Yard & Delivery';
  if (t.includes('erection') && !t.includes('delivery')) return 'Erection';
  if (t.includes('production') || t.includes('casting')) return 'Production';
  // Empty or combined ("Delivery / Erection") — decide by the stage itself, as the schedule overview does.
  if (stageKey === 'DRAWING_APPROVAL') return 'Technical';
  if (stageKey === 'CASTING_PRODUCTION') return 'Production';
  if (stageKey === 'DELIVERY') return 'Storage Yard & Delivery';
  if (stageKey === 'ERECTION') return 'Erection';
  return 'Other';
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

/** Completed > Delayed (planned end — or start — before today, nothing actual) > Due This Week (today..+7 days) > Planned. */
export function calendarStatus(stage: ContractScheduleCalendarStage, today: string): CalendarStatus {
  if (stage.actualEndDate) return 'Completed';
  const due = stage.plannedEndDate ?? stage.plannedStartDate;
  if (!due) return 'Planned';
  const days = daysBetween(today, due.slice(0, 10));
  if (days < 0) return 'Delayed';
  if (days <= 7) return 'Due This Week';
  return 'Planned';
}

/** One item per planned stage; stages with no planned date are not on the calendar (they stay in List View). */
export function buildCalendarItems(rows: ContractScheduleOverviewRow[], today: string): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const row of rows) {
    for (const stage of row.calendarStages ?? []) {
      const date = (stage.plannedStartDate ?? stage.plannedEndDate)?.slice(0, 10);
      if (!date) continue;
      items.push({
        id: `${row.contractId}:${stage.stageKey}`,
        contractId: row.contractId,
        contractNumber: row.contractNumber,
        jobOrderNumber: row.jobOrderNumber,
        projectName: row.projectName,
        clientName: row.clientName,
        stageName: stage.stageName,
        stageKey: stage.stageKey,
        team: normalizeTeam(stage.responsibleTeam, stage.stageKey),
        responsibleTeamRaw: stage.responsibleTeam,
        plannedQuantity: stage.plannedQuantity ?? null,
        plannedMolds: stage.plannedMolds ?? null,
        date,
        plannedStartDate: stage.plannedStartDate,
        plannedEndDate: stage.plannedEndDate,
        actualEndDate: stage.actualEndDate,
        delayDays: stage.delayDays,
        remarks: stage.remarks,
        status: calendarStatus(stage, today),
        scheduleUrl: row.actionUrl,
        contractUrl: `/contracts/${row.contractId}`,
      });
    }
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.contractNumber.localeCompare(b.contractNumber)));
}

/** The label shown on a calendar item: job order when there is one, otherwise the contract number. */
export function itemReference(item: Pick<CalendarItem, 'jobOrderNumber' | 'contractNumber'>): string {
  return item.jobOrderNumber || item.contractNumber;
}

export interface CalendarFilters {
  search: string;
  team: CalendarTeam | '';
  status: CalendarStatus | '';
  /** YYYY-MM */
  month: string;
}

export function filterCalendarItems(items: CalendarItem[], filters: CalendarFilters): CalendarItem[] {
  const q = filters.search.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.month && !item.date.startsWith(filters.month)) return false;
    if (filters.team && item.team !== filters.team) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (q) {
      const haystack = `${item.contractNumber} ${item.jobOrderNumber ?? ''} ${item.projectName} ${item.clientName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export interface CalendarDay {
  date: string;
  inMonth: boolean;
}

/** Weeks (Sunday-first) covering the month; leading/trailing days are flagged as outside the month. */
export function buildMonthGrid(month: string): CalendarDay[][] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const weeks: CalendarDay[][] = [];
  const cursor = new Date(start);
  do {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor.toISOString().slice(0, 10), inMonth: cursor.getUTCMonth() === m - 1 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getUTCMonth() === m - 1);
  return weeks;
}

/** "Stage · Team", or just the stage when the team name repeats it (e.g. Erection / Erection). */
export function stageTeamLabel(stageName: string, team: string): string {
  const s = stageName.trim().toLowerCase();
  const t = team.trim().toLowerCase();
  if (!t || s === t || s.includes(t) || t.includes(s)) return stageName;
  return `${stageName} · ${team}`;
}

export const UPCOMING_MILESTONE_LIMIT = 8;

/** Next not-yet-completed milestones from today onward (search/team/status filters apply, the month does not), in date order. */
export function upcomingMilestones(
  items: CalendarItem[],
  filters: Omit<CalendarFilters, 'month'>,
  today: string,
  limit: number = UPCOMING_MILESTONE_LIMIT,
): CalendarItem[] {
  return filterCalendarItems(items, { ...filters, month: '' })
    .filter((i) => i.status !== 'Completed' && i.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.contractNumber.localeCompare(b.contractNumber)))
    .slice(0, limit);
}
