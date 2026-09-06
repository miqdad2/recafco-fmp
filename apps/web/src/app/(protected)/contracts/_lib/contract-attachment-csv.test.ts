import { describe, it, expect } from 'vitest';
import { buildAttachmentsCsv, ATTACHMENT_CSV_HEADERS } from './contract-attachment-csv';
import type { ContractAttachment } from '@/lib/contracts-api';

function makeAttachment(overrides: Partial<ContractAttachment> = {}): ContractAttachment {
  return {
    id: 'a1',
    originalFileName: 'Bond_78945.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    createdAt: '2026-01-05T00:00:00Z',
    uploadedByUser: { id: 'u1', displayName: 'Manager' },
    source: 'DOCUMENT_OBLIGATION',
    sourceLabel: 'Documents & Obligations',
    relatedItemTitle: 'Performance Bond',
    documentObligationCategory: 'PERFORMANCE_BOND',
    downloadPath: '/contracts/contract-1/document-obligations/doc-1/attachments/a1/download',
    ...overrides,
  };
}

describe('buildAttachmentsCsv', () => {
  it('produces a header row plus one row per attachment, columns matching the updated table', () => {
    const csv = buildAttachmentsCsv([makeAttachment()]);
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(ATTACHMENT_CSV_HEADERS.join(','));
    expect(rows[0]).toBe('File Name,Category,Source,Related To,Uploaded By,Uploaded Date,Status,Type,Size');
    expect(rows[1]).toContain('Bond_78945.pdf');
    expect(rows[1]).toContain('Performance Bond');
    expect(rows[1]).toContain('Documents & Obligations');
    expect(rows[1]).toContain('Uploaded');
    expect(rows[1]).toContain('PDF');
    expect(rows[1]).toContain('1.0 KB');
  });

  it('uses the real Documents & Obligations category in the Category column', () => {
    const csv = buildAttachmentsCsv([makeAttachment({ documentObligationCategory: 'INSURANCE' })]);
    const rows = csv.split('\r\n');
    expect(rows[1]!.split(',')[1]).toBe('Insurance');
  });

  it('uses the safe source-derived category for a Workflow attachment (no fabricated specific category)', () => {
    const csv = buildAttachmentsCsv([makeAttachment({ source: 'WORKFLOW_TASK', sourceLabel: 'Workflow Task', documentObligationCategory: null })]);
    const rows = csv.split('\r\n');
    expect(rows[1]!.split(',')[1]).toBe('Workflow Document');
  });

  it('always shows "Uploaded" in the Status column, never Approved/Pending Review', () => {
    const csv = buildAttachmentsCsv([makeAttachment()]);
    const rows = csv.split('\r\n');
    const cols = rows[1]!.split(',');
    expect(cols[6]).toBe('Uploaded');
  });

  it('produces only the header row for an empty list (no fake rows)', () => {
    const csv = buildAttachmentsCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('never includes a raw storage/download path', () => {
    const csv = buildAttachmentsCsv([makeAttachment()]);
    expect(csv).not.toContain('/contracts/contract-1/document-obligations');
    expect(csv).not.toContain('download');
  });

  it('leaves the Uploaded By field blank for an attachment with no known uploader (never a fake name)', () => {
    const csv = buildAttachmentsCsv([makeAttachment({ uploadedByUser: null })]);
    const rows = csv.split('\r\n');
    const cols = rows[1]!.split(',');
    expect(cols[4]).toBe('');
  });

  it('escapes a related item title containing a comma', () => {
    const csv = buildAttachmentsCsv([makeAttachment({ relatedItemTitle: 'Tax Clearance, Annual Renewal' })]);
    expect(csv).toContain('"Tax Clearance, Annual Renewal"');
  });
});
