'use client';

import { useState } from 'react';
import { PAYMENT_TERM_OPTIONS } from '../_lib/contract-ui-helpers';
import {
  INTERIM_PAYMENT_TYPE_OPTIONS,
  TAX_CLEARANCE_STATUS_OPTIONS,
  PERCENTAGE_TERM_KEYS,
  legacyMissingKeys,
  paymentTermsStateFrom,
  type PaymentTermDetails,
  type PaymentTermsState,
} from '../_lib/payment-terms-helpers';

const FIELD_CLS =
  'block w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

interface EditorProps {
  value: PaymentTermsState;
  onChange: (next: PaymentTermsState) => void;
  /** Emit form-field `name`s so a plain <form>/FormData submit (New/Edit Contract) can read them. */
  named?: boolean;
  /** Optional per-term icons (New Contract Register keeps its existing look). */
  icons?: Record<string, React.ComponentType<{ className?: string; 'aria-hidden'?: 'true' }>>;
}

const PERCENT_LABEL: Record<string, string> = {
  advance: 'Advance %',
  retention: 'Retention %',
  performanceBond: 'Performance Bond %',
  insurance: 'Insurance %',
};
const PLACEHOLDER: Record<string, string> = { advance: 'e.g. 10', retention: 'e.g. 5', performanceBond: 'e.g. 10', insurance: 'e.g. 5' };

/**
 * FMP-CONTRACT-06 — Payment Terms checkboxes where each selected term reveals
 * its own compact detail inputs (percentage, type or status). Controlled; the
 * hidden-when-unselected inputs are not rendered, so they are never submitted.
 * Shared by New Contract Register, Edit Contract and the Overview "Edit
 * Contract Details" modal.
 */
export function PaymentTermsEditor({ value, onChange, named = false, icons }: EditorProps): React.JSX.Element {
  const set = (patch: Partial<PaymentTermsState>): void => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {PAYMENT_TERM_OPTIONS.map((opt) => {
        const enabled = value.enabled[opt.key] === true;
        const Icon = icons?.[opt.key];
        const isPct = (PERCENTAGE_TERM_KEYS as readonly string[]).includes(opt.key);
        return (
          <div
            key={opt.key}
            className={`rounded-lg border bg-surface px-3.5 py-3 transition-colors ${enabled ? 'border-accent bg-accent/5' : 'border-border hover:border-border-strong'}`}
          >
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-text-primary">
              <input
                type="checkbox"
                {...(named ? { name: `paymentTerm_${opt.key}` } : {})}
                checked={enabled}
                onChange={(e) => set({ enabled: { ...value.enabled, [opt.key]: e.target.checked } })}
                className="rounded border-border text-accent focus:ring-accent"
              />
              {Icon && <Icon className="size-4 text-text-secondary shrink-0" aria-hidden="true" />}
              {opt.label}
            </label>

            {enabled && isPct && (
              <div className="mt-2.5">
                <label htmlFor={`pt-pct-${opt.key}`} className="block text-xs font-medium text-text-secondary">
                  {PERCENT_LABEL[opt.key]}
                </label>
                <div className="relative mt-1">
                  <input
                    id={`pt-pct-${opt.key}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="any"
                    {...(named ? { name: `paymentTermPct_${opt.key}` } : {})}
                    value={value.percentage[opt.key] ?? ''}
                    onChange={(e) => set({ percentage: { ...value.percentage, [opt.key]: e.target.value } })}
                    placeholder={PLACEHOLDER[opt.key]}
                    className={`${FIELD_CLS} pr-7`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-text-muted">%</span>
                </div>
              </div>
            )}

            {enabled && opt.key === 'interimPayment' && (
              <div className="mt-2.5 space-y-2">
                <div>
                  <label htmlFor="pt-interim-type" className="block text-xs font-medium text-text-secondary">Interim Payment Type</label>
                  <select
                    id="pt-interim-type"
                    {...(named ? { name: 'paymentTermType_interimPayment' } : {})}
                    value={value.interimType}
                    onChange={(e) => set({ interimType: e.target.value })}
                    className={`${FIELD_CLS} mt-1`}
                  >
                    <option value="">Select type</option>
                    {INTERIM_PAYMENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="pt-interim-notes" className="block text-xs font-medium text-text-secondary">Interim Payment Notes</label>
                  <input
                    id="pt-interim-notes"
                    type="text"
                    maxLength={500}
                    {...(named ? { name: 'paymentTermNotes_interimPayment' } : {})}
                    value={value.interimNotes}
                    onChange={(e) => set({ interimNotes: e.target.value })}
                    className={`${FIELD_CLS} mt-1`}
                  />
                </div>
              </div>
            )}

            {enabled && opt.key === 'taxClearance' && (
              <div className="mt-2.5 space-y-2">
                <div>
                  <label htmlFor="pt-tax-status" className="block text-xs font-medium text-text-secondary">
                    Tax Clearance Status <span className="text-error">*</span>
                  </label>
                  <select
                    id="pt-tax-status"
                    {...(named ? { name: 'paymentTermStatus_taxClearance' } : {})}
                    value={value.taxStatus}
                    onChange={(e) => set({ taxStatus: e.target.value })}
                    className={`${FIELD_CLS} mt-1`}
                  >
                    <option value="">Select status</option>
                    {TAX_CLEARANCE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="pt-tax-notes" className="block text-xs font-medium text-text-secondary">Tax Clearance Notes</label>
                  <input
                    id="pt-tax-notes"
                    type="text"
                    maxLength={500}
                    {...(named ? { name: 'paymentTermNotes_taxClearance' } : {})}
                    value={value.taxNotes}
                    onChange={(e) => set({ taxNotes: e.target.value })}
                    className={`${FIELD_CLS} mt-1`}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SectionProps {
  initialTerms?: Record<string, boolean> | undefined;
  initialDetails?: PaymentTermDetails | undefined;
  icons?: EditorProps['icons'];
}

/**
 * Self-contained wrapper for the plain-<form> screens (New Contract Register,
 * Edit Contract): owns the editor state and emits named inputs. On edit it
 * also posts which selected percentage terms are legacy (saved before
 * percentages existed) so those may stay "Not specified".
 */
export function PaymentTermsFormSection({ initialTerms, initialDetails, icons }: SectionProps): React.JSX.Element {
  const [value, setValue] = useState<PaymentTermsState>(() => paymentTermsStateFrom(initialTerms, initialDetails));
  const legacy = legacyMissingKeys(initialTerms, initialDetails);
  return (
    <>
      <PaymentTermsEditor value={value} onChange={setValue} named {...(icons ? { icons } : {})} />
      {legacy.length > 0 && <input type="hidden" name="paymentTermLegacyMissing" value={legacy.join(',')} />}
    </>
  );
}
