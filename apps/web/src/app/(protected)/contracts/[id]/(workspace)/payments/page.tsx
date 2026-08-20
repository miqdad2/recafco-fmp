import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { formatContractValue } from '../../../_lib/contract-ui-helpers';
import { PaymentStatusBadge } from '../../../payments/_components/payment-status-badge';

export const metadata: Metadata = { title: 'Payments — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PAYMENT_TRACKER_COLUMNS = [
  'Payment No.', 'Invoice #', 'Invoice Date', 'Submitted', 'Certified', 'Paid', 'Outstanding', 'Due Date', 'Status',
];

export default async function ContractPaymentsTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const [contract, paymentsResult] = await Promise.all([
    contractsApi.get(id).catch(() => null),
    contractsApi.listPayments({ contractId: id, pageSize: 100 }).catch(() => null),
  ]);
  if (!contract) notFound();

  const currentContractValue = contract.contractValue
    ? formatContractValue(contract.contractValue, contract.currency)
    : 'Not started';

  const payments = paymentsResult?.items ?? [];
  const summary = paymentsResult?.summary ?? null;

  const nextDue = payments
    .filter((p) => p.status !== 'PAID' && p.status !== 'CANCELLED' && p.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];

  const statusRows: { label: string; value: string }[] = summary
    ? [
        { label: 'Total Submitted', value: formatContractValue(summary.totalSubmitted, 'KWD') },
        { label: 'Total Paid', value: formatContractValue(summary.totalPaid, 'KWD') },
        { label: 'Outstanding', value: formatContractValue(summary.totalOutstanding, 'KWD') },
        { label: 'Overdue', value: `${summary.overdueCount} (${formatContractValue(summary.overdueValue, 'KWD')})` },
        { label: 'Next Due Payment', value: nextDue ? formatDate(nextDue.dueDate) : '—' },
      ]
    : [
        { label: 'Total Submitted', value: 'Unavailable' },
        { label: 'Total Paid', value: 'Unavailable' },
        { label: 'Outstanding', value: 'Unavailable' },
        { label: 'Overdue', value: 'Unavailable' },
        { label: 'Next Due Payment', value: 'Unavailable' },
      ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Payments</h1>
          <p className="text-xs text-text-secondary mt-0.5">Track submitted, paid, outstanding and overdue payments.</p>
        </div>
        <Link
          href={`/contracts/payments?contractId=${id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
        >
          Open in Payments Register
          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </div>

      {/* Payment Status */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Payment Status</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-muted">Current Contract Value</dt>
            <dd className="font-medium text-text-primary mt-0.5">{currentContractValue}</dd>
          </div>
          {statusRows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-text-muted">{row.label}</dt>
              <dd className="font-medium text-text-primary mt-0.5">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Payment Tracker */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Payment Tracker</h2>
          <Link
            href={`/contracts/payments?contractId=${id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Add Payment
          </Link>
        </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {PAYMENT_TRACKER_COLUMNS.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={PAYMENT_TRACKER_COLUMNS.length} className="px-3 py-8 text-center text-text-muted">
                    No payment records tracked yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-medium text-text-primary whitespace-nowrap">{p.paymentNo || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.invoiceNumber || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.invoiceDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">{formatContractValue(p.submittedAmount, 'KWD')}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">{formatContractValue(p.certifiedAmount, 'KWD')}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">{formatContractValue(p.paidAmount, 'KWD')}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right font-medium">
                      {p.outstandingAmount ? formatContractValue(p.outstandingAmount, 'KWD') : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.dueDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><PaymentStatusBadge status={p.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
