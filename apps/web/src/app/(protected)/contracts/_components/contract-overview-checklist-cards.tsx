import { CheckSquare, Square } from 'lucide-react';
import { SCOPE_OF_WORK_OPTIONS, PAYMENT_TERM_OPTIONS } from '../_lib/contract-ui-helpers';
import { OVERVIEW_SCOPE_DISPLAY_KEYS } from '../_lib/contract-overview-helpers';
import { NOT_SPECIFIED, paymentTermDetailText, type PaymentTermDetails } from '../_lib/payment-terms-helpers';

interface ChecklistRowProps {
  label: string;
  checked: boolean;
  /** FMP-CONTRACT-06 — e.g. "10%" or "Not specified" for a selected payment term. */
  detail?: string | null;
}

function ChecklistRow({ label, checked, detail }: ChecklistRowProps): React.JSX.Element {
  const Icon = checked ? CheckSquare : Square;
  return (
    <div
      className={`flex items-center gap-2 text-sm rounded-md px-2.5 py-1.5 ${checked ? 'bg-success/5' : ''}`}
    >
      <Icon className={`size-4 shrink-0 ${checked ? 'text-success' : 'text-text-muted'}`} aria-hidden="true" />
      <span className={checked ? 'text-text-primary font-medium' : 'text-text-muted'}>
        {label}
        {checked && detail ? (
          <span className={`ml-1.5 font-normal ${detail === NOT_SPECIFIED ? 'text-text-muted italic' : 'text-text-secondary'}`}>— {detail}</span>
        ) : null}
      </span>
    </div>
  );
}

interface ScopeCardProps {
  scopeOfWork: Record<string, boolean | string> | undefined;
}

/**
 * CM-57 — Section 5 "Scope of Work". Fixed 5-option checklist (Shop Drawing
 * / Production / Delivery / Erection / Ex-Factory) matching the New
 * Contract Register's own approved option set (CM-56) — never shows
 * "Design Production", even for a legacy contract whose stored
 * scopeOfWork.designProduction is `true` (that key is silently ignored
 * here, not mapped to any visible label). Checked state is always the
 * contract's real saved scopeOfWork.
 */
export function ContractOverviewScopeCard({ scopeOfWork }: ScopeCardProps): React.JSX.Element {
  const options = SCOPE_OF_WORK_OPTIONS.filter((o) => OVERVIEW_SCOPE_DISPLAY_KEYS.includes(o.key));
  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-5 h-full">
      <h2 className="text-sm font-semibold text-text-primary mb-4 pb-3 border-b border-border">Scope of Work</h2>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((o) => (
          <ChecklistRow key={o.key} label={o.label} checked={scopeOfWork?.[o.key] === true} />
        ))}
      </div>
    </section>
  );
}

interface PaymentTermsCardProps {
  paymentTerms: Record<string, boolean> | undefined;
  paymentTermDetails?: PaymentTermDetails | null | undefined;
}

/**
 * CM-57 — Section 6 "Payment Terms". `paymentTerms` stays a plain
 * Record<string, boolean> (selected/unselected). FMP-CONTRACT-06 adds the
 * saved per-term details (percentage / type / status) as `paymentTermDetails`;
 * a selected percentage term without one (older contracts) shows
 * "Not specified" — nothing is ever invented.
 */
export function ContractOverviewPaymentTermsCard({ paymentTerms, paymentTermDetails }: PaymentTermsCardProps): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-5 h-full">
      <h2 className="text-sm font-semibold text-text-primary mb-4 pb-3 border-b border-border">Payment Terms</h2>
      <div className="grid grid-cols-2 gap-1.5">
        {PAYMENT_TERM_OPTIONS.map((o) => (
          <ChecklistRow
            key={o.key}
            label={o.label}
            checked={paymentTerms?.[o.key] === true}
            detail={paymentTermDetailText(o.key, paymentTerms, paymentTermDetails ?? undefined)}
          />
        ))}
      </div>
    </section>
  );
}
