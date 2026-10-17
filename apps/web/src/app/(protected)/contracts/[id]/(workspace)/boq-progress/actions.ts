'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// FMP-CONTRACT-11 — add ONE BOQ item to an existing contract. Files are uploaded
// afterwards, one by one, with the existing BOQ drawing upload action, so a bad
// file can never undo the saved item.

export interface AddBoqItemInput {
  description: string;
  unit: string;
  contractQty: string;
  unitPrice: string;
}

export interface AddBoqItemResult {
  error: string | null;
  /** The saved (or already existing) item. */
  itemId?: string;
  /** true = a repeated Save of an item that was already added; nothing new was created. */
  duplicate?: boolean;
}

export async function addBoqItemAction(contractId: string, input: AddBoqItemInput): Promise<AddBoqItemResult> {
  let token: string | undefined;
  try {
    token = (await cookies()).get('recafco_access')?.value;
  } catch {
    token = undefined;
  }
  try {
    const res = await fetch(`${API_BASE}/contracts/${contractId}/boq-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        description: input.description.trim(),
        unitOfMeasure: input.unit,
        contractQty: Number(input.contractQty),
        unitPrice: Number(input.unitPrice),
      }),
      cache: 'no-store',
    });
    const json = (await res.json()) as {
      data?: { item?: { id?: string }; duplicate?: boolean } | null;
      error?: { message?: string; details?: { fields?: Record<string, string[]> } } | null;
    };
    if (!res.ok || json.error || !json.data?.item?.id) {
      const firstField = json.error?.details?.fields ? Object.values(json.error.details.fields)[0]?.[0] : undefined;
      return { error: firstField ?? json.error?.message ?? 'BOQ item could not be saved. Please try again.' };
    }
    revalidatePath(`/contracts/${contractId}/boq-progress`);
    revalidatePath(`/technical/jobs/${contractId}`);
    return { error: null, itemId: json.data.item.id, duplicate: json.data.duplicate === true };
  } catch {
    return { error: 'BOQ item could not be saved. Please try again.' };
  }
}
