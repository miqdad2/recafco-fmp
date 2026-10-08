import type { BoqConfirmationItem } from '@/lib/technical-api';
import { contractTotals, MESSAGES } from '../../_lib/boq-progress-helpers';

// ---------------------------------------------------------------------------
// FMP-UI-29 — pure helpers for the redesigned Contract Management dashboard
// (/contracts/executive). Every number here comes from data the dashboard or
// the per-contract BOQ Progress endpoint already returns — nothing is
// invented, and nothing here writes anything.
// ---------------------------------------------------------------------------

export interface RecentContractCandidate {
  id: string;
  status: string;
  updatedAt: string;
}

/**
 * Default Contract/Project selection: the most recently updated ACTIVE
 * contract, falling back to the most recently updated contract of any
 * status if none is active. `recent` is already sorted most-recently-
 * updated-first by the API (contracts.service.ts's own `orderBy: {updatedAt:
 * 'desc'}`), so this is just "first ACTIVE, else first" — no re-sorting.
 */
export function pickDefaultContractId(recent: RecentContractCandidate[]): string | null {
  const active = recent.find((c) => c.status === 'ACTIVE');
  return active?.id ?? recent[0]?.id ?? null;
}

export interface BoqProgressDisplay {
  text: string;
  tone: 'neutral' | 'warning';
}

/**
 * The Recent Contracts table's compact "BOQ Progress" column. `items` is
 * `null` when the fetch failed; `[]`/all-zero when nothing has been
 * confirmed/generated yet — both read as "Not started", never an error.
 */
export function formatBoqProgressForRow(items: BoqConfirmationItem[] | null): BoqProgressDisplay {
  if (items === null || items.length === 0) return { text: 'Not started', tone: 'neutral' };
  const totals = contractTotals(items);
  if (totals.needsAttention > 0) return { text: 'Needs Attention', tone: 'warning' };
  if (totals.piecesGenerated === 0) return { text: 'Not started', tone: 'neutral' };
  return { text: `${totals.completed} / ${totals.piecesGenerated} completed`, tone: 'neutral' };
}

export interface FocusItem {
  label: string;
  value: number;
  href: string;
}

/**
 * "Today's Focus" — up to 5 of the SAME real figures already shown
 * elsewhere on this page (Needs Attention panel, KPI row), filtered to only
 * the ones that are actually non-zero right now. Never a separate
 * computation, never a guess — if every figure is 0, the caller shows
 * "No urgent items." instead of this list.
 */
export function buildTodaysFocus(input: {
  approvalsWaiting: number;
  paymentsPending: number;
  claimsToReview: number;
  boqItemsNeedingReview: number;
  contractsClosingSoon: number;
}): FocusItem[] {
  const candidates: FocusItem[] = [
    { label: 'Approvals waiting', value: input.approvalsWaiting, href: '/contracts' },
    { label: 'Payments pending', value: input.paymentsPending, href: '/contracts/payments' },
    { label: 'Claims to review', value: input.claimsToReview, href: '/contracts/claims' },
    { label: 'BOQ items needing review', value: input.boqItemsNeedingReview, href: '/contracts' },
    { label: 'Contracts closing soon', value: input.contractsClosingSoon, href: '/contracts' },
  ];
  return candidates.filter((item) => item.value > 0).slice(0, 5);
}

export interface AttentionRow {
  label: string;
  value: number;
  href: string;
  tone: 'error' | 'warning' | 'neutral';
}

/**
 * The Needs Attention panel's fixed 6 rows, per this unit's own required
 * list. Always returns all 6 (never hidden when 0 — "if count is 0, show
 * neutral", per this unit's own instruction), so the panel reads as 6
 * status figures, not an alert list that disappears when things are fine.
 */
export function buildNeedsAttentionRows(input: {
  pendingApprovals: number;
  overdueWorkflowTasks: number;
  openClaims: number;
  outstandingPayments: number;
  boqItemsNeedingReview: number;
  criticalContracts: number;
}): AttentionRow[] {
  return [
    { label: 'Pending Approvals', value: input.pendingApprovals, href: '/contracts', tone: 'warning' },
    { label: 'Overdue Workflow Tasks', value: input.overdueWorkflowTasks, href: '/contracts/workflow?mode=overdue', tone: 'error' },
    { label: 'Open Claims', value: input.openClaims, href: '/contracts/claims', tone: 'warning' },
    { label: 'Outstanding Payments', value: input.outstandingPayments, href: '/contracts/payments', tone: 'warning' },
    { label: 'BOQ Items Needing Review', value: input.boqItemsNeedingReview, href: '/contracts', tone: 'warning' },
    { label: 'Critical Contracts', value: input.criticalContracts, href: '/contracts', tone: 'error' },
  ];
}

/** This unit's own exact wording for a selected contract with literally no BOQ items. */
export const NO_BOQ_ITEMS_FOR_CONTRACT = 'No BOQ progress found for this contract.';

/**
 * The Selected Contract Progress card's one-line state message — `null`
 * means "show the real Confirmed→Completed numbers instead". Reuses
 * `MESSAGES.noConfirmations`/`MESSAGES.notGenerated` verbatim (this unit's
 * own required wording for those two states matches the per-contract BOQ
 * Progress tab's existing wording exactly); only the "no BOQ items at all"
 * message is this page's own (the per-contract tab's `MESSAGES.noItems`
 * reads "No BOQ items found.", a different wording for the same case).
 */
export function selectedContractProgressState(items: BoqConfirmationItem[] | null): string | null {
  if (items === null) return 'BOQ progress could not be loaded for this contract.';
  if (items.length === 0) return NO_BOQ_ITEMS_FOR_CONTRACT;
  const totals = contractTotals(items);
  if (totals.confirmedPieces === 0) return MESSAGES.noConfirmations;
  if (totals.piecesGenerated === 0) return MESSAGES.notGenerated;
  return null;
}

/** Selected Contract Issues — real per-item/per-piece sums for the one selected contract, never hidden/invented. */
export interface SelectedContractIssue {
  text: string;
}

export function buildSelectedContractIssues(items: BoqConfirmationItem[] | null): SelectedContractIssue[] {
  if (items === null || items.length === 0) return [];
  const totals = contractTotals(items);
  const onHold = items.reduce((sum, i) => sum + (i.statusCounts.ON_HOLD ?? 0), 0);
  const rejected = items.reduce((sum, i) => sum + (i.statusCounts.REJECTED ?? 0), 0);
  const issues: SelectedContractIssue[] = [];
  if (totals.needsAttention > 0) {
    issues.push({ text: `${totals.needsAttention} BOQ item${totals.needsAttention === 1 ? '' : 's'} need${totals.needsAttention === 1 ? 's' : ''} review` });
  }
  if (onHold > 0) issues.push({ text: `${onHold} piece${onHold === 1 ? '' : 's'} on hold` });
  if (rejected > 0) issues.push({ text: `${rejected} rejected piece${rejected === 1 ? '' : 's'}` });
  return issues;
}
