import { describe, it, expect } from 'vitest';
import { buildCloseoutsCsv, CLOSEOUT_CSV_HEADERS } from './contract-closeout-csv';
import type { CloseoutListItem } from '@/lib/contracts-api';

function makeItem(overrides: Partial<CloseoutListItem> = {}): CloseoutListItem {
  return {
    requestId: 'request-1',
    requestNo: 'CONTRACT-2026-000001-CLO-01',
    status: 'SUBMITTED',
    contractId: 'contract-1',
    contractReference: 'CONTRACT-2026-000001',
    contractTitle: 'Test Contract',
    companyName: 'Acme Co',
    department: { id: 'dept-1', name: 'Engineering' },
    requestedBy: { id: 'user-1', displayName: 'Manager' },
    requestedAt: '2026-08-20T00:00:00.000Z',
    reviewedBy: null,
    reviewedAt: null,
    approvedAt: null,
    rejectedAt: null,
    closedAt: null,
    closeoutSummary: 'Ready to close',
    requestedRemarks: null,
    reviewRemarks: null,
    rejectionReason: null,
    riskSnapshot: {
      openWorkflowTasksCount: 2,
      overdueWorkflowTasksCount: 1,
      openIssuesCount: 0,
      openClaimsCount: 1,
      outstandingPaymentAmount: '500.000',
      unpaidPaymentsCount: 1,
      missingCloseoutDocumentsCount: 0,
      checkedAt: '2026-08-20T00:00:00.000Z',
    },
    attachmentsCount: 3,
    actionUrl: '/contracts/contract-1/closeout',
    ...overrides,
  };
}

describe('buildCloseoutsCsv', () => {
  it('produces a header row plus one row per closeout request', () => {
    const csv = buildCloseoutsCsv([makeItem()]);
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(CLOSEOUT_CSV_HEADERS.join(','));
    expect(rows[1]).toContain('CONTRACT-2026-000001-CLO-01');
    expect(rows[1]).toContain('CONTRACT-2026-000001');
    expect(rows[1]).toContain('500.000');
  });

  it('produces only the header row for an empty list (no fake data)', () => {
    const csv = buildCloseoutsCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('escapes a company name containing a comma', () => {
    const csv = buildCloseoutsCsv([makeItem({ companyName: 'Acme, Inc.' })]);
    expect(csv).toContain('"Acme, Inc."');
  });

  it('leaves risk snapshot fields blank when riskSnapshot is null', () => {
    const csv = buildCloseoutsCsv([makeItem({ riskSnapshot: null })]);
    const dataRow = csv.split('\r\n')[1];
    expect(dataRow).toBeDefined();
    expect(dataRow).toContain('CONTRACT-2026-000001-CLO-01');
  });

  it('leaves reviewedBy blank when the request has not been reviewed yet', () => {
    const csv = buildCloseoutsCsv([makeItem({ reviewedBy: null, reviewedAt: null })]);
    const dataRow = csv.split('\r\n')[1]!;
    const cols = dataRow.split(',');
    expect(cols[12]).toBe(''); // Reviewed By column
  });
});
