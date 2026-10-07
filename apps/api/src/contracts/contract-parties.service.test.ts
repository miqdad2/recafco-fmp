import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContractPartiesService } from './contract-parties.service';
import { resolveContractParties } from './contract-party-resolve';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockContractCount = vi.fn();

const mockDb = {
  getClient: () => ({
    contractParty: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
    contract: { count: mockContractCount },
  }),
} as unknown as DatabaseService;

const actor = (permissions: string[]): AuthUser => ({ id: 'u1', displayName: 'User', permissions }) as unknown as AuthUser;
const READER = actor(['contracts.read']);
const CREATOR = actor(['contracts.read', 'contracts.create']);
const MANAGER = actor(['contracts.read', 'contracts.create', 'contracts.update']);

const PARTY = { id: 'p1', name: 'Acme', partyType: 'FIRST_PARTY', contactNo: null, email: null, address: null, isActive: true };
const RECAFCO = { ...PARTY, id: 'p-rec', name: 'RECAFCO', partyType: 'SECOND_PARTY' };

let service: ContractPartiesService;
beforeEach(() => {
  vi.clearAllMocks();
  service = new ContractPartiesService(mockDb);
});

describe('ContractPartiesService.list', () => {
  it('returns active parties only by default', async () => {
    mockFindMany.mockResolvedValue([PARTY]);
    await service.list({}, READER);
    expect(mockFindMany.mock.calls[0]?.[0].where).toEqual({ isActive: true });
  });

  it('filters by type and can include inactive parties', async () => {
    mockFindMany.mockResolvedValue([]);
    await service.list({ partyType: 'SECOND_PARTY', includeInactive: 'true' }, READER);
    expect(mockFindMany.mock.calls[0]?.[0].where).toEqual({ partyType: 'SECOND_PARTY' });
  });

  it('requires contracts.read', async () => {
    await expect(service.list({}, actor([]))).rejects.toThrow(ForbiddenException);
  });
});

describe('ContractPartiesService.create', () => {
  it('creates a party', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue(PARTY);
    await service.create({ name: 'Acme', partyType: 'FIRST_PARTY', contactNo: '123' }, CREATOR);
    expect(mockCreate.mock.calls[0]?.[0].data).toEqual({ name: 'Acme', partyType: 'FIRST_PARTY', contactNo: '123' });
  });

  it('rejects a duplicate name of the same type', async () => {
    mockFindFirst.mockResolvedValue({ id: 'x' });
    await expect(service.create({ name: 'acme', partyType: 'FIRST_PARTY' }, CREATOR)).rejects.toThrow(ConflictException);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('requires contracts.create', async () => {
    await expect(service.create({ name: 'A', partyType: 'FIRST_PARTY' }, READER)).rejects.toThrow(ForbiddenException);
  });
});

describe('ContractPartiesService.update', () => {
  it('deactivates a party', async () => {
    mockFindUnique.mockResolvedValue(PARTY);
    mockUpdate.mockResolvedValue({ ...PARTY, isActive: false });
    await service.update('p1', { isActive: false }, MANAGER);
    expect(mockUpdate.mock.calls[0]?.[0].data).toEqual({ isActive: false });
  });

  it('clears an optional field when sent empty', async () => {
    mockFindUnique.mockResolvedValue(PARTY);
    mockUpdate.mockResolvedValue(PARTY);
    await service.update('p1', { contactNo: '' }, MANAGER);
    expect(mockUpdate.mock.calls[0]?.[0].data).toEqual({ contactNo: null });
  });

  it('404s for an unknown party', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(service.update('nope', { isActive: false }, MANAGER)).rejects.toThrow(NotFoundException);
  });

  it('does not allow renaming the default RECAFCO party, but allows deactivating it', async () => {
    mockFindUnique.mockResolvedValue(RECAFCO);
    await expect(service.update('p-rec', { name: 'Other' }, MANAGER)).rejects.toThrow(ConflictException);
    mockUpdate.mockResolvedValue({ ...RECAFCO, isActive: false });
    await expect(service.update('p-rec', { isActive: false }, MANAGER)).resolves.toBeDefined();
  });

  it('blocks a type change once the party is used by a contract', async () => {
    mockFindUnique.mockResolvedValue(PARTY);
    mockContractCount.mockResolvedValue(2);
    await expect(service.update('p1', { partyType: 'SECOND_PARTY' }, MANAGER)).rejects.toThrow(ConflictException);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('requires contracts.update', async () => {
    await expect(service.update('p1', { isActive: false }, CREATOR)).rejects.toThrow(ForbiddenException);
  });
});

describe('resolveContractParties', () => {
  const tx = { contractParty: { findUnique: mockFindUnique, findFirst: mockFindFirst } };

  it('returns null when no party ids were sent (old-style create)', async () => {
    expect(await resolveContractParties(tx, {})).toBeNull();
  });

  it('resolves both parties', async () => {
    mockFindUnique.mockResolvedValueOnce(PARTY).mockResolvedValueOnce(RECAFCO);
    const r = await resolveContractParties(tx, { firstPartyId: 'p1', secondPartyId: 'p-rec' });
    expect(r?.firstParty.name).toBe('Acme');
    expect(r?.secondParty.name).toBe('RECAFCO');
  });

  it('defaults the Second Party to RECAFCO when none is sent', async () => {
    mockFindUnique.mockResolvedValueOnce(PARTY);
    mockFindFirst.mockResolvedValueOnce(RECAFCO);
    const r = await resolveContractParties(tx, { firstPartyId: 'p1' });
    expect(r?.secondParty.id).toBe('p-rec');
  });

  it('rejects an inactive or wrong-type Customer (First Party)', async () => {
    mockFindUnique.mockResolvedValueOnce({ ...PARTY, isActive: false });
    await expect(resolveContractParties(tx, { firstPartyId: 'p1', secondPartyId: 'p-rec' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    mockFindUnique.mockResolvedValueOnce(RECAFCO);
    await expect(resolveContractParties(tx, { firstPartyId: 'p-rec' })).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects a Second Party that is not a Second Party', async () => {
    mockFindUnique.mockResolvedValueOnce(PARTY).mockResolvedValueOnce(PARTY);
    await expect(resolveContractParties(tx, { firstPartyId: 'p1', secondPartyId: 'p1' })).rejects.toThrow(
      /Second Party/,
    );
  });

  it('asks for the Customer when only a Second Party was sent', async () => {
    await expect(resolveContractParties(tx, { secondPartyId: 'p-rec' })).rejects.toThrow(/Customer \(First Party\)/);
  });
});
