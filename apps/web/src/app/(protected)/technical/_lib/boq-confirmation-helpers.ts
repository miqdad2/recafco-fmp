import type { BoqConfirmationStatus, BoqPieceStatus, BoqPieceUpdateStatus } from '@/lib/technical-api';

// FMP-BOQ-03 — wording and validation for BOQ Drawing Confirmation.

export const BOQ_CONFIRMATION_STATUS_LABELS: Record<BoqConfirmationStatus, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  REVISED: 'Revised',
  CANCELLED: 'Cancelled',
};

export const BOQ_CONFIRMATION_STATUS_CLASSES: Record<BoqConfirmationStatus, string> = {
  DRAFT: 'bg-surface-secondary text-text-secondary',
  CONFIRMED: 'bg-success-light text-success',
  REVISED: 'bg-warning-light text-warning',
  CANCELLED: 'bg-surface-secondary text-text-muted line-through',
};

const UNIT_DISPLAY: Record<string, string> = { nos: 'Nos', 'm²': 'M²', 'm³': 'M³', lm: 'LM' };

/** "Hollowcore Slab — 500 M²" for the BOQ item list. */
export function formatBoqItemOption(item: { description: string; contractQty: string | null; contractUnit: string | null }): string {
  const unit = item.contractUnit ? (UNIT_DISPLAY[item.contractUnit] ?? item.contractUnit) : '';
  const qty = item.contractQty === null ? '' : String(parseFloat(item.contractQty));
  const amount = [qty, unit].filter(Boolean).join(' ');
  return amount ? `${item.description} — ${amount}` : item.description;
}

export function formatContractQtyUnit(contractQty: string | null, contractUnit: string | null): string {
  if (contractQty === null) return '—';
  const unit = contractUnit ? (UNIT_DISPLAY[contractUnit] ?? contractUnit) : '';
  return [String(parseFloat(contractQty)), unit].filter(Boolean).join(' ');
}

/** Confirmed pieces are always counted in Nos. */
export function formatConfirmedPieces(total: number | null): string {
  return total === null ? 'Not confirmed yet' : `${total} Nos`;
}

export interface ConfirmationFormValues {
  boqItemId: string;
  drawingNo: string;
  confirmedPieces: string;
}

export type ConfirmationFormErrors = Partial<Record<keyof ConfirmationFormValues, string>>;

/**
 * Plain-language checks. Elements are only mandatory when confirming; a draft may
 * leave them empty, but anything typed must still be a positive whole number.
 */
export function validateConfirmationForm(values: ConfirmationFormValues, confirming: boolean): ConfirmationFormErrors {
  const errors: ConfirmationFormErrors = {};
  if (!values.boqItemId.trim()) errors.boqItemId = 'Please select BOQ item.';
  if (!values.drawingNo.trim()) errors.drawingNo = 'Please enter drawing number.';

  const raw = values.confirmedPieces.trim();
  if (raw === '') {
    if (confirming) errors.confirmedPieces = 'Please enter confirmed elements.';
  } else if (!/^-?\d+$/.test(raw)) {
    errors.confirmedPieces = 'Confirmed elements must be a whole number.';
  } else if (parseInt(raw, 10) <= 0) {
    errors.confirmedPieces = 'Confirmed elements must be more than 0.';
  }
  return errors;
}

// ---------------------------------------------------------------------------
// FMP-BOQ-04 — piece wording and summary
// ---------------------------------------------------------------------------

export const BOQ_PIECE_STATUS_LABELS: Record<BoqPieceStatus, string> = {
  NOT_STARTED: 'Not Started',
  DRAWING_READY: 'Elements Generated',
  IN_PRODUCTION: 'In Production',
  PRODUCED: 'Produced',
  SENT_TO_STORAGE: 'Sent to Storage Yard',
  IN_STORE: 'In Store',
  DELIVERED: 'Delivered',
  ERECTED: 'Erected',
  COMPLETED: 'Completed',
  ON_HOLD: 'Hold',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const BOQ_PIECE_STATUS_CLASSES: Record<BoqPieceStatus, string> = {
  NOT_STARTED: 'bg-surface-secondary text-text-secondary',
  DRAWING_READY: 'bg-info-light text-info',
  IN_PRODUCTION: 'bg-warning-light text-warning',
  PRODUCED: 'bg-success-light text-success',
  SENT_TO_STORAGE: 'bg-info-light text-info',
  IN_STORE: 'bg-success-light text-success',
  DELIVERED: 'bg-success-light text-success',
  ERECTED: 'bg-success-light text-success',
  COMPLETED: 'bg-success-light text-success',
  ON_HOLD: 'bg-warning-light text-warning',
  REJECTED: 'bg-error-light text-error',
  CANCELLED: 'bg-surface-secondary text-text-muted',
};

/** Filter chips on the View Elements list (All first). */
export const BOQ_PIECE_FILTERS: { value: BoqPieceStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAWING_READY', label: 'Elements Generated' },
  { value: 'IN_PRODUCTION', label: 'In Production' },
  { value: 'PRODUCED', label: 'Produced' },
  { value: 'SENT_TO_STORAGE', label: 'Sent to Storage Yard' },
  { value: 'IN_STORE', label: 'In Store' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'ERECTED', label: 'Erected' },
  { value: 'ON_HOLD', label: 'Hold' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const SUMMARY_ORDER: BoqPieceStatus[] = [
  'NOT_STARTED', 'DRAWING_READY', 'IN_PRODUCTION', 'PRODUCED', 'SENT_TO_STORAGE', 'IN_STORE', 'DELIVERED', 'ERECTED', 'COMPLETED', 'ON_HOLD', 'REJECTED', 'CANCELLED',
];

/** "Elements Generated 45 · In Production 5" — only statuses that have pieces, in lifecycle order. */
export function pieceStatusSummary(counts: Partial<Record<BoqPieceStatus, number>>): { status: BoqPieceStatus; label: string; count: number }[] {
  return SUMMARY_ORDER.filter((s) => (counts[s] ?? 0) > 0).map((s) => ({ status: s, label: BOQ_PIECE_STATUS_LABELS[s], count: counts[s] ?? 0 }));
}

/** The Generate Elements button shows only when some Confirmed drawing still has pieces to create. */
export function shouldShowGeneratePieces(items: { pendingPieces: number }[]): boolean {
  return items.some((i) => i.pendingPieces > 0);
}

// ---------------------------------------------------------------------------
// FMP-BOQ-05 — status update controls
// ---------------------------------------------------------------------------

/** Targets offered in "Update selected to" (Not Started is not offered: new elements start as Elements Generated). */
export const BOQ_PIECE_UPDATE_OPTIONS: { value: BoqPieceStatus; label: string }[] = [
  'DRAWING_READY', 'IN_PRODUCTION', 'PRODUCED', 'SENT_TO_STORAGE', 'IN_STORE', 'DELIVERED', 'ERECTED', 'COMPLETED', 'ON_HOLD', 'REJECTED', 'CANCELLED',
].map((value) => ({ value: value as BoqPieceStatus, label: BOQ_PIECE_STATUS_LABELS[value as BoqPieceStatus] }));

/** Plain-language check before sending an update. */
export function validatePieceUpdate(selectedCount: number, status: string): string | null {
  if (selectedCount === 0) return 'Please select at least one element.';
  if (status === '') return 'Please select a status.';
  return null;
}

/**
 * FMP-BOQ-06 — the "Update selected to" options: only the statuses the API says
 * this user may set, in the usual order. null/empty (not resolved, read-only
 * user) gives no options, which hides the update controls (fail safe).
 */
export function pieceUpdateOptionsFor(allowed: BoqPieceUpdateStatus[] | null): { value: BoqPieceStatus; label: string }[] {
  if (!allowed || allowed.length === 0) return [];
  return BOQ_PIECE_UPDATE_OPTIONS.filter((o) => (allowed as BoqPieceStatus[]).includes(o.value));
}
