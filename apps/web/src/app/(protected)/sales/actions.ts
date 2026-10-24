'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { salesApi, salesFetch } from '@/lib/sales-api';
import type { RecentEnquiriesResult, SalesFormState, StatusChangeResult } from './_lib/form-state';
import { STATUS_FILTER_VALUE } from './_lib/sales-format';

// ---------------------------------------------------------------------------
// FMP-SALES-01 — server actions. Each one only forwards to the Sales API, which enforces the
// permission (sales.create / sales.update) and validates again. Nothing is exported from
// this 'use server' file except async functions.
//
// Actions that stay on the page (status, notes, follow-ups) do NOT call revalidatePath: the pages are
// force-dynamic, and the caller refreshes with router.refresh() once the action reports success (same
// convention as the Task module - revalidatePath inside such an action left the form stuck on "Saving").
// ---------------------------------------------------------------------------


function readValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === 'string' && !k.startsWith('$')) out[k] = v;
  return out;
}

const text = (v: Record<string, string>, k: string): string => (v[k] ?? '').trim();

const API_FIELD_FALLBACK = 'Please check the highlighted fields.';

/** Turns an API error into form state; a server-side field error is shown beside its field. */
function failure(values: Record<string, string>, err: { message: string; fields?: Record<string, string[]> | undefined; status: number }): SalesFormState {
  const fieldErrors = err.fields ?? {};
  const hasFields = Object.keys(fieldErrors).length > 0;
  return {
    error: err.status === 403 ? 'You do not have permission to do this.' : hasFields ? API_FIELD_FALLBACK : err.message,
    fieldErrors,
    values,
    ok: null,
  };
}

const ENQUIRY_FIELDS = [
  'companyName', 'contactPerson', 'contactNumber', 'email', 'projectName', 'scopeOfWork', 'estimatedValue', 'typeOfWork',
  'projectLocation', 'nextFollowUpDate', 'remarks', 'source', 'estimatedValueSource', 'expectedStartDate', 'expectedAwardDate', 'additionalNotes',
] as const;

/** Quick client-side checks so obvious mistakes are caught before the round trip; the API re-checks everything. */
function checkEnquiry(v: Record<string, string>): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (!text(v, 'companyName')) errors['companyName'] = ['Please enter the company or client name.'];
  if (!text(v, 'scopeOfWork')) errors['scopeOfWork'] = ['Please describe the scope of work.'];
  const value = text(v, 'estimatedValue').replace(/,/g, '');
  if (value && !/^\d{1,12}(\.\d{1,3})?$/.test(value)) errors['estimatedValue'] = ['Enter an amount in KWD, for example 125000 or 125000.500. It cannot be negative.'];
  const email = text(v, 'email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors['email'] = ['This email address does not look right.'];
  return errors;
}

function enquiryBody(v: Record<string, string>): Record<string, string> {
  const body: Record<string, string> = {};
  for (const f of ENQUIRY_FIELDS) body[f] = f === 'estimatedValue' ? text(v, f).replace(/,/g, '') : text(v, f);
  return body;
}

export async function createEnquiryAction(_prev: SalesFormState, formData: FormData): Promise<SalesFormState> {
  const values = readValues(formData);
  const fieldErrors = checkEnquiry(values);
  if (Object.keys(fieldErrors).length > 0) return { error: API_FIELD_FALLBACK, fieldErrors, values, ok: null };

  const res = await salesFetch<{ id: string }>('/sales/enquiries', { method: 'POST', body: JSON.stringify(enquiryBody(values)) });
  if (res.error) return failure(values, res.error);

  revalidatePath('/sales');
  revalidatePath('/sales/enquiries');
  redirect(`/sales/enquiries/${res.data.id}?saved=1`);
}

/**
 * The quick-entry popup: same checks and the same API call as the full form, but it stays on the page and
 * reports the new enquiry id, so the popup can close and the page can refresh. (No revalidatePath: the
 * caller refreshes with router.refresh(), see the note at the top of this file.)
 */
export async function createEnquiryQuickAction(_prev: SalesFormState, formData: FormData): Promise<SalesFormState> {
  const values = readValues(formData);
  const fieldErrors = checkEnquiry(values);
  if (Object.keys(fieldErrors).length > 0) return { error: API_FIELD_FALLBACK, fieldErrors, values, ok: null, savedId: null };

  const res = await salesFetch<{ id: string }>('/sales/enquiries', { method: 'POST', body: JSON.stringify(enquiryBody(values)) });
  if (res.error) return { ...failure(values, res.error), savedId: null };
  return { error: null, fieldErrors: {}, values: {}, ok: 'Enquiry saved successfully.', savedId: res.data.id };
}

export async function updateEnquiryAction(id: string, _prev: SalesFormState, formData: FormData): Promise<SalesFormState> {
  const values = readValues(formData);
  const fieldErrors = checkEnquiry(values);
  if (Object.keys(fieldErrors).length > 0) return { error: API_FIELD_FALLBACK, fieldErrors, values, ok: null };

  const res = await salesFetch(`/sales/enquiries/${id}`, { method: 'PATCH', body: JSON.stringify(enquiryBody(values)) });
  if (res.error) return failure(values, res.error);

  revalidatePath('/sales');
  revalidatePath(`/sales/enquiries/${id}`);
  redirect(`/sales/enquiries/${id}?updated=1`);
}

export async function changeStatusAction(id: string, _prev: SalesFormState, formData: FormData): Promise<SalesFormState> {
  const values = readValues(formData);
  const status = text(values, 'status');
  if (!status) return { error: 'Please choose a status.', fieldErrors: {}, values, ok: null };
  if (status === 'LOST' && !text(values, 'reason')) {
    return { error: null, fieldErrors: { reason: ['Please give a short reason why it is not proceeding.'] }, values, ok: null };
  }
  const awarded = text(values, 'awardedValue').replace(/,/g, '');
  if (awarded && !/^\d{1,12}(\.\d{1,3})?$/.test(awarded)) {
    return { error: null, fieldErrors: { awardedValue: ['Enter an amount in KWD, for example 85000 or 85000.500.'] }, values, ok: null };
  }
  const body: Record<string, string> = { status, reason: text(values, 'reason') };
  if (status === 'WON') {
    body['awardedValue'] = awarded;
    body['wonDate'] = text(values, 'wonDate');
  }
  const res = await salesFetch(`/sales/enquiries/${id}/status`, { method: 'POST', body: JSON.stringify(body) });
  if (res.error) return failure(values, res.error);
  return { error: null, fieldErrors: {}, values: {}, ok: 'Status updated.' };
}

export async function addActivityAction(id: string, _prev: SalesFormState, formData: FormData): Promise<SalesFormState> {
  const values = readValues(formData);
  if (!text(values, 'notes')) return { error: null, fieldErrors: { notes: ['Please write a short note.'] }, values, ok: null };
  const res = await salesFetch(`/sales/enquiries/${id}/activities`, {
    method: 'POST',
    body: JSON.stringify({ type: text(values, 'type'), activityDate: text(values, 'activityDate'), notes: text(values, 'notes') }),
  });
  if (res.error) return failure(values, res.error);
  return { error: null, fieldErrors: {}, values: {}, ok: 'Saved.' };
}

export async function addFollowUpAction(id: string, _prev: SalesFormState, formData: FormData): Promise<SalesFormState> {
  const values = readValues(formData);
  if (!text(values, 'followUpDate')) return { error: null, fieldErrors: { followUpDate: ['Please choose a date.'] }, values, ok: null };
  const res = await salesFetch(`/sales/enquiries/${id}/follow-ups`, {
    method: 'POST',
    body: JSON.stringify({ followUpDate: text(values, 'followUpDate'), notes: text(values, 'notes') }),
  });
  if (res.error) return failure(values, res.error);
  return { error: null, fieldErrors: {}, values: {}, ok: 'Follow-up scheduled.' };
}

export async function completeFollowUpAction(followUpId: string, enquiryId: string, _prev: SalesFormState, formData: FormData): Promise<SalesFormState> {
  const values = readValues(formData);
  const res = await salesFetch(`/sales/follow-ups/${followUpId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ completionNotes: text(values, 'completionNotes') }),
  });
  if (res.error) return failure(values, res.error);
  return { error: null, fieldErrors: {}, values: {}, ok: 'Marked as completed.' };
}

export async function rescheduleFollowUpAction(followUpId: string, enquiryId: string, _prev: SalesFormState, formData: FormData): Promise<SalesFormState> {
  const values = readValues(formData);
  if (!text(values, 'followUpDate')) return { error: null, fieldErrors: { followUpDate: ['Please choose the new date.'] }, values, ok: null };
  const res = await salesFetch(`/sales/follow-ups/${followUpId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify({ followUpDate: text(values, 'followUpDate'), notes: text(values, 'notes') || undefined }),
  });
  if (res.error) return failure(values, res.error);
  return { error: null, fieldErrors: {}, values: {}, ok: 'Follow-up moved to the new date.' };
}

/** The dashboard's Recent Enquiries for one status filter: the newest few, plus the true match count. Read-only; the API enforces sales.read and the same filter logic as All Enquiries. */
export async function loadRecentEnquiriesAction(status: string): Promise<RecentEnquiriesResult> {
  const allowed = new Set(['', 'open', ...Object.values(STATUS_FILTER_VALUE)]);
  if (!allowed.has(status)) return { items: [], total: 0, error: 'Unknown filter.' };
  const qs = new URLSearchParams({ page: '1', pageSize: '6' });
  if (status) qs.set('status', status);
  const res = await salesApi.enquiries(qs);
  if (res.error) return { items: [], total: 0, error: 'The enquiries could not be loaded.' };
  return { items: res.data.items, total: res.data.pagination.total, error: null };
}

/**
 * FMP-SALES-04 — inline status change (the same API call and rules as the Update Status panel: Not Proceeding needs a
 * reason, Confirmed takes an optional value/date, history is written by the API). The status the user saw is sent so a
 * change made by someone else in the meantime is refused instead of overwritten.
 */
export async function changeEnquiryStatusAction(
  id: string,
  input: { status: string; expectedStatus: string; reason?: string; awardedValue?: string; wonDate?: string },
): Promise<StatusChangeResult> {
  const reason = (input.reason ?? '').trim();
  const awarded = (input.awardedValue ?? '').trim().replace(/,/g, '');
  if (!/^[A-Z_]+$/.test(input.status) || !/^[A-Z_]+$/.test(input.expectedStatus)) return { ok: false, error: 'Please choose a status.', fieldErrors: {}, conflict: false };
  if (input.status === 'LOST' && !reason) return { ok: false, error: null, fieldErrors: { reason: ['Please give a short reason why it is not proceeding.'] }, conflict: false };
  if (awarded && !/^d{1,12}(.d{1,3})?$/.test(awarded)) {
    return { ok: false, error: null, fieldErrors: { awardedValue: ['Enter an amount in KWD, for example 85000 or 85000.500.'] }, conflict: false };
  }
  const body: Record<string, string> = { status: input.status, expectedStatus: input.expectedStatus, reason };
  if (input.status === 'WON') {
    body['awardedValue'] = awarded;
    body['wonDate'] = (input.wonDate ?? '').trim();
  }
  const res = await salesFetch(`/sales/enquiries/${id}/status`, { method: 'POST', body: JSON.stringify(body) });
  if (res.error) {
    const conflict = res.error.code === 'SALES_STATUS_CONFLICT' || res.error.code === 'SALES_STATUS_UNCHANGED';
    return {
      ok: false,
      error: res.error.status === 403 ? 'You do not have permission to change the status.' : conflict ? 'This enquiry was just changed by someone else.' : res.error.message,
      fieldErrors: res.error.fields ?? {},
      conflict,
    };
  }
  return { ok: true, error: null, fieldErrors: {}, conflict: false };
}
