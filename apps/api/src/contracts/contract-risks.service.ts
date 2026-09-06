import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { CreateContractRiskDto } from './dto/create-contract-risk.dto';
import type { UpdateContractRiskDto } from './dto/update-contract-risk.dto';
import { logContractActivity } from './contract-activity-log';

// ---------------------------------------------------------------------------
// CM-62 — Contract Risk Assessment. Deliberately NOT an ISO risk-scoring
// system: riskEvaluation (initial level before response) and residualRisk
// (expected level after the response action) are both plain manual
// dropdown values, set only by a manager — never auto-calculated from one
// another or from riskResponse. The only numeric computation anywhere in
// this service is the documented Low=1/Medium=2/High=3/Critical=4 mapping
// used SOLELY to average residualRisk values for the "Average Residual
// Risk" KPI display — never stored, never fed back into any risk record,
// and explicitly excluded when no risk has a residualRisk set at all
// (returns null rather than a fabricated "Low").
// ---------------------------------------------------------------------------

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** A risk that has reached a concluded state no longer needs response-action attention. */
const RESOLVED_STATUSES = ['MITIGATED', 'CLOSED', 'CANCELLED'];
const HIGH_CRITICAL_LEVELS = ['HIGH', 'CRITICAL'];

/**
 * Documented numeric mapping used ONLY to average residualRisk for display —
 * see this file's own header comment. Never stored, never written back to
 * any ContractRisk row.
 */
const RESIDUAL_RISK_NUMERIC: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const NUMERIC_TO_RESIDUAL_RISK_LABEL: Record<number, string> = { 1: 'LOW', 2: 'MEDIUM', 3: 'HIGH', 4: 'CRITICAL' };

interface DueDateFields {
  actionDueDate: Date | null;
}

/**
 * Signed days until actionDueDate (negative once past due); null only when
 * actionDueDate itself is unset — never a fabricated number, never gated by
 * status (mirrors computeClaimDaysToDeadline()'s own design in
 * contract-claims.service.ts).
 */
export function computeRiskDaysToDeadline(row: DueDateFields, today: Date = utcToday()): number | null {
  if (!row.actionDueDate) return null;
  const due = new Date(Date.UTC(row.actionDueDate.getUTCFullYear(), row.actionDueDate.getUTCMonth(), row.actionDueDate.getUTCDate()));
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export interface RiskDueSoonFields extends DueDateFields {
  status: string;
}

/** A real actionDueDate within the next 30 days (inclusive), on a not-yet-resolved risk. Never true for a risk with no due date. */
export function computeRiskIsDueSoon(row: RiskDueSoonFields, today: Date = utcToday()): boolean {
  if (RESOLVED_STATUSES.includes(row.status)) return false;
  const days = computeRiskDaysToDeadline(row, today);
  return days !== null && days >= 0 && days <= 30;
}

function withDerivedFields<T extends DueDateFields>(row: T, today: Date): T & { daysToDeadline: number | null } {
  return { ...row, daysToDeadline: computeRiskDaysToDeadline(row, today) };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface RiskSummaryRow {
  riskEvaluation: string;
  residualRisk: string | null;
  status: string;
  actionDueDate: Date | null;
}

export interface RiskSummary {
  totalRisks: number;
  highCriticalRisks: number;
  openRisks: number;
  mitigatedRisks: number;
  /** Nearest label for the average of every real (non-null) residualRisk value — null when no risk has one set (never fabricated). */
  averageResidualRisk: string | null;
  risksDueSoon: number;
}

export function computeRiskSummary(rows: RiskSummaryRow[], today: Date = utcToday()): RiskSummary {
  let highCriticalRisks = 0;
  let openRisks = 0;
  let mitigatedRisks = 0;
  let risksDueSoon = 0;
  const residualNumericValues: number[] = [];

  for (const row of rows) {
    if (HIGH_CRITICAL_LEVELS.includes(row.riskEvaluation)) highCriticalRisks += 1;
    if (!RESOLVED_STATUSES.includes(row.status)) openRisks += 1;
    if (row.status === 'MITIGATED') mitigatedRisks += 1;
    if (computeRiskIsDueSoon(row, today)) risksDueSoon += 1;
    if (row.residualRisk) {
      const numeric = RESIDUAL_RISK_NUMERIC[row.residualRisk];
      if (numeric !== undefined) residualNumericValues.push(numeric);
    }
  }

  let averageResidualRisk: string | null = null;
  if (residualNumericValues.length > 0) {
    const avg = residualNumericValues.reduce((sum, n) => sum + n, 0) / residualNumericValues.length;
    const rounded = Math.min(4, Math.max(1, Math.round(avg)));
    averageResidualRisk = NUMERIC_TO_RESIDUAL_RISK_LABEL[rounded] ?? null;
  }

  return {
    totalRisks: rows.length,
    highCriticalRisks,
    openRisks,
    mitigatedRisks,
    averageResidualRisk,
    risksDueSoon,
  };
}

// ---------------------------------------------------------------------------
// Prisma select shape
// ---------------------------------------------------------------------------

const RISK_SELECT = {
  id: true,
  contractId: true,
  riskNo: true,
  description: true,
  riskEvaluation: true,
  riskResponse: true,
  riskResponseDescription: true,
  residualRisk: true,
  status: true,
  responsibleUserId: true,
  responsibleUser: { select: { id: true, displayName: true } },
  actionDueDate: true,
  remarks: true,
  createdByUser: { select: { id: true, displayName: true } },
  updatedByUser: { select: { id: true, displayName: true } },
  createdAt: true,
  updatedAt: true,
} as const;

const SUMMARY_SELECT = {
  riskEvaluation: true,
  residualRisk: true,
  status: true,
  actionDueDate: true,
} as const;

export interface ContractRiskDetail {
  items: unknown[];
  summary: RiskSummary;
}

@Injectable()
export class ContractRisksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  // ---------------------------------------------------------------------------
  // List — all risks for one contract, unpaginated (bounded, contract-scoped,
  // same pattern as :id/schedule, :id/production, :id/variations).
  // ---------------------------------------------------------------------------

  async findAllForContract(contractId: string, actor: AuthUser): Promise<ContractRiskDetail> {
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

    const today = utcToday();
    const [items, summaryRows] = await Promise.all([
      this.db.getClient().contractRisk.findMany({
        where: { contractId },
        select: RISK_SELECT,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.db.getClient().contractRisk.findMany({ where: { contractId }, select: SUMMARY_SELECT }),
    ]);

    return {
      items: items.map((r) => withDerivedFields(r, today)),
      summary: computeRiskSummary(summaryRows as unknown as RiskSummaryRow[], today),
    };
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(contractId: string, dto: CreateContractRiskDto, actor: AuthUser): Promise<unknown> {
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

    if (dto.responsibleUserId !== undefined) {
      const user = await this.db.getClient().user.findUnique({ where: { id: dto.responsibleUserId }, select: { id: true } });
      if (!user) {
        throw new NotFoundException({ code: 'CONTRACT_RISK_INVALID_RESPONSIBLE', message: 'responsibleUserId does not refer to a valid user.' });
      }
    }

    if (dto.riskNo) {
      const existing = await this.db.getClient().contractRisk.findUnique({
        where: { contractId_riskNo: { contractId, riskNo: dto.riskNo } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'CONTRACT_RISK_NO_DUPLICATE',
          message: `Risk ID "${dto.riskNo}" already exists for this contract.`,
        });
      }
    }

    const created = await this.db.getClient().contractRisk.create({
      data: {
        contractId,
        createdByUserId: actor.id,
        description: dto.description,
        ...(dto.riskNo !== undefined ? { riskNo: dto.riskNo } : {}),
        ...(dto.riskEvaluation !== undefined ? { riskEvaluation: dto.riskEvaluation as never } : {}),
        ...(dto.riskResponse !== undefined ? { riskResponse: dto.riskResponse as never } : {}),
        ...(dto.riskResponseDescription !== undefined ? { riskResponseDescription: dto.riskResponseDescription } : {}),
        ...(dto.residualRisk !== undefined ? { residualRisk: dto.residualRisk as never } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.responsibleUserId !== undefined ? { responsibleUserId: dto.responsibleUserId } : {}),
        ...(dto.actionDueDate !== undefined ? { actionDueDate: new Date(dto.actionDueDate) } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: RISK_SELECT,
    });

    await logContractActivity(this.db, contractId, actor, 'risk_created', {
      riskId: created.id,
      riskNo: created.riskNo ?? null,
    });

    return withDerivedFields(created, utcToday());
  }

  // ---------------------------------------------------------------------------
  // Update — no hard delete.
  // ---------------------------------------------------------------------------

  async update(riskId: string, dto: UpdateContractRiskDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const existing = await this.db.getClient().contractRisk.findUnique({
      where: { id: riskId },
      select: { id: true, contractId: true, riskNo: true, contract: { select: { departmentId: true } } },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'CONTRACT_RISK_NOT_FOUND', message: 'Risk not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, existing.contract.departmentId);

    if (dto.responsibleUserId !== undefined) {
      const user = await this.db.getClient().user.findUnique({ where: { id: dto.responsibleUserId }, select: { id: true } });
      if (!user) {
        throw new NotFoundException({ code: 'CONTRACT_RISK_INVALID_RESPONSIBLE', message: 'responsibleUserId does not refer to a valid user.' });
      }
    }

    if (dto.riskNo !== undefined && dto.riskNo !== existing.riskNo && dto.riskNo !== '') {
      const duplicate = await this.db.getClient().contractRisk.findUnique({
        where: { contractId_riskNo: { contractId: existing.contractId, riskNo: dto.riskNo } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'CONTRACT_RISK_NO_DUPLICATE',
          message: `Risk ID "${dto.riskNo}" already exists for this contract.`,
        });
      }
    }

    const updated = await this.db.getClient().contractRisk.update({
      where: { id: riskId },
      data: {
        updatedByUserId: actor.id,
        ...(dto.riskNo !== undefined ? { riskNo: dto.riskNo } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.riskEvaluation !== undefined ? { riskEvaluation: dto.riskEvaluation as never } : {}),
        ...(dto.riskResponse !== undefined ? { riskResponse: dto.riskResponse as never } : {}),
        ...(dto.riskResponseDescription !== undefined ? { riskResponseDescription: dto.riskResponseDescription } : {}),
        ...(dto.residualRisk !== undefined ? { residualRisk: dto.residualRisk as never } : {}),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.responsibleUserId !== undefined ? { responsibleUserId: dto.responsibleUserId } : {}),
        ...(dto.actionDueDate !== undefined ? { actionDueDate: new Date(dto.actionDueDate) } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      },
      select: RISK_SELECT,
    });

    await logContractActivity(this.db, existing.contractId, actor, 'risk_updated', {
      riskId: updated.id,
      riskNo: updated.riskNo ?? null,
    });

    return withDerivedFields(updated, utcToday());
  }
}
