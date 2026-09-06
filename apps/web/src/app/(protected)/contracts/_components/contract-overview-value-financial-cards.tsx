import Link from 'next/link';
import type { Contract } from '../../../../lib/contracts-api';
import { formatContractValue } from '../_lib/contract-ui-helpers';

interface RowProps {
  label: string;
  value: string;
  valueClassName?: string;
  bold?: boolean;
}

function Row({ label, value, valueClassName, bold }: RowProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className={`${bold ? 'font-semibold' : 'font-medium'} text-text-primary tabular-nums ${valueClassName ?? ''}`}>
        {value}
      </span>
    </div>
  );
}

interface ValueCardProps {
  contract: Contract;
}

/**
 * CM-57 — Section 3 "Contract Value Summary (KWD)". Original/Current values
 * are real Contract columns. Variations have no backend yet (the
 * /contracts/:id/variations tab is an honest stub — see its own "tracking
 * will be enabled after the Variations backend unit" note) — Approved
 * Variations shows 0 and Last Variation shows "—" rather than a fabricated
 * number, exactly as this unit's task requires. "View Variations" still
 * links to that real (if not-yet-populated) tab.
 */
export function ContractOverviewValueCard({ contract }: ValueCardProps): React.JSX.Element {
  const original = contract.originalContractValue
    ? formatContractValue(contract.originalContractValue, contract.originalCurrency ?? contract.currency)
    : '—';
  const current = contract.contractValue ? formatContractValue(contract.contractValue, contract.currency) : '—';

  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-5 h-full flex flex-col">
      <h2 className="text-sm font-semibold text-text-primary mb-4 pb-3 border-b border-border">Contract Value Summary (KWD)</h2>
      <div className="space-y-3">
        <Row label="Original Contract Value" value={original} />
        <Row label="Approved Variations" value="0" valueClassName="text-text-muted" />
      </div>
      <div className="mt-3 rounded-md bg-accent/5 border border-accent/15 px-3 py-2.5 flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">Current Contract Value</span>
        <span className="text-lg font-bold tabular-nums text-text-primary">{current}</span>
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-end justify-between text-xs flex-1">
        <span className="text-text-muted">Last Variation: —</span>
        <Link href={`/contracts/${contract.id}/variations`} className="font-medium text-accent hover:underline">
          View Variations →
        </Link>
      </div>
    </section>
  );
}

export interface FinancialSummaryData {
  totalSubmitted: string;
  totalPaid: string;
  totalOutstanding: string;
  overdueValue: string;
  paymentProgressPercent: number;
}

interface FinancialCardProps {
  contractId: string;
  data: FinancialSummaryData;
}

/**
 * CM-57 — Section 4 "Financial Summary (KWD)". Sourced entirely from
 * contractsApi.listPayments({ contractId }).summary — manual Contract
 * Management payment entries only. Uses the same clarified wording as the
 * Contract Manager Dashboard (CM-54B): "Submitted Invoices" / "Received
 * Payments" / "Outstanding Payment" — never "Payment Claims" or any
 * "Account module" wording.
 */
export function ContractOverviewFinancialCard({ contractId, data }: FinancialCardProps): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-5 h-full flex flex-col">
      <h2 className="text-sm font-semibold text-text-primary mb-4 pb-3 border-b border-border">Financial Summary (KWD)</h2>
      <div className="space-y-3 flex-1">
        <Row label="Submitted Invoices" value={formatContractValue(data.totalSubmitted, 'KWD')} />
        <Row label="Received Payments" value={formatContractValue(data.totalPaid, 'KWD')} valueClassName="text-success" bold />
        <Row label="Outstanding Payment" value={formatContractValue(data.totalOutstanding, 'KWD')} valueClassName="text-warning" bold />
        <Row label="Overdue Payment" value={formatContractValue(data.overdueValue, 'KWD')} valueClassName="text-error" bold />
      </div>
      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-text-muted">Payment Progress</span>
          <span className="font-semibold text-text-primary">{data.paymentProgressPercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-secondary overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-[width]"
            style={{ width: `${Math.min(100, Math.max(0, data.paymentProgressPercent))}%` }}
          />
        </div>
        <div className="mt-2.5 text-right">
          <Link href={`/contracts/${contractId}/payments`} className="text-xs font-medium text-accent hover:underline">
            View Payments →
          </Link>
        </div>
      </div>
    </section>
  );
}
