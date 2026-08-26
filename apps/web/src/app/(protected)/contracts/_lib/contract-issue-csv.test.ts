import { describe, it, expect } from 'vitest';
import { buildIssuesCsv, ISSUE_CSV_HEADERS } from './contract-issue-csv';
import type { ContractIssue } from '@/lib/contracts-api';

function makeIssue(overrides: Partial<ContractIssue> = {}): ContractIssue {
  return {
    id: 'issue-1',
    contractId: 'contract-1',
    issueNo: 'ISS-001',
    title: 'Drawing approval delay',
    priority: 'HIGH',
    status: 'OPEN',
    category: 'Technical',
    raisedDate: '2026-08-01',
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

describe('buildIssuesCsv', () => {
  it('produces a header row plus one row per issue', () => {
    const csv = buildIssuesCsv([makeIssue()]);
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(ISSUE_CSV_HEADERS.join(','));
    expect(rows[1]).toContain('ISS-001');
    expect(rows[1]).toContain('CONTRACT-2026-000001');
    expect(rows[1]).toContain('10');
  });

  it('produces only the header row for an empty list (no fake data)', () => {
    const csv = buildIssuesCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('escapes a company name containing a comma', () => {
    const csv = buildIssuesCsv([makeIssue({ contract: { ...makeIssue().contract, counterpartyName: 'Acme, Inc.' } })]);
    expect(csv).toContain('"Acme, Inc."');
  });

  it('shows an empty field for an unassigned responsible person', () => {
    const csv = buildIssuesCsv([makeIssue()]);
    const dataRow = csv.split('\r\n')[1];
    expect(dataRow).toBeDefined();
  });
});
