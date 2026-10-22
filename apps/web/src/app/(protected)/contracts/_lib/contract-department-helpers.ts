import type { BoqConfirmationItem, BoqPieceStatus, ElementCoverageRow } from '@/lib/technical-api';

// ---------------------------------------------------------------------------
// FMP-CONTRACT-DETAIL-01 — pure counting for the Technical / Production & Planning /
// Delivery / Erection tabs of one contract. Everything is derived from data the API
// already returns for that contract (BOQ confirmation status counts + element coverage);
// nothing is invented. A value of `null` means "not available" and renders as "—".
// ---------------------------------------------------------------------------

export interface DeptStat {
  label: string;
  value: number | null;
  /** Shown as a small caption (and tooltip when unavailable) — definitions and why a value is missing. */
  hint?: string | undefined;
}

const EARLY: readonly BoqPieceStatus[] = ['NOT_STARTED', 'DRAWING_READY'];
const isEarly = (s: BoqPieceStatus): boolean => EARLY.includes(s);

const COVERAGE_UNAVAILABLE = 'Element drawing details could not be loaded.';

function total(items: BoqConfirmationItem[], ...statuses: BoqPieceStatus[]): number {
  return items.reduce((n, i) => n + statuses.reduce((m, s) => m + (i.statusCounts[s] ?? 0), 0), 0);
}

function rowStat(label: string, rows: ElementCoverageRow[] | null, fn: (r: ElementCoverageRow) => boolean, hint?: string): DeptStat {
  return { label, value: rows ? rows.filter(fn).length : null, hint: rows ? hint : COVERAGE_UNAVAILABLE };
}

export function technicalStats(items: BoqConfirmationItem[], rows: ElementCoverageRow[] | null, initialDrawingCount: number | null): DeptStat[] {
  return [
    {
      label: 'Initial BOQ Drawings',
      value: initialDrawingCount,
      hint: initialDrawingCount === null ? 'Initial drawing files could not be loaded.' : 'Files attached to BOQ items.',
    },
    { label: 'Confirmed Elements', value: items.reduce((n, i) => n + (i.confirmedPieces ?? 0), 0) },
    rowStat('Elements with Final Drawings', rows, (r) => r.coverage !== 'NONE'),
    rowStat('Waiting for Drawings', rows, (r) => isEarly(r.currentStatus) && r.releaseState === 'WAITING'),
    rowStat('Released to Production', rows, (r) => r.releaseState === 'RELEASED'),
    rowStat('Waiting for Release', rows, (r) => isEarly(r.currentStatus) && r.releaseState === 'READY', 'Final drawing ready, not yet released.'),
  ];
}

export function productionStats(items: BoqConfirmationItem[], rows: ElementCoverageRow[] | null): DeptStat[] {
  return [
    rowStat('Ready for Production', rows, (r) => isEarly(r.currentStatus) && r.releaseState === 'RELEASED', 'Released by Technical, not yet started.'),
    { label: 'In Production', value: total(items, 'IN_PRODUCTION') },
    { label: 'Produced', value: total(items, 'PRODUCED', 'SENT_TO_STORAGE'), hint: 'Includes elements already sent to the Storage Yard.' },
    { label: 'On Hold / Rejected', value: total(items, 'ON_HOLD', 'REJECTED') },
    { label: 'Sent to Storage Yard', value: total(items, 'SENT_TO_STORAGE') },
  ];
}

export function deliveryStats(items: BoqConfirmationItem[]): DeptStat[] {
  return [
    { label: 'Sent to Storage Yard', value: total(items, 'SENT_TO_STORAGE'), hint: 'Produced and sent, not yet received in the store.' },
    { label: 'Elements in Store', value: total(items, 'IN_STORE') },
    { label: 'Ready for Delivery', value: total(items, 'IN_STORE'), hint: 'There is no separate "ready" status: an element in the store is ready for delivery.' },
    { label: 'Delivered', value: total(items, 'DELIVERED'), hint: 'Delivered, not yet erected.' },
    { label: 'Pending Delivery', value: total(items, 'SENT_TO_STORAGE', 'IN_STORE'), hint: 'Sent to the Storage Yard or in the store, not yet delivered.' },
  ];
}

export function erectionStats(items: BoqConfirmationItem[]): DeptStat[] {
  return [
    { label: 'Awaiting Erection', value: total(items, 'DELIVERED'), hint: 'Delivered, not yet erected.' },
    { label: 'In Erection', value: null, hint: 'The platform has no "in erection" element status, so this is not tracked.' },
    { label: 'Erected', value: total(items, 'ERECTED') },
    { label: 'Completed', value: total(items, 'COMPLETED') },
    { label: 'Hold / Rejected', value: null, hint: 'On Hold and Rejected are not recorded per department, so they cannot be attributed to Erection.' },
  ];
}

export interface DeptLink {
  label: string;
  href: string;
}

/** Links to the existing department screens — returned only when the viewer already holds that screen's read permission. */
export function departmentLink(
  dept: 'technical' | 'production' | 'delivery' | 'erection',
  contractId: string,
  permissions: string[],
): DeptLink | null {
  const has = (p: string): boolean => permissions.includes(p);
  switch (dept) {
    case 'technical':
      return has('technical.read') || has('contracts.read') ? { label: 'Open Technical workflow', href: `/technical/jobs/${contractId}` } : null;
    case 'production':
      return has('production.read') ? { label: 'Open Production Work', href: `/production/pieces?contractId=${contractId}` } : null;
    case 'delivery':
      return has('storage_delivery.read') ? { label: 'Open Storage Yard & Delivery', href: `/storage-delivery/pieces?contractId=${contractId}` } : null;
    case 'erection':
      return has('erection.read') ? { label: 'Open Erection', href: `/erection/pieces?contractId=${contractId}` } : null;
  }
}
