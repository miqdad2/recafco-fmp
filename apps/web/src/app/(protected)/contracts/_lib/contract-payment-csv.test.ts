import { describe, it, expect } from 'vitest';
import { csvField, buildPaymentsCsv, PAYMENT_CSV_HEADERS } from './contract-payment-csv';
import type { ContractPayment } from '@/lib/contracts-api';

describe('csvField', () => {
  it('returns an empty string for null or undefined', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });

  it('returns plain values unchanged', () => {
    expect(csvField('PAY-001')).toBe('PAY-001');
    expect(csvField(500)).toBe('500');
  });

  it('quotes and escapes values containing a comma', () => {
    expect(csvField('Acme, Inc.')).toBe('"Acme, Inc."');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(csvField('Say "hello"')).toBe('"Say ""hello"""');
  });

  it('quotes values containing a newline', () => {
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });
});

function makePayment(overrides: Partial<ContractPayment> = {}): ContractPayment {
  return {
    id: 'payment-1',
    contractId: 'contract-1',
    paymentNo: 'PAY-001',
    invoiceNumber: 'INV-001',
    invoiceDate: '2026-08-01',
    paymentTerm: 'Net 30',
    submittedAmount: '1000.000',
    certifiedAmount: '900.000',
    paidAmount: '400.000',
    outstandingAmount: '500.000',
    overdueDays: 10,
    dueDate: '2026-08-10',
    status: 'PARTIALLY_PAID',
    createdByUser: { id: 'user-1', displayName: 'Manager' },
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    contract: {
      id: 'contract-1',
      referenceNumber: 'CONTRACT-2026-000001',
      title: 'Test Contract',
      counterpartyName: 'Acme Co',
      contractValue: '5000.000',
      currency: 'KWD',
      ownerUser: { id: 'user-1', displayName: 'Manager' },
    },
    ...overrides,
  };
}

describe('buildPaymentsCsv', () => {
  it('produces a header row plus one row per payment', () => {
    const csv = buildPaymentsCsv([makePayment()]);
    const rows = csv.split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(PAYMENT_CSV_HEADERS.join(','));
    expect(rows[1]).toContain('PAY-001');
    expect(rows[1]).toContain('CONTRACT-2026-000001');
    expect(rows[1]).toContain('500.000');
  });

  it('produces only the header row for an empty list (no fake data)', () => {
    const csv = buildPaymentsCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });

  it('escapes a company name containing a comma', () => {
    const csv = buildPaymentsCsv([makePayment({ contract: { ...makePayment().contract, counterpartyName: 'Acme, Inc.' } })]);
    expect(csv).toContain('"Acme, Inc."');
  });
});
