'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { salesApi, salesFetch } from '@/lib/sales-api';
import { contractsApi } from '@/lib/contracts-api';
import type { ActivityResult, ContractChoice, RecentEnquiriesResult, SalesFormState, StatusChangeResult } from './_lib/form-state';
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

const TASK_REQUIRED = 'Please say what needs to be done, for example “Call the client to request drawings”.';
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
  'projectLocation', 'nextFollowUpDate', 'followUpTask', 'remarks', 'source', 'estimatedValueSource', 'expectedStartDate', 'expectedAwardDate', 'additionalNotes',
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
  if (text(v, 'nextFollowUpDate') && !text(v, 'followUpTask')) errors['followUpTask'] = [TASK_REQUIRED];
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

  // Follow-up tasks are never edited here (that used to replace a pending task); they are scheduled in Add Activity.
  const body = enquiryBody(values);
  delete body['nextFollowUpDate'];
  delete body['followUpTask'];
  const res = await salesFetch(`/sales/enquiries/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  if (res.error) return failure(values, res.error);

  revalidatePath('/sales');
  revalidatePath(`/sales/enquiries/${id}`);
  redirect(`/sales/enquiries/${id}?updated=1`);
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
  const qs = new URLSearchParams({ page: '1', pageSize: '8' });
  if (status) qs.set('status', status);
  const res = await salesApi.enquiries(qs);
  if (res.error) return { items: [], total: 0, error: 'The enquiries could not be loaded.' };
  return { items: res.data.items, total: res.data.pagination.total, error: null };
}

/**
 * FMP-SALES-04 — inline status change (the one status editor (its former panel on the enquiry page was removed): Not Proceeding needs a
 * reason, Confirmed takes an optional value/date, history is written by the API). The status the user saw is sent so a
 * change made by someone else in the meantime is refused instead of overwritten.
 */
export async function changeEnquiryStatusAction(
  id: string,
  input: { status: string; expectedStatus: string; reason?: string; confirmationNotes?: string; wonDate?: string; customStatusId?: string; expectedCustomStatusId?: string | null },
): Promise<StatusChangeResult> {
  const reason = (input.reason ?? '').trim();
  if (!/^[A-Z_]+$/.test(input.status) || !/^[A-Z_]+$/.test(input.expectedStatus)) return { ok: false, error: 'Please choose a status.', fieldErrors: {}, conflict: false };
  if (input.status === 'LOST' && !reason) return { ok: false, error: null, fieldErrors: { reason: ['Please give a short reason why it is not proceeding.'] }, conflict: false };
  const body: Record<string, string> = { status: input.status, expectedStatus: input.expectedStatus, reason };
  // FMP-SALES-18 — a custom (in-progress) status, and the custom status the user was looking at.
  if (input.customStatusId) {
    if (!UUID.test(input.customStatusId)) return { ok: false, error: 'Please choose a status.', fieldErrors: {}, conflict: false };
    body['customStatusId'] = input.customStatusId;
  }
  if (input.expectedCustomStatusId && UUID.test(input.expectedCustomStatusId)) body['expectedCustomStatusId'] = input.expectedCustomStatusId;
  if (input.status === 'WON') {
    const date = (input.wonDate ?? '').trim();
    if (!date) return { ok: false, error: null, fieldErrors: { wonDate: ['Please choose the confirmation date.'] }, conflict: false };
    body['wonDate'] = date;
    body['confirmationNotes'] = (input.confirmationNotes ?? '').trim();
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AddCustomStatusResult = StatusChangeResult & { status?: { id: string; name: string } };

/**
 * FMP-SALES-18 — "+ Add New Status": the API creates the in-progress status and applies it to this enquiry in one
 * transaction (sales.update, same restrictions as Change Status). Name problems come back on the Status Name field.
 */
export async function addCustomStatusAction(
  id: string,
  input: { name: string; expectedStatus: string; expectedCustomStatusId?: string | null },
): Promise<AddCustomStatusResult> {
  const name = input.name.replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, error: null, fieldErrors: { name: ['Please enter a status name.'] }, conflict: false };
  if (!/^[A-Z_]+$/.test(input.expectedStatus)) return { ok: false, error: 'Please refresh the page and try again.', fieldErrors: {}, conflict: false };
  const body: Record<string, string> = { name, expectedStatus: input.expectedStatus };
  if (input.expectedCustomStatusId && UUID.test(input.expectedCustomStatusId)) body['expectedCustomStatusId'] = input.expectedCustomStatusId;
  const res = await salesFetch<{ customStatus: { id: string; name: string } | null }>(`/sales/enquiries/${id}/custom-status`, { method: 'POST', body: JSON.stringify(body) });
  if (res.error) {
    if (res.error.code === 'SALES_CUSTOM_STATUS_NAME_INVALID' || res.error.code === 'SALES_CUSTOM_STATUS_EXISTS') {
      return { ok: false, error: null, fieldErrors: { name: [res.error.message] }, conflict: false };
    }
    const conflict = res.error.code === 'SALES_STATUS_CONFLICT' || res.error.code === 'SALES_STATUS_UNCHANGED';
    return {
      ok: false,
      error: res.error.status === 403 ? 'You do not have permission to add or change statuses.' : conflict ? 'This enquiry was just changed by someone else.' : res.error.message,
      fieldErrors: res.error.fields ?? {},
      conflict,
    };
  }
  const status = res.data?.customStatus ?? null;
  return status ? { ok: true, error: null, fieldErrors: {}, conflict: false, status } : { ok: false, error: 'Please refresh the page to see the result.', fieldErrors: {}, conflict: false };
}

/**
 * FMP-SALES-05 — "+ Add Activity". One call: the date, what happened, and an optional next follow-up (the API saves them
 * together). requestId makes a retry harmless. The API enforces sales.update and re-validates everything.
 */
export async function addActivityEntryAction(
  enquiryId: string,
  input: { activityDate: string; notes: string; nextFollowUpDate?: string; followUpTask?: string; requestId: string },
): Promise<ActivityResult> {
  const notes = input.notes.trim();
  if (!notes) return { ok: false, error: null, fieldErrors: { notes: ['Please describe what happened.'] } };
  const body: Record<string, string> = { activityDate: input.activityDate, notes, requestId: input.requestId };
  if (input.nextFollowUpDate) {
    const task = (input.followUpTask ?? '').trim();
    if (!task) return { ok: false, error: null, fieldErrors: { followUpTask: [TASK_REQUIRED] } };
    body['nextFollowUpDate'] = input.nextFollowUpDate;
    body['followUpTask'] = task;
  }
  const res = await salesFetch(`/sales/enquiries/${enquiryId}/activities`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.error) return { ok: true, error: null, fieldErrors: {} };
  const e = res.error;
  if (e.status === 403) return { ok: false, error: 'You do not have permission to add activities.', fieldErrors: {} };
  if (e.code === 'SALES_ACTIVITY_IN_FUTURE') return { ok: false, error: null, fieldErrors: { activityDate: [e.message] } };
  if (e.code === 'SALES_FOLLOW_UP_TASK_REQUIRED') return { ok: false, error: null, fieldErrors: { followUpTask: [TASK_REQUIRED] } };
  if (e.code === 'SALES_FOLLOW_UP_IN_PAST') return { ok: false, error: null, fieldErrors: { nextFollowUpDate: [e.message] } };
  const fields = e.fields ?? {};
  if (Object.keys(fields).length > 0) return { ok: false, error: null, fieldErrors: fields };
  return { ok: false, error: e.status === 404 ? 'This enquiry could not be found.' : e.message, fieldErrors: {} };
}

// ---------------------------------------------------------------------------
// FMP-SALES-09 — linking a Confirmed enquiry to a contract. The search goes through the existing Contracts API as the
// signed-in user, so the list is already limited to the contracts (and departments) that user may see; the Sales API
// checks that again when the link is saved.
// ---------------------------------------------------------------------------

export async function searchContractsToLinkAction(query: string): Promise<{ items: ContractChoice[]; error: string | null }> {
  const q = query.trim().slice(0, 100);
  try {
    const res = await contractsApi.list({ search: q, pageSize: 10 });
    return { items: res.items.map((c) => ({ id: c.id, referenceNumber: c.referenceNumber, title: c.title, counterpartyName: c.counterpartyName, status: c.status })), error: null };
  } catch {
    return { items: [], error: 'The contracts could not be loaded. You may not have access to Contract Management.' };
  }
}

export async function linkContractAction(enquiryId: string, contractId: string): Promise<{ ok: boolean; error: string | null }> {
  if (!/^[0-9a-f-]{36}$/i.test(contractId)) return { ok: false, error: 'Please choose a contract.' };
  const res = await salesFetch(`/sales/enquiries/${enquiryId}/contract`, { method: 'POST', body: JSON.stringify({ contractId }) });
  if (res.error) {
    return { ok: false, error: res.error.status === 403 ? 'You do not have permission to link this contract.' : res.error.status === 404 ? 'That contract could not be found.' : res.error.message };
  }
  return { ok: true, error: null };
}
