import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContractPartyType } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';
import type {
  ContractPartyListQueryDto,
  CreateContractPartyDto,
  UpdateContractPartyDto,
} from './dto/contract-party.dto';
import { DEFAULT_SECOND_PARTY_NAME } from './contract-party-resolve';

const PARTY_SELECT = {
  id: true,
  name: true,
  partyType: true,
  contactNo: true,
  email: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function denied(message: string): ForbiddenException {
  return new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message });
}

/**
 * FMP-CONTRACT-01 — Contract Party master: companies used as Customer (First
 * Party) or Second Party on contracts. Parties are never deleted; they are
 * deactivated so existing contracts keep their link.
 */
@Injectable()
export class ContractPartiesService {
  constructor(private readonly db: DatabaseService) {}

  async list(query: ContractPartyListQueryDto, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) throw denied('Missing contracts.read');
    return this.db.getClient().contractParty.findMany({
      where: {
        ...(query.partyType ? { partyType: query.partyType as ContractPartyType } : {}),
        ...(query.includeInactive === 'true' ? {} : { isActive: true }),
      },
      select: PARTY_SELECT,
      orderBy: [{ partyType: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateContractPartyDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.create')) throw denied('Missing contracts.create');
    await this.assertNameAvailable(dto.name, dto.partyType as ContractPartyType);
    return this.db.getClient().contractParty.create({
      data: {
        name: dto.name,
        partyType: dto.partyType as ContractPartyType,
        ...(dto.contactNo ? { contactNo: dto.contactNo } : {}),
        ...(dto.email ? { email: dto.email } : {}),
        ...(dto.address ? { address: dto.address } : {}),
      },
      select: PARTY_SELECT,
    });
  }

  async update(id: string, dto: UpdateContractPartyDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update') && !actor.permissions.includes('contracts.manage')) {
      throw denied('Missing contracts.update');
    }
    const client = this.db.getClient();
    const existing = await client.contractParty.findUnique({ where: { id }, select: PARTY_SELECT });
    if (!existing) {
      throw new NotFoundException({ code: 'CONTRACT_PARTY_NOT_FOUND', message: 'Party not found.' });
    }

    const nextName = dto.name ?? existing.name;
    const nextType = (dto.partyType as ContractPartyType | undefined) ?? existing.partyType;
    const renamedOrRetyped = nextName !== existing.name || nextType !== existing.partyType;

    const isDefault = existing.name === DEFAULT_SECOND_PARTY_NAME && existing.partyType === ContractPartyType.SECOND_PARTY;
    if (isDefault && renamedOrRetyped) {
      throw new ConflictException({
        code: 'CONTRACT_PARTY_DEFAULT_LOCKED',
        message: 'RECAFCO is the default Second Party. Its name and type cannot be changed.',
      });
    }

    if (nextType !== existing.partyType) {
      // Changing type would silently invalidate contracts already linked to it.
      const used = await client.contract.count({ where: { OR: [{ firstPartyId: id }, { secondPartyId: id }] } });
      if (used > 0) {
        throw new ConflictException({
          code: 'CONTRACT_PARTY_TYPE_IN_USE',
          message: 'This party is already used in contracts, so its type cannot be changed.',
        });
      }
    }
    if (renamedOrRetyped) await this.assertNameAvailable(nextName, nextType, id);

    return client.contractParty.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.partyType !== undefined ? { partyType: dto.partyType as ContractPartyType } : {}),
        ...(dto.contactNo !== undefined ? { contactNo: dto.contactNo || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: PARTY_SELECT,
    });
  }

  private async assertNameAvailable(name: string, partyType: ContractPartyType, excludeId?: string): Promise<void> {
    const clash = await this.db.getClient().contractParty.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        partyType,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        code: 'CONTRACT_PARTY_DUPLICATE',
        message: 'A party with this name and type already exists.',
      });
    }
  }
}
