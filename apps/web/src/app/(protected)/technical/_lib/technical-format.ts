// FMP-TECH-01 — small, local, dependency-free formatters shared across the
// Technical module's pages/components. No new shared package — matches how
// every other module (workflow-task-card.tsx, etc.) keeps its own tiny
// date-formatting helpers local rather than centralizing them.
//
// FMP-TECH-05E — every import from '@/lib/technical-api' below is `import
// type` only, deliberately: this file is imported by several 'use client'
// form components (for the `TechnicalStageMode` type), and technical-api.ts
// itself does a module-level `import { cookies } from 'next/headers'` — a
// real (value) import of anything from it here would pull that server-only
// dependency into the client bundle and fail the build. STAGE_ORDER is
// therefore a small local copy of TECHNICAL_STAGE_ORDER rather than an
// import of it.

import type { TechnicalStage, TechnicalWorkflowStatus } from '@/lib/technical-api';

const STAGE_ORDER: TechnicalStage[] = ['DRAWING_RECEIVED', 'SD_CALCULATION_SUBMISSION', 'GETTING_APPROVAL', 'FD_ISSUANCE'];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const RECEIVED_FROM_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  CONSULTANT: 'Consultant',
  EMPLOYER: 'Employer',
  MAIN_CONTRACTOR: 'Main Contractor',
  INTERNAL: 'Internal',
};

export function receivedFromLabel(value: string | null | undefined): string {
  return value ? (RECEIVED_FROM_LABELS[value] ?? value) : '—';
}

const DRAWING_TYPE_LABELS: Record<string, string> = {
  SHOP_DRAWING: 'Shop Drawing',
  ARCHITECTURAL: 'Architectural',
  STRUCTURAL: 'Structural',
  MEP: 'MEP',
  PRECAST: 'Precast',
  COORDINATION: 'Coordination',
  AS_BUILT: 'As Built',
  OTHER: 'Other',
};

export function drawingTypeLabel(value: string | null | undefined): string {
  return value ? (DRAWING_TYPE_LABELS[value] ?? value) : '—';
}

const LINKED_STAGE_LABELS: Record<string, string> = {
  TECHNICAL_REVIEW: 'Technical Review',
  SD_CALCULATION: 'SD & Calculation',
  GETTING_APPROVAL: 'Getting Approval',
  FD_ISSUANCE: 'FD Issuance',
};

export function linkedStageLabel(value: string | null | undefined): string {
  return value ? (LINKED_STAGE_LABELS[value] ?? value) : '—';
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function priorityLabel(value: string | null | undefined): string {
  return value ? (PRIORITY_LABELS[value] ?? value) : '—';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// FMP-TECH-05 — one shared per-stage color mapping so the Dashboard's stage
// progress bars, jobs table stage badges, and Needs Attention stage badges
// all read the same 4 colors instead of drifting independently. Purely
// visual — no business meaning attached to the specific hues.
const STAGE_BADGE_CLASSES: Record<TechnicalStage, string> = {
  DRAWING_RECEIVED: 'bg-info-light text-info',
  SD_CALCULATION_SUBMISSION: 'bg-secondary-accent-light text-secondary-accent',
  GETTING_APPROVAL: 'bg-warning-light text-warning',
  FD_ISSUANCE: 'bg-module-technical-light text-module-technical',
};

export function stageBadgeClasses(stage: TechnicalStage): string {
  return STAGE_BADGE_CLASSES[stage];
}

const STAGE_BAR_CLASSES: Record<TechnicalStage, string> = {
  DRAWING_RECEIVED: 'bg-info',
  SD_CALCULATION_SUBMISSION: 'bg-secondary-accent',
  GETTING_APPROVAL: 'bg-warning',
  FD_ISSUANCE: 'bg-module-technical',
};

export function stageBarClasses(stage: TechnicalStage): string {
  return STAGE_BAR_CLASSES[stage];
}

// ---------------------------------------------------------------------------
// FMP-TECH-05E — Locked Stage Preview Mode. A single, shared rule for what
// mode a given stage's own page should render in, derived purely from
// `workflow.currentStage`/`workflow.status` (the same 2 fields every stage
// page already fetches) — no new API call, no new field. Write actions
// remain gated server-side by each stage's own `assertXxxStageIsCurrent()`
// regardless of what this computes; this only controls what the UI shows
// and which buttons render, never what the backend accepts.
// ---------------------------------------------------------------------------

export type TechnicalStageMode = 'active' | 'completed' | 'locked';

/**
 * `active` — this stage is `workflow.currentStage` and the workflow isn't
 * completed yet: the real, editable stage.
 * `completed` — this stage's own index is before `currentStage`'s (already
 * done, revisit is read-only unless a return/reopen action reverts
 * `currentStage` back to it, at which point it becomes `active` again via
 * this same rule with zero special-casing) — OR this stage IS `currentStage`
 * but `workflow.status === COMPLETED` (only possible for FD Issuance, the
 * final stage, which never advances `currentStage` past itself).
 * `locked` — this stage's own index is after `currentStage`'s: not reached
 * yet, preview-only.
 */
export function computeStageMode(
  stage: TechnicalStage,
  workflowCurrentStage: TechnicalStage,
  workflowStatus: TechnicalWorkflowStatus,
): TechnicalStageMode {
  const stageIdx = STAGE_ORDER.indexOf(stage);
  const currentIdx = STAGE_ORDER.indexOf(workflowCurrentStage);
  if (stageIdx === currentIdx) return workflowStatus === 'COMPLETED' ? 'completed' : 'active';
  return stageIdx < currentIdx ? 'completed' : 'locked';
}

// ---------------------------------------------------------------------------
// FMP-TECH-05J — one shared place for stage routing (slug + "Open <Stage>"
// label), used by the overview page, the stepper, and every stage form's
// footer ("Open <Previous Stage>" when locked, "Open <Current Stage>" when
// completed and the workflow has moved on). Previously duplicated
// separately in technical-stepper.tsx and jobs/[contractId]/page.tsx.
// ---------------------------------------------------------------------------

export const STAGE_SLUGS: Record<TechnicalStage, string> = {
  DRAWING_RECEIVED: 'drawing-received',
  SD_CALCULATION_SUBMISSION: 'sd-calculation-submission',
  GETTING_APPROVAL: 'getting-approval',
  FD_ISSUANCE: 'fd-issuance',
};

export const STAGE_OPEN_LABELS: Record<TechnicalStage, string> = {
  DRAWING_RECEIVED: 'Open Drawing Received',
  SD_CALCULATION_SUBMISSION: 'Open SD & Calculation',
  GETTING_APPROVAL: 'Open Getting Approval',
  FD_ISSUANCE: 'Open FD Issuance',
};

export function stageHref(contractId: string, stage: TechnicalStage): string {
  return `/technical/jobs/${contractId}/workflow/${STAGE_SLUGS[stage]}`;
}
