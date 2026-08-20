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

async function actionFetch(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; id?: string; code?: string; message?: string }> {
  let token: string | undefined;
  try {
    const store = await cookies();
    token = store.get('recafco_access')?.value;
  } catch {
    // not in request context
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });

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

  const result = await actionFetch(`/contracts/${contractId}`, 'PATCH', {
    version,
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

  if (!result.ok) return { error: result.message ?? 'Contract could not be updated.' };

  revalidatePath('/contracts');
  revalidatePath(`/contracts/${contractId}`);
  redirect(`/contracts/${contractId}`);
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

  revalidatePath('/contracts/payments');
  return { error: null };
}

export async function updatePaymentAction(
  paymentId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/payments/${paymentId}`, 'PATCH', readPaymentFields(formData));
  if (!result.ok) return { error: result.message ?? 'Payment could not be updated.' };

  revalidatePath('/contracts/payments');
  return { error: null };
}

export async function cancelPaymentAction(paymentId: string): Promise<ActionResult> {
  const result = await actionFetch(`/contracts/payments/${paymentId}`, 'PATCH', { status: 'CANCELLED' });
  if (!result.ok) return { error: result.message ?? 'Failed to cancel payment' };

  revalidatePath('/contracts/payments');
  return { error: null };
}
