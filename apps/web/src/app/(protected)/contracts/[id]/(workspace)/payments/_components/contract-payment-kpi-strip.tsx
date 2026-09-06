import { FileInput, Wallet, Scale, AlertTriangle, CalendarClock } from 'lucide-react';
import { DashboardKpiCard } from '../../../../dashboard/_components/dashboard-kpi-card';
import type { ContractPaymentSummary } from '@/lib/contracts-api';
import { formatContractValue } from '../../../../_lib/contract-ui-helpers';

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Props {
  summary: ContractPaymentSummary | null;
  nextDueAmount: string | undefined;
  nextDueDate: string | undefined;
}

/**
 * CM-58 — Contract Detail Payments tab, top KPI strip. Reuses the
 * already-established DashboardKpiCard (icon in a soft colored circle,
 * bold value, label, optional subtext) rather than the module-level
 * register's own PaymentSummaryCards — that component's labels ("Total
 * Submitted"/"Total Paid") are explicitly what this unit must NOT use here,
 * and it belongs to /contracts/payments, which stays untouched. Every
 * value is real: summary comes from contractsApi.listPayments's
 * server-computed summary (full filtered set for this contract), and
 * "Next Due Payment" is the real soonest-due not-yet-Received payment
 * (contract-payment-detail-helpers.ts's findNextDuePayment) — "—" with no
 * subtext when there is none, never a fabricated date/amount.
 * CM-58B — uses DashboardKpiCard's `dense` variant (icon left, value/label
 * right, shorter row) so the strip reads as one balanced row instead of
 * five tall stacked cards.
 */
export function ContractPaymentKpiStrip({ summary, nextDueAmount, nextDueDate }: Props): React.JSX.Element {
  const status = summary ? 'ok' : 'unavailable';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <DashboardKpiCard
        label="Submitted Invoices"
        value={summary ? formatContractValue(summary.totalSubmitted, 'KWD') : undefined}
        icon={FileInput}
        accent="info"
        status={status}
        dense
      />
      <DashboardKpiCard
        label="Received Payments"
        value={summary ? formatContractValue(summary.totalPaid, 'KWD') : undefined}
        icon={Wallet}
        accent="success"
        status={status}
        dense
      />
      <DashboardKpiCard
        label="Outstanding Payment"
        value={summary ? formatContractValue(summary.totalOutstanding, 'KWD') : undefined}
        icon={Scale}
        accent="warning"
        status={status}
        dense
      />
      <DashboardKpiCard
        label="Overdue Payment"
        value={summary ? formatContractValue(summary.overdueValue, 'KWD') : undefined}
        icon={AlertTriangle}
        accent="error"
        subtext={summary && summary.overdueCount > 0 ? `${summary.overdueCount} payment${summary.overdueCount === 1 ? '' : 's'} overdue` : undefined}
        status={status}
        dense
      />
      <DashboardKpiCard
        label="Next Due Payment"
        value={nextDueDate ? formatContractValue(nextDueAmount, 'KWD') : '—'}
        icon={CalendarClock}
        accent="team-production"
        subtext={nextDueDate ? `Due on ${formatDate(nextDueDate)}` : undefined}
        status={status}
        dense
      />
    </div>
  );
}
