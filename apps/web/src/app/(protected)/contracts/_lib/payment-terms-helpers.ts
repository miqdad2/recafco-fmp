import { PAYMENT_TERM_OPTIONS } from './contract-ui-helpers';

/**
 * FMP-CONTRACT-06 — Payment Terms with percentage / type / status details.
 * `paymentTerms` (booleans) stays the source of truth for "selected" and is
 * what workflow generation and older screens read; the extra details live in
 * `paymentTermDetails`. Rules mirror apps/api/src/contracts/payment-terms.ts
 * (the API is authoritative; this copy gives friendly messages up front).
 */

/** Neutral wording for a selected term with no saved value (never an error state). */
export const NOT_SPECIFIED = 'Not specified';

export const PERCENTAGE_TERM_KEYS = ['advance', 'retention', 'performanceBond', 'insurance'] as const;

const PERCENTAGE_LABEL: Record<string, string> = {
  advance: 'Advance',
  retention: 'Retention',
  performanceBond: 'Performance Bond',
  insurance: 'Insurance',
};

/** Insurance % is optional; the rest are required once the term is selected. */
const PERCENTAGE_REQUIRED: Record<string, boolean> = { advance: true, retention: true, performanceBond: true, insurance: false };

export const INTERIM_PAYMENT_TYPE_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'MILESTONE_BASED', label: 'Milestone Based' },
  { value: 'PROGRESS_BASED', label: 'Progress Based' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const TAX_CLEARANCE_STATUS_OPTIONS = [
  { value: 'REQUIRED', label: 'Required' },
  { value: 'NOT_REQUIRED', label: 'Not Required' },
  { value: 'TO_BE_CONFIRMED', label: 'To be confirmed' },
] as const;

export interface PaymentTermDetails {
  advance?: { percentage: number | null };
  retention?: { percentage: number | null };
  performanceBond?: { percentage: number | null };
  insurance?: { percentage: number | null };
  interimPayment?: { type?: string | null; notes?: string | null };
  taxClearance?: { status?: string | null; notes?: string | null };
}

/** Form state (all strings so inputs stay controlled). */
export interface PaymentTermsState {
  enabled: Record<string, boolean>;
  percentage: Record<string, string>;
  interimType: string;
  interimNotes: string;
  taxStatus: string;
  taxNotes: string;
}

export function emptyPaymentTermsState(): PaymentTermsState {
  return { enabled: {}, percentage: {}, interimType: '', interimNotes: '', taxStatus: '', taxNotes: '' };
}

export function paymentTermsStateFrom(
  terms: Record<string, boolean> | undefined,
  details: PaymentTermDetails | undefined,
): PaymentTermsState {
  const state = emptyPaymentTermsState();
  for (const o of PAYMENT_TERM_OPTIONS) state.enabled[o.key] = terms?.[o.key] === true;
  for (const key of PERCENTAGE_TERM_KEYS) {
    const pct = details?.[key]?.percentage;
    state.percentage[key] = pct === null || pct === undefined ? '' : String(pct);
  }
  state.interimType = details?.interimPayment?.type ?? '';
  state.interimNotes = details?.interimPayment?.notes ?? '';
  state.taxStatus = details?.taxClearance?.status ?? '';
  state.taxNotes = details?.taxClearance?.notes ?? '';
  return state;
}

/** Selected percentage terms that have no saved percentage (old checkbox-only contracts). */
export function legacyMissingKeys(terms: Record<string, boolean> | undefined, details: PaymentTermDetails | undefined): string[] {
  return PERCENTAGE_TERM_KEYS.filter((k) => terms?.[k] === true && (details?.[k]?.percentage ?? null) === null);
}

function pctProblem(raw: string): 'empty' | 'invalid' | null {
  const t = raw.trim();
  if (t === '') return 'empty';
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? null : 'invalid';
}

/** Friendly validation messages for the selected terms (no backend field names). */
export function validatePaymentTermsState(state: PaymentTermsState, legacyMissing: readonly string[] = []): string[] {
  const errors: string[] = [];
  for (const key of PERCENTAGE_TERM_KEYS) {
    if (!state.enabled[key]) continue;
    const label = PERCENTAGE_LABEL[key]!;
    const problem = pctProblem(state.percentage[key] ?? '');
    if (problem === 'invalid') errors.push(`${label} % must be between 0 and 100.`);
    else if (problem === 'empty' && PERCENTAGE_REQUIRED[key] && !legacyMissing.includes(key)) errors.push(`${label} % is required.`);
  }
  if (state.enabled['taxClearance'] && !state.taxStatus) errors.push('Tax Clearance status is required.');
  return errors;
}

export function anyPaymentTermSelected(state: PaymentTermsState): boolean {
  return Object.values(state.enabled).some(Boolean);
}

/** API payload: booleans for every option + details for the selected ones only. */
export function toPaymentTermsPayload(state: PaymentTermsState): {
  paymentTerms: Record<string, boolean>;
  paymentTermDetails: Record<string, unknown>;
} {
  const paymentTerms: Record<string, boolean> = {};
  for (const o of PAYMENT_TERM_OPTIONS) paymentTerms[o.key] = state.enabled[o.key] === true;

  const details: Record<string, unknown> = {};
  for (const key of PERCENTAGE_TERM_KEYS) {
    if (!state.enabled[key]) continue;
    const raw = (state.percentage[key] ?? '').trim();
    if (raw !== '') details[key] = { percentage: Number(raw) };
  }
  if (state.enabled['interimPayment']) {
    details['interimPayment'] = { type: state.interimType || null, notes: state.interimNotes.trim() || null };
  }
  if (state.enabled['taxClearance']) {
    details['taxClearance'] = { status: state.taxStatus || null, notes: state.taxNotes.trim() || null };
  }
  return { paymentTerms, paymentTermDetails: details };
}

/** Reads the named inputs rendered by PaymentTermsEditor (`named`) out of a submitted FormData. */
export function readPaymentTermsState(formData: FormData): PaymentTermsState {
  const state = emptyPaymentTermsState();
  const str = (name: string): string => ((formData.get(name) as string | null) ?? '').toString();
  for (const o of PAYMENT_TERM_OPTIONS) state.enabled[o.key] = formData.get(`paymentTerm_${o.key}`) === 'on';
  for (const key of PERCENTAGE_TERM_KEYS) state.percentage[key] = str(`paymentTermPct_${key}`);
  state.interimType = str('paymentTermType_interimPayment');
  state.interimNotes = str('paymentTermNotes_interimPayment');
  state.taxStatus = str('paymentTermStatus_taxClearance');
  state.taxNotes = str('paymentTermNotes_taxClearance');
  return state;
}

function optionLabel(options: readonly { value: string; label: string }[], value: string | null | undefined): string | null {
  return options.find((o) => o.value === value)?.label ?? null;
}

/**
 * Display text for a SELECTED term (Overview / Payments strip), or null when
 * there is nothing extra to show. Old checkbox-only contracts show
 * "Not specified" for the percentage terms (FMP-CONTRACT-07 wording).
 */
export function paymentTermDetailText(
  key: string,
  terms: Record<string, boolean> | undefined,
  details: PaymentTermDetails | undefined,
): string | null {
  if (terms?.[key] !== true) return null;
  if ((PERCENTAGE_TERM_KEYS as readonly string[]).includes(key)) {
    const pct = details?.[key as (typeof PERCENTAGE_TERM_KEYS)[number]]?.percentage;
    if (pct !== null && pct !== undefined) return `${pct}%`;
    return NOT_SPECIFIED;
  }
  if (key === 'interimPayment') {
    const d = details?.interimPayment;
    const parts = [optionLabel(INTERIM_PAYMENT_TYPE_OPTIONS, d?.type), d?.notes?.trim() || null].filter(Boolean);
    return parts.length > 0 ? parts.join(' — ') : null;
  }
  if (key === 'taxClearance') {
    const d = details?.taxClearance;
    const parts = [optionLabel(TAX_CLEARANCE_STATUS_OPTIONS, d?.status), d?.notes?.trim() || null].filter(Boolean);
    return parts.length > 0 ? parts.join(' — ') : null;
  }
  return null;
}
