import { UnprocessableEntityException } from '@nestjs/common';

/**
 * FMP-CONTRACT-06 — structured Payment Term details. The `paymentTerms`
 * booleans stay the source of truth for "selected" (workflow generation and
 * other readers use them unchanged); this module validates/normalises the
 * extra per-term details stored in `Contract.paymentTermDetails`.
 */

export const PERCENTAGE_TERM_KEYS = ['advance', 'retention', 'performanceBond', 'insurance'] as const;
type PercentageTermKey = (typeof PERCENTAGE_TERM_KEYS)[number];

/** Insurance % is optional; the other three are required when the term is selected. */
const PERCENTAGE_REQUIRED: Record<PercentageTermKey, boolean> = {
  advance: true,
  retention: true,
  performanceBond: true,
  insurance: false,
};

const LABELS: Record<PercentageTermKey, string> = {
  advance: 'Advance',
  retention: 'Retention',
  performanceBond: 'Performance Bond',
  insurance: 'Insurance',
};

export const INTERIM_PAYMENT_TYPES = ['MONTHLY', 'MILESTONE_BASED', 'PROGRESS_BASED', 'OTHER'] as const;
export const TAX_CLEARANCE_STATUSES = ['REQUIRED', 'NOT_REQUIRED', 'TO_BE_CONFIRMED'] as const;

const NOTES_MAX = 500;

export type PaymentTermDetails = {
  advance?: { percentage: number };
  retention?: { percentage: number };
  performanceBond?: { percentage: number };
  insurance?: { percentage: number | null };
  interimPayment?: { type: string | null; notes: string | null };
  taxClearance?: { status: string; notes: string | null };
};

type TermMap = Record<string, unknown> | null | undefined;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Percentage terms that are selected but have no stored percentage (legacy contracts) — allowed to stay that way on edit. */
export function legacyMissingPercentageKeys(existingTerms: TermMap, existingDetails: unknown): Set<string> {
  const out = new Set<string>();
  const details = isRecord(existingDetails) ? existingDetails : {};
  for (const key of PERCENTAGE_TERM_KEYS) {
    if (existingTerms?.[key] !== true) continue;
    const d = details[key];
    const pct = isRecord(d) ? d['percentage'] : undefined;
    if (pct === undefined || pct === null) out.add(key);
  }
  return out;
}

function parsePercentage(raw: unknown): number | null | 'invalid' {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) return 'invalid';
  return Math.round(n * 1000) / 1000;
}

function parseNotes(raw: unknown): string | null | 'invalid' {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'invalid';
  const t = raw.trim();
  if (t.length > NOTES_MAX) return 'invalid';
  return t === '' ? null : t;
}

/**
 * Validates `details` against which terms are selected and returns the
 * normalised object to store (details of unselected terms are dropped; an
 * empty object when there is nothing to keep). Throws a 422 with friendly,
 * field-name-free messages.
 */
export function normalizePaymentTermDetails(
  terms: TermMap,
  details: unknown,
  legacyMissing: ReadonlySet<string> = new Set(),
): PaymentTermDetails {
  const input = isRecord(details) ? details : {};
  const out: PaymentTermDetails = {};
  const errors: string[] = [];

  for (const key of PERCENTAGE_TERM_KEYS) {
    if (terms?.[key] !== true) continue;
    const label = LABELS[key];
    const entry = isRecord(input[key]) ? (input[key] as Record<string, unknown>) : {};
    const pct = parsePercentage(entry['percentage']);
    if (pct === 'invalid') {
      errors.push(`${label} % must be between 0 and 100.`);
    } else if (pct === null) {
      if (PERCENTAGE_REQUIRED[key] && !legacyMissing.has(key)) errors.push(`${label} % is required.`);
      else if (key === 'insurance') out.insurance = { percentage: null };
      // legacy: selected without a percentage stays "Percentage not set"
    } else {
      (out as Record<string, unknown>)[key] = { percentage: pct };
    }
  }

  if (terms?.['interimPayment'] === true) {
    const entry = isRecord(input['interimPayment']) ? (input['interimPayment'] as Record<string, unknown>) : {};
    const type = entry['type'];
    const notes = parseNotes(entry['notes']);
    if (type !== undefined && type !== null && type !== '' && !(INTERIM_PAYMENT_TYPES as readonly unknown[]).includes(type)) {
      errors.push('Interim Payment type is invalid.');
    } else if (notes === 'invalid') {
      errors.push(`Interim Payment Notes must be ${NOTES_MAX} characters or fewer.`);
    } else {
      out.interimPayment = { type: type ? (type as string) : null, notes };
    }
  }

  if (terms?.['taxClearance'] === true) {
    const entry = isRecord(input['taxClearance']) ? (input['taxClearance'] as Record<string, unknown>) : {};
    const status = entry['status'];
    const notes = parseNotes(entry['notes']);
    if (status === undefined || status === null || status === '') {
      errors.push('Tax Clearance status is required.');
    } else if (!(TAX_CLEARANCE_STATUSES as readonly unknown[]).includes(status)) {
      errors.push('Tax Clearance status is invalid.');
    } else if (notes === 'invalid') {
      errors.push(`Tax Clearance Notes must be ${NOTES_MAX} characters or fewer.`);
    } else {
      out.taxClearance = { status: status as string, notes };
    }
  }

  if (errors.length > 0) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_PAYMENT_TERMS_INVALID',
      message: errors.join(' '),
    });
  }
  return out;
}
