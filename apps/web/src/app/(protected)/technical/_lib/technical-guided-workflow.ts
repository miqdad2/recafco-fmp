import { WORKFLOW_STEPS, activeGroups, workflowStepStatuses } from './technical-workflow-helpers';
import type { WorkflowStepInput, WorkflowStepKey } from './technical-workflow-helpers';
import { GROUPS_OPTIONAL_TEXT, isNoGroupingGroup } from './element-status-helpers';

// ---------------------------------------------------------------------------
// FMP-TECH-22 / 25 — guided view of the five Technical steps: which one is
// current, which are done, which are not ready yet, and what to do next.
// Presentation only: it never blocks an action on the server, it only decides
// what the page opens and what is shown while a step is not ready.
//
// FMP-TECH-25: individual elements are always generated; Drawing Groups are
// OPTIONAL. Final Drawing Files opens as soon as elements exist (files can cover
// all elements of a BOQ item), and Drawing Groups only becomes the current step
// once the user has started using groups and not every element is in one yet.
// ---------------------------------------------------------------------------

export type GuidedState = 'done' | 'current' | 'pending' | 'locked' | 'optional';

export interface GuidedStep {
  key: WorkflowStepKey;
  label: string;
  state: GuidedState;
  /** Needs Attention overlay (e.g. confirmed and generated elements do not match). */
  attention: boolean;
  /** One line shown while the step is collapsed. */
  summary: string;
  /** Shown instead of the controls while the step is not ready. */
  lockedMessage: string | null;
}

export interface GuidedWorkflowModel {
  steps: GuidedStep[];
  currentKey: WorkflowStepKey | null;
  complete: boolean;
  nextAction: string;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const GUIDED_LOCKED_MESSAGES = {
  'drawing-groups': 'Confirm elements first before creating drawing groups.',
  'final-drawing-files': 'Confirm elements first, then attach final drawing files.',
  'release-to-production': 'Final drawing files are required before release to Production.',
} as const;

export const GUIDED_NEXT_ACTIONS: Record<WorkflowStepKey, string> = {
  'boq-drawings': 'Review the BOQ drawing files from the Contract team.',
  'confirm-elements': 'Confirm physical elements for each BOQ item.',
  'drawing-groups': 'Assign every element to a drawing group.',
  'final-drawing-files': 'Add final drawing files to a drawing group or to individual elements.',
  'release-to-production': 'Release the ready elements to Production.',
};

export const GUIDED_COMPLETE_MESSAGE = 'Technical work completed for Production.';

export function guidedWorkflow(input: WorkflowStepInput): GuidedWorkflowModel {
  const items = input.confirmations ?? [];
  const groups = activeGroups(input.groupItems);
  const base = workflowStepStatuses(input);
  const filesCount = input.attachments?.length ?? 0;
  const generated = input.coverage
    ? input.coverage.totalElements
    : input.groupItems
      ? input.groupItems.reduce((t, i) => t + i.piecesGenerated, 0)
      : items.reduce((t, i) => t + i.piecesGenerated, 0);
  const notAssigned = (input.groupItems ?? []).reduce((t, i) => t + i.notAssigned, 0);
  const withFiles = groups.filter((g) => g.fileCount > 0).length;
  const released = groups.filter((g) => g.status === 'RELEASED_TO_PRODUCTION').length;
  const confirmedItems = items.filter((i) => i.confirmedPieces !== null).length;
  const usesGroups = groups.some((g) => !isNoGroupingGroup(g));
  const everyElementCovered = generated > 0 && groups.length > 0 && notAssigned === 0;
  const cov = input.coverage ?? null;

  const done: Record<WorkflowStepKey, boolean> = {
    'boq-drawings': filesCount > 0,
    'confirm-elements': base['confirm-elements'] === 'Done',
    // Optional: only "done" when the user chose groups and finished assigning.
    'drawing-groups': usesGroups && notAssigned === 0,
    // FMP-TECH-27 — with coverage numbers, every element must be covered (group files or its own file) / released.
    'final-drawing-files': cov ? cov.totalElements > 0 && cov.notCovered === 0 : everyElementCovered && withFiles === groups.length,
    'release-to-production': cov ? cov.totalElements > 0 && cov.released === cov.totalElements : everyElementCovered && released === groups.length,
  };
  const locked: Record<WorkflowStepKey, boolean> = {
    'boq-drawings': false,
    'confirm-elements': false,
    'drawing-groups': !done['drawing-groups'] && generated === 0,
    'final-drawing-files': !done['final-drawing-files'] && generated === 0,
    'release-to-production': !done['release-to-production'] && (cov ? cov.readyToRelease + cov.released === 0 : withFiles === 0),
  };
  // Drawing Groups is skipped as a "next step" until the user starts using groups.
  const optional: Record<WorkflowStepKey, boolean> = {
    'boq-drawings': false,
    'confirm-elements': false,
    'drawing-groups': !usesGroups && !done['drawing-groups'] && !locked['drawing-groups'],
    'final-drawing-files': false,
    'release-to-production': false,
  };

  // The first unfinished, ready, required step after BOQ Drawings. BOQ Drawings never blocks the rest: drawings may arrive later.
  const currentKey = WORKFLOW_STEPS.slice(1).find((s) => !done[s.key] && !locked[s.key] && !optional[s.key])?.key ?? null;
  const complete = done['release-to-production'];

  const summaries: Record<WorkflowStepKey, string> = {
    'boq-drawings':
      filesCount > 0
        ? `${plural(items.length, 'BOQ item', 'BOQ items')}, ${plural(filesCount, 'drawing file', 'drawing files')} attached`
        : 'No BOQ drawing files attached yet.',
    'confirm-elements': `${confirmedItems} of ${plural(items.length, 'BOQ item', 'BOQ items')} confirmed · ${plural(generated, 'element', 'elements')} generated`,
    'drawing-groups': optional['drawing-groups']
      ? cov
        ? `${cov.coveredByGroup} group drawings uploaded, ${cov.notCovered} waiting final drawing`
        : GROUPS_OPTIONAL_TEXT
      : `${plural(groups.filter((g) => !isNoGroupingGroup(g)).length, 'group', 'groups')} · ${notAssigned} not assigned`,
    'final-drawing-files': cov
      ? cov.notCovered === 0
        ? `${plural(cov.totalElements, 'element', 'elements')} with a final drawing`
        : `${plural(cov.notCovered, 'element', 'elements')} still need a final drawing`
      : groups.length === 0 ? (generated > 0 ? `${plural(generated, 'element', 'elements')} waiting for final drawings` : 'No elements yet.') : `${withFiles} of ${plural(groups.length, 'drawing set', 'drawing sets')} have final drawing files`,
    'release-to-production': cov ? `${cov.released} of ${plural(cov.totalElements, 'element', 'elements')} released to Production` : groups.length === 0 ? 'No final drawings attached yet.' : `${released} of ${plural(groups.length, 'drawing set', 'drawing sets')} released to Production`,
  };

  const steps: GuidedStep[] = WORKFLOW_STEPS.map((s) => ({
    key: s.key,
    label: s.label,
    state: done[s.key] ? 'done' : s.key === currentKey ? 'current' : locked[s.key] ? 'locked' : optional[s.key] ? 'optional' : 'pending',
    attention: base[s.key] === 'Needs Attention',
    summary: summaries[s.key],
    lockedMessage: locked[s.key]
      ? s.key === 'release-to-production' && cov && cov.notCovered > 0
        ? `${plural(cov.notCovered, 'element', 'elements')} waiting final drawing. ${GUIDED_LOCKED_MESSAGES['release-to-production']}`
        : (GUIDED_LOCKED_MESSAGES as Record<string, string>)[s.key] ?? null
      : null,
  }));

  return {
    steps,
    currentKey,
    complete,
    nextAction: complete ? GUIDED_COMPLETE_MESSAGE : GUIDED_NEXT_ACTIONS[currentKey ?? 'confirm-elements'],
  };
}
