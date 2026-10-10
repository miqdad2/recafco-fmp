import type { ContractScheduleStageRow } from '@/lib/contracts-api';
import { STAGE_KEY_LABELS } from './contract-schedule-detail-helpers';

/**
 * FMP-CONTRACT-10 — pure form logic for the Create/Edit Planned Schedule
 * modal. The payload shape sent to PATCH :id/schedule/planned is unchanged
 * (responsibleTeam stays a plain string); only how it is entered changed.
 * Actual dates are never part of this form.
 */

export const RESPONSIBLE_TEAM_OPTIONS = [
  'Contract Management',
  'Technical',
  'Production',
  'Storage Yard & Delivery',
  'Erection',
  'Finance',
  'Quality Control',
] as const;

export const TEAM_OTHER = 'Other';

export interface TeamSelection {
  /** One of RESPONSIBLE_TEAM_OPTIONS, 'Other', or '' (not set). */
  team: string;
  otherName: string;
}

/** Maps a saved free-text team onto the dropdown; anything unknown becomes Other with the text prefilled. */
export function teamSelectionFrom(saved: string | null | undefined): TeamSelection {
  const text = (saved ?? '').trim();
  if (text === '') return { team: '', otherName: '' };
  const match = RESPONSIBLE_TEAM_OPTIONS.find((o) => o.toLowerCase() === text.toLowerCase());
  if (match) return { team: match, otherName: '' };
  if (text.toLowerCase() === TEAM_OTHER.toLowerCase()) return { team: TEAM_OTHER, otherName: '' };
  return { team: TEAM_OTHER, otherName: text };
}

/** The single string stored as `responsibleTeam`. */
export function teamValueOf(sel: TeamSelection): string {
  if (sel.team === TEAM_OTHER) return sel.otherName.trim() || TEAM_OTHER;
  return sel.team;
}

export interface PlanRowDraft {
  stageKey: ContractScheduleStageRow['stageKey'];
  stageName: string;
  team: string;
  otherName: string;
  plannedStartDate: string;
  plannedEndDate: string;
  plannedQuantity: string;
  plannedMolds: string;
  remarks: string;
}

/** Only Casting / Production has Planned Qty and Planned Molds. */
export function showsProductionDetails(stageKey: string): boolean {
  return stageKey === 'CASTING_PRODUCTION';
}

export function planDraftFromStage(stage: ContractScheduleStageRow): PlanRowDraft {
  const sel = teamSelectionFrom(stage.responsibleTeam);
  return {
    stageKey: stage.stageKey,
    stageName: stage.stageName || STAGE_KEY_LABELS[stage.stageKey],
    team: sel.team,
    otherName: sel.otherName,
    plannedStartDate: stage.plannedStartDate ?? '',
    plannedEndDate: stage.plannedEndDate ?? '',
    plannedQuantity: stage.plannedQuantity !== null && stage.plannedQuantity !== undefined ? String(stage.plannedQuantity) : '',
    plannedMolds: stage.plannedMolds !== null && stage.plannedMolds !== undefined ? String(stage.plannedMolds) : '',
    remarks: stage.remarks ?? '',
  };
}

export interface PlanRowError {
  stageKey: string;
  message: string;
}

/** Friendly per-stage validation (stage name first so the row is easy to find). */
export function validatePlanDrafts(drafts: readonly PlanRowDraft[]): PlanRowError[] {
  const errors: PlanRowError[] = [];
  for (const d of drafts) {
    const label = STAGE_KEY_LABELS[d.stageKey];
    if (d.plannedStartDate && d.plannedEndDate && d.plannedEndDate < d.plannedStartDate) {
      errors.push({ stageKey: d.stageKey, message: `${label}: Planned End cannot be before Planned Start.` });
    }
    if (showsProductionDetails(d.stageKey)) {
      const qty = d.plannedQuantity.trim();
      if (qty !== '' && !(Number.isFinite(Number(qty)) && Number(qty) > 0)) {
        errors.push({ stageKey: d.stageKey, message: `${label}: Planned Qty must be a positive number.` });
      }
      const molds = d.plannedMolds.trim();
      if (molds !== '' && !(Number.isInteger(Number(molds)) && Number(molds) > 0)) {
        errors.push({ stageKey: d.stageKey, message: `${label}: Planned Molds must be a positive whole number.` });
      }
    }
  }
  return errors;
}

/** Payload for updateContractSchedulePlanAction — same fields as before; production-only fields only for Casting / Production. */
export interface PlanStagePayload {
  stageKey: string;
  stageName?: string | undefined;
  responsibleTeam?: string | undefined;
  plannedStartDate?: string | undefined;
  plannedEndDate?: string | undefined;
  plannedQuantity?: number | undefined;
  plannedMolds?: number | undefined;
  remarks?: string | undefined;
}

export function planPayloadFromDrafts(drafts: readonly PlanRowDraft[]): PlanStagePayload[] {
  return drafts.map((d) => {
    const production = showsProductionDetails(d.stageKey);
    const team = teamValueOf({ team: d.team, otherName: d.otherName });
    return {
      stageKey: d.stageKey,
      stageName: d.stageName.trim() || undefined,
      responsibleTeam: team || undefined,
      plannedStartDate: d.plannedStartDate || undefined,
      plannedEndDate: d.plannedEndDate || undefined,
      plannedQuantity: production && d.plannedQuantity.trim() ? Number(d.plannedQuantity) : undefined,
      plannedMolds: production && d.plannedMolds.trim() ? Number(d.plannedMolds) : undefined,
      remarks: d.remarks.trim() || undefined,
    };
  });
}

export const PLAN_HELPER_TEXT = 'Enter planned dates for each stage. Actual dates will update automatically from system activity.';

export const SCHEDULE_EMPTY_TITLE = 'No planned schedule has been added yet.';
export const SCHEDULE_EMPTY_BODY =
  'Create this contract’s planned timeline for Contract Sign, Advance Payment, Drawing Approval, Production, Delivery, Erection and Closeout.';
export const SCHEDULE_EMPTY_NOTE = 'Actual dates will appear automatically from system activity.';
