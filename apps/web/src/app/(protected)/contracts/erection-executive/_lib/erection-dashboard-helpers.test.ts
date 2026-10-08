import { describe, it, expect } from 'vitest';
import type { ErectionContractProgress } from '@/lib/erection-pieces-api';
import {
  pickDefaultErectionContract,
  searchErectionContractsLocally,
  buildOverallErectionFlow,
  buildErectionKpis,
  selectedProjectErection,
  buildErectionNeedsAttentionRows,
  buildErectionWorkQueue,
} from './erection-dashboard-helpers';

function makeContract(overrides: Partial<ErectionContractProgress> = {}): ErectionContractProgress {
  return {
    contractId: 'c1', referenceNumber: 'CT-1', jobOrder: 'JO-1', projectName: 'Tower A',
    readyForErection: 0, erected: 0, completed: 0, onHold: 0, rejected: 0,
    lastUpdatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('pickDefaultErectionContract', () => {
  it('picks the first contract with Delivered pieces ready for erection', () => {
    const contracts = [
      makeContract({ contractId: 'a', readyForErection: 0, erected: 5 }),
      makeContract({ contractId: 'b', readyForErection: 3 }),
    ];
    expect(pickDefaultErectionContract(contracts)?.contractId).toBe('b');
  });

  it('falls back to the first with Erected pieces when none are ready for erection', () => {
    const contracts = [
      makeContract({ contractId: 'a', erected: 0 }),
      makeContract({ contractId: 'b', erected: 4 }),
    ];
    expect(pickDefaultErectionContract(contracts)?.contractId).toBe('b');
  });

  it('falls back to the most recently updated contract when nothing is ready or erected', () => {
    const contracts = [
      makeContract({ contractId: 'a', lastUpdatedAt: '2026-01-01T00:00:00.000Z' }),
      makeContract({ contractId: 'b', lastUpdatedAt: '2026-03-01T00:00:00.000Z' }),
    ];
    expect(pickDefaultErectionContract(contracts)?.contractId).toBe('b');
  });

  it('returns null for an empty list', () => {
    expect(pickDefaultErectionContract([])).toBeNull();
  });
});

describe('searchErectionContractsLocally', () => {
  const contracts = [
    makeContract({ contractId: 'a', jobOrder: 'JO-100', referenceNumber: 'CT-2026-01', projectName: 'Admin Building' }),
    makeContract({ contractId: 'b', jobOrder: null, referenceNumber: 'CT-2026-02', projectName: 'Warehouse Extension' }),
  ];

  it('returns nothing for an empty query', () => {
    expect(searchErectionContractsLocally(contracts, '')).toEqual([]);
  });

  it('matches by job order, contract reference, or project name, case-insensitively', () => {
    expect(searchErectionContractsLocally(contracts, 'jo-100').map((c) => c.contractId)).toEqual(['a']);
    expect(searchErectionContractsLocally(contracts, 'ct-2026-02').map((c) => c.contractId)).toEqual(['b']);
    expect(searchErectionContractsLocally(contracts, 'warehouse').map((c) => c.contractId)).toEqual(['b']);
  });

  it('does not throw on a contract with no job order', () => {
    expect(() => searchErectionContractsLocally(contracts, 'anything')).not.toThrow();
  });
});

describe('buildOverallErectionFlow / buildErectionKpis', () => {
  const contracts = [
    makeContract({ contractId: 'a', readyForErection: 10, erected: 2, completed: 5, onHold: 1, rejected: 0 }),
    makeContract({ contractId: 'b', readyForErection: 3, erected: 1, completed: 7, onHold: 0, rejected: 2 }),
  ];

  it('sums each figure across every contract', () => {
    expect(buildOverallErectionFlow(contracts)).toEqual({ readyForErection: 13, erected: 3, completed: 12 });
  });

  it('builds all 6 KPI values, with needsAttention = onHold + rejected', () => {
    expect(buildErectionKpis(contracts)).toEqual({ readyForErection: 13, erected: 3, completed: 12, onHold: 1, rejected: 2, needsAttention: 3 });
  });

  it('is all zero for an empty list, not a crash', () => {
    expect(buildErectionKpis([])).toEqual({ readyForErection: 0, erected: 0, completed: 0, onHold: 0, rejected: 0, needsAttention: 0 });
  });
});

describe('selectedProjectErection', () => {
  it('matches the ticket\'s own worked example (Completed: 20 of 50, Remaining: 30, Hold/Rejected: 2)', () => {
    const contract = makeContract({ readyForErection: 28, erected: 0, completed: 20, onHold: 1, rejected: 1 });
    expect(selectedProjectErection(contract)).toEqual({ total: 50, completed: 20, remaining: 30, holdOrRejected: 2 });
  });

  it('remaining includes hold/rejected pieces, not subtracted twice', () => {
    const contract = makeContract({ readyForErection: 0, erected: 0, completed: 0, onHold: 3, rejected: 2 });
    expect(selectedProjectErection(contract)).toEqual({ total: 5, completed: 0, remaining: 5, holdOrRejected: 5 });
  });
});

describe('buildErectionNeedsAttentionRows', () => {
  it('returns exactly 4 rows in the required order', () => {
    const rows = buildErectionNeedsAttentionRows([]);
    expect(rows.map((r) => r.label)).toEqual(['Pieces on Hold', 'Rejected Pieces', 'Ready for Erection', 'Erected']);
  });

  it('Rejected Pieces is the only error-tone row; the rest are warning', () => {
    const rows = buildErectionNeedsAttentionRows([]);
    expect(rows.find((r) => r.label === 'Rejected Pieces')?.tone).toBe('error');
    expect(rows.filter((r) => r.label !== 'Rejected Pieces').every((r) => r.tone === 'warning')).toBe(true);
  });

  it('carries the real summed values through', () => {
    const contracts = [makeContract({ onHold: 2, rejected: 1, readyForErection: 5, erected: 3 })];
    const rows = buildErectionNeedsAttentionRows(contracts);
    expect(rows.map((r) => r.value)).toEqual([2, 1, 5, 3]);
  });

  it('each row links to the Piece Erection screen pre-filtered to its own real status', () => {
    const rows = buildErectionNeedsAttentionRows([]);
    expect(rows.map((r) => r.href)).toEqual([
      '/erection/pieces?statuses=ON_HOLD',
      '/erection/pieces?statuses=REJECTED',
      '/erection/pieces?statuses=DELIVERED',
      '/erection/pieces?statuses=ERECTED',
    ]);
  });
});

describe('buildErectionWorkQueue', () => {
  it('puts contracts with Hold/Rejected pieces first', () => {
    const contracts = [
      makeContract({ contractId: 'a', onHold: 0, rejected: 0, readyForErection: 5 }),
      makeContract({ contractId: 'b', onHold: 1, rejected: 0, readyForErection: 0 }),
    ];
    expect(buildErectionWorkQueue(contracts)[0]!.contractId).toBe('b');
  });

  it('puts contracts with pending pieces ahead of contracts with neither issues nor pending pieces', () => {
    const contracts = [
      makeContract({ contractId: 'a', readyForErection: 0, erected: 0, completed: 5 }),
      makeContract({ contractId: 'b', readyForErection: 5 }),
    ];
    expect(buildErectionWorkQueue(contracts)[0]!.contractId).toBe('b');
  });

  it('caps at the given limit', () => {
    const contracts = Array.from({ length: 8 }, (_, i) => makeContract({ contractId: `c${i}` }));
    expect(buildErectionWorkQueue(contracts, 5)).toHaveLength(5);
  });

  it('does not mutate the original array', () => {
    const contracts = [makeContract()];
    expect(buildErectionWorkQueue(contracts)).not.toBe(contracts);
  });
});
