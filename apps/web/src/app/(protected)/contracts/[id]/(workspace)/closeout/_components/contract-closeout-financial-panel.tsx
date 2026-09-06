import { formatContractValue } from '../../../../_lib/contract-ui-helpers';

interface Props {
  currency: string | undefined;
  originalContractValue: string | null;
  approvedVariationsValue: string;
  currentContractValue: string | null;
  submittedInvoices: string;
  receivedPayments: string;
  outstandingPayment: string;
  finalPaymentStatus: 'Fully Paid' | 'Outstanding';
}

function Field({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className={`text-sm font-semibold mt-0.5 ${valueClassName ?? 'text-text-primary'}`}>{value}</dd>
    </div>
  );
}

function HighlightField({ label, value, tone }: { label: string; value: string; tone: 'info' | 'warning' }): React.JSX.Element {
  const classes = tone === 'info' ? 'bg-info-light border-info/30' : 'bg-warning-light border-warning/30';
  const textClass = tone === 'info' ? 'text-info' : 'text-warning';
  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${classes}`}>
      <dt className="text-[11px] text-text-secondary font-medium">{label}</dt>
      <dd className={`text-base font-bold mt-0.5 ${textClass}`}>{value}</dd>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide col-span-full mb-0.5 first:mt-0 mt-2">{children}</p>;
}

/**
 * CM-67 — Financial Closeout Summary. Original/Current Contract Value and
 * Approved Variations come from the real GET :id/variations response
 * (originalContractValue/computedCurrentValue/summary.approvedValue,
 * CM-60). Submitted/Received/Outstanding come from the real per-contract
 * payment summary (CM-58). Retention Amount / Retention Released have no
 * real stored field anywhere in this app (grepped the schema and payment
 * DTOs — only a plain paymentTerms.retention boolean exists, never an
 * amount) — both honestly show "—" rather than a fabricated retention
 * release, exactly as this unit's spec requires.
 * CM-67B — moved into the right column of the checklist/blocking-items grid
 * row; internal grid capped at 3 columns (was up to 5) since `lg:` sizing is
 * viewport-based, not container-based, and this card is now half-width.
 * CM-67C — grouped into 3 labeled sub-sections (Contract Value / Payments /
 * Retention & Status) for scanability; Current Contract Value and
 * Outstanding Payment now render as highlighted boxes (same real values,
 * just visually emphasized) since those are the two figures a manager
 * checks first before closing.
 */
export function ContractCloseoutFinancialPanel({
  currency,
  originalContractValue,
  approvedVariationsValue,
  currentContractValue,
  submittedInvoices,
  receivedPayments,
  outstandingPayment,
  finalPaymentStatus,
}: Props): React.JSX.Element {
  const isFullyPaid = finalPaymentStatus === 'Fully Paid';
  const hasOutstanding = outstandingPayment !== '0.000' && parseFloat(outstandingPayment) > 0;

  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-4">
      <h2 className="text-sm font-semibold text-text-primary mb-3">Financial Closeout Summary</h2>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <GroupLabel>Contract Value</GroupLabel>
        <Field label="Original Contract Value" value={formatContractValue(originalContractValue ?? undefined, currency)} />
        <Field label="Approved Variations" value={formatContractValue(approvedVariationsValue, currency)} valueClassName="text-success" />
        <HighlightField label="Current Contract Value" value={formatContractValue(currentContractValue ?? undefined, currency)} tone="info" />

        <GroupLabel>Payments</GroupLabel>
        <Field label="Submitted Invoices" value={formatContractValue(submittedInvoices, currency)} />
        <Field label="Received Payments" value={formatContractValue(receivedPayments, currency)} valueClassName="text-success" />
        <HighlightField label="Outstanding Payment" value={formatContractValue(outstandingPayment, currency)} tone={hasOutstanding ? 'warning' : 'info'} />

        <GroupLabel>Retention & Status</GroupLabel>
        <Field label="Retention Amount" value="—" />
        <Field label="Retention Released" value="—" />
        <div>
          <dt className="text-xs text-text-muted">Final Payment Status</dt>
          <dd className="mt-0.5">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isFullyPaid ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`}>
              {finalPaymentStatus}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
