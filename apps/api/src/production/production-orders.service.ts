import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProductionOrderStatus, ProductionEntryType, ModuleIdentifier, DepartmentAccessScope } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { ProductionRefService } from './production-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateProductionOrderDto } from './dto/create-production-order.dto';
import type { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import type { ProductionOrderListQueryDto, PaginatedResult } from './dto/production-order-list-query.dto';
import type { ScheduleOrderDto } from './dto/schedule-order.dto';
import type { StartOrderDto } from './dto/start-order.dto';
import type { PauseOrderDto } from './dto/pause-order.dto';
import type { ResumeOrderDto } from './dto/resume-order.dto';
import type { CompleteOrderDto } from './dto/complete-order.dto';
import type { CancelOrderDto } from './dto/cancel-order.dto';
import type { AddEntryDto } from './dto/add-entry.dto';
import type { AddProductionCommentDto } from './dto/add-production-comment.dto';

// ---------------------------------------------------------------------------
// Select shape
// ---------------------------------------------------------------------------

const ORDER_SELECT = {
  id: true,
  referenceNumber: true,
  title: true,
  description: true,
  status: true,
  version: true,
  productionLineId: true,
  departmentId: true,
  plantId: true,
  productCode: true,
  productName: true,
  targetQuantity: true,
  unit: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  startedAt: true,
  startedByUserId: true,
  pausedAt: true,
  pausedByUserId: true,
  pauseReason: true,
  resumedAt: true,
  resumedByUserId: true,
  completedAt: true,
  completedByUserId: true,
  completionNote: true,
  cancelledAt: true,
  cancelledByUserId: true,
  cancellationReason: true,
  supervisorUserId: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
  productionLine: { select: { id: true, code: true, name: true } },
  department: { select: { id: true, name: true } },
  plant: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, displayName: true } },
  supervisorUser: { select: { id: true, displayName: true } },
  startedByUser: { select: { id: true, displayName: true } },
  pausedByUser: { select: { id: true, displayName: true } },
  resumedByUser: { select: { id: true, displayName: true } },
  completedByUser: { select: { id: true, displayName: true } },
  cancelledByUser: { select: { id: true, displayName: true } },
} as const;

// ---------------------------------------------------------------------------
// Derived metrics
// ---------------------------------------------------------------------------

export interface ProductionMetrics {
  totalProduced: number;
  totalAccepted: number;
  totalRejected: number;
  totalDowntimeMinutes: number;
  adjustmentTotal: number;
  effectiveProduced: number;
  completionPercentage: number;
  rejectionRate: number;
  remainingQuantity: number;
}

interface RawEntry {
  type: string;
  quantityProduced: number | null;
  quantityAccepted: number | null;
  quantityRejected: number | null;
  downtimeMinutes: number | null;
  adjustmentQty: number | null;
}

export function computeMetrics(entries: RawEntry[], targetQuantity: number): ProductionMetrics {
  let totalProduced = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let totalDowntimeMinutes = 0;
  let adjustmentTotal = 0;

  for (const e of entries) {
    if (e.type === 'OUTPUT') {
      totalProduced += e.quantityProduced ?? 0;
      totalAccepted += e.quantityAccepted ?? 0;
      totalRejected += e.quantityRejected ?? 0;
    } else if (e.type === 'DOWNTIME') {
      totalDowntimeMinutes += e.downtimeMinutes ?? 0;
    } else if (e.type === 'ADJUSTMENT') {
      adjustmentTotal += e.adjustmentQty ?? 0;
    }
  }

  const effectiveProduced = totalProduced + adjustmentTotal;
  const completionPercentage = targetQuantity > 0 ? Math.round((effectiveProduced / targetQuantity) * 10000) / 100 : 0;
  const rejectionRate = totalProduced > 0 ? Math.round((totalRejected / totalProduced) * 10000) / 100 : 0;
  const remainingQuantity = targetQuantity - effectiveProduced;

  return {
    totalProduced,
    totalAccepted,
    totalRejected,
    totalDowntimeMinutes,
    adjustmentTotal,
    effectiveProduced,
    completionPercentage,
    rejectionRate,
    remainingQuantity,
  };
}

// ---------------------------------------------------------------------------
// Optimistic concurrency helper
// ---------------------------------------------------------------------------

async function resolveVersionConflict(
  db: DatabaseService,
  id: string,
  notFoundCode: string,
  notFoundMsg: string,
): Promise<never> {
  const exists = await db.getClient().productionOrder.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundException({ code: notFoundCode, message: notFoundMsg });
  throw new ConflictException({ code: 'PRODUCTION_ORDER_VERSION_CONFLICT', message: 'Order was changed by another user; please refresh and retry' });
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ProductionOrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ref: ProductionRefService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  // ---- Create ----

  async create(dto: CreateProductionOrderDto, actor: AuthUser) {
    if (!actor.permissions.includes('production.create')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.create' });
    }

    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.PRODUCTION_DASHBOARD, dto.departmentId ?? null);

    const now = new Date();
    const year = now.getUTCFullYear();

    return this.db.getClient().$transaction(async (tx) => {
      const referenceNumber = await this.ref.nextRef(tx, year);

      const order = await tx.productionOrder.create({
        data: {
          referenceNumber,
          title: dto.title,
          status: ProductionOrderStatus.DRAFT,
          version: 1,
          targetQuantity: dto.targetQuantity,
          unit: dto.unit,
          createdByUserId: actor.id,
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.productionLineId !== undefined ? { productionLineId: dto.productionLineId } : {}),
          ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
          ...(dto.plantId !== undefined ? { plantId: dto.plantId } : {}),
          ...(dto.productCode !== undefined ? { productCode: dto.productCode } : {}),
          ...(dto.productName !== undefined ? { productName: dto.productName } : {}),
          ...(dto.scheduledStartAt !== undefined ? { scheduledStartAt: new Date(dto.scheduledStartAt) } : {}),
          ...(dto.scheduledEndAt !== undefined ? { scheduledEndAt: new Date(dto.scheduledEndAt) } : {}),
          ...(dto.supervisorUserId !== undefined ? { supervisorUserId: dto.supervisorUserId } : {}),
        },
        select: ORDER_SELECT,
      });

      await tx.productionActivity.create({
        data: {
          orderId: order.id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'created',
          newStatus: ProductionOrderStatus.DRAFT,
          metadata: { referenceNumber },
        },
      });

      return order;
    });
  }

  // ---- List ----

  async findAll(query: ProductionOrderListQueryDto, actor: AuthUser): Promise<PaginatedResult<unknown>> {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.PRODUCTION_DASHBOARD);
    const where: Record<string, unknown> = { ...buildOrderWhere(query) };
    if (deptFilter !== null) {
      where['departmentId'] = deptFilter;
    }

    const [items, total] = await Promise.all([
      this.db.getClient().productionOrder.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().productionOrder.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  // ---- Get one ----

  async findOne(id: string, actor: AuthUser) {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    return this.findOneOrThrow(id, actor);
  }

  // ---- Update (DRAFT only) ----

  async update(id: string, dto: UpdateProductionOrderDto, actor: AuthUser) {
    if (!actor.permissions.includes('production.update') && !actor.permissions.includes('production.manage')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.update' });
    }

    await this.findOneOrThrow(id, actor);

    const data: Record<string, unknown> = { version: { increment: 1 } };
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.productionLineId !== undefined) data['productionLineId'] = dto.productionLineId;
    if (dto.departmentId !== undefined) data['departmentId'] = dto.departmentId;
    if (dto.plantId !== undefined) data['plantId'] = dto.plantId;
    if (dto.productCode !== undefined) data['productCode'] = dto.productCode;
    if (dto.productName !== undefined) data['productName'] = dto.productName;
    if (dto.targetQuantity !== undefined) data['targetQuantity'] = dto.targetQuantity;
    if (dto.unit !== undefined) data['unit'] = dto.unit;
    if (dto.scheduledStartAt !== undefined) data['scheduledStartAt'] = new Date(dto.scheduledStartAt);
    if (dto.scheduledEndAt !== undefined) data['scheduledEndAt'] = new Date(dto.scheduledEndAt);
    if (dto.supervisorUserId !== undefined) data['supervisorUserId'] = dto.supervisorUserId;

    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.productionOrder.updateMany({
        where: { id, status: ProductionOrderStatus.DRAFT, version: dto.version },
        data,
      });

      if (result.count === 0) {
        await resolveVersionConflict(this.db, id, 'PRODUCTION_ORDER_NOT_FOUND', 'Production order not found');
      }

      const updated = await tx.productionOrder.findUniqueOrThrow({ where: { id }, select: ORDER_SELECT });

      await tx.productionActivity.create({
        data: {
          orderId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'updated',
        },
      });

      return updated;
    });
  }

  // ---- Schedule: DRAFT → SCHEDULED ----

  async schedule(id: string, dto: ScheduleOrderDto, actor: AuthUser) {
    if (!actor.permissions.includes('production.schedule') && !actor.permissions.includes('production.manage')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.schedule' });
    }

    await this.findOneOrThrow(id, actor);
    return this.transition(id, dto.version, ProductionOrderStatus.DRAFT, ProductionOrderStatus.SCHEDULED, actor, 'scheduled', {});
  }

  // ---- Start: SCHEDULED → IN_PROGRESS ----

  async start(id: string, dto: StartOrderDto, actor: AuthUser) {
    if (!actor.permissions.includes('production.start') && !actor.permissions.includes('production.manage')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.start' });
    }

    await this.findOneOrThrow(id, actor);
    const now = new Date();
    return this.transition(id, dto.version, ProductionOrderStatus.SCHEDULED, ProductionOrderStatus.IN_PROGRESS, actor, 'started', {
      startedAt: now,
      startedByUserId: actor.id,
    });
  }

  // ---- Pause: IN_PROGRESS → PAUSED ----

  async pause(id: string, dto: PauseOrderDto, actor: AuthUser) {
    if (!actor.permissions.includes('production.pause') && !actor.permissions.includes('production.manage')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.pause' });
    }

    await this.findOneOrThrow(id, actor);
    const now = new Date();
    return this.transition(id, dto.version, ProductionOrderStatus.IN_PROGRESS, ProductionOrderStatus.PAUSED, actor, 'paused', {
      pausedAt: now,
      pausedByUserId: actor.id,
      ...(dto.reason !== undefined ? { pauseReason: dto.reason } : {}),
    });
  }

  // ---- Resume: PAUSED → IN_PROGRESS ----

  async resume(id: string, dto: ResumeOrderDto, actor: AuthUser) {
    if (!actor.permissions.includes('production.resume') && !actor.permissions.includes('production.manage')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.resume' });
    }

    await this.findOneOrThrow(id, actor);
    const now = new Date();
    return this.transition(id, dto.version, ProductionOrderStatus.PAUSED, ProductionOrderStatus.IN_PROGRESS, actor, 'resumed', {
      resumedAt: now,
      resumedByUserId: actor.id,
    });
  }

  // ---- Complete: IN_PROGRESS → COMPLETED ----

  async complete(id: string, dto: CompleteOrderDto, actor: AuthUser) {
    if (!actor.permissions.includes('production.complete') && !actor.permissions.includes('production.manage')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.complete' });
    }

    await this.findOneOrThrow(id, actor);
    const now = new Date();
    return this.transition(id, dto.version, ProductionOrderStatus.IN_PROGRESS, ProductionOrderStatus.COMPLETED, actor, 'completed', {
      completedAt: now,
      completedByUserId: actor.id,
      ...(dto.completionNote !== undefined ? { completionNote: dto.completionNote } : {}),
    });
  }

  // ---- Cancel: DRAFT|SCHEDULED|IN_PROGRESS|PAUSED → CANCELLED ----

  async cancel(id: string, dto: CancelOrderDto, actor: AuthUser) {
    if (!actor.permissions.includes('production.cancel') && !actor.permissions.includes('production.manage')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.cancel' });
    }

    await this.findOneOrThrow(id, actor);

    const CANCELLABLE: ProductionOrderStatus[] = [
      ProductionOrderStatus.DRAFT,
      ProductionOrderStatus.SCHEDULED,
      ProductionOrderStatus.IN_PROGRESS,
      ProductionOrderStatus.PAUSED,
    ];

    const now = new Date();
    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.productionOrder.updateMany({
        where: { id, status: { in: CANCELLABLE }, version: dto.version },
        data: {
          status: ProductionOrderStatus.CANCELLED,
          version: { increment: 1 },
          cancelledAt: now,
          cancelledByUserId: actor.id,
          ...(dto.reason !== undefined ? { cancellationReason: dto.reason } : {}),
        },
      });

      if (result.count === 0) {
        const order = await tx.productionOrder.findUnique({ where: { id }, select: { id: true, status: true } });
        if (!order) throw new NotFoundException({ code: 'PRODUCTION_ORDER_NOT_FOUND', message: 'Production order not found' });
        if (!CANCELLABLE.includes(order.status)) {
          throw new UnprocessableEntityException({
            code: 'PRODUCTION_ORDER_INVALID_STATUS',
            message: `Cannot cancel an order in status ${order.status}`,
          });
        }
        throw new ConflictException({ code: 'PRODUCTION_ORDER_VERSION_CONFLICT', message: 'Order was changed by another user; please refresh and retry' });
      }

      const updated = await tx.productionOrder.findUniqueOrThrow({ where: { id }, select: ORDER_SELECT });

      await tx.productionActivity.create({
        data: {
          orderId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'cancelled',
          previousStatus: updated.status,
          newStatus: ProductionOrderStatus.CANCELLED,
          ...(dto.reason !== undefined ? { metadata: { reason: dto.reason } } : {}),
        },
      });

      return updated;
    });
  }

  // ---- Add entry (type-specific) ----

  async addEntry(id: string, type: 'OUTPUT' | 'DOWNTIME' | 'ADJUSTMENT', dto: AddEntryDto, actor: AuthUser) {
    // Permission check — ADJUSTMENT requires production.manage
    if (type === 'ADJUSTMENT') {
      if (!actor.permissions.includes('production.manage')) {
        throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.manage' });
      }
    } else {
      if (!actor.permissions.includes('production.entries.create') && !actor.permissions.includes('production.manage')) {
        throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.entries.create' });
      }
    }

    await this.findOneOrThrow(id, actor);

    const order = await this.db.getClient().productionOrder.findUnique({
      where: { id },
      select: { id: true, status: true, targetQuantity: true },
    });
    if (!order) throw new NotFoundException({ code: 'PRODUCTION_ORDER_NOT_FOUND', message: 'Production order not found' });

    // Status validation — type-specific
    if (type === 'OUTPUT') {
      if (order.status !== ProductionOrderStatus.IN_PROGRESS) {
        throw new UnprocessableEntityException({
          code: 'PRODUCTION_ORDER_INVALID_STATUS',
          message: 'OUTPUT entries can only be added when the order is IN_PROGRESS',
        });
      }
    } else if (type === 'DOWNTIME') {
      const DOWNTIME_STATUSES: ProductionOrderStatus[] = [ProductionOrderStatus.IN_PROGRESS, ProductionOrderStatus.PAUSED];
      if (!DOWNTIME_STATUSES.includes(order.status)) {
        throw new UnprocessableEntityException({
          code: 'PRODUCTION_ORDER_INVALID_STATUS',
          message: `DOWNTIME entries can only be added when the order is IN_PROGRESS or PAUSED (current: ${order.status})`,
        });
      }
    } else {
      const ADJUSTMENT_STATUSES: ProductionOrderStatus[] = [
        ProductionOrderStatus.IN_PROGRESS,
        ProductionOrderStatus.PAUSED,
        ProductionOrderStatus.COMPLETED,
      ];
      if (!ADJUSTMENT_STATUSES.includes(order.status)) {
        throw new UnprocessableEntityException({
          code: 'PRODUCTION_ORDER_INVALID_STATUS',
          message: `ADJUSTMENT entries can only be added when the order is IN_PROGRESS, PAUSED, or COMPLETED (current: ${order.status})`,
        });
      }
    }

    // Type-specific field validation
    if (type === 'OUTPUT') {
      if (dto.quantityProduced === undefined) {
        throw new UnprocessableEntityException({ code: 'PRODUCTION_ENTRY_INVALID', message: 'OUTPUT entry requires quantityProduced' });
      }
      const produced = dto.quantityProduced;
      const accepted = dto.quantityAccepted ?? 0;
      const rejected = dto.quantityRejected ?? 0;
      if (accepted + rejected !== produced) {
        throw new UnprocessableEntityException({
          code: 'PRODUCTION_ENTRY_INVALID',
          message: 'quantityAccepted + quantityRejected must exactly equal quantityProduced',
        });
      }
    } else if (type === 'DOWNTIME') {
      if (dto.downtimeMinutes === undefined) {
        throw new UnprocessableEntityException({ code: 'PRODUCTION_ENTRY_INVALID', message: 'DOWNTIME entry requires downtimeMinutes' });
      }
      if (!dto.note?.trim()) {
        throw new UnprocessableEntityException({ code: 'PRODUCTION_ENTRY_INVALID', message: 'DOWNTIME entry requires a reason (note)' });
      }
    } else {
      if (dto.adjustmentQty === undefined || dto.adjustmentQty === 0) {
        throw new UnprocessableEntityException({ code: 'PRODUCTION_ENTRY_INVALID', message: 'ADJUSTMENT entry requires a non-zero adjustmentQty' });
      }
      if (!dto.note?.trim()) {
        throw new UnprocessableEntityException({ code: 'PRODUCTION_ENTRY_INVALID', message: 'ADJUSTMENT entry requires a reason (note)' });
      }
      // Validate resulting effectiveProduced cannot be negative
      const existingEntries = await this.db.getClient().productionEntry.findMany({
        where: { orderId: id },
        select: { type: true, quantityProduced: true, quantityAccepted: true, quantityRejected: true, downtimeMinutes: true, adjustmentQty: true },
      });
      const metrics = computeMetrics(existingEntries as RawEntry[], order.targetQuantity);
      if (metrics.effectiveProduced + dto.adjustmentQty < 0) {
        throw new UnprocessableEntityException({
          code: 'PRODUCTION_ENTRY_INVALID',
          message: 'Adjustment would result in negative effective production count',
        });
      }
    }

    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
    const entryType = type as ProductionEntryType;

    return this.db.getClient().productionEntry.create({
      data: {
        orderId: id,
        type: entryType,
        authorUserId: actor.id,
        authorName: actor.displayName,
        recordedAt,
        ...(dto.quantityProduced !== undefined ? { quantityProduced: dto.quantityProduced } : {}),
        ...(dto.quantityAccepted !== undefined ? { quantityAccepted: dto.quantityAccepted } : {}),
        ...(dto.quantityRejected !== undefined ? { quantityRejected: dto.quantityRejected } : {}),
        ...(dto.downtimeMinutes !== undefined ? { downtimeMinutes: dto.downtimeMinutes } : {}),
        ...(dto.adjustmentQty !== undefined ? { adjustmentQty: dto.adjustmentQty } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });
  }

  // ---- List entries ----

  async listEntries(id: string, actor: AuthUser) {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    await this.findOne(id, actor);

    return this.db.getClient().productionEntry.findMany({
      where: { orderId: id },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  // ---- Metrics ----

  async getMetrics(id: string, actor: AuthUser): Promise<ProductionMetrics> {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    await this.findOneOrThrow(id, actor);

    const order = await this.db.getClient().productionOrder.findUnique({
      where: { id },
      select: { id: true, targetQuantity: true },
    });
    if (!order) throw new NotFoundException({ code: 'PRODUCTION_ORDER_NOT_FOUND', message: 'Production order not found' });

    const entries = await this.db.getClient().productionEntry.findMany({
      where: { orderId: id },
      select: {
        type: true,
        quantityProduced: true,
        quantityAccepted: true,
        quantityRejected: true,
        downtimeMinutes: true,
        adjustmentQty: true,
      },
    });

    return computeMetrics(entries as RawEntry[], order.targetQuantity);
  }

  // ---- Comments ----

  async addComment(id: string, dto: AddProductionCommentDto, actor: AuthUser) {
    if (!actor.permissions.includes('production.comment') && !actor.permissions.includes('production.manage')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.comment' });
    }

    await this.findOne(id, actor);

    return this.db.getClient().productionComment.create({
      data: {
        orderId: id,
        authorUserId: actor.id,
        body: dto.body,
      },
      include: { authorUser: { select: { id: true, displayName: true } } },
    });
  }

  async listComments(id: string, actor: AuthUser) {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    await this.findOne(id, actor);

    return this.db.getClient().productionComment.findMany({
      where: { orderId: id },
      include: { authorUser: { select: { id: true, displayName: true } } },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  // ---- Activities ----

  async listActivities(id: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    await this.findOne(id, actor);

    return this.db.getClient().productionActivity.findMany({
      where: { orderId: id },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  // ---- Summary ----

  async getSummary(actor: AuthUser) {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.PRODUCTION_DASHBOARD);
    const deptWhere = deptFilter !== null ? { departmentId: deptFilter } : {};

    const [draft, scheduled, inProgress, paused, completed, cancelled] = await Promise.all([
      this.db.getClient().productionOrder.count({ where: { ...deptWhere, status: ProductionOrderStatus.DRAFT } }),
      this.db.getClient().productionOrder.count({ where: { ...deptWhere, status: ProductionOrderStatus.SCHEDULED } }),
      this.db.getClient().productionOrder.count({ where: { ...deptWhere, status: ProductionOrderStatus.IN_PROGRESS } }),
      this.db.getClient().productionOrder.count({ where: { ...deptWhere, status: ProductionOrderStatus.PAUSED } }),
      this.db.getClient().productionOrder.count({ where: { ...deptWhere, status: ProductionOrderStatus.COMPLETED } }),
      this.db.getClient().productionOrder.count({ where: { ...deptWhere, status: ProductionOrderStatus.CANCELLED } }),
    ]);

    return { totalDraft: draft, totalScheduled: scheduled, totalInProgress: inProgress, totalPaused: paused, totalCompleted: completed, totalCancelled: cancelled };
  }

  async getDashboard(actor: AuthUser): Promise<{
    scope: { type: DepartmentAccessScope; departmentNames: string[] };
    metrics: {
      scheduledOrders: number;
      inProgressOrders: number;
      pausedOrders: number;
      completedThisMonth: number;
    };
    recent: { id: string; referenceNumber: string; title: string; status: string; updatedAt: string }[];
  }> {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    const [scopeType, deptFilter] = await Promise.all([
      this.deptAccess.getScope(actor, ModuleIdentifier.PRODUCTION_DASHBOARD),
      this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.PRODUCTION_DASHBOARD),
    ]);

    let departmentNames: string[] = [];
    if (deptFilter !== null && deptFilter.in.length > 0) {
      const depts = await this.db.getClient().department.findMany({
        where: { id: { in: deptFilter.in } },
        select: { name: true },
        orderBy: { name: 'asc' },
      });
      departmentNames = depts.map((d) => d.name);
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const deptWhere = deptFilter !== null ? { departmentId: deptFilter } : {};

    const [scheduledOrders, inProgressOrders, pausedOrders, completedThisMonth, recentRaw] =
      await Promise.all([
        this.db.getClient().productionOrder.count({
          where: { ...deptWhere, status: ProductionOrderStatus.SCHEDULED },
        }),
        this.db.getClient().productionOrder.count({
          where: { ...deptWhere, status: ProductionOrderStatus.IN_PROGRESS },
        }),
        this.db.getClient().productionOrder.count({
          where: { ...deptWhere, status: ProductionOrderStatus.PAUSED },
        }),
        this.db.getClient().productionOrder.count({
          where: {
            ...deptWhere,
            status: ProductionOrderStatus.COMPLETED,
            completedAt: { gte: monthStart, lt: monthEnd },
          },
        }),
        this.db.getClient().productionOrder.findMany({
          where: { ...deptWhere },
          take: 8,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, referenceNumber: true, title: true, status: true, updatedAt: true },
        }),
      ]);

    return {
      scope: { type: scopeType, departmentNames },
      metrics: { scheduledOrders, inProgressOrders, pausedOrders, completedThisMonth },
      recent: recentRaw.map((r) => ({
        id: r.id,
        referenceNumber: r.referenceNumber,
        title: r.title,
        status: r.status as string,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  // ---- Org selectors ----

  async listDepartments(actor: AuthUser) {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    return this.db.getClient().department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  async listPlants(actor: AuthUser) {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    return this.db.getClient().plant.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  async listPeople(actor: AuthUser) {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    return this.db.getClient().user.findMany({
      where: { isActive: true },
      select: { id: true, displayName: true, departmentId: true },
      orderBy: [{ displayName: 'asc' }],
    });
  }

  async listLocations(actor: AuthUser) {
    if (!actor.permissions.includes('production.read')) {
      throw new ForbiddenException({ code: 'PRODUCTION_PERMISSION_DENIED', message: 'Missing production.read' });
    }

    return this.db.getClient().location.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, plantId: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  // ---- Private helpers ----

  private async findOneOrThrow(id: string, actor?: AuthUser) {
    const order = await this.db.getClient().productionOrder.findUnique({ where: { id }, select: ORDER_SELECT });
    if (!order) throw new NotFoundException({ code: 'PRODUCTION_ORDER_NOT_FOUND', message: 'Production order not found' });
    if (actor) {
      await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.PRODUCTION_DASHBOARD, order.departmentId as string | null);
    }
    return order;
  }

  private async transition(
    id: string,
    version: number,
    fromStatus: ProductionOrderStatus,
    toStatus: ProductionOrderStatus,
    actor: AuthUser,
    event: string,
    extraData: Record<string, unknown>,
  ) {
    return this.db.getClient().$transaction(async (tx) => {
      const result = await tx.productionOrder.updateMany({
        where: { id, status: fromStatus, version },
        data: {
          status: toStatus,
          version: { increment: 1 },
          ...extraData,
        },
      });

      if (result.count === 0) {
        const order = await tx.productionOrder.findUnique({ where: { id }, select: { id: true, status: true } });
        if (!order) throw new NotFoundException({ code: 'PRODUCTION_ORDER_NOT_FOUND', message: 'Production order not found' });
        if (order.status !== fromStatus) {
          throw new UnprocessableEntityException({
            code: 'PRODUCTION_ORDER_INVALID_STATUS',
            message: `Cannot ${event} an order in status ${order.status}`,
          });
        }
        throw new ConflictException({ code: 'PRODUCTION_ORDER_VERSION_CONFLICT', message: 'Order was changed by another user; please refresh and retry' });
      }

      const updated = await tx.productionOrder.findUniqueOrThrow({ where: { id }, select: ORDER_SELECT });

      await tx.productionActivity.create({
        data: {
          orderId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event,
          previousStatus: fromStatus,
          newStatus: toStatus,
        },
      });

      return updated;
    });
  }
}

// ---------------------------------------------------------------------------
// Where builder for list query
// ---------------------------------------------------------------------------

function buildOrderWhere(query: ProductionOrderListQueryDto): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (query.status) where['status'] = query.status;
  if (query.productionLineId) where['productionLineId'] = query.productionLineId;
  if (query.departmentId) where['departmentId'] = query.departmentId;
  if (query.plantId) where['plantId'] = query.plantId;
  if (query.supervisorUserId) where['supervisorUserId'] = query.supervisorUserId;
  if (query.search?.length) {
    where['OR'] = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { referenceNumber: { contains: query.search, mode: 'insensitive' } },
      { productName: { contains: query.search, mode: 'insensitive' } },
      { productCode: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return where;
}
