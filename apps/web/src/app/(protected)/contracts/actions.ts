'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// ---------------------------------------------------------------------------
// Server action result types
// ---------------------------------------------------------------------------

export interface ActionResult {
  error: string | null;
  fieldErrors?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Internal fetch helper for server actions
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string | undefined> {
  try {
    const store = await cookies();
    return store.get('recafco_access')?.value;
  } catch {
    return undefined;
  }
}

async function handleActionResponse(res: Response): Promise<{ ok: boolean; id?: string; code?: string; message?: string }> {
  if (res.ok) {
    try {
      const json = (await res.json()) as { data?: { id?: string } };
      const id = json.data?.id;
      return id !== undefined ? { ok: true, id } : { ok: true };
    } catch {
      return { ok: true };
    }
  }

  let code: string | undefined;
  let message: string | undefined;

  try {
    const json = (await res.json()) as { error?: { code?: string; message?: string } };
    code = json.error?.code;
    message = json.error?.message;
  } catch {
    message = `HTTP ${res.status}`;
  }

  return {
    ok: false,
    ...(code !== undefined ? { code } : {}),
    ...(message !== undefined ? { message } : {}),
  };
}

async function actionFetch(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; id?: string; code?: string; message?: string }> {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });

  return handleActionResponse(res);
}

/** Multipart variant for file uploads — never sets Content-Type manually, letting fetch attach the correct multipart boundary for the FormData body. */
async function actionFetchMultipart(
  path: string,
  formData: FormData,
): Promise<{ ok: boolean; id?: string; code?: string; message?: string }> {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
    cache: 'no-store',
  });

  return handleActionResponse(res);
}

// ---------------------------------------------------------------------------
// Create contract
// ---------------------------------------------------------------------------

const SCOPE_OF_WORK_KEYS = [
  'shopDrawing',
  'designProduction',
  'production',
  'delivery',
  'erection',
  'exFactory',
  'other',
  'notApplicable',
];
const PAYMENT_TERM_KEYS = ['advance', 'retention', 'performanceBond', 'insurance', 'interimPayment', 'taxClearance'];

function readCheckboxGroup(formData: FormData, prefix: string, keys: string[]): Record<string, boolean> | undefined {
  const group: Record<string, boolean> = {};
  let anyChecked = false;
  for (const key of keys) {
    const checked = formData.get(`${prefix}_${key}`) === 'on';
    group[key] = checked;
    if (checked) anyChecked = true;
  }
  return anyChecked ? group : undefined;
}

function readScopeOfWork(formData: FormData): Record<string, boolean | string> | undefined {
  const group = readCheckboxGroup(formData, 'scope', SCOPE_OF_WORK_KEYS);
  if (group === undefined) return undefined;
  const scopeOfWork: Record<string, boolean | string> = { ...group };
  if (group['other'] === true) {
    const otherDescription = (formData.get('scope_otherDescription') as string | null)?.trim();
    if (otherDescription) scopeOfWork['otherDescription'] = otherDescription;
  }
  return scopeOfWork;
}

export async function createContractAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const counterpartyName = (formData.get('counterpartyName') as string)?.trim();

  if (!title) return { error: 'Title is required' };
  if (!counterpartyName) return { error: 'Counterparty name is required' };

  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const counterpartyContact = (formData.get('counterpartyContact') as string | null)?.trim() || undefined;
  const jobOrder = (formData.get('jobOrder') as string | null)?.trim() || undefined;
  const contractDate = (formData.get('contractDate') as string | null) || undefined;
  const quotationNumber = (formData.get('quotationNumber') as string | null)?.trim() || undefined;
  const projectNumber = (formData.get('projectNumber') as string | null)?.trim() || undefined;
  const scopeOfWork = readScopeOfWork(formData);
  const paymentTerms = readCheckboxGroup(formData, 'paymentTerm', PAYMENT_TERM_KEYS);
  const boqItemsRaw = (formData.get('boqItems') as string | null)?.trim();
  let boqItems: unknown[] | undefined;
  if (boqItemsRaw) {
    try {
      const parsed: unknown = JSON.parse(boqItemsRaw);
      if (Array.isArray(parsed) && parsed.length > 0) boqItems = parsed;
    } catch {
      // Malformed payload — treat as no BOQ items rather than failing the whole submit.
    }
  }
  const contractValueRaw = (formData.get('contractValue') as string | null)?.trim();
  const contractValue = contractValueRaw ? parseFloat(contractValueRaw) : undefined;
  const currency = (formData.get('currency') as string | null)?.trim() || undefined;
  const startDate = (formData.get('startDate') as string | null) || undefined;
  const endDate = (formData.get('endDate') as string | null) || undefined;
  const renewalNoticeDate = (formData.get('renewalNoticeDate') as string | null) || undefined;
  const ownerUserId = (formData.get('ownerUserId') as string | null) || undefined;
  const departmentId = (formData.get('departmentId') as string | null) || undefined;
  const plantId = (formData.get('plantId') as string | null) || undefined;
  const locationId = (formData.get('locationId') as string | null) || undefined;
  const notes = (formData.get('notes') as string | null)?.trim() || undefined;
  const clientContactName = (formData.get('clientContactName') as string | null)?.trim() || undefined;
  const clientContactPhone = (formData.get('clientContactPhone') as string | null)?.trim() || undefined;
  const forecastCompletionDate = (formData.get('forecastCompletionDate') as string | null) || undefined;
  const originalContractValueRaw = (formData.get('originalContractValue') as string | null)?.trim();
  const originalContractValue = originalContractValueRaw ? parseFloat(originalContractValueRaw) : undefined;
  const originalCurrency = (formData.get('originalCurrency') as string | null)?.trim() || undefined;
  const projectSiteLocation = (formData.get('projectSiteLocation') as string | null)?.trim() || undefined;
  const scopeDescription = (formData.get('scopeDescription') as string | null)?.trim() || undefined;
  const scopeExclusions = (formData.get('scopeExclusions') as string | null)?.trim() || undefined;
  const deliverables = (formData.get('deliverables') as string | null)?.trim() || undefined;
  const milestones = (formData.get('milestones') as string | null)?.trim() || undefined;
  const scheduleSummary = (formData.get('scheduleSummary') as string | null)?.trim() || undefined;
  const quantitiesSpecifications = (formData.get('quantitiesSpecifications') as string | null)?.trim() || undefined;
  const craneRequired = (formData.get('craneRequired') as string | null)?.trim() || undefined;
  const craneProvidedBy = (formData.get('craneProvidedBy') as string | null)?.trim() || undefined;
  const estimatedCraneCapacity = (formData.get('estimatedCraneCapacity') as string | null)?.trim() || undefined;

  const result = await actionFetch('/contracts', 'POST', {
    title,
    counterpartyName,
    ...(description !== undefined ? { description } : {}),
    ...(counterpartyContact !== undefined ? { counterpartyContact } : {}),
    ...(jobOrder !== undefined ? { jobOrder } : {}),
    ...(contractDate !== undefined ? { contractDate } : {}),
    ...(quotationNumber !== undefined ? { quotationNumber } : {}),
    ...(projectNumber !== undefined ? { projectNumber } : {}),
    ...(scopeOfWork !== undefined ? { scopeOfWork } : {}),
    ...(paymentTerms !== undefined ? { paymentTerms } : {}),
    ...(boqItems !== undefined ? { boqItems } : {}),
    ...(contractValue !== undefined && !isNaN(contractValue) ? { contractValue } : {}),
    ...(currency !== undefined ? { currency } : {}),
    ...(startDate !== undefined ? { startDate } : {}),
    ...(endDate !== undefined ? { endDate } : {}),
    ...(renewalNoticeDate !== undefined ? { renewalNoticeDate } : {}),
    ...(ownerUserId !== undefined ? { ownerUserId } : {}),
    ...(departmentId !== undefined ? { departmentId } : {}),
    ...(plantId !== undefined ? { plantId } : {}),
    ...(locationId !== undefined ? { locationId } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(clientContactName !== undefined ? { clientContactName } : {}),
    ...(clientContactPhone !== undefined ? { clientContactPhone } : {}),
    ...(forecastCompletionDate !== undefined ? { forecastCompletionDate } : {}),
    ...(originalContractValue !== undefined && !isNaN(originalContractValue) ? { originalContractValue } : {}),
    ...(originalCurrency !== undefined ? { originalCurrency } : {}),
    ...(projectSiteLocation !== undefined ? { projectSiteLocation } : {}),
    ...(scopeDescription !== undefined ? { scopeDescription } : {}),
    ...(scopeExclusions !== undefined ? { scopeExclusions } : {}),
    ...(deliverables !== undefined ? { deliverables } : {}),
    ...(milestones !== undefined ? { milestones } : {}),
    ...(scheduleSummary !== undefined ? { scheduleSummary } : {}),
    ...(quantitiesSpecifications !== undefined ? { quantitiesSpecifications } : {}),
    ...(craneRequired !== undefined ? { craneRequired } : {}),
    ...(craneProvidedBy !== undefined ? { craneProvidedBy } : {}),
    ...(estimatedCraneCapacity !== undefined ? { estimatedCraneCapacity } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Contract could not be created.' };

  revalidatePath('/contracts');
  if (result.id) {
    redirect(`/contracts/${result.id}`);
  }
  redirect('/contracts');
}

// ---------------------------------------------------------------------------
// Update contract
// ---------------------------------------------------------------------------

export async function updateContractAction(
  contractId: string,
  version: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string | null)?.trim() || undefined;
  const counterpartyName = (formData.get('counterpartyName') as string | null)?.trim() || undefined;
  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const counterpartyContact = (formData.get('counterpartyContact') as string | null)?.trim() || undefined;
  const jobOrder = (formData.get('jobOrder') as string | null)?.trim() || undefined;
  const contractDate = (formData.get('contractDate') as string | null) || undefined;
  const quotationNumber = (formData.get('quotationNumber') as string | null)?.trim() || undefined;
  const projectNumber = (formData.get('projectNumber') as string | null)?.trim() || undefined;
  const scopeOfWork = readScopeOfWork(formData);
  const paymentTerms = readCheckboxGroup(formData, 'paymentTerm', PAYMENT_TERM_KEYS);
  // Always present on the edit form (even as "[]") so the backend can tell
  // "cleared to zero items" apart from "not touched by this request".
  const boqItemsRaw = (formData.get('boqItems') as string | null)?.trim();
  let boqItems: unknown[] | undefined;
  if (boqItemsRaw) {
    try {
      const parsed: unknown = JSON.parse(boqItemsRaw);
      if (Array.isArray(parsed)) boqItems = parsed;
    } catch {
      // Malformed payload — leave BOQ items untouched rather than failing the whole save.
    }
  }
  const contractValueRaw = (formData.get('contractValue') as string | null)?.trim();
  const contractValue = contractValueRaw ? parseFloat(contractValueRaw) : undefined;
  const currency = (formData.get('currency') as string | null)?.trim() || undefined;
  const startDate = (formData.get('startDate') as string | null) || undefined;
  const endDate = (formData.get('endDate') as string | null) || undefined;
  const renewalNoticeDate = (formData.get('renewalNoticeDate') as string | null) || undefined;
  const ownerUserId = (formData.get('ownerUserId') as string | null) || undefined;
  // Bug fix: Department/Plant are real, nullable relations with a "— None —"
  // option in the Edit Contract form. The old `|| undefined` conversion made
  // an explicitly-cleared selection indistinguishable from a field the form
  // never touched — both collapsed to `undefined`, which the backend treats
  // as "leave the existing value unchanged". So choosing "— None —" and
  // saving silently kept whatever Department/Plant was already set. Since
  // this form always renders both selects (never conditionally), an empty
  // selection here is always a deliberate clear, not an absent field — send
  // it as an explicit `null` so the backend actually clears the relation.
  const departmentIdRaw = (formData.get('departmentId') as string | null) ?? '';
  const departmentId: string | null = departmentIdRaw.trim() === '' ? null : departmentIdRaw.trim();
  const plantIdRaw = (formData.get('plantId') as string | null) ?? '';
  const plantId: string | null = plantIdRaw.trim() === '' ? null : plantIdRaw.trim();
  const locationId = (formData.get('locationId') as string | null) || undefined;
  const notes = (formData.get('notes') as string | null)?.trim() || undefined;
  const clientContactName = (formData.get('clientContactName') as string | null)?.trim() || undefined;
  const clientContactPhone = (formData.get('clientContactPhone') as string | null)?.trim() || undefined;
  const forecastCompletionDate = (formData.get('forecastCompletionDate') as string | null) || undefined;
  const originalContractValueRaw = (formData.get('originalContractValue') as string | null)?.trim();
  const originalContractValue = originalContractValueRaw ? parseFloat(originalContractValueRaw) : undefined;
  const originalCurrency = (formData.get('originalCurrency') as string | null)?.trim() || undefined;
  const projectSiteLocation = (formData.get('projectSiteLocation') as string | null)?.trim() || undefined;
  const scopeDescription = (formData.get('scopeDescription') as string | null)?.trim() || undefined;
  const scopeExclusions = (formData.get('scopeExclusions') as string | null)?.trim() || undefined;
  const deliverables = (formData.get('deliverables') as string | null)?.trim() || undefined;
  const milestones = (formData.get('milestones') as string | null)?.trim() || undefined;
  const scheduleSummary = (formData.get('scheduleSummary') as string | null)?.trim() || undefined;
  const quantitiesSpecifications = (formData.get('quantitiesSpecifications') as string | null)?.trim() || undefined;
  const craneRequired = (formData.get('craneRequired') as string | null)?.trim() || undefined;
  const craneProvidedBy = (formData.get('craneProvidedBy') as string | null)?.trim() || undefined;
  const estimatedCraneCapacity = (formData.get('estimatedCraneCapacity') as string | null)?.trim() || undefined;

  const result = await actionFetch(`/contracts/${contractId}`, 'PATCH', {
    version,
    // Always included (never conditional) — departmentId/plantId are always
    // real form fields here, so a real UUID or an explicit null (cleared to
    // "— None —") is always the deliberate current value, never "untouched".
    departmentId,
    plantId,
    ...(title !== undefined ? { title } : {}),
    ...(counterpartyName !== undefined ? { counterpartyName } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(counterpartyContact !== undefined ? { counterpartyContact } : {}),
    ...(jobOrder !== undefined ? { jobOrder } : {}),
    ...(contractDate !== undefined ? { contractDate } : {}),
    ...(quotationNumber !== undefined ? { quotationNumber } : {}),
    ...(projectNumber !== undefined ? { projectNumber } : {}),
    ...(scopeOfWork !== undefined ? { scopeOfWork } : {}),
    ...(paymentTerms !== undefined ? { paymentTerms } : {}),
    ...(boqItems !== undefined ? { boqItems } : {}),
    ...(contractValue !== undefined && !isNaN(contractValue) ? { contractValue } : {}),
    ...(currency !== undefined ? { currency } : {}),
    ...(startDate !== undefined ? { startDate } : {}),
    ...(endDate !== undefined ? { endDate } : {}),
    ...(renewalNoticeDate !== undefined ? { renewalNoticeDate } : {}),
    ...(ownerUserId !== undefined ? { ownerUserId } : {}),
    ...(locationId !== undefined ? { locationId } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(clientContactName !== undefined ? { clientContactName } : {}),
    ...(clientContactPhone !== undefined ? { clientContactPhone } : {}),
    ...(forecastCompletionDate !== undefined ? { forecastCompletionDate } : {}),
    ...(originalContractValue !== undefined && !isNaN(originalContractValue) ? { originalContractValue } : {}),
    ...(originalCurrency !== undefined ? { originalCurrency } : {}),
    ...(projectSiteLocation !== undefined ? { projectSiteLocation } : {}),
    ...(scopeDescription !== undefined ? { scopeDescription } : {}),
    ...(scopeExclusions !== undefined ? { scopeExclusions } : {}),
    ...(deliverables !== undefined ? { deliverables } : {}),
    ...(milestones !== undefined ? { milestones } : {}),
    ...(scheduleSummary !== undefined ? { scheduleSummary } : {}),
    ...(quantitiesSpecifications !== undefined ? { quantitiesSpecifications } : {}),
    ...(craneRequired !== undefined ? { craneRequired } : {}),
    ...(craneProvidedBy !== undefined ? { craneProvidedBy } : {}),
    ...(estimatedCraneCapacity !== undefined ? { estimatedCraneCapacity } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Contract could not be updated.' };

  revalidatePath('/contracts');
  revalidatePath(`/contracts/${contractId}`);
  redirect(`/contracts/${contractId}`);
}

// ---------------------------------------------------------------------------
// CM-55 — manager-facing schedule/progress status (Contract List Status
// dropdown). Deliberately its own endpoint/action — see
// PATCH /contracts/:id/schedule-status in the API: no version required, no
// lifecycle change, never bypasses closeout.
// ---------------------------------------------------------------------------

export async function updateContractScheduleStatusAction(id: string, scheduleStatus: string): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/${id}/schedule-status`, 'PATCH', { scheduleStatus });
  if (!result.ok) return { error: result.message ?? 'Failed to update status' };

  revalidatePath('/contracts');
  return { error: null };
}

// ---------------------------------------------------------------------------
// CM-68A — Contract Detail Schedule (Planned vs Actual). A genuinely
// different concept from the manager-facing scheduleStatus dropdown above —
// this saves the real PLANNED milestone dates for one contract's fixed
// 8-stage schedule (ContractScheduleItem). Takes a plain typed array
// argument (not FormData) since the Edit Planned Schedule drawer collects
// several rows at once — same "direct typed args" shape already established
// by updateContractScheduleStatusAction/activateContractAction above, just
// with a structured array payload. Actual values are never sent from here —
// the backend always derives them live, this endpoint only ever writes
// planned fields.
// ---------------------------------------------------------------------------

export async function updateContractSchedulePlanAction(
  contractId: string,
  items: {
    stageKey: string;
    stageName?: string | undefined;
    responsibleTeam?: string | undefined;
    plannedStartDate?: string | undefined;
    plannedEndDate?: string | undefined;
    plannedQuantity?: number | undefined;
    plannedMolds?: number | undefined;
    remarks?: string | undefined;
    isRequired?: boolean | undefined;
  }[],
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/${contractId}/schedule/planned`, 'PATCH', { items });
  if (!result.ok) return { error: result.message ?? 'Planned schedule could not be saved.' };

  revalidatePath(`/contracts/${contractId}/schedule`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Activate contract
// ---------------------------------------------------------------------------

export async function activateContractAction(id: string, version: number): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/${id}/activate`, 'POST', { version });
  if (!result.ok) return { error: result.message ?? 'Failed to activate contract' };

  revalidatePath('/contracts');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Terminate contract
// ---------------------------------------------------------------------------

export async function terminateContractAction(
  id: string,
  version: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const reason = (formData.get('reason') as string)?.trim();
  if (!reason) return { error: 'Termination reason is required' };

  const result = await actionFetch(`/contracts/${id}/terminate`, 'POST', { reason, version });
  if (!result.ok) return { error: result.message ?? 'Failed to terminate contract' };

  revalidatePath('/contracts');
  return { error: null };
}

// ---------------------------------------------------------------------------
// CM-69A — Cancel/Void contract (safe alternative to hard deletion). Same
// required-reason/version pattern as terminateContractAction above; the
// label shown to the user is "Cancel Contract" (ACTIVE) or "Remove Draft"
// (DRAFT) depending on the contract's current status, but both call this
// same endpoint/action — there is no separate hard-delete path anywhere.
// ---------------------------------------------------------------------------

export async function cancelContractAction(id: string, version: number, reason: string): Promise<ActionResult> {
  const trimmed = reason.trim();
  if (!trimmed) return { error: 'Cancellation reason is required' };

  const result = await actionFetch(`/contracts/${id}/cancel`, 'POST', { reason: trimmed, version });
  if (!result.ok) return { error: result.message ?? 'Failed to cancel contract' };

  // CM-69H — a cancelled contract must stop counting toward every page that
  // shows "active/working" data, not just the List it's redirected back to.
  // Cache invalidation is the actual fix here — there is no real-time
  // websocket dashboard in this app, so a stale cached render (Next.js
  // Data Cache/Router Cache) is the only way old numbers could persist past
  // a real redirect/refresh.
  revalidatePath('/contracts');
  revalidatePath('/contracts/dashboard');
  revalidatePath('/contracts/schedule');
  revalidatePath(`/contracts/${id}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Close contract
// ---------------------------------------------------------------------------

export async function closeContractAction(id: string, version: number): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/${id}/close`, 'POST', { version });
  if (!result.ok) return { error: result.message ?? 'Failed to close contract' };

  revalidatePath('/contracts');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Add comment
// ---------------------------------------------------------------------------

export async function addContractCommentAction(
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = (formData.get('body') as string)?.trim();
  if (!body) return { error: 'Comment cannot be empty' };

  const result = await actionFetch(`/contracts/${contractId}/comments`, 'POST', { body });
  if (!result.ok) return { error: result.message ?? 'Failed to add comment' };

  revalidatePath('/contracts');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Contract Payments Register (module-level — /contracts/payments)
// ---------------------------------------------------------------------------

function readPaymentFields(formData: FormData): Record<string, unknown> {
  const paymentNo = (formData.get('paymentNo') as string | null)?.trim() || undefined;
  const invoiceNumber = (formData.get('invoiceNumber') as string | null)?.trim() || undefined;
  const invoiceDate = (formData.get('invoiceDate') as string | null) || undefined;
  const paymentTerm = (formData.get('paymentTerm') as string | null)?.trim() || undefined;
  const submittedAmountRaw = (formData.get('submittedAmount') as string | null)?.trim();
  const submittedAmount = submittedAmountRaw ? parseFloat(submittedAmountRaw) : undefined;
  const certifiedAmountRaw = (formData.get('certifiedAmount') as string | null)?.trim();
  const certifiedAmount = certifiedAmountRaw ? parseFloat(certifiedAmountRaw) : undefined;
  const paidAmountRaw = (formData.get('paidAmount') as string | null)?.trim();
  const paidAmount = paidAmountRaw ? parseFloat(paidAmountRaw) : undefined;
  const dueDate = (formData.get('dueDate') as string | null) || undefined;
  const paidDate = (formData.get('paidDate') as string | null) || undefined;
  const status = (formData.get('status') as string | null) || undefined;
  const remarks = (formData.get('remarks') as string | null)?.trim() || undefined;

  return {
    ...(paymentNo !== undefined ? { paymentNo } : {}),
    ...(invoiceNumber !== undefined ? { invoiceNumber } : {}),
    ...(invoiceDate !== undefined ? { invoiceDate } : {}),
    ...(paymentTerm !== undefined ? { paymentTerm } : {}),
    ...(submittedAmount !== undefined && !isNaN(submittedAmount) ? { submittedAmount } : {}),
    ...(certifiedAmount !== undefined && !isNaN(certifiedAmount) ? { certifiedAmount } : {}),
    ...(paidAmount !== undefined && !isNaN(paidAmount) ? { paidAmount } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(paidDate !== undefined ? { paidDate } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(remarks !== undefined ? { remarks } : {}),
  };
}

export async function createPaymentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const contractId = (formData.get('contractId') as string | null) || '';
  if (!contractId) return { error: 'Please select a contract.' };

  const result = await actionFetch(`/contracts/${contractId}/payments`, 'POST', readPaymentFields(formData));
  if (!result.ok) return { error: result.message ?? 'Payment could not be created.' };

  // Bug fix: this previously only revalidated the module-level register
  // path, never the Contract Detail Payments tab's own real route — a
  // payment added from that tab saved correctly but never showed up
  // without a manual browser refresh, since that page's own cached data
  // was never invalidated.
  revalidatePath('/contracts/payments');
  revalidatePath(`/contracts/${contractId}/payments`);
  return { error: null };
}

export async function updatePaymentAction(
  paymentId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/payments/${paymentId}`, 'PATCH', readPaymentFields(formData));
  if (!result.ok) return { error: result.message ?? 'Payment could not be updated.' };

  revalidatePath('/contracts/payments');
  if (contractId) revalidatePath(`/contracts/${contractId}/payments`);
  return { error: null };
}

export async function cancelPaymentAction(paymentId: string): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/payments/${paymentId}`, 'PATCH', { status: 'CANCELLED' });
  if (!result.ok) return { error: result.message ?? 'Failed to cancel payment' };

  revalidatePath('/contracts/payments');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Contract Production Status (CM-59 — contract-scoped, per-BOQ-item upsert)
// ---------------------------------------------------------------------------

function readProductionFields(formData: FormData): Record<string, unknown> {
  const producedQtyRaw = (formData.get('producedQty') as string | null)?.trim();
  const producedQty = producedQtyRaw ? parseFloat(producedQtyRaw) : undefined;
  const deliveredQtyRaw = (formData.get('deliveredQty') as string | null)?.trim();
  const deliveredQty = deliveredQtyRaw ? parseFloat(deliveredQtyRaw) : undefined;
  const status = (formData.get('status') as string | null) || undefined;
  const remarks = (formData.get('remarks') as string | null)?.trim() || undefined;

  return {
    ...(producedQty !== undefined && !isNaN(producedQty) ? { producedQty } : {}),
    ...(deliveredQty !== undefined && !isNaN(deliveredQty) ? { deliveredQty } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(remarks !== undefined ? { remarks } : {}),
  };
}

export async function updateProductionAction(
  itemId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/production/${itemId}`, 'PATCH', readProductionFields(formData));
  if (!result.ok) return { error: result.message ?? 'Production could not be updated.' };

  revalidatePath(`/contracts/${contractId}/production`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Contract Variations / Change Orders (CM-60 — contract-scoped)
// ---------------------------------------------------------------------------

function readVariationFields(formData: FormData): Record<string, unknown> {
  const variationNo = (formData.get('variationNo') as string | null)?.trim() || undefined;
  const description = (formData.get('description') as string | null)?.trim();
  const amountRaw = (formData.get('amount') as string | null)?.trim();
  const amount = amountRaw ? parseFloat(amountRaw) : undefined;
  // Real checkbox, always rendered — its presence in FormData IS the value
  // (checked vs unchecked), so this is always sent explicitly, never
  // conditionally omitted like the optional text fields below.
  const affectsContractValue = formData.get('affectsContractValue') === 'true';
  const status = (formData.get('status') as string | null) || undefined;
  const submittedDate = (formData.get('submittedDate') as string | null) || undefined;
  const approvedDate = (formData.get('approvedDate') as string | null) || undefined;
  const supportingDocumentName = (formData.get('supportingDocumentName') as string | null)?.trim() || undefined;
  const supportingDocumentUrl = (formData.get('supportingDocumentUrl') as string | null)?.trim() || undefined;
  const remarks = (formData.get('remarks') as string | null)?.trim() || undefined;

  return {
    ...(variationNo !== undefined ? { variationNo } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(amount !== undefined && !isNaN(amount) ? { amount } : {}),
    affectsContractValue,
    ...(status !== undefined ? { status } : {}),
    ...(submittedDate !== undefined ? { submittedDate } : {}),
    ...(approvedDate !== undefined ? { approvedDate } : {}),
    ...(supportingDocumentName !== undefined ? { supportingDocumentName } : {}),
    ...(supportingDocumentUrl !== undefined ? { supportingDocumentUrl } : {}),
    ...(remarks !== undefined ? { remarks } : {}),
  };
}

export async function createVariationAction(
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/${contractId}/variations`, 'POST', readVariationFields(formData));
  if (!result.ok) return { error: result.message ?? 'Variation could not be created.' };

  revalidatePath(`/contracts/${contractId}/variations`);
  return { error: null };
}

export async function updateVariationAction(
  variationId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/variations/${variationId}`, 'PATCH', readVariationFields(formData));
  if (!result.ok) return { error: result.message ?? 'Variation could not be updated.' };

  revalidatePath(`/contracts/${contractId}/variations`);
  return { error: null };
}

// CM-60C — real supporting-document upload. Only meaningful once the
// variation already exists (contractId/variationId both required), matching
// this unit's own "create the variation first, then attach files in Edit"
// decision — see contract-variation-form-modal.tsx.
export async function uploadVariationAttachmentAction(
  contractId: string,
  variationId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Please choose a file to upload.' };

  const upload = new FormData();
  upload.set('file', file);

  const result = await actionFetchMultipart(`/contracts/${contractId}/variations/${variationId}/attachments`, upload);
  if (!result.ok) return { error: result.message ?? 'Attachment could not be uploaded.' };

  revalidatePath(`/contracts/${contractId}/variations`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Contract Risk Assessment (CM-62 — contract-scoped)
// ---------------------------------------------------------------------------

function readRiskFields(formData: FormData): Record<string, unknown> {
  const riskNo = (formData.get('riskNo') as string | null)?.trim() || undefined;
  const description = (formData.get('description') as string | null)?.trim();
  const riskEvaluation = (formData.get('riskEvaluation') as string | null) || undefined;
  const riskResponse = (formData.get('riskResponse') as string | null) || undefined;
  const riskResponseDescription = (formData.get('riskResponseDescription') as string | null)?.trim() || undefined;
  // Manual only — never derived here from riskEvaluation/riskResponse.
  const residualRisk = (formData.get('residualRisk') as string | null) || undefined;
  const status = (formData.get('status') as string | null) || undefined;
  const responsibleUserId = (formData.get('responsibleUserId') as string | null) || undefined;
  const actionDueDate = (formData.get('actionDueDate') as string | null) || undefined;
  const remarks = (formData.get('remarks') as string | null)?.trim() || undefined;

  return {
    ...(riskNo !== undefined ? { riskNo } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(riskEvaluation !== undefined ? { riskEvaluation } : {}),
    ...(riskResponse !== undefined ? { riskResponse } : {}),
    ...(riskResponseDescription !== undefined ? { riskResponseDescription } : {}),
    ...(residualRisk !== undefined ? { residualRisk } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(responsibleUserId !== undefined ? { responsibleUserId } : {}),
    ...(actionDueDate !== undefined ? { actionDueDate } : {}),
    ...(remarks !== undefined ? { remarks } : {}),
  };
}

export async function createRiskAction(
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/${contractId}/risks`, 'POST', readRiskFields(formData));
  if (!result.ok) return { error: result.message ?? 'Risk could not be created.' };

  revalidatePath(`/contracts/${contractId}/risks`);
  return { error: null };
}

export async function updateRiskAction(
  riskId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/risks/${riskId}`, 'PATCH', readRiskFields(formData));
  if (!result.ok) return { error: result.message ?? 'Risk could not be updated.' };

  revalidatePath(`/contracts/${contractId}/risks`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Contract Documents & Obligations (CM-63 — contract-scoped)
// ---------------------------------------------------------------------------

function readDocumentObligationFields(formData: FormData): Record<string, unknown> {
  const itemNo = (formData.get('itemNo') as string | null)?.trim() || undefined;
  const title = (formData.get('title') as string | null)?.trim();
  const category = (formData.get('category') as string | null) || undefined;
  const responsibleParty = (formData.get('responsibleParty') as string | null)?.trim() || undefined;
  const requiredDate = (formData.get('requiredDate') as string | null) || undefined;
  const submissionOrExpiryDate = (formData.get('submissionOrExpiryDate') as string | null) || undefined;
  const submissionDate = (formData.get('submissionDate') as string | null) || undefined;
  const expiryDate = (formData.get('expiryDate') as string | null) || undefined;
  const status = (formData.get('status') as string | null) || undefined;
  const remarks = (formData.get('remarks') as string | null)?.trim() || undefined;

  return {
    ...(itemNo !== undefined ? { itemNo } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(responsibleParty !== undefined ? { responsibleParty } : {}),
    ...(requiredDate !== undefined ? { requiredDate } : {}),
    ...(submissionOrExpiryDate !== undefined ? { submissionOrExpiryDate } : {}),
    ...(submissionDate !== undefined ? { submissionDate } : {}),
    ...(expiryDate !== undefined ? { expiryDate } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(remarks !== undefined ? { remarks } : {}),
  };
}

export async function createDocumentObligationAction(
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/${contractId}/document-obligations`, 'POST', readDocumentObligationFields(formData));
  if (!result.ok) return { error: result.message ?? 'Document / obligation could not be created.' };

  revalidatePath(`/contracts/${contractId}/documents`);
  return { error: null };
}

export async function updateDocumentObligationAction(
  itemId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/document-obligations/${itemId}`, 'PATCH', readDocumentObligationFields(formData));
  if (!result.ok) return { error: result.message ?? 'Document / obligation could not be updated.' };

  revalidatePath(`/contracts/${contractId}/documents`);
  return { error: null };
}

// CM-63 — real supporting-document upload. Only meaningful once the item
// already exists (contractId/itemId both required) — see the Add mode
// honest note in contract-document-form-modal.tsx.
export async function uploadDocumentObligationAttachmentAction(
  contractId: string,
  itemId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Please choose a file before uploading.' };

  const upload = new FormData();
  upload.set('file', file);

  const result = await actionFetchMultipart(`/contracts/${contractId}/document-obligations/${itemId}/attachments`, upload);
  if (!result.ok) return { error: result.message ?? 'Attachment could not be uploaded.' };

  revalidatePath(`/contracts/${contractId}/documents`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Contract Workflow & Team Tasks (module-level — /contracts/workflow)
// ---------------------------------------------------------------------------

// CM-46B/CM-49/CM-50/CM-51 — optional Contract Staff task-intake fields for
// every task-specific work form the focused task screen renders (Drawing
// Received's Receipt Details / Drawing-Task Information / Follow-up;
// SD & Calculation Submission's Submission Information; Getting Approval's
// Approval Information; FD Issuance's FD Issuance Information). Present
// only on the staff panel's form (marked by the hasTaskFormFields hidden
// input) — the manager drawer's form has none of these inputs, so
// formData is simply never sent for a manager save, leaving the existing
// value untouched server-side. Each task-specific form only renders its
// own field names, so only those actually get collected here per save —
// this list is just the full superset of names to check. The backend's
// sanitizeWorkflowTaskFormData() is the real allow-list.
const TASK_FORM_DATA_TEXT_FIELDS = [
  // Drawing Received
  'receivedDate', 'receivedFrom', 'senderName', 'drawingType', 'drawingReferenceNo',
  'revisionNo', 'numberOfSheets', 'drawingDescription', 'relatedAreaPackage',
  'linkedContractStage', 'internalReferenceNo', 'internalNotes', 'plannedReviewStart',
  // SD & Calculation Submission (CM-49) — drawingReferenceNo/revisionNo above are reused, not duplicated.
  'submissionDate', 'submissionType', 'submittedTo', 'targetApprovalDate',
  'relatedDrawingReceived', 'calculationType', 'numberOfSheetsFiles', 'scopeDescription',
  'submittedBy', 'designation', 'submissionMethod', 'submissionReferenceNo',
  'contactNo', 'email',
  // Getting Approval (CM-50) — submittedBy/revisionNo above are reused, not duplicated.
  'submittedOn', 'submittedToReviewerClient', 'approvalStatus', 'expectedApprovalDate',
  'reviewedOn', 'reviewedBy', 'clientReviewerComments', 'resubmissionDate',
  'resubmissionReasonComments',
  // FD Issuance (CM-51) — drawingReferenceNo/revisionNo/numberOfSheetsFiles/designation/
  // contactNo/email above are reused, not duplicated.
  'fdIssueDate', 'issuedTo', 'purposeFor', 'issueType', 'approvedReferenceNo',
  'approvedDate', 'scale', 'distribution', 'issueMethod', 'issuedBy',
] as const;
const TASK_FORM_DATA_BOOLEAN_FIELDS = ['requiresImmediateReview', 'additionalDocumentsReceived', 'resubmissionRequired'] as const;

export async function updateWorkflowTaskAction(
  taskId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const status = (formData.get('status') as string | null) || undefined;
  const responsibleUserId = (formData.get('responsibleUserId') as string | null) || undefined;
  const startDate = (formData.get('startDate') as string | null) || undefined;
  const dueDate = (formData.get('dueDate') as string | null) || undefined;
  const completedDate = (formData.get('completedDate') as string | null) || undefined;
  const remarks = (formData.get('remarks') as string | null)?.trim() || undefined;
  const priority = (formData.get('priority') as string | null) || undefined;
  const delayReason = (formData.get('delayReason') as string | null)?.trim() || undefined;

  let taskFormData: Record<string, string | boolean> | undefined;
  if (formData.get('hasTaskFormFields') === 'true') {
    taskFormData = {};
    for (const key of TASK_FORM_DATA_TEXT_FIELDS) {
      const value = (formData.get(key) as string | null)?.trim();
      if (value) taskFormData[key] = value;
    }
    for (const key of TASK_FORM_DATA_BOOLEAN_FIELDS) {
      if (formData.get(key) === 'on') taskFormData[key] = true;
    }
  }

  const result = await actionFetch(`/contracts/workflow/tasks/${taskId}`, 'PATCH', {
    ...(status !== undefined ? { status } : {}),
    ...(responsibleUserId !== undefined ? { responsibleUserId } : {}),
    ...(startDate !== undefined ? { startDate } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(completedDate !== undefined ? { completedDate } : {}),
    ...(remarks !== undefined ? { remarks } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(delayReason !== undefined ? { delayReason } : {}),
    ...(taskFormData !== undefined ? { formData: taskFormData } : {}),
  });
  if (!result.ok) return { error: result.message ?? 'Task could not be updated.' };

  revalidatePath('/contracts/workflow');
  revalidatePath(`/contracts/${contractId}/workflow`);
  return { error: null };
}

export async function addWorkflowTaskCommentAction(
  taskId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const comment = (formData.get('comment') as string | null)?.trim();
  if (!comment) return { error: 'Comment is required.' };

  const result = await actionFetch(`/contracts/workflow/tasks/${taskId}/comments`, 'POST', { comment });
  if (!result.ok) return { error: result.message ?? 'Comment could not be added.' };

  revalidatePath('/contracts/workflow');
  revalidatePath(`/contracts/${contractId}/workflow`);
  return { error: null };
}

export async function uploadWorkflowTaskAttachmentAction(
  taskId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Please choose a file to upload.' };

  const upload = new FormData();
  upload.set('file', file);

  const result = await actionFetchMultipart(`/contracts/workflow/tasks/${taskId}/attachments`, upload);
  if (!result.ok) return { error: result.message ?? 'Attachment could not be uploaded.' };

  revalidatePath('/contracts/workflow');
  revalidatePath(`/contracts/${contractId}/workflow`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Contract Issue Log (module-level — /contracts/issues)
// ---------------------------------------------------------------------------

function readIssueFields(formData: FormData): Record<string, unknown> {
  const issueNo = (formData.get('issueNo') as string | null)?.trim() || undefined;
  const title = (formData.get('title') as string | null)?.trim() || undefined;
  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const category = (formData.get('category') as string | null) || undefined;
  const priority = (formData.get('priority') as string | null) || undefined;
  const status = (formData.get('status') as string | null) || undefined;
  const responsibleUserId = (formData.get('responsibleUserId') as string | null) || undefined;
  const raisedDate = (formData.get('raisedDate') as string | null) || undefined;
  const dueDate = (formData.get('dueDate') as string | null) || undefined;
  const closedDate = (formData.get('closedDate') as string | null) || undefined;
  const resolution = (formData.get('resolution') as string | null)?.trim() || undefined;
  const remarks = (formData.get('remarks') as string | null)?.trim() || undefined;

  return {
    ...(issueNo !== undefined ? { issueNo } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(responsibleUserId !== undefined ? { responsibleUserId } : {}),
    ...(raisedDate !== undefined ? { raisedDate } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(closedDate !== undefined ? { closedDate } : {}),
    ...(resolution !== undefined ? { resolution } : {}),
    ...(remarks !== undefined ? { remarks } : {}),
  };
}

export async function createIssueAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const contractId = (formData.get('contractId') as string | null) || '';
  if (!contractId) return { error: 'Please select a contract.' };

  const title = (formData.get('title') as string | null)?.trim();
  if (!title) return { error: 'Issue Title is required.' };

  const result = await actionFetch(`/contracts/${contractId}/issues`, 'POST', readIssueFields(formData));
  if (!result.ok) return { error: result.message ?? 'Issue could not be created.' };

  revalidatePath('/contracts/issues');
  revalidatePath(`/contracts/${contractId}/issues`);
  return { error: null };
}

export async function updateIssueAction(
  issueId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/issues/${issueId}`, 'PATCH', readIssueFields(formData));
  if (!result.ok) return { error: result.message ?? 'Issue could not be updated.' };

  revalidatePath('/contracts/issues');
  revalidatePath(`/contracts/${contractId}/issues`);
  return { error: null };
}

export async function closeIssueAction(issueId: string, contractId: string): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/issues/${issueId}/close`, 'PATCH');
  if (!result.ok) return { error: result.message ?? 'Failed to close issue' };

  revalidatePath('/contracts/issues');
  revalidatePath(`/contracts/${contractId}/issues`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Contract Claim Log (module-level — /contracts/claims)
// ---------------------------------------------------------------------------

function readClaimFields(formData: FormData): Record<string, unknown> {
  const claimNo = (formData.get('claimNo') as string | null)?.trim() || undefined;
  const claimTitle = (formData.get('claimTitle') as string | null)?.trim() || undefined;
  const claimType = (formData.get('claimType') as string | null) || undefined;
  const status = (formData.get('status') as string | null) || undefined;
  const eventDate = (formData.get('eventDate') as string | null) || undefined;
  const claimDate = (formData.get('claimDate') as string | null) || undefined;
  const submittedValueRaw = (formData.get('submittedValue') as string | null)?.trim() || undefined;
  const approvedValueRaw = (formData.get('approvedValue') as string | null)?.trim() || undefined;
  const eotClaimedDaysRaw = (formData.get('eotClaimedDays') as string | null)?.trim() || undefined;
  const eotApprovedDaysRaw = (formData.get('eotApprovedDays') as string | null)?.trim() || undefined;
  const responsibleUserId = (formData.get('responsibleUserId') as string | null) || undefined;
  const nextAction = (formData.get('nextAction') as string | null)?.trim() || undefined;
  const dueDate = (formData.get('dueDate') as string | null) || undefined;
  const closedDate = (formData.get('closedDate') as string | null) || undefined;
  const remarks = (formData.get('remarks') as string | null)?.trim() || undefined;

  return {
    ...(claimNo !== undefined ? { claimNo } : {}),
    ...(claimTitle !== undefined ? { claimTitle } : {}),
    ...(claimType !== undefined ? { claimType } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(eventDate !== undefined ? { eventDate } : {}),
    ...(claimDate !== undefined ? { claimDate } : {}),
    ...(submittedValueRaw !== undefined ? { submittedValue: Number(submittedValueRaw) } : {}),
    ...(approvedValueRaw !== undefined ? { approvedValue: Number(approvedValueRaw) } : {}),
    ...(eotClaimedDaysRaw !== undefined ? { eotClaimedDays: Number(eotClaimedDaysRaw) } : {}),
    ...(eotApprovedDaysRaw !== undefined ? { eotApprovedDays: Number(eotApprovedDaysRaw) } : {}),
    ...(responsibleUserId !== undefined ? { responsibleUserId } : {}),
    ...(nextAction !== undefined ? { nextAction } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(closedDate !== undefined ? { closedDate } : {}),
    ...(remarks !== undefined ? { remarks } : {}),
  };
}

export async function createClaimAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const contractId = (formData.get('contractId') as string | null) || '';
  if (!contractId) return { error: 'Please select a contract.' };

  const claimTitle = (formData.get('claimTitle') as string | null)?.trim();
  if (!claimTitle) return { error: 'Claim Title is required.' };

  const result = await actionFetch(`/contracts/${contractId}/claims`, 'POST', readClaimFields(formData));
  if (!result.ok) return { error: result.message ?? 'Claim could not be created.' };

  revalidatePath('/contracts/claims');
  revalidatePath(`/contracts/${contractId}/claims`);
  return { error: null };
}

export async function updateClaimAction(
  claimId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/claims/${claimId}`, 'PATCH', readClaimFields(formData));
  if (!result.ok) return { error: result.message ?? 'Claim could not be updated.' };

  revalidatePath('/contracts/claims');
  revalidatePath(`/contracts/${contractId}/claims`);
  return { error: null };
}

export async function closeClaimAction(
  claimId: string,
  contractId: string,
  targetStatus: 'CLOSED' | 'SETTLED' = 'CLOSED',
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/claims/${claimId}/close`, 'PATCH', { status: targetStatus });
  if (!result.ok) return { error: result.message ?? 'Failed to close claim' };

  revalidatePath('/contracts/claims');
  revalidatePath(`/contracts/${contractId}/claims`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Contract Closeout Approval Flow (CM-33 — per-contract only, no module page)
// ---------------------------------------------------------------------------

function revalidateCloseout(contractId: string): void {
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/contracts/${contractId}/closeout`);
}

export async function createCloseoutRequestAction(
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const closeoutSummary = (formData.get('closeoutSummary') as string | null)?.trim();
  if (!closeoutSummary) return { error: 'Closeout Summary is required.' };
  const requestedRemarks = (formData.get('requestedRemarks') as string | null)?.trim() || undefined;

  const result = await actionFetch(`/contracts/${contractId}/closeout/request`, 'POST', {
    closeoutSummary,
    ...(requestedRemarks !== undefined ? { requestedRemarks } : {}),
  });
  if (!result.ok) return { error: result.message ?? 'Closeout request could not be submitted.' };

  revalidateCloseout(contractId);
  return { error: null };
}

export async function reviewCloseoutRequestAction(requestId: string, contractId: string): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/closeout/${requestId}/review`, 'POST', {});
  if (!result.ok) return { error: result.message ?? 'Failed to start review.' };

  revalidateCloseout(contractId);
  return { error: null };
}

export async function approveCloseoutRequestAction(
  requestId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const reviewRemarks = (formData.get('reviewRemarks') as string | null)?.trim() || undefined;

  const result = await actionFetch(`/contracts/closeout/${requestId}/approve`, 'POST', {
    ...(reviewRemarks !== undefined ? { reviewRemarks } : {}),
  });
  if (!result.ok) return { error: result.message ?? 'Failed to approve closeout request.' };

  revalidateCloseout(contractId);
  return { error: null };
}

export async function rejectCloseoutRequestAction(
  requestId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rejectionReason = (formData.get('rejectionReason') as string | null)?.trim();
  if (!rejectionReason) return { error: 'Rejection reason is required.' };

  const result = await actionFetch(`/contracts/closeout/${requestId}/reject`, 'POST', { rejectionReason });
  if (!result.ok) return { error: result.message ?? 'Failed to reject closeout request.' };

  revalidateCloseout(contractId);
  return { error: null };
}

export async function closeContractFromCloseoutAction(requestId: string, contractId: string): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/closeout/${requestId}/close-contract`, 'POST', {});
  if (!result.ok) return { error: result.message ?? 'Failed to close the contract.' };

  revalidateCloseout(contractId);
  return { error: null };
}

export async function uploadCloseoutAttachmentAction(
  requestId: string,
  contractId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Please choose a file to upload.' };

  const upload = new FormData();
  upload.set('file', file);

  const result = await actionFetchMultipart(`/contracts/closeout/${requestId}/attachments`, upload);
  if (!result.ok) return { error: result.message ?? 'Attachment could not be uploaded.' };

  revalidateCloseout(contractId);
  return { error: null };
}
