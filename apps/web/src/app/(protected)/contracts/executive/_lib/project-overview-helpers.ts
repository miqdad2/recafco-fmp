import type { BoqConfirmationItem } from '@/lib/technical-api';
import { contractTotals } from '../../_lib/boq-progress-helpers';

// ---------------------------------------------------------------------------
// FMP-UI-38 — pure helpers for the common Contract Management overview
// (/contracts/executive). Everything here is derived from data the contract
// list and the per-contract BOQ Progress endpoint already return — nothing is
// invented, nothing is written, and no permission rule lives here.
// ---------------------------------------------------------------------------

/** Piece counts for one contract, summed over its BOQ items. */
export interface ProjectProgress {
  confirmed: number;
  generated: number;
  /** Pieces currently in each status (not cumulative). */
  inProduction: number;
  produced: number;
  inStore: number;
  delivered: number;
  erected: number;
  completed: number;
  /** BOQ items that need a review (mismatch, hold, rejected …). */
  needsReview: number;
  /** The contract has at least one BOQ item. */
  hasItems: boolean;
}

/** null = the BOQ could not be loaded, so nothing is claimed. */
export function summarizeProgress(items: BoqConfirmationItem[] | null): ProjectProgress | null {
  if (items === null) return null;
  const totals = contractTotals(items);
  const sum = (key: 'IN_PRODUCTION' | 'IN_STORE'): number => items.reduce((n, i) => n + (i.statusCounts[key] ?? 0), 0);
  return {
    confirmed: totals.confirmedPieces,
    generated: totals.piecesGenerated,
    inProduction: sum('IN_PRODUCTION'),
    produced: totals.produced,
    inStore: sum('IN_STORE'),
    delivered: totals.delivered,
    erected: totals.erected,
    completed: totals.completed,
    needsReview: totals.needsAttention,
    hasItems: items.length > 0,
  };
}

/** Pieces that have reached (or passed) each stage — what the table's columns show. */
export function reached(p: ProjectProgress): { produced: number; delivered: number; erected: number; productionStarted: number } {
  const erected = p.erected + p.completed;
  const delivered = p.delivered + erected;
  const produced = p.produced + p.inStore + delivered;
  return { produced, delivered, erected, productionStarted: p.inProduction + produced };
}

// --- Needs Attention reasons ------------------------------------------------

export type ReasonKey =
  | 'APPROVAL'
  | 'BOQ_REVIEW'
  | 'CLAIMS'
  | 'BOQ_NOT_CONFIRMED'
  | 'PRODUCTION_NOT_STARTED'
  | 'DELIVERY_PENDING'
  | 'ERECTION_PENDING';

export interface Reason {
  key: ReasonKey;
  label: string;
  /** 'attention' = something to act on; 'pending' = the next step simply has not happened yet. */
  kind: 'attention' | 'pending';
}

const REASON_LABELS: Record<ReasonKey, { label: string; kind: Reason['kind'] }> = {
  APPROVAL: { label: 'Pending approval', kind: 'attention' },
  BOQ_REVIEW: { label: 'BOQ needs review', kind: 'attention' },
  CLAIMS: { label: 'Open claims', kind: 'attention' },
  BOQ_NOT_CONFIRMED: { label: 'BOQ not confirmed', kind: 'pending' },
  PRODUCTION_NOT_STARTED: { label: 'Production not started', kind: 'pending' },
  DELIVERY_PENDING: { label: 'Delivery pending', kind: 'pending' },
  ERECTION_PENDING: { label: 'Erection pending', kind: 'pending' },
};

/** Statuses that still have work in front of them. */
export function isLiveStatus(status: string): boolean {
  return status === 'DRAFT' || status === 'ACTIVE';
}

export function buildReasons(input: { status: string; openClaims: number; progress: ProjectProgress | null }): Reason[] {
  const keys: ReasonKey[] = [];
  const { status, progress } = input;
  if (status === 'DRAFT') keys.push('APPROVAL');
  if (status === 'ACTIVE' && progress) {
    const r = reached(progress);
    if (progress.needsReview > 0) keys.push('BOQ_REVIEW');
    if (progress.confirmed === 0) keys.push('BOQ_NOT_CONFIRMED');
    else if (progress.generated > 0 && r.productionStarted === 0) keys.push('PRODUCTION_NOT_STARTED');
    if (progress.produced + progress.inStore > 0) keys.push('DELIVERY_PENDING');
    if (progress.delivered > 0) keys.push('ERECTION_PENDING');
  }
  if (isLiveStatus(status) && input.openClaims > 0) keys.push('CLAIMS');
  return keys.map((key) => ({ key, ...REASON_LABELS[key] }));
}

// --- Rows -------------------------------------------------------------------

export interface ProjectRow {
  id: string;
  referenceNumber: string;
  title: string;
  status: string;
  client: string;
  jobOrder: string | null;
  openClaims: number;
  /** null = BOQ not loaded (yet). */
  progress: ProjectProgress | null;
  reasons: Reason[];
}

export function buildProjectRow(input: Omit<ProjectRow, 'reasons'>): ProjectRow {
  return { ...input, reasons: buildReasons({ status: input.status, openClaims: input.openClaims, progress: input.progress }) };
}

// --- Filters ----------------------------------------------------------------

export type ProjectFilter = 'ALL' | 'ACTIVE' | 'ATTENTION' | 'BOQ_IN_PROGRESS' | 'PRODUCTION_STARTED' | 'DELIVERED' | 'ERECTED' | 'COMPLETED';

export const FILTER_CHIPS: { key: ProjectFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'ATTENTION', label: 'Needs Attention' },
  { key: 'BOQ_IN_PROGRESS', label: 'BOQ In Progress' },
  { key: 'PRODUCTION_STARTED', label: 'Production Started' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'ERECTED', label: 'Erected' },
  { key: 'COMPLETED', label: 'Completed' },
];

export function isBoqInProgress(row: ProjectRow): boolean {
  return !!row.progress && row.progress.generated > 0 && row.progress.completed < row.progress.generated;
}

export function isCompleted(row: ProjectRow): boolean {
  if (row.status === 'CLOSED') return true;
  return !!row.progress && row.progress.generated > 0 && row.progress.completed === row.progress.generated;
}

export function matchesFilter(row: ProjectRow, filter: ProjectFilter): boolean {
  const p = row.progress;
  switch (filter) {
    case 'ALL': return true;
    case 'ACTIVE': return row.status === 'ACTIVE';
    case 'ATTENTION': return row.reasons.some((r) => r.kind === 'attention');
    case 'BOQ_IN_PROGRESS': return isBoqInProgress(row);
    case 'PRODUCTION_STARTED': return !!p && reached(p).productionStarted > 0;
    case 'DELIVERED': return !!p && reached(p).delivered > 0;
    case 'ERECTED': return !!p && reached(p).erected > 0;
    case 'COMPLETED': return isCompleted(row);
  }
}

export function matchesSearch(row: ProjectRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return [row.referenceNumber, row.title, row.jobOrder ?? '', row.client].some((v) => v.toLowerCase().includes(q));
}

export function filterRows(
  rows: ProjectRow[],
  opts: { query: string; filter: ProjectFilter; reason: ReasonKey | null },
): ProjectRow[] {
  return rows.filter(
    (r) =>
      matchesSearch(r, opts.query) &&
      matchesFilter(r, opts.filter) &&
      (opts.reason === null || r.reasons.some((x) => x.key === opts.reason)),
  );
}

// --- Needs Attention panel --------------------------------------------------

export interface AttentionPanelRow {
  /** Filters the table to this reason. */
  reason: ReasonKey | null;
  label: string;
  value: number | null;
  tone: 'error' | 'warning' | 'neutral';
  /** A link out instead of a table filter (no per-contract data behind it). */
  href?: string;
}

/** The panel's fixed rows, in the order of the work. Counts are for the contracts in the list. */
export function buildAttentionPanelRows(rows: ProjectRow[], paymentsPending: number | null): AttentionPanelRow[] {
  const count = (key: ReasonKey): number => rows.filter((r) => r.reasons.some((x) => x.key === key)).length;
  return [
    { reason: 'APPROVAL', label: 'Pending Approval', value: count('APPROVAL'), tone: 'warning' },
    { reason: 'BOQ_NOT_CONFIRMED', label: 'BOQ Not Confirmed', value: count('BOQ_NOT_CONFIRMED'), tone: 'warning' },
    { reason: 'PRODUCTION_NOT_STARTED', label: 'Production Not Started', value: count('PRODUCTION_NOT_STARTED'), tone: 'warning' },
    { reason: 'DELIVERY_PENDING', label: 'Delivery Pending', value: count('DELIVERY_PENDING'), tone: 'neutral' },
    { reason: 'ERECTION_PENDING', label: 'Erection Pending', value: count('ERECTION_PENDING'), tone: 'neutral' },
    { reason: null, label: 'Payments Pending', value: paymentsPending, tone: 'warning', href: '/contracts/payments' },
    { reason: 'CLAIMS', label: 'Open Claims / Issues', value: count('CLAIMS'), tone: 'error' },
  ];
}

// --- Display text -----------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  TERMINATED: 'Terminated',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

/** Plain one-line BOQ state for the table. */
export function boqProgressText(p: ProjectProgress | null): string {
  if (p === null) return '—';
  if (!p.hasItems) return 'No BOQ items';
  if (p.confirmed === 0) return 'Not confirmed';
  if (p.generated === 0) return 'Not generated';
  return `${p.completed} of ${p.generated} completed`;
}

/** "3 of 10" for a stage column; plain words when there is nothing to count yet. */
export function stageText(done: number, p: ProjectProgress | null): string {
  if (p === null) return '—';
  if (p.generated === 0) return '—';
  if (done === 0) return 'Not started';
  return `${done} of ${p.generated}`;
}

export function sumProgress(rows: ProjectRow[]): ProjectProgress {
  const zero: ProjectProgress = { confirmed: 0, generated: 0, inProduction: 0, produced: 0, inStore: 0, delivered: 0, erected: 0, completed: 0, needsReview: 0, hasItems: false };
  return rows.reduce<ProjectProgress>((acc, r) => {
    const p = r.progress;
    if (!p) return acc;
    return {
      confirmed: acc.confirmed + p.confirmed,
      generated: acc.generated + p.generated,
      inProduction: acc.inProduction + p.inProduction,
      produced: acc.produced + p.produced,
      inStore: acc.inStore + p.inStore,
      delivered: acc.delivered + p.delivered,
      erected: acc.erected + p.erected,
      completed: acc.completed + p.completed,
      needsReview: acc.needsReview + p.needsReview,
      hasItems: acc.hasItems || p.hasItems,
    };
  }, zero);
}

/** One plain message when the selected contract has no pieces to show yet, else null. */
export function selectedProgressMessage(p: ProjectProgress | null): string | null {
  if (p === null) return 'BOQ progress could not be loaded for this contract.';
  if (!p.hasItems) return 'No BOQ progress found for this contract.';
  if (p.confirmed === 0) return 'Technical has not confirmed drawing pieces yet.';
  if (p.generated === 0) return 'Pieces have not been generated yet.';
  return null;
}

// --- Row actions (permission gates reuse the contract list's existing rules) ---

export interface RowAction {
  key: string;
  label: string;
  href: string;
}

/**
 * View and BOQ are for everyone who can open the page. The rest only appear when the
 * user already holds the permission the same screen needs elsewhere:
 * Edit — contracts.update, Draft only (the edit page itself refuses other statuses);
 * Approve — contracts.activate, Draft only (opens the contract, where Activate lives);
 * Payments / Issues — contracts.update.
 */
export function rowActions(
  row: { id: string; status: string },
  permissions: string[],
): { primary: RowAction[]; more: RowAction[] } {
  const primary: RowAction[] = [
    { key: 'view', label: 'View', href: `/contracts/${row.id}` },
    { key: 'boq', label: 'BOQ', href: `/contracts/${row.id}/boq-progress` },
  ];
  const more: RowAction[] = [];
  const canUpdate = permissions.includes('contracts.update');
  if (row.status === 'DRAFT' && canUpdate) more.push({ key: 'edit', label: 'Edit', href: `/contracts/${row.id}/edit` });
  if (row.status === 'DRAFT' && permissions.includes('contracts.activate')) more.push({ key: 'approve', label: 'Approve', href: `/contracts/${row.id}` });
  if (canUpdate) {
    more.push({ key: 'payments', label: 'Payments', href: `/contracts/${row.id}/payments` });
    more.push({ key: 'issues', label: 'Issues', href: `/contracts/${row.id}/issues` });
  }
  return { primary, more };
}
