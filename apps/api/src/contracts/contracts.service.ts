import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { ContractStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { ContractsRefService } from './contracts-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractDto } from './dto/create-contract.dto';
import type { UpdateContractDto } from './dto/update-contract.dto';
import type { ContractListQueryDto, PaginatedResult } from './dto/contract-list-query.dto';
import type { ActivateContractDto } from './dto/activate-contract.dto';
import type { TerminateContractDto } from './dto/terminate-contract.dto';
import type { CloseContractDto } from './dto/close-contract.dto';
import type { AddCommentDto } from './dto/add-comment.dto';

// ---------------------------------------------------------------------------
// Derived lifecycle status helpers
// ---------------------------------------------------------------------------

export type DerivedLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED' | 'CLOSED';

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function getDerivedLifecycleStatus(contract: {
  status: ContractStatus | string;
  endDate: Date | null;
  renewalNoticeDate: Date | null;
}): DerivedLifecycleStatus {
  const today = utcToday();

  if (contract.status === ContractStatus.DRAFT) return 'DRAFT';
  if (contract.status === ContractStatus.TERMINATED) return 'TERMINATED';
  if (contract.status === ContractStatus.CLOSED) return 'CLOSED';

  // ACTIVE
  if (contract.endDate !== null && contract.endDate < today) {
    return 'EXPIRED';
  }
  if (
    contract.renewalNoticeDate !== null &&
    contract.renewalNoticeDate <= today &&
    (contract.endDate === null || contract.endDate >= today)
  ) {
    return 'EXPIRING';
  }
  return 'ACTIVE';
}

// ---------------------------------------------------------------------------
// Prisma select shape
// ---------------------------------------------------------------------------

const CONTRACT_SELECT = {
  id: true,
  referenceNumber: true,
  title: true,
  description: true,
  status: true,
  version: true,
  counterpartyName: true,
  counterpartyContact: true,
  contractValue: true,
  currency: true,
  startDate: true,
  endDate: true,
  renewalNoticeDate: true,
  ownerUserId: true,
  departmentId: true,
  plantId: true,
  locationId: true,
  notes: true,
  createdByUserId: true,
  activatedAt: true,
  activatedByUserId: true,
  terminatedAt: true,
  terminatedByUserId: true,
  terminationReason: true,
  closedAt: true,
  closedByUserId: true,
  createdAt: true,
  updatedAt: true,
  ownerUser: { select: { id: true, displayName: true } },
  createdByUser: { select: { id: true, displayName: true } },
  activatedByUser: { select: { id: true, displayName: true } },
  terminatedByUser: { select: { id: true, displayName: true } },
  closedByUser: { select: { id: true, displayName: true } },
  department: { select: { id: true, name: true } },
  plant: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
} as const;

type ContractRecord = Awaited<
  ReturnType<ReturnType<DatabaseService['getClient']>['contract']['findUniqueOrThrow']>
>;

type ContractWithLifecycle = ContractRecord & { lifecycleStatus: DerivedLifecycleStatus };

function withLifecycle(contract: ContractRecord): ContractWithLifecycle {
  return {
    ...contract,
    lifecycleStatus: getDerivedLifecycleStatus({
      status: contract.status as ContractStatus,
      endDate: contract.endDate as Date | null,
      renewalNoticeDate: contract.renewalNoticeDate as Date | null,
    }),
  };
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ref: ContractsRefService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create (saves as DRAFT)
  // ---------------------------------------------------------------------------

  async create(dto: CreateContractDto, actor: AuthUser): Promise<ContractWithLifecycle> {
    if (!actor.permissions.includes('contracts.create')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.create' });
    }

    if (dto.ownerUserId && dto.ownerUserId !== actor.id && !actor.permissions.includes('contracts.manage')) {
      throw new ForbiddenException({
        code: 'CONTRACTS_PERMISSION_DENIED',
        message: 'Only contracts.manage can set a different owner',
      });
    }

    const ownerUserId = dto.ownerUserId ?? actor.id;
    const now = new Date();
    const year = now.getUTCFullYear();

    const contract = await this.db.getClient().$transaction(async (tx) => {
      const referenceNumber = await this.ref.nextRef(tx, year);

      const created = await tx.contract.create({
        data: {
          referenceNumber,
          title: dto.title,
          counterpartyName: dto.counterpartyName,
          status: ContractStatus.DRAFT,
          version: 1,
          ownerUserId,
          createdByUserId: actor.id,
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.counterpartyContact !== undefined ? { counterpartyContact: dto.counterpartyContact } : {}),
          ...(dto.contractValue !== undefined ? { contractValue: dto.contractValue } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
          ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
          ...(dto.renewalNoticeDate !== undefined ? { renewalNoticeDate: new Date(dto.renewalNoticeDate) } : {}),
          ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
          ...(dto.plantId !== undefined ? { plantId: dto.plantId } : {}),
          ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
        select: CONTRACT_SELECT,
      });

      await tx.contractActivity.create({
        data: {
          contractId: created.id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'created',
          newStatus: ContractStatus.DRAFT,
          metadata: { referenceNumber },
        },
      });

      return created;
    });

    return withLifecycle(contract as ContractRecord);
  }

  // ---------------------------------------------------------------------------
  // Update DRAFT
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdateContractDto, actor: AuthUser): Promise<ContractWithLifecycle> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const contract = await this.findOneOrThrow(id);

    if ((contract.status as string) !== ContractStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_INVALID_TRANSITION',
        message: 'Only DRAFT contracts can be updated via this endpoint',
      });
    }

    if (dto.ownerUserId !== undefined && !actor.permissions.includes('contracts.manage')) {
      throw new ForbiddenException({
        code: 'CONTRACTS_PERMISSION_DENIED',
        message: 'Only contracts.manage can change the owner',
      });
    }

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.counterpartyName !== undefined) data['counterpartyName'] = dto.counterpartyName;
    if (dto.counterpartyContact !== undefined) data['counterpartyContact'] = dto.counterpartyContact;
    if (dto.contractValue !== undefined) data['contractValue'] = dto.contractValue;
    if (dto.currency !== undefined) data['currency'] = dto.currency;
    if (dto.startDate !== undefined) data['startDate'] = new Date(dto.startDate);
    if (dto.endDate !== undefined) data['endDate'] = new Date(dto.endDate);
    if (dto.renewalNoticeDate !== undefined) data['renewalNoticeDate'] = new Date(dto.renewalNoticeDate);
    if (dto.ownerUserId !== undefined) data['ownerUserId'] = dto.ownerUserId;
    if (dto.departmentId !== undefined) data['departmentId'] = dto.departmentId;
    if (dto.plantId !== undefined) data['plantId'] = dto.plantId;
    if (dto.locationId !== undefined) data['locationId'] = dto.locationId;
    if (dto.notes !== undefined) data['notes'] = dto.notes;

    const updated = await this.db.getClient().$transaction(async (tx) => {
      // Condition on client-submitted version — real optimistic concurrency
      const result = await tx.contract.updateMany({
        where: { id, status: ContractStatus.DRAFT, version: dto.version },
        data: { ...data, version: { increment: 1 } },
      });

      if (result.count === 0) {
        const exists = await tx.contract.findUnique({ where: { id }, select: { id: true } });
        if (!exists) {
          throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
        }
        throw new ConflictException({
          code: 'CONTRACT_VERSION_CONFLICT',
          message: 'Contract was changed by another user; please refresh and retry',
        });
      }

      const refreshed = await tx.contract.findUniqueOrThrow({ where: { id }, select: CONTRACT_SELECT });

      await tx.contractActivity.create({
        data: {
          contractId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'updated',
        },
      });

      return refreshed;
    });

    return withLifecycle(updated as ContractRecord);
  }

  // ---------------------------------------------------------------------------
  // Activate: DRAFT → ACTIVE
  // ---------------------------------------------------------------------------

  async activate(id: string, dto: ActivateContractDto, actor: AuthUser): Promise<ContractWithLifecycle> {
    if (!actor.permissions.includes('contracts.activate')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.activate' });
    }

    const now = new Date();

    const updated = await this.db.getClient().$transaction(async (tx) => {
      const result = await tx.contract.updateMany({
        where: { id, status: ContractStatus.DRAFT, version: dto.version },
        data: {
          status: ContractStatus.ACTIVE,
          activatedAt: now,
          activatedByUserId: actor.id,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        // Distinguish not-found from version conflict
        const exists = await tx.contract.findUnique({ where: { id }, select: { id: true } });
        if (!exists) {
          throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
        }
        throw new ConflictException({
          code: 'CONTRACT_VERSION_CONFLICT',
          message: 'Contract was modified concurrently; please reload and retry',
        });
      }

      const refreshed = await tx.contract.findUniqueOrThrow({ where: { id }, select: CONTRACT_SELECT });

      await tx.contractActivity.create({
        data: {
          contractId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'activated',
          previousStatus: ContractStatus.DRAFT,
          newStatus: ContractStatus.ACTIVE,
        },
      });

      return refreshed;
    });

    return withLifecycle(updated as ContractRecord);
  }

  // ---------------------------------------------------------------------------
  // Terminate: ACTIVE → TERMINATED
  // ---------------------------------------------------------------------------

  async terminate(id: string, dto: TerminateContractDto, actor: AuthUser): Promise<ContractWithLifecycle> {
    if (!actor.permissions.includes('contracts.terminate')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.terminate' });
    }

    const now = new Date();

    const updated = await this.db.getClient().$transaction(async (tx) => {
      const result = await tx.contract.updateMany({
        where: { id, status: ContractStatus.ACTIVE, version: dto.version },
        data: {
          status: ContractStatus.TERMINATED,
          terminatedAt: now,
          terminatedByUserId: actor.id,
          terminationReason: dto.reason,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        const exists = await tx.contract.findUnique({ where: { id }, select: { id: true } });
        if (!exists) {
          throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
        }
        throw new ConflictException({
          code: 'CONTRACT_VERSION_CONFLICT',
          message: 'Contract was modified concurrently; please reload and retry',
        });
      }

      const refreshed = await tx.contract.findUniqueOrThrow({ where: { id }, select: CONTRACT_SELECT });

      await tx.contractActivity.create({
        data: {
          contractId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'terminated',
          previousStatus: ContractStatus.ACTIVE,
          newStatus: ContractStatus.TERMINATED,
          metadata: { reason: dto.reason },
        },
      });

      return refreshed;
    });

    return withLifecycle(updated as ContractRecord);
  }

  // ---------------------------------------------------------------------------
  // Close: ACTIVE | TERMINATED → CLOSED
  // ---------------------------------------------------------------------------

  async close(id: string, dto: CloseContractDto, actor: AuthUser): Promise<ContractWithLifecycle> {
    if (!actor.permissions.includes('contracts.close')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.close' });
    }

    const contract = await this.findOneOrThrow(id);
    const currentStatus = contract.status as ContractStatus;

    if (currentStatus !== ContractStatus.ACTIVE && currentStatus !== ContractStatus.TERMINATED) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_INVALID_TRANSITION',
        message: `Cannot close a contract with status ${String(currentStatus)}`,
      });
    }

    const now = new Date();

    const updated = await this.db.getClient().$transaction(async (tx) => {
      const result = await tx.contract.updateMany({
        where: { id, status: currentStatus, version: dto.version },
        data: {
          status: ContractStatus.CLOSED,
          closedAt: now,
          closedByUserId: actor.id,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictException({
          code: 'CONTRACT_VERSION_CONFLICT',
          message: 'Contract was modified concurrently; please reload and retry',
        });
      }

      const refreshed = await tx.contract.findUniqueOrThrow({ where: { id }, select: CONTRACT_SELECT });

      await tx.contractActivity.create({
        data: {
          contractId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'closed',
          previousStatus: currentStatus,
          newStatus: ContractStatus.CLOSED,
        },
      });

      return refreshed;
    });

    return withLifecycle(updated as ContractRecord);
  }

  // ---------------------------------------------------------------------------
  // Find one
  // ---------------------------------------------------------------------------

  async findOne(id: string, actor: AuthUser): Promise<ContractWithLifecycle> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const contract = await this.findOneOrThrow(id);
    return withLifecycle(contract);
  }

  // ---------------------------------------------------------------------------
  // Find all (paginated + filtered)
  // ---------------------------------------------------------------------------

  async findAll(
    query: ContractListQueryDto,
    actor: AuthUser,
  ): Promise<PaginatedResult<ContractWithLifecycle>> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where = buildListWhere(query);

    const [items, total] = await Promise.all([
      this.db.getClient().contract.findMany({
        where,
        select: CONTRACT_SELECT,
        orderBy: [{ createdAt: 'desc' }, { referenceNumber: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().contract.count({ where }),
    ]);

    return {
      items: (items as ContractRecord[]).map(withLifecycle),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ---------------------------------------------------------------------------
  // Summary metrics
  // ---------------------------------------------------------------------------

  async getSummary(actor: AuthUser): Promise<{
    totalDraft: number;
    totalActive: number;
    totalExpiring: number;
    totalExpired: number;
    totalTerminated: number;
    totalClosed: number;
  }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const today = utcToday();

    const [
      totalDraft,
      totalActive,
      totalExpiring,
      totalExpired,
      totalTerminated,
      totalClosed,
    ] = await Promise.all([
      this.db.getClient().contract.count({ where: { status: ContractStatus.DRAFT } }),
      this.db.getClient().contract.count({ where: { status: ContractStatus.ACTIVE } }),
      this.db.getClient().contract.count({
        where: {
          status: ContractStatus.ACTIVE,
          renewalNoticeDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
      }),
      this.db.getClient().contract.count({
        where: {
          status: ContractStatus.ACTIVE,
          endDate: { lt: today },
        },
      }),
      this.db.getClient().contract.count({ where: { status: ContractStatus.TERMINATED } }),
      this.db.getClient().contract.count({ where: { status: ContractStatus.CLOSED } }),
    ]);

    return { totalDraft, totalActive, totalExpiring, totalExpired, totalTerminated, totalClosed };
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  async addComment(id: string, dto: AddCommentDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.comment')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.comment' });
    }

    const contract = await this.db.getClient().contract.findUnique({ where: { id }, select: { id: true } });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }

    return this.db.getClient().$transaction(async (tx) => {
      const comment = await tx.contractComment.create({
        data: { contractId: id, authorUserId: actor.id, body: dto.body },
        select: {
          id: true,
          contractId: true,
          body: true,
          createdAt: true,
          authorUser: { select: { id: true, displayName: true } },
        },
      });

      await tx.contractActivity.create({
        data: {
          contractId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'comment_added',
        },
      });

      return comment;
    });
  }

  async listComments(id: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    await this.requireContractExists(id);

    return this.db.getClient().contractComment.findMany({
      where: { contractId: id },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        contractId: true,
        body: true,
        createdAt: true,
        authorUser: { select: { id: true, displayName: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Activities
  // ---------------------------------------------------------------------------

  async listActivities(id: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    await this.requireContractExists(id);

    return this.db.getClient().contractActivity.findMany({
      where: { contractId: id },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  // ---------------------------------------------------------------------------
  // People (owner selector)
  // ---------------------------------------------------------------------------

  async listPeople(actor: AuthUser): Promise<{ id: string; displayName: string; departmentId: string | null }[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    return this.db.getClient().user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, departmentId: true },
      orderBy: [{ displayName: 'asc' }],
    });
  }

  // ---------------------------------------------------------------------------
  // Org selectors (active only — for new/edit form dropdowns)
  // ---------------------------------------------------------------------------

  async listDepartments(actor: AuthUser): Promise<{ id: string; name: string; code: string }[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    return this.db.getClient().department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  async listPlants(actor: AuthUser): Promise<{ id: string; name: string; code: string }[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    return this.db.getClient().plant.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  async listLocations(
    actor: AuthUser,
    plantId?: string,
  ): Promise<{ id: string; name: string; code: string; plantId: string | null }[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    return this.db.getClient().location.findMany({
      where: { isActive: true, ...(plantId ? { plantId } : {}) },
      select: { id: true, name: true, code: true, plantId: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findOneOrThrow(id: string): Promise<ContractRecord> {
    const contract = await this.db.getClient().contract.findUnique({
      where: { id },
      select: CONTRACT_SELECT,
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    return contract as ContractRecord;
  }

  private async requireContractExists(id: string): Promise<void> {
    const contract = await this.db.getClient().contract.findUnique({ where: { id }, select: { id: true } });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
  }
}

// ---------------------------------------------------------------------------
// List where builder (exported for tests)
// ---------------------------------------------------------------------------

export function buildListWhere(query: ContractListQueryDto): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

  // Lifecycle status filter takes precedence over plain status filter
  if (query.lifecycleStatus) {
    switch (query.lifecycleStatus) {
      case 'EXPIRING':
        where['status'] = ContractStatus.ACTIVE;
        where['renewalNoticeDate'] = { lte: today };
        where['OR'] = [{ endDate: null }, { endDate: { gte: today } }];
        break;
      case 'EXPIRED':
        where['status'] = ContractStatus.ACTIVE;
        where['endDate'] = { lt: today };
        break;
      case 'ACTIVE':
        where['status'] = ContractStatus.ACTIVE;
        // No additional date filters — include all ACTIVE regardless of derived status
        break;
      case 'DRAFT':
        where['status'] = ContractStatus.DRAFT;
        break;
      case 'TERMINATED':
        where['status'] = ContractStatus.TERMINATED;
        break;
      case 'CLOSED':
        where['status'] = ContractStatus.CLOSED;
        break;
    }
  } else if (query.status) {
    where['status'] = query.status;
  }

  if (query.ownerUserId) where['ownerUserId'] = query.ownerUserId;
  if (query.departmentId) where['departmentId'] = query.departmentId;
  if (query.plantId) where['plantId'] = query.plantId;

  if (query.search?.trim()) {
    where['OR'] = [
      { title: { contains: query.search.trim(), mode: 'insensitive' } },
      { referenceNumber: { contains: query.search.trim(), mode: 'insensitive' } },
    ];
  }

  return where;
}
