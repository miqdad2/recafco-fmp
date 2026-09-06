import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractPaymentDto } from './dto/create-contract-payment.dto';
import type { UpdateContractPaymentDto } from './dto/update-contract-payment.dto';
import type { ContractPaymentListQueryDto } from './dto/contract-payment-list-query.dto';
import { logContractActivity } from './contract-activity-log';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Prisma Decimal | number | null -> plain number | null, without importing the Decimal type directly. */
function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

// ---------------------------------------------------------------------------
// Derived values — never stored, always computed from the current row.
// outstandingAmount = certifiedAmount - paidAmount, or submittedAmount - paidAmount
// when certifiedAmount is null. null when neither certified nor submitted exists
// (nothing to be outstanding against).
// overdueDays = today - dueDate, only when not PAID/CANCELLED and dueDate has passed.
// ---------------------------------------------------------------------------

interface AmountFields {
  submittedAmount: unknown;
  certifiedAmount: unknown;
  paidAmount: unknown;
}

interface DueFields {
  dueDate: Date | null;
  status: string;
}

export function computeOutstandingAmount(row: AmountFields): number | null {
  const cap = toNum(row.certifiedAmount) ?? toNum(row.submittedAmount);
  if (cap === null) return null;
  const paid = toNum(row.paidAmount) ?? 0;
  return round3(cap - paid);
}

export function computeOverdueDays(row: DueFields, today: Date): number | null {
  if (row.status === 'PAID' || row.status === 'CANCELLED') return null;
  if (!row.dueDate) return null;
  const due = new Date(Date.UTC(row.dueDate.getUTCFullYear(), row.dueDate.getUTCMonth(), row.dueDate.getUTCDate()));
  if (due >= today) return null;
  return Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function withDerivedFields<T extends AmountFields & DueFields>(
  row: T,
  today: Date,
): T & { outstandingAmount: string | null; overdueDays: number | null } {
  const outstanding = computeOutstandingAmount(row);
  return {
    ...row,
    outstandingAmount: outstanding !== null ? outstanding.toFixed(3) : null,
    overdueDays: computeOverdueDays(row, today),
  };
}

// ---------------------------------------------------------------------------
// Cross-field amount validation — paidAmount can never exceed the effective
// cap (certifiedAmount if set, else submittedAmount). Applies to both create
// (dto values only) and update (existing values merged with dto overrides).
// ---------------------------------------------------------------------------

export function assertPaymentAmountsValid(effective: {
  submittedAmount?: number | null | undefined;
  certifiedAmount?: number | null | undefined;
  paidAmount?: number | null | undefined;
}): void {
  const cap = effective.certifiedAmount ?? effective.submittedAmount;
  if (
    effective.paidAmount !== undefined &&
    effective.paidAmount !== null &&
    cap !== undefined &&
    cap !== null &&
    effective.paidAmount > cap
  ) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_PAYMENT_PAID_EXCEEDS_CAP',
      message: 'Paid Amount cannot exceed the Certified Amount (or Submitted Amount if not yet certified).',
    });
  }
}

// ---------------------------------------------------------------------------
// List where builder (exported for tests) — payment-own filters only. The
// department scope filter and any explicit contract-level filters are
// combined in via a nested `contract: {...}` AND clause by findAll(), since
// they need the live dept-access scope which this pure function doesn't see.
// ---------------------------------------------------------------------------

export function buildPaymentListWhere(query: ContractPaymentListQueryDto, today: Date = utcToday()): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  if (query.contractId) where['contractId'] = query.contractId;

  if (query.status) and.push({ status: query.status });

  if (query.invoiceDateFrom || query.invoiceDateTo) {
    and.push({
      invoiceDate: {
        ...(query.invoiceDateFrom ? { gte: new Date(query.invoiceDateFrom) } : {}),
        ...(query.invoiceDateTo ? { lte: new Date(query.invoiceDateTo) } : {}),
      },
    });
  }

  if (query.dueDateFrom || query.dueDateTo) {
    and.push({
      dueDate: {
        ...(query.dueDateFrom ? { gte: new Date(query.dueDateFrom) } : {}),
        ...(query.dueDateTo ? { lte: new Date(query.dueDateTo) } : {}),
      },
    });
  }

  if (query.overdueOnly) {
    and.push({ dueDate: { lt: today } });
    if (!query.status) {
      and.push({ status: { notIn: ['PAID', 'CANCELLED'] } });
    }
  }

  const contractWhere: Record<string, unknown> = {};
  if (query.departmentId) contractWhere['departmentId'] = query.departmentId;
  if (query.ownerUserId) contractWhere['ownerUserId'] = query.ownerUserId;
  if (query.company?.trim()) {
    contractWhere['counterpartyName'] = { contains: query.company.trim(), mode: 'insensitive' };
  }
  if (Object.keys(contractWhere).length > 0) {
    and.push({ contract: contractWhere });
  }

  if (query.search?.trim()) {
    const s = query.search.trim();
    and.push({
      OR: [
        { paymentNo: { contains: s, mode: 'insensitive' } },
        { invoiceNumber: { contains: s, mode: 'insensitive' } },
        { contract: { referenceNumber: { contains: s, mode: 'insensitive' } } },
        { contract: { title: { contains: s, mode: 'insensitive' } } },
        // CM-58 — Contract Detail Payments tab's search box is labeled
        // "Search by payment no., invoice, remarks..."; remarks was
        // previously unsearchable even though it's already a real, stored
        // free-text field. Purely additive to the existing OR — no schema
        // change, same department-scope AND clause applies regardless.
        { remarks: { contains: s, mode: 'insensitive' } },
      ],
    });
  }

  if (and.length > 0) where['AND'] = and;
  return where;
}

export interface PaymentSummary {
  totalSubmitted: string;
  totalCertified: string;
  totalPaid: string;
  totalOutstanding: string;
  overdueCount: number;
  overdueValue: string;
}

export function computePaymentSummary(rows: AmountFields[] & DueFields[], today: Date = utcToday()): PaymentSummary {
  let totalSubmitted = 0;
  let totalCertified = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  let overdueCount = 0;
  let overdueValue = 0;

  for (const row of rows) {
    totalSubmitted += toNum(row.submittedAmount) ?? 0;
    totalCertified += toNum(row.certifiedAmount) ?? 0;
    totalPaid += toNum(row.paidAmount) ?? 0;
    const outstanding = computeOutstandingAmount(row) ?? 0;
    totalOutstanding += outstanding;
    const overdueDays = computeOverdueDays(row, today);
    if (overdueDays !== null && overdueDays > 0) {
      overdueCount += 1;
      overdueValue += outstanding;
    }
  }

  return {
    totalSubmitted: round3(totalSubmitted).toFixed(3),
    totalCertified: round3(totalCertified).toFixed(3),
    totalPaid: round3(totalPaid).toFixed(3),
    totalOutstanding: round3(totalOutstanding).toFixed(3),
    overdueCount,
    overdueValue: round3(overdueValue).toFixed(3),
  };
}

// ---------------------------------------------------------------------------
// Prisma select shape
// ---------------------------------------------------------------------------

const PAYMENT_SELECT = {
  id: true,
  contractId: true,
  paymentNo: true,
  invoiceNumber: true,
  invoiceDate: true,
  paymentTerm: true,
  submittedAmount: true,
  certifiedAmount: true,
  paidAmount: true,
  dueDate: true,
  paidDate: true,
  status: true,
  remarks: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: { select: { id: true, displayName: true } },
  updatedByUser: { select: { id: true, displayName: true } },
  contract: {
    select: {
      id: true,
      referenceNumber: true,
      title: true,
      counterpartyName: true,
      contractValue: true,
      currency: true,
      ownerUser: { select: { id: true, displayName: true } },
      department: { select: { id: true, name: true } },
    },
  },
} as const;

const SUMMARY_SELECT = {
  submittedAmount: true,
  certifiedAmount: true,
  paidAmount: true,
  dueDate: true,
  status: true,
} as const;

export interface PaginatedPaymentResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: PaymentSummary;
}

@Injectable()
export class ContractPaymentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  // ---------------------------------------------------------------------------
  // List (paginated + filtered), scoped by department access, with summary
  // totals computed across the FULL filtered set (not just the current page).
  // ---------------------------------------------------------------------------

  async findAll(query: ContractPaymentListQueryDto, actor: AuthUser): Promise<PaginatedPaymentResult<unknown>> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const today = utcToday();

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const where = buildPaymentListWhere(query, today);
    if (deptFilter !== null) {
      const and = (where['AND'] as Record<string, unknown>[] | undefined) ?? [];
      and.push({ contract: { departmentId: deptFilter } });
      where['AND'] = and;
    }

    const [items, total, summaryRows] = await Promise.all([
      this.db.getClient().contractPayment.findMany({
        where,
        select: PAYMENT_SELECT,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.db.getClient().contractPayment.count({ where }),
      this.db.getClient().contractPayment.findMany({ where, select: SUMMARY_SELECT }),
    ]);

    return {
      items: items.map((p) => withDerivedFields(p, today)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary: computePaymentSummary(summaryRows as unknown as (AmountFields & DueFields)[], today),
    };
  }

  // ---------------------------------------------------------------------------
  // Create — payment always belongs to an existing contract (contractId comes
  // from the route, POST /contracts/:id/payments).
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractPaymentDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);

    assertPaymentAmountsValid({
      submittedAmount: dto.submittedAmount,
      certifiedAmount: dto.certifiedAmount,
      paidAmount: dto.paidAmount,
    });

    if (dto.paymentNo) {
      const existing = await this.db.getClient().contractPayment.findUnique({
        where: { contractId_paymentNo: { contractId, paymentNo: dto.paymentNo } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'CONTRACT_PAYMENT_NO_DUPLICATE',
          message: `Payment No. "${dto.paymentNo}" already exists for this contract.`,
        });
      }
    }

    const created = await this.db.getClient().contractPayment.create({
      data: {
        contractId,
        createdByUserId: actor.id,
        ...(dto.paymentNo !== undefined ? { paymentNo: dto.paymentNo } : {}),
        ...(dto.invoiceNumber !== undefined ? { invoiceNumber: dto.invoiceNumber } : {}),
        ...(dto.invoiceDate !== undefined ? { invoiceDate: new Date(dto.invoiceDate) } : {}),
        ...(dto.paymentTerm !== undefined ? { paymentTerm: dto.paymentTerm } : {}),
        ...(dto.submittedAmount !== undefined ? { submittedAmount: dto.submittedAmount } : {}),
        ...(dto.certifiedAmount !== undefined ? { certifiedAmount: dto.certifiedAmount } : {}),
        ...(dto.paidAmount !== undefined ? { paidAmount: dto.paidAmount } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.paidDate !== undefined ? { paidDate: new Date(dto.paidDate) } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: PAYMENT_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'payment_created', {
      paymentId: created.id,
      paymentNo: created.paymentNo ?? null,
    });

    return withDerivedFields(created, utcToday());
  }

  // ---------------------------------------------------------------------------
  // Update — includes cancellation (status = CANCELLED). No hard delete.
  // ---------------------------------------------------------------------------

  async update(paymentId: string, dto: UpdateContractPaymentDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const existing = await this.db.getClient().contractPayment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        contractId: true,
        paymentNo: true,
        submittedAmount: true,
        certifiedAmount: true,
        paidAmount: true,
        contract: { select: { departmentId: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'CONTRACT_PAYMENT_NOT_FOUND', message: 'Payment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      existing.contract.departmentId,
    );

    assertPaymentAmountsValid({
      submittedAmount: dto.submittedAmount ?? toNum(existing.submittedAmount),
      certifiedAmount: dto.certifiedAmount ?? toNum(existing.certifiedAmount),
      paidAmount: dto.paidAmount ?? toNum(existing.paidAmount),
    });

    if (dto.paymentNo !== undefined && dto.paymentNo !== existing.paymentNo && dto.paymentNo !== '') {
      const duplicate = await this.db.getClient().contractPayment.findUnique({
        where: { contractId_paymentNo: { contractId: existing.contractId, paymentNo: dto.paymentNo } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'CONTRACT_PAYMENT_NO_DUPLICATE',
          message: `Payment No. "${dto.paymentNo}" already exists for this contract.`,
        });
      }
    }

    const updated = await this.db.getClient().contractPayment.update({
      where: { id: paymentId },
      data: {
        updatedByUserId: actor.id,
        ...(dto.paymentNo !== undefined ? { paymentNo: dto.paymentNo } : {}),
        ...(dto.invoiceNumber !== undefined ? { invoiceNumber: dto.invoiceNumber } : {}),
        ...(dto.invoiceDate !== undefined ? { invoiceDate: new Date(dto.invoiceDate) } : {}),
        ...(dto.paymentTerm !== undefined ? { paymentTerm: dto.paymentTerm } : {}),
        ...(dto.submittedAmount !== undefined ? { submittedAmount: dto.submittedAmount } : {}),
        ...(dto.certifiedAmount !== undefined ? { certifiedAmount: dto.certifiedAmount } : {}),
        ...(dto.paidAmount !== undefined ? { paidAmount: dto.paidAmount } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.paidDate !== undefined ? { paidDate: new Date(dto.paidDate) } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: PAYMENT_SELECT,
    });

    await logContractActivity(this.db, existing.contractId, actor, 'payment_updated', {
      paymentId: updated.id,
      paymentNo: updated.paymentNo ?? null,
    });

    return withDerivedFields(updated, utcToday());
  }
}
