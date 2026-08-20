import type { ContractPayment } from '@/lib/contracts-api';

/** CSV field escaping — wraps in quotes and doubles any embedded quotes whenever the value contains a comma, quote, or newline. */
export function csvField(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const PAYMENT_CSV_HEADERS = [
  'Payment No', 'Contract ID', 'Contract Name', 'Company / Client', 'Invoice #', 'Invoice Date',
  'Payment Term', 'Submitted Amount', 'Certified Amount', 'Paid Amount', 'Outstanding Amount',
  'Due Date', 'Overdue Days', 'Status', 'Currency',
];

export function paymentToCsvRow(p: ContractPayment): string {
  return [
    csvField(p.paymentNo),
    csvField(p.contract.referenceNumber),
    csvField(p.contract.title),
    csvField(p.contract.counterpartyName),
    csvField(p.invoiceNumber),
    csvField(p.invoiceDate),
    csvField(p.paymentTerm),
    csvField(p.submittedAmount),
    csvField(p.certifiedAmount),
    csvField(p.paidAmount),
    csvField(p.outstandingAmount),
    csvField(p.dueDate),
    csvField(p.overdueDays),
    csvField(p.status),
    csvField(p.contract.currency ?? 'KWD'),
  ].join(',');
}

export function buildPaymentsCsv(payments: ContractPayment[]): string {
  const lines = [PAYMENT_CSV_HEADERS.map(csvField).join(',')];
  for (const p of payments) lines.push(paymentToCsvRow(p));
  return lines.join('\r\n');
}
