// ---------------------------------------------------------------------------
// CM-71B — Pure, presentation-agnostic helpers for the Erection Dashboard.
// Dependency-free so they can be unit tested directly, matching
// contract-erection-method-statement-helpers.ts / contract-variation-helpers.ts.
// All KPI/status computation itself lives server-side
// (contract-erection-dashboard.service.ts) — this file is display labels/
// classes plus pure client-side aggregation over the already-fetched
// ErectionWorkQueueRow[] payload.
//
// FMP-UI-19 — rebuilt around the "Erection Workflow Status Dashboard" brief:
// removed the old 23-column work-queue table's per-step filter/search helpers
// (ErectionWorkQueueFilters, matchesErectionWorkQueueFilters) and the 5
// per-step display-label/badge-class maps (Method Statement/Schedule/
// Delivery/Erection Start/Checklist) they backed — none of that survives in
// the simplified table or the new Workflow Status cards, and nothing else in
// the app imported them (confirmed before deletion). Replaced with
// computeErectionWorkflowStepKey/summarizeErectionWorkflowSteps (aggregate
// "which of the 7 steps is each contract currently on") and
// selectErectionNeedsAttention (the 2 new dashboard sections' own
// data-shaping). ERECTION_ATTENTION_LABELS/_BADGE_CLASSES are kept as-is —
// still used by the Status column and the Needs Attention panel.
//
// FMP-UI-19D — the old viewer-mode-based erectionNextActionText() (ACT saw
// the backend's own nextAction.label, MONITOR/READ_ONLY saw a generic
// phrase) is replaced by erectionNextActionLabel()/ERECTION_NEXT_ACTION_LABELS:
// one fixed, actionable phrase per workflow step ("Open Method Statement
// Step", "Review Approval Step", …), the same for every viewer — see that
// function's own doc comment for why "what's next" and "who can act on it"
// are now 2 separate concerns instead of one blended string.
// ---------------------------------------------------------------------------

import type { ErectionAttentionStatus, ErectionWorkQueueRow } from '@/lib/contracts-api';

/**
 * FMP-UI-19E — "Open Workflow should look like a real button, not only a
 * red text link" (Needs Attention) and the same visual language reused for
 * Contracts in Erection Workflow's own Open Workflow/View Contract pair, so
 * both sections share one consistent, management-ready button treatment
 * instead of each inventing its own. Solid accent fill for the primary
 * action; a quieter outlined/text-only secondary for "View Contract" (never
 * competing with Open Workflow for attention).
 */
export const ERECTION_PRIMARY_ACTION_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1';

export const ERECTION_SECONDARY_ACTION_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1';

export const ERECTION_ATTENTION_LABELS: Record<ErectionAttentionStatus, string> = {
  OVERDUE: 'Overdue',
  AWAITING_APPROVAL: 'Awaiting Approval',
  ON_TRACK: 'On Track',
  NEEDS_PLANNING: 'Needs Planning',
};

export const ERECTION_ATTENTION_BADGE_CLASSES: Record<ErectionAttentionStatus, string> = {
  OVERDUE: 'bg-error-light text-error',
  AWAITING_APPROVAL: 'bg-warning-light text-warning',
  ON_TRACK: 'bg-success-light text-success',
  NEEDS_PLANNING: 'bg-surface-secondary text-text-muted',
};

// ---------------------------------------------------------------------------
// Workflow Status section — 7 step cards (Method Statement → Payment).
// ---------------------------------------------------------------------------

export type ErectionWorkflowStepKey =
  | 'METHOD_STATEMENT'
  | 'APPROVAL'
  | 'SCHEDULE'
  | 'DELIVERY'
  | 'ERECTION_START'
  | 'CHECKLIST'
  | 'PAYMENT';

export const ERECTION_WORKFLOW_STEP_ORDER: ErectionWorkflowStepKey[] = [
  'METHOD_STATEMENT', 'APPROVAL', 'SCHEDULE', 'DELIVERY', 'ERECTION_START', 'CHECKLIST', 'PAYMENT',
];

export const ERECTION_WORKFLOW_STEP_LABELS: Record<ErectionWorkflowStepKey, string> = {
  METHOD_STATEMENT: 'Method Statement',
  APPROVAL: 'Approval',
  SCHEDULE: 'Schedule',
  DELIVERY: 'Delivery',
  ERECTION_START: 'Erection Start',
  CHECKLIST: 'Checklist',
  PAYMENT: 'Payment',
};

type ErectionStepGateRow = Pick<
  ErectionWorkQueueRow,
  'methodStatementStatus' | 'approvalStatus' | 'scheduleStatus' | 'deliveryStartStatus' | 'erectionStartStatus' | 'checklistStatus'
>;

/**
 * Mirrors the API's own computeCurrentErectionStepLabel gate order EXACTLY
 * (apps/api/src/contracts/contract-erection-dashboard.service.ts) but returns
 * a typed step key instead of a human label, so the dashboard can tally "how
 * many contracts are currently sitting at each of the 7 steps" from the
 * typed per-row status fields it already has, rather than string-matching
 * the label text (fragile if that copy ever changes). PAYMENT is never a
 * real gate — Step 7 has no dedicated model/screen yet — it is simply
 * "every contract that has cleared all 6 real gates".
 */
export function computeErectionWorkflowStepKey(row: ErectionStepGateRow): ErectionWorkflowStepKey {
  if (row.methodStatementStatus === 'NOT_STARTED' || row.methodStatementStatus === 'DRAFT') return 'METHOD_STATEMENT';
  if (row.approvalStatus !== 'APPROVED') return 'APPROVAL';
  if (row.scheduleStatus !== 'ISSUED') return 'SCHEDULE';
  if (row.deliveryStartStatus !== 'STARTED') return 'DELIVERY';
  if (row.erectionStartStatus !== 'STARTED') return 'ERECTION_START';
  if (row.checklistStatus !== 'SUBMITTED_FOR_VERIFICATION' && row.checklistStatus !== 'VERIFIED') return 'CHECKLIST';
  return 'PAYMENT';
}

export interface ErectionWorkflowStepSummary {
  step: ErectionWorkflowStepKey;
  label: string;
  /** Real count of contracts currently on this step; always 0 for PAYMENT (not a real gate). */
  count: number;
  statusText: string;
  badgeClass: string;
}

/**
 * One card per workflow step. Steps 1–6 show a real, honest count of
 * contracts currently gated there (via computeErectionWorkflowStepKey) with
 * warning styling when count > 0, or "None pending"/neutral when 0 — never
 * a fabricated number. Payment (Step 7) always shows a fixed "Not built
 * yet" state, matching kpis.paymentPendingAfterErectionAvailable's literal
 * `false` type — there is no dedicated Step 7 model/screen yet.
 *
 * FMP-UI-19E — status WORDING (not the underlying count/computation, which
 * is unchanged) uses "In progress" instead of "Pending" for ERECTION_START
 * specifically: every other step's non-zero count means "waiting on a
 * document/approval," but this step's non-zero count means "site is ready
 * for erection, physically underway toward starting" — a genuinely
 * different, more active state, and the same word this dashboard's own
 * Overview card already uses ("Erection In Progress"). Every other step
 * keeps "Pending" — this is a label-only distinction for one step, not a
 * new computation.
 */
export function summarizeErectionWorkflowSteps(rows: ErectionWorkQueueRow[]): ErectionWorkflowStepSummary[] {
  const counts: Record<ErectionWorkflowStepKey, number> = {
    METHOD_STATEMENT: 0, APPROVAL: 0, SCHEDULE: 0, DELIVERY: 0, ERECTION_START: 0, CHECKLIST: 0, PAYMENT: 0,
  };
  for (const row of rows) counts[computeErectionWorkflowStepKey(row)] += 1;

  return ERECTION_WORKFLOW_STEP_ORDER.map((step) => {
    const label = ERECTION_WORKFLOW_STEP_LABELS[step];
    if (step === 'PAYMENT') {
      return { step, label, count: 0, statusText: 'Not built yet', badgeClass: 'bg-surface-secondary text-text-muted' };
    }
    const count = counts[step];
    const pendingText = step === 'ERECTION_START' ? 'In progress' : 'Pending';
    return {
      step,
      label,
      count,
      statusText: count > 0 ? pendingText : 'None pending',
      badgeClass: count > 0 ? 'bg-warning-light text-warning' : 'bg-surface-secondary text-text-muted',
    };
  });
}

// ---------------------------------------------------------------------------
// Needs Attention section.
// ---------------------------------------------------------------------------

/** Any contract whose attention isn't ON_TRACK is "needs attention" — the same real per-row field the Status column already shows, just filtered. */
export function selectErectionNeedsAttention(rows: ErectionWorkQueueRow[]): ErectionWorkQueueRow[] {
  return rows.filter((r) => r.attention !== 'ON_TRACK');
}

// ---------------------------------------------------------------------------
// Contracts in Erection Workflow — Next Action wording.
// ---------------------------------------------------------------------------

/**
 * FMP-UI-19D — "use actionable wording, not just a stage name" (the brief's
 * own example list, matched here 1:1). Deliberately keyed off
 * computeErectionWorkflowStepKey() — an objective fact about the CONTRACT
 * ("what needs to happen next, for anyone") — not off the viewer's own
 * ACT/MONITOR/READ_ONLY mode, which stays a separate, purely UI-level
 * concern handled by the Action button (Open Workflow vs View Contract):
 * every viewer sees the same honest "what's next" text; only who gets a
 * clickable Open Workflow button differs.
 */
export const ERECTION_NEXT_ACTION_LABELS: Record<ErectionWorkflowStepKey, string> = {
  METHOD_STATEMENT: 'Open Method Statement Step',
  APPROVAL: 'Review Approval Step',
  SCHEDULE: 'Open Schedule Step',
  DELIVERY: 'Confirm Delivery Step',
  ERECTION_START: 'Confirm Erection Start',
  CHECKLIST: 'Open Checklist Step',
  PAYMENT: 'Payment not built yet',
};

export function erectionNextActionLabel(row: ErectionStepGateRow): string {
  return ERECTION_NEXT_ACTION_LABELS[computeErectionWorkflowStepKey(row)];
}
