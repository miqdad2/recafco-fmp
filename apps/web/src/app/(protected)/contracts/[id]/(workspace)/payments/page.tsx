import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { contractsApi } from '../../../../../../lib/contracts-api';
import { getUserPermissions } from '../../../_lib/get-user-permissions';
import { findNextDuePayment } from '../../../_lib/contract-payment-detail-helpers';
import { ContractPaymentKpiStrip } from './_components/contract-payment-kpi-strip';
import { ContractPaymentFilterBar } from './_components/contract-payment-filter-bar';
import { ContractPaymentTrackerTable } from './_components/contract-payment-tracker-table';
import { ContractPaymentTermsStrip } from './_components/contract-payment-terms-strip';
import { InfoBox } from '../../../_components/contract-form-fields';

export const metadata: Metadata = { title: 'Payments — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

type PageSearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

/**
 * CM-58 — Contract Detail Payments tab, rebuilt to match the approved
 * design. Payments are manual Contract Management entries only — no
 * external Account/SAP module exists or is referenced anywhere on this
 * page. Reuses the real PaymentFormModal/cancelPaymentAction (Add/Edit/
 * Cancel) and the export route (both from ../../payments/_components and
 * ../../payments/export unchanged) so this tab's data-entry and CSV export
 * behavior is identical to the module-level register, just scoped to this
 * one contract and shown with clearer column wording. See
 * contract-payment-detail-helpers.ts for the manager-friendly status
 * labels and the real next-due-payment number this page adds — real,
 * divide-by-zero-safe, never fabricated.
 * CM-58B — the lower "Payment Statement" card was removed entirely (the
 * approved screenshot's own "Account Statement (Linked to Account Model)"
 * has no real backing in this system — payments are manual only, and
 * duplicating the Payment Tracker's own rows under a second title added no
 * real information). Payment Tracker is now the page's single, focused
 * payments table.
 * CM-58C — Payment Terms moved from a full table card below Payment
 * Tracker to a compact chip strip between the KPI strip and the filter/
 * search section (ContractPaymentTermsStrip, replacing the deleted
 * ContractPaymentTermsSummaryCard) — a manager sees the contract's agreed
 * terms before scrolling into the payment records, instead of after.
 */
export default async function ContractPaymentsTab({ params, searchParams }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const sp = await searchParams;

  const search = str(sp['search']);
  const status = str(sp['status']);
  const dateFrom = str(sp['dateFrom']);
  const dateTo = str(sp['dateTo']);
  const overdueOnly = str(sp['overdueOnly']) === 'true';
  const hasActiveFilters = Boolean(search || status || dateFrom || dateTo || overdueOnly);

  const [permissions, contract, paymentsResult] = await Promise.all([
    getUserPermissions(),
    contractsApi.get(id).catch(() => null),
    contractsApi
      .listPayments({
        contractId: id,
        pageSize: 200,
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(dateFrom ? { invoiceDateFrom: dateFrom } : {}),
        ...(dateTo ? { invoiceDateTo: dateTo } : {}),
        ...(overdueOnly ? { overdueOnly } : {}),
      })
      .catch(() => null),
  ]);
  if (!contract) notFound();

  const canUpdate = permissions.includes('contracts.update');
  const payments = paymentsResult?.items ?? [];
  const summary = paymentsResult?.summary ?? null;
  const nextDue = findNextDuePayment(payments);

  const exportParams = new URLSearchParams({ contractId: id });
  if (search) exportParams.set('search', search);
  if (status) exportParams.set('status', status);
  if (dateFrom) exportParams.set('invoiceDateFrom', dateFrom);
  if (dateTo) exportParams.set('invoiceDateTo', dateTo);
  if (overdueOnly) exportParams.set('overdueOnly', 'true');

  return (
    <div className="space-y-4">
      <ContractPaymentKpiStrip
        summary={summary}
        nextDueAmount={nextDue?.outstandingAmount ?? nextDue?.submittedAmount}
        nextDueDate={nextDue?.dueDate}
      />

      <ContractPaymentTermsStrip paymentTerms={contract.paymentTerms} />

      <ContractPaymentFilterBar
        contractId={id}
        search={search}
        status={status}
        dateFrom={dateFrom}
        dateTo={dateTo}
        overdueOnly={overdueOnly}
        hasActiveFilters={hasActiveFilters}
        actions={
          <a
            href={`/contracts/payments/export?${exportParams.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
            title="Export this contract's currently filtered payments as CSV (opens in Excel)"
          >
            <Download className="size-3.5 shrink-0" aria-hidden="true" />
            Export Excel
          </a>
        }
      />

      <ContractPaymentTrackerTable
        payments={payments}
        contract={{ id: contract.id, referenceNumber: contract.referenceNumber, title: contract.title }}
        canUpdate={canUpdate}
      />

      <InfoBox variant="subtle">
        Overdue payments are based on Payment Due Date and Remaining Amount.
      </InfoBox>
    </div>
  );
}
