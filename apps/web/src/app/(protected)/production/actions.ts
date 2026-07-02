'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

export interface ActionResult {
  error: string | null;
  fieldErrors?: Record<string, string[]>;
}

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
// Create production order
// ---------------------------------------------------------------------------

export async function createProductionOrderAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string)?.trim();
  const unit = (formData.get('unit') as string)?.trim();
  const targetQtyRaw = (formData.get('targetQuantity') as string)?.trim();

  if (!title) return { error: 'Title is required' };
  if (!unit) return { error: 'Unit is required' };
  if (!targetQtyRaw) return { error: 'Target quantity is required' };

  const targetQuantity = parseInt(targetQtyRaw, 10);
  if (isNaN(targetQuantity) || targetQuantity <= 0) return { error: 'Target quantity must be a positive integer' };

  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const productionLineId = (formData.get('productionLineId') as string | null) || undefined;
  const departmentId = (formData.get('departmentId') as string | null) || undefined;
  const plantId = (formData.get('plantId') as string | null) || undefined;
  const productCode = (formData.get('productCode') as string | null)?.trim() || undefined;
  const productName = (formData.get('productName') as string | null)?.trim() || undefined;
  const scheduledStartAt = (formData.get('scheduledStartAt') as string | null) || undefined;
  const scheduledEndAt = (formData.get('scheduledEndAt') as string | null) || undefined;
  const supervisorUserId = (formData.get('supervisorUserId') as string | null) || undefined;

  const result = await actionFetch('/production', 'POST', {
    title,
    unit,
    targetQuantity,
    ...(description !== undefined ? { description } : {}),
    ...(productionLineId !== undefined ? { productionLineId } : {}),
    ...(departmentId !== undefined ? { departmentId } : {}),
    ...(plantId !== undefined ? { plantId } : {}),
    ...(productCode !== undefined ? { productCode } : {}),
    ...(productName !== undefined ? { productName } : {}),
    ...(scheduledStartAt !== undefined ? { scheduledStartAt } : {}),
    ...(scheduledEndAt !== undefined ? { scheduledEndAt } : {}),
    ...(supervisorUserId !== undefined ? { supervisorUserId } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Failed to create production order' };

  revalidatePath('/production');
  if (result.id) redirect(`/production/${result.id}`);
  redirect('/production');
}

// ---------------------------------------------------------------------------
// Update production order
// ---------------------------------------------------------------------------

export async function updateProductionOrderAction(
  orderId: string,
  version: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get('title') as string | null)?.trim() || undefined;
  const unit = (formData.get('unit') as string | null)?.trim() || undefined;
  const targetQtyRaw = (formData.get('targetQuantity') as string | null)?.trim();
  const targetQuantity = targetQtyRaw ? parseInt(targetQtyRaw, 10) : undefined;
  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const productionLineId = (formData.get('productionLineId') as string | null) || undefined;
  const departmentId = (formData.get('departmentId') as string | null) || undefined;
  const plantId = (formData.get('plantId') as string | null) || undefined;
  const productCode = (formData.get('productCode') as string | null)?.trim() || undefined;
  const productName = (formData.get('productName') as string | null)?.trim() || undefined;
  const scheduledStartAt = (formData.get('scheduledStartAt') as string | null) || undefined;
  const scheduledEndAt = (formData.get('scheduledEndAt') as string | null) || undefined;
  const supervisorUserId = (formData.get('supervisorUserId') as string | null) || undefined;

  const result = await actionFetch(`/production/${orderId}`, 'PATCH', {
    version,
    ...(title !== undefined ? { title } : {}),
    ...(unit !== undefined ? { unit } : {}),
    ...(targetQuantity !== undefined && !isNaN(targetQuantity) ? { targetQuantity } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(productionLineId !== undefined ? { productionLineId } : {}),
    ...(departmentId !== undefined ? { departmentId } : {}),
    ...(plantId !== undefined ? { plantId } : {}),
    ...(productCode !== undefined ? { productCode } : {}),
    ...(productName !== undefined ? { productName } : {}),
    ...(scheduledStartAt !== undefined ? { scheduledStartAt } : {}),
    ...(scheduledEndAt !== undefined ? { scheduledEndAt } : {}),
    ...(supervisorUserId !== undefined ? { supervisorUserId } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Failed to update production order' };

  revalidatePath('/production');
  redirect(`/production/${orderId}`);
}

// ---------------------------------------------------------------------------
// Lifecycle transitions
// ---------------------------------------------------------------------------

export async function scheduleOrderAction(id: string, version: number): Promise<ActionResult> {
  const result = await actionFetch(`/production/${id}/schedule`, 'POST', { version });
  if (!result.ok) return { error: result.message ?? 'Failed to schedule order' };
  revalidatePath('/production');
  return { error: null };
}

export async function startOrderAction(id: string, version: number): Promise<ActionResult> {
  const result = await actionFetch(`/production/${id}/start`, 'POST', { version });
  if (!result.ok) return { error: result.message ?? 'Failed to start order' };
  revalidatePath('/production');
  return { error: null };
}

export async function pauseOrderAction(
  id: string,
  version: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const reason = (formData.get('reason') as string | null)?.trim() || undefined;
  const result = await actionFetch(`/production/${id}/pause`, 'POST', { version, ...(reason !== undefined ? { reason } : {}) });
  if (!result.ok) return { error: result.message ?? 'Failed to pause order' };
  revalidatePath('/production');
  return { error: null };
}

export async function resumeOrderAction(id: string, version: number): Promise<ActionResult> {
  const result = await actionFetch(`/production/${id}/resume`, 'POST', { version });
  if (!result.ok) return { error: result.message ?? 'Failed to resume order' };
  revalidatePath('/production');
  return { error: null };
}

export async function completeOrderAction(id: string, version: number): Promise<ActionResult> {
  const result = await actionFetch(`/production/${id}/complete`, 'POST', { version });
  if (!result.ok) return { error: result.message ?? 'Failed to complete order' };
  revalidatePath('/production');
  return { error: null };
}

export async function cancelOrderAction(
  id: string,
  version: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const reason = (formData.get('reason') as string | null)?.trim() || undefined;
  const result = await actionFetch(`/production/${id}/cancel`, 'POST', { version, ...(reason !== undefined ? { reason } : {}) });
  if (!result.ok) return { error: result.message ?? 'Failed to cancel order' };
  revalidatePath('/production');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Add production entry
// ---------------------------------------------------------------------------

export async function addProductionEntryAction(
  orderId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const type = formData.get('type') as string | null;
  if (!type) return { error: 'Entry type is required' };

  const body: Record<string, unknown> = {};

  if (type === 'OUTPUT') {
    const produced = parseInt((formData.get('quantityProduced') as string) ?? '0', 10);
    if (isNaN(produced) || produced < 0) return { error: 'quantityProduced must be a non-negative integer' };
    body['quantityProduced'] = produced;
    const accepted = (formData.get('quantityAccepted') as string | null)?.trim();
    const rejected = (formData.get('quantityRejected') as string | null)?.trim();
    if (accepted) body['quantityAccepted'] = parseInt(accepted, 10);
    if (rejected) body['quantityRejected'] = parseInt(rejected, 10);
  } else if (type === 'DOWNTIME') {
    const minutes = parseInt((formData.get('downtimeMinutes') as string) ?? '0', 10);
    if (isNaN(minutes) || minutes < 0) return { error: 'downtimeMinutes must be a non-negative integer' };
    body['downtimeMinutes'] = minutes;
  } else if (type === 'ADJUSTMENT') {
    const qty = parseInt((formData.get('adjustmentQty') as string) ?? '0', 10);
    if (isNaN(qty)) return { error: 'adjustmentQty must be an integer' };
    body['adjustmentQty'] = qty;
  } else {
    return { error: `Unknown entry type: ${type}` };
  }

  const note = (formData.get('note') as string | null)?.trim() || undefined;
  const recordedAt = (formData.get('recordedAt') as string | null) || undefined;
  if (note !== undefined) body['note'] = note;
  if (recordedAt !== undefined) body['recordedAt'] = recordedAt;

  const entryPath = type === 'OUTPUT' ? 'output' : type === 'DOWNTIME' ? 'downtime' : 'adjustment';
  const result = await actionFetch(`/production/${orderId}/entries/${entryPath}`, 'POST', body);
  if (!result.ok) return { error: result.message ?? 'Failed to add entry' };

  revalidatePath('/production');
  redirect(`/production/${orderId}`);
}

// ---------------------------------------------------------------------------
// Add production comment
// ---------------------------------------------------------------------------

export async function addProductionCommentAction(
  orderId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = (formData.get('body') as string)?.trim();
  if (!body) return { error: 'Comment cannot be empty' };

  const result = await actionFetch(`/production/${orderId}/comments`, 'POST', { body });
  if (!result.ok) return { error: result.message ?? 'Failed to add comment' };

  revalidatePath('/production');
  return { error: null };
}

// ---------------------------------------------------------------------------
// Production line actions
// ---------------------------------------------------------------------------

export async function updateProductionLineAction(
  lineId: string,
  version: number,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const name = (formData.get('name') as string | null)?.trim() || undefined;
  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const plantId = (formData.get('plantId') as string | null) || undefined;
  const locationId = (formData.get('locationId') as string | null) || undefined;
  const capacityRaw = (formData.get('capacity') as string | null)?.trim();
  const capacity = capacityRaw ? parseInt(capacityRaw, 10) : undefined;

  const result = await actionFetch(`/production/lines/${lineId}`, 'PATCH', {
    version,
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(plantId !== undefined ? { plantId } : {}),
    ...(locationId !== undefined ? { locationId } : {}),
    ...(capacity !== undefined && !isNaN(capacity) ? { capacity } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Failed to update production line' };

  revalidatePath('/production/lines');
  redirect(`/production/lines`);
}

export async function createProductionLineAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const code = (formData.get('code') as string)?.trim().toUpperCase();
  const name = (formData.get('name') as string)?.trim();

  if (!code) return { error: 'Code is required' };
  if (!name) return { error: 'Name is required' };

  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const plantId = (formData.get('plantId') as string | null) || undefined;
  const locationId = (formData.get('locationId') as string | null) || undefined;
  const capacityRaw = (formData.get('capacity') as string | null)?.trim();
  const capacity = capacityRaw ? parseInt(capacityRaw, 10) : undefined;

  const result = await actionFetch('/production/lines', 'POST', {
    code,
    name,
    ...(description !== undefined ? { description } : {}),
    ...(plantId !== undefined ? { plantId } : {}),
    ...(locationId !== undefined ? { locationId } : {}),
    ...(capacity !== undefined && !isNaN(capacity) ? { capacity } : {}),
  });

  if (!result.ok) return { error: result.message ?? 'Failed to create production line' };

  revalidatePath('/production/lines');
  redirect('/production/lines');
}
