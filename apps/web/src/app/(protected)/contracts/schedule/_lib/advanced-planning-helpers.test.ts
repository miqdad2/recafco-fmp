import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContractScheduleCalendarStage, ContractScheduleOverviewRow } from '@/lib/contracts-api';
import {
  buildCalendarItems,
  buildMonthGrid,
  calendarStatus,
  filterCalendarItems,
  itemReference,
  normalizeTeam,
  shiftMonth,
  type CalendarFilters,
} from './advanced-planning-helpers';

const today = '2026-10-10';

function stage(o: Partial<ContractScheduleCalendarStage> = {}): ContractScheduleCalendarStage {
  return {
    stageKey: 'DRAWING_APPROVAL',
    stageName: 'Drawing Approval',
    responsibleTeam: 'Technical',
    plannedStartDate: '2026-10-20',
    plannedEndDate: '2026-10-25',
    actualStartDate: null,
    actualEndDate: null,
    delayDays: null,
    remarks: null,
    ...o,
  };
}

function row(o: Partial<ContractScheduleOverviewRow> = {}): ContractScheduleOverviewRow {
  return {
    contractId: 'c1',
    contractNumber: 'REF-001',
    jobOrderNumber: 'JO-0011/26',
    projectName: 'Warehouse',
    clientName: 'Acme',
    contractStatus: 'ACTIVE',
    scheduleStatus: 'On Track',
    currentStage: 'Drawing Approval',
    plannedFinishDate: null,
    actualOrForecastFinishDate: null,
    delayDays: null,
    blockingTeam: '—',
    blockingStage: 'No blocker',
    openBlockerCount: 0,
    nextMilestone: '—',
    nextMilestoneDate: null,
    completedStages: 0,
    totalStages: 8,
    actionUrl: '/contracts/c1/schedule',
    calendarStages: [stage()],
    ...o,
  };
}

const none: CalendarFilters = { search: '', team: '', status: '', month: '' };

describe('calendarStatus', () => {
  it('Completed when an actual end exists', () => {
    expect(calendarStatus(stage({ actualEndDate: '2026-10-01', plannedEndDate: '2026-09-01' }), today)).toBe('Completed');
  });
  it('Delayed when planned end is before today with no actual', () => {
    expect(calendarStatus(stage({ plannedEndDate: '2026-10-09' }), today)).toBe('Delayed');
  });
  it('Due This Week within 0–7 days', () => {
    expect(calendarStatus(stage({ plannedEndDate: '2026-10-10' }), today)).toBe('Due This Week');
    expect(calendarStatus(stage({ plannedEndDate: '2026-10-17' }), today)).toBe('Due This Week');
  });
  it('Planned otherwise', () => {
    expect(calendarStatus(stage({ plannedEndDate: '2026-10-18' }), today)).toBe('Planned');
  });
});

describe('normalizeTeam', () => {
  it('maps known teams and falls back by stage for empty/combined text', () => {
    expect(normalizeTeam('Storage Yard & Delivery', 'DELIVERY')).toBe('Storage Yard & Delivery');
    expect(normalizeTeam('Delivery / Erection', 'ERECTION')).toBe('Erection');
    expect(normalizeTeam('Delivery / Erection', 'DELIVERY')).toBe('Storage Yard & Delivery');
    expect(normalizeTeam(null, 'CASTING_PRODUCTION')).toBe('Production');
    expect(normalizeTeam('Quality Control', 'FINAL_CLOSEOUT')).toBe('Quality Control');
    expect(normalizeTeam(null, 'ESTIMATION_SHEET')).toBe('Other');
  });
});

describe('buildCalendarItems', () => {
  it('places an item on its planned start date with job order, stage and team', () => {
    const [item] = buildCalendarItems([row()], today);
    expect(item).toMatchObject({ date: '2026-10-20', stageName: 'Drawing Approval', team: 'Technical' });
    expect(itemReference(item!)).toBe('JO-0011/26');
    expect(item!.scheduleUrl).toBe('/contracts/c1/schedule');
    expect(item!.contractUrl).toBe('/contracts/c1');
  });
  it('falls back to planned end, and skips stages with no planned date', () => {
    const items = buildCalendarItems(
      [row({ calendarStages: [stage({ plannedStartDate: null, plannedEndDate: '2026-11-02' }), stage({ stageKey: 'DELIVERY', plannedStartDate: null, plannedEndDate: null })] })],
      today,
    );
    expect(items).toHaveLength(1);
    expect(items[0]!.date).toBe('2026-11-02');
  });
  it('uses the contract number when there is no job order, and tolerates rows without stages', () => {
    const items = buildCalendarItems([row({ jobOrderNumber: null }), row({ contractId: 'c2', calendarStages: [] })], today);
    expect(items).toHaveLength(1);
    expect(itemReference(items[0]!)).toBe('REF-001');
  });
});

describe('filterCalendarItems', () => {
  const items = buildCalendarItems(
    [
      row(),
      row({
        contractId: 'c2',
        contractNumber: 'REF-002',
        jobOrderNumber: null,
        clientName: 'Globex',
        calendarStages: [stage({ stageKey: 'DELIVERY', stageName: 'Delivery', responsibleTeam: 'Storage Yard & Delivery', plannedStartDate: '2026-09-02', plannedEndDate: '2026-09-03' })],
      }),
    ],
    today,
  );
  it('filters by month, team, status and search', () => {
    expect(filterCalendarItems(items, { ...none, month: '2026-10' })).toHaveLength(1);
    expect(filterCalendarItems(items, { ...none, team: 'Storage Yard & Delivery' })).toHaveLength(1);
    expect(filterCalendarItems(items, { ...none, status: 'Delayed' })).toHaveLength(1);
    expect(filterCalendarItems(items, { ...none, search: 'globex' })).toHaveLength(1);
    expect(filterCalendarItems(items, { ...none, search: 'jo-0011' })).toHaveLength(1);
    expect(filterCalendarItems(items, { ...none, team: 'Finance' })).toHaveLength(0);
  });
});

describe('month helpers', () => {
  it('shifts across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
  it('builds Sunday-first full weeks covering the month', () => {
    const weeks = buildMonthGrid('2026-10');
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]![0]!.date).toBe('2026-09-27');
    expect(weeks.flat().filter((d) => d.inMonth)).toHaveLength(31);
  });
});

describe('Advanced Planning UI wording', () => {
  const dir = join(__dirname, '..');
  const page = readFileSync(join(dir, 'page.tsx'), 'utf8');
  const panel = readFileSync(join(dir, '_components', 'advanced-planning-panel.tsx'), 'utf8');

  it('page title, subtitle and breadcrumb', () => {
    expect(page).toContain('Advanced Planning Calendar');
    expect(page).toContain('Plan upcoming contract milestones, team workload and delays across all active projects.');
    expect(page).not.toContain('Schedule Planning');
  });
  it('calendar is the default view and the list view keeps the existing table panel', () => {
    expect(panel).toContain("useState<View>('calendar')");
    expect(panel).toContain('<GlobalSchedulePanel');
    expect(panel).toContain('Calendar View');
    expect(panel).toContain('List View');
  });
  it('drawer offers Open Contract / Open Schedule and the empty state wording', () => {
    expect(panel).toContain('Open Contract');
    expect(panel).toContain('Open Schedule');
    expect(panel).toContain('No planned milestones for this month.');
  });
});

describe('FMP-PLANNING-02 helpers', () => {
  it('stageTeamLabel avoids repeating the stage as the team', async () => {
    const { stageTeamLabel } = await import('./advanced-planning-helpers');
    expect(stageTeamLabel('Erection', 'Erection')).toBe('Erection');
    expect(stageTeamLabel('Drawing Approval', 'Technical')).toBe('Drawing Approval · Technical');
    expect(stageTeamLabel('Casting / Production', 'Production')).toBe('Casting / Production');
  });

  it('upcomingMilestones: future, not completed, date order, filtered, limited', async () => {
    const { upcomingMilestones } = await import('./advanced-planning-helpers');
    const mk = (id: string, start: string, o: Partial<ContractScheduleCalendarStage> = {}) =>
      row({ contractId: id, contractNumber: id, calendarStages: [stage({ plannedStartDate: start, plannedEndDate: start, ...o })] });
    const items = buildCalendarItems(
      [mk('c3', '2026-12-01'), mk('c1', '2026-10-12'), mk('past', '2026-09-01'), mk('done', '2026-10-15', { actualEndDate: '2026-10-14' }), mk('c2', '2026-11-05', { responsibleTeam: 'Finance' })],
      today,
    );
    const f = { search: '', team: '' as const, status: '' as const };
    expect(upcomingMilestones(items, f, today).map((i) => i.contractId)).toEqual(['c1', 'c2', 'c3']);
    expect(upcomingMilestones(items, { ...f, team: 'Finance' }, today).map((i) => i.contractId)).toEqual(['c2']);
    expect(upcomingMilestones(items, f, today, 2)).toHaveLength(2);
    expect(upcomingMilestones([], f, today)).toEqual([]);
  });
});

describe('FMP-PLANNING-02 UI wording', () => {
  const dir = join(__dirname, '..');
  const panel = readFileSync(join(dir, '_components', 'advanced-planning-panel.tsx'), 'utf8');
  const crumbs = readFileSync(join(dir, '..', '..', '_lib', 'contract-workspace-breadcrumb.ts'), 'utf8');
  it('Today resets the month, upcoming + legend exist, breadcrumb renamed', () => {
    expect(panel).toContain("setMonth(today.slice(0, 7))");
    expect(panel).toContain('Upcoming Milestones');
    expect(panel).toContain('No upcoming milestones found.');
    expect(panel).toContain('Status legend');
    expect(panel).toContain('<ItemDrawer');
    expect(panel).toContain('<GlobalSchedulePanel');
    expect(crumbs).toContain("'/contracts/schedule': [\n    { label: 'Contract Management', href: '/contracts/dashboard' },\n    { label: 'Advanced Planning' },");
  });
});

describe('FMP-PLANNING-03 schedule shortcuts', () => {
  const dir = join(__dirname, '..');
  const panel = readFileSync(join(dir, '_components', 'advanced-planning-panel.tsx'), 'utf8');
  const page = readFileSync(join(dir, 'page.tsx'), 'utf8');

  it('Create Schedule for Not Planned, Edit Schedule for planned, Open Schedule without permission', async () => {
    const { scheduleActionLabel } = await import('./global-schedule-helpers');
    expect(scheduleActionLabel('Not Planned', true)).toBe('Create Schedule');
    expect(scheduleActionLabel('On Track', true)).toBe('Edit Schedule');
    expect(scheduleActionLabel('Delayed', true)).toBe('Edit Schedule');
    expect(scheduleActionLabel('Not Planned', false)).toBe('Open Schedule');
    expect(scheduleActionLabel('On Track', false)).toBe('Open Schedule');
  });
  it('uses the existing contracts.update gate, keeps filters, and leaves the drawer actions alone', () => {
    expect(page).toContain("permissions.includes('contracts.update')");
    expect(panel).toContain("canEdit && (");
    expect(panel).toContain("onClick={() => setView('list')}");
    expect(panel).toContain('Plan a Contract');
    expect(panel).toContain('initialSearch={search}');
    expect(panel).toContain('Open Contract</Link>');
    expect(panel).toContain('Open Schedule</Link>');
  });
});

describe('FMP-PLANNING-04 modernized UI', () => {
  const dir = join(__dirname, '..');
  const panel = readFileSync(join(dir, '_components', 'advanced-planning-panel.tsx'), 'utf8');
  const kpi = readFileSync(join(dir, '_components', 'global-schedule-kpi-strip.tsx'), 'utf8');
  const list = readFileSync(join(dir, '_components', 'global-schedule-panel.tsx'), 'utf8');

  it('KPI cards keep the six labels and values from the server summary, with helper text', () => {
    for (const l of ['Total Active Contracts', 'On Track', 'Delayed', 'Not Planned', 'Due This Week', 'Completed This Month']) expect(kpi).toContain(`label="${l}"`);
    for (const h of ['In planning scope', 'No delay detected', 'Needs follow-up', 'Schedule not added', 'Planned milestones due soon', 'Finished milestones']) expect(kpi).toContain(h);
    for (const f of ['totalActiveContracts', 'onTrack', 'delayed', 'notPlanned', 'dueThisWeek', 'completedThisMonth']) expect(kpi).toContain(`summary?.${f}`);
  });
  it('upcoming header shows the count; Plan a Contract stays gated; Today, toggle, drawer actions and empty states remain', () => {
    expect(panel).toContain('Upcoming Milestones ({upcoming.length})');
    expect(panel).toContain('Next planned activities');
    expect(panel).toContain('{canEdit && (');
    expect(panel).toContain('Today');
    expect(panel).toContain('Calendar View');
    expect(panel).toContain('List View');
    expect(panel).toContain('Open Contract</Link>');
    expect(panel).toContain('Open Schedule</Link>');
    expect(panel).toContain('No upcoming milestones found.');
    expect(panel).toContain('No planned milestones for this month.');
    expect(list).toContain('No schedule records found.');
  });
  it('calendar and upcoming items use the non-repeating stage/team label', () => {
    expect(panel.match(/stageTeamLabel\(item\.stageName, item\.team\)/g)!.length).toBeGreaterThanOrEqual(3);
  });
});
