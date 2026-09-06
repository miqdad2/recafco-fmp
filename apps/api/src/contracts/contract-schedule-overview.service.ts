import { Injectable, ForbiddenException } from '@nestjs/common';
import { ModuleIdentifier, ContractStatus } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { computeTotalQty } from './contract-boq-production.service';
import {
  SCHEDULE_STAGE_KEYS,
  DEFAULT_STAGE_NAMES,
  computeActualStages,
  computeStageStatus,
  computeDelayDays,
  computeScheduleSummary,
  type ScheduleStageKey,
  type ScheduleStageRow,
} from './contract-schedule-plan.service';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// CM-68B — Global Contract Schedule Overview. Reuses CM-68A's real Planned
// vs Actual derivation (computeActualStages/computeStageStatus/
// computeDelayDays/computeScheduleSummary) unmodified, per contract, then
// adds a small amount of NEW cross-contract summarization logic
// (current stage / blocking team / next milestone / global status) — no
// duplicated derivation, no new "actual" source logic.
// ---------------------------------------------------------------------------

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

export type OverviewScheduleStatus = 'Delayed' | 'On Track' | 'Not Planned' | 'Completed' | 'Attention';

export interface CurrentStageResult {
  row: ScheduleStageRow | null;
  label: string;
}

/** "First planned stage not completed" (in real fixed stage order); if every planned stage is done, "Completed"; if nothing is planned at all, "Not Planned". Never guessed from createdAt. */
export function computeCurrentStage(stages: ScheduleStageRow[]): CurrentStageResult {
  const planned = stages.filter((s) => s.plannedStartDate !== null || s.plannedEndDate !== null);
  if (planned.length === 0) return { row: null, label: 'Not Planned' };
  const notCompleted = planned.find((s) => s.actualEndDate === null);
  if (notCompleted) return { row: notCompleted, label: notCompleted.stageName };
  return { row: null, label: 'Completed' };
}

// CM-68B — safe stage-name-based fallback ONLY when a stage has no real
// responsibleTeam entered. Never applied to Contract Sign / Advance Payment
// / Estimation Sheet / Final Closeout — those have no safe team mapping and
// honestly show "—".
const STAGE_TEAM_INFERENCE: Partial<Record<ScheduleStageKey, string>> = {
  DRAWING_APPROVAL: 'Technical',
  CASTING_PRODUCTION: 'Production',
  DELIVERY: 'Delivery / Erection',
  ERECTION: 'Delivery / Erection',
};

export function computeBlockingTeam(stageRow: ScheduleStageRow | null): string {
  if (!stageRow) return '—';
  if (stageRow.responsibleTeam) return stageRow.responsibleTeam;
  return STAGE_TEAM_INFERENCE[stageRow.stageKey] ?? '—';
}

export interface NextMilestoneResult {
  label: string;
  date: string | null;
}

/** Nearest real planned date (end preferred, start as fallback) among stages that are planned but not yet completed and not already in the past. "—" when nothing real qualifies. */
export function computeNextMilestone(stages: ScheduleStageRow[], today: string): NextMilestoneResult {
  const upcoming = stages
    .filter((s) => s.actualEndDate === null)
    .map((s) => ({ stage: s, date: s.plannedEndDate ?? s.plannedStartDate }))
    .filter((x): x is { stage: ScheduleStageRow; date: string } => x.date !== null && x.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const next = upcoming[0];
  if (!next) return { label: '—', date: null };
  return { label: next.stage.stageName, date: next.date };
}

/**
 * Delayed > Completed (contract closed, or every planned stage done) >
 * Not Planned (nothing planned at all) > Attention (a real next milestone
 * falls within the next 7 real days) > On Track. "Attention" is
 * deliberately narrow and disclosed: it means a real upcoming date is due
 * soon, not a fabricated cross-module blocker count.
 */
export function computeGlobalScheduleStatus(input: {
  contractStatus: string;
  stages: ScheduleStageRow[];
  nextMilestoneDate: string | null;
  today: string;
}): OverviewScheduleStatus {
  if (input.contractStatus === 'CLOSED') return 'Completed';

  const planned = input.stages.filter((s) => s.plannedStartDate !== null || s.plannedEndDate !== null);
  if (planned.length === 0) return 'Not Planned';
  if (planned.some((s) => s.status === 'DELAYED')) return 'Delayed';
  if (planned.every((s) => s.actualEndDate !== null)) return 'Completed';

  if (input.nextMilestoneDate) {
    const daysUntil = Math.round((Date.parse(input.nextMilestoneDate) - Date.parse(input.today)) / 86_400_000);
    if (daysUntil >= 0 && daysUntil <= 7) return 'Attention';
  }

  return 'On Track';
}

export interface ScheduleOverviewRow {
  contractId: string;
  contractNumber: string;
  jobOrderNumber: string | null;
  projectName: string;
  clientName: string;
  contractStatus: string;
  scheduleStatus: OverviewScheduleStatus;
  currentStage: string;
  plannedFinishDate: string | null;
  actualOrForecastFinishDate: string | null;
  delayDays: number | null;
  blockingTeam: string;
  blockingStage: string;
  openBlockerCount: number;
  nextMilestone: string;
  nextMilestoneDate: string | null;
  completedStages: number;
  totalStages: number;
  actionUrl: string;
}

export function computeOverviewRow(input: {
  contract: { id: string; referenceNumber: string; jobOrder: string | null; title: string; counterpartyName: string; status: string };
  stages: ScheduleStageRow[];
  today: string;
}): ScheduleOverviewRow {
  const { contract, stages, today } = input;
  const summary = computeScheduleSummary(stages);
  const currentStage = computeCurrentStage(stages);
  const nextMilestone = computeNextMilestone(stages, today);
  const scheduleStatus = computeGlobalScheduleStatus({
    contractStatus: contract.status,
    stages,
    nextMilestoneDate: nextMilestone.date,
    today,
  });

  const planned = stages.filter((s) => s.plannedStartDate !== null || s.plannedEndDate !== null);
  const delayedStage = planned.find((s) => s.status === 'DELAYED') ?? null;

  return {
    contractId: contract.id,
    contractNumber: contract.referenceNumber,
    jobOrderNumber: contract.jobOrder,
    projectName: contract.title,
    clientName: contract.counterpartyName,
    contractStatus: contract.status,
    scheduleStatus,
    currentStage: currentStage.label,
    plannedFinishDate: summary.plannedCompletionDate,
    actualOrForecastFinishDate: summary.actualOrForecastCompletionDate,
    delayDays: summary.delayDays,
    blockingTeam: delayedStage ? computeBlockingTeam(delayedStage) : '—',
    blockingStage: delayedStage ? delayedStage.stageName : 'No blocker',
    openBlockerCount: planned.filter((s) => s.status === 'DELAYED').length,
    nextMilestone: nextMilestone.label,
    nextMilestoneDate: nextMilestone.date,
    completedStages: summary.completedStages,
    totalStages: summary.totalStages,
    actionUrl: `/contracts/${contract.id}/schedule`,
  };
}

export interface ScheduleOverviewSummary {
  totalActiveContracts: number;
  onTrack: number;
  delayed: number;
  notPlanned: number;
  dueThisWeek: number;
  completedThisMonth: number;
}

export function computeOverviewSummary(rows: ScheduleOverviewRow[], today: string): ScheduleOverviewSummary {
  const totalActiveContracts = rows.filter((r) => r.contractStatus === 'ACTIVE').length;
  const onTrack = rows.filter((r) => r.scheduleStatus === 'On Track').length;
  const delayed = rows.filter((r) => r.scheduleStatus === 'Delayed').length;
  const notPlanned = rows.filter((r) => r.scheduleStatus === 'Not Planned').length;

  const dueThisWeek = rows.filter((r) => {
    if (!r.nextMilestoneDate) return false;
    const days = Math.round((Date.parse(r.nextMilestoneDate) - Date.parse(today)) / 86_400_000);
    return days >= 0 && days <= 7;
  }).length;

  const monthPrefix = today.slice(0, 7);
  const completedThisMonth = rows.filter(
    (r) => r.contractStatus === 'CLOSED' && r.actualOrForecastFinishDate !== null && r.actualOrForecastFinishDate.slice(0, 7) === monthPrefix,
  ).length;

  return { totalActiveContracts, onTrack, delayed, notPlanned, dueThisWeek, completedThisMonth };
}

const SCHEDULE_OVERVIEW_CONTRACT_CAP = 1000;

export interface ScheduleOverviewResult {
  rows: ScheduleOverviewRow[];
  summary: ScheduleOverviewSummary;
}

@Injectable()
export class ContractScheduleOverviewService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
  ) {}

  async getOverview(actor: AuthUser): Promise<ScheduleOverviewResult> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    // CM-69A — a cancelled/voided contract is never a scheduling concern; it
    // is excluded here entirely (this overview has no cancelled-status
    // filter of its own, unlike Contract List) rather than shown as a
    // confusing "Not Planned" row for something no longer active.
    const where = {
      status: { not: ContractStatus.CANCELLED },
      ...(deptFilter !== null ? { departmentId: deptFilter } : {}),
    };

    const contracts = await this.db.getClient().contract.findMany({
      where,
      select: {
        id: true,
        referenceNumber: true,
        jobOrder: true,
        title: true,
        counterpartyName: true,
        status: true,
        contractDate: true,
        activatedAt: true,
        closedAt: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: SCHEDULE_OVERVIEW_CONTRACT_CAP,
    });

    const contractIds = contracts.map((c) => c.id);
    if (contractIds.length === 0) {
      return { rows: [], summary: computeOverviewSummary([], isoDate(utcToday()) as string) };
    }

    const [plannedItems, workflowTasks, paidPayments, boqItems] = await Promise.all([
      this.db.getClient().contractScheduleItem.findMany({ where: { contractId: { in: contractIds } } }),
      this.db.getClient().contractWorkflowTask.findMany({
        where: { contractId: { in: contractIds } },
        select: { contractId: true, taskKey: true, startDate: true, completedDate: true },
      }),
      this.db.getClient().contractPayment.findMany({
        where: { contractId: { in: contractIds }, status: 'PAID' },
        select: { contractId: true, paidDate: true },
      }),
      this.db.getClient().contractBoqItem.findMany({
        where: { contractId: { in: contractIds } },
        select: {
          contractId: true,
          originalEstimatedQty: true,
          revisedQty: true,
          productionStatus: { select: { producedQty: true, status: true, updatedAt: true } },
        },
      }),
    ]);

    const plannedByContract = new Map<string, typeof plannedItems>();
    for (const item of plannedItems) {
      const list = plannedByContract.get(item.contractId) ?? [];
      list.push(item);
      plannedByContract.set(item.contractId, list);
    }
    const tasksByContract = new Map<string, typeof workflowTasks>();
    for (const task of workflowTasks) {
      const list = tasksByContract.get(task.contractId) ?? [];
      list.push(task);
      tasksByContract.set(task.contractId, list);
    }
    const paymentsByContract = new Map<string, typeof paidPayments>();
    for (const payment of paidPayments) {
      const list = paymentsByContract.get(payment.contractId) ?? [];
      list.push(payment);
      paymentsByContract.set(payment.contractId, list);
    }
    const boqByContract = new Map<string, typeof boqItems>();
    for (const item of boqItems) {
      const list = boqByContract.get(item.contractId) ?? [];
      list.push(item);
      boqByContract.set(item.contractId, list);
    }

    const todayDate = utcToday();
    const todayIso = isoDate(todayDate) as string;

    const rows: ScheduleOverviewRow[] = contracts.map((contract) => {
      const contractPlanned = plannedByContract.get(contract.id) ?? [];
      const contractTasks = tasksByContract.get(contract.id) ?? [];
      const contractPayments = paymentsByContract.get(contract.id) ?? [];
      const contractBoq = boqByContract.get(contract.id) ?? [];

      let totalQty = 0;
      let producedQty = 0;
      let allProductionComplete = contractBoq.length > 0;
      let productionCompletedMaxUpdatedAt: Date | null = null;
      for (const item of contractBoq) {
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
        workflowTasks: contractTasks,
        paidPayments: contractPayments,
        productionSummary: contractBoq.length > 0 ? { totalQty, producedQty, remainingToCast: totalQty - producedQty } : null,
        allProductionComplete,
        productionCompletedMaxUpdatedAt,
      });

      const plannedByStage = new Map(contractPlanned.map((p) => [p.stageKey as ScheduleStageKey, p]));
      const actualByStage = new Map(actualStages.map((a) => [a.stageKey, a]));

      const stages: ScheduleStageRow[] = SCHEDULE_STAGE_KEYS.map((stageKey) => {
        const plannedItem = plannedByStage.get(stageKey) ?? null;
        const actual = actualByStage.get(stageKey)!;
        const plannedStartDate = isoDate(plannedItem?.plannedStartDate ?? null);
        const plannedEndDate = isoDate(plannedItem?.plannedEndDate ?? null);
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
          stageName: plannedItem?.stageName ?? DEFAULT_STAGE_NAMES[stageKey],
          responsibleTeam: plannedItem?.responsibleTeam ?? null,
          plannedStartDate,
          plannedEndDate,
          plannedQuantity: plannedItem ? toNum(plannedItem.plannedQuantity) : null,
          plannedMolds: plannedItem?.plannedMolds ?? null,
          remarks: plannedItem?.remarks ?? null,
          isRequired: plannedItem?.isRequired ?? true,
          actualStartDate: actual.actualStartDate,
          actualEndDate: actual.actualEndDate,
          producedQuantity: actual.producedQuantity,
          moldsProduced: actual.moldsProduced,
          source: actual.source,
          status,
          delayDays,
        };
      });

      return computeOverviewRow({
        contract: {
          id: contract.id,
          referenceNumber: contract.referenceNumber,
          jobOrder: contract.jobOrder,
          title: contract.title,
          counterpartyName: contract.counterpartyName,
          status: contract.status,
        },
        stages,
        today: todayIso,
      });
    });

    return { rows, summary: computeOverviewSummary(rows, todayIso) };
  }
}
