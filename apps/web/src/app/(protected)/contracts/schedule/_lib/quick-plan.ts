import type { ContractScheduleOverviewRow, ContractScheduleStageKey } from '@/lib/contracts-api';
import { STAGE_KEY_LABELS } from '../../_lib/contract-schedule-detail-helpers';
import {
  RESPONSIBLE_TEAM_OPTIONS,
  TEAM_OTHER,
  planPayloadFromDrafts,
  showsProductionDetails,
  teamSelectionFrom,
  type PlanStagePayload,
} from '../../_lib/contract-schedule-plan-form';
import type { CalendarItem } from './advanced-planning-helpers';

// ---------------------------------------------------------------------------
// FMP-PLANNING-05 — Quick Plan Activity. Pure form logic only: it builds the
// SAME single-stage payload the Contract Detail > Schedule modal sends
// (updateContractSchedulePlanAction -> PATCH :id/schedule/planned), so there
// is no calendar-only record. Actual dates are never part of this form.
// ---------------------------------------------------------------------------

export const QUICK_PLAN_STAGES = (Object.keys(STAGE_KEY_LABELS) as ContractScheduleStageKey[]).map((key) => ({ key, label: STAGE_KEY_LABELS[key] }));

export const QUICK_PLAN_TEAMS = [...RESPONSIBLE_TEAM_OPTIONS, TEAM_OTHER] as const;

export interface QuickPlanForm {
  contractId: string;
  stageKey: ContractScheduleStageKey | '';
  team: string;
  otherName: string;
  plannedStartDate: string;
  plannedEndDate: string;
  plannedQuantity: string;
  plannedMolds: string;
  remarks: string;
  /** Existing saved stage name, kept so an update never renames a custom stage. */
  stageName: string;
}

export function emptyQuickPlanForm(date: string): QuickPlanForm {
  return { contractId: '', stageKey: '', team: '', otherName: '', plannedStartDate: date, plannedEndDate: '', plannedQuantity: '', plannedMolds: '', remarks: '', stageName: '' };
}

/** Prefill for "Edit Plan" from an existing calendar item. */
export function quickPlanFormFromItem(item: CalendarItem): QuickPlanForm {
  const sel = teamSelectionFrom(item.responsibleTeamRaw);
  return {
    contractId: item.contractId,
    stageKey: item.stageKey,
    team: sel.team,
    otherName: sel.otherName,
    plannedStartDate: item.plannedStartDate ?? '',
    plannedEndDate: item.plannedEndDate ?? '',
    plannedQuantity: item.plannedQuantity != null ? String(item.plannedQuantity) : '',
    plannedMolds: item.plannedMolds != null ? String(item.plannedMolds) : '',
    remarks: item.remarks ?? '',
    stageName: item.stageName,
  };
}

/** "Job Order — Project Name — Client". Only contracts present in the (already scope-filtered) overview are offered. */
export function contractOptionLabel(row: Pick<ContractScheduleOverviewRow, 'jobOrderNumber' | 'contractNumber' | 'projectName' | 'clientName'>): string {
  return `${row.jobOrderNumber || row.contractNumber} — ${row.projectName} — ${row.clientName}`;
}

export function contractOptions(rows: ContractScheduleOverviewRow[], query: string): { id: string; label: string }[] {
  const q = query.trim().toLowerCase();
  return rows
    .map((r) => ({ id: r.contractId, label: contractOptionLabel(r), hay: `${r.contractNumber} ${r.jobOrderNumber ?? ''} ${r.projectName} ${r.clientName}`.toLowerCase() }))
    .filter((o) => !q || o.hay.includes(q))
    .map(({ id, label }) => ({ id, label }));
}

/** The already-planned stage (with a planned date) for this contract, if any — drives the overwrite confirmation. */
export function findExistingPlannedStage(rows: ContractScheduleOverviewRow[], contractId: string, stageKey: string) {
  const row = rows.find((r) => r.contractId === contractId);
  const stage = row?.calendarStages?.find((s) => s.stageKey === stageKey);
  return stage && (stage.plannedStartDate || stage.plannedEndDate) ? stage : undefined;
}

export interface QuickPlanErrors {
  contractId?: string;
  stageKey?: string;
  team?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  plannedQuantity?: string;
  plannedMolds?: string;
}

export function validateQuickPlan(f: QuickPlanForm): QuickPlanErrors {
  const e: QuickPlanErrors = {};
  if (!f.contractId) e.contractId = 'Contract / Project is required.';
  if (!f.stageKey) e.stageKey = 'Activity / Stage is required.';
  if (!f.team) e.team = 'Responsible Team is required.';
  if (!f.plannedStartDate) e.plannedStartDate = 'Planned Start is required.';
  if (f.plannedStartDate && f.plannedEndDate && f.plannedEndDate < f.plannedStartDate) e.plannedEndDate = 'Planned End cannot be before Planned Start.';
  if (f.stageKey && showsProductionDetails(f.stageKey)) {
    const qty = f.plannedQuantity.trim();
    if (qty !== '' && !(Number.isFinite(Number(qty)) && Number(qty) > 0)) e.plannedQuantity = 'Planned Qty must be a positive number.';
    const molds = f.plannedMolds.trim();
    if (molds !== '' && !(Number.isInteger(Number(molds)) && Number(molds) > 0)) e.plannedMolds = 'Planned Molds must be a positive whole number.';
  }
  return e;
}

export function hasQuickPlanErrors(e: QuickPlanErrors): boolean {
  return Object.keys(e).length > 0;
}

/** Exactly one stage — other stages of the contract are never sent, so they are never overwritten. */
export function quickPlanPayload(f: QuickPlanForm): PlanStagePayload[] {
  const stageKey = f.stageKey as ContractScheduleStageKey;
  return planPayloadFromDrafts([
    {
      stageKey,
      stageName: f.stageName || STAGE_KEY_LABELS[stageKey],
      team: f.team,
      otherName: f.otherName,
      plannedStartDate: f.plannedStartDate,
      plannedEndDate: f.plannedEndDate,
      plannedQuantity: f.plannedQuantity,
      plannedMolds: f.plannedMolds,
      remarks: f.remarks,
    },
  ]);
}


/** Friday is the normal weekly off day. */
export function isFriday(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).getUTCDay() === 5;
}

/** True when Planned Start or Planned End falls on a Friday — a warning, never a validation error. */
export function hasFridayDate(f: Pick<QuickPlanForm, 'plannedStartDate' | 'plannedEndDate'>): boolean {
  return isFriday(f.plannedStartDate) || isFriday(f.plannedEndDate);
}

export const FRIDAY_WARNING = 'This date is Friday, which is normally an off day. You can still plan this activity if required.';
export const FRIDAY_CONFIRM = 'This activity is planned on Friday, which is normally an off day. Do you want to continue?';
