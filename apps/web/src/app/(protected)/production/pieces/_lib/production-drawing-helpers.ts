import type { ProductionPiece } from '@/lib/production-pieces-api';

// FMP-BOQ-13 — how a piece's Technical drawing group is shown to Production.
// Production sees a group's details only once it is Released to Production.

export type DrawingGroupInfo = ProductionPiece['drawingGroup'];

export const PRODUCTION_DRAWING_TEXT = {
  noGroup: 'No drawing group',
  notReleased: 'Not released to Production',
  released: 'Released to Production',
  warning: 'Some selected pieces are not released to Production and will be skipped.',
  helper: 'Only released pieces can be marked In Production or Produced.',
  noFiles: 'No files attached.',
  notReleasedFiles: 'Drawing files are not released to Production yet.',
  downloadFailed: 'Download failed. Please try again.',
} as const;

export type DrawingBadge = { label: string; tone: 'released' | 'not-released' | 'none'; short: 'Released' | 'Not released' | null };

/** The status line for a piece's group: released / not released / no group. */
export function drawingBadge(group: DrawingGroupInfo): DrawingBadge {
  if (!group) return { label: PRODUCTION_DRAWING_TEXT.noGroup, tone: 'none', short: null };
  if (!group.released) return { label: PRODUCTION_DRAWING_TEXT.notReleased, tone: 'not-released', short: 'Not released' };
  return { label: PRODUCTION_DRAWING_TEXT.released, tone: 'released', short: 'Released' };
}

export const DRAWING_BADGE_CLASSES: Record<DrawingBadge['tone'], string> = {
  released: 'bg-success-light text-success',
  'not-released': 'bg-warning-light text-warning',
  none: 'bg-surface-secondary text-text-muted',
};

/** View Files is offered only for a released group. */
export function canViewDrawingFiles(group: DrawingGroupInfo): boolean {
  return group !== null && group.released;
}

/** "HC-001 · CALC-001 · 2 files" for a released group; empty otherwise. */
export function drawingSummaryText(group: DrawingGroupInfo): string {
  if (!group || !group.released) return '';
  const files = group.fileCount === 0 ? 'No files attached.' : group.fileCount === 1 ? '1 file' : `${group.fileCount} files`;
  return [group.drawingNo, group.calculationRef, files].filter(Boolean).join(' · ');
}

/** How many of the ticked pieces are not released (drives the optional, non-blocking warning). */
export function selectedNotReleasedCount(pieces: Pick<ProductionPiece, 'id' | 'drawingGroup'>[], selected: Set<string>): number {
  return pieces.filter((p) => selected.has(p.id) && !canViewDrawingFiles(p.drawingGroup)).length;
}

/** The release rule (and its helper text) only applies when starting or finishing production — never to Hold / Rejected. The API enforces it; this only explains it. */
export function targetNeedsRelease(targetStatus: string): boolean {
  return targetStatus === 'IN_PRODUCTION' || targetStatus === 'PRODUCED';
}

/** Warns before the action when some ticked pieces would be skipped. */
export function shouldWarnNotReleased(targetStatus: string, notReleasedCount: number): boolean {
  return notReleasedCount > 0 && targetNeedsRelease(targetStatus);
}
