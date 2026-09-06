import { describe, it, expect } from 'vitest';
import {
  computeActualStages,
  computeStageStatus,
  computeDelayDays,
  computeScheduleSummary,
  type ComputeActualStagesInput,
  type ScheduleStageRow,
} from './contract-schedule-plan.service';

function baseActualInput(overrides: Partial<ComputeActualStagesInput> = {}): ComputeActualStagesInput {
  return {
    contract: { contractDate: null, activatedAt: null, status: 'ACTIVE', closedAt: null },
    workflowTasks: [],
    paidPayments: [],
    productionSummary: null,
    allProductionComplete: false,
    productionCompletedMaxUpdatedAt: null,
    ...overrides,
  };
}

function findStage(stages: ReturnType<typeof computeActualStages>, key: string) {
  return stages.find((s) => s.stageKey === key)!;
}

describe('computeActualStages', () => {
  it('every stage is null/"Not available" or "Not linked yet" when no real data exists', () => {
    const stages = computeActualStages(baseActualInput());
    expect(stages).toHaveLength(8);
    for (const s of stages) {
      expect(s.actualStartDate).toBeNull();
      expect(s.actualEndDate).toBeNull();
      expect(['Not available', 'Not linked yet']).toContain(s.source);
    }
  });

  it('Contract Sign prefers real contractDate over activatedAt', () => {
    const stages = computeActualStages(baseActualInput({
      contract: { contractDate: new Date('2026-01-05T00:00:00Z'), activatedAt: new Date('2026-01-10T00:00:00Z'), status: 'ACTIVE', closedAt: null },
    }));
    const sign = findStage(stages, 'CONTRACT_SIGN');
    expect(sign.actualStartDate).toBe('2026-01-05');
    expect(sign.actualEndDate).toBe('2026-01-05');
    expect(sign.source).toBe('Contract');
  });

  it('Contract Sign falls back to activatedAt when contractDate is unset', () => {
    const stages = computeActualStages(baseActualInput({
      contract: { contractDate: null, activatedAt: new Date('2026-01-10T00:00:00Z'), status: 'ACTIVE', closedAt: null },
    }));
    const sign = findStage(stages, 'CONTRACT_SIGN');
    expect(sign.actualStartDate).toBe('2026-01-10');
    expect(sign.source).toBe('Contract (activated)');
  });

  it('Advance Payment uses the first real PAID payment by paidDate, labeled honestly', () => {
    const stages = computeActualStages(baseActualInput({
      paidPayments: [
        { paidDate: new Date('2026-03-01T00:00:00Z') },
        { paidDate: new Date('2026-02-01T00:00:00Z') },
      ],
    }));
    const advance = findStage(stages, 'ADVANCE_PAYMENT');
    expect(advance.actualEndDate).toBe('2026-02-01');
    expect(advance.source).toBe('Payments (first received)');
  });

  it('Advance Payment ignores payments with no real paidDate', () => {
    const stages = computeActualStages(baseActualInput({ paidPayments: [{ paidDate: null }] }));
    expect(findStage(stages, 'ADVANCE_PAYMENT').source).toBe('Not available');
  });

  it('Drawing Approval maps to the real technical_getting_approval task only', () => {
    const stages = computeActualStages(baseActualInput({
      workflowTasks: [
        { taskKey: 'technical_getting_approval', startDate: new Date('2026-01-01T00:00:00Z'), completedDate: new Date('2026-01-10T00:00:00Z') },
        { taskKey: 'technical_fd_issuance', startDate: null, completedDate: new Date('2026-01-20T00:00:00Z') },
      ],
    }));
    const drawing = findStage(stages, 'DRAWING_APPROVAL');
    expect(drawing.actualStartDate).toBe('2026-01-01');
    expect(drawing.actualEndDate).toBe('2026-01-10');
    expect(drawing.source).toBe('Workflow (Technical)');
  });

  it('Estimation Sheet is always "Not linked yet" — no real task exists for it', () => {
    const stages = computeActualStages(baseActualInput({
      workflowTasks: [{ taskKey: 'production_mix_design_submission', startDate: null, completedDate: new Date() }],
    }));
    expect(findStage(stages, 'ESTIMATION_SHEET').source).toBe('Not linked yet');
  });

  it('Casting / Production start comes from the real production_start task completedDate', () => {
    const stages = computeActualStages(baseActualInput({
      workflowTasks: [{ taskKey: 'production_start', startDate: new Date('2026-02-01T00:00:00Z'), completedDate: new Date('2026-02-05T00:00:00Z') }],
      productionSummary: { totalQty: 100, producedQty: 40, remainingToCast: 60 },
    }));
    const casting = findStage(stages, 'CASTING_PRODUCTION');
    expect(casting.actualStartDate).toBe('2026-02-05');
    expect(casting.producedQuantity).toBe(40);
    expect(casting.moldsProduced).toBeNull();
    expect(casting.source).toBe('Production Status');
  });

  it('Casting / Production end date only appears once every real BOQ item is complete', () => {
    const notAllComplete = computeActualStages(baseActualInput({
      productionSummary: { totalQty: 100, producedQty: 100, remainingToCast: 0 },
      allProductionComplete: false,
    }));
    expect(findStage(notAllComplete, 'CASTING_PRODUCTION').actualEndDate).toBeNull();

    const allComplete = computeActualStages(baseActualInput({
      productionSummary: { totalQty: 100, producedQty: 100, remainingToCast: 0 },
      allProductionComplete: true,
      productionCompletedMaxUpdatedAt: new Date('2026-03-15T00:00:00Z'),
    }));
    expect(findStage(allComplete, 'CASTING_PRODUCTION').actualEndDate).toBe('2026-03-15');
  });

  it('Delivery maps to the real erection_delivery_start task only', () => {
    const stages = computeActualStages(baseActualInput({
      workflowTasks: [{ taskKey: 'erection_delivery_start', startDate: new Date('2026-04-01T00:00:00Z'), completedDate: new Date('2026-04-03T00:00:00Z') }],
    }));
    const delivery = findStage(stages, 'DELIVERY');
    expect(delivery.actualStartDate).toBe('2026-04-01');
    expect(delivery.actualEndDate).toBe('2026-04-03');
    expect(delivery.source).toBe('Workflow (Erection)');
  });

  it('Erection start comes from erection_start, end from the real erection_issue_checklist task', () => {
    const stages = computeActualStages(baseActualInput({
      workflowTasks: [
        { taskKey: 'erection_start', startDate: new Date('2026-05-01T00:00:00Z'), completedDate: new Date('2026-05-02T00:00:00Z') },
        { taskKey: 'erection_issue_checklist', startDate: null, completedDate: new Date('2026-05-20T00:00:00Z') },
      ],
    }));
    const erection = findStage(stages, 'ERECTION');
    expect(erection.actualStartDate).toBe('2026-05-02');
    expect(erection.actualEndDate).toBe('2026-05-20');
    expect(erection.source).toBe('Workflow (Erection)');
  });

  it('Final Closeout only shows an actual date once the contract is genuinely CLOSED', () => {
    const approvedNotClosed = computeActualStages(baseActualInput({
      contract: { contractDate: null, activatedAt: null, status: 'ACTIVE', closedAt: null },
    }));
    expect(findStage(approvedNotClosed, 'FINAL_CLOSEOUT').source).toBe('Not available');

    const closed = computeActualStages(baseActualInput({
      contract: { contractDate: null, activatedAt: null, status: 'CLOSED', closedAt: new Date('2026-06-01T00:00:00Z') },
    }));
    const finalCloseout = findStage(closed, 'FINAL_CLOSEOUT');
    expect(finalCloseout.actualEndDate).toBe('2026-06-01');
    expect(finalCloseout.source).toBe('Closeout');
  });
});

describe('computeStageStatus', () => {
  const today = '2026-06-15';

  it('is NOT_PLANNED when neither planned date is set', () => {
    expect(computeStageStatus({ plannedStartDate: null, plannedEndDate: null, actualStartDate: null, actualEndDate: null, today })).toBe('NOT_PLANNED');
  });

  it('is NOT_STARTED when planned exists (no end) but nothing real has happened yet', () => {
    expect(computeStageStatus({ plannedStartDate: '2026-07-01', plannedEndDate: null, actualStartDate: null, actualEndDate: null, today })).toBe('NOT_STARTED');
  });

  it('is ON_TRACK when a planned end exists, is not yet due, and nothing has started', () => {
    expect(computeStageStatus({ plannedStartDate: '2026-07-01', plannedEndDate: '2026-07-10', actualStartDate: null, actualEndDate: null, today })).toBe('ON_TRACK');
  });

  it('is IN_PROGRESS when actual start exists but not yet due and no actual end', () => {
    expect(computeStageStatus({ plannedStartDate: '2026-06-01', plannedEndDate: '2026-07-01', actualStartDate: '2026-06-05', actualEndDate: null, today })).toBe('IN_PROGRESS');
  });

  it('is DELAYED when today is past the planned end and still not completed', () => {
    expect(computeStageStatus({ plannedStartDate: '2026-05-01', plannedEndDate: '2026-06-01', actualStartDate: '2026-05-05', actualEndDate: null, today })).toBe('DELAYED');
    expect(computeStageStatus({ plannedStartDate: '2026-05-01', plannedEndDate: '2026-06-01', actualStartDate: null, actualEndDate: null, today })).toBe('DELAYED');
  });

  it('is COMPLETED when the actual end matches the planned end exactly', () => {
    expect(computeStageStatus({ plannedStartDate: '2026-05-01', plannedEndDate: '2026-06-01', actualStartDate: '2026-05-01', actualEndDate: '2026-06-01', today })).toBe('COMPLETED');
  });

  it('is DELAYED when completed but the actual end is after the planned end', () => {
    expect(computeStageStatus({ plannedStartDate: '2026-05-01', plannedEndDate: '2026-06-01', actualStartDate: '2026-05-01', actualEndDate: '2026-06-10', today })).toBe('DELAYED');
  });

  it('is AHEAD when completed before the planned end', () => {
    expect(computeStageStatus({ plannedStartDate: '2026-05-01', plannedEndDate: '2026-06-01', actualStartDate: '2026-05-01', actualEndDate: '2026-05-20', today })).toBe('AHEAD');
  });

  it('is COMPLETED (no delay comparison possible) when there is an actual end but no planned end', () => {
    expect(computeStageStatus({ plannedStartDate: '2026-05-01', plannedEndDate: null, actualStartDate: '2026-05-01', actualEndDate: '2026-05-20', today })).toBe('COMPLETED');
  });
});

describe('computeDelayDays', () => {
  const today = '2026-06-15';

  it('is null when there is no real planned end date', () => {
    expect(computeDelayDays({ plannedEndDate: null, actualEndDate: '2026-06-01', today })).toBeNull();
  });

  it('is null when not completed and not yet due', () => {
    expect(computeDelayDays({ plannedEndDate: '2026-07-01', actualEndDate: null, today })).toBeNull();
  });

  it('is positive when completed late', () => {
    expect(computeDelayDays({ plannedEndDate: '2026-06-01', actualEndDate: '2026-06-06', today })).toBe(5);
  });

  it('is negative when completed early', () => {
    expect(computeDelayDays({ plannedEndDate: '2026-06-10', actualEndDate: '2026-06-05', today })).toBe(-5);
  });

  it('is 0 when completed exactly on the planned end date', () => {
    expect(computeDelayDays({ plannedEndDate: '2026-06-01', actualEndDate: '2026-06-01', today })).toBe(0);
  });

  it('is positive (days overdue) when not completed and today is past the planned end', () => {
    expect(computeDelayDays({ plannedEndDate: '2026-06-01', actualEndDate: null, today: '2026-06-11' })).toBe(10);
  });
});

function stage(overrides: Partial<ScheduleStageRow> = {}): ScheduleStageRow {
  return {
    stageKey: 'CONTRACT_SIGN',
    stageName: 'Contract Sign',
    responsibleTeam: null,
    plannedStartDate: '2026-01-01',
    plannedEndDate: '2026-01-05',
    plannedQuantity: null,
    plannedMolds: null,
    remarks: null,
    isRequired: true,
    actualStartDate: null,
    actualEndDate: null,
    producedQuantity: null,
    moldsProduced: null,
    source: 'Not available',
    status: 'NOT_STARTED',
    delayDays: null,
    ...overrides,
  };
}

describe('computeScheduleSummary', () => {
  it('is "Not Planned" when there are no required stages at all', () => {
    const summary = computeScheduleSummary([stage({ isRequired: false, status: 'NOT_PLANNED', plannedStartDate: null, plannedEndDate: null })]);
    expect(summary.scheduleStatus).toBe('Not Planned');
    expect(summary.totalStages).toBe(0);
  });

  it('is "Delayed" when any required stage is delayed, even if others are completed', () => {
    const summary = computeScheduleSummary([
      stage({ stageKey: 'CONTRACT_SIGN', status: 'COMPLETED', actualEndDate: '2026-01-05' }),
      stage({ stageKey: 'ADVANCE_PAYMENT', status: 'DELAYED', delayDays: 3 }),
    ]);
    expect(summary.scheduleStatus).toBe('Delayed');
  });

  it('is "Completed" only when every required stage has a real actual end', () => {
    const summary = computeScheduleSummary([
      stage({ stageKey: 'CONTRACT_SIGN', status: 'COMPLETED', actualEndDate: '2026-01-05' }),
      stage({ stageKey: 'ADVANCE_PAYMENT', status: 'AHEAD', actualEndDate: '2026-01-10' }),
    ]);
    expect(summary.scheduleStatus).toBe('Completed');
    expect(summary.completedStages).toBe(2);
    expect(summary.pendingStages).toBe(0);
  });

  it('counts pending stages honestly (required, not yet done)', () => {
    const summary = computeScheduleSummary([
      stage({ stageKey: 'CONTRACT_SIGN', status: 'COMPLETED', actualEndDate: '2026-01-05' }),
      stage({ stageKey: 'ADVANCE_PAYMENT', status: 'NOT_STARTED' }),
      stage({ stageKey: 'DRAWING_APPROVAL', isRequired: false, status: 'NOT_PLANNED', plannedStartDate: null, plannedEndDate: null }),
    ]);
    expect(summary.totalStages).toBe(2);
    expect(summary.completedStages).toBe(1);
    expect(summary.pendingStages).toBe(1);
  });

  it('planned completion date is the real latest plannedEndDate across all stages', () => {
    const summary = computeScheduleSummary([
      stage({ stageKey: 'CONTRACT_SIGN', plannedEndDate: '2026-01-05' }),
      stage({ stageKey: 'FINAL_CLOSEOUT', plannedEndDate: '2026-12-01' }),
    ]);
    expect(summary.plannedCompletionDate).toBe('2026-12-01');
  });

  it('actual/forecast completion date is only ever the real Final Closeout actual end — never guessed', () => {
    const noClosure = computeScheduleSummary([stage({ stageKey: 'FINAL_CLOSEOUT', actualEndDate: null })]);
    expect(noClosure.actualOrForecastCompletionDate).toBeNull();

    const closed = computeScheduleSummary([stage({ stageKey: 'FINAL_CLOSEOUT', status: 'COMPLETED', actualEndDate: '2026-12-01' })]);
    expect(closed.actualOrForecastCompletionDate).toBe('2026-12-01');
  });

  it('delayDays is the worst (max) real delay across all stages, or null when none exist', () => {
    const none = computeScheduleSummary([stage({ delayDays: null })]);
    expect(none.delayDays).toBeNull();

    const worst = computeScheduleSummary([
      stage({ stageKey: 'CONTRACT_SIGN', delayDays: 2 }),
      stage({ stageKey: 'ADVANCE_PAYMENT', delayDays: 9 }),
    ]);
    expect(worst.delayDays).toBe(9);
  });
});
