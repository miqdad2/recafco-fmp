import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { ContractStatus, ContractScheduleStatus, ContractClaimStatus, ModuleIdentifier, DepartmentAccessScope, ContractBoqMixDesignType } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { ContractsRefService } from './contracts-ref.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractDto } from './dto/create-contract.dto';
import type { CreateContractBoqItemDto } from './dto/create-contract-boq-item.dto';
import type { UpdateContractDto } from './dto/update-contract.dto';
import type { ContractListQueryDto, PaginatedResult } from './dto/contract-list-query.dto';
import type { ActivateContractDto } from './dto/activate-contract.dto';
import type { TerminateContractDto } from './dto/terminate-contract.dto';
import type { CancelContractDto } from './dto/cancel-contract.dto';
import type { CloseContractDto } from './dto/close-contract.dto';
import type { AddCommentDto } from './dto/add-comment.dto';
import type { UpdateContractScheduleStatusDto } from './dto/update-contract-schedule-status.dto';

// ---------------------------------------------------------------------------
// CM-55 — Contract List approved-design rebuild. Same "reuse, don't
// re-derive" convention as contract-dashboard.service.ts: a local copy of
// the "final" claim statuses (mirrors contract-claims.service.ts's own
// FINAL_STATUSES, not exported from there) drives the list's real Open
// Claims count.
// ---------------------------------------------------------------------------

const FINAL_CLAIM_STATUSES_FOR_LIST: ContractClaimStatus[] = [
  ContractClaimStatus.APPROVED, ContractClaimStatus.REJECTED, ContractClaimStatus.SETTLED,
  ContractClaimStatus.CLOSED, ContractClaimStatus.CANCELLED,
];

// ---------------------------------------------------------------------------
// Derived lifecycle status helpers
// ---------------------------------------------------------------------------

export type DerivedLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED' | 'CLOSED' | 'CANCELLED';

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
  if (contract.status === ContractStatus.CANCELLED) return 'CANCELLED';

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
  jobOrder: true,
  contractDate: true,
  quotationNumber: true,
  projectNumber: true,
  scopeOfWork: true,
  paymentTerms: true,
  contractValue: true,
  currency: true,
  startDate: true,
  endDate: true,
  renewalNoticeDate: true,
  clientContactName: true,
  clientContactPhone: true,
  forecastCompletionDate: true,
  originalContractValue: true,
  originalCurrency: true,
  projectSiteLocation: true,
  scopeDescription: true,
  scopeExclusions: true,
  deliverables: true,
  milestones: true,
  scheduleSummary: true,
  quantitiesSpecifications: true,
  craneRequired: true,
  craneProvidedBy: true,
  estimatedCraneCapacity: true,
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
  cancelledAt: true,
  cancelledByUserId: true,
  cancellationReason: true,
  scheduleStatus: true,
  createdAt: true,
  updatedAt: true,
  ownerUser: { select: { id: true, displayName: true } },
  createdByUser: { select: { id: true, displayName: true } },
  activatedByUser: { select: { id: true, displayName: true } },
  terminatedByUser: { select: { id: true, displayName: true } },
  closedByUser: { select: { id: true, displayName: true } },
  cancelledByUser: { select: { id: true, displayName: true } },
  department: { select: { id: true, name: true } },
  plant: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  boqItems: {
    select: {
      id: true,
      sortOrder: true,
      itemCode: true,
      category: true,
      description: true,
      drawingReference: true,
      specificationReference: true,
      originalEstimatedQty: true,
      revisedQty: true,
      unitOfMeasure: true,
      mixDesignType: true,
      concreteGrade: true,
      unitPrice: true,
      totalPrice: true,
      drawingQty: true,
      invoiceQty: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { sortOrder: 'asc' },
  },
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

// ---------------------------------------------------------------------------
// CM-55 — Contract List: schedule/progress status default, real per-contract
// Progress %/Payment Progress %/Open Claims.
// ---------------------------------------------------------------------------

/**
 * The stored `scheduleStatus` is nullable — most contracts will never have
 * had a manager explicitly set one. This computes the value the Contract
 * List's Status dropdown shows/pre-selects when nothing has been set: a
 * neutral "IN_PROGRESS" default, or "COMPLETED" once the contract's real
 * lifecycle status is CLOSED. Never guesses DELAYED/ON_TRACK/AHEAD_OF_SCHEDULE
 * — those are only ever a manager's explicit choice, never inferred.
 */
export function computeEffectiveScheduleStatus(contract: {
  scheduleStatus: string | null;
  status: string;
}): ContractScheduleStatus {
  if (contract.scheduleStatus) return contract.scheduleStatus as ContractScheduleStatus;
  return contract.status === ContractStatus.CLOSED ? ContractScheduleStatus.COMPLETED : ContractScheduleStatus.IN_PROGRESS;
}

/** Prisma Decimal | number | null -> plain number | null. Mirrors the same-name helper in contract-payments.service.ts. */
function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/** Real workflow-task completion ratio — same completed/total definition CM-37/CM-54's dashboard already uses. 0% (not NaN) when there are no tasks yet. */
export function computeContractProgressPercent(tasks: { status: string }[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
  return Math.round((completed / tasks.length) * 100);
}

/** Real total-paid / current-contract-value ratio. 0% when the contract has no value to compare against (never divides by zero). */
export function computeContractPaymentProgressPercent(payments: { paidAmount: unknown }[], contractValue: unknown): number {
  const value = toNum(contractValue);
  if (value === null || value <= 0) return 0;
  const totalPaid = payments.reduce((sum, p) => sum + (toNum(p.paidAmount) ?? 0), 0);
  return Math.round((totalPaid / value) * 100);
}

const CONTRACT_LIST_SELECT = {
  ...CONTRACT_SELECT,
  workflowTasks: { select: { status: true } },
  payments: { select: { paidAmount: true } },
  _count: { select: { claims: { where: { status: { notIn: FINAL_CLAIM_STATUSES_FOR_LIST } } } } },
} as const;

type ContractListRecord = ContractRecord & {
  workflowTasks: { status: string }[];
  payments: { paidAmount: unknown }[];
  _count: { claims: number };
};

export interface ContractListItem extends ContractWithLifecycle {
  progressPercent: number;
  paymentProgressPercent: number;
  openClaimsCount: number;
  effectiveScheduleStatus: ContractScheduleStatus;
}

function toListItem(contract: ContractListRecord): ContractListItem {
  const { workflowTasks, payments, _count, ...rest } = contract;
  const base = withLifecycle(rest as ContractRecord);
  return {
    ...base,
    progressPercent: computeContractProgressPercent(workflowTasks),
    paymentProgressPercent: computeContractPaymentProgressPercent(payments, contract.contractValue),
    openClaimsCount: _count.claims,
    effectiveScheduleStatus: computeEffectiveScheduleStatus({
      scheduleStatus: contract.scheduleStatus as string | null,
      status: contract.status as string,
    }),
  };
}

// ---------------------------------------------------------------------------
// BOQ item helpers
//
// totalPrice is always recalculated server-side, never trusted from the
// client. Preferred quantity: revisedQty when present, else
// originalEstimatedQty. If either quantity or unitPrice is missing, the line
// has no computable total — reported as null (not 0, to keep "no data" and
// "zero value" visibly distinct).
// ---------------------------------------------------------------------------

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function computeBoqItemTotal(item: CreateContractBoqItemDto): number | null {
  const qty = item.revisedQty ?? item.originalEstimatedQty;
  if (qty === undefined || item.unitPrice === undefined) return null;
  return round3(qty * item.unitPrice);
}

function findDuplicateBoqItemCodes(items: CreateContractBoqItemDto[]): string[] {
  const codes = items.map((i) => i.itemCode).filter((c): c is string => c !== undefined && c !== '');
  const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
  return [...new Set(duplicates)];
}

// ---------------------------------------------------------------------------
// Scope of Work validation
//
// Enforced server-side on both create and update so none of these rules can
// be bypassed by calling the API directly:
//   - Ex-Factory is incompatible with Delivery/Erection.
//   - Not Applicable is incompatible with any other active scope option.
//   - Other requires a non-empty otherDescription.
// ---------------------------------------------------------------------------

const ACTIVE_SCOPE_KEYS = ['shopDrawing', 'designProduction', 'production', 'delivery', 'erection', 'exFactory', 'other'];

function assertScopeOfWorkValid(scopeOfWork: Record<string, boolean | string> | undefined): void {
  if (!scopeOfWork) return;
  const isTrue = (key: string): boolean => scopeOfWork[key] === true;

  if (isTrue('exFactory') && (isTrue('delivery') || isTrue('erection'))) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_SCOPE_EX_FACTORY_CONFLICT',
      message: 'Ex-Factory cannot be selected together with Delivery or Erection.',
    });
  }

  if (isTrue('notApplicable') && ACTIVE_SCOPE_KEYS.some(isTrue)) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_SCOPE_NOT_APPLICABLE_CONFLICT',
      message: 'Not Applicable cannot be selected together with any other scope option.',
    });
  }

  if (isTrue('other')) {
    const otherDescription = scopeOfWork['otherDescription'];
    if (typeof otherDescription !== 'string' || otherDescription.trim() === '') {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_SCOPE_OTHER_DESCRIPTION_REQUIRED',
        message: 'Other Description is required when Other scope is selected.',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Erection / crane validation
//
// Crane fields only make sense when Erection is part of scope. Rejecting
// (rather than silently dropping) keeps stored data clean and matches the
// task's preferred approach.
// ---------------------------------------------------------------------------

function assertCraneFieldsValid(
  erectionSelected: boolean,
  fields: {
    craneRequired?: string | undefined;
    craneProvidedBy?: string | undefined;
    estimatedCraneCapacity?: string | undefined;
  },
): void {
  const anyCraneField =
    fields.craneRequired !== undefined || fields.craneProvidedBy !== undefined || fields.estimatedCraneCapacity !== undefined;
  if (anyCraneField && !erectionSelected) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_CRANE_REQUIRES_ERECTION',
      message: 'Crane fields can only be provided when Erection is selected in Scope of Work.',
    });
  }
}

// ---------------------------------------------------------------------------
// Security audit metadata helpers
//
// ContractActivity (above) is the user-facing contract timeline. These
// helpers build metadata for securityAuditEvent, the separate platform
// audit/security/compliance trail (see incidents/maintenance/safety for the
// same pattern). Free-text fields (description/notes/counterpartyContact)
// are flagged as changed but never duplicated into audit metadata.
// ---------------------------------------------------------------------------

const AUDITABLE_UPDATE_FIELDS = [
  'title',
  'counterpartyName',
  'jobOrder',
  'contractDate',
  'quotationNumber',
  'projectNumber',
  'contractValue',
  'currency',
  'startDate',
  'endDate',
  'renewalNoticeDate',
  'clientContactName',
  'clientContactPhone',
  'forecastCompletionDate',
  'originalContractValue',
  'originalCurrency',
  'projectSiteLocation',
  'craneRequired',
  'craneProvidedBy',
  'estimatedCraneCapacity',
  'departmentId',
  'plantId',
  'locationId',
  'ownerUserId',
] as const;

const DATE_UPDATE_FIELDS = new Set(['startDate', 'endDate', 'renewalNoticeDate', 'contractDate', 'forecastCompletionDate']);

type AuditScalar = string | number | boolean | null;

function auditSerialize(value: unknown): AuditScalar {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === 'object' &&
    typeof (value as { toNumber?: unknown }).toNumber === 'function'
  ) {
    return (value as { toNumber(): number }).toNumber();
  }
  return value as AuditScalar;
}

function buildUpdateAuditMetadata(
  existing: ContractRecord,
  dto: UpdateContractDto,
): { changedFields: string[]; previousValues: Record<string, AuditScalar>; newValues: Record<string, AuditScalar> } {
  const changedFields: string[] = [];
  const previousValues: Record<string, AuditScalar> = {};
  const newValues: Record<string, AuditScalar> = {};

  const dtoData = dto as unknown as Record<string, unknown>;
  const existingData = existing as unknown as Record<string, unknown>;

  for (const field of AUDITABLE_UPDATE_FIELDS) {
    const dtoValue = dtoData[field];
    if (dtoValue === undefined) continue;

    const nextValue = DATE_UPDATE_FIELDS.has(field) ? new Date(dtoValue as string) : dtoValue;
    const prevSerialized = auditSerialize(existingData[field]);
    const nextSerialized = auditSerialize(nextValue);

    if (JSON.stringify(prevSerialized) !== JSON.stringify(nextSerialized)) {
      changedFields.push(field);
      previousValues[field] = prevSerialized;
      newValues[field] = nextSerialized;
    }
  }

  if (dto.description !== undefined && dto.description !== (existing.description as string | null)) {
    changedFields.push('description');
  }
  if (dto.counterpartyContact !== undefined && dto.counterpartyContact !== (existing.counterpartyContact as string | null)) {
    changedFields.push('counterpartyContact');
  }
  if (dto.notes !== undefined && dto.notes !== (existing.notes as string | null)) {
    changedFields.push('notes');
  }
  if (dto.scopeDescription !== undefined && dto.scopeDescription !== (existing.scopeDescription as string | null)) {
    changedFields.push('scopeDescription');
  }
  if (dto.scopeExclusions !== undefined && dto.scopeExclusions !== (existing.scopeExclusions as string | null)) {
    changedFields.push('scopeExclusions');
  }
  if (dto.deliverables !== undefined && dto.deliverables !== (existing.deliverables as string | null)) {
    changedFields.push('deliverables');
  }
  if (dto.milestones !== undefined && dto.milestones !== (existing.milestones as string | null)) {
    changedFields.push('milestones');
  }
  if (dto.scheduleSummary !== undefined && dto.scheduleSummary !== (existing.scheduleSummary as string | null)) {
    changedFields.push('scheduleSummary');
  }
  if (
    dto.quantitiesSpecifications !== undefined &&
    dto.quantitiesSpecifications !== (existing.quantitiesSpecifications as string | null)
  ) {
    changedFields.push('quantitiesSpecifications');
  }
  if (dto.scopeOfWork !== undefined) {
    changedFields.push('scopeOfWork');
  }
  if (dto.paymentTerms !== undefined) {
    changedFields.push('paymentTerms');
  }
  if (dto.boqItems !== undefined) {
    changedFields.push('boqItems');
  }

  return { changedFields, previousValues, newValues };
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ref: ContractsRefService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create (saves as DRAFT)
  // ---------------------------------------------------------------------------

  async create(dto: CreateContractDto, actor: AuthUser): Promise<ContractWithLifecycle> {
    if (!actor.permissions.includes('contracts.create')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.create' });
    }

    // No departmentId was submitted: for OWN_DEPARTMENT-scoped actors, default to their own
    // department so the contract they just created remains visible to them in the Contract
    // List (which is filtered to that same department). Privileged scopes (SELECTED/ALL
    // departments) are left untouched — their existing null-department behavior is unaffected.
    let departmentId = dto.departmentId;
    if (departmentId === undefined) {
      const scope = await this.deptAccess.getScope(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
      if (scope === DepartmentAccessScope.OWN_DEPARTMENT) {
        if (!actor.departmentId) {
          throw new UnprocessableEntityException({
            code: 'CONTRACT_DEPARTMENT_REQUIRED',
            message: 'Your user is not assigned to a department. Please contact administrator.',
          });
        }
        departmentId = actor.departmentId;
      }
    }

    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId ?? null);

    if (dto.ownerUserId && dto.ownerUserId !== actor.id && !actor.permissions.includes('contracts.manage')) {
      throw new ForbiddenException({
        code: 'CONTRACTS_PERMISSION_DENIED',
        message: 'Only contracts.manage can set a different owner',
      });
    }

    assertScopeOfWorkValid(dto.scopeOfWork);
    assertCraneFieldsValid(dto.scopeOfWork?.['erection'] === true, {
      craneRequired: dto.craneRequired,
      craneProvidedBy: dto.craneProvidedBy,
      estimatedCraneCapacity: dto.estimatedCraneCapacity,
    });

    const boqItems = dto.boqItems ?? [];
    if (boqItems.length > 0) {
      const duplicates = findDuplicateBoqItemCodes(boqItems);
      if (duplicates.length > 0) {
        throw new UnprocessableEntityException({
          code: 'CONTRACT_BOQ_DUPLICATE_ITEM_CODE',
          message: `Duplicate BOQ item code(s) in the same contract: ${duplicates.join(', ')}`,
        });
      }
    }

    const boqItemTotals = boqItems.map((item) => computeBoqItemTotal(item));
    // BOQ items provided → contractValue is derived from their totals (source of truth).
    // No BOQ items → preserve prior behavior: use contractValue exactly as submitted.
    const effectiveContractValue =
      boqItems.length > 0
        ? round3(boqItemTotals.reduce((sum: number, t) => sum + (t ?? 0), 0))
        : dto.contractValue;
    const effectiveCurrency = dto.currency ?? (boqItems.length > 0 ? 'KWD' : undefined);
    // Original Value defaults to the initial current value when not explicitly entered —
    // only meaningful at creation time; update() never re-derives it this way.
    const effectiveOriginalContractValue = dto.originalContractValue ?? effectiveContractValue;
    const effectiveOriginalCurrency = dto.originalCurrency ?? effectiveCurrency;

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
          ...(dto.jobOrder !== undefined ? { jobOrder: dto.jobOrder } : {}),
          ...(dto.contractDate !== undefined ? { contractDate: new Date(dto.contractDate) } : {}),
          ...(dto.quotationNumber !== undefined ? { quotationNumber: dto.quotationNumber } : {}),
          ...(dto.projectNumber !== undefined ? { projectNumber: dto.projectNumber } : {}),
          ...(dto.scopeOfWork !== undefined ? { scopeOfWork: dto.scopeOfWork } : {}),
          ...(dto.paymentTerms !== undefined ? { paymentTerms: dto.paymentTerms } : {}),
          ...(effectiveContractValue !== undefined ? { contractValue: effectiveContractValue } : {}),
          ...(effectiveCurrency !== undefined ? { currency: effectiveCurrency } : {}),
          ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
          ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
          ...(dto.renewalNoticeDate !== undefined ? { renewalNoticeDate: new Date(dto.renewalNoticeDate) } : {}),
          ...(dto.clientContactName !== undefined ? { clientContactName: dto.clientContactName } : {}),
          ...(dto.clientContactPhone !== undefined ? { clientContactPhone: dto.clientContactPhone } : {}),
          ...(dto.forecastCompletionDate !== undefined ? { forecastCompletionDate: new Date(dto.forecastCompletionDate) } : {}),
          ...(effectiveOriginalContractValue !== undefined ? { originalContractValue: effectiveOriginalContractValue } : {}),
          ...(effectiveOriginalCurrency !== undefined ? { originalCurrency: effectiveOriginalCurrency } : {}),
          ...(dto.projectSiteLocation !== undefined ? { projectSiteLocation: dto.projectSiteLocation } : {}),
          ...(dto.scopeDescription !== undefined ? { scopeDescription: dto.scopeDescription } : {}),
          ...(dto.scopeExclusions !== undefined ? { scopeExclusions: dto.scopeExclusions } : {}),
          ...(dto.deliverables !== undefined ? { deliverables: dto.deliverables } : {}),
          ...(dto.milestones !== undefined ? { milestones: dto.milestones } : {}),
          ...(dto.scheduleSummary !== undefined ? { scheduleSummary: dto.scheduleSummary } : {}),
          ...(dto.quantitiesSpecifications !== undefined ? { quantitiesSpecifications: dto.quantitiesSpecifications } : {}),
          ...(dto.craneRequired !== undefined ? { craneRequired: dto.craneRequired } : {}),
          ...(dto.craneProvidedBy !== undefined ? { craneProvidedBy: dto.craneProvidedBy } : {}),
          ...(dto.estimatedCraneCapacity !== undefined ? { estimatedCraneCapacity: dto.estimatedCraneCapacity } : {}),
          ...(departmentId !== undefined ? { departmentId } : {}),
          ...(dto.plantId !== undefined ? { plantId: dto.plantId } : {}),
          ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
        select: { id: true },
      });

      if (boqItems.length > 0) {
        await tx.contractBoqItem.createMany({
          data: boqItems.map((item, index) => ({
            contractId: created.id,
            sortOrder: index + 1,
            ...(item.itemCode !== undefined ? { itemCode: item.itemCode } : {}),
            ...(item.category !== undefined ? { category: item.category } : {}),
            description: item.description,
            ...(item.drawingReference !== undefined ? { drawingReference: item.drawingReference } : {}),
            ...(item.specificationReference !== undefined ? { specificationReference: item.specificationReference } : {}),
            ...(item.originalEstimatedQty !== undefined ? { originalEstimatedQty: item.originalEstimatedQty } : {}),
            ...(item.revisedQty !== undefined ? { revisedQty: item.revisedQty } : {}),
            ...(item.unitOfMeasure !== undefined ? { unitOfMeasure: item.unitOfMeasure } : {}),
            ...(item.mixDesignType !== undefined ? { mixDesignType: item.mixDesignType as ContractBoqMixDesignType } : {}),
            ...(item.concreteGrade !== undefined ? { concreteGrade: item.concreteGrade } : {}),
            ...(item.unitPrice !== undefined ? { unitPrice: item.unitPrice } : {}),
            ...(item.drawingQty !== undefined ? { drawingQty: item.drawingQty } : {}),
            ...(item.invoiceQty !== undefined ? { invoiceQty: item.invoiceQty } : {}),
            totalPrice: boqItemTotals[index] ?? null,
          })),
        });
      }

      await tx.contractActivity.create({
        data: {
          contractId: created.id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'created',
          newStatus: ContractStatus.DRAFT,
          metadata: { referenceNumber, boqItemCount: boqItems.length },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'CONTRACT_CREATED',
          userId: ownerUserId,
          actorId: actor.id,
          metadata: {
            contractId: created.id,
            referenceNumber,
            departmentId: departmentId ?? null,
          },
        },
      });

      return tx.contract.findUniqueOrThrow({ where: { id: created.id }, select: CONTRACT_SELECT });
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

    const contract = await this.findOneOrThrow(id, actor);

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

    // If the department is being changed, assert actor can access the new department
    if (dto.departmentId !== undefined && dto.departmentId !== (contract.departmentId as string | null)) {
      await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, dto.departmentId ?? null);
    }

    assertScopeOfWorkValid(dto.scopeOfWork);

    // Crane fields are validated against the EFFECTIVE erection state: the
    // submitted scopeOfWork if this update touches it, otherwise the
    // contract's existing stored scope (an update that only changes crane
    // fields must still be checked against what erection is actually set to).
    const existingScopeOfWork = contract.scopeOfWork as Record<string, boolean | string> | null;
    const effectiveErectionSelected =
      dto.scopeOfWork !== undefined
        ? dto.scopeOfWork['erection'] === true
        : existingScopeOfWork?.['erection'] === true;
    assertCraneFieldsValid(effectiveErectionSelected, {
      craneRequired: dto.craneRequired,
      craneProvidedBy: dto.craneProvidedBy,
      estimatedCraneCapacity: dto.estimatedCraneCapacity,
    });

    // undefined boqItems = BOQ untouched by this update. An explicit array
    // (including []) replaces the full BOQ item set for the contract.
    const replacingBoq = dto.boqItems !== undefined;
    const boqItems = dto.boqItems ?? [];
    if (replacingBoq && boqItems.length > 0) {
      const duplicates = findDuplicateBoqItemCodes(boqItems);
      if (duplicates.length > 0) {
        throw new UnprocessableEntityException({
          code: 'CONTRACT_BOQ_DUPLICATE_ITEM_CODE',
          message: `Duplicate BOQ item code(s) in the same contract: ${duplicates.join(', ')}`,
        });
      }
    }
    const boqItemTotals = boqItems.map((item) => computeBoqItemTotal(item));
    // BOQ items present after this update → contractValue is derived from their totals.
    // BOQ untouched or explicitly cleared → fall back to manual contractValue behavior.
    const effectiveContractValue =
      replacingBoq && boqItems.length > 0
        ? round3(boqItemTotals.reduce((sum: number, t) => sum + (t ?? 0), 0))
        : dto.contractValue;
    const effectiveCurrency =
      dto.currency ?? (replacingBoq && boqItems.length > 0 ? 'KWD' : undefined);

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.counterpartyName !== undefined) data['counterpartyName'] = dto.counterpartyName;
    if (dto.counterpartyContact !== undefined) data['counterpartyContact'] = dto.counterpartyContact;
    if (dto.jobOrder !== undefined) data['jobOrder'] = dto.jobOrder;
    if (dto.contractDate !== undefined) data['contractDate'] = new Date(dto.contractDate);
    if (dto.quotationNumber !== undefined) data['quotationNumber'] = dto.quotationNumber;
    if (dto.projectNumber !== undefined) data['projectNumber'] = dto.projectNumber;
    if (dto.scopeOfWork !== undefined) data['scopeOfWork'] = dto.scopeOfWork;
    if (dto.paymentTerms !== undefined) data['paymentTerms'] = dto.paymentTerms;
    if (effectiveContractValue !== undefined) data['contractValue'] = effectiveContractValue;
    if (effectiveCurrency !== undefined) data['currency'] = effectiveCurrency;
    if (dto.startDate !== undefined) data['startDate'] = new Date(dto.startDate);
    if (dto.endDate !== undefined) data['endDate'] = new Date(dto.endDate);
    if (dto.renewalNoticeDate !== undefined) data['renewalNoticeDate'] = new Date(dto.renewalNoticeDate);
    if (dto.clientContactName !== undefined) data['clientContactName'] = dto.clientContactName;
    if (dto.clientContactPhone !== undefined) data['clientContactPhone'] = dto.clientContactPhone;
    if (dto.forecastCompletionDate !== undefined) data['forecastCompletionDate'] = new Date(dto.forecastCompletionDate);
    if (dto.originalContractValue !== undefined) data['originalContractValue'] = dto.originalContractValue;
    if (dto.originalCurrency !== undefined) data['originalCurrency'] = dto.originalCurrency;
    if (dto.projectSiteLocation !== undefined) data['projectSiteLocation'] = dto.projectSiteLocation;
    if (dto.scopeDescription !== undefined) data['scopeDescription'] = dto.scopeDescription;
    if (dto.scopeExclusions !== undefined) data['scopeExclusions'] = dto.scopeExclusions;
    if (dto.deliverables !== undefined) data['deliverables'] = dto.deliverables;
    if (dto.milestones !== undefined) data['milestones'] = dto.milestones;
    if (dto.scheduleSummary !== undefined) data['scheduleSummary'] = dto.scheduleSummary;
    if (dto.quantitiesSpecifications !== undefined) data['quantitiesSpecifications'] = dto.quantitiesSpecifications;
    if (dto.craneRequired !== undefined) data['craneRequired'] = dto.craneRequired;
    if (dto.craneProvidedBy !== undefined) data['craneProvidedBy'] = dto.craneProvidedBy;
    if (dto.estimatedCraneCapacity !== undefined) data['estimatedCraneCapacity'] = dto.estimatedCraneCapacity;
    if (dto.ownerUserId !== undefined) data['ownerUserId'] = dto.ownerUserId;
    if (dto.departmentId !== undefined) data['departmentId'] = dto.departmentId;
    if (dto.plantId !== undefined) data['plantId'] = dto.plantId;
    if (dto.locationId !== undefined) data['locationId'] = dto.locationId;
    if (dto.notes !== undefined) data['notes'] = dto.notes;

    const auditMetadata = buildUpdateAuditMetadata(contract, dto);

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

      // Replace-in-place: no BOQ version history yet (CM-23C), so the whole set
      // for this contract is simply deleted and recreated from the submission.
      if (replacingBoq) {
        await tx.contractBoqItem.deleteMany({ where: { contractId: id } });
        if (boqItems.length > 0) {
          await tx.contractBoqItem.createMany({
            data: boqItems.map((item, index) => ({
              contractId: id,
              sortOrder: index + 1,
              ...(item.itemCode !== undefined ? { itemCode: item.itemCode } : {}),
              ...(item.category !== undefined ? { category: item.category } : {}),
              description: item.description,
              ...(item.drawingReference !== undefined ? { drawingReference: item.drawingReference } : {}),
              ...(item.specificationReference !== undefined ? { specificationReference: item.specificationReference } : {}),
              ...(item.originalEstimatedQty !== undefined ? { originalEstimatedQty: item.originalEstimatedQty } : {}),
              ...(item.revisedQty !== undefined ? { revisedQty: item.revisedQty } : {}),
              ...(item.unitOfMeasure !== undefined ? { unitOfMeasure: item.unitOfMeasure } : {}),
              ...(item.mixDesignType !== undefined ? { mixDesignType: item.mixDesignType as ContractBoqMixDesignType } : {}),
              ...(item.concreteGrade !== undefined ? { concreteGrade: item.concreteGrade } : {}),
              ...(item.unitPrice !== undefined ? { unitPrice: item.unitPrice } : {}),
              ...(item.drawingQty !== undefined ? { drawingQty: item.drawingQty } : {}),
              ...(item.invoiceQty !== undefined ? { invoiceQty: item.invoiceQty } : {}),
              totalPrice: boqItemTotals[index] ?? null,
            })),
          });
        }
      }

      const refreshed = await tx.contract.findUniqueOrThrow({ where: { id }, select: CONTRACT_SELECT });

      await tx.contractActivity.create({
        data: {
          contractId: id,
          actorUserId: actor.id,
          actorName: actor.displayName,
          event: 'updated',
          ...(replacingBoq ? { metadata: { boqItemCount: boqItems.length } } : {}),
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'CONTRACT_UPDATED',
          userId: (dto.ownerUserId ?? contract.ownerUserId) as string,
          actorId: actor.id,
          metadata: {
            contractId: id,
            referenceNumber: contract.referenceNumber,
            departmentId: (dto.departmentId ?? contract.departmentId) as string | null,
            changedFields: auditMetadata.changedFields,
            previousValues: auditMetadata.previousValues,
            newValues: auditMetadata.newValues,
          },
        },
      });

      return refreshed;
    });

    return withLifecycle(updated as ContractRecord);
  }

  // ---------------------------------------------------------------------------
  // CM-55 — manager-facing schedule/progress status. Deliberately independent
  // of update() above: no DRAFT-only restriction (a manager needs this on
  // ACTIVE contracts most of all), no lifecycle transition, no version-based
  // optimistic concurrency (a low-stakes display categorization — last write
  // wins is an acceptable tradeoff for the simplicity, unlike the real
  // lifecycle transitions below which all use version). Never touches
  // Contract.status, never interacts with the closeout approval flow.
  // ---------------------------------------------------------------------------

  async updateScheduleStatus(
    id: string,
    dto: UpdateContractScheduleStatusDto,
    actor: AuthUser,
  ): Promise<ContractWithLifecycle> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const contract = await this.findOneOrThrow(id, actor);
    const previousScheduleStatus = contract.scheduleStatus as string | null;

    const updated = await this.db.getClient().contract.update({
      where: { id },
      data: { scheduleStatus: dto.scheduleStatus as ContractScheduleStatus },
      select: CONTRACT_SELECT,
    });

    await this.db.getClient().contractActivity.create({
      data: {
        contractId: id,
        actorUserId: actor.id,
        actorName: actor.displayName,
        event: 'schedule_status_updated',
        metadata: { previousScheduleStatus, newScheduleStatus: dto.scheduleStatus },
      },
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

      await tx.securityAuditEvent.create({
        data: {
          event: 'CONTRACT_ACTIVATED',
          userId: refreshed.ownerUserId as string,
          actorId: actor.id,
          metadata: {
            contractId: id,
            referenceNumber: refreshed.referenceNumber,
            previousStatus: ContractStatus.DRAFT,
            newStatus: ContractStatus.ACTIVE,
            departmentId: refreshed.departmentId as string | null,
          },
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

      await tx.securityAuditEvent.create({
        data: {
          event: 'CONTRACT_TERMINATED',
          userId: refreshed.ownerUserId as string,
          actorId: actor.id,
          metadata: {
            contractId: id,
            referenceNumber: refreshed.referenceNumber,
            previousStatus: ContractStatus.ACTIVE,
            newStatus: ContractStatus.TERMINATED,
            departmentId: refreshed.departmentId as string | null,
            reason: dto.reason,
          },
        },
      });

      return refreshed;
    });

    return withLifecycle(updated as ContractRecord);
  }

  // ---------------------------------------------------------------------------
  // CM-69A — Cancel/Void: DRAFT | ACTIVE → CANCELLED. Safe alternative to hard
  // deletion — never removes the contract row or any related record (BOQ,
  // workflow tasks, payments, documents, issues, claims, risks, schedule
  // items, closeout requests, attachments, activity log all remain, exactly
  // as every child relation's onDelete: Restrict already guarantees). A
  // cancelled contract keeps full audit history and is only ever hidden from
  // "active" counts/lists, never deleted.
  // ---------------------------------------------------------------------------

  async cancel(id: string, dto: CancelContractDto, actor: AuthUser): Promise<ContractWithLifecycle> {
    if (!actor.permissions.includes('contracts.update') && !actor.permissions.includes('contracts.manage')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update or contracts.manage' });
    }

    // Department scope enforced explicitly here (unlike activate/terminate,
    // which rely on permission alone) since cancellation is meant to be
    // reachable by ordinary department-scoped managers, not just holders of
    // a narrow lifecycle-transition permission.
    const current = await this.findOneOrThrow(id, actor);
    if (current.status !== ContractStatus.DRAFT && current.status !== ContractStatus.ACTIVE) {
      throw new ConflictException({
        code: 'CONTRACT_NOT_CANCELLABLE',
        message: 'Only Draft or Active contracts can be cancelled',
      });
    }
    const previousStatus = current.status;

    const now = new Date();

    const updated = await this.db.getClient().$transaction(async (tx) => {
      const result = await tx.contract.updateMany({
        where: { id, status: previousStatus, version: dto.version },
        data: {
          status: ContractStatus.CANCELLED,
          cancelledAt: now,
          cancelledByUserId: actor.id,
          cancellationReason: dto.reason,
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
          event: 'cancelled',
          previousStatus,
          newStatus: ContractStatus.CANCELLED,
          metadata: { reason: dto.reason },
        },
      });

      await tx.securityAuditEvent.create({
        data: {
          event: 'CONTRACT_CANCELLED',
          userId: refreshed.ownerUserId as string,
          actorId: actor.id,
          metadata: {
            contractId: id,
            referenceNumber: refreshed.referenceNumber,
            previousStatus,
            newStatus: ContractStatus.CANCELLED,
            departmentId: refreshed.departmentId as string | null,
            reason: dto.reason,
          },
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

    const contract = await this.findOneOrThrow(id, actor);
    const currentStatus = contract.status as ContractStatus;

    if (currentStatus !== ContractStatus.ACTIVE && currentStatus !== ContractStatus.TERMINATED) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_INVALID_TRANSITION',
        message: `Cannot close a contract with status ${String(currentStatus)}`,
      });
    }

    // CM-33: a contract may only be closed once its closeout request has been
    // APPROVED — this protects the pre-existing direct close action from
    // bypassing the review flow. The normal path is now
    // ContractCloseoutService.closeContract(), which closes the contract and
    // the approved request together in one transaction; this endpoint stays
    // as a defensive backstop against any other caller.
    const approvedRequest = await this.db.getClient().contractCloseoutRequest.findFirst({
      where: { contractId: id, status: 'APPROVED' },
      select: { id: true },
    });
    if (!approvedRequest) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_CLOSEOUT_APPROVAL_REQUIRED',
        message: 'Closure approval is required before closing this contract.',
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

      await tx.securityAuditEvent.create({
        data: {
          event: 'CONTRACT_CLOSED',
          userId: refreshed.ownerUserId as string,
          actorId: actor.id,
          metadata: {
            contractId: id,
            referenceNumber: refreshed.referenceNumber,
            previousStatus: currentStatus,
            newStatus: ContractStatus.CLOSED,
            departmentId: refreshed.departmentId as string | null,
          },
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

    const contract = await this.findOneOrThrow(id, actor);
    return withLifecycle(contract);
  }

  // ---------------------------------------------------------------------------
  // Find all (paginated + filtered)
  // ---------------------------------------------------------------------------

  async findAll(
    query: ContractListQueryDto,
    actor: AuthUser,
  ): Promise<PaginatedResult<ContractListItem>> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const where: Record<string, unknown> = { ...buildListWhere(query) };
    if (deptFilter !== null) {
      where['departmentId'] = deptFilter;
    }

    const [items, total] = await Promise.all([
      this.db.getClient().contract.findMany({
        where,
        select: CONTRACT_LIST_SELECT,
        orderBy: [{ createdAt: 'desc' }, { referenceNumber: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().contract.count({ where }),
    ]);

    return {
      items: (items as ContractListRecord[]).map(toListItem),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ---------------------------------------------------------------------------
  // Summary metrics
  // ---------------------------------------------------------------------------

  // CM-69I — the Contract List KPI cards must always agree with the table
  // below them: this now takes the SAME ContractListQueryDto the table's
  // findAll() takes, resolves it through the SAME buildListWhere() (so
  // search/lifecycleStatus/status/scheduleStatus/contractType/ownerUserId/
  // daysRemaining — including CM-69C's default-excludes-CANCELLED and
  // explicit lifecycleStatus=ALL bypass — all apply identically), and
  // combines department scope via the exact same pattern findAll() uses.
  // Previously this counted every status bucket globally (deptWhere only),
  // which is why cancelled/filtered-out contracts still inflated "Total
  // Contracts"/"Total Contract Value" while the table itself already hid
  // them (CM-69C). "Active Contracts" is the count WITHIN the current
  // filtered scope that is additionally ACTIVE (via a real Prisma `AND`,
  // never a `{...where, status: ACTIVE}` object-spread — that would
  // silently clobber an explicit lifecycleStatus=DRAFT/CLOSED/etc. filter's
  // own `status` condition instead of correctly returning 0 for it).
  async getSummary(actor: AuthUser, query: ContractListQueryDto = {}): Promise<{
    totalContracts: number;
    activeContracts: number;
    totalContractValue: string;
    totalOpenClaims: number;
  }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const where: Record<string, unknown> = { ...buildListWhere(query) };
    if (deptFilter !== null) {
      where['departmentId'] = deptFilter;
    }

    const [totalContracts, activeContracts, valueAggregate, totalOpenClaims] = await Promise.all([
      this.db.getClient().contract.count({ where }),
      this.db.getClient().contract.count({ where: { AND: [where, { status: ContractStatus.ACTIVE }] } }),
      // CM-55 — Contract List KPI "Total Contract Value". Real sum of every
      // in-scope (now filter-matching, not just department-matching) contract's
      // current value.
      this.db.getClient().contract.aggregate({ where, _sum: { contractValue: true } }),
      // CM-55 — Contract List KPI "Open Claims". Same "not a final status"
      // definition as computeClaimSummary/contract-dashboard.service.ts, now
      // scoped to the same filtered contract set as everything else here.
      this.db.getClient().contractClaim.count({
        where: { status: { notIn: FINAL_CLAIM_STATUSES_FOR_LIST }, contract: where },
      }),
    ]);

    return {
      totalContracts,
      activeContracts,
      totalContractValue: (toNum(valueAggregate._sum.contractValue) ?? 0).toFixed(3),
      totalOpenClaims,
    };
  }

  async getDashboard(actor: AuthUser): Promise<{
    scope: { type: DepartmentAccessScope; departmentNames: string[] };
    metrics: {
      totalDraft: number;
      totalActive: number;
      totalExpiring: number;
      totalExpired: number;
      totalTerminated: number;
      totalClosed: number;
      totalCancelled: number;
    };
    recent: { id: string; referenceNumber: string; title: string; status: string; updatedAt: string }[];
  }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const [scopeType, deptFilter] = await Promise.all([
      this.deptAccess.getScope(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT),
      this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT),
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

    const today = utcToday();
    const deptWhere = deptFilter !== null ? { departmentId: deptFilter } : {};

    const [
      totalDraft,
      totalActive,
      totalExpiring,
      totalExpired,
      totalTerminated,
      totalClosed,
      totalCancelled,
      recentRaw,
    ] = await Promise.all([
      this.db.getClient().contract.count({ where: { ...deptWhere, status: ContractStatus.DRAFT } }),
      this.db.getClient().contract.count({ where: { ...deptWhere, status: ContractStatus.ACTIVE } }),
      this.db.getClient().contract.count({
        where: {
          ...deptWhere,
          status: ContractStatus.ACTIVE,
          renewalNoticeDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
      }),
      this.db.getClient().contract.count({
        where: { ...deptWhere, status: ContractStatus.ACTIVE, endDate: { lt: today } },
      }),
      this.db.getClient().contract.count({ where: { ...deptWhere, status: ContractStatus.TERMINATED } }),
      this.db.getClient().contract.count({ where: { ...deptWhere, status: ContractStatus.CLOSED } }),
      this.db.getClient().contract.count({ where: { ...deptWhere, status: ContractStatus.CANCELLED } }),
      this.db.getClient().contract.findMany({
        where: { ...deptWhere },
        take: 8,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, referenceNumber: true, title: true, status: true, updatedAt: true },
      }),
    ]);

    return {
      scope: { type: scopeType, departmentNames },
      metrics: { totalDraft, totalActive, totalExpiring, totalExpired, totalTerminated, totalClosed, totalCancelled },
      recent: recentRaw.map((r) => ({
        id: r.id,
        referenceNumber: r.referenceNumber,
        title: r.title,
        status: r.status as string,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  async addComment(id: string, dto: AddCommentDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.comment')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.comment' });
    }

    const contract = await this.findOneOrThrow(id, actor);

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

      await tx.securityAuditEvent.create({
        data: {
          event: 'CONTRACT_COMMENT_ADDED',
          userId: contract.ownerUserId as string,
          actorId: actor.id,
          metadata: {
            contractId: id,
            referenceNumber: contract.referenceNumber,
            departmentId: contract.departmentId as string | null,
          },
        },
      });

      return comment;
    });
  }

  async listComments(id: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    await this.findOneOrThrow(id, actor);

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

    await this.findOneOrThrow(id, actor);

    // CM-66 — newest first, matching the Activity / Audit History tab's own
    // "Date & Time sorted newest first" requirement. This is the only real
    // consumer of listActivities(), so the order change is safe.
    return this.db.getClient().contractActivity.findMany({
      where: { contractId: id },
      orderBy: [{ createdAt: 'desc' }],
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

  private async findOneOrThrow(id: string, actor?: AuthUser): Promise<ContractRecord> {
    const contract = await this.db.getClient().contract.findUnique({
      where: { id },
      select: CONTRACT_SELECT,
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    if (actor) {
      await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId as string | null);
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

// CM-55 — matches computeEffectiveScheduleStatus's own default rule exactly:
// IN_PROGRESS/COMPLETED also match contracts whose scheduleStatus is still
// NULL but would display as that value (see the function above). The other
// 3 values (ON_TRACK/DELAYED/AHEAD_OF_SCHEDULE) are never a computed
// default, so they only ever match an explicit stored value.
function buildScheduleStatusCondition(value: string): Record<string, unknown> {
  if (value === 'IN_PROGRESS') {
    return { OR: [{ scheduleStatus: 'IN_PROGRESS' }, { AND: [{ scheduleStatus: null }, { status: { not: ContractStatus.CLOSED } }] }] };
  }
  if (value === 'COMPLETED') {
    return { OR: [{ scheduleStatus: 'COMPLETED' }, { AND: [{ scheduleStatus: null }, { status: ContractStatus.CLOSED }] }] };
  }
  return { scheduleStatus: value };
}

// CM-55 — "days remaining" is computed from forecastCompletionDate, falling
// back to endDate only when forecastCompletionDate is unset — same fallback
// order the Contract List's own Days Remaining column uses.
function buildDaysRemainingCondition(value: string, today: Date): Record<string, unknown> {
  const addDays = (days: number): Date => new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  if (value === 'OVERDUE') {
    return {
      OR: [
        { forecastCompletionDate: { lt: today } },
        { AND: [{ forecastCompletionDate: null }, { endDate: { lt: today } }] },
      ],
    };
  }

  const windowEnd = addDays(value === 'DUE_60' ? 60 : 30);
  return {
    OR: [
      { forecastCompletionDate: { gte: today, lte: windowEnd } },
      { AND: [{ forecastCompletionDate: null }, { endDate: { gte: today, lte: windowEnd } }] },
    ],
  };
}

export function buildListWhere(query: ContractListQueryDto): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));

  // CM-69C — 'ALL' (either param) is an explicit, deliberate request to see
  // every real status including CANCELLED, for audit — bypasses every branch
  // below, including the new default-excludes-CANCELLED one.
  const explicitAllStatuses = query.lifecycleStatus === 'ALL' || query.status === 'ALL';

  if (!explicitAllStatuses) {
    // Lifecycle status filter takes precedence over plain status filter
    if (query.lifecycleStatus) {
      switch (query.lifecycleStatus) {
        case 'EXPIRING':
          where['status'] = ContractStatus.ACTIVE;
          where['renewalNoticeDate'] = { lte: today };
          and.push({ OR: [{ endDate: null }, { endDate: { gte: today } }] });
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
        case 'CANCELLED':
          where['status'] = ContractStatus.CANCELLED;
          break;
      }
    } else if (query.status) {
      where['status'] = query.status;
    } else {
      // CM-69C — true default (no status/lifecycleStatus filter supplied at
      // all, e.g. a fresh page load): exclude CANCELLED so voided/test
      // contracts don't clutter the normal working list. Every other real
      // status (DRAFT/ACTIVE/TERMINATED/CLOSED) still shows, exactly as
      // before this unit — only CANCELLED changes from "always included" to
      // "hidden unless explicitly asked for".
      where['status'] = { not: ContractStatus.CANCELLED };
    }
  }

  if (query.ownerUserId) where['ownerUserId'] = query.ownerUserId;
  if (query.departmentId) where['departmentId'] = query.departmentId;
  if (query.plantId) where['plantId'] = query.plantId;

  // CM-55 — real scopeOfWork JSONB flag, not an invented "contract type" column.
  if (query.contractType) {
    where['scopeOfWork'] = { path: [query.contractType], equals: true };
  }

  if (query.scheduleStatus) and.push(buildScheduleStatusCondition(query.scheduleStatus));
  if (query.daysRemaining) and.push(buildDaysRemainingCondition(query.daysRemaining, today));

  if (query.search?.trim()) {
    const s = query.search.trim();
    and.push({
      OR: [
        { title: { contains: s, mode: 'insensitive' } },
        { referenceNumber: { contains: s, mode: 'insensitive' } },
        { jobOrder: { contains: s, mode: 'insensitive' } },
        { counterpartyName: { contains: s, mode: 'insensitive' } },
      ],
    });
  }

  if (and.length > 0) where['AND'] = and;
  return where;
}
