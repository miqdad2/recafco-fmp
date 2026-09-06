import { Injectable, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { UpdateContractBoqItemProductionDto } from './dto/update-contract-boq-item-production.dto';

// ---------------------------------------------------------------------------
// CM-59 — Contract Production Status. Production is manually tracked inside
// Contract Management (no Production Module integration exists) — one
// optional ContractBoqItemProductionStatus row per ContractBoqItem, created
// lazily the first time a manager records a value. totalQty is never stored
// here: it's the contract's own BOQ Qty/Area (revisedQty ?? originalEstimatedQty,
// same precedence as boqRowQty() on the frontend and the BOQ total-price
// calculation on the backend) — this unit never overwrites or reinterprets
// that meaning. stockNotDelivered/remainingToCast/progressPercent are always
// derived, never stored.
// ---------------------------------------------------------------------------

/** Prisma Decimal | number | null -> plain number | null, without importing the Decimal type directly. */
function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Preferred quantity: revisedQty when present, else originalEstimatedQty — matches boqRowQty() on the frontend and the BOQ total-price calculation on the backend. */
export function computeTotalQty(item: { originalEstimatedQty: unknown; revisedQty: unknown }): number {
  const revised = toNum(item.revisedQty);
  if (revised !== null) return revised;
  return toNum(item.originalEstimatedQty) ?? 0;
}

export function computeStockNotDelivered(produced: number, delivered: number): number {
  return round3(produced - delivered);
}

export function computeRemainingToCast(total: number, produced: number): number {
  return round3(total - produced);
}

/** Divide-by-zero safe: 0 when total <= 0. Returned unrounded — callers format to the precision their display needs (table rows round to whole percent, KPI subtext keeps 2 decimals). */
export function computePercentOfTotal(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

export interface ProductionAmountsValidationInput {
  producedQty?: number | null | undefined;
  deliveredQty?: number | null | undefined;
  totalQty: number;
}

/**
 * Cross-field validation per this unit's explicit rules: produced/delivered
 * cannot be negative (already enforced by DTO @Min(0)); delivered cannot
 * exceed produced; produced cannot exceed the item's total BOQ Qty/Area. No
 * "business explicitly allows" override exists yet, so both caps are enforced
 * strictly.
 */
export function assertProductionAmountsValid(input: ProductionAmountsValidationInput): void {
  const produced = input.producedQty ?? 0;
  const delivered = input.deliveredQty ?? 0;

  if (delivered > produced) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_BOQ_PRODUCTION_DELIVERED_EXCEEDS_PRODUCED',
      message: 'Delivered quantity cannot exceed Casted / Produced quantity.',
    });
  }
  if (input.totalQty > 0 && produced > input.totalQty) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_BOQ_PRODUCTION_PRODUCED_EXCEEDS_TOTAL',
      message: 'Casted / Produced quantity cannot exceed the item’s Total Qty.',
    });
  }
}

export interface ProductionItemRow {
  id: string;
  itemCode: string | null;
  category: string | null;
  description: string;
  unitOfMeasure: string | null;
  totalQty: number;
  producedQty: number;
  deliveredQty: number;
  stockNotDelivered: number;
  remainingToCast: number;
  progressPercent: number;
  status: string;
  remarks: string | null;
  updatedByUser: { id: string; displayName: string } | null;
  updatedAt: string | null;
}

export interface ProductionSummary {
  totalQty: number;
  producedQty: number;
  deliveredQty: number;
  stockNotDelivered: number;
  remainingToCast: number;
  progressPercent: number;
}

export function computeProductionSummary(items: ProductionItemRow[]): ProductionSummary {
  let totalQty = 0;
  let producedQty = 0;
  let deliveredQty = 0;

  for (const item of items) {
    totalQty += item.totalQty;
    producedQty += item.producedQty;
    deliveredQty += item.deliveredQty;
  }

  totalQty = round3(totalQty);
  producedQty = round3(producedQty);
  deliveredQty = round3(deliveredQty);
  const stockNotDelivered = computeStockNotDelivered(producedQty, deliveredQty);
  const remainingToCast = computeRemainingToCast(totalQty, producedQty);

  return {
    totalQty,
    producedQty,
    deliveredQty,
    stockNotDelivered,
    remainingToCast,
    progressPercent: round2(computePercentOfTotal(producedQty, totalQty)),
  };
}

const BOQ_ITEM_WITH_PRODUCTION_SELECT = {
  id: true,
  itemCode: true,
  category: true,
  description: true,
  unitOfMeasure: true,
  originalEstimatedQty: true,
  revisedQty: true,
  sortOrder: true,
  productionStatus: {
    select: {
      producedQty: true,
      deliveredQty: true,
      status: true,
      remarks: true,
      updatedAt: true,
      updatedByUser: { select: { id: true, displayName: true } },
    },
  },
} as const;

type BoqItemWithProduction = {
  id: string;
  itemCode: string | null;
  category: string | null;
  description: string;
  unitOfMeasure: string | null;
  originalEstimatedQty: unknown;
  revisedQty: unknown;
  sortOrder: number;
  productionStatus: {
    producedQty: unknown;
    deliveredQty: unknown;
    status: string;
    remarks: string | null;
    updatedAt: Date;
    updatedByUser: { id: string; displayName: string } | null;
  } | null;
};

function toProductionItemRow(item: BoqItemWithProduction): ProductionItemRow {
  const totalQty = computeTotalQty(item);
  const producedQty = round3(toNum(item.productionStatus?.producedQty) ?? 0);
  const deliveredQty = round3(toNum(item.productionStatus?.deliveredQty) ?? 0);

  return {
    id: item.id,
    itemCode: item.itemCode,
    category: item.category,
    description: item.description,
    unitOfMeasure: item.unitOfMeasure,
    totalQty,
    producedQty,
    deliveredQty,
    stockNotDelivered: computeStockNotDelivered(producedQty, deliveredQty),
    remainingToCast: computeRemainingToCast(totalQty, producedQty),
    progressPercent: Math.round(computePercentOfTotal(producedQty, totalQty)),
    status: item.productionStatus?.status ?? 'NOT_STARTED',
    remarks: item.productionStatus?.remarks ?? null,
    updatedByUser: item.productionStatus?.updatedByUser ?? null,
    updatedAt: item.productionStatus?.updatedAt.toISOString() ?? null,
  };
}

@Injectable()
export class ContractBoqProductionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  async findAllForContract(
    contractId: string,
    actor: AuthUser,
  ): Promise<{ items: ProductionItemRow[]; summary: ProductionSummary }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);

    const boqItems = await this.db.getClient().contractBoqItem.findMany({
      where: { contractId },
      select: BOQ_ITEM_WITH_PRODUCTION_SELECT,
      orderBy: [{ sortOrder: 'asc' }],
    });

    const items = boqItems.map((item) => toProductionItemRow(item as unknown as BoqItemWithProduction));
    return { items, summary: computeProductionSummary(items) };
  }

  // ---------------------------------------------------------------------------
  // Upsert — a BOQ item's production row is created lazily on its first
  // update (1:1, unique on contractBoqItemId); subsequent calls update it.
  // ---------------------------------------------------------------------------

  async upsertForItem(
    contractBoqItemId: string,
    dto: UpdateContractBoqItemProductionDto,
    actor: AuthUser,
  ): Promise<ProductionItemRow> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const boqItem = await this.db.getClient().contractBoqItem.findUnique({
      where: { id: contractBoqItemId },
      select: {
        id: true,
        itemCode: true,
        category: true,
        description: true,
        unitOfMeasure: true,
        originalEstimatedQty: true,
        revisedQty: true,
        contract: { select: { departmentId: true } },
        productionStatus: { select: { producedQty: true, deliveredQty: true } },
      },
    });
    if (!boqItem) {
      throw new NotFoundException({ code: 'CONTRACT_BOQ_ITEM_NOT_FOUND', message: 'BOQ item not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, boqItem.contract.departmentId);

    const totalQty = computeTotalQty(boqItem);
    const effectiveProduced = dto.producedQty ?? toNum(boqItem.productionStatus?.producedQty) ?? 0;
    const effectiveDelivered = dto.deliveredQty ?? toNum(boqItem.productionStatus?.deliveredQty) ?? 0;
    assertProductionAmountsValid({ producedQty: effectiveProduced, deliveredQty: effectiveDelivered, totalQty });

    const updated = await this.db.getClient().contractBoqItemProductionStatus.upsert({
      where: { contractBoqItemId },
      create: {
        contractBoqItemId,
        updatedByUserId: actor.id,
        ...(dto.producedQty !== undefined ? { producedQty: dto.producedQty } : {}),
        ...(dto.deliveredQty !== undefined ? { deliveredQty: dto.deliveredQty } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      update: {
        updatedByUserId: actor.id,
        ...(dto.producedQty !== undefined ? { producedQty: dto.producedQty } : {}),
        ...(dto.deliveredQty !== undefined ? { deliveredQty: dto.deliveredQty } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: {
        producedQty: true,
        deliveredQty: true,
        status: true,
        remarks: true,
        updatedAt: true,
        updatedByUser: { select: { id: true, displayName: true } },
      },
    });

    return toProductionItemRow({
      id: boqItem.id,
      itemCode: boqItem.itemCode,
      category: boqItem.category,
      description: boqItem.description,
      unitOfMeasure: boqItem.unitOfMeasure,
      originalEstimatedQty: boqItem.originalEstimatedQty,
      revisedQty: boqItem.revisedQty,
      sortOrder: 0,
      productionStatus: updated,
    });
  }
}
