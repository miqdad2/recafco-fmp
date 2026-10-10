import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { ContractScheduleStageRow } from '@/lib/contracts-api';
import { SCHEDULE_STAGE_KEYS, STAGE_KEY_LABELS } from './contract-schedule-detail-helpers';
import {
  RESPONSIBLE_TEAM_OPTIONS,
  SCHEDULE_EMPTY_BODY,
  SCHEDULE_EMPTY_NOTE,
  SCHEDULE_EMPTY_TITLE,
  planDraftFromStage,
  planPayloadFromDrafts,
  showsProductionDetails,
  teamSelectionFrom,
  teamValueOf,
  validatePlanDrafts,
} from './contract-schedule-plan-form';

function stage(key: ContractScheduleStageRow['stageKey'], patch: Partial<ContractScheduleStageRow> = {}): ContractScheduleStageRow {
  return {
    stageKey: key,
    stageName: STAGE_KEY_LABELS[key],
    responsibleTeam: null,
    plannedStartDate: null,
    plannedEndDate: null,
    plannedQuantity: null,
    plannedMolds: null,
    remarks: null,
    ...patch,
  } as unknown as ContractScheduleStageRow;
}

const allStages = SCHEDULE_STAGE_KEYS.map((k) => stage(k));
const drafts = () => allStages.map(planDraftFromStage);

describe('Planned schedule form (FMP-CONTRACT-10)', () => {
  it('keeps all 8 stages in the original order', () => {
    expect(drafts().map((d) => STAGE_KEY_LABELS[d.stageKey])).toEqual([
      'Contract Sign',
      'Advance Payment Received',
      'Drawing Approval',
      'Estimation Sheet',
      'Casting / Production',
      'Delivery',
      'Erection',
      'Final Closeout',
    ]);
  });

  it('Responsible Team options are the agreed dropdown list (Other is added by the modal)', () => {
    expect([...RESPONSIBLE_TEAM_OPTIONS]).toEqual([
      'Contract Management',
      'Technical',
      'Production',
      'Storage Yard & Delivery',
      'Erection',
      'Finance',
      'Quality Control',
    ]);
  });

  it('maps saved teams: known → option, unknown → Other with the name prefilled, empty → not set', () => {
    expect(teamSelectionFrom('Technical')).toEqual({ team: 'Technical', otherName: '' });
    expect(teamSelectionFrom('technical')).toEqual({ team: 'Technical', otherName: '' });
    expect(teamSelectionFrom('Technical Team')).toEqual({ team: 'Other', otherName: 'Technical Team' });
    expect(teamSelectionFrom('Other')).toEqual({ team: 'Other', otherName: '' });
    expect(teamSelectionFrom(null)).toEqual({ team: '', otherName: '' });
    expect(teamSelectionFrom('  ')).toEqual({ team: '', otherName: '' });
  });

  it('stores the custom name when Other is selected, the option otherwise', () => {
    expect(teamValueOf({ team: 'Finance', otherName: 'ignored' })).toBe('Finance');
    expect(teamValueOf({ team: 'Other', otherName: ' Client rep ' })).toBe('Client rep');
    expect(teamValueOf({ team: 'Other', otherName: '' })).toBe('Other');
    expect(teamValueOf({ team: '', otherName: '' })).toBe('');
  });

  it('only Casting / Production has Planned Qty and Planned Molds', () => {
    expect(SCHEDULE_STAGE_KEYS.filter(showsProductionDetails)).toEqual(['CASTING_PRODUCTION']);
  });

  it('Planned End before Planned Start shows the friendly message; equal or later is fine', () => {
    const d = drafts();
    d[0]!.plannedStartDate = '2026-10-10';
    d[0]!.plannedEndDate = '2026-10-01';
    expect(validatePlanDrafts(d)).toEqual([{ stageKey: 'CONTRACT_SIGN', message: 'Contract Sign: Planned End cannot be before Planned Start.' }]);
    d[0]!.plannedEndDate = '2026-10-10';
    expect(validatePlanDrafts(d)).toEqual([]);
  });

  it('dates are optional per stage (one date alone is allowed)', () => {
    const d = drafts();
    d[1]!.plannedStartDate = '2026-10-10';
    expect(validatePlanDrafts(d)).toEqual([]);
  });

  it('Planned Qty / Planned Molds must be positive when entered (molds whole)', () => {
    const d = drafts();
    const prod = d.find((x) => x.stageKey === 'CASTING_PRODUCTION')!;
    prod.plannedQuantity = '-3';
    prod.plannedMolds = '2.5';
    expect(validatePlanDrafts(d).map((e) => e.message)).toEqual([
      'Casting / Production: Planned Qty must be a positive number.',
      'Casting / Production: Planned Molds must be a positive whole number.',
    ]);
    prod.plannedQuantity = '0';
    prod.plannedMolds = '0';
    expect(validatePlanDrafts(d)).toHaveLength(2);
    prod.plannedQuantity = '1200.5';
    prod.plannedMolds = '8';
    expect(validatePlanDrafts(d)).toEqual([]);
  });

  it('existing values prefill and the save payload preserves every stage value (team, dates, production details, remarks)', () => {
    const stages = [
      stage('CONTRACT_SIGN', { responsibleTeam: 'Contract Management', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-05', remarks: 'signed copy' }),
      stage('CASTING_PRODUCTION', { responsibleTeam: 'Plant Team', plannedStartDate: '2026-11-01', plannedEndDate: '2026-12-01', plannedQuantity: 1200 as never, plannedMolds: 8 as never, remarks: 'two shifts' }),
      ...SCHEDULE_STAGE_KEYS.filter((k) => k !== 'CONTRACT_SIGN' && k !== 'CASTING_PRODUCTION').map((k) => stage(k)),
    ];
    const d = stages.map(planDraftFromStage);
    const prod = d.find((x) => x.stageKey === 'CASTING_PRODUCTION')!;
    expect(prod).toMatchObject({ team: 'Other', otherName: 'Plant Team', plannedQuantity: '1200', plannedMolds: '8', remarks: 'two shifts' });

    const payload = planPayloadFromDrafts(d);
    expect(payload).toHaveLength(8);
    expect(payload.find((p) => p.stageKey === 'CONTRACT_SIGN')).toMatchObject({
      responsibleTeam: 'Contract Management',
      plannedStartDate: '2026-10-01',
      plannedEndDate: '2026-10-05',
      remarks: 'signed copy',
    });
    expect(payload.find((p) => p.stageKey === 'CASTING_PRODUCTION')).toMatchObject({
      responsibleTeam: 'Plant Team',
      plannedQuantity: 1200,
      plannedMolds: 8,
      remarks: 'two shifts',
    });
    // Same field set as before; actual dates are never part of the payload.
    for (const item of payload) {
      expect(Object.keys(item).sort()).toEqual(
        ['plannedEndDate', 'plannedMolds', 'plannedQuantity', 'plannedStartDate', 'remarks', 'responsibleTeam', 'stageKey', 'stageName'],
      );
    }
    expect(JSON.stringify(payload)).not.toMatch(/actual/i);
  });

  it('non-production stages never send quantity / molds', () => {
    const d = drafts();
    d[0]!.plannedQuantity = '5';
    d[0]!.plannedMolds = '5';
    const first = planPayloadFromDrafts(d)[0]!;
    expect(first.plannedQuantity).toBeUndefined();
    expect(first.plannedMolds).toBeUndefined();
  });

  it('empty state wording stays clear', () => {
    expect(SCHEDULE_EMPTY_TITLE).toBe('No planned schedule has been added yet.');
    expect(SCHEDULE_EMPTY_BODY).toContain('Contract Sign, Advance Payment, Drawing Approval, Production, Delivery, Erection and Closeout');
    expect(SCHEDULE_EMPTY_NOTE).toBe('Actual dates will appear automatically from system activity.');
  });

  it('the modal is a compact table-style layout, not repeated large cards, with the dropdown + Other + sticky footer', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../[id]/(workspace)/schedule/_components/contract-schedule-edit-drawer.tsx'), 'utf8');
    expect(src).toContain('Production Details');
    expect(src).toContain('Other Team Name');
    expect(src).toContain('Save Planned Schedule');
    expect(src).toContain('Planned Start');
    expect(src).toContain('Planned End');
    expect(src).toContain('<select');
    expect(src).not.toContain('rounded-md border border-border p-3'); // the old per-stage card
    expect(src).not.toMatch(/placeholder="e\.g\. Technical Team"/); // free text team input is gone
  });
});
