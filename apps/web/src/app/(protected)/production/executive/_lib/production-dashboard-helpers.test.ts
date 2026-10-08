import { describe, it, expect } from 'vitest';
import type { ProductionContractProgress } from '@/lib/production-pieces-api';
import {
  pickDefaultProductionContract,
  searchProductionContractsLocally,
  buildOverallProductionFlow,
  buildProductionKpis,
  selectedProjectProduction,
  buildProductionNeedsAttentionRows,
  buildProductionWorkQueue,
} from './production-dashboard-helpers';

function makeContract(overrides: Partial<ProductionContractProgress> = {}): ProductionContractProgress {
  return {
    contractId: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', projectName: 'Tower A',
    readyForProduction: 0, inProduction: 0, produced: 0, onHold: 0, rejected: 0,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('pickDefaultProductionContract', () => {
  it('picks the first contract with Ready for Production pieces', () => {
    const contracts = [
      makeContract({ contractId: 'a', readyForProduction: 0, inProduction: 5 }),
      makeContract({ contractId: 'b', readyForProduction: 3 }),
    ];
    expect(pickDefaultProductionContract(contracts)?.contractId).toBe('b');
  });

  it('falls back to the first with In Production pieces when none are ready', () => {
    const contracts = [
      makeContract({ contractId: 'a', inProduction: 0 }),
      makeContract({ contractId: 'b', inProduction: 4 }),
    ];
    expect(pickDefaultProductionContract(contracts)?.contractId).toBe('b');
  });

  it('falls back to the most recently updated contract when nothing is ready or in production', () => {
    const contracts = [
      makeContract({ contractId: 'a', lastUpdatedAt: '2026-01-01T00:00:00.000Z' }),
      makeContract({ contractId: 'b', lastUpdatedAt: '2026-03-01T00:00:00.000Z' }),
    ];
    expect(pickDefaultProductionContract(contracts)?.contractId).toBe('b');
  });

  it('returns null for an empty list', () => {
    expect(pickDefaultProductionContract([])).toBeNull();
  });
});

describe('searchProductionContractsLocally', () => {
  const contracts = [
    makeContract({ contractId: 'a', jobOrder: 'JO-100', referenceNumber: 'CT-2026-01', projectName: 'Admin Building' }),
    makeContract({ contractId: 'b', jobOrder: null, referenceNumber: 'CT-2026-02', projectName: 'Warehouse Extension' }),
  ];

  it('returns nothing for an empty query', () => {
    expect(searchProductionContractsLocally(contracts, '')).toEqual([]);
  });

  it('matches by job order, contract reference, or project name, case-insensitively', () => {
    expect(searchProductionContractsLocally(contracts, 'jo-100').map((c) => c.contractId)).toEqual(['a']);
    expect(searchProductionContractsLocally(contracts, 'ct-2026-02').map((c) => c.contractId)).toEqual(['b']);
    expect(searchProductionContractsLocally(contracts, 'warehouse').map((c) => c.contractId)).toEqual(['b']);
  });

  it('does not throw on a contract with no job order', () => {
    expect(() => searchProductionContractsLocally(contracts, 'anything')).not.toThrow();
  });
});

describe('buildOverallProductionFlow / buildProductionKpis', () => {
  const contracts = [
    makeContract({ contractId: 'a', readyForProduction: 10, inProduction: 2, produced: 5, onHold: 1, rejected: 0 }),
    makeContract({ contractId: 'b', readyForProduction: 3, inProduction: 1, produced: 7, onHold: 0, rejected: 2 }),
  ];

  it('sums each figure across every contract', () => {
    expect(buildOverallProductionFlow(contracts)).toEqual({ ready: 13, inProduction: 3, produced: 12 });
  });

  it('builds all 6 KPI values, with needsAttention = onHold + rejected', () => {
    expect(buildProductionKpis(contracts)).toEqual({ ready: 13, inProduction: 3, produced: 12, onHold: 1, rejected: 2, needsAttention: 3 });
  });

  it('is all zero for an empty list, not a crash', () => {
    expect(buildProductionKpis([])).toEqual({ ready: 0, inProduction: 0, produced: 0, onHold: 0, rejected: 0, needsAttention: 0 });
  });
});

describe('selectedProjectProduction', () => {
  it('matches the ticket\'s own worked example (Produced: 20 of 50, Remaining: 30, Hold/Rejected: 2)', () => {
    const contract = makeContract({ readyForProduction: 28, inProduction: 0, produced: 20, onHold: 1, rejected: 1 });
    expect(selectedProjectProduction(contract)).toEqual({ total: 50, produced: 20, remaining: 30, holdOrRejected: 2 });
  });

  it('remaining includes hold/rejected pieces, not subtracted twice', () => {
    const contract = makeContract({ readyForProduction: 0, inProduction: 0, produced: 0, onHold: 3, rejected: 2 });
    expect(selectedProjectProduction(contract)).toEqual({ total: 5, produced: 0, remaining: 5, holdOrRejected: 5 });
  });
});

describe('buildProductionNeedsAttentionRows', () => {
  it('returns exactly 4 rows in the required order', () => {
    const rows = buildProductionNeedsAttentionRows([]);
    expect(rows.map((r) => r.label)).toEqual(['Pieces on Hold', 'Rejected Pieces', 'Ready for Production', 'In Production']);
  });

  it('Rejected Pieces is the only error-tone row; the rest are warning', () => {
    const rows = buildProductionNeedsAttentionRows([]);
    expect(rows.find((r) => r.label === 'Rejected Pieces')?.tone).toBe('error');
    expect(rows.filter((r) => r.label !== 'Rejected Pieces').every((r) => r.tone === 'warning')).toBe(true);
  });

  it('carries the real summed values through', () => {
    const contracts = [makeContract({ onHold: 2, rejected: 1, readyForProduction: 5, inProduction: 3 })];
    const rows = buildProductionNeedsAttentionRows(contracts);
    expect(rows.map((r) => r.value)).toEqual([2, 1, 5, 3]);
  });

  it('each row links to the Piece Production screen pre-filtered to its own real status', () => {
    const rows = buildProductionNeedsAttentionRows([]);
    expect(rows.map((r) => r.href)).toEqual([
      '/production/pieces?statuses=ON_HOLD',
      '/production/pieces?statuses=REJECTED',
      '/production/pieces?statuses=DRAWING_READY',
      '/production/pieces?statuses=IN_PRODUCTION',
    ]);
  });
});

describe('buildProductionWorkQueue', () => {
  it('puts contracts with Hold/Rejected pieces first', () => {
    const contracts = [
      makeContract({ contractId: 'a', onHold: 0, rejected: 0, readyForProduction: 5 }),
      makeContract({ contractId: 'b', onHold: 1, rejected: 0, readyForProduction: 0 }),
    ];
    expect(buildProductionWorkQueue(contracts)[0]!.contractId).toBe('b');
  });

  it('puts contracts with Ready pieces ahead of contracts with neither issues nor ready pieces', () => {
    const contracts = [
      makeContract({ contractId: 'a', readyForProduction: 0, inProduction: 1 }),
      makeContract({ contractId: 'b', readyForProduction: 5 }),
    ];
    expect(buildProductionWorkQueue(contracts)[0]!.contractId).toBe('b');
  });

  it('caps at the given limit', () => {
    const contracts = Array.from({ length: 8 }, (_, i) => makeContract({ contractId: `c${i}` }));
    expect(buildProductionWorkQueue(contracts, 5)).toHaveLength(5);
  });

  it('does not mutate the original array', () => {
    const contracts = [makeContract()];
    expect(buildProductionWorkQueue(contracts)).not.toBe(contracts);
  });
});
