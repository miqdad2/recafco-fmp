import type { BoqConfirmationItem, BoqPieceStatus, ElementCoverageRow } from '@/lib/technical-api';
import { BOQ_PIECE_STATUS_LABELS } from '../../technical/_lib/boq-confirmation-helpers';

// ---------------------------------------------------------------------------
// FMP-BOQ-18 (BOQ Progress) — pure counting and wording helpers for the Contract
// BOQ Progress page. Everything is derived from data the API already returns:
//   - the BOQ item list (confirmed / generated elements, element counts by status),
//   - the element coverage list (one row per element: status, Technical release,
//     final drawing coverage, drawing group).
// Nothing here writes anything, and no Technical / Production rule lives here.
//
// Two kinds of numbers are used and kept apart on purpose:
//   - CURRENT counts: how many elements are at a step right now (an element that
//     has moved on is no longer counted there). Produced includes elements already
//     sent to the Storage Yard, as everywhere else on the platform;
//   - REACHED counts: how many elements have got to a step or beyond (Produced,
//     Delivered, Erected, Completed in the top summary).
// "Released to Production" is neither: it is a Technical decision recorded once
// per element, whether it was released through a drawing group or on its own.
// ---------------------------------------------------------------------------

export const ELEMENT_TEXT = {
  title: 'BOQ Progress',
  subtitle: 'Track BOQ items and individual elements from Technical through Production, Delivery and Erection.',
  noItems: 'No BOQ items found.',
  noElements: 'No elements found.',
  notConfirmed: 'Technical has not confirmed elements for this BOQ item yet.',
  notGenerated: 'Elements have not been generated yet.',
  summaryNote:
    'In Production is how many elements are being made now. Produced, Delivered, Erected and Completed count every element that has reached that step, including ones that have moved on. Released to Production counts every element Technical has released, in a drawing group or on its own.',
  itemNote: 'Numbers below show where each element is right now.',
  releaseUnavailable: 'Release details could not be loaded, so release counts are not shown.',
} as const;

/** Statuses before Production starts. */
const EARLY: readonly BoqPieceStatus[] = ['NOT_STARTED', 'DRAWING_READY'];
/** Statuses that mean production has started or finished — an element here should have a release record. */
const PAST_RELEASE: readonly BoqPieceStatus[] = ['IN_PRODUCTION', 'PRODUCED', 'SENT_TO_STORAGE', 'IN_STORE', 'DELIVERED', 'ERECTED', 'COMPLETED'];

export function isEarlyStatus(status: BoqPieceStatus): boolean {
  return EARLY.includes(status);
}

type ReleaseState = ElementCoverageRow['releaseState'];

/** One element as the View Elements list needs it: the piece plus its release / drawing state (null = coverage not loaded). */
export interface ElementView {
  id: string;
  status: BoqPieceStatus;
  releaseState: ReleaseState | null;
  coverage: ElementCoverageRow['coverage'] | null;
}

// --- Filters (also the targets of the reason buttons) -------------------------

export type ElementFilterKey =
  | 'ALL'
  | 'GENERATED'
  | 'WAITING_DRAWING'
  | 'WAITING_RELEASE'
  | 'WAITING_PRODUCTION'
  | 'IN_PRODUCTION'
  | 'PRODUCED'
  | 'IN_STORAGE'
  | 'DELIVERY_PENDING'
  | 'DELIVERED'
  | 'ERECTED'
  | 'COMPLETED'
  | 'HOLD'
  | 'REJECTED'
  | 'CANCELLED'
  | 'NO_RELEASE_RECORD';

export const ELEMENT_FILTER_LABELS: Record<ElementFilterKey, string> = {
  ALL: 'All',
  GENERATED: 'Generated',
  WAITING_DRAWING: 'Waiting Final Drawing',
  WAITING_RELEASE: 'Waiting for Technical Release',
  WAITING_PRODUCTION: 'Waiting for Production',
  IN_PRODUCTION: 'In Production',
  PRODUCED: 'Produced',
  IN_STORAGE: 'In Storage',
  DELIVERY_PENDING: 'Delivery Pending',
  DELIVERED: 'Delivered',
  ERECTED: 'Erected',
  COMPLETED: 'Completed',
  HOLD: 'On Hold',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  NO_RELEASE_RECORD: 'No Release Record',
};

export function matchesElementFilter(el: ElementView, key: ElementFilterKey): boolean {
  const early = isEarlyStatus(el.status);
  switch (key) {
    case 'ALL': return true;
    case 'GENERATED': return early;
    case 'WAITING_DRAWING': return early && el.releaseState === 'WAITING';
    case 'WAITING_RELEASE': return early && el.releaseState === 'READY';
    case 'WAITING_PRODUCTION': return early && el.releaseState === 'RELEASED';
    case 'IN_PRODUCTION': return el.status === 'IN_PRODUCTION';
    // Same convention as the rest of the platform: Produced includes elements already sent to the Storage Yard.
    case 'PRODUCED': return el.status === 'PRODUCED' || el.status === 'SENT_TO_STORAGE';
    case 'IN_STORAGE': return el.status === 'IN_STORE';
    case 'DELIVERY_PENDING': return el.status === 'SENT_TO_STORAGE' || el.status === 'IN_STORE';
    case 'DELIVERED': return el.status === 'DELIVERED';
    case 'ERECTED': return el.status === 'ERECTED';
    case 'COMPLETED': return el.status === 'COMPLETED';
    case 'HOLD': return el.status === 'ON_HOLD';
    case 'REJECTED': return el.status === 'REJECTED';
    case 'CANCELLED': return el.status === 'CANCELLED';
    case 'NO_RELEASE_RECORD': return PAST_RELEASE.includes(el.status) && el.releaseState !== null && el.releaseState !== 'RELEASED';
  }
}

// --- Plain wording for one element --------------------------------------------

/** The department (or step) that currently holds the element. */
export function elementStage(status: BoqPieceStatus, releaseState: ReleaseState | null): string {
  switch (status) {
    case 'NOT_STARTED':
    case 'DRAWING_READY':
      return releaseState === 'RELEASED' ? 'Production' : 'Technical';
    case 'IN_PRODUCTION':
    case 'PRODUCED':
      return 'Production';
    case 'SENT_TO_STORAGE':
    case 'IN_STORE':
    case 'DELIVERED':
      return 'Storage Yard & Delivery';
    case 'ERECTED':
      return 'Erection';
    case 'COMPLETED':
      return 'Completed';
    case 'ON_HOLD':
    case 'REJECTED':
      return 'Needs review';
    case 'CANCELLED':
      return '—';
  }
}

/** The status in words a factory user understands (the stored code is never shown). */
export function elementStatusLabel(status: BoqPieceStatus, releaseState: ReleaseState | null): string {
  if (isEarlyStatus(status)) {
    if (releaseState === 'RELEASED') return 'Waiting for Production';
    if (releaseState === 'READY') return 'Waiting for Technical release';
    if (releaseState === 'WAITING') return 'Waiting for final drawing';
    return 'Elements Generated';
  }
  if (status === 'ON_HOLD') return 'On Hold';
  return BOQ_PIECE_STATUS_LABELS[status];
}

/** The element's drawing state: its final drawing and Technical release. */
export function elementDrawingStatus(releaseState: ReleaseState | null, coverage: ElementCoverageRow['coverage'] | null): string {
  if (releaseState === null || coverage === null) return '—';
  if (releaseState === 'RELEASED') return 'Released to Production';
  if (releaseState === 'READY') return 'Final drawing ready — not released';
  return 'Final drawing missing';
}

// --- Item and contract numbers ----------------------------------------------------

export interface ElementTile {
  key: ElementFilterKey;
  label: string;
  /** null = could not be worked out (release details not loaded). */
  count: number | null;
}

export type ReasonTone = 'attention' | 'waiting';

export interface ItemReason {
  key: string;
  label: string;
  count: number;
  tone: ReasonTone;
  /** Opens the element list on these elements; null when no single list fits (for example a count mismatch). */
  filter: ElementFilterKey | null;
}

export interface ItemSummary {
  confirmed: number | null;
  generated: number;
  /** null when release details are not available. */
  released: number | null;
  tiles: ElementTile[];
  reasons: ItemReason[];
  /** True when at least one reason needs action (not just a next step). */
  needsAttention: boolean;
}

type ItemInput = Pick<BoqConfirmationItem, 'confirmedPieces' | 'piecesGenerated' | 'statusCounts'>;

function count(item: ItemInput, ...statuses: BoqPieceStatus[]): number {
  return statuses.reduce((sum, s) => sum + (item.statusCounts[s] ?? 0), 0);
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * Where an item's elements are right now, how many are released, and what is holding things up.
 * `rows` are the item's coverage rows (cancelled elements are not in them); null = not loaded.
 */
export function summarizeItem(item: ItemInput, rows: ElementCoverageRow[] | null): ItemSummary {
  const generated = item.piecesGenerated;
  const confirmed = item.confirmedPieces;

  const early = rows?.filter((r) => isEarlyStatus(r.currentStatus)) ?? null;
  const waitingTechnical = early ? early.filter((r) => r.releaseState !== 'RELEASED').length : null;
  const waitingProduction = early ? early.filter((r) => r.releaseState === 'RELEASED').length : null;
  const released = rows ? rows.filter((r) => r.releaseState === 'RELEASED').length : null;

  const tiles: ElementTile[] = [
    ...(early
      ? [
          { key: 'WAITING_RELEASE' as const, label: 'Waiting for Technical Release', count: waitingTechnical },
          { key: 'WAITING_PRODUCTION' as const, label: 'Waiting for Production', count: waitingProduction },
        ]
      : [{ key: 'GENERATED' as const, label: 'Generated (not started)', count: count(item, 'DRAWING_READY', 'NOT_STARTED') }]),
    { key: 'IN_PRODUCTION', label: 'In Production', count: count(item, 'IN_PRODUCTION') },
    { key: 'PRODUCED', label: 'Produced', count: count(item, 'PRODUCED', 'SENT_TO_STORAGE') },
    { key: 'IN_STORAGE', label: 'In Storage', count: count(item, 'IN_STORE') },
    { key: 'DELIVERED', label: 'Delivered', count: count(item, 'DELIVERED') },
    { key: 'ERECTED', label: 'Erected', count: count(item, 'ERECTED') },
    { key: 'COMPLETED', label: 'Completed', count: count(item, 'COMPLETED') },
    { key: 'HOLD', label: 'On Hold / Rejected', count: count(item, 'ON_HOLD', 'REJECTED') },
  ];

  const reasons: ItemReason[] = [];
  const add = (r: ItemReason): void => {
    if (r.count > 0) reasons.push(r);
  };

  // Things that need someone to act.
  const hold = count(item, 'ON_HOLD');
  const rejected = count(item, 'REJECTED');
  const cancelled = count(item, 'CANCELLED');
  add({ key: 'hold', label: 'Production on hold', count: hold, tone: 'attention', filter: 'HOLD' });
  add({ key: 'rejected', label: 'Rejected elements', count: rejected, tone: 'attention', filter: 'REJECTED' });
  add({ key: 'cancelled', label: 'Cancelled elements', count: cancelled, tone: 'attention', filter: 'CANCELLED' });
  if (rows) {
    const noRecord = rows.filter((r) => PAST_RELEASE.includes(r.currentStatus) && r.releaseState !== 'RELEASED').length;
    add({ key: 'noRelease', label: 'In Production or later without a Technical release record', count: noRecord, tone: 'attention', filter: 'NO_RELEASE_RECORD' });
  }
  if (confirmed !== null && confirmed !== generated) {
    add({
      key: 'mismatch',
      label: `Confirmed and generated elements differ (${confirmed} confirmed, ${generated} generated)`,
      count: Math.abs(confirmed - generated),
      tone: 'attention',
      filter: null,
    });
  }

  // Next steps that are simply not done yet (not a problem on their own).
  if (rows) {
    const missing = rows.filter((r) => isEarlyStatus(r.currentStatus) && r.releaseState === 'WAITING').length;
    const ready = rows.filter((r) => isEarlyStatus(r.currentStatus) && r.releaseState === 'READY').length;
    add({ key: 'drawing', label: 'Final drawing missing', count: missing, tone: 'waiting', filter: 'WAITING_DRAWING' });
    add({ key: 'release', label: 'Waiting for Technical release', count: ready, tone: 'waiting', filter: 'WAITING_RELEASE' });
  }
  add({ key: 'delivery', label: 'Delivery pending', count: count(item, 'SENT_TO_STORAGE', 'IN_STORE'), tone: 'waiting', filter: 'DELIVERY_PENDING' });
  add({ key: 'erection', label: 'Erection pending', count: count(item, 'DELIVERED'), tone: 'waiting', filter: 'DELIVERED' });

  return { confirmed, generated, released, tiles, reasons, needsAttention: reasons.some((r) => r.tone === 'attention') };
}

/** "Final drawing missing — 2 elements". */
export function reasonText(r: ItemReason): string {
  return r.key === 'mismatch' ? r.label : `${r.label}: ${plural(r.count, 'element', 'elements')}`;
}

export interface ContractSummary {
  boqItems: number;
  confirmed: number;
  /** null when release details are not available. */
  released: number | null;
  inProduction: number;
  produced: number;
  delivered: number;
  erected: number;
  completed: number;
  /** BOQ items with at least one reason that needs action. */
  itemsNeedingAttention: number;
}

export function summarizeContract(items: (ItemInput & { boqItemId: string })[], rows: ElementCoverageRow[] | null): ContractSummary {
  const sum = (...statuses: BoqPieceStatus[]): number => items.reduce((n, i) => n + count(i, ...statuses), 0);
  const rowsByItem = (id: string): ElementCoverageRow[] | null => (rows ? rows.filter((r) => r.boqItemId === id) : null);
  return {
    boqItems: items.length,
    confirmed: items.reduce((n, i) => n + (i.confirmedPieces ?? 0), 0),
    released: rows ? rows.filter((r) => r.releaseState === 'RELEASED').length : null,
    inProduction: sum('IN_PRODUCTION'),
    produced: sum('PRODUCED', 'SENT_TO_STORAGE', 'IN_STORE', 'DELIVERED', 'ERECTED', 'COMPLETED'),
    delivered: sum('DELIVERED', 'ERECTED', 'COMPLETED'),
    erected: sum('ERECTED', 'COMPLETED'),
    completed: sum('COMPLETED'),
    itemsNeedingAttention: items.filter((i) => summarizeItem(i, rowsByItem(i.boqItemId)).needsAttention).length,
  };
}

/** "N of M completed" for the item bar (completed elements out of generated elements). */
export function completedText(item: ItemInput): { completed: number; generated: number; percent: number; text: string } {
  const completed = item.statusCounts.COMPLETED ?? 0;
  const generated = item.piecesGenerated;
  const percent = generated > 0 ? Math.min(100, Math.round((completed / generated) * 100)) : 0;
  return { completed, generated, percent, text: `${completed} of ${generated} completed` };
}

/** The one plain line shown instead of numbers while there is nothing to track yet, or null. */
export function itemStateMessage(item: ItemInput): string | null {
  if ((item.confirmedPieces ?? 0) === 0 && item.piecesGenerated === 0) return ELEMENT_TEXT.notConfirmed;
  if (item.piecesGenerated === 0) return ELEMENT_TEXT.notGenerated;
  return null;
}
