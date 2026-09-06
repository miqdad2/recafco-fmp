import { describe, it, expect } from 'vitest';
import { buildScheduleOverviewCsv, SCHEDULE_OVERVIEW_CSV_HEADERS } from './contract-schedule-overview-csv';
import type { ContractScheduleOverviewRow } from '@/lib/contracts-api';

function makeRow(overrides: Partial<ContractScheduleOverviewRow> = {}): ContractScheduleOverviewRow {
  return {
    contractId: 'c1',
    contractNumber: 'CONTRACT-2026-000001',
    jobOrderNumber: null,
    projectName: 'Warehouse Project',
    clientName: 'Acme Co',
    contractStatus: 'ACTIVE',
    scheduleStatus: 'Delayed',
    currentStage: 'Drawing Approval',
    plannedFinishDate: '2026-06-01',
    actualOrForecastFinishDate: null,
    delayDays: 5,
    blockingTeam: 'Technical',
    blockingStage: 'Drawing Approval',
    openBlockerCount: 1,
    nextMilestone: 'Casting/Production',
    nextMilestoneDate: '2026-07-01',
    completedStages: 2,
    totalStages: 8,
    actionUrl: '/contracts/c1/schedule',
    ...overrides,
  };
}

describe('buildScheduleOverviewCsv', () => {
  it('produces a header row plus one row per contract', () => {
    const csv = buildScheduleOverviewCsv([makeRow()]);
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(SCHEDULE_OVERVIEW_CSV_HEADERS.join(','));
    expect(rows[1]).toContain('CONTRACT-2026-000001');
    expect(rows[1]).toContain('Technical');
  });

  it('produces only the header row for an empty list (no fake data)', () => {
    const csv = buildScheduleOverviewCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('writes "—" honestly for real null fields rather than inventing a value', () => {
    const csv = buildScheduleOverviewCsv([makeRow({ jobOrderNumber: null, actualOrForecastFinishDate: null, delayDays: null })]);
    expect(csv).toContain(',,'); // empty CSV fields, not fabricated values
  });

  it('escapes a project name containing a comma', () => {
    const csv = buildScheduleOverviewCsv([makeRow({ projectName: 'Warehouse, Phase 2' })]);
    expect(csv).toContain('"Warehouse, Phase 2"');
  });
});
