import { describe, it, expect } from 'vitest';
import type { StorageContractProgress } from '@/lib/storage-delivery-pieces-api';
import {
  pickDefaultStorageContract,
  searchStorageContractsLocally,
  buildOverallDeliveryFlow,
  buildStorageKpis,
  selectedProjectDelivery,
  buildStorageNeedsAttentionRows,
  buildDeliveryWorkQueue,
} from './storage-dashboard-helpers';

function makeContract(overrides: Partial<StorageContractProgress> = {}): StorageContractProgress {
  return {
    contractId: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', projectName: 'Tower A',
    readyForStore: 0, inStore: 0, delivered: 0, onHold: 0, rejected: 0,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('pickDefaultStorageContract', () => {
  it('picks the first contract with Produced pieces ready for store', () => {
    const contracts = [
      makeContract({ contractId: 'a', readyForStore: 0, inStore: 5 }),
      makeContract({ contractId: 'b', readyForStore: 3 }),
    ];
    expect(pickDefaultStorageContract(contracts)?.contractId).toBe('b');
  });

  it('falls back to the first with In Store pieces when none are ready for store', () => {
    const contracts = [
      makeContract({ contractId: 'a', inStore: 0 }),
      makeContract({ contractId: 'b', inStore: 4 }),
    ];
    expect(pickDefaultStorageContract(contracts)?.contractId).toBe('b');
  });

  it('falls back to the most recently updated contract when nothing is ready or in store', () => {
    const contracts = [
      makeContract({ contractId: 'a', lastUpdatedAt: '2026-01-01T00:00:00.000Z' }),
      makeContract({ contractId: 'b', lastUpdatedAt: '2026-03-01T00:00:00.000Z' }),
    ];
    expect(pickDefaultStorageContract(contracts)?.contractId).toBe('b');
  });

  it('returns null for an empty list', () => {
    expect(pickDefaultStorageContract([])).toBeNull();
  });
});

describe('searchStorageContractsLocally', () => {
  const contracts = [
    makeContract({ contractId: 'a', jobOrder: 'JO-100', referenceNumber: 'CT-2026-01', projectName: 'Admin Building' }),
    makeContract({ contractId: 'b', jobOrder: null, referenceNumber: 'CT-2026-02', projectName: 'Warehouse Extension' }),
  ];

  it('returns nothing for an empty query', () => {
    expect(searchStorageContractsLocally(contracts, '')).toEqual([]);
  });

  it('matches by job order, contract reference, or project name, case-insensitively', () => {
    expect(searchStorageContractsLocally(contracts, 'jo-100').map((c) => c.contractId)).toEqual(['a']);
    expect(searchStorageContractsLocally(contracts, 'ct-2026-02').map((c) => c.contractId)).toEqual(['b']);
    expect(searchStorageContractsLocally(contracts, 'warehouse').map((c) => c.contractId)).toEqual(['b']);
  });

  it('does not throw on a contract with no job order', () => {
    expect(() => searchStorageContractsLocally(contracts, 'anything')).not.toThrow();
  });
});

describe('buildOverallDeliveryFlow / buildStorageKpis', () => {
  const contracts = [
    makeContract({ contractId: 'a', readyForStore: 10, inStore: 2, delivered: 5, onHold: 1, rejected: 0 }),
    makeContract({ contractId: 'b', readyForStore: 3, inStore: 1, delivered: 7, onHold: 0, rejected: 2 }),
  ];

  it('sums each figure across every contract', () => {
    expect(buildOverallDeliveryFlow(contracts)).toEqual({ readyForStore: 13, inStore: 3, delivered: 12 });
  });

  it('builds all 6 KPI values, with needsAttention = onHold + rejected', () => {
    expect(buildStorageKpis(contracts)).toEqual({ readyForStore: 13, inStore: 3, delivered: 12, onHold: 1, rejected: 2, needsAttention: 3 });
  });

  it('is all zero for an empty list, not a crash', () => {
    expect(buildStorageKpis([])).toEqual({ readyForStore: 0, inStore: 0, delivered: 0, onHold: 0, rejected: 0, needsAttention: 0 });
  });
});

describe('selectedProjectDelivery', () => {
  it('matches the ticket\'s own worked example (Delivered: 20 of 50, Remaining: 30, Hold/Rejected: 2)', () => {
    const contract = makeContract({ readyForStore: 28, inStore: 0, delivered: 20, onHold: 1, rejected: 1 });
    expect(selectedProjectDelivery(contract)).toEqual({ total: 50, delivered: 20, remaining: 30, holdOrRejected: 2 });
  });

  it('remaining includes hold/rejected pieces, not subtracted twice', () => {
    const contract = makeContract({ readyForStore: 0, inStore: 0, delivered: 0, onHold: 3, rejected: 2 });
    expect(selectedProjectDelivery(contract)).toEqual({ total: 5, delivered: 0, remaining: 5, holdOrRejected: 5 });
  });
});

describe('buildStorageNeedsAttentionRows', () => {
  it('returns exactly 4 rows in the required order', () => {
    const rows = buildStorageNeedsAttentionRows([]);
    expect(rows.map((r) => r.label)).toEqual(['Pieces on Hold', 'Rejected Pieces', 'Ready for Store', 'In Store']);
  });

  it('Rejected Pieces is the only error-tone row; the rest are warning', () => {
    const rows = buildStorageNeedsAttentionRows([]);
    expect(rows.find((r) => r.label === 'Rejected Pieces')?.tone).toBe('error');
    expect(rows.filter((r) => r.label !== 'Rejected Pieces').every((r) => r.tone === 'warning')).toBe(true);
  });

  it('carries the real summed values through', () => {
    const contracts = [makeContract({ onHold: 2, rejected: 1, readyForStore: 5, inStore: 3 })];
    const rows = buildStorageNeedsAttentionRows(contracts);
    expect(rows.map((r) => r.value)).toEqual([2, 1, 5, 3]);
  });

  it('each row links to the Piece Delivery screen pre-filtered to its own real status', () => {
    const rows = buildStorageNeedsAttentionRows([]);
    expect(rows.map((r) => r.href)).toEqual([
      '/storage-delivery/pieces?statuses=ON_HOLD',
      '/storage-delivery/pieces?statuses=REJECTED',
      '/storage-delivery/pieces?statuses=PRODUCED',
      '/storage-delivery/pieces?statuses=IN_STORE',
    ]);
  });
});

describe('buildDeliveryWorkQueue', () => {
  it('puts contracts with Hold/Rejected pieces first', () => {
    const contracts = [
      makeContract({ contractId: 'a', onHold: 0, rejected: 0, readyForStore: 5 }),
      makeContract({ contractId: 'b', onHold: 1, rejected: 0, readyForStore: 0 }),
    ];
    expect(buildDeliveryWorkQueue(contracts)[0]!.contractId).toBe('b');
  });

  it('puts contracts with ready/in-store pieces ahead of contracts with neither issues nor pending pieces', () => {
    const contracts = [
      makeContract({ contractId: 'a', readyForStore: 0, inStore: 0, delivered: 5 }),
      makeContract({ contractId: 'b', readyForStore: 5 }),
    ];
    expect(buildDeliveryWorkQueue(contracts)[0]!.contractId).toBe('b');
  });

  it('caps at the given limit', () => {
    const contracts = Array.from({ length: 8 }, (_, i) => makeContract({ contractId: `c${i}` }));
    expect(buildDeliveryWorkQueue(contracts, 5)).toHaveLength(5);
  });

  it('does not mutate the original array', () => {
    const contracts = [makeContract()];
    expect(buildDeliveryWorkQueue(contracts)).not.toBe(contracts);
  });
});
