import { describe, it, expect } from 'vitest';
import {
  findDuplicateParty,
  pickDefaultSecondPartyId,
  validateBasicDetails,
  validatePartyForm,
  displayFirstParty,
  displaySecondParty,
  PARTY_TYPE_LABELS,
  filterParties,
} from './contract-party-helpers';

describe('pickDefaultSecondPartyId', () => {
  it('selects RECAFCO regardless of case or position', () => {
    expect(pickDefaultSecondPartyId([{ id: 'a', name: 'Other Co' }, { id: 'b', name: 'Recafco ' }])).toBe('b');
  });
  it('preselects nothing when RECAFCO is not in the list', () => {
    expect(pickDefaultSecondPartyId([{ id: 'a', name: 'Other Co' }])).toBe('');
    expect(pickDefaultSecondPartyId([])).toBe('');
  });
});

describe('validateBasicDetails', () => {
  it('returns the plain-language messages for each missing field', () => {
    expect(validateBasicDetails({ firstPartyId: '', secondPartyId: '', title: '  ' })).toEqual({
      firstPartyId: 'Please select Customer (First Party).',
      secondPartyId: 'Please select Second Party.',
      title: 'Please enter Project Name.',
    });
  });
  it('passes when all three are filled', () => {
    expect(validateBasicDetails({ firstPartyId: 'a', secondPartyId: 'b', title: 'Tower' })).toEqual({});
  });
});

describe('validatePartyForm', () => {
  it('requires Company Name and Type', () => {
    expect(validatePartyForm({ name: ' ', partyType: '', email: '' })).toEqual({
      name: 'Please enter Company Name.',
      partyType: 'Please select a Type.',
    });
  });
  it('treats email as optional but checks its shape when given', () => {
    expect(validatePartyForm({ name: 'A', partyType: 'FIRST_PARTY', email: '' })).toEqual({});
    expect(validatePartyForm({ name: 'A', partyType: 'FIRST_PARTY', email: 'nope' }).email).toBeDefined();
  });
});

describe('old-contract display fallbacks', () => {
  it('shows the old company text when no Customer (First Party) is linked', () => {
    expect(displayFirstParty({ counterpartyName: 'Legacy Ltd' })).toBe('Legacy Ltd');
    expect(displayFirstParty({ firstParty: null, counterpartyName: 'Legacy Ltd' })).toBe('Legacy Ltd');
    expect(displayFirstParty({ firstParty: { name: 'Acme' }, counterpartyName: 'Acme' })).toBe('Acme');
  });
  it('shows RECAFCO when no Second Party is linked', () => {
    expect(displaySecondParty({})).toBe('RECAFCO');
    expect(displaySecondParty({ secondParty: { name: 'Sister Co' } })).toBe('Sister Co');
  });
});

describe('PARTY_TYPE_LABELS', () => {
  it('uses the exact approved labels', () => {
    expect(PARTY_TYPE_LABELS).toEqual({ FIRST_PARTY: 'Customer (First Party)', SECOND_PARTY: 'Second Party' });
  });
});

describe('filterParties', () => {
  const list = [
    { name: 'Acme Steel', contactNo: '555-0100' },
    { name: 'RECAFCO', contactNo: null },
  ];
  it('matches company name or contact no, ignoring case', () => {
    expect(filterParties(list, 'acme')).toHaveLength(1);
    expect(filterParties(list, '0100')).toHaveLength(1);
    expect(filterParties(list, 'recafco')[0]?.name).toBe('RECAFCO');
  });
  it('keeps everything for an empty query and nothing for no match', () => {
    expect(filterParties(list, '  ')).toHaveLength(2);
    expect(filterParties(list, 'zzz')).toHaveLength(0);
  });
});

describe('findDuplicateParty', () => {
  const parties = [
    { id: '1', name: 'Al Ahli Co', partyType: 'FIRST_PARTY' },
    { id: '2', name: 'RECAFCO', partyType: 'SECOND_PARTY' },
    { id: '3', name: 'Gulf Steel', partyType: 'SECOND_PARTY' },
  ];

  it('matches the same name and type, ignoring case and surrounding spaces', () => {
    expect(findDuplicateParty(parties, '  al ahli CO ', 'FIRST_PARTY').sameType?.id).toBe('1');
  });

  it('reports a same-name company of the other type separately', () => {
    const r = findDuplicateParty(parties, 'Gulf Steel', 'FIRST_PARTY');
    expect(r.sameType).toBeNull();
    expect(r.otherType?.id).toBe('3');
  });

  it('ignores the record being edited and empty names', () => {
    expect(findDuplicateParty(parties, 'Al Ahli Co', 'FIRST_PARTY', '1').sameType).toBeNull();
    expect(findDuplicateParty(parties, '   ', 'FIRST_PARTY')).toEqual({ sameType: null, otherType: null });
  });
});
