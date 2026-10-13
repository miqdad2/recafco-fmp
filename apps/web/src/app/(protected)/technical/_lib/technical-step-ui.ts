import { WORKFLOW_STEPS } from './technical-workflow-helpers';
import type { WorkflowStepKey } from './technical-workflow-helpers';
import type { GuidedState, GuidedStep } from './technical-guided-workflow';

// ---------------------------------------------------------------------------
// FMP-TECH-23 — small shared bits for the Technical overview and the focused
// step pages: where each step lives, and how its status looks.
// ---------------------------------------------------------------------------

export function isWorkflowStepKey(value: string): value is WorkflowStepKey {
  return WORKFLOW_STEPS.some((s) => s.key === value);
}

/** Focused page for one step of a job. */
export function technicalStepHref(contractId: string, key: WorkflowStepKey): string {
  return `/technical/jobs/${contractId}/step/${key}`;
}

const STATE_LABEL: Record<GuidedState, string> = { done: 'Done', current: 'Current', pending: 'Pending', locked: 'Not ready', optional: 'Optional' };

const STATE_CLASSES: Record<GuidedState, string> = {
  done: 'bg-success-light text-success',
  current: 'bg-accent text-accent-foreground',
  pending: 'bg-surface-secondary text-text-secondary',
  locked: 'bg-surface-secondary text-text-muted',
  optional: 'bg-surface-secondary text-text-secondary',
};

/** Status text and colour: green Done, highlighted Current, neutral Pending, muted Not ready, amber Needs Attention. */
export function stepBadge(step: Pick<GuidedStep, 'state' | 'attention'>): { label: string; classes: string } {
  if (step.attention && step.state !== 'done') return { label: 'Needs Attention', classes: 'bg-warning-light text-warning' };
  return { label: STATE_LABEL[step.state], classes: STATE_CLASSES[step.state] };
}

export const STEP_PAGE_TEXT: Record<WorkflowStepKey, string> = {
  'boq-drawings': 'Initial drawings from Contract team. Use these to confirm the real elements.',
  'confirm-elements': 'Enter how many physical elements are required for each BOQ item. Contract Qty is for contract value only.',
  'drawing-groups': 'Use groups only when several elements share the same drawing. If an element has its own drawing, upload it directly in Final Drawing Files.',
  'final-drawing-files': 'Upload and manage approved drawings before release to Production.',
  'release-to-production': 'Only groups with required final drawing files can be released to Production.',
};

export const VIEW_ONLY_MESSAGE = 'You can view this technical status. Updates are available only to authorized users.';

/** Previous / next step around one step (null at the ends). */
export function neighbours(key: WorkflowStepKey): { previous: WorkflowStepKey | null; next: WorkflowStepKey | null } {
  const i = WORKFLOW_STEPS.findIndex((s) => s.key === key);
  return { previous: WORKFLOW_STEPS[i - 1]?.key ?? null, next: WORKFLOW_STEPS[i + 1]?.key ?? null };
}
