import { describe, it, expect } from 'vitest';
import { buildVariationsCsv, VARIATION_CSV_HEADERS } from './contract-variation-csv';
import type { ContractVariation } from '@/lib/contracts-api';

function makeVariation(overrides: Partial<ContractVariation> = {}): ContractVariation {
  return {
    id: 'variation-1',
    contractId: 'contract-1',
    variationNo: 'VO-001',
    description: 'Additional Reinforcement for Column C1-C10',
    amount: '25750.000',
    currency: 'KWD',
    affectsContractValue: true,
    status: 'APPROVED',
    submittedDate: '2026-01-05',
    approvedDate: '2026-01-12',
    remarks: 'Approved as per site instruction',
    createdByUser: { id: 'user-1', displayName: 'Manager' },
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
    attachments: [],
    ...overrides,
  };
}

describe('buildVariationsCsv', () => {
  it('produces a header row plus one row per variation', () => {
    const csv = buildVariationsCsv([makeVariation()]);
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(VARIATION_CSV_HEADERS.join(','));
    expect(rows[1]).toContain('VO-001');
    expect(rows[1]).toContain('25750.000');
    expect(rows[1]).toContain('Yes');
    expect(rows[1]).toContain('Approved');
  });

  it('produces only the header row for an empty list (no fake rows)', () => {
    const csv = buildVariationsCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('shows a negative (deductive) amount honestly, never clamped', () => {
    const csv = buildVariationsCsv([makeVariation({ amount: '-12000.000' })]);
    expect(csv).toContain('-12000.000');
  });

  it('shows "No" for affectsContractValue=false', () => {
    const csv = buildVariationsCsv([makeVariation({ affectsContractValue: false })]);
    expect(csv).toContain(',No,');
  });

  it('escapes a description containing a comma', () => {
    const csv = buildVariationsCsv([makeVariation({ description: 'Extra Steel, Staircase' })]);
    expect(csv).toContain('"Extra Steel, Staircase"');
  });
});
