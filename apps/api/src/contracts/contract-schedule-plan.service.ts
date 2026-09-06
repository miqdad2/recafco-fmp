import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { logContractActivity } from './contract-activity-log';
import { computeTotalQty } from './contract-boq-production.service';
import type { AuthUser } from '../common/types/auth-user';
import type { UpdateContractSchedulePlanDto } from './dto/update-contract-schedule-plan.dto';

// ---------------------------------------------------------------------------
// CM-68A — Contract Schedule Detail: real Planned vs Actual. Planned entries
// live in ContractScheduleItem (additive, this unit). Actual values are
// NEVER stored — always derived live from real workflow/payment/production/
// closeout records, per this unit's own "do not fake actual dates" rule.
// ---------------------------------------------------------------------------

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export const SCHEDULE_STAGE_KEYS = [
  'CONTRACT_SIGN',
  'ADVANCE_PAYMENT',
  'DRAWING_APPROVAL',
  'ESTIMATION_SHEET',
  'CASTING_PRODUCTION',
  'DELIVERY',
  'ERECTION',
  'FINAL_CLOSEOUT',
] as const;

export type ScheduleStageKey = (typeof SCHEDULE_STAGE_KEYS)[number];

export const DEFAULT_STAGE_NAMES: Record<ScheduleStageKey, string> = {
  CONTRACT_SIGN: 'Contract Sign',
  ADVANCE_PAYMENT: 'Advance Payment Received',
  DRAWING_APPROVAL: 'Drawing Approval',
  ESTIMATION_SHEET: 'Estimation Sheet',
  CASTING_PRODUCTION: 'Casting / Production',
  DELIVERY: 'Delivery',
  ERECTION: 'Erection',
  FINAL_CLOSEOUT: 'Final Closeout',
};

export const DEFAULT_STAGE_SORT_ORDER: Record<ScheduleStageKey, number> = {
  CONTRACT_SIGN: 1,
  ADVANCE_PAYMENT: 2,
  DRAWING_APPROVAL: 3,
  ESTIMATION_SHEET: 4,
  CASTING_PRODUCTION: 5,
  DELIVERY: 6,
  ERECTION: 7,
  FINAL_CLOSEOUT: 8,
};

// ---------------------------------------------------------------------------
// Actual derivation — real data only. Every source mapping below is cited
// in-line; a stage with no safely identifiable real source honestly returns
// null dates and a "Not linked yet" / "Not available" source, never a
// guessed value. Real workflow taskKeys come from
// contract-workflow-templates.ts's fixed template list (the actual,
// non-editable task set every contract gets) — these are matched exactly,
// never fuzzy-matched by task name.
// ---------------------------------------------------------------------------

export interface ActualStageData {
  stageKey: ScheduleStageKey;
  actualStartDate: string | null;
  actualEndDate: string | null;
  producedQuantity: number | null;
  moldsProduced: number | null;
  source: string;
}

interface WorkflowTaskRow {
  taskKey: string;
  startDate: Date | null;
  completedDate: Date | null;
}

interface PaidPaymentRow {
  paidDate: Date | null;
}

interface ProductionSummaryRow {
  totalQty: number;
  producedQty: number;
  remainingToCast: number;
}

export interface ComputeActualStagesInput {
  contract: { contractDate: Date | null; activatedAt: Date | null; status: string; closedAt: Date | null };
  workflowTasks: WorkflowTaskRow[];
  paidPayments: PaidPaymentRow[];
  productionSummary: ProductionSummaryRow | null;
  allProductionComplete: boolean;
  /** Only meaningful when allProductionComplete is true — the latest real updatedAt among fully-completed production status rows, used as the disclosed "last production update" fallback for the actual end date. */
  productionCompletedMaxUpdatedAt: Date | null;
}

export function computeActualStages(input: ComputeActualStagesInput): ActualStageData[] {
  const task = (key: string): WorkflowTaskRow | null => input.workflowTasks.find((t) => t.taskKey === key) ?? null;

  const results: ActualStageData[] = [];

  // 1. Contract Sign — real contract.contractDate first, real contract.activatedAt as fallback.
  {
    const date = input.contract.contractDate ?? input.contract.activatedAt ?? null;
    results.push({
      stageKey: 'CONTRACT_SIGN',
      actualStartDate: isoDate(date),
      actualEndDate: isoDate(date),
      producedQuantity: null,
      moldsProduced: null,
      source: input.contract.contractDate ? 'Contract' : input.contract.activatedAt ? 'Contract (activated)' : 'Not available',
    });
  }

  // 2. Advance Payment Received — no real "advance" payment-type field exists
  // (paymentTerm is free text, not a safely-parseable category). Per this
  // unit's own explicit fallback: the first real PAID payment by paidDate,
  // clearly labeled as such rather than claimed to be "the advance".
  {
    const sorted = [...input.paidPayments]
      .filter((p): p is { paidDate: Date } => p.paidDate !== null)
      .sort((a, b) => a.paidDate.getTime() - b.paidDate.getTime());
    const first = sorted[0] ?? null;
    results.push({
      stageKey: 'ADVANCE_PAYMENT',
      actualStartDate: isoDate(first?.paidDate ?? null),
      actualEndDate: isoDate(first?.paidDate ?? null),
      producedQuantity: null,
      moldsProduced: null,
      source: first ? 'Payments (first received)' : 'Not available',
    });
  }

  // 3. Drawing Approval — real TECHNICAL task "Getting Approval"
  // (taskKey technical_getting_approval, from the fixed workflow template).
  {
    const t = task('technical_getting_approval');
    results.push({
      stageKey: 'DRAWING_APPROVAL',
      actualStartDate: isoDate(t?.startDate ?? null),
      actualEndDate: isoDate(t?.completedDate ?? null),
      producedQuantity: null,
      moldsProduced: null,
      source: t ? 'Workflow (Technical)' : 'Not linked yet',
    });
  }

  // 4. Estimation Sheet — no real workflow task safely matches "estimation"
  // anywhere in the fixed template list (TECHNICAL/PRODUCTION/ERECTION/
  // QS_COMMERCIAL). Honestly not linked — never fuzzy-guessed.
  {
    results.push({
      stageKey: 'ESTIMATION_SHEET',
      actualStartDate: null,
      actualEndDate: null,
      producedQuantity: null,
      moldsProduced: null,
      source: 'Not linked yet',
    });
  }

  // 5. Casting / Production — real PRODUCTION task "Production Start"
  // (production_start) for the start signal; real BOQ production-status
  // aggregation for produced quantity. The end date is only ever set when
  // EVERY real BOQ item's production status is genuinely COMPLETED, using
  // the latest real updatedAt among them as a disclosed "last production
  // update" fallback (explicitly documented here, not a guess from
  // createdAt). No real per-mold count field exists anywhere in this app —
  // moldsProduced is always null (shown as "—" by the frontend).
  {
    const startTask = task('production_start');
    const actualEnd = input.allProductionComplete ? input.productionCompletedMaxUpdatedAt : null;
    const produced = input.productionSummary ? input.productionSummary.producedQty : null;
    let source = 'Not available';
    if (input.productionSummary && input.productionSummary.totalQty > 0) source = 'Production Status';
    else if (startTask) source = 'Workflow (Production)';
    results.push({
      stageKey: 'CASTING_PRODUCTION',
      actualStartDate: isoDate(startTask?.completedDate ?? startTask?.startDate ?? null),
      actualEndDate: isoDate(actualEnd),
      producedQuantity: produced,
      moldsProduced: null,
      source,
    });
  }

  // 6. Delivery — real ERECTION-team task "Delivery Start" (erection_delivery_start).
  {
    const t = task('erection_delivery_start');
    results.push({
      stageKey: 'DELIVERY',
      actualStartDate: isoDate(t?.startDate ?? null),
      actualEndDate: isoDate(t?.completedDate ?? null),
      producedQuantity: null,
      moldsProduced: null,
      source: t ? 'Workflow (Erection)' : 'Not linked yet',
    });
  }

  // 7. Erection — real ERECTION-team "Erection Start" (erection_start) for
  // the start signal; real ERECTION-team "Issue Checklist"
  // (erection_issue_checklist, the last task in the real erection sequence)
  // as the completion signal.
  {
    const startTask = task('erection_start');
    const endTask = task('erection_issue_checklist');
    results.push({
      stageKey: 'ERECTION',
      actualStartDate: isoDate(startTask?.completedDate ?? startTask?.startDate ?? null),
      actualEndDate: isoDate(endTask?.completedDate ?? null),
      producedQuantity: null,
      moldsProduced: null,
      source: startTask || endTask ? 'Workflow (Erection)' : 'Not linked yet',
    });
  }

  // 8. Final Closeout — real contract.closedAt, only once the contract is
  // genuinely CLOSED (never an approved-but-not-yet-closed date, which
  // would overstate completion).
  {
    const closed = input.contract.status === 'CLOSED' ? input.contract.closedAt : null;
    results.push({
      stageKey: 'FINAL_CLOSEOUT',
      actualStartDate: null,
      actualEndDate: isoDate(closed),
      producedQuantity: null,
      moldsProduced: null,
      source: closed ? 'Closeout' : 'Not available',
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Delay/status logic — pure, per this unit's own explicit spec.
// ---------------------------------------------------------------------------

export type StageStatus = 'NOT_PLANNED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | 'ON_TRACK' | 'AHEAD';

export interface StageStatusInput {
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  today: string;
}

export function computeStageStatus(input: StageStatusInput): StageStatus {
  const { plannedStartDate, plannedEndDate, actualStartDate, actualEndDate, today } = input;
  if (!plannedStartDate && !plannedEndDate) return 'NOT_PLANNED';

  if (actualEndDate) {
    if (plannedEndDate) {
      if (actualEndDate > plannedEndDate) return 'DELAYED';
      if (actualEndDate < plannedEndDate) return 'AHEAD';
    }
    return 'COMPLETED';
  }

  if (plannedEndDate && today > plannedEndDate) return 'DELAYED';
  if (actualStartDate) return 'IN_PROGRESS';
  return plannedEndDate ? 'ON_TRACK' : 'NOT_STARTED';
}

export interface DelayDaysInput {
  plannedEndDate: string | null;
  actualEndDate: string | null;
  today: string;
}

/** Positive = late, negative = early, 0 = on time, null = nothing real to show (no plannedEndDate, or not yet due and not completed). */
export function computeDelayDays(input: DelayDaysInput): number | null {
  const { plannedEndDate, actualEndDate, today } = input;
  if (!plannedEndDate) return null;
  const plannedMs = Date.parse(plannedEndDate);
  if (actualEndDate) {
    return Math.round((Date.parse(actualEndDate) - plannedMs) / 86_400_000);
  }
  if (today > plannedEndDate) {
    return Math.round((Date.parse(today) - plannedMs) / 86_400_000);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Combined per-stage row + summary KPIs.
// ---------------------------------------------------------------------------

export interface ScheduleStageRow {
  stageKey: ScheduleStageKey;
  stageName: string;
  responsibleTeam: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  plannedQuantity: number | null;
  plannedMolds: number | null;
  remarks: string | null;
  isRequired: boolean;
  actualStartDate: string | null;
  actualEndDate: string | null;
  producedQuantity: number | null;
  moldsProduced: number | null;
  source: string;
  status: StageStatus;
  delayDays: number | null;
}

export interface ScheduleSummaryData {
  scheduleStatus: 'Delayed' | 'In Progress' | 'Completed' | 'On Track' | 'Not Planned';
  plannedCompletionDate: string | null;
  actualOrForecastCompletionDate: string | null;
  delayDays: number | null;
  completedStages: number;
  pendingStages: number;
  totalStages: number;
}

export function computeScheduleSummary(stages: ScheduleStageRow[]): ScheduleSummaryData {
  const required = stages.filter((s) => s.isRequired);
  const completedStatuses: StageStatus[] = ['COMPLETED', 'DELAYED', 'AHEAD'];
  const isStageDone = (s: ScheduleStageRow): boolean => completedStatuses.includes(s.status) && s.actualEndDate !== null;

  const completedStages = required.filter(isStageDone).length;
  const pendingStages = required.length - completedStages;

  const plannedEndDates = stages.map((s) => s.plannedEndDate).filter((d): d is string => d !== null);
  const plannedCompletionDate = plannedEndDates.length > 0 ? plannedEndDates.reduce((a, b) => (a > b ? a : b)) : null;

  const finalCloseout = stages.find((s) => s.stageKey === 'FINAL_CLOSEOUT');
  const actualOrForecastCompletionDate = finalCloseout?.actualEndDate ?? null;

  let scheduleStatus: ScheduleSummaryData['scheduleStatus'] = 'Not Planned';
  if (required.length === 0) {
    scheduleStatus = 'Not Planned';
  } else if (required.some((s) => s.status === 'DELAYED')) {
    scheduleStatus = 'Delayed';
  } else if (required.every(isStageDone)) {
    scheduleStatus = 'Completed';
  } else if (required.some((s) => s.status === 'IN_PROGRESS' || isStageDone(s))) {
    scheduleStatus = 'In Progress';
  } else {
    scheduleStatus = 'On Track';
  }

  const delayValues = stages.map((s) => s.delayDays).filter((d): d is number => d !== null);
  const delayDays = delayValues.length > 0 ? Math.max(...delayValues) : null;

  return {
    scheduleStatus,
    plannedCompletionDate,
    actualOrForecastCompletionDate,
    delayDays,
    completedStages,
    pendingStages,
    totalStages: required.length,
  };
}

export interface ScheduleDetailResult {
  contractSummary: { contractDate: string | null; activatedAt: string | null; closedAt: string | null; status: string };
  stages: ScheduleStageRow[];
  hasPlannedSchedule: boolean;
  summary: ScheduleSummaryData;
}

@Injectable()
export class ContractSchedulePlanService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  private async loadContract(contractId: string, actor: AuthUser): Promise<{ id: string; departmentId: string | null; status: string; contractDate: Date | null; activatedAt: Date | null; closedAt: Date | null }> {
    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true, status: true, contractDate: true, activatedAt: true, closedAt: true },
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);
    return contract;
  }

  async getScheduleDetail(contractId: string, actor: AuthUser): Promise<ScheduleDetailResult> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    const contract = await this.loadContract(contractId, actor);

    const [plannedItems, workflowTasks, paidPayments, boqItems] = await Promise.all([
      this.db.getClient().contractScheduleItem.findMany({ where: { contractId }, orderBy: [{ sortOrder: 'asc' }] }),
      this.db.getClient().contractWorkflowTask.findMany({ where: { contractId }, select: { taskKey: true, startDate: true, completedDate: true } }),
      this.db.getClient().contractPayment.findMany({ where: { contractId, status: 'PAID' }, select: { paidDate: true } }),
      this.db.getClient().contractBoqItem.findMany({
        where: { contractId },
        select: {
          originalEstimatedQty: true,
          revisedQty: true,
          productionStatus: { select: { producedQty: true, status: true, updatedAt: true } },
        },
      }),
    ]);

    let totalQty = 0;
    let producedQty = 0;
    let allProductionComplete = boqItems.length > 0;
    let productionCompletedMaxUpdatedAt: Date | null = null;
    for (const item of boqItems) {
      totalQty += computeTotalQty(item);
      const status = item.productionStatus?.status ?? 'NOT_STARTED';
      producedQty += toNum(item.productionStatus?.producedQty) ?? 0;
      if (status !== 'COMPLETED') {
        allProductionComplete = false;
      } else if (item.productionStatus?.updatedAt) {
        if (!productionCompletedMaxUpdatedAt || item.productionStatus.updatedAt > productionCompletedMaxUpdatedAt) {
          productionCompletedMaxUpdatedAt = item.productionStatus.updatedAt;
        }
      }
    }

    const actualStages = computeActualStages({
      contract: { contractDate: contract.contractDate, activatedAt: contract.activatedAt, status: contract.status, closedAt: contract.closedAt },
      workflowTasks,
      paidPayments,
      productionSummary: boqItems.length > 0 ? { totalQty, producedQty, remainingToCast: totalQty - producedQty } : null,
      allProductionComplete,
      productionCompletedMaxUpdatedAt,
    });

    const todayIso = isoDate(utcToday()) as string;
    const plannedByStage = new Map(plannedItems.map((p) => [p.stageKey as ScheduleStageKey, p]));
    const actualByStage = new Map(actualStages.map((a) => [a.stageKey, a]));

    const stages: ScheduleStageRow[] = SCHEDULE_STAGE_KEYS.map((stageKey) => {
      const planned = plannedByStage.get(stageKey) ?? null;
      const actual = actualByStage.get(stageKey) as ActualStageData;
      const plannedStartDate = isoDate(planned?.plannedStartDate ?? null);
      const plannedEndDate = isoDate(planned?.plannedEndDate ?? null);
      const status = computeStageStatus({
        plannedStartDate,
        plannedEndDate,
        actualStartDate: actual.actualStartDate,
        actualEndDate: actual.actualEndDate,
        today: todayIso,
      });
      const delayDays = computeDelayDays({ plannedEndDate, actualEndDate: actual.actualEndDate, today: todayIso });

      return {
        stageKey,
        stageName: planned?.stageName ?? DEFAULT_STAGE_NAMES[stageKey],
        responsibleTeam: planned?.responsibleTeam ?? null,
        plannedStartDate,
        plannedEndDate,
        plannedQuantity: planned ? toNum(planned.plannedQuantity) : null,
        plannedMolds: planned?.plannedMolds ?? null,
        remarks: planned?.remarks ?? null,
        isRequired: planned?.isRequired ?? true,
        actualStartDate: actual.actualStartDate,
        actualEndDate: actual.actualEndDate,
        producedQuantity: actual.producedQuantity,
        moldsProduced: actual.moldsProduced,
        source: actual.source,
        status,
        delayDays,
      };
    });

    return {
      contractSummary: {
        contractDate: isoDate(contract.contractDate),
        activatedAt: isoDate(contract.activatedAt),
        closedAt: isoDate(contract.closedAt),
        status: contract.status,
      },
      stages,
      hasPlannedSchedule: plannedItems.length > 0,
      summary: computeScheduleSummary(stages),
    };
  }

  async updatePlan(contractId: string, dto: UpdateContractSchedulePlanDto, actor: AuthUser): Promise<ScheduleDetailResult> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }
    await this.loadContract(contractId, actor);

    await this.db.getClient().$transaction(async (tx) => {
      for (const item of dto.items) {
        const stageKey = item.stageKey as ScheduleStageKey;
        await tx.contractScheduleItem.upsert({
          where: { contractId_stageKey: { contractId, stageKey: stageKey as never } },
          create: {
            contractId,
            stageKey: stageKey as never,
            stageName: item.stageName ?? DEFAULT_STAGE_NAMES[stageKey],
            sortOrder: DEFAULT_STAGE_SORT_ORDER[stageKey],
            responsibleTeam: item.responsibleTeam ?? null,
            plannedStartDate: item.plannedStartDate ? new Date(item.plannedStartDate) : null,
            plannedEndDate: item.plannedEndDate ? new Date(item.plannedEndDate) : null,
            plannedQuantity: item.plannedQuantity ?? null,
            plannedMolds: item.plannedMolds ?? null,
            remarks: item.remarks ?? null,
            isRequired: item.isRequired ?? true,
            createdByUserId: actor.id,
          },
          update: {
            stageName: item.stageName ?? DEFAULT_STAGE_NAMES[stageKey],
            responsibleTeam: item.responsibleTeam ?? null,
            plannedStartDate: item.plannedStartDate ? new Date(item.plannedStartDate) : null,
            plannedEndDate: item.plannedEndDate ? new Date(item.plannedEndDate) : null,
            plannedQuantity: item.plannedQuantity ?? null,
            plannedMolds: item.plannedMolds ?? null,
            remarks: item.remarks ?? null,
            isRequired: item.isRequired ?? true,
            updatedByUserId: actor.id,
          },
        });
      }
    });

    await logContractActivity(this.db, contractId, actor, 'schedule_plan_updated', { stageCount: dto.items.length });

    return this.getScheduleDetail(contractId, actor);
  }
}
