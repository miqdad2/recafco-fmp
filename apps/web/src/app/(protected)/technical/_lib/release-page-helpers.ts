import type { BoqPieceStatus, ElementCoverageRow } from '@/lib/technical-api';
import { BOQ_PIECE_STATUS_LABELS } from './boq-confirmation-helpers';

// ---------------------------------------------------------------------------
// FMP-TECH-31 — plain-language pieces of the Release to Production page. Nothing
// here changes data; release details come from what the API already stores, and
// anything it does not hold is shown as a dash rather than invented.
// ---------------------------------------------------------------------------

export const PRODUCTION_RECEIVES_TEXT = 'Production receives individual elements only after release from Technical.';
export const RELEASE_SUCCESS_TEXT = 'Elements released to Production successfully.';

export interface ReleaseSections {
  /** Have a final drawing (group or own) and can be released now. */
  ready: ElementCoverageRow[];
  /** Already released — they stay on the page. */
  released: ElementCoverageRow[];
  /** No final drawing yet; cannot be released. */
  waiting: ElementCoverageRow[];
}

export function splitForRelease(elements: ElementCoverageRow[]): ReleaseSections {
  return {
    ready: elements.filter((e) => e.releaseState === 'READY'),
    released: elements.filter((e) => e.releaseState === 'RELEASED'),
    waiting: elements.filter((e) => e.releaseState === 'WAITING'),
  };
}

export type DrawingSourceLabel = 'Group Drawing' | 'Individual Drawing';

/** Where the element's final drawing comes from. For a released element, how it was released. */
export function drawingSourceLabel(e: Pick<ElementCoverageRow, 'group' | 'releaseState' | 'releasedVia'>): DrawingSourceLabel {
  if (e.releaseState === 'RELEASED' && e.releasedVia) return e.releasedVia === 'GROUP' ? 'Group Drawing' : 'Individual Drawing';
  return e.group ? 'Group Drawing' : 'Individual Drawing';
}

/** Why an element is still blocked. */
export function waitingReason(e: Pick<ElementCoverageRow, 'group'>): string {
  return e.group ? 'Group missing final drawing' : 'No final drawing uploaded';
}

/** The group's own name when it has one, otherwise its drawing reference; "—" for an element without a group. */
export function groupDisplayName(e: Pick<ElementCoverageRow, 'group'>): string {
  if (!e.group) return '—';
  return e.group.groupTitle || e.group.drawingNo;
}

export function formatReleaseTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** What Production has done with a released element (DRAWING_READY means it has not started yet). */
export function productionStatusText(status: BoqPieceStatus): string {
  return status === 'DRAWING_READY' ? 'Waiting for Production' : BOQ_PIECE_STATUS_LABELS[status];
}

export function releaseConfirmMessage(count: number): string {
  return `You are releasing ${count} ${count === 1 ? 'element' : 'elements'} to Production. Production will be able to start work on these elements.`;
}

/** "Beam — 3 elements" lines for the confirmation dialog, one per BOQ item. */
export function releaseBreakdown(elements: Pick<ElementCoverageRow, 'boqItemSortOrder' | 'boqItemDescription'>[]): string[] {
  const counts = new Map<string, { order: number; text: string; n: number }>();
  for (const e of elements) {
    const key = `${e.boqItemSortOrder}|${e.boqItemDescription}`;
    const entry = counts.get(key) ?? { order: e.boqItemSortOrder, text: `${e.boqItemSortOrder}. ${e.boqItemDescription}`, n: 0 };
    entry.n += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => a.order - b.order).map((c) => `${c.text} — ${c.n} ${c.n === 1 ? 'element' : 'elements'}`);
}
