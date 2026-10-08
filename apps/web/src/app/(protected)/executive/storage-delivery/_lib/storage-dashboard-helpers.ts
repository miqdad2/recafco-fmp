import type { StorageContractProgress } from '@/lib/storage-delivery-pieces-api';

// ---------------------------------------------------------------------------
// FMP-UI-33 — pure helpers for the redesigned Storage Yard & Delivery
// dashboard (/executive/storage-delivery). Mirrors the Production &
// Planning dashboard's own helpers (FMP-UI-32) field-for-field, renamed for
// the Produced→In Store→Delivered flow. Every number comes straight from
// StorageDeliveryPiecesService.contractProgress() (one read-only query,
// already covers every contract with a non-cancelled piece) — nothing
// invented, nothing written. Selecting a contract needs no extra fetch:
// the full per-contract breakdown is already in hand.
// ---------------------------------------------------------------------------

/**
 * Default selection: the first contract with Produced pieces ready for
 * store, else the first with In Store pieces, else the most recently
 * updated contract of any kind.
 */
export function pickDefaultStorageContract(contracts: StorageContractProgress[]): StorageContractProgress | null {
  const ready = contracts.find((c) => c.readyForStore > 0);
  if (ready) return ready;
  const inStore = contracts.find((c) => c.inStore > 0);
  if (inStore) return inStore;
  if (contracts.length === 0) return null;
  return [...contracts].sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt))[0]!;
}

/** Client-side search over the already-loaded contract list — by contract no., job order, or project name. No network call. */
export function searchStorageContractsLocally(contracts: StorageContractProgress[], query: string): StorageContractProgress[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return contracts.filter((c) =>
    (c.jobOrder?.toLowerCase().includes(q) ?? false) ||
    c.referenceNumber.toLowerCase().includes(q) ||
    c.projectName.toLowerCase().includes(q),
  );
}

export interface DeliveryFlowTotals {
  readyForStore: number;
  inStore: number;
  delivered: number;
}

/** Overall Delivery Flow — summed across every contract in scope. */
export function buildOverallDeliveryFlow(contracts: StorageContractProgress[]): DeliveryFlowTotals {
  return contracts.reduce(
    (acc, c) => ({ readyForStore: acc.readyForStore + c.readyForStore, inStore: acc.inStore + c.inStore, delivered: acc.delivered + c.delivered }),
    { readyForStore: 0, inStore: 0, delivered: 0 },
  );
}

export interface StorageKpis extends DeliveryFlowTotals {
  onHold: number;
  rejected: number;
  needsAttention: number;
}

/** The 6 required KPI card values. */
export function buildStorageKpis(contracts: StorageContractProgress[]): StorageKpis {
  const flow = buildOverallDeliveryFlow(contracts);
  const onHold = contracts.reduce((sum, c) => sum + c.onHold, 0);
  const rejected = contracts.reduce((sum, c) => sum + c.rejected, 0);
  return { ...flow, onHold, rejected, needsAttention: onHold + rejected };
}

export interface SelectedProjectDelivery {
  total: number;
  delivered: number;
  remaining: number;
  holdOrRejected: number;
}

/** Selected Project Delivery's own 4 figures — "Delivered: N of Total", Remaining = Total - Delivered, Hold/Rejected shown alongside, not subtracted twice. */
export function selectedProjectDelivery(contract: StorageContractProgress): SelectedProjectDelivery {
  const total = contract.readyForStore + contract.inStore + contract.delivered + contract.onHold + contract.rejected;
  return { total, delivered: contract.delivered, remaining: total - contract.delivered, holdOrRejected: contract.onHold + contract.rejected };
}

export interface StorageAttentionRow {
  label: string;
  value: number;
  tone: 'error' | 'warning';
  href: string;
}

/**
 * Needs Attention — this unit's own required MINIMUM 4 rows (Pieces on
 * Hold, Rejected Pieces, Ready for Store, In Store). "Produced but not
 * delivered" (the ticket's own optional 5th row) needs real elapsed-time
 * data this dashboard doesn't have readily available — omitted rather than
 * guessed, per this unit's own "do not create fake delay logic" instruction.
 *
 * FMP-UI-35 — each row now links to the Piece Delivery screen pre-filtered
 * to its own real status, matching Production's own Needs Attention rows.
 */
export function buildStorageNeedsAttentionRows(contracts: StorageContractProgress[]): StorageAttentionRow[] {
  const kpis = buildStorageKpis(contracts);
  return [
    { label: 'Pieces on Hold', value: kpis.onHold, tone: 'warning', href: '/storage-delivery/pieces?statuses=ON_HOLD' },
    { label: 'Rejected Pieces', value: kpis.rejected, tone: 'error', href: '/storage-delivery/pieces?statuses=REJECTED' },
    { label: 'Ready for Store', value: kpis.readyForStore, tone: 'warning', href: '/storage-delivery/pieces?statuses=PRODUCED' },
    { label: 'In Store', value: kpis.inStore, tone: 'warning', href: '/storage-delivery/pieces?statuses=IN_STORE' },
  ];
}

/**
 * Delivery Work Queue — top 5 contracts that most need a look: Hold/
 * Rejected pieces first, then contracts with pieces ready for store/
 * delivery, then most recently updated. Reordering only, nothing filtered.
 */
export function buildDeliveryWorkQueue(contracts: StorageContractProgress[], limit = 5): StorageContractProgress[] {
  return [...contracts]
    .sort((a, b) => {
      const aIssue = a.onHold + a.rejected > 0;
      const bIssue = b.onHold + b.rejected > 0;
      if (aIssue !== bIssue) return aIssue ? -1 : 1;
      const aReady = a.readyForStore + a.inStore > 0;
      const bReady = b.readyForStore + b.inStore > 0;
      if (aReady !== bReady) return aReady ? -1 : 1;
      return b.lastUpdatedAt.localeCompare(a.lastUpdatedAt);
    })
    .slice(0, limit);
}
