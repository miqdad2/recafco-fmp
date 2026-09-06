import { describe, it, expect } from 'vitest';
import { buildDocumentObligationsCsv, DOCUMENT_OBLIGATION_CSV_HEADERS } from './contract-document-obligation-csv';
import type { ContractDocumentObligation } from '@/lib/contracts-api';

function makeItem(overrides: Partial<ContractDocumentObligation> = {}): ContractDocumentObligation {
  return {
    id: 'doc-1',
    contractId: 'contract-1',
    itemNo: 'DOC-001',
    title: 'Performance Bond',
    category: 'PERFORMANCE_BOND',
    responsibleParty: 'Contractor',
    requiredDate: '2026-01-15',
    expiryDate: '2027-01-15',
    daysRemaining: 214,
    status: 'SUBMITTED',
    remarks: 'Bank Guarantee No. BG-78945',
    attachments: [],
    createdByUser: { id: 'user-1', displayName: 'Manager' },
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
    ...overrides,
  };
}

describe('buildDocumentObligationsCsv', () => {
  it('produces a header row plus one row per item', () => {
    const csv = buildDocumentObligationsCsv([makeItem()]);
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(DOCUMENT_OBLIGATION_CSV_HEADERS.join(','));
    expect(rows[1]).toContain('DOC-001');
    expect(rows[1]).toContain('Performance Bond');
    expect(rows[1]).toContain('214');
    expect(rows[1]).toContain('Submitted');
  });

  it('produces only the header row for an empty list (no fake rows)', () => {
    const csv = buildDocumentObligationsCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('shows a negative (overdue) daysRemaining honestly, never clamped', () => {
    const csv = buildDocumentObligationsCsv([makeItem({ daysRemaining: -15 })]);
    expect(csv).toContain('-15');
  });

  it('lists real uploaded attachment file names joined by "; ", never a raw storage path', () => {
    const csv = buildDocumentObligationsCsv([
      makeItem({
        attachments: [
          { id: 'a1', documentObligationId: 'doc-1', originalFileName: 'Bond_78945.pdf', mimeType: 'application/pdf', fileSize: 1024, createdAt: '2026-01-05T00:00:00Z', uploadedByUser: null },
          { id: 'a2', documentObligationId: 'doc-1', originalFileName: 'Bond_Addendum.pdf', mimeType: 'application/pdf', fileSize: 512, createdAt: '2026-01-06T00:00:00Z', uploadedByUser: null },
        ],
      }),
    ]);
    expect(csv).toContain('Bond_78945.pdf; Bond_Addendum.pdf');
    expect(csv).not.toMatch(/storage[\\/]/);
  });

  it('leaves the Attachment field blank for an item with no real attachments (never a fake file name)', () => {
    const csv = buildDocumentObligationsCsv([makeItem({ attachments: [] })]);
    const rows = csv.split('\r\n');
    expect(rows[1]).toContain(',,');
  });

  it('escapes a title containing a comma', () => {
    const csv = buildDocumentObligationsCsv([makeItem({ title: 'Tax Clearance, Annual Renewal' })]);
    expect(csv).toContain('"Tax Clearance, Annual Renewal"');
  });
});
