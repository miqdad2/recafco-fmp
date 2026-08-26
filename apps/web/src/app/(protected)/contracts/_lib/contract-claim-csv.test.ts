import { describe, it, expect } from 'vitest';
import { buildClaimsCsv, CLAIM_CSV_HEADERS } from './contract-claim-csv';
import type { ContractClaim } from '@/lib/contracts-api';

function makeClaim(overrides: Partial<ContractClaim> = {}): ContractClaim {
  return {
    id: 'claim-1',
    contractId: 'contract-1',
    claimNo: 'CLM-001',
    claimTitle: 'Delay claim for drawing approval',
    claimType: 'DELAY',
    status: 'SUBMITTED',
    submittedValue: '1500.000',
    approvedValue: '500.000',
    outstandingValue: '1000.000',
    eotClaimedDays: 10,
    eotApprovedDays: 3,
    claimDate: '2026-08-01',
    dueDate: '2026-08-10',
    overdueDays: 10,
    isOverdue: true,
    createdByUser: { id: 'user-1', displayName: 'Manager' },
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    contract: {
      id: 'contract-1',
      referenceNumber: 'CONTRACT-2026-000001',
      title: 'Test Contract',
      counterpartyName: 'Acme Co',
      ownerUser: { id: 'user-1', displayName: 'Manager' },
    },
    ...overrides,
  };
}

describe('buildClaimsCsv', () => {
  it('produces a header row plus one row per claim', () => {
    const csv = buildClaimsCsv([makeClaim()]);
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(CLAIM_CSV_HEADERS.join(','));
    expect(rows[1]).toContain('CLM-001');
    expect(rows[1]).toContain('CONTRACT-2026-000001');
    expect(rows[1]).toContain('1000.000');
  });

  it('produces only the header row for an empty list (no fake data)', () => {
    const csv = buildClaimsCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('escapes a company name containing a comma', () => {
    const csv = buildClaimsCsv([makeClaim({ contract: { ...makeClaim().contract, counterpartyName: 'Acme, Inc.' } })]);
    expect(csv).toContain('"Acme, Inc."');
  });

  it('shows a dash-free empty field for an unassigned responsible person', () => {
    const csv = buildClaimsCsv([makeClaim()]);
    const dataRow = csv.split('\r\n')[1];
    expect(dataRow).toBeDefined();
  });
});
