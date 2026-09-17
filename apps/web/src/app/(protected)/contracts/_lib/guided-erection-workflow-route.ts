// ---------------------------------------------------------------------------
// CM-71H.2 — Routes a generic ContractWorkflowTask (ERECTION team) to its
// matching CM-71A-G guided workflow screen, instead of the generic task
// update form. Detection is keyed off the stable, backend-defined `taskKey`
// (contract-workflow-templates.ts) — the SAME "stable key, not display
// text" precedent staff-task-update-panel.tsx already established for its
// own Technical-team task-type detection (SD_CALCULATION_TASK_KEY etc.). A
// normalized-title fallback exists only for the unlikely case a task record
// somehow has no recognized taskKey — never the primary path.
//
// The 6 guided steps below are Steps 1/3/5 (Erection Department-owned),
// Step 2 (QA/QC), and Step 4 (Delivery/Logistics) — the 6 real screens
// CM-71A-G actually built. Step 7 (Payment Issued, qs_payment_issued) has
// no guided screen yet, so it deliberately stays on the generic task form —
// see isGuidedErectionWorkflowTask's own false case for that key.
// ---------------------------------------------------------------------------

interface GuidedTaskEntry {
  /** Path segment(s) appended to /contracts/{contractId}/workflow/erection/ */
  path: string;
  /** 1-6, matching the corresponding CM-71A-G step number. */
  stepNumber: number;
  /** Corrected display label — see this unit's own "wording cleanup" instruction. */
  displayName: string;
}

const GUIDED_ERECTION_TASK_KEYS: Record<string, GuidedTaskEntry> = {
  erection_method_statement_issued: { path: 'method-statement', stepNumber: 1, displayName: 'Issue Erection Method Statement' },
  erection_statement_approval: { path: 'method-statement/approval', stepNumber: 2, displayName: 'Erection Method Statement Approval' },
  erection_schedule_issued: { path: 'schedule', stepNumber: 3, displayName: 'Issue Erection Schedule' },
  erection_delivery_start: { path: 'delivery-start', stepNumber: 4, displayName: 'Delivery Start' },
  erection_start: { path: 'start', stepNumber: 5, displayName: 'Erection Start' },
  erection_issue_checklist: { path: 'checklist', stepNumber: 6, displayName: 'Erection Checklist' },
};

/**
 * Fallback only — matched against a normalized (trimmed, lowercased,
 * whitespace-collapsed) taskName, covering both the OLD stored wording
 * ("Issued of Erection Method Statement", "Issued Erection Schedule",
 * "Issue Checklist") and the corrected wording, in case a task record ever
 * lacks a recognized taskKey. Never consulted when taskKey already matches.
 */
const NORMALIZED_TITLE_TO_TASK_KEY: Record<string, string> = {
  'issued of erection method statement': 'erection_method_statement_issued',
  'issue erection method statement': 'erection_method_statement_issued',
  'erection statement approval': 'erection_statement_approval',
  'erection method statement approval': 'erection_statement_approval',
  'issued erection schedule': 'erection_schedule_issued',
  'issue erection schedule': 'erection_schedule_issued',
  'delivery start': 'erection_delivery_start',
  'erection start': 'erection_start',
  'issue checklist': 'erection_issue_checklist',
  'erection checklist': 'erection_issue_checklist',
};

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface GuidedTaskInput {
  taskKey?: string;
  taskName?: string;
}

function resolveGuidedTaskKey(task: GuidedTaskInput): string | null {
  if (task.taskKey && GUIDED_ERECTION_TASK_KEYS[task.taskKey]) return task.taskKey;
  if (task.taskName) {
    const fallbackKey = NORMALIZED_TITLE_TO_TASK_KEY[normalizeTitle(task.taskName)];
    if (fallbackKey) return fallbackKey;
  }
  return null;
}

export function isGuidedErectionWorkflowTask(task: GuidedTaskInput): boolean {
  return resolveGuidedTaskKey(task) !== null;
}

export interface GuidedErectionWorkflowRoute {
  href: string;
  stepNumber: number;
}

/** Returns null for any task that isn't one of the 6 guided erection steps (including Payment Issued, which has no guided screen yet). */
export function getGuidedErectionWorkflowRoute(task: GuidedTaskInput, contractId: string): GuidedErectionWorkflowRoute | null {
  const key = resolveGuidedTaskKey(task);
  if (!key) return null;
  const entry = GUIDED_ERECTION_TASK_KEYS[key];
  if (!entry) return null;
  return { href: `/contracts/${contractId}/workflow/erection/${entry.path}`, stepNumber: entry.stepNumber };
}

/** Corrected display label for a guided erection task; falls back to the task's own stored taskName for everything else (never invents a label). */
export function getGuidedErectionTaskDisplayName(task: GuidedTaskInput & { taskName: string }): string {
  const key = resolveGuidedTaskKey(task);
  return key ? GUIDED_ERECTION_TASK_KEYS[key]!.displayName : task.taskName;
}

// ---------------------------------------------------------------------------
// CM-71H.7 — "Waiting for X" status text for a guided step that isn't
// actionable yet (its own prerequisite step hasn't reached the right state —
// see erection-step-lock.ts for the exact "Ready" conditions). Replaces the
// old "Locked — previous step not complete" badge everywhere a guided task
// is listed (My Tasks, the Contract Staff Dashboard) — never a harsh
// grey-out, just a clearer, step-specific reason. Step 1 has no prerequisite
// so it never appears here.
// ---------------------------------------------------------------------------

const GUIDED_ERECTION_WAITING_LABELS: Record<string, string> = {
  erection_statement_approval: 'Waiting for Step 1',
  erection_schedule_issued: 'Waiting for Approval',
  erection_delivery_start: 'Waiting for Schedule',
  erection_start: 'Waiting for Delivery',
  erection_issue_checklist: 'Waiting for Erection Start',
};

/** Null for Step 1 (no prerequisite) and for any non-guided task. */
export function getGuidedErectionWaitingLabel(task: GuidedTaskInput): string | null {
  const key = resolveGuidedTaskKey(task);
  return key ? (GUIDED_ERECTION_WAITING_LABELS[key] ?? null) : null;
}
