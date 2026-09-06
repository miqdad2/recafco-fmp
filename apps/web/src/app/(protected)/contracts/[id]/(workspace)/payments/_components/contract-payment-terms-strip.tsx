import { Check, Minus } from 'lucide-react';
import { PAYMENT_TERM_OPTIONS } from '../../../../_lib/contract-ui-helpers';

interface Props {
  paymentTerms: Record<string, boolean> | undefined;
}

/**
 * CM-58C — "Payment Terms" compact strip. Replaces the earlier full table
 * card (ContractPaymentTermsSummaryCard, deleted — same real data, denser
 * presentation) so payment terms are visible above the filter/search
 * section, before a manager scrolls into the Payment Tracker. `paymentTerms`
 * is stored as a plain Record<string, boolean> (selected/unselected only,
 * no schema-backed percentage/amount/note) — each chip shows only that real
 * saved boolean, never an invented value.
 */
export function ContractPaymentTermsStrip({ paymentTerms }: Props): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide shrink-0">Payment Terms</h2>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_TERM_OPTIONS.map((o) => {
            const selected = paymentTerms?.[o.key] === true;
            const Icon = selected ? Check : Minus;
            return (
              <span
                key={o.key}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                  selected ? 'bg-success-light text-success' : 'bg-surface-secondary text-text-muted'
                }`}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                {o.label}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
