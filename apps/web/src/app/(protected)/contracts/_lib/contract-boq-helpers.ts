// ---------------------------------------------------------------------------
// Pure, presentation-agnostic BOQ row helpers shared by New Contract Register
// and Edit Contract, so both surfaces behave identically (add/remove/validate/
// calculate). Kept dependency-free so they can be unit tested directly.
// ---------------------------------------------------------------------------

export interface BoqRow {
  id: string;
  itemCode: string;
  category: string;
  description: string;
  drawingReference: string;
  specificationReference: string;
  originalEstimatedQty: string;
  revisedQty: string;
  unitOfMeasure: string;
  mixDesignType: string;
  concreteGrade: string;
  unitPrice: string;
  // CM-56D — informational/technical quantity confirmed during
  // drawing/calculation stages. Deliberately never read by boqRowQty()/
  // boqLineTotal()/boqProgressPercent()/boqAmountRemaining() below — unlike
  // revisedQty, Drawing Qty never overrides or affects any BOQ formula.
  drawingQty: string;
  // CM-56 — real, editable "Invoice Qty" (New Contract Register's BOQ
  // table). Progress / Invoice % and Amount Remaining are deliberately NOT
  // row fields — both are always derived (see boqProgressPercent()/
  // boqAmountRemaining() below), never stored/entered values themselves.
  invoiceQty: string;
}

export function makeBoqId(): string {
  return `boq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyBoqRow(): BoqRow {
  return {
    id: makeBoqId(),
    itemCode: '',
    category: '',
    description: '',
    drawingReference: '',
    specificationReference: '',
    originalEstimatedQty: '',
    revisedQty: '',
    unitOfMeasure: '',
    mixDesignType: '',
    concreteGrade: '',
    unitPrice: '',
    drawingQty: '',
    invoiceQty: '',
  };
}

/**
 * CM-56 — New Contract Register's initial/"Add Item" rows default Unit to m²
 * (contract BOQ is originally issued in m² per the manager's business
 * context). Deliberately a separate function from emptyBoqRow() above —
 * Edit Contract's own "Add Item" behavior (which also calls emptyBoqRow())
 * is completely unaffected.
 */
export function emptyRegisterBoqRow(): BoqRow {
  return { ...emptyBoqRow(), unitOfMeasure: 'm²' };
}

/** Preferred quantity: revisedQty when present, else originalEstimatedQty — matches backend calculation. */
export function boqRowQty(row: BoqRow): number | null {
  const revised = parseFloat(row.revisedQty);
  if (!isNaN(revised)) return revised;
  const original = parseFloat(row.originalEstimatedQty);
  return isNaN(original) ? null : original;
}

export function boqLineTotal(row: BoqRow): number {
  const qty = boqRowQty(row);
  const unitPrice = parseFloat(row.unitPrice);
  if (qty === null || isNaN(unitPrice)) return 0;
  return qty * unitPrice;
}

/**
 * CM-56 — Invoice Qty × Unit Price ("invoiced/progress value"). 0 when
 * either input is blank — never divides by anything, so this alone can
 * never throw or produce NaN.
 */
export function boqInvoicedValue(row: BoqRow): number {
  const invoiceQty = parseFloat(row.invoiceQty);
  const unitPrice = parseFloat(row.unitPrice);
  if (isNaN(invoiceQty) || isNaN(unitPrice)) return 0;
  return invoiceQty * unitPrice;
}

/**
 * CM-56 — Progress / Invoice % = Invoice Qty ÷ BOQ Qty / Area × 100,
 * rounded to a whole percent. 0% (never NaN/divide-by-zero) when BOQ Qty /
 * Area is blank, zero, or Invoice Qty is blank.
 */
export function boqProgressPercent(row: BoqRow): number {
  const qty = boqRowQty(row);
  const invoiceQty = parseFloat(row.invoiceQty);
  if (qty === null || qty <= 0 || isNaN(invoiceQty)) return 0;
  return Math.round((invoiceQty / qty) * 100);
}

/**
 * CM-56 — Amount Remaining = Total Price − invoiced/progress value. When
 * BOQ Qty / Area is blank or zero, there's no real quantity to invoice
 * against — this returns 0 (matching Total Price, which is also 0 in that
 * case) rather than a misleading negative number. Once a real positive BOQ
 * Qty / Area is entered, this is deliberately NOT clamped to zero: an
 * Invoice Qty above BOQ Qty / Area is real, meaningful over-invoicing data,
 * not something to hide.
 */
export function boqAmountRemaining(row: BoqRow): number {
  const qty = boqRowQty(row);
  if (qty === null || qty <= 0) return 0;
  return boqLineTotal(row) - boqInvoicedValue(row);
}

export function boqRowHasAnyValue(row: BoqRow): boolean {
  return (
    row.itemCode.trim() !== '' ||
    row.category.trim() !== '' ||
    row.description.trim() !== '' ||
    row.drawingReference.trim() !== '' ||
    row.specificationReference.trim() !== '' ||
    row.originalEstimatedQty.trim() !== '' ||
    row.revisedQty.trim() !== '' ||
    row.unitOfMeasure.trim() !== '' ||
    row.mixDesignType.trim() !== '' ||
    row.concreteGrade.trim() !== '' ||
    row.unitPrice.trim() !== '' ||
    row.drawingQty.trim() !== '' ||
    row.invoiceQty.trim() !== ''
  );
}

/** Validates BOQ rows before submit. Returns an error message, or null if all rows are valid/empty. */
export function validateBoqRows(rows: BoqRow[]): string | null {
  const nonEmptyRows = rows.filter(boqRowHasAnyValue);

  for (let i = 0; i < nonEmptyRows.length; i++) {
    const row = nonEmptyRows[i]!;
    const rowNum = i + 1;
    if (row.description.trim() === '') {
      return `BOQ row ${rowNum} is missing a description.`;
    }
    if (row.originalEstimatedQty.trim() !== '' && parseFloat(row.originalEstimatedQty) <= 0) {
      return `BOQ row ${rowNum}: Original Estimated Qty must be positive.`;
    }
    if (row.revisedQty.trim() !== '' && parseFloat(row.revisedQty) <= 0) {
      return `BOQ row ${rowNum}: Revised Qty must be positive.`;
    }
    if (row.unitPrice.trim() !== '' && parseFloat(row.unitPrice) < 0) {
      return `BOQ row ${rowNum}: Unit Price must be zero or positive.`;
    }
    if (row.drawingQty.trim() !== '' && parseFloat(row.drawingQty) < 0) {
      return `BOQ row ${rowNum}: Drawing Qty must be zero or positive.`;
    }
    if (row.invoiceQty.trim() !== '' && parseFloat(row.invoiceQty) < 0) {
      return `BOQ row ${rowNum}: Invoice Qty must be zero or positive.`;
    }
  }

  const itemCodes = nonEmptyRows.map((r) => r.itemCode.trim()).filter((c) => c !== '');
  const duplicate = itemCodes.find((code, index) => itemCodes.indexOf(code) !== index);
  if (duplicate) {
    return `Duplicate Item/Code "${duplicate}" — each BOQ item code must be unique within the contract.`;
  }

  return null;
}

export interface BoqApiItem {
  itemCode?: string;
  category?: string;
  description: string;
  drawingReference?: string;
  specificationReference?: string;
  originalEstimatedQty?: number;
  revisedQty?: number;
  unitOfMeasure?: string;
  mixDesignType?: string;
  concreteGrade?: string;
  unitPrice?: number;
  drawingQty?: number;
  invoiceQty?: number;
}

export function toBoqApiItems(rows: BoqRow[]): BoqApiItem[] {
  return rows.filter(boqRowHasAnyValue).map((row) => {
    const item: BoqApiItem = { description: row.description.trim() };
    if (row.itemCode.trim()) item.itemCode = row.itemCode.trim();
    if (row.category.trim()) item.category = row.category.trim();
    if (row.drawingReference.trim()) item.drawingReference = row.drawingReference.trim();
    if (row.specificationReference.trim()) item.specificationReference = row.specificationReference.trim();
    if (row.originalEstimatedQty.trim()) item.originalEstimatedQty = parseFloat(row.originalEstimatedQty);
    if (row.revisedQty.trim()) item.revisedQty = parseFloat(row.revisedQty);
    if (row.unitOfMeasure.trim()) item.unitOfMeasure = row.unitOfMeasure.trim();
    if (row.mixDesignType.trim()) item.mixDesignType = row.mixDesignType.trim();
    if (row.concreteGrade.trim()) item.concreteGrade = row.concreteGrade.trim();
    if (row.unitPrice.trim()) item.unitPrice = parseFloat(row.unitPrice);
    if (row.drawingQty.trim()) item.drawingQty = parseFloat(row.drawingQty);
    if (row.invoiceQty.trim()) item.invoiceQty = parseFloat(row.invoiceQty);
    return item;
  });
}

// CM-56 — 'ls' (Lump Sum) added; m² was already present (kept as-is, still
// first in the list). unitOfMeasure is a free VARCHAR column (not a DB
// enum), so adding an option here is purely additive/UI-only — no backend
// migration needed, and existing stored values are completely unaffected.
export const UNIT_OF_MEASURE_OPTIONS = ['m²', 'm³', 'lm', 'nos', 'ton', 'kg', 'set', 'lot', 'ls', 'other'];

export const MIX_DESIGN_OPTIONS = [
  { value: 'GRAY', label: 'Gray' },
  { value: 'WHITE', label: 'White' },
  { value: 'NOT_APPLICABLE', label: 'Not Applicable' },
];

/** Server-side BOQ item shape (as returned by GET), used to seed the editor when opening Edit Contract. */
export interface ExistingBoqItem {
  itemCode?: string;
  category?: string;
  description: string;
  drawingReference?: string;
  specificationReference?: string;
  originalEstimatedQty?: string;
  revisedQty?: string;
  unitOfMeasure?: string;
  mixDesignType?: string;
  concreteGrade?: string;
  unitPrice?: string;
  drawingQty?: string;
  invoiceQty?: string;
}

export function boqRowsFromExisting(items: ExistingBoqItem[]): BoqRow[] {
  return items.map((item) => ({
    id: makeBoqId(),
    itemCode: item.itemCode ?? '',
    category: item.category ?? '',
    description: item.description,
    drawingReference: item.drawingReference ?? '',
    specificationReference: item.specificationReference ?? '',
    originalEstimatedQty: item.originalEstimatedQty ?? '',
    revisedQty: item.revisedQty ?? '',
    unitOfMeasure: item.unitOfMeasure ?? '',
    mixDesignType: item.mixDesignType ?? '',
    concreteGrade: item.concreteGrade ?? '',
    unitPrice: item.unitPrice ?? '',
    drawingQty: item.drawingQty ?? '',
    invoiceQty: item.invoiceQty ?? '',
  }));
}
