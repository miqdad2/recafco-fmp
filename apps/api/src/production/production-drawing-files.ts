import { TechnicalDrawingGroupStatus as S } from '@recafco/database';

// ---------------------------------------------------------------------------
// FMP-BOQ-13 — what Production may see of Technical's Drawing / Calculation
// Groups. Read-only: Production sees a group's drawing number, calculation ref
// and files ONLY once the group is Released to Production. For anything not
// released it only learns "Not released to Production" — no draft numbers,
// titles or files.
// ---------------------------------------------------------------------------

export const PRODUCTION_FILE_MESSAGES = {
  notReleased: 'Drawing files are not released to Production yet.',
  noGroup: 'No drawing group assigned.',
  fileNotFound: 'File not found.',
  pieceNotFound: 'Element was not found.',
  noDrawing: 'Final drawing is required before production can start.',
} as const;

export interface PieceGroupLink {
  group: {
    id: string;
    drawingNo: string;
    calculationRef: string | null;
    groupTitle: string | null;
    status: S;
    _count: { attachments: number };
  };
}

export type ProductionDrawingGroup =
  | { released: false }
  | { released: true; drawingNo: string; calculationRef: string | null; groupTitle: string | null; fileCount: number };

/** null = the piece is in no drawing group. */
export function toProductionDrawingGroup(links: PieceGroupLink[] | undefined): ProductionDrawingGroup | null {
  const group = links?.[0]?.group;
  if (!group) return null;
  if (group.status !== S.RELEASED_TO_PRODUCTION) return { released: false };
  return {
    released: true,
    drawingNo: group.drawingNo,
    calculationRef: group.calculationRef,
    groupTitle: group.groupTitle,
    fileCount: group._count.attachments,
  };
}

// ---------------------------------------------------------------------------
// FMP-PROD-03 — where an element's final drawing comes from, for the Production
// Work rows. A released drawing group with files wins (same rule as Technical's
// coverage); otherwise the element's own files are its individual drawing.
// ---------------------------------------------------------------------------

export type ProductionDrawingSource = 'GROUP' | 'INDIVIDUAL' | 'NONE';

export interface ProductionDrawingInfo {
  source: ProductionDrawingSource;
  /** Drawing no to show: the group's for a group drawing, the element's own otherwise. */
  reference: string;
  groupTitle: string | null;
  fileCount: number;
  hasDrawing: boolean;
}

export function buildProductionDrawingInfo(input: {
  drawingNo: string;
  ownFileCount: number;
  groupLinks: PieceGroupLink[] | undefined;
}): ProductionDrawingInfo {
  const group = toProductionDrawingGroup(input.groupLinks);
  if (group && group.released && group.fileCount > 0) {
    return { source: 'GROUP', reference: group.drawingNo, groupTitle: group.groupTitle, fileCount: group.fileCount, hasDrawing: true };
  }
  if (input.ownFileCount > 0) {
    return { source: 'INDIVIDUAL', reference: input.drawingNo, groupTitle: null, fileCount: input.ownFileCount, hasDrawing: true };
  }
  return {
    source: 'NONE',
    reference: group && group.released ? group.drawingNo : input.drawingNo,
    groupTitle: group && group.released ? group.groupTitle : null,
    fileCount: 0,
    hasDrawing: false,
  };
}
