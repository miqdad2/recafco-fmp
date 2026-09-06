import Link from 'next/link';
import { formatContractValue } from '../_lib/contract-ui-helpers';
import type { ProductionTaskSummary } from '../_lib/contract-overview-helpers';

interface SummaryColumn {
  label: string;
  value: string;
  valueClassName?: string;
}

/**
 * CM-57B — compact table-style summary (one header row of labels, one data
 * row of values) matching the approved design's "Account Statement
 * Summary"-shaped mini table more closely than a plain stat grid.
 */
function SummaryTable({ columns }: { columns: SummaryColumn[] }): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-center">
        <thead className="bg-surface-secondary">
          <tr>
            {columns.map((c) => (
              <th key={c.label} className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            {columns.map((c) => (
              <td key={c.label} className={`px-2 py-2.5 text-sm font-bold tabular-nums text-text-primary ${c.valueClassName ?? ''}`}>
                {c.value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CardShell({
  title,
  subtitle,
  children,
  href,
  linkLabel,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  href: string;
  linkLabel: string;
}): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-5 h-full flex flex-col">
      <div className="mb-4 pb-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
      </div>
      <div className="flex-1">{children}</div>
      <div className="mt-4 text-right">
        <Link href={href} className="text-xs font-medium text-accent hover:underline">
          {linkLabel} →
        </Link>
      </div>
    </section>
  );
}

export interface PaymentStatementData {
  totalInvoices: number;
  totalSubmitted: string;
  totalPaid: string;
  totalOutstanding: string;
  overdueValue: string;
}

/**
 * CM-57 — Section 8. The approved screenshot's "Account Statement Summary
 * (Linked to Account Model)" wording is deliberately not used — there is no
 * external Account module in this system. Retitled "Payment Statement
 * Summary" with a subtitle clarifying these are manual entries made inside
 * Contract Management, and sourced from the same
 * contractsApi.listPayments({ contractId }) summary as the Financial
 * Summary card above it.
 */
export function ContractOverviewPaymentStatementCard({
  contractId,
  data,
}: {
  contractId: string;
  data: PaymentStatementData;
}): React.JSX.Element {
  return (
    <CardShell
      title="Payment Statement Summary"
      subtitle="Manual payment entries inside Contract Management"
      href={`/contracts/${contractId}/payments`}
      linkLabel="Go to Payments"
    >
      <SummaryTable
        columns={[
          { label: 'Total Invoices', value: String(data.totalInvoices) },
          { label: 'Submitted', value: formatContractValue(data.totalSubmitted, undefined) },
          { label: 'Received', value: formatContractValue(data.totalPaid, undefined), valueClassName: 'text-success' },
          { label: 'Outstanding', value: formatContractValue(data.totalOutstanding, undefined), valueClassName: 'text-warning' },
          { label: 'Overdue', value: formatContractValue(data.overdueValue, undefined), valueClassName: 'text-error' },
        ]}
      />
    </CardShell>
  );
}

/**
 * CM-57 — Section 9. The approved screenshot's "Production Summary (Linked
 * to Production Module)" wording is not used — no separate Production
 * quantities module (cast/delivered/stock) exists yet. Falls back to a
 * real workflow-based summary: PRODUCTION-team task counts from
 * contractsApi.getWorkflow(), never fabricated casted/delivered/stock
 * numbers.
 */
export function ContractOverviewProductionCard({
  contractId,
  summary,
}: {
  contractId: string;
  summary: ProductionTaskSummary;
}): React.JSX.Element {
  return (
    <CardShell
      title="Production Summary"
      subtitle="Based on Production-team workflow tasks"
      href={`/contracts/${contractId}/workflow`}
      linkLabel="Go to Workflow"
    >
      <SummaryTable
        columns={[
          { label: 'Tasks', value: String(summary.total) },
          { label: 'Completed', value: String(summary.completed), valueClassName: 'text-success' },
          { label: 'In Progress', value: String(summary.inProgress), valueClassName: 'text-info' },
          { label: 'Pending', value: String(summary.pending) },
          { label: 'Overdue', value: String(summary.overdue), valueClassName: 'text-error' },
        ]}
      />
    </CardShell>
  );
}

/**
 * CM-57 — Section 10. The approved screenshot's "Documents & Obligations
 * (Linked to Production Module)" framing/Expiring Soon/Expired metrics
 * require document-expiry tracking that does not exist in this schema, so
 * they are never shown. Total Attachments is real — the sum of
 * `attachmentsCount` across every workflow task (contractsApi.getWorkflow)
 * plus every closeout request (contractsApi.listCloseoutRequests) for this
 * contract. Pending Obligations has no backing data at all, so it is shown
 * as "—", not a fabricated 0/count.
 */
export function ContractOverviewDocumentsCard({
  contractId,
  totalAttachments,
}: {
  contractId: string;
  totalAttachments: number;
}): React.JSX.Element {
  return (
    <CardShell
      title="Documents & Obligations"
      subtitle="Workflow task and closeout attachments"
      href={`/contracts/${contractId}/attachments`}
      linkLabel="Go to Attachments"
    >
      <SummaryTable
        columns={[
          { label: 'Total Attachments', value: String(totalAttachments) },
          { label: 'Pending Obligations', value: '—', valueClassName: 'text-text-muted' },
        ]}
      />
    </CardShell>
  );
}
