import { Injectable, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContractStatus, ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { AddContractBoqItemDto } from './dto/add-contract-boq-item.dto';

// ---------------------------------------------------------------------------
// FMP-CONTRACT-11 — add ONE new BOQ item to an existing contract.
//
// This is additive only: it never replaces, renumbers or deletes existing BOQ
// items (unlike Edit Contract on a Draft, which replaces the whole set), so
// every existing item id, Technical confirmation, generated element, drawing
// group, final drawing, release and Production / Storage / Erection record
// stays exactly as it is. The new item has no elements until Technical
// confirms them. It does NOT change the contract's status, approvals, or any
// contract value: there is no confirmed business rule for how post-activation
// additions affect contractual value (variations are the existing route), so
// contractValue / originalContractValue are left alone.
// ---------------------------------------------------------------------------

export const BOQ_ITEM_MESSAGES = {
  closed: 'BOQ items cannot be added because this contract is closed, cancelled or terminated.',
} as const;

/** A second identical Save within this window is the same click, not a new item. */
export const DUPLICATE_WINDOW_MS = 30_000;

const FINAL_STATUSES: string[] = [ContractStatus.CLOSED, ContractStatus.TERMINATED, ContractStatus.CANCELLED];

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The saved item (decimal columns come back as Prisma decimals; the API sends them as strings). */
export interface AddItemResult {
  item: { id: string; sortOrder: number; description: string; unitOfMeasure: string | null; originalEstimatedQty: unknown; unitPrice: unknown; totalPrice: unknown; createdAt: Date };
  /** true = this was a repeated Save of an item that already exists; nothing new was created. */
  duplicate: boolean;
}

const ITEM_SELECT = {
  id: true,
  sortOrder: true,
  description: true,
  unitOfMeasure: true,
  originalEstimatedQty: true,
  unitPrice: true,
  totalPrice: true,
  createdAt: true,
} as const;

@Injectable()
export class ContractBoqItemsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  async addItem(contractId: string, dto: AddContractBoqItemDto, actor: AuthUser): Promise<AddItemResult> {
    // Adding to a contract's BOQ is a contract-structure change: contracts.update only
    // (not the wider Technical workflow permission).
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const client = this.db.getClient();
    const contract = await client.contract.findUnique({
      where: { id: contractId },
      select: { id: true, status: true, departmentId: true, referenceNumber: true },
    });
    if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);

    if (FINAL_STATUSES.includes(contract.status as string)) {
      throw new UnprocessableEntityException({ code: 'CONTRACT_INVALID_TRANSITION', message: BOQ_ITEM_MESSAGES.closed });
    }

    const totalPrice = round3(dto.contractQty * dto.unitPrice);

    return client.$transaction(async (tx) => {
      // One add at a time per contract: two quick Saves cannot both pass the duplicate check or take the same number.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contractId}))`;

      const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);
      const duplicate = await tx.contractBoqItem.findFirst({
        where: {
          contractId,
          description: { equals: dto.description, mode: 'insensitive' },
          unitOfMeasure: dto.unitOfMeasure,
          originalEstimatedQty: dto.contractQty,
          unitPrice: dto.unitPrice,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        select: { ...ITEM_SELECT },
      });
      if (duplicate) return { item: duplicate, duplicate: true };

      const last = await tx.contractBoqItem.aggregate({ where: { contractId }, _max: { sortOrder: true } });
      const sortOrder = (last._max.sortOrder ?? 0) + 1;

      const item = await tx.contractBoqItem.create({
        data: {
          contractId,
          sortOrder,
          description: dto.description,
          unitOfMeasure: dto.unitOfMeasure,
          originalEstimatedQty: dto.contractQty,
          unitPrice: dto.unitPrice,
          totalPrice,
        },
        select: { ...ITEM_SELECT },
      });

      await tx.contractActivity.create({
        data: {
          contractId,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'boq_item_added',
          metadata: {
            boqItemNo: sortOrder,
            description: dto.description,
            unit: dto.unitOfMeasure,
            contractQty: dto.contractQty,
            unitPrice: dto.unitPrice,
          },
        },
      });

      return { item, duplicate: false };
    });
  }
}
