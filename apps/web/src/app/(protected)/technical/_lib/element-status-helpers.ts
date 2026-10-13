import type { BoqPiece, BoqPieceStatus, DrawingGroup, DrawingGroupItem, DrawingGroupStatus } from '@/lib/technical-api';
import { BOQ_PIECE_STATUS_CLASSES, BOQ_PIECE_STATUS_LABELS } from './boq-confirmation-helpers';

// ---------------------------------------------------------------------------
// FMP-TECH-25 — what Technical shows for an individual element before it reaches
// Production. Elements are always individual records; the stored status of a new
// element stays DRAWING_READY (Production works with it from that status once it
// is released), so the wording Technical shows is worked out from where the
// element stands: no final drawing yet, drawing attached, or released. Nothing
// here changes a stored status.
// ---------------------------------------------------------------------------

/**
 * "No grouping needed" is a drawing group that covers every element of one BOQ item, so the
 * existing files, approval and release rules apply to it unchanged. It is recognised by this
 * title; Drawing Groups the user creates never use it.
 */
export const NO_GROUPING_TITLE = 'All elements (no grouping)';

export function isNoGroupingGroup(group: { groupTitle: string | null }): boolean {
  return group.groupTitle === NO_GROUPING_TITLE;
}

export type FinalDrawingMethod = 'not-chosen' | 'no-grouping' | 'groups';

const LIVE: DrawingGroupStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'RELEASED_TO_PRODUCTION'];

function liveGroups(item: Pick<DrawingGroupItem, 'groups'>): DrawingGroup[] {
  return item.groups.filter((g) => LIVE.includes(g.status));
}

/** How final drawings are attached for one BOQ item: not decided yet, to all its elements at once, or per Drawing Group. */
export function finalDrawingMethod(item: Pick<DrawingGroupItem, 'groups'>): FinalDrawingMethod {
  const groups = liveGroups(item);
  if (groups.length === 0) return 'not-chosen';
  return groups.some((g) => !isNoGroupingGroup(g)) ? 'groups' : 'no-grouping';
}

type ElementForStatus = Pick<BoqPiece, 'currentStatus' | 'drawingGroupLinks' | 'releasedToProductionAt' | '_count'>;

export type ElementStage = 'waiting-final-drawing' | 'missing-final-drawing' | 'ready-to-release' | 'released' | 'tracking';

/** Where an element stands in Technical. Anything past DRAWING_READY is Production's/Storage's/Erection's own status. */
export function elementStage(piece: ElementForStatus): ElementStage {
  if (piece.currentStatus !== 'DRAWING_READY') return 'tracking';
  const group = piece.drawingGroupLinks?.[0]?.group;
  if (piece.releasedToProductionAt || group?.status === 'RELEASED_TO_PRODUCTION') return 'released';
  // FMP-TECH-27 — covered by the group's files or by the element's own final drawing files.
  const ownFiles = (piece._count?.attachments ?? 0) > 0;
  if (!group) return ownFiles ? 'ready-to-release' : 'waiting-final-drawing';
  return (group._count?.attachments ?? 0) > 0 || ownFiles ? 'ready-to-release' : 'missing-final-drawing';
}

const STAGE_LABEL: Record<Exclude<ElementStage, 'tracking'>, string> = {
  'waiting-final-drawing': 'Waiting Final Drawing',
  'missing-final-drawing': 'Missing Final Drawing',
  'ready-to-release': 'Ready to Release',
  'released': 'Released to Production',
};

const STAGE_CLASSES: Record<Exclude<ElementStage, 'tracking'>, string> = {
  'waiting-final-drawing': 'bg-surface-secondary text-text-secondary',
  'missing-final-drawing': 'bg-warning-light text-warning',
  'ready-to-release': 'bg-info-light text-info',
  'released': 'bg-success-light text-success',
};

export function elementStatusLabel(piece: ElementForStatus): string {
  const stage = elementStage(piece);
  return stage === 'tracking' ? BOQ_PIECE_STATUS_LABELS[piece.currentStatus] : STAGE_LABEL[stage];
}

export function elementStatusClasses(piece: ElementForStatus): string {
  const stage = elementStage(piece);
  return stage === 'tracking' ? BOQ_PIECE_STATUS_CLASSES[piece.currentStatus] : STAGE_CLASSES[stage];
}

export type ElementCoverageLabel = 'Group Drawing Uploaded' | 'Drawing Uploaded' | 'Waiting Group Drawing' | 'Waiting Final Drawing';

/** Where the element's final drawing stands: uploaded for its group, uploaded for the element, or still waiting. */
export function elementCoverageLabel(piece: Pick<BoqPiece, 'drawingGroupLinks' | '_count'>): ElementCoverageLabel {
  const group = piece.drawingGroupLinks?.[0]?.group;
  if (group && (group._count?.attachments ?? 0) > 0) return 'Group Drawing Uploaded';
  if ((piece._count?.attachments ?? 0) > 0) return 'Drawing Uploaded';
  return group ? 'Waiting Group Drawing' : 'Waiting Final Drawing';
}

/**
 * The Group column: "—" before any grouping decision, "No grouping needed" when the element is
 * covered by its BOQ item's all-elements drawing, the group's own name otherwise, and
 * "Not Assigned to Group" only when the BOQ item already uses Drawing Groups.
 */
export function elementGroupText(piece: Pick<BoqPiece, 'drawingGroupLinks'>, itemUsesGroups: boolean): string {
  const group = piece.drawingGroupLinks?.[0]?.group;
  if (!group) return itemUsesGroups ? 'Not Assigned to Group' : '—';
  if (isNoGroupingGroup(group)) return 'No grouping needed';
  return [group.drawingNo, group.calculationRef].filter(Boolean).join(' · ');
}

export interface ItemStatusChip {
  key: string;
  label: string;
  count: number;
  /** A BOQ_PIECE_STATUS_CLASSES key, or the stage classes for the split Drawing-Ready chips. */
  classes: string;
}

/**
 * Status chips for one BOQ item. Elements still at DRAWING_READY are split into "Waiting Final
 * Drawing" and "Released to Production" using how many of the item's elements sit in released
 * groups; every later status keeps its own name.
 */
export function itemStatusChips(statusCounts: Partial<Record<BoqPieceStatus, number>>, releasedElements: number): ItemStatusChip[] {
  const chips: ItemStatusChip[] = [];
  const ready = statusCounts.DRAWING_READY ?? 0;
  const released = Math.min(releasedElements, ready);
  if (ready - released > 0) chips.push({ key: 'waiting', label: STAGE_LABEL['waiting-final-drawing'], count: ready - released, classes: STAGE_CLASSES['waiting-final-drawing'] });
  if (released > 0) chips.push({ key: 'released', label: STAGE_LABEL.released, count: released, classes: STAGE_CLASSES.released });
  const order: BoqPieceStatus[] = ['IN_PRODUCTION', 'PRODUCED', 'IN_STORE', 'DELIVERED', 'ERECTED', 'COMPLETED', 'ON_HOLD', 'REJECTED'];
  for (const s of order) {
    const n = statusCounts[s] ?? 0;
    if (n > 0) chips.push({ key: s, label: BOQ_PIECE_STATUS_LABELS[s], count: n, classes: BOQ_PIECE_STATUS_CLASSES[s] });
  }
  return chips;
}

export const GROUPS_OPTIONAL_TEXT = 'Optional — use only if different elements need different drawings.';

export const ELEMENTS_GENERATED_MESSAGE =
  'Individual elements generated successfully. Next, attach final drawing files. Use Drawing Groups only if different elements need different drawings.';
