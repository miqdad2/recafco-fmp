import type { BoqConfirmationItem, BoqPieceStatus, DrawingGroupItem } from '@/lib/technical-api';

// FMP-BOQ-10 — read-only BOQ piece progress for managers. Everything here is
// derived from the counts the Technical BOQ read endpoint already returns;
// nothing is written and no status can be changed from Contract Management.

/** The per-item status tiles, in the order the work flows. Hold and Rejected share one tile. */
export const PROGRESS_TILES: { key: string; label: string; statuses: BoqPieceStatus[] }[] = [
  { key: 'drawingReady', label: 'Drawing Ready', statuses: ['DRAWING_READY'] },
  { key: 'inProduction', label: 'In Production', statuses: ['IN_PRODUCTION'] },
  { key: 'produced', label: 'Produced', statuses: ['PRODUCED'] },
  { key: 'inStore', label: 'In Store', statuses: ['IN_STORE'] },
  { key: 'delivered', label: 'Delivered', statuses: ['DELIVERED'] },
  { key: 'erected', label: 'Erected', statuses: ['ERECTED'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'holdRejected', label: 'Hold / Rejected', statuses: ['ON_HOLD', 'REJECTED'] },
];

/** FMP-BOQ-15 — Technical grouping / release numbers for one BOQ item. */
export interface TechnicalRelease {
  assigned: number;
  notAssigned: number;
  released: number;
  /** Pieces that are in a drawing group which is not (yet) Released to Production. */
  notReleased: number;
}

type ItemLike = Pick<BoqConfirmationItem, 'confirmedPieces' | 'piecesGenerated' | 'statusCounts' | 'confirmations'> & {
  /** Absent when the grouping data could not be loaded — then no grouping reasons are claimed. */
  technical?: TechnicalRelease | null;
};

/** Adds the drawing-group numbers to each BOQ item (matched by BOQ item id). */
export function withTechnicalRelease(items: BoqConfirmationItem[], groups: DrawingGroupItem[] | null): (BoqConfirmationItem & { technical: TechnicalRelease | null; groups: DrawingGroupItem['groups'] })[] {
  return items.map((item) => {
    const g = groups?.find((x) => x.boqItemId === item.boqItemId);
    return {
      ...item,
      groups: g?.groups ?? [],
      technical: g
        ? {
            assigned: g.assignedToGroups,
            notAssigned: g.notAssigned,
            released: g.releasedToProduction,
            notReleased: Math.max(0, g.assignedToGroups - g.releasedToProduction),
          }
        : null,
    };
  });
}

/** Number of pieces currently in any of the given statuses. */
export function countStatuses(statusCounts: ItemLike['statusCounts'], statuses: BoqPieceStatus[]): number {
  return statuses.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
}

export function tileCount(item: ItemLike, tileKey: string): number {
  const tile = PROGRESS_TILES.find((t) => t.key === tileKey);
  return tile ? countStatuses(item.statusCounts, tile.statuses) : 0;
}

export interface CompletedProgress {
  completed: number;
  generated: number;
  /** 0–100, for the bar only; the text is always "N of M completed". */
  percent: number;
  text: string;
}

/** Progress = Completed pieces / Pieces Generated. */
export function completedProgress(item: ItemLike): CompletedProgress {
  const completed = item.statusCounts.COMPLETED ?? 0;
  const generated = item.piecesGenerated;
  const percent = generated > 0 ? Math.min(100, Math.round((completed / generated) * 100)) : 0;
  return { completed, generated, percent, text: `${completed} of ${generated} completed` };
}

/**
 * Why an item needs a manager's attention (empty = nothing to review):
 * confirmed and generated pieces differ (either way), or any piece is on Hold,
 * Rejected or Cancelled.
 */
export function attentionReasons(item: ItemLike): string[] {
  const reasons: string[] = [];
  const confirmed = item.confirmedPieces ?? 0;
  if (confirmed > item.piecesGenerated) reasons.push('Drawing Confirmed Pieces is more than Pieces Generated');
  if (item.piecesGenerated > confirmed) reasons.push('Pieces Generated is more than Drawing Confirmed Pieces');
  const hold = item.statusCounts.ON_HOLD ?? 0;
  const rejected = item.statusCounts.REJECTED ?? 0;
  const cancelled = item.statusCounts.CANCELLED ?? 0;
  const t = item.technical;
  if (t && item.piecesGenerated > 0) {
    if (t.notAssigned > 0) reasons.push(`${t.notAssigned} ${t.notAssigned === 1 ? 'piece' : 'pieces'} not assigned`);
    if (t.notReleased > 0) reasons.push(`${t.notReleased} ${t.notReleased === 1 ? 'piece' : 'pieces'} not released`);
  }
  if (hold > 0) reasons.push(`${hold} on hold`);
  if (rejected > 0) reasons.push(`${rejected} rejected`);
  if (cancelled > 0) reasons.push(`${cancelled} cancelled`);
  return reasons;
}

export function needsAttention(item: ItemLike): boolean {
  return attentionReasons(item).length > 0;
}

export interface ContractProgressTotals {
  confirmedPieces: number;
  piecesGenerated: number;
  releasedToProduction: number;
  produced: number;
  delivered: number;
  erected: number;
  completed: number;
  needsAttention: number;
}

/** Totals across every BOQ item of the contract (status figures are pieces currently in that status). */
export function contractTotals(items: ItemLike[]): ContractProgressTotals {
  const sum = (fn: (i: ItemLike) => number): number => items.reduce((total, i) => total + fn(i), 0);
  return {
    confirmedPieces: sum((i) => i.confirmedPieces ?? 0),
    piecesGenerated: sum((i) => i.piecesGenerated),
    releasedToProduction: sum((i) => i.technical?.released ?? 0),
    produced: sum((i) => i.statusCounts.PRODUCED ?? 0),
    delivered: sum((i) => i.statusCounts.DELIVERED ?? 0),
    erected: sum((i) => i.statusCounts.ERECTED ?? 0),
    completed: sum((i) => i.statusCounts.COMPLETED ?? 0),
    needsAttention: items.filter(needsAttention).length,
  };
}

export const TOTAL_CARDS: { key: keyof ContractProgressTotals; label: string }[] = [
  { key: 'confirmedPieces', label: 'Confirmed Pieces' },
  { key: 'piecesGenerated', label: 'Pieces Generated' },
  { key: 'releasedToProduction', label: 'Released to Production' },
  { key: 'produced', label: 'Produced' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
  { key: 'needsAttention', label: 'Needs Attention' },
];

export const MESSAGES = {
  noItems: 'No BOQ items found.',
  noConfirmations: 'Technical has not confirmed drawing pieces yet.',
  notGenerated: 'Pieces have not been generated yet.',
  noPieces: 'No pieces found.',
  attentionHelp: 'Some pieces need review.',
  noGroups: 'No drawing groups created yet.',
  noneReleased: 'No pieces released to Production yet.',
  releaseHelp: 'Production can start only after Technical release.',
} as const;

/** The plain message for an item that has nothing to track yet, or null once pieces exist. */
export function itemStateMessage(item: ItemLike): string | null {
  const hasConfirmed = item.confirmations.some((c) => c.confirmationStatus === 'CONFIRMED');
  if (!hasConfirmed && item.piecesGenerated === 0) return MESSAGES.noConfirmations;
  if (item.piecesGenerated === 0 && !Object.values(item.statusCounts).some((n) => (n ?? 0) > 0)) return MESSAGES.notGenerated;
  return null;
}

const UNIT_DISPLAY: Record<string, string> = { nos: 'Nos', 'm²': 'M²', 'm³': 'M³', lm: 'LM' };

/** "500 M²" — Contract Qty with its unit. */
export function contractQtyText(item: { contractQty: string | null; contractUnit: string | null }): string {
  if (item.contractQty === null) return '—';
  const unit = item.contractUnit ? (UNIT_DISPLAY[item.contractUnit] ?? item.contractUnit) : '';
  return [String(parseFloat(item.contractQty)), unit].filter(Boolean).join(' ');
}

/** The progress flow: Confirmed → Generated → Released → Produced → Delivered → Completed, with the count under each step. */
export function progressFlow(item: ItemLike): { key: string; label: string; count: number | null }[] {
  const c = item.statusCounts;
  return [
    { key: 'confirmed', label: 'Confirmed', count: item.confirmedPieces },
    { key: 'generated', label: 'Generated', count: item.piecesGenerated },
    { key: 'released', label: 'Released', count: item.technical ? item.technical.released : null },
    { key: 'produced', label: 'Produced', count: c.PRODUCED ?? 0 },
    { key: 'delivered', label: 'Delivered', count: c.DELIVERED ?? 0 },
    { key: 'completed', label: 'Completed', count: c.COMPLETED ?? 0 },
  ];
}

/** Plain note for the Technical Release box: no groups yet / nothing released yet / null. */
export function technicalReleaseNote(item: ItemLike, groupCount: number): string | null {
  if (!item.technical || item.piecesGenerated === 0) return null;
  if (groupCount === 0) return MESSAGES.noGroups;
  if (item.technical.released === 0) return MESSAGES.noneReleased;
  return null;
}

/** How a piece shows in View Pieces: its Technical release state. */
export function pieceReleaseLabel(group: { status: string } | undefined): 'Released to Production' | 'Not released' | 'Not assigned' {
  if (!group) return 'Not assigned';
  return group.status === 'RELEASED_TO_PRODUCTION' ? 'Released to Production' : 'Not released';
}
