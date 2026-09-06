import { describe, it, expect } from 'vitest';
import {
  computeCurrentStage,
  computeBlockingTeam,
  computeNextMilestone,
  computeGlobalScheduleStatus,
  computeOverviewRow,
  computeOverviewSummary,
  type ScheduleOverviewRow,
} from './contract-schedule-overview.service';
import type { ScheduleStageRow, ScheduleStageKey } from './contract-schedule-plan.service';

function stage(overrides: Partial<ScheduleStageRow> = {}): ScheduleStageRow {
  return {
    stageKey: 'CONTRACT_SIGN',
    stageName: 'Contract Sign',
    responsibleTeam: null,
    plannedStartDate: null,
    plannedEndDate: null,
    plannedQuantity: null,
    plannedMolds: null,
    remarks: null,
    isRequired: true,
    actualStartDate: null,
    actualEndDate: null,
    producedQuantity: null,
    moldsProduced: null,
    source: 'Not available',
    status: 'NOT_PLANNED',
    delayDays: null,
    ...overrides,
  };
}

function withStages(overrides: Record<string, Partial<ScheduleStageRow>>): ScheduleStageRow[] {
  const base: ScheduleStageKey[] = ['CONTRACT_SIGN', 'ADVANCE_PAYMENT', 'DRAWING_APPROVAL', 'ESTIMATION_SHEET', 'CASTING_PRODUCTION', 'DELIVERY', 'ERECTION', 'FINAL_CLOSEOUT'];
  return base.map((stageKey) => stage({ stageKey, stageName: stageKey, ...(overrides[stageKey] ?? {}) }));
}

describe('computeCurrentStage', () => {
  it('is "Not Planned" when nothing has a real planned date', () => {
    const result = computeCurrentStage(withStages({}));
    expect(result.row).toBeNull();
    expect(result.label).toBe('Not Planned');
  });

  it('is the first planned stage (in real fixed order) that has no real actual end', () => {
    const stages = withStages({
      CONTRACT_SIGN: { plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-05', actualEndDate: '2026-01-05', status: 'COMPLETED' },
      ADVANCE_PAYMENT: { plannedStartDate: '2026-01-06', plannedEndDate: '2026-01-10', actualEndDate: null, status: 'NOT_STARTED' },
      DRAWING_APPROVAL: { plannedStartDate: '2026-01-11', plannedEndDate: '2026-01-20', actualEndDate: null, status: 'NOT_STARTED' },
    });
    const result = computeCurrentStage(stages);
    expect(result.row?.stageKey).toBe('ADVANCE_PAYMENT');
    expect(result.label).toBe('ADVANCE_PAYMENT');
  });

  it('is "Completed" once every real planned stage has a real actual end', () => {
    const stages = withStages({
      CONTRACT_SIGN: { plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-05', actualEndDate: '2026-01-05', status: 'COMPLETED' },
      ADVANCE_PAYMENT: { plannedStartDate: '2026-01-06', plannedEndDate: '2026-01-10', actualEndDate: '2026-01-10', status: 'COMPLETED' },
    });
    const result = computeCurrentStage(stages);
    expect(result.row).toBeNull();
    expect(result.label).toBe('Completed');
  });
});

describe('computeBlockingTeam', () => {
  it('is "—" when there is no current/blocking stage', () => {
    expect(computeBlockingTeam(null)).toBe('—');
  });

  it('uses the real responsibleTeam when one is entered', () => {
    expect(computeBlockingTeam(stage({ stageKey: 'CASTING_PRODUCTION', responsibleTeam: 'Night Shift Production' }))).toBe('Night Shift Production');
  });

  it('falls back to a safe stage-based inference only for stages with a real team mapping', () => {
    expect(computeBlockingTeam(stage({ stageKey: 'DRAWING_APPROVAL', responsibleTeam: null }))).toBe('Technical');
    expect(computeBlockingTeam(stage({ stageKey: 'CASTING_PRODUCTION', responsibleTeam: null }))).toBe('Production');
    expect(computeBlockingTeam(stage({ stageKey: 'DELIVERY', responsibleTeam: null }))).toBe('Delivery / Erection');
    expect(computeBlockingTeam(stage({ stageKey: 'ERECTION', responsibleTeam: null }))).toBe('Delivery / Erection');
  });

  it('is "—" for stages with no safe team mapping and no real responsibleTeam', () => {
    expect(computeBlockingTeam(stage({ stageKey: 'CONTRACT_SIGN', responsibleTeam: null }))).toBe('—');
    expect(computeBlockingTeam(stage({ stageKey: 'ADVANCE_PAYMENT', responsibleTeam: null }))).toBe('—');
    expect(computeBlockingTeam(stage({ stageKey: 'ESTIMATION_SHEET', responsibleTeam: null }))).toBe('—');
    expect(computeBlockingTeam(stage({ stageKey: 'FINAL_CLOSEOUT', responsibleTeam: null }))).toBe('—');
  });
});

describe('computeNextMilestone', () => {
  const today = '2026-06-01';

  it('is "—" when nothing real is upcoming', () => {
    expect(computeNextMilestone(withStages({}), today)).toEqual({ label: '—', date: null });
  });

  it('picks the nearest real upcoming planned date among not-yet-completed stages', () => {
    const stages = withStages({
      DRAWING_APPROVAL: { plannedEndDate: '2026-07-01', actualEndDate: null },
      CASTING_PRODUCTION: { plannedEndDate: '2026-06-15', actualEndDate: null },
    });
    const result = computeNextMilestone(stages, today);
    expect(result.date).toBe('2026-06-15');
    expect(result.label).toBe('CASTING_PRODUCTION');
  });

  it('ignores stages that already have a real actual end (already done)', () => {
    const stages = withStages({
      DRAWING_APPROVAL: { plannedEndDate: '2026-06-05', actualEndDate: '2026-06-04', status: 'COMPLETED' },
      DELIVERY: { plannedEndDate: '2026-06-20', actualEndDate: null },
    });
    const result = computeNextMilestone(stages, today);
    expect(result.date).toBe('2026-06-20');
  });

  it('ignores planned dates that are already in the past', () => {
    const stages = withStages({
      DRAWING_APPROVAL: { plannedEndDate: '2026-05-01', actualEndDate: null },
    });
    expect(computeNextMilestone(stages, today)).toEqual({ label: '—', date: null });
  });
});

describe('computeGlobalScheduleStatus', () => {
  const today = '2026-06-01';

  it('is "Completed" once the real contract status is CLOSED, regardless of stages', () => {
    expect(computeGlobalScheduleStatus({ contractStatus: 'CLOSED', stages: withStages({}), nextMilestoneDate: null, today })).toBe('Completed');
  });

  it('is "Not Planned" when no real planned schedule exists', () => {
    expect(computeGlobalScheduleStatus({ contractStatus: 'ACTIVE', stages: withStages({}), nextMilestoneDate: null, today })).toBe('Not Planned');
  });

  it('is "Delayed" when any real planned stage is delayed', () => {
    const stages = withStages({ ADVANCE_PAYMENT: { plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-05', status: 'DELAYED', delayDays: 10 } });
    expect(computeGlobalScheduleStatus({ contractStatus: 'ACTIVE', stages, nextMilestoneDate: null, today })).toBe('Delayed');
  });

  it('is "Completed" when every real planned stage has a real actual end (contract not yet formally closed)', () => {
    const stages = withStages({ CONTRACT_SIGN: { plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-05', actualEndDate: '2026-01-05', status: 'COMPLETED' } });
    expect(computeGlobalScheduleStatus({ contractStatus: 'ACTIVE', stages, nextMilestoneDate: null, today })).toBe('Completed');
  });

  it('is "Attention" when a real next milestone is due within 7 days and nothing is delayed/completed', () => {
    const stages = withStages({ DRAWING_APPROVAL: { plannedStartDate: '2026-05-01', plannedEndDate: '2026-06-05', status: 'ON_TRACK' } });
    expect(computeGlobalScheduleStatus({ contractStatus: 'ACTIVE', stages, nextMilestoneDate: '2026-06-05', today })).toBe('Attention');
  });

  it('is "On Track" when planned, nothing delayed/completed, and nothing due within 7 days', () => {
    const stages = withStages({ DRAWING_APPROVAL: { plannedStartDate: '2026-05-01', plannedEndDate: '2026-08-01', status: 'ON_TRACK' } });
    expect(computeGlobalScheduleStatus({ contractStatus: 'ACTIVE', stages, nextMilestoneDate: '2026-08-01', today })).toBe('On Track');
  });
});

describe('computeOverviewRow', () => {
  it('builds a real, honest row for a contract with no planned schedule', () => {
    const row = computeOverviewRow({
      contract: { id: 'c1', referenceNumber: 'REF-001', jobOrder: 'JO-1', title: 'Warehouse Project', counterpartyName: 'Acme Co', status: 'ACTIVE' },
      stages: withStages({}),
      today: '2026-06-01',
    });
    expect(row.scheduleStatus).toBe('Not Planned');
    expect(row.currentStage).toBe('Not Planned');
    expect(row.plannedFinishDate).toBeNull();
    expect(row.blockingTeam).toBe('—');
    expect(row.blockingStage).toBe('No blocker');
    expect(row.openBlockerCount).toBe(0);
    expect(row.actionUrl).toBe('/contracts/c1/schedule');
  });

  it('builds a real row reflecting a delayed stage, with the correct blocking team/stage/count', () => {
    const stages = withStages({
      CASTING_PRODUCTION: { plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-10', status: 'DELAYED', delayDays: 20, responsibleTeam: null },
    });
    const row = computeOverviewRow({
      contract: { id: 'c2', referenceNumber: 'REF-002', jobOrder: null, title: 'Bridge Project', counterpartyName: 'Beta Co', status: 'ACTIVE' },
      stages,
      today: '2026-06-01',
    });
    expect(row.scheduleStatus).toBe('Delayed');
    expect(row.blockingStage).toBe('CASTING_PRODUCTION');
    expect(row.blockingTeam).toBe('Production');
    expect(row.openBlockerCount).toBe(1);
  });
});

describe('computeOverviewSummary', () => {
  const today = '2026-06-15';

  function row(overrides: Partial<ScheduleOverviewRow> = {}): ScheduleOverviewRow {
    return {
      contractId: 'c1',
      contractNumber: 'REF-1',
      jobOrderNumber: null,
      projectName: 'P',
      clientName: 'C',
      contractStatus: 'ACTIVE',
      scheduleStatus: 'On Track',
      currentStage: 'X',
      plannedFinishDate: null,
      actualOrForecastFinishDate: null,
      delayDays: null,
      blockingTeam: '—',
      blockingStage: 'No blocker',
      openBlockerCount: 0,
      nextMilestone: '—',
      nextMilestoneDate: null,
      completedStages: 0,
      totalStages: 0,
      actionUrl: '/contracts/c1/schedule',
      ...overrides,
    };
  }

  it('counts real statuses honestly', () => {
    const rows = [
      row({ scheduleStatus: 'On Track' }),
      row({ scheduleStatus: 'Delayed' }),
      row({ scheduleStatus: 'Not Planned' }),
    ];
    const summary = computeOverviewSummary(rows, today);
    expect(summary.onTrack).toBe(1);
    expect(summary.delayed).toBe(1);
    expect(summary.notPlanned).toBe(1);
  });

  it('counts Total Active Contracts as real contractStatus === ACTIVE only', () => {
    const rows = [row({ contractStatus: 'ACTIVE' }), row({ contractStatus: 'DRAFT' }), row({ contractStatus: 'CLOSED' })];
    expect(computeOverviewSummary(rows, today).totalActiveContracts).toBe(1);
  });

  it('counts Due This Week from real nextMilestoneDate within 7 real days', () => {
    const rows = [row({ nextMilestoneDate: '2026-06-20' }), row({ nextMilestoneDate: '2026-07-01' }), row({ nextMilestoneDate: null })];
    expect(computeOverviewSummary(rows, today).dueThisWeek).toBe(1);
  });

  it('counts Completed This Month from real closed contracts whose actual finish falls in the current real month', () => {
    const rows = [
      row({ contractStatus: 'CLOSED', actualOrForecastFinishDate: '2026-06-10' }),
      row({ contractStatus: 'CLOSED', actualOrForecastFinishDate: '2026-05-10' }),
      row({ contractStatus: 'ACTIVE', actualOrForecastFinishDate: '2026-06-10' }),
    ];
    expect(computeOverviewSummary(rows, today).completedThisMonth).toBe(1);
  });
});
