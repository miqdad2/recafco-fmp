'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { ContractParty } from '@/lib/contracts-api';

const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

// FMP-CONTRACT-01 — Contract Party actions. Return the saved party so the
// New Contract Register quick-add can select it straight away.
export interface PartyActionResult {
  error: string | null;
  party?: ContractParty;
}

async function partyFetch(path: string, method: string, body: unknown): Promise<PartyActionResult> {
  let token: string | undefined;
  try {
    token = (await cookies()).get('recafco_access')?.value;
  } catch {
    token = undefined;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const json = (await res.json()) as { data?: ContractParty | null; error?: { message?: string } | null };
    if (!res.ok || json.error) {
      return { error: json.error?.message ?? 'Party could not be saved. Please try again.' };
    }
    revalidatePath('/contracts/parties');
    return json.data ? { error: null, party: json.data } : { error: null };
  } catch (err) {
    console.error('Contract party request failed:', err);
    return { error: 'Party could not be saved. Please try again.' };
  }
}

export interface SavePartyInput {
  name: string;
  partyType: 'FIRST_PARTY' | 'SECOND_PARTY';
  contactNo: string;
  email: string;
  address: string;
}

export async function createPartyAction(input: SavePartyInput): Promise<PartyActionResult> {
  return partyFetch('/contracts/parties', 'POST', {
    name: input.name.trim(),
    partyType: input.partyType,
    ...(input.contactNo.trim() ? { contactNo: input.contactNo.trim() } : {}),
    ...(input.email.trim() ? { email: input.email.trim() } : {}),
    ...(input.address.trim() ? { address: input.address.trim() } : {}),
  });
}

export async function updatePartyAction(id: string, input: SavePartyInput): Promise<PartyActionResult> {
  // Empty strings are sent on purpose here: the API clears a field sent empty.
  return partyFetch(`/contracts/parties/${id}`, 'PATCH', {
    name: input.name.trim(),
    partyType: input.partyType,
    contactNo: input.contactNo.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
  });
}

export async function setPartyActiveAction(id: string, isActive: boolean): Promise<PartyActionResult> {
  return partyFetch(`/contracts/parties/${id}`, 'PATCH', { isActive });
}
