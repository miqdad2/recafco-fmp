import type { ProductionContractProgress } from '@/lib/production-pieces-api';

// ---------------------------------------------------------------------------
// FMP-UI-32 — pure helpers for the redesigned Production & Planning
// dashboard (/production/executive). Every number comes straight from
// ProductionPiecesService.contractProgress() (one read-only query, already
// covers every contract with a non-cancelled piece) — nothing invented,
// nothing written. Selecting a contract needs no extra fetch at all: unlike
// the Contract Management/Technical dashboards' own selectors (FMP-UI-29/
// 31), this one already has every contract's full piece breakdown in hand.
// ---------------------------------------------------------------------------

/**
 * Default selection: the first contract with Ready-for-Production pieces,
 * else the first with In-Production pieces, else the most recently updated
 * contract of any kind (so the selector always shows something real when
 * any piece data exists at all).
 */
export function pickDefaultProductionContract(contracts: ProductionContractProgress[]): ProductionContractProgress | null {
  const ready = contracts.find((c) => c.readyForProduction > 0);
  if (ready) return ready;
  const inProduction = contracts.find((c) => c.inProduction > 0);
  if (inProduction) return inProduction;
  if (contracts.length === 0) return null;
  return [...contracts].sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))[0]!;
}

/** Client-side search over the already-loaded contract list — by contract no., job order, or project name. No network call: the list already covers every contract with a piece. */
export function searchProductionContractsLocally(contracts: ProductionContractProgress[], query: string): ProductionContractProgress[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return contracts.filter((c) =>
    (c.jobOrder?.toLowerCase().includes(q) ?? false) ||
    c.referenceNumber.toLowerCase().includes(q) ||
    c.projectName.toLowerCase().includes(q),
  );
}

export interface ProductionFlowTotals {
  ready: number;
  inProduction: number;
  produced: number;
}

/** Overall Production Flow — summed across every contract in scope. */
export function buildOverallProductionFlow(contracts: ProductionContractProgress[]): ProductionFlowTotals {
  return contracts.reduce(
    (acc, c) => ({ ready: acc.ready + c.readyForProduction, inProduction: acc.inProduction + c.inProduction, produced: acc.produced + c.produced }),
    { ready: 0, inProduction: 0, produced: 0 },
  );
}

export interface ProductionKpis extends ProductionFlowTotals {
  onHold: number;
  rejected: number;
  needsAttention: number;
}

/** The 6 required KPI card values. */
export function buildProductionKpis(contracts: ProductionContractProgress[]): ProductionKpis {
  const flow = buildOverallProductionFlow(contracts);
  const onHold = contracts.reduce((sum, c) => sum + c.onHold, 0);
  const rejected = contracts.reduce((sum, c) => sum + c.rejected, 0);
  return { ...flow, onHold, rejected, needsAttention: onHold + rejected };
}

export interface SelectedProjectProduction {
  total: number;
  produced: number;
  remaining: number;
  holdOrRejected: number;
}

/** Selected Project Production's own 4 figures — "Produced: N of Total", Remaining = Total - Produced, Hold/Rejected shown alongside, not subtracted from Remaining. */
export function selectedProjectProduction(contract: ProductionContractProgress): SelectedProjectProduction {
  const total = contract.readyForProduction + contract.inProduction + contract.produced + contract.onHold + contract.rejected;
  return { total, produced: contract.produced, remaining: total - contract.produced, holdOrRejected: contract.onHold + contract.rejected };
}

export interface ProductionAttentionRow {
  label: string;
  value: number;
  tone: 'error' | 'warning';
  href: string;
}

/**
 * Needs Attention — this unit's own required MINIMUM 4 rows (Pieces on
 * Hold, Rejected Pieces, Ready for Production, In Production). The 2
 * additional rows the ticket offered ("In Production for long time",
 * "Produced but not sent to Storage") need real elapsed-time/location data
 * this dashboard doesn't have readily available — omitted rather than
 * guessed, per this unit's own "if data does not exist for time-based
 * rules, omit" instruction.
 *
 * FMP-UI-35 — each row now links to the Piece Production screen
 * pre-filtered to its own real status (`statuses=ON_HOLD` etc. — an
 * already-supported query param, same one `?contractId=` already used on
 * the Work Queue), matching Contract Management's own Needs Attention
 * rows, which were already real links.
 */
export function buildProductionNeedsAttentionRows(contracts: ProductionContractProgress[]): ProductionAttentionRow[] {
  const kpis = buildProductionKpis(contracts);
  return [
    { label: 'Pieces on Hold', value: kpis.onHold, tone: 'warning', href: '/production/pieces?statuses=ON_HOLD' },
    { label: 'Rejected Pieces', value: kpis.rejected, tone: 'error', href: '/production/pieces?statuses=REJECTED' },
    { label: 'Ready for Production', value: kpis.ready, tone: 'warning', href: '/production/pieces?statuses=DRAWING_READY' },
    { label: 'In Production', value: kpis.inProduction, tone: 'warning', href: '/production/pieces?statuses=IN_PRODUCTION' },
  ];
}

/**
 * Production Work Queue — top 5 contracts that most need a look: Hold/
 * Rejected pieces first (a real problem), then contracts with Ready pieces
 * waiting to start, then most recently updated. Reordering only, nothing
 * filtered out — a contract with no issues and nothing ready just sorts
 * toward the back.
 */
export function buildProductionWorkQueue(contracts: ProductionContractProgress[], limit = 5): ProductionContractProgress[] {
  return [...contracts]
    .sort((a, b) => {
      const aIssue = a.onHold + a.rejected > 0;
      const bIssue = b.onHold + b.rejected > 0;
      if (aIssue !== bIssue) return aIssue ? -1 : 1;
      const aReady = a.readyForProduction > 0;
      const bReady = b.readyForProduction > 0;
      if (aReady !== bReady) return aReady ? -1 : 1;
      return b.lastUpdatedAt.localeCompare(a.lastUpdatedAt);
    })
    .slice(0, limit);
}
