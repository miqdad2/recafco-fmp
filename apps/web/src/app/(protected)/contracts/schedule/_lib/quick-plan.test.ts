import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContractScheduleOverviewRow } from '@/lib/contracts-api';
import { buildCalendarItems } from './advanced-planning-helpers';
import {
  QUICK_PLAN_STAGES,
  QUICK_PLAN_TEAMS,
  contractOptions,
  emptyQuickPlanForm,
  FRIDAY_CONFIRM,
  FRIDAY_WARNING,
  findExistingPlannedStage,
  hasFridayDate,
  hasQuickPlanErrors,
  isFriday,
  quickPlanFormFromItem,
  quickPlanPayload,
  validateQuickPlan,
  type QuickPlanForm,
} from './quick-plan';

function row(o: Partial<ContractScheduleOverviewRow> = {}): ContractScheduleOverviewRow {
  return {
    contractId: 'c1',
    contractNumber: 'REF-001',
    jobOrderNumber: 'JO-0011/26',
    projectName: 'Warehouse',
    clientName: 'Acme',
    contractStatus: 'ACTIVE',
    scheduleStatus: 'On Track',
    currentStage: 'x',
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
    calendarStages: [
      {
        stageKey: 'CASTING_PRODUCTION',
        stageName: 'Casting / Production',
        responsibleTeam: 'Acme Precast',
        plannedStartDate: '2026-10-20',
        plannedEndDate: '2026-10-30',
        actualStartDate: null,
        actualEndDate: null,
        delayDays: null,
        plannedQuantity: 120,
        plannedMolds: 4,
        remarks: 'r',
      },
    ],
    ...o,
  };
}

const valid = (o: Partial<QuickPlanForm> = {}): QuickPlanForm => ({
  ...emptyQuickPlanForm('2026-10-14'),
  contractId: 'c1',
  stageKey: 'DELIVERY',
  team: 'Storage Yard & Delivery',
  ...o,
});

describe('Quick Plan form', () => {
  it('prefills Planned Start from the clicked date', () => {
    expect(emptyQuickPlanForm('2026-10-14').plannedStartDate).toBe('2026-10-14');
  });

  it('offers all 8 stages and the expected teams', () => {
    expect(QUICK_PLAN_STAGES.map((s) => s.label)).toEqual([
      'Contract Sign',
      'Advance Payment Received',
      'Drawing Approval',
      'Estimation Sheet',
      'Casting / Production',
      'Delivery',
      'Erection',
      'Final Closeout',
    ]);
    expect([...QUICK_PLAN_TEAMS]).toEqual([
      'Contract Management',
      'Technical',
      'Production',
      'Storage Yard & Delivery',
      'Erection',
      'Finance',
      'Quality Control',
      'Other',
    ]);
  });

  it('contract dropdown lists the accessible (given) rows as "Job Order — Project — Client" and searches them', () => {
    const rows = [row(), row({ contractId: 'c2', contractNumber: 'REF-002', jobOrderNumber: null, projectName: 'Tower', clientName: 'Globex' })];
    expect(contractOptions(rows, '')).toEqual([
      { id: 'c1', label: 'JO-0011/26 — Warehouse — Acme' },
      { id: 'c2', label: 'REF-002 — Tower — Globex' },
    ]);
    expect(contractOptions(rows, 'globex').map((o) => o.id)).toEqual(['c2']);
  });

  it('friendly validation messages', () => {
    expect(validateQuickPlan(emptyQuickPlanForm(''))).toEqual({
      contractId: 'Contract / Project is required.',
      stageKey: 'Activity / Stage is required.',
      team: 'Responsible Team is required.',
      plannedStartDate: 'Planned Start is required.',
    });
    expect(validateQuickPlan(valid({ plannedEndDate: '2026-10-01' })).plannedEndDate).toBe('Planned End cannot be before Planned Start.');
    expect(hasQuickPlanErrors(validateQuickPlan(valid()))).toBe(false);
  });

  it('production fields are only validated and sent for Casting / Production', () => {
    expect(validateQuickPlan(valid({ stageKey: 'CASTING_PRODUCTION', plannedQuantity: '-1', plannedMolds: '1.5' }))).toMatchObject({
      plannedQuantity: 'Planned Qty must be a positive number.',
      plannedMolds: 'Planned Molds must be a positive whole number.',
    });
    expect(validateQuickPlan(valid({ plannedQuantity: '-1' })).plannedQuantity).toBeUndefined();
    expect(quickPlanPayload(valid({ plannedQuantity: '5', plannedMolds: '2' }))[0]).toMatchObject({ plannedQuantity: undefined, plannedMolds: undefined });
    expect(quickPlanPayload(valid({ stageKey: 'CASTING_PRODUCTION', team: 'Production', plannedQuantity: '5', plannedMolds: '2' }))[0]).toMatchObject({
      plannedQuantity: 5,
      plannedMolds: 2,
    });
  });

  it('payload contains exactly the one selected stage (other stages are never sent)', () => {
    const payload = quickPlanPayload(valid({ plannedEndDate: '2026-10-20', remarks: ' note ' }));
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      stageKey: 'DELIVERY',
      stageName: 'Delivery',
      responsibleTeam: 'Storage Yard & Delivery',
      plannedStartDate: '2026-10-14',
      plannedEndDate: '2026-10-20',
      remarks: 'note',
    });
  });

  it('finds an existing planned stage for the conflict prompt, only with planned dates', () => {
    const rows = [row()];
    expect(findExistingPlannedStage(rows, 'c1', 'CASTING_PRODUCTION')?.plannedStartDate).toBe('2026-10-20');
    expect(findExistingPlannedStage(rows, 'c1', 'DELIVERY')).toBeUndefined();
    expect(findExistingPlannedStage(rows, 'zzz', 'CASTING_PRODUCTION')).toBeUndefined();
  });

  it('Edit Plan prefills everything, keeping a custom team as Other + name and the saved stage name', () => {
    const [item] = buildCalendarItems([row()], '2026-10-10');
    expect(quickPlanFormFromItem(item!)).toMatchObject({
      contractId: 'c1',
      stageKey: 'CASTING_PRODUCTION',
      team: 'Other',
      otherName: 'Acme Precast',
      stageName: 'Casting / Production',
      plannedStartDate: '2026-10-20',
      plannedEndDate: '2026-10-30',
      plannedQuantity: '120',
      plannedMolds: '4',
      remarks: 'r',
    });
  });
});

describe('Quick Plan wiring', () => {
  const dir = join(__dirname, '..', '_components');
  const panel = readFileSync(join(dir, 'advanced-planning-panel.tsx'), 'utf8');
  const modal = readFileSync(join(dir, 'quick-plan-modal.tsx'), 'utf8');

  it('planning entry points and the hint exist only behind canEdit (contracts.update)', () => {
    expect(panel).toContain('{canEdit && <p className="text-xs text-text-muted">Click a date to plan an activity.</p>}');
    expect(panel).toContain('onClick={canEdit ? () => openPlan(day.date) : undefined}');
    expect(panel).toContain('{...(canEdit ? { onEditPlan: openEditPlan } : {})}');
    expect(panel).toContain('Edit Plan');
    expect(panel).toContain('Activity planned successfully.');
    expect(panel).toContain('router.refresh()');
    expect(panel).toContain('<GlobalSchedulePanel');
  });

  it('modal saves through the existing schedule-plan action with the confirmation wording', () => {
    expect(modal).toContain('updateContractSchedulePlanAction(form.contractId, quickPlanPayload(form))');
    expect(modal).toContain('This activity already has a planned date. Do you want to update it?');
    expect(modal).toContain('Update Activity');
    expect(modal).toContain('showsProductionDetails(form.stageKey)');
  });
});

describe('FMP-PLANNING-06 Friday off-day handling', () => {
  const dir = join(__dirname, '..', '_components');
  const panel = readFileSync(join(dir, 'advanced-planning-panel.tsx'), 'utf8');
  const modal = readFileSync(join(dir, 'quick-plan-modal.tsx'), 'utf8');

  it('detects Fridays only (2026-10-16 is a Friday, Saturday and Thursday are not)', () => {
    expect(isFriday('2026-10-16')).toBe(true);
    expect(isFriday('2026-10-17')).toBe(false);
    expect(isFriday('2026-10-15')).toBe(false);
    expect(isFriday('')).toBe(false);
  });

  it('warns when Planned Start or Planned End is a Friday, and the warning is not a validation error', () => {
    expect(hasFridayDate({ plannedStartDate: '2026-10-16', plannedEndDate: '' })).toBe(true);
    expect(hasFridayDate({ plannedStartDate: '2026-10-14', plannedEndDate: '2026-10-16' })).toBe(true);
    expect(hasFridayDate({ plannedStartDate: '2026-10-14', plannedEndDate: '2026-10-15' })).toBe(false);
    expect(hasQuickPlanErrors(validateQuickPlan(valid({ plannedStartDate: '2026-10-16' })))).toBe(false);
    // end-before-start keeps its own message even on a Friday
    expect(validateQuickPlan(valid({ plannedStartDate: '2026-10-16', plannedEndDate: '2026-10-14' })).plannedEndDate).toBe('Planned End cannot be before Planned Start.');
    expect(FRIDAY_WARNING).toBe('This date is Friday, which is normally an off day. You can still plan this activity if required.');
    expect(FRIDAY_CONFIRM).toBe('This activity is planned on Friday, which is normally an off day. Do you want to continue?');
  });

  it('modal shows the warning from the live form dates and gates the save behind Plan Anyway / Cancel', () => {
    expect(modal).toContain('const friday = hasFridayDate(form);');
    expect(modal).toContain('{friday && (');
    expect(modal).toContain("setConfirm('friday')");
    expect(modal).toContain('Plan Anyway');
    expect(modal).toContain('if (friday && !ok.friday)');
    // the save call sits after both confirmation gates
    expect(modal.indexOf("setConfirm('friday')")).toBeLessThan(modal.indexOf('updateContractSchedulePlanAction(form.contractId'));
  });

  it('Friday column is marked; Saturday is not', () => {
    expect(panel).toContain('Friday off');
    expect(panel).toContain("isFriday(day.date) ? 'bg-warning-light/40'");
    expect(panel).not.toContain('isWeekend');
  });

  it('Plan Activity sits beside the view toggle (not in the filter toolbar), gated by canEdit', () => {
    const toolbarStart = panel.indexOf('<section className="rounded-xl border border-border bg-surface shadow-sm p-3">');
    const toolbarEnd = panel.indexOf('</section>', toolbarStart);
    const toolbar = panel.slice(toolbarStart, toolbarEnd);
    expect(toolbar).not.toContain('Plan Activity');
    for (const l of ['Search by contract', 'aria-label="Team"', 'aria-label="Status"', 'aria-label="Month"', 'Today']) expect(toolbar).toContain(l);
    const toggleIdx = panel.indexOf('aria-label="Planning view"');
    const btnIdx = panel.indexOf('Plan Activity\n        </button>');
    expect(btnIdx).toBeGreaterThan(toggleIdx);
    expect(btnIdx).toBeLessThan(toolbarStart);
    expect(panel.slice(toggleIdx, btnIdx)).toContain('{canEdit && (');
    expect(panel).not.toMatch(/Create Event|Add Event/);
  });
});
