import { TechnicalDrawingGroupStatus as S } from '@recafco/database';

// ---------------------------------------------------------------------------
// FMP-BOQ-11 — pure rules for Technical Drawing / Calculation Groups. A group
// ties one drawing (+ calculation) to a set of generated pieces. This unit only
// RECORDS group status; no piece status changes and Production is not blocked.
// ---------------------------------------------------------------------------

export const GROUP_MESSAGES = {
  boqItemRequired: 'Please select BOQ item.',
  drawingNoRequired: 'Please enter drawing number.',
  piecesRequired: 'Please select at least one piece.',
  piecesUnavailable: 'Some selected pieces are not available for this BOQ item.',
  notFound: 'Drawing group not found.',
  onlyDraftChange: 'Only a draft group can be changed.',
  onlyDraftSubmit: 'Only a draft group can be submitted.',
  onlySubmittedApprove: 'Only a submitted group can be approved.',
  onlyApprovedRelease: 'Only an approved group can be released to Production.',
  notCancellable: 'This group cannot be cancelled.',
} as const;

export function piecesAlreadyGroupedMessage(count: number): string {
  return count === 1 ? '1 piece is already in another drawing group.' : `${count} pieces are already in another drawing group.`;
}

/** Statuses in which a group still holds its pieces. Cancelled / Revised groups release them for re-assignment. */
export const ACTIVE_GROUP_STATUSES: S[] = [S.DRAFT, S.SUBMITTED, S.APPROVED, S.RELEASED_TO_PRODUCTION];

/** The next actions available for a group in this status (the UI shows exactly these). */
export function allowedGroupActions(status: S): ('EDIT' | 'SUBMIT' | 'APPROVE' | 'RELEASE' | 'CANCEL')[] {
  switch (status) {
    case S.DRAFT:
      return ['EDIT', 'SUBMIT', 'CANCEL'];
    case S.SUBMITTED:
      return ['APPROVE', 'CANCEL'];
    case S.APPROVED:
      return ['RELEASE', 'CANCEL'];
    default:
      return [];
  }
}

export interface GroupAssignmentSummary {
  piecesGenerated: number;
  assignedToGroups: number;
  notAssigned: number;
  approvedPieces: number;
  releasedToProduction: number;
}

/**
 * Per BOQ item: how many generated pieces sit in an active group, how many are
 * still unassigned, and how many are in approved / released groups.
 * `activeLinkStatuses` = the status of the group for each ACTIVE piece link.
 */
export function summarizeGroupAssignments(piecesGenerated: number, activeLinkStatuses: S[]): GroupAssignmentSummary {
  const assigned = activeLinkStatuses.length;
  return {
    piecesGenerated,
    assignedToGroups: assigned,
    notAssigned: Math.max(0, piecesGenerated - assigned),
    approvedPieces: activeLinkStatuses.filter((s) => s === S.APPROVED || s === S.RELEASED_TO_PRODUCTION).length,
    releasedToProduction: activeLinkStatuses.filter((s) => s === S.RELEASED_TO_PRODUCTION).length,
  };
}

/** If every selected piece came from the same drawing confirmation, link the group to it; otherwise leave it unlinked. */
export function commonDrawingConfirmationId(pieces: { drawingConfirmationId: string }[]): string | null {
  const first = pieces[0]?.drawingConfirmationId;
  if (!first) return null;
  return pieces.every((p) => p.drawingConfirmationId === first) ? first : null;
}

// ---------------------------------------------------------------------------
// FMP-BOQ-16 — Technical dashboard: per-job release numbers
// ---------------------------------------------------------------------------

export interface JobReleaseSummary {
  /** Drawing confirmed pieces (sum of CONFIRMED rows). */
  confirmed: number;
  generated: number;
  /** Pieces in a non-cancelled drawing group. */
  assigned: number;
  notAssigned: number;
  /** Pieces in groups that have at least one file. */
  filesAttachedPieces: number;
  /** Pieces in groups Released to Production. */
  released: number;
  /** Assigned pieces whose group is not (yet) released. */
  notReleased: number;
  groupsTotal: number;
  groupsWithFiles: number;
  groupsNoFiles: number;
  groupsSubmitted: number;
  groupsApproved: number;
  /** Groups not yet Released to Production (Draft, Submitted or Approved). */
  groupsNotReleased: number;
  confirmedNotGenerated: number;
}

export interface ReleaseGroupInput {
  status: S;
  pieceCount: number;
  fileCount: number;
}

/** Builds one job's release numbers. Cancelled / Revised groups are ignored (they hold no pieces). */
export function buildJobReleaseSummary(confirmed: number, generated: number, groups: ReleaseGroupInput[]): JobReleaseSummary {
  const live = groups.filter((g) => ACTIVE_GROUP_STATUSES.includes(g.status));
  const assigned = live.reduce((sum, g) => sum + g.pieceCount, 0);
  const released = live.filter((g) => g.status === S.RELEASED_TO_PRODUCTION).reduce((sum, g) => sum + g.pieceCount, 0);
  const withFiles = live.filter((g) => g.fileCount > 0);
  return {
    confirmed,
    generated,
    assigned,
    notAssigned: Math.max(0, generated - assigned),
    filesAttachedPieces: withFiles.reduce((sum, g) => sum + g.pieceCount, 0),
    released,
    notReleased: Math.max(0, assigned - released),
    groupsTotal: live.length,
    groupsWithFiles: withFiles.length,
    groupsNoFiles: live.length - withFiles.length,
    groupsSubmitted: live.filter((g) => g.status === S.SUBMITTED).length,
    groupsApproved: live.filter((g) => g.status === S.APPROVED).length,
    groupsNotReleased: live.filter((g) => g.status !== S.RELEASED_TO_PRODUCTION).length,
    confirmedNotGenerated: Math.max(0, confirmed - generated),
  };
}
