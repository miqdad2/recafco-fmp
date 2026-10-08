import type { Contract } from '../../../../lib/contracts-api';

/** FMP-CONTRACT-03 — form state for the Overview "Edit Contract Details" modal (all strings, so inputs stay controlled). */
export interface BasicDetailsForm {
  jobOrder: string;
  quotationNumber: string;
  title: string;
  projectNumber: string;
  counterpartyName: string;
  contractDate: string;
  startDate: string;
  endDate: string;
  scheduleStatus: string;
  scopeDescription: string;
  notes: string;
  paymentTerms: Record<string, boolean>;
}

/** Statuses where basic details may still be edited (closed/terminated/cancelled contracts are final). */
export const BASIC_DETAILS_EDITABLE_STATUSES: readonly string[] = ['DRAFT', 'ACTIVE'];

export function canEditBasicDetails(status: string, permissions: readonly string[]): boolean {
  return permissions.includes('contracts.update') && BASIC_DETAILS_EDITABLE_STATUSES.includes(status);
}

const day = (iso: string | undefined): string => (iso ? iso.slice(0, 10) : '');

export function basicDetailsFromContract(c: Contract): BasicDetailsForm {
  return {
    jobOrder: c.jobOrder ?? '',
    quotationNumber: c.quotationNumber ?? '',
    title: c.title,
    projectNumber: c.projectNumber ?? '',
    counterpartyName: c.counterpartyName,
    contractDate: day(c.contractDate),
    startDate: day(c.startDate),
    endDate: day(c.endDate),
    scheduleStatus: c.scheduleStatus ?? '',
    scopeDescription: c.scopeDescription ?? '',
    notes: c.notes ?? '',
    paymentTerms: { ...(c.paymentTerms ?? {}) },
  };
}

/** Friendly (never backend-field-name) validation messages for the required fields. */
export function validateBasicDetails(f: BasicDetailsForm): string[] {
  const errors: string[] = [];
  if (!f.jobOrder.trim()) errors.push('Job Order No is required.');
  if (!f.title.trim()) errors.push('Project / Contract Name is required.');
  if (!f.counterpartyName.trim()) errors.push('Client / Employer is required.');
  return errors;
}

/** Request body: empty optional fields become null (explicit clear). Only the safe fields are ever sent. */
export function toBasicDetailsPayload(f: BasicDetailsForm, version: number): Record<string, unknown> {
  const nul = (v: string): string | null => (v.trim() === '' ? null : v.trim());
  return {
    version,
    jobOrder: f.jobOrder.trim(),
    title: f.title.trim(),
    counterpartyName: f.counterpartyName.trim(),
    quotationNumber: nul(f.quotationNumber),
    projectNumber: nul(f.projectNumber),
    contractDate: nul(f.contractDate),
    startDate: nul(f.startDate),
    endDate: nul(f.endDate),
    scheduleStatus: nul(f.scheduleStatus),
    scopeDescription: nul(f.scopeDescription),
    notes: nul(f.notes),
    paymentTerms: f.paymentTerms,
  };
}

export const BASIC_DETAILS_SAVE_ERROR = 'Could not update contract details. Please check the fields and try again.';
export const BASIC_DETAILS_SAVE_SUCCESS = 'Contract details updated successfully.';
