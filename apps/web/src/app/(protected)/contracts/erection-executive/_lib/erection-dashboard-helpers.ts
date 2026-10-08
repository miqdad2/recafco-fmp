import type { ErectionContractProgress } from '@/lib/erection-pieces-api';

// ---------------------------------------------------------------------------
// FMP-UI-34 — pure helpers for the redesigned Erection Dashboard
// (/contracts/erection-executive). Mirrors the Production & Planning (FMP-
// UI-32) and Storage Yard & Delivery (FMP-UI-33) dashboards' own helpers
// field-for-field, renamed for the Ready-for-Erection→Erected→Completed
// flow. Every number comes straight from
// ErectionPiecesService.contractProgress() (one read-only query, already
// covers every contract with a non-cancelled piece) — nothing invented,
// nothing written. Selecting a contract needs no extra fetch: the full
// per-contract breakdown is already in hand.
// ---------------------------------------------------------------------------

/**
 * Default selection: the first contract with Delivered pieces ready for
 * erection, else the first with Erected pieces, else the most recently
 * updated contract of any kind.
 */
export function pickDefaultErectionContract(contracts: ErectionContractProgress[]): ErectionContractProgress | null {
  const ready = contracts.find((c) => c.readyForErection > 0);
  if (ready) return ready;
  const erected = contracts.find((c) => c.erected > 0);
  if (erected) return erected;
  if (contracts.length === 0) return null;
  return [...contracts].sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))[0]!;
}

/** Client-side search over the already-loaded contract list — by contract no., job order, or project name. No network call. */
export function searchErectionContractsLocally(contracts: ErectionContractProgress[], query: string): ErectionContractProgress[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return contracts.filter((c) =>
    (c.jobOrder?.toLowerCase().includes(q) ?? false) ||
    c.referenceNumber.toLowerCase().includes(q) ||
    c.projectName.toLowerCase().includes(q),
  );
}

export interface ErectionFlowTotals {
  readyForErection: number;
  erected: number;
  completed: number;
}

/** Overall Erection Flow — summed across every contract in scope. */
export function buildOverallErectionFlow(contracts: ErectionContractProgress[]): ErectionFlowTotals {
  return contracts.reduce(
    (acc, c) => ({ readyForErection: acc.readyForErection + c.readyForErection, erected: acc.erected + c.erected, completed: acc.completed + c.completed }),
    { readyForErection: 0, erected: 0, completed: 0 },
  );
}

export interface ErectionKpis extends ErectionFlowTotals {
  onHold: number;
  rejected: number;
  needsAttention: number;
}

/** The 6 required KPI card values. */
export function buildErectionKpis(contracts: ErectionContractProgress[]): ErectionKpis {
  const flow = buildOverallErectionFlow(contracts);
  const onHold = contracts.reduce((sum, c) => sum + c.onHold, 0);
  const rejected = contracts.reduce((sum, c) => sum + c.rejected, 0);
  return { ...flow, onHold, rejected, needsAttention: onHold + rejected };
}

export interface SelectedProjectErection {
  total: number;
  completed: number;
  remaining: number;
  holdOrRejected: number;
}

/** Selected Project Erection's own 4 figures — "Completed: N of Total", Remaining = Total - Completed, Hold/Rejected shown alongside, not subtracted twice. */
export function selectedProjectErection(contract: ErectionContractProgress): SelectedProjectErection {
  const total = contract.readyForErection + contract.erected + contract.completed + contract.onHold + contract.rejected;
  return { total, completed: contract.completed, remaining: total - contract.completed, holdOrRejected: contract.onHold + contract.rejected };
}

export interface ErectionAttentionRow {
  label: string;
  value: number;
  tone: 'error' | 'warning';
  href: string;
}

/**
 * Needs Attention — this unit's own required MINIMUM 4 rows (Pieces on
 * Hold, Rejected Pieces, Ready for Erection, Erected). "Erected but not
 * completed" and "Old workflow overdue items" (the ticket's own optional
 * extra rows) need either real elapsed-time data this dashboard doesn't
 * have, or would mix 2 different counting systems (BOQ pieces vs. the old
 * workflow's own contract-level attention items) into one row — both
 * omitted rather than guessed or conflated, per this unit's own "do not
 * create fake delay logic" instruction. The old workflow's own real
 * attention figures still have their own place — see the Erection Workflow
 * summary card instead.
 *
 * FMP-UI-35 — each row now links to the Piece Erection screen pre-filtered
 * to its own real status, matching Production/Storage's own Needs
 * Attention rows.
 */
export function buildErectionNeedsAttentionRows(contracts: ErectionContractProgress[]): ErectionAttentionRow[] {
  const kpis = buildErectionKpis(contracts);
  return [
    { label: 'Pieces on Hold', value: kpis.onHold, tone: 'warning', href: '/erection/pieces?statuses=ON_HOLD' },
    { label: 'Rejected Pieces', value: kpis.rejected, tone: 'error', href: '/erection/pieces?statuses=REJECTED' },
    { label: 'Ready for Erection', value: kpis.readyForErection, tone: 'warning', href: '/erection/pieces?statuses=DELIVERED' },
    { label: 'Erected', value: kpis.erected, tone: 'warning', href: '/erection/pieces?statuses=ERECTED' },
  ];
}

/**
 * Erection Work Queue — top 5 contracts that most need a look: Hold/
 * Rejected pieces first, then contracts with pieces ready/erected and not
 * yet completed, then most recently updated. Reordering only, nothing
 * filtered.
 */
export function buildErectionWorkQueue(contracts: ErectionContractProgress[], limit = 5): ErectionContractProgress[] {
  return [...contracts]
    .sort((a, b) => {
      const aIssue = a.onHold + a.rejected > 0;
      const bIssue = b.onHold + b.rejected > 0;
      if (aIssue !== bIssue) return aIssue ? -1 : 1;
      const aPending = a.readyForErection + a.erected > 0;
      const bPending = b.readyForErection + b.erected > 0;
      if (aPending !== bPending) return aPending ? -1 : 1;
      return b.lastUpdatedAt.localeCompare(a.lastUpdatedAt);
    })
    .slice(0, limit);
}
