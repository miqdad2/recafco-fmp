import { describe, it, expect } from 'vitest';
import { formatScheduleOverviewDate, formatOverviewDelayDays, overviewDelayDaysClassName, filterOverviewRows, type OverviewFilters } from './global-schedule-helpers';
import type { ContractScheduleOverviewRow } from '@/lib/contracts-api';

function row(overrides: Partial<ContractScheduleOverviewRow> = {}): ContractScheduleOverviewRow {
  return {
    contractId: 'c1',
    contractNumber: 'REF-001',
    jobOrderNumber: null,
    projectName: 'Warehouse Project',
    clientName: 'Acme Co',
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
    totalStages: 3,
    actionUrl: '/contracts/c1/schedule',
    ...overrides,
  };
}

const baseFilters: OverviewFilters = { search: '', status: '', team: '', due: '' };

describe('formatScheduleOverviewDate / formatOverviewDelayDays / overviewDelayDaysClassName', () => {
  it('formats real dates and honestly shows "—" for null', () => {
    expect(formatScheduleOverviewDate(null)).toBe('—');
    expect(formatScheduleOverviewDate('2026-03-05')).toBe('05 Mar 2026');
  });

  it('formats delay days honestly, including the null "—" case', () => {
    expect(formatOverviewDelayDays(null)).toBe('—');
    expect(formatOverviewDelayDays(0)).toBe('On time');
    expect(formatOverviewDelayDays(5)).toBe('+5d');
    expect(formatOverviewDelayDays(-2)).toBe('-2d');
  });

  it('colors delay days by real sign only', () => {
    expect(overviewDelayDaysClassName(null)).toBe('text-text-muted');
    expect(overviewDelayDaysClassName(3)).toBe('text-error');
    expect(overviewDelayDaysClassName(-3)).toBe('text-success');
    expect(overviewDelayDaysClassName(0)).toBe('text-text-secondary');
  });
});

describe('filterOverviewRows', () => {
  const today = '2026-06-15';

  it('returns all rows when no filters are active', () => {
    const rows = [row(), row({ contractId: 'c2' })];
    expect(filterOverviewRows(rows, baseFilters, today)).toHaveLength(2);
  });

  it('searches across contract number, project name, and client name', () => {
    const rows = [row({ contractNumber: 'REF-001', projectName: 'Bridge', clientName: 'Acme' }), row({ contractId: 'c2', contractNumber: 'REF-002', projectName: 'Tower', clientName: 'Beta' })];
    expect(filterOverviewRows(rows, { ...baseFilters, search: 'bridge' }, today)).toHaveLength(1);
    expect(filterOverviewRows(rows, { ...baseFilters, search: 'beta' }, today)).toHaveLength(1);
    expect(filterOverviewRows(rows, { ...baseFilters, search: 'REF-002' }, today)).toHaveLength(1);
  });

  it('filters by real scheduleStatus', () => {
    const rows = [row({ scheduleStatus: 'Delayed' }), row({ contractId: 'c2', scheduleStatus: 'On Track' })];
    expect(filterOverviewRows(rows, { ...baseFilters, status: 'Delayed' }, today)).toHaveLength(1);
  });

  it('filters by real blockingTeam', () => {
    const rows = [row({ blockingTeam: 'Technical' }), row({ contractId: 'c2', blockingTeam: 'Production' })];
    expect(filterOverviewRows(rows, { ...baseFilters, team: 'Technical' }, today)).toHaveLength(1);
  });

  it('filters "No Planned Date" using the real nextMilestoneDate being null', () => {
    const rows = [row({ nextMilestoneDate: null }), row({ contractId: 'c2', nextMilestoneDate: '2026-07-01' })];
    expect(filterOverviewRows(rows, { ...baseFilters, due: 'NO_PLANNED_DATE' }, today)).toHaveLength(1);
  });

  it('filters "Due This Week" using the real nextMilestoneDate within 7 real days', () => {
    const rows = [
      row({ nextMilestoneDate: '2026-06-20' }),
      row({ contractId: 'c2', nextMilestoneDate: '2026-07-10' }),
      row({ contractId: 'c3', nextMilestoneDate: null }),
    ];
    expect(filterOverviewRows(rows, { ...baseFilters, due: 'DUE_THIS_WEEK' }, today)).toHaveLength(1);
  });

  it('filters "Overdue" using real positive delayDays only', () => {
    const rows = [row({ delayDays: 5 }), row({ contractId: 'c2', delayDays: -2 }), row({ contractId: 'c3', delayDays: null })];
    expect(filterOverviewRows(rows, { ...baseFilters, due: 'OVERDUE' }, today)).toHaveLength(1);
  });

  it('combines multiple real filters together', () => {
    const rows = [
      row({ scheduleStatus: 'Delayed', blockingTeam: 'Technical' }),
      row({ contractId: 'c2', scheduleStatus: 'Delayed', blockingTeam: 'Production' }),
    ];
    expect(filterOverviewRows(rows, { ...baseFilters, status: 'Delayed', team: 'Technical' }, today)).toHaveLength(1);
  });
});
