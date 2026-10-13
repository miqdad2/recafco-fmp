import type { ProductionContractProgress, RecentPieceUpdate } from '@/lib/production-pieces-api';

// ---------------------------------------------------------------------------
// FMP-UI-32 / FMP-PROD-01 — pure helpers for the Production & Planning
// overview (/production/executive). Every number comes straight from
// ProductionPiecesService.contractProgress(), which already counts only
// elements Technical released to Production — nothing invented, nothing
// written. The project list, filters and search all run client-side on that
// one already-complete list.
// ---------------------------------------------------------------------------

/**
 * Default preview selection: the first project with Ready elements, else the
 * first with In Production elements, else the most recently updated project.
 */
export function pickDefaultProductionContract(contracts: ProductionContractProgress[]): ProductionContractProgress | null {
  const ready = contracts.find((c) => c.readyForProduction > 0);
  if (ready) return ready;
  const inProduction = contracts.find((c) => c.inProduction > 0);
  if (inProduction) return inProduction;
  if (contracts.length === 0) return null;
  return [...contracts].sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))[0]!;
}

export type ProductionProjectFilter = 'ALL' | 'READY' | 'IN_PRODUCTION' | 'PRODUCED' | 'SENT' | 'ON_HOLD' | 'REJECTED' | 'NEEDS_ATTENTION';

export const PRODUCTION_PROJECT_FILTERS: { value: ProductionProjectFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'READY', label: 'Ready' },
  { value: 'IN_PRODUCTION', label: 'In Production' },
  { value: 'PRODUCED', label: 'Produced' },
  { value: 'SENT', label: 'Sent to Storage Yard' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'NEEDS_ATTENTION', label: 'Needs Attention' },
];

function matchesFilter(c: ProductionContractProgress, filter: ProductionProjectFilter): boolean {
  switch (filter) {
    case 'ALL': return true;
    case 'READY': return c.readyForProduction > 0;
    case 'IN_PRODUCTION': return c.inProduction > 0;
    case 'PRODUCED': return c.produced > 0;
    case 'SENT': return c.sentToStorage > 0;
    case 'ON_HOLD': return c.onHold > 0;
    case 'REJECTED': return c.rejected > 0;
    case 'NEEDS_ATTENTION': return c.onHold + c.rejected > 0;
  }
}

/**
 * The Projects / Job Orders list: quick-filter chip + free-text search over
 * job order, contract no., project name and client. Empty search keeps the
 * whole list (it is the page's main list, not a dropdown).
 */
export function filterProductionProjects(
  contracts: ProductionContractProgress[],
  query: string,
  filter: ProductionProjectFilter = 'ALL',
): ProductionContractProgress[] {
  const q = query.trim().toLowerCase();
  return contracts.filter((c) => {
    if (!matchesFilter(c, filter)) return false;
    if (q === '') return true;
    return (
      (c.jobOrder?.toLowerCase().includes(q) ?? false) ||
      c.referenceNumber.toLowerCase().includes(q) ||
      c.projectName.toLowerCase().includes(q) ||
      c.clientName.toLowerCase().includes(q)
    );
  });
}

/** How many projects each chip would show (so a chip can display its count). */
export function countProductionProjectsByFilter(contracts: ProductionContractProgress[]): Record<ProductionProjectFilter, number> {
  const counts = {} as Record<ProductionProjectFilter, number>;
  for (const f of PRODUCTION_PROJECT_FILTERS) counts[f.value] = contracts.filter((c) => matchesFilter(c, f.value)).length;
  return counts;
}

export interface ProductionFlowTotals {
  ready: number;
  inProduction: number;
  produced: number;
  sentToStorage: number;
}

/** Overall totals — summed across every project in scope. */
export function buildOverallProductionFlow(contracts: ProductionContractProgress[]): ProductionFlowTotals {
  return contracts.reduce(
    (acc, c) => ({ ready: acc.ready + c.readyForProduction, inProduction: acc.inProduction + c.inProduction, produced: acc.produced + c.produced, sentToStorage: acc.sentToStorage + c.sentToStorage }),
    { ready: 0, inProduction: 0, produced: 0, sentToStorage: 0 },
  );
}

export interface ProductionKpis extends ProductionFlowTotals {
  onHold: number;
  rejected: number;
  needsAttention: number;
}

/** The KPI card values. */
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

/** Selected project preview: Remaining = Total - Produced; Hold/Rejected shown alongside, not subtracted twice. */
export function selectedProjectProduction(contract: ProductionContractProgress): SelectedProjectProduction {
  const total = contract.readyForProduction + contract.inProduction + contract.produced + contract.sentToStorage + contract.onHold + contract.rejected;
  // Elements already handed over to Storage Yard are finished from Production's side too.
  return { total, produced: contract.produced + contract.sentToStorage, remaining: total - contract.produced - contract.sentToStorage, holdOrRejected: contract.onHold + contract.rejected };
}

export interface ProductionAttentionRow {
  label: string;
  value: number;
  tone: 'error' | 'warning';
  href: string;
}

/**
 * Needs Attention — four rows, each linking to the Production Work screen
 * pre-filtered to its own status (`?status=` is the param that screen reads).
 * Time-based rows are omitted: this dashboard has no elapsed-time data.
 */
export function buildProductionNeedsAttentionRows(contracts: ProductionContractProgress[]): ProductionAttentionRow[] {
  const kpis = buildProductionKpis(contracts);
  return [
    { label: 'Elements on Hold', value: kpis.onHold, tone: 'warning', href: '/production/pieces?status=ON_HOLD' },
    { label: 'Rejected Elements', value: kpis.rejected, tone: 'error', href: '/production/pieces?status=REJECTED' },
    { label: 'Ready for Production', value: kpis.ready, tone: 'warning', href: '/production/pieces?status=DRAWING_READY' },
    { label: 'In Production', value: kpis.inProduction, tone: 'warning', href: '/production/pieces?status=IN_PRODUCTION' },
  ];
}

/**
 * Production Work Queue — top projects that most need a look: Hold/Rejected
 * elements first, then projects with Ready elements waiting, then most
 * recently updated. Reordering only, nothing filtered out.
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

/** Production-facing status wording for Recent Production Updates ("Drawing Ready" here means released and ready). */
export const PRODUCTION_UPDATE_STATUS_LABELS: Partial<Record<RecentPieceUpdate['newStatus'], string>> = {
  DRAWING_READY: 'Ready for Production',
  IN_PRODUCTION: 'In Production',
  PRODUCED: 'Produced',
  ON_HOLD: 'On Hold',
  REJECTED: 'Rejected',
};

export function productionUpdateStatusLabel(status: RecentPieceUpdate['newStatus']): string {
  return PRODUCTION_UPDATE_STATUS_LABELS[status] ?? status;
}

/** "2026-03-01 14:30" from an ISO timestamp. */
export function formatUpdateDateTime(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}
