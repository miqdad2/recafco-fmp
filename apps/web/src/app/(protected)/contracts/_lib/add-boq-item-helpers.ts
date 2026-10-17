import { REGISTER_UNIT_OPTIONS, unitLabel } from './contract-boq-helpers';

// FMP-CONTRACT-11 — rules and wording for "+ Add BOQ Item" on an existing
// contract. Same fields, unit order and rounding as New Contract Register.

export { REGISTER_UNIT_OPTIONS, unitLabel };

export const ADD_BOQ_ITEM_TEXT = {
  button: '+ Add BOQ Item',
  title: 'Add BOQ Item',
  success: 'BOQ item added successfully. Technical can now review and confirm its elements.',
  duplicate: 'This BOQ item was already added. Technical can now review and confirm its elements.',
  filesFailed: 'The BOQ item was saved, but some files could not be uploaded.',
  saveFailed: 'BOQ item could not be saved. Please try again.',
  elementsNotConfirmed: 'Elements Not Confirmed',
} as const;

export interface NewBoqItemValues {
  description: string;
  unit: string;
  contractQty: string;
  unitPrice: string;
}

export type NewBoqItemErrors = Partial<Record<keyof NewBoqItemValues, string>>;

/** Plain-language checks; every field is required. */
export function validateNewBoqItem(values: NewBoqItemValues): NewBoqItemErrors {
  const errors: NewBoqItemErrors = {};
  if (values.description.trim() === '') errors.description = 'Please enter item description.';
  if (!REGISTER_UNIT_OPTIONS.includes(values.unit)) errors.unit = 'Please select unit.';

  const qtyRaw = values.contractQty.trim();
  if (qtyRaw === '') errors.contractQty = 'Please enter Contract Qty.';
  else if (!(parseFloat(qtyRaw) > 0)) errors.contractQty = 'Contract Qty must be more than 0.';

  const priceRaw = values.unitPrice.trim();
  if (priceRaw === '') errors.unitPrice = 'Please enter unit price.';
  else if (!(parseFloat(priceRaw) >= 0)) errors.unitPrice = 'Unit price must be 0 or more.';
  return errors;
}

/** Contract Qty × Unit Price, rounded to 3 decimals (same as the server). 0 until both are valid numbers. */
export function newBoqItemTotal(contractQty: string, unitPrice: string): number {
  const qty = parseFloat(contractQty);
  const price = parseFloat(unitPrice);
  if (!(qty > 0) || !(price >= 0)) return 0;
  return Math.round(qty * price * 1000) / 1000;
}

/** Contracts that are closed, cancelled or terminated cannot get new BOQ items. */
export function canAddBoqItems(permissions: string[], contractStatus: string): boolean {
  if (!permissions.includes('contracts.update')) return false;
  return !['CLOSED', 'TERMINATED', 'CANCELLED'].includes(contractStatus);
}

/**
 * The BOQ total (sum of item totals) next to the contract value. They can differ
 * once items are added later: contract value is NOT changed by adding an item.
 * Returns null when there is nothing to explain.
 */
export function boqTotalNote(
  items: { totalPrice?: string | undefined }[],
  contractValue: string | undefined,
): { boqTotal: number; contractValue: number | null; differs: boolean } | null {
  const priced = items.filter((i) => i.totalPrice !== undefined && i.totalPrice !== '');
  if (priced.length === 0) return null;
  const boqTotal = priced.reduce((sum, i) => sum + (parseFloat(i.totalPrice ?? '0') || 0), 0);
  const value = contractValue !== undefined && contractValue !== '' ? parseFloat(contractValue) : null;
  const rounded = (n: number): number => Math.round(n * 1000) / 1000;
  return { boqTotal: rounded(boqTotal), contractValue: value === null || Number.isNaN(value) ? null : rounded(value), differs: value !== null && !Number.isNaN(value) && rounded(value) !== rounded(boqTotal) };
}

/** A new item shows "Elements Not Confirmed" until Technical confirms elements for it. */
export function elementsNotConfirmed(item: { confirmedPieces: number | null; piecesGenerated: number; confirmations: { confirmationStatus: string }[] }): boolean {
  return item.piecesGenerated === 0 && !item.confirmations.some((c) => c.confirmationStatus === 'CONFIRMED');
}

/** Plain summary of what failed to upload after the item itself was saved. */
export function filesFailedText(failures: string[]): string {
  return `${ADD_BOQ_ITEM_TEXT.filesFailed} ${failures.join(' ')}`.trim();
}
