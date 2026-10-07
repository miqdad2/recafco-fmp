import type { ContractParty, ContractPartyType } from '@/lib/contracts-api';

// FMP-CONTRACT-01 — user-facing wording for the Contract Party master.

export const DEFAULT_SECOND_PARTY_NAME = 'RECAFCO';

export const PARTY_TYPE_LABELS: Record<ContractPartyType, string> = {
  FIRST_PARTY: 'Customer (First Party)',
  SECOND_PARTY: 'Second Party',
};

export const PARTY_TYPE_OPTIONS: { value: ContractPartyType; label: string }[] = [
  { value: 'FIRST_PARTY', label: PARTY_TYPE_LABELS.FIRST_PARTY },
  { value: 'SECOND_PARTY', label: PARTY_TYPE_LABELS.SECOND_PARTY },
];

/** The party id the Second Party dropdown should start on: RECAFCO if present, otherwise nothing is preselected. */
export function pickDefaultSecondPartyId(secondParties: Pick<ContractParty, 'id' | 'name'>[]): string {
  const recafco = secondParties.find((p) => p.name.trim().toLowerCase() === DEFAULT_SECOND_PARTY_NAME.toLowerCase());
  return recafco?.id ?? '';
}

export interface BasicDetailsValues {
  firstPartyId: string;
  secondPartyId: string;
  title: string;
}

export interface BasicDetailsErrors {
  firstPartyId?: string;
  secondPartyId?: string;
  title?: string;
}

/** Plain-language checks for the three required Basic Contract Details fields. */
export function validateBasicDetails(values: BasicDetailsValues): BasicDetailsErrors {
  const errors: BasicDetailsErrors = {};
  if (!values.firstPartyId.trim()) errors.firstPartyId = 'Please select Customer (First Party).';
  if (!values.secondPartyId.trim()) errors.secondPartyId = 'Please select Second Party.';
  if (!values.title.trim()) errors.title = 'Please enter Project Name.';
  return errors;
}

/** Customer (First Party) shown on old and new contracts alike: the linked party if there is one, else the old free-text name. */
export function displayFirstParty(contract: { firstParty?: { name: string } | null; counterpartyName: string }): string {
  return contract.firstParty?.name ?? contract.counterpartyName;
}

/** Second Party shown on old and new contracts alike: the linked party, else RECAFCO. */
export function displaySecondParty(contract: { secondParty?: { name: string } | null }): string {
  return contract.secondParty?.name ?? DEFAULT_SECOND_PARTY_NAME;
}

export interface PartyFormValues {
  name: string;
  partyType: string;
  email: string;
}

export interface PartyFormErrors {
  name?: string;
  partyType?: string;
  email?: string;
}

export function validatePartyForm(values: PartyFormValues): PartyFormErrors {
  const errors: PartyFormErrors = {};
  if (!values.name.trim()) errors.name = 'Please enter Company Name.';
  if (values.partyType !== 'FIRST_PARTY' && values.partyType !== 'SECOND_PARTY') errors.partyType = 'Please select a Type.';
  const email = values.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email.';
  return errors;
}

/** Case-insensitive match on Company Name or Contact No; an empty query keeps everything. */
export function filterParties<T extends { name: string; contactNo: string | null }>(parties: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return parties;
  return parties.filter((p) => p.name.toLowerCase().includes(q) || (p.contactNo ?? '').toLowerCase().includes(q));
}
