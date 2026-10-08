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
  pieceNotFound: 'Piece was not found.',
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
