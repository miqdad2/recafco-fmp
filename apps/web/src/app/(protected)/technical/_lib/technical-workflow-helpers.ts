import type { BoqConfirmationItem, BoqItemAttachment, DrawingGroup, DrawingGroupItem } from '@/lib/technical-api';

// ---------------------------------------------------------------------------
// FMP-TECH-21 — the BOQ-to-Production steps shown on Technical Details.
// Status is worked out from data the page already loads (BOQ drawings, element
// confirmations, drawing groups); nothing is stored or changed here, and the
// steps never gate any action — they are guidance.
// ---------------------------------------------------------------------------

export type WorkflowStepKey = 'boq-drawings' | 'confirm-elements' | 'drawing-groups' | 'final-drawing-files' | 'release-to-production';
export type WorkflowStepStatus = 'Pending' | 'In Progress' | 'Done' | 'Needs Attention';

export const WORKFLOW_STEPS: { key: WorkflowStepKey; label: string; anchor: string }[] = [
  { key: 'boq-drawings', label: 'BOQ Drawings', anchor: '#boq-drawings' },
  { key: 'confirm-elements', label: 'Confirm Elements', anchor: '#confirm-elements' },
  { key: 'drawing-groups', label: 'Drawing Groups', anchor: '#drawing-groups' },
  { key: 'final-drawing-files', label: 'Final Drawing Files', anchor: '#final-drawing-files' },
  { key: 'release-to-production', label: 'Release to Production', anchor: '#release-to-production' },
];

/** Cancelled and revised groups hold no elements, so they do not count. */
export function activeGroups(items: DrawingGroupItem[] | null): DrawingGroup[] {
  return (items ?? []).flatMap((i) => i.groups).filter((g) => g.status !== 'CANCELLED' && g.status !== 'REVISED');
}

/** FMP-TECH-27 — the same summary the API sends (element final drawing coverage). */
export interface CoverageNumbers {
  totalElements: number;
  coveredByGroup: number;
  coveredIndividually: number;
  notCovered: number;
  readyToRelease: number;
  released: number;
}

export interface WorkflowStepInput {
  confirmations: BoqConfirmationItem[] | null;
  attachments: BoqItemAttachment[] | null;
  groupItems: DrawingGroupItem[] | null;
  /** When known, final drawing coverage (by group or individual) decides the Final Drawing Files and Release steps. */
  coverage?: CoverageNumbers | null;
}

export function workflowStepStatuses(input: WorkflowStepInput): Record<WorkflowStepKey, WorkflowStepStatus> {
  const items = input.confirmations ?? [];
  const groups = activeGroups(input.groupItems);

  // 1. BOQ Drawings — done once the Contract team's drawings are attached.
  const boq: WorkflowStepStatus = (input.attachments?.length ?? 0) > 0 ? 'Done' : 'Pending';

  // 2. Confirm Elements
  const confirmedItems = items.filter((i) => i.confirmedPieces !== null).length;
  let confirm: WorkflowStepStatus = 'Pending';
  if (items.some((i) => i.needsAttention)) confirm = 'Needs Attention';
  else if (items.length > 0 && confirmedItems === items.length && items.every((i) => i.piecesGenerated > 0)) confirm = 'Done';
  else if (confirmedItems > 0) confirm = 'In Progress';

  // 3. Drawing Groups
  const generated = (input.groupItems ?? []).reduce((t, i) => t + i.piecesGenerated, 0);
  const notAssigned = (input.groupItems ?? []).reduce((t, i) => t + i.notAssigned, 0);
  let groupStatus: WorkflowStepStatus = 'Pending';
  if (groups.length > 0 && generated > 0 && notAssigned === 0) groupStatus = 'Done';
  else if (groups.length > 0) groupStatus = 'In Progress';

  // 4. Final Drawing Files
  const withFiles = groups.filter((g) => g.fileCount > 0).length;
  let files: WorkflowStepStatus = 'Pending';
  if (groups.length > 0 && withFiles === groups.length) files = 'Done';
  else if (withFiles > 0) files = 'In Progress';

  // 5. Release to Production
  const released = groups.filter((g) => g.status === 'RELEASED_TO_PRODUCTION').length;
  let release: WorkflowStepStatus = 'Pending';
  if (groups.length > 0 && released === groups.length) release = 'Done';
  else if (released > 0 || groups.some((g) => g.status === 'APPROVED')) release = 'In Progress';

  return { 'boq-drawings': boq, 'confirm-elements': confirm, 'drawing-groups': groupStatus, 'final-drawing-files': files, 'release-to-production': release };
}

export interface ReleaseSummary {
  /** Groups with elements and files that are not released yet — can be released now. */
  ready: DrawingGroup[];
  /** Live groups with no file attached. */
  missingFiles: DrawingGroup[];
  released: DrawingGroup[];
}

export function releaseSummary(items: DrawingGroupItem[] | null): ReleaseSummary {
  const groups = activeGroups(items);
  return {
    // FMP-TECH-25 — ready as soon as the set has elements and a final drawing file; the release button then takes it through the remaining existing steps.
    ready: groups.filter((g) => g.status !== 'RELEASED_TO_PRODUCTION' && g.fileCount > 0 && g.pieceCount > 0),
    missingFiles: groups.filter((g) => g.fileCount === 0),
    released: groups.filter((g) => g.status === 'RELEASED_TO_PRODUCTION'),
  };
}

/** Per BOQ item: live groups with no file (shown in the Drawing Groups counts). */
export function groupsWithoutFiles(item: DrawingGroupItem): number {
  return item.groups.filter((g) => g.status !== 'CANCELLED' && g.status !== 'REVISED' && g.fileCount === 0).length;
}
