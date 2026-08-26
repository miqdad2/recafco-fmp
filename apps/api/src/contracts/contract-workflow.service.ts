import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import {
  WorkflowAttachmentStorageService,
  WORKFLOW_ATTACHMENT_MAX_BYTES,
  WORKFLOW_ATTACHMENT_ALLOWED_MIME_TYPES,
} from './workflow-attachment-storage.service';
import type { AuthUser } from '../common/types/auth-user';
import type { UpdateContractWorkflowTaskDto } from './dto/update-contract-workflow-task.dto';
import type { ContractWorkflowListQueryDto } from './dto/contract-workflow-list-query.dto';
import type { ContractWorkflowAssignmentQueueQueryDto } from './dto/contract-workflow-assignment-queue-query.dto';
import type { CreateContractWorkflowTaskCommentDto } from './dto/create-contract-workflow-task-comment.dto';
import { generateWorkflowTaskTemplates } from './contract-workflow-templates';
import type { ScopeOfWork } from './contract-workflow-templates';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Fixed lane order for grouping — Prisma can't order by a custom enum sequence without raw SQL, so tasks are re-sorted here after fetch. */
const TEAM_ORDER = ['TECHNICAL', 'PRODUCTION', 'ERECTION', 'QS_COMMERCIAL'];

function sortTasks<T extends { team: string; sortOrder: number }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const teamDiff = TEAM_ORDER.indexOf(a.team) - TEAM_ORDER.indexOf(b.team);
    return teamDiff !== 0 ? teamDiff : a.sortOrder - b.sortOrder;
  });
}

// ---------------------------------------------------------------------------
// Derived progress — never stored, always computed from current tasks.
// ---------------------------------------------------------------------------

export type WorkflowStatus = 'NOT_GENERATED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface WorkflowProgress {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
  workflowStatus: WorkflowStatus;
}

interface ProgressTaskFields {
  status: string;
  dueDate: Date | null;
}

export function computeWorkflowProgress(tasks: ProgressTaskFields[], today: Date = utcToday()): WorkflowProgress {
  const total = tasks.length;
  if (total === 0) {
    return { total: 0, notStarted: 0, inProgress: 0, completed: 0, overdue: 0, workflowStatus: 'NOT_GENERATED' };
  }

  let notStarted = 0;
  let inProgress = 0;
  let completed = 0;
  let overdue = 0;

  for (const t of tasks) {
    if (t.status === 'COMPLETED') completed += 1;
    else if (t.status === 'NOT_STARTED') notStarted += 1;
    else inProgress += 1;

    if (t.status !== 'COMPLETED' && t.status !== 'REJECTED' && t.dueDate !== null && t.dueDate < today) {
      overdue += 1;
    }
  }

  const workflowStatus: WorkflowStatus =
    completed === total ? 'COMPLETED' : notStarted === total ? 'NOT_STARTED' : 'IN_PROGRESS';

  return { total, notStarted, inProgress, completed, overdue, workflowStatus };
}

// ---------------------------------------------------------------------------
// CM-32 — per-task overdue flag for the Kanban card / task drawer. This is a
// DIFFERENT definition from computeWorkflowProgress's contract-level overdue
// count above (which excludes COMPLETED/REJECTED and stays unchanged for
// backward compatibility with the existing module-list/summary behavior):
// here, only COMPLETED and APPROVED are excluded, since a REJECTED task is
// still meaningfully "overdue" work that needs attention. Do not merge these
// two definitions — they are intentionally different, see CM-32 report.
// ---------------------------------------------------------------------------

const TASK_OVERDUE_EXCLUDED_STATUSES = ['COMPLETED', 'APPROVED'];

interface TaskOverdueFields {
  status: string;
  dueDate: Date | null;
}

export function computeTaskIsOverdue(task: TaskOverdueFields, today: Date = utcToday()): boolean {
  if (TASK_OVERDUE_EXCLUDED_STATUSES.includes(task.status)) return false;
  if (!task.dueDate) return false;
  const due = new Date(Date.UTC(task.dueDate.getUTCFullYear(), task.dueDate.getUTCMonth(), task.dueDate.getUTCDate()));
  return due < today;
}

// ---------------------------------------------------------------------------
// CM-32 — completedDate resolution: an explicit dto value always wins;
// otherwise, if the effective status is COMPLETED and there's no completed
// date yet, it's auto-set to today. If status moves AWAY from COMPLETED
// without an explicit completedDate, the existing value is left untouched
// (retained, not cleared) — the safer of the two choices offered by the
// spec, since clearing would silently discard a real historical date.
// Returns undefined when the field should be left untouched.
// ---------------------------------------------------------------------------

export function resolveWorkflowTaskCompletedDate(
  effectiveStatus: string | undefined,
  dtoCompletedDate: string | undefined,
  existingCompletedDate: Date | null,
  today: Date = utcToday(),
): Date | undefined {
  if (dtoCompletedDate !== undefined) return new Date(dtoCompletedDate);
  if (effectiveStatus === 'COMPLETED' && !existingCompletedDate) return today;
  return undefined;
}

// ---------------------------------------------------------------------------
// CM-35 — Contract Staff (contracts.workflow_update, no contracts.update) may
// only touch workflow tasks assigned to them, and only a subset of fields:
// status, completedDate, remarks, delayReason (+ comments/attachments,
// checked separately). responsibleUserId/dueDate/priority/startDate are
// manager-only — startDate isn't explicitly listed in the CM-35 spec's field
// split, but it's treated as manager-only here (a scheduling field like
// dueDate) as the conservative reading. Contract Manager/Admin (contracts.update)
// are unrestricted, exactly as before this unit.
// ---------------------------------------------------------------------------

const MANAGER_ONLY_WORKFLOW_FIELDS = ['responsibleUserId', 'dueDate', 'priority', 'startDate'] as const;

// ---------------------------------------------------------------------------
// CM-46B/CM-49/CM-50/CM-51 — formData is a small, fixed allow-list of
// optional Contract Staff task-intake fields for every task-specific work
// form the focused task screen renders (Drawing Received's Receipt
// Details / Drawing-Task Information; SD & Calculation Submission's
// Submission Information; Getting Approval's Approval Information; FD
// Issuance's FD Issuance Information — see staff-task-update-panel.tsx for
// which fields each task-specific form actually renders and sends).
// Deliberately NOT open-ended: this keeps the
// JSON column from ever becoming a backdoor for core workflow state that
// already has its own real column (status, remarks, dueDate, priority,
// responsibleUserId — none of those keys appear in either list below, and
// any that did would simply be dropped, never persisted). Every field is
// optional — an absent or empty value is dropped, not stored as ''/false, so
// a save with everything blank clears the column back to null rather than
// storing an empty-but-present object. The allow-list is intentionally
// task-agnostic (a single flat superset) rather than keyed by taskKey: each
// task-specific frontend form only ever renders and submits its own field
// names, so one task type's formData never receives another's fields — no
// cross-task contamination risk from sharing one list.
// ---------------------------------------------------------------------------

const WORKFLOW_TASK_FORM_DATA_TEXT_KEYS = [
  // Drawing Received — Receipt Details / Drawing-Task Information / Follow-up (CM-46B)
  'receivedDate', 'receivedFrom', 'senderName', 'drawingType', 'drawingReferenceNo',
  'revisionNo', 'numberOfSheets', 'drawingDescription', 'relatedAreaPackage',
  'linkedContractStage', 'internalReferenceNo', 'internalNotes', 'plannedReviewStart',
  // SD & Calculation Submission — Submission Information (CM-49). drawingReferenceNo
  // and revisionNo above are reused as-is, not duplicated here.
  'submissionDate', 'submissionType', 'submittedTo', 'targetApprovalDate',
  'relatedDrawingReceived', 'calculationType', 'numberOfSheetsFiles', 'scopeDescription',
  'submittedBy', 'designation', 'submissionMethod', 'submissionReferenceNo',
  'contactNo', 'email',
  // Getting Approval — Approval Information (CM-50). submittedBy and revisionNo
  // above are reused as-is, not duplicated here.
  'submittedOn', 'submittedToReviewerClient', 'approvalStatus', 'expectedApprovalDate',
  'reviewedOn', 'reviewedBy', 'clientReviewerComments', 'resubmissionDate',
  'resubmissionReasonComments',
  // FD Issuance — FD Issuance Information (CM-51). drawingReferenceNo, revisionNo,
  // numberOfSheetsFiles, designation, contactNo and email above are reused as-is.
  'fdIssueDate', 'issuedTo', 'purposeFor', 'issueType', 'approvedReferenceNo',
  'approvedDate', 'scale', 'distribution', 'issueMethod', 'issuedBy',
] as const;

const WORKFLOW_TASK_FORM_DATA_BOOLEAN_KEYS = [
  'requiresImmediateReview', 'additionalDocumentsReceived',
  // Getting Approval (CM-50)
  'resubmissionRequired',
] as const;

export function sanitizeWorkflowTaskFormData(formData: Record<string, unknown> | undefined): Record<string, string | boolean> | null | undefined {
  if (formData === undefined) return undefined;
  const result: Record<string, string | boolean> = {};
  for (const key of WORKFLOW_TASK_FORM_DATA_TEXT_KEYS) {
    const value = formData[key];
    if (typeof value === 'string' && value.trim() !== '') result[key] = value.trim().slice(0, 500);
  }
  for (const key of WORKFLOW_TASK_FORM_DATA_BOOLEAN_KEYS) {
    const value = formData[key];
    if (typeof value === 'boolean' && value) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

// ---------------------------------------------------------------------------
// Cross-field validation for task updates. completedDate is always resolved
// (auto-set when needed) by resolveWorkflowTaskCompletedDate before this
// runs, so no "COMPLETED requires completedDate" check is needed here.
// ---------------------------------------------------------------------------

export function assertWorkflowTaskDatesValid(effective: {
  status: string | undefined;
  startDate: Date | null | undefined;
  dueDate: Date | null | undefined;
  completedDate: Date | null | undefined;
}): void {
  if (effective.completedDate && effective.startDate && effective.completedDate < effective.startDate) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_WORKFLOW_TASK_COMPLETED_BEFORE_START',
      message: 'Completed Date cannot be before Start Date.',
    });
  }
  if (effective.dueDate && effective.startDate && effective.dueDate < effective.startDate) {
    throw new UnprocessableEntityException({
      code: 'CONTRACT_WORKFLOW_TASK_DUE_BEFORE_START',
      message: 'Due Date cannot be before Start Date.',
    });
  }
}

// ---------------------------------------------------------------------------
// Module-level list where builder (exported for tests) — contract-own
// filters only. Department scope is combined in by findAll(), which also
// knows the live dept-access scope.
// ---------------------------------------------------------------------------

export function buildWorkflowContractWhere(query: ContractWorkflowListQueryDto): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  if (query.status) and.push({ status: query.status });
  if (query.departmentId) and.push({ departmentId: query.departmentId });
  if (query.ownerUserId) and.push({ ownerUserId: query.ownerUserId });

  if (query.search?.trim()) {
    const s = query.search.trim();
    and.push({
      OR: [
        { title: { contains: s, mode: 'insensitive' } },
        { referenceNumber: { contains: s, mode: 'insensitive' } },
        { counterpartyName: { contains: s, mode: 'insensitive' } },
      ],
    });
  }

  if (and.length > 0) where['AND'] = and;
  return where;
}

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const CONTRACT_WORKFLOW_SELECT = {
  id: true,
  referenceNumber: true,
  title: true,
  counterpartyName: true,
  status: true,
  scopeOfWork: true,
  paymentTerms: true,
  contractValue: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  ownerUser: { select: { id: true, displayName: true } },
} as const;

const WORKFLOW_TASK_SELECT = {
  id: true,
  contractId: true,
  team: true,
  taskKey: true,
  taskName: true,
  sortOrder: true,
  status: true,
  priority: true,
  delayReason: true,
  responsibleUserId: true,
  startDate: true,
  dueDate: true,
  completedDate: true,
  remarks: true,
  formData: true,
  lastActivityAt: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
  responsibleUser: { select: { id: true, displayName: true } },
  createdByUser: { select: { id: true, displayName: true } },
  updatedByUser: { select: { id: true, displayName: true } },
  _count: { select: { attachments: true, comments: true } },
} as const;

/** Maps the raw Prisma `_count` shape to flat, frontend-friendly fields and adds the per-task overdue flag. Never mutates stored data — purely a response-shaping step. */
function withTaskDerivedFields<T extends { _count: { attachments: number; comments: number }; status: string; dueDate: Date | null }>(
  task: T,
  today: Date = utcToday(),
): Omit<T, '_count'> & { attachmentsCount: number; commentsCount: number; isOverdue: boolean } {
  const { _count, ...rest } = task;
  return {
    ...rest,
    attachmentsCount: _count.attachments,
    commentsCount: _count.comments,
    isOverdue: computeTaskIsOverdue(task, today),
  };
}

// A cap on how many contracts the module-level list will pull in for
// filtering/aggregation before pagination — generous for current data
// volumes without risking an unbounded query. See CM-28's payments register
// for the same pattern.
const WORKFLOW_LIST_CONTRACT_CAP = 1000;

// ---------------------------------------------------------------------------
// CM-40 — Manager Assignment Queue. A hard cap on the number of unassigned
// task rows returned (distinct from WORKFLOW_LIST_CONTRACT_CAP above, which
// caps candidate contracts) — the queue is meant to stay short and focused,
// so a very large backlog is truncated rather than ever growing unbounded.
// Summary counts below are always computed from the FULL set, before this
// cap and before the team/priority/dueDateMissing display filters, so the
// cards stay accurate even when the visible list is filtered or truncated.
// ---------------------------------------------------------------------------

const ASSIGNMENT_QUEUE_MAX_ROWS = 300;

const ASSIGNMENT_QUEUE_TASK_SELECT = {
  id: true,
  contractId: true,
  team: true,
  taskName: true,
  status: true,
  priority: true,
  dueDate: true,
  responsibleUserId: true,
} as const;

export interface AssignmentQueueSummary {
  contractsNeedingAssignment: number;
  unassignedTasksTotal: number;
  technicalUnassigned: number;
  productionUnassigned: number;
  erectionUnassigned: number;
  qsCommercialUnassigned: number;
}

export interface PaginatedWorkflowResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalContractsWithWorkflow: number;
    tasksNotStarted: number;
    tasksInProgress: number;
    tasksCompleted: number;
    tasksOverdue: number;
    myOpenTasks: number;
  };
}

@Injectable()
export class ContractWorkflowService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly attachmentStorage: WorkflowAttachmentStorageService,
  ) {}

  // ---------------------------------------------------------------------------
  // Module-level list — contracts with a workflow summary, filtered and scoped.
  // ---------------------------------------------------------------------------

  async findAll(query: ContractWorkflowListQueryDto, actor: AuthUser): Promise<PaginatedWorkflowResult<unknown>> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const today = utcToday();

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const where = buildWorkflowContractWhere(query);
    if (deptFilter !== null) {
      const and = (where['AND'] as Record<string, unknown>[] | undefined) ?? [];
      and.push({ departmentId: deptFilter });
      where['AND'] = and;
    }

    const candidateContracts = await this.db.getClient().contract.findMany({
      where,
      select: CONTRACT_WORKFLOW_SELECT,
      orderBy: [{ createdAt: 'desc' }],
      take: WORKFLOW_LIST_CONTRACT_CAP,
    });

    const contractIds = candidateContracts.map((c) => c.id);
    const allTasks = contractIds.length > 0
      ? await this.db.getClient().contractWorkflowTask.findMany({
          where: { contractId: { in: contractIds } },
          select: { contractId: true, team: true, status: true, dueDate: true, updatedAt: true, responsibleUserId: true },
        })
      : [];

    // "My Open Tasks" is a personal counter across every dept-accessible
    // contract — always computed, independent of the myTasksOnly toggle
    // (which instead changes what the CONTRACT LIST/summary below shows).
    const myOpenTasks = allTasks.filter((t) => t.responsibleUserId === actor.id && t.status !== 'COMPLETED').length;

    const tasksByContract = new Map<string, typeof allTasks>();
    for (const t of allTasks) {
      const list = tasksByContract.get(t.contractId) ?? [];
      list.push(t);
      tasksByContract.set(t.contractId, list);
    }

    let rows = candidateContracts.map((c) => {
      const allContractTasks = tasksByContract.get(c.id) ?? [];
      const tasks = query.myTasksOnly
        ? allContractTasks.filter((t) => t.responsibleUserId === actor.id)
        : allContractTasks;
      const progress = computeWorkflowProgress(tasks, today);
      const lastUpdated = tasks.length > 0
        ? tasks.reduce((max, t) => (t.updatedAt > max ? t.updatedAt : max), tasks[0]!.updatedAt)
        : null;
      const teams = new Set(tasks.map((t) => t.team));
      return { contract: c, tasks, progress, lastUpdated, teams };
    });

    if (query.myTasksOnly) {
      rows = rows.filter((r) => r.tasks.length > 0);
    }
    if (query.workflowStatus) {
      rows = rows.filter((r) => r.progress.workflowStatus === query.workflowStatus);
    }
    if (query.team) {
      rows = rows.filter((r) => r.teams.has(query.team as never));
    }
    if (query.taskStatus) {
      rows = rows.filter((r) => r.tasks.some((t) => t.status === query.taskStatus));
    }
    if (query.responsibleUserId) {
      rows = rows.filter((r) => r.tasks.some((t) => t.responsibleUserId === query.responsibleUserId));
    }
    if (query.overdueOnly) {
      rows = rows.filter((r) => r.progress.overdue > 0);
    }

    const total = rows.length;
    const skip = (page - 1) * pageSize;
    const pageRows = rows.slice(skip, skip + pageSize);

    const items = pageRows.map((r) => ({
      id: r.contract.id,
      referenceNumber: r.contract.referenceNumber,
      title: r.contract.title,
      counterpartyName: r.contract.counterpartyName,
      status: r.contract.status,
      scopeOfWork: r.contract.scopeOfWork,
      department: r.contract.department,
      ownerUser: r.contract.ownerUser,
      openTasks: r.progress.total - r.progress.completed,
      overdueTasks: r.progress.overdue,
      workflowStatus: r.progress.workflowStatus,
      lastUpdated: r.lastUpdated,
    }));

    const summaryTasks = rows.flatMap((r) => r.tasks);
    const summaryProgress = computeWorkflowProgress(summaryTasks, today);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary: {
        totalContractsWithWorkflow: rows.filter((r) => r.tasks.length > 0).length,
        tasksNotStarted: summaryProgress.notStarted,
        tasksInProgress: summaryProgress.inProgress,
        tasksCompleted: summaryProgress.completed,
        tasksOverdue: summaryProgress.overdue,
        myOpenTasks,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // CM-40 — Manager Assignment Queue. Manager-only (contracts.update): a
  // flat list of unassigned tasks (responsibleUserId === null) across the
  // actor's department-scoped contracts, plus contracts whose scope calls
  // for workflow tasks that haven't been generated yet ("needs setup").
  // Deliberately does NOT trigger generation itself — see getWorkflowForContract
  // below, which already lazily generates on first board view; this method
  // only ever reads what already exists, so it can never surprise a manager
  // by creating tasks as a side effect of viewing the queue.
  // ---------------------------------------------------------------------------

  async findAssignmentQueue(query: ContractWorkflowAssignmentQueueQueryDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const where = buildWorkflowContractWhere({
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.departmentId !== undefined ? { departmentId: query.departmentId } : {}),
      ...(query.ownerUserId !== undefined ? { ownerUserId: query.ownerUserId } : {}),
    });
    if (deptFilter !== null) {
      const and = (where['AND'] as Record<string, unknown>[] | undefined) ?? [];
      and.push({ departmentId: deptFilter });
      where['AND'] = and;
    }

    const candidateContracts = await this.db.getClient().contract.findMany({
      where,
      select: CONTRACT_WORKFLOW_SELECT,
      orderBy: [{ createdAt: 'desc' }],
      take: WORKFLOW_LIST_CONTRACT_CAP,
    });

    const contractIds = candidateContracts.map((c) => c.id);
    const allTasks = contractIds.length > 0
      ? await this.db.getClient().contractWorkflowTask.findMany({
          where: { contractId: { in: contractIds } },
          select: ASSIGNMENT_QUEUE_TASK_SELECT,
        })
      : [];

    const tasksByContract = new Map<string, typeof allTasks>();
    for (const t of allTasks) {
      const list = tasksByContract.get(t.contractId) ?? [];
      list.push(t);
      tasksByContract.set(t.contractId, list);
    }

    const contractById = new Map(candidateContracts.map((c) => [c.id, c]));

    // Summary is computed from every unassigned task in scope, BEFORE the
    // team/priority/dueDateMissing display filters below, so the cards stay
    // accurate while a manager is filtering the visible list.
    const allUnassigned = allTasks.filter((t) => t.responsibleUserId === null);
    const perTeam: Record<string, number> = { TECHNICAL: 0, PRODUCTION: 0, ERECTION: 0, QS_COMMERCIAL: 0 };
    for (const t of allUnassigned) perTeam[t.team] = (perTeam[t.team] ?? 0) + 1;

    const summary: AssignmentQueueSummary = {
      contractsNeedingAssignment: new Set(allUnassigned.map((t) => t.contractId)).size,
      unassignedTasksTotal: allUnassigned.length,
      technicalUnassigned: perTeam['TECHNICAL'] ?? 0,
      productionUnassigned: perTeam['PRODUCTION'] ?? 0,
      erectionUnassigned: perTeam['ERECTION'] ?? 0,
      qsCommercialUnassigned: perTeam['QS_COMMERCIAL'] ?? 0,
    };

    let filtered = allUnassigned;
    if (query.team) filtered = filtered.filter((t) => t.team === query.team);
    if (query.priority) filtered = filtered.filter((t) => t.priority === query.priority);
    if (query.dueDateMissing) filtered = filtered.filter((t) => t.dueDate === null);

    const rows = filtered
      .map((t) => {
        const contract = contractById.get(t.contractId)!;
        return {
          taskId: t.id,
          contractId: contract.id,
          contractReference: contract.referenceNumber,
          contractTitle: contract.title,
          counterpartyName: contract.counterpartyName,
          contractStatus: contract.status,
          department: contract.department,
          ownerUser: contract.ownerUser,
          team: t.team,
          taskName: t.taskName,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
        };
      })
      .sort((a, b) => {
        if (a.dueDate === null && b.dueDate === null) return a.contractReference.localeCompare(b.contractReference);
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });

    const truncated = rows.length > ASSIGNMENT_QUEUE_MAX_ROWS;
    const items = rows.slice(0, ASSIGNMENT_QUEUE_MAX_ROWS);

    // Contracts needing workflow setup: ACTIVE, zero generated tasks, but
    // the saved scope would actually produce at least one default task —
    // an ACTIVE contract with a genuinely empty scope has nothing to
    // generate and is correctly left out.
    const contractsNeedingSetup = candidateContracts
      .filter((c) => c.status === 'ACTIVE' && (tasksByContract.get(c.id)?.length ?? 0) === 0)
      .filter((c) => generateWorkflowTaskTemplates({
        scopeOfWork: c.scopeOfWork as ScopeOfWork,
        paymentTerms: c.paymentTerms as Record<string, boolean> | null,
        contractValue: c.contractValue,
      }).length > 0)
      .map((c) => ({
        id: c.id,
        referenceNumber: c.referenceNumber,
        title: c.title,
        scopeOfWork: c.scopeOfWork,
      }));

    return { items, truncated, summary, contractsNeedingSetup };
  }

  // ---------------------------------------------------------------------------
  // Get (or lazily initialize) workflow tasks for one contract.
  // ---------------------------------------------------------------------------

  async getWorkflowForContract(contractId: string, actor: AuthUser, myTasksOnly?: boolean): Promise<unknown> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: CONTRACT_WORKFLOW_SELECT,
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);

    let tasks = await this.db.getClient().contractWorkflowTask.findMany({
      where: { contractId },
      select: WORKFLOW_TASK_SELECT,
    });

    if (tasks.length === 0) {
      const templates = generateWorkflowTaskTemplates({
        scopeOfWork: contract.scopeOfWork as ScopeOfWork,
        paymentTerms: contract.paymentTerms as Record<string, boolean> | null,
        contractValue: contract.contractValue,
      });

      if (templates.length > 0) {
        await this.db.getClient().contractWorkflowTask.createMany({
          data: templates.map((t) => ({
            contractId,
            team: t.team,
            taskKey: t.taskKey,
            taskName: t.taskName,
            sortOrder: t.sortOrder,
            createdByUserId: actor.id,
          })),
          skipDuplicates: true,
        });
        tasks = await this.db.getClient().contractWorkflowTask.findMany({
          where: { contractId },
          select: WORKFLOW_TASK_SELECT,
        });
      }
    }

    const sorted = sortTasks(tasks);
    // CM-32 "My Tasks only" — when set, both the returned task list AND the
    // progress summary reflect only the actor's own assigned tasks, matching
    // the same filtering semantics as the module-level list's myTasksOnly.
    const scoped = myTasksOnly ? sorted.filter((t) => t.responsibleUserId === actor.id) : sorted;
    const today = utcToday();
    return {
      contract,
      tasks: scoped.map((t) => withTaskDerivedFields(t, today)),
      progress: computeWorkflowProgress(scoped),
    };
  }

  // ---------------------------------------------------------------------------
  // Regenerate — additive-only sync of missing default tasks. Never touches
  // or removes an existing task, so it's always safe to call.
  // ---------------------------------------------------------------------------

  async regenerate(contractId: string, actor: AuthUser): Promise<{ added: number }> {
    if (!actor.permissions.includes('contracts.update')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.update' });
    }

    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: CONTRACT_WORKFLOW_SELECT,
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);

    const templates = generateWorkflowTaskTemplates({
      scopeOfWork: contract.scopeOfWork as ScopeOfWork,
      paymentTerms: contract.paymentTerms as Record<string, boolean> | null,
      contractValue: contract.contractValue,
    });

    const existing = await this.db.getClient().contractWorkflowTask.findMany({
      where: { contractId },
      select: { taskKey: true },
    });
    const existingKeys = new Set(existing.map((t) => t.taskKey));
    const missing = templates.filter((t) => !existingKeys.has(t.taskKey));

    if (missing.length > 0) {
      await this.db.getClient().contractWorkflowTask.createMany({
        data: missing.map((t) => ({
          contractId,
          team: t.team,
          taskKey: t.taskKey,
          taskName: t.taskName,
          sortOrder: t.sortOrder,
          createdByUserId: actor.id,
        })),
        skipDuplicates: true,
      });
    }

    return { added: missing.length };
  }

  // ---------------------------------------------------------------------------
  // CM-35 — shared assignment/field-scope guards for staff (contracts.workflow_update)
  // vs. manager/admin (contracts.update). A manager passes both checks
  // unconditionally; staff must be the task's assigned responsible user and
  // may not submit any manager-only field.
  // ---------------------------------------------------------------------------

  private assertWorkflowTaskAssigned(actor: AuthUser, task: { responsibleUserId: string | null }): void {
    if (actor.permissions.includes('contracts.update')) return;
    if (actor.permissions.includes('contracts.workflow_update')) {
      if (task.responsibleUserId !== actor.id) {
        throw new ForbiddenException({
          code: 'CONTRACT_WORKFLOW_TASK_NOT_ASSIGNED',
          message: 'You can only update workflow tasks assigned to you.',
        });
      }
      return;
    }
    throw new ForbiddenException({
      code: 'CONTRACTS_PERMISSION_DENIED',
      message: 'Missing contracts.update or contracts.workflow_update',
    });
  }

  private assertNoManagerOnlyFields(actor: AuthUser, dto: UpdateContractWorkflowTaskDto): void {
    if (actor.permissions.includes('contracts.update')) return;
    const attempted = MANAGER_ONLY_WORKFLOW_FIELDS.filter((f) => dto[f] !== undefined);
    if (attempted.length > 0) {
      throw new ForbiddenException({
        code: 'CONTRACT_WORKFLOW_TASK_MANAGER_FIELD_DENIED',
        message: `Only a manager can change: ${attempted.join(', ')}`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Update a single task.
  // ---------------------------------------------------------------------------

  async updateTask(taskId: string, dto: UpdateContractWorkflowTaskDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update') && !actor.permissions.includes('contracts.workflow_update')) {
      throw new ForbiddenException({
        code: 'CONTRACTS_PERMISSION_DENIED',
        message: 'Missing contracts.update or contracts.workflow_update',
      });
    }

    const existing = await this.db.getClient().contractWorkflowTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        startDate: true,
        dueDate: true,
        completedDate: true,
        responsibleUserId: true,
        contract: { select: { departmentId: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'CONTRACT_WORKFLOW_TASK_NOT_FOUND', message: 'Workflow task not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      existing.contract.departmentId,
    );
    this.assertWorkflowTaskAssigned(actor, existing);
    this.assertNoManagerOnlyFields(actor, dto);

    if (dto.responsibleUserId !== undefined) {
      const user = await this.db.getClient().user.findUnique({
        where: { id: dto.responsibleUserId },
        select: { id: true },
      });
      if (!user) {
        throw new UnprocessableEntityException({
          code: 'CONTRACT_WORKFLOW_TASK_INVALID_RESPONSIBLE',
          message: 'responsibleUserId does not refer to a valid user.',
        });
      }
    }

    const effectiveStatus = dto.status ?? existing.status;
    const effectiveStartDate = dto.startDate !== undefined ? new Date(dto.startDate) : existing.startDate;
    const completedDate = resolveWorkflowTaskCompletedDate(effectiveStatus, dto.completedDate, existing.completedDate);

    assertWorkflowTaskDatesValid({
      status: effectiveStatus,
      startDate: effectiveStartDate,
      dueDate: dto.dueDate !== undefined ? new Date(dto.dueDate) : existing.dueDate,
      completedDate: completedDate !== undefined ? completedDate : existing.completedDate,
    });

    const formData = sanitizeWorkflowTaskFormData(dto.formData);

    const updated = await this.db.getClient().contractWorkflowTask.update({
      where: { id: taskId },
      data: {
        updatedByUserId: actor.id,
        lastActivityAt: new Date(),
        ...(dto.status !== undefined ? { status: dto.status as never } : {}),
        ...(dto.responsibleUserId !== undefined ? { responsibleUserId: dto.responsibleUserId } : {}),
        ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(completedDate !== undefined ? { completedDate } : {}),
        ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority as never } : {}),
        ...(dto.delayReason !== undefined ? { delayReason: dto.delayReason } : {}),
        ...(formData !== undefined ? { formData: formData as never } : {}),
      },
      select: WORKFLOW_TASK_SELECT,
    });

    return withTaskDerivedFields(updated);
  }

  // ---------------------------------------------------------------------------
  // Comments — free-text progress notes. No manager approval flow; any actor
  // with contracts.update can add one directly (see CM-32 business decision:
  // workflow tasks are progress tracking, not approval-heavy).
  // ---------------------------------------------------------------------------

  private async loadTaskDepartment(taskId: string): Promise<{ departmentId: string | null; responsibleUserId: string | null }> {
    const task = await this.db.getClient().contractWorkflowTask.findUnique({
      where: { id: taskId },
      select: { responsibleUserId: true, contract: { select: { departmentId: true } } },
    });
    if (!task) {
      throw new NotFoundException({ code: 'CONTRACT_WORKFLOW_TASK_NOT_FOUND', message: 'Workflow task not found' });
    }
    return { departmentId: task.contract.departmentId, responsibleUserId: task.responsibleUserId };
  }

  async listComments(taskId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    const { departmentId } = await this.loadTaskDepartment(taskId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    return this.db.getClient().contractWorkflowTaskComment.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        taskId: true,
        comment: true,
        createdByUserId: true,
        createdAt: true,
        updatedAt: true,
        createdByUser: { select: { id: true, displayName: true } },
      },
    });
  }

  async addComment(taskId: string, dto: CreateContractWorkflowTaskCommentDto, actor: AuthUser): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update') && !actor.permissions.includes('contracts.workflow_update')) {
      throw new ForbiddenException({
        code: 'CONTRACTS_PERMISSION_DENIED',
        message: 'Missing contracts.update or contracts.workflow_update',
      });
    }
    const { departmentId, responsibleUserId } = await this.loadTaskDepartment(taskId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);
    this.assertWorkflowTaskAssigned(actor, { responsibleUserId });

    const [comment] = await this.db.getClient().$transaction([
      this.db.getClient().contractWorkflowTaskComment.create({
        data: { taskId, comment: dto.comment, createdByUserId: actor.id },
        select: {
          id: true,
          taskId: true,
          comment: true,
          createdByUserId: true,
          createdAt: true,
          updatedAt: true,
          createdByUser: { select: { id: true, displayName: true } },
        },
      }),
      this.db.getClient().contractWorkflowTask.update({
        where: { id: taskId },
        data: { lastActivityAt: new Date() },
        select: { id: true },
      }),
    ]);

    return comment;
  }

  // ---------------------------------------------------------------------------
  // Attachments — metadata + storage-relative path only; binary data lives on
  // disk via WorkflowAttachmentStorageService, never in the database.
  // ---------------------------------------------------------------------------

  async listAttachments(taskId: string, actor: AuthUser): Promise<unknown[]> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
    const { departmentId } = await this.loadTaskDepartment(taskId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);

    return this.db.getClient().contractWorkflowTaskAttachment.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        taskId: true,
        fileName: true,
        originalFileName: true,
        mimeType: true,
        fileSize: true,
        uploadedByUserId: true,
        createdAt: true,
        uploadedByUser: { select: { id: true, displayName: true } },
      },
    });
  }

  async createAttachment(
    taskId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    if (!actor.permissions.includes('contracts.update') && !actor.permissions.includes('contracts.workflow_update')) {
      throw new ForbiddenException({
        code: 'CONTRACTS_PERMISSION_DENIED',
        message: 'Missing contracts.update or contracts.workflow_update',
      });
    }
    const { departmentId, responsibleUserId } = await this.loadTaskDepartment(taskId);
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, departmentId);
    this.assertWorkflowTaskAssigned(actor, { responsibleUserId });

    if (!(WORKFLOW_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_WORKFLOW_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx).',
      });
    }
    if (file.size > WORKFLOW_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_WORKFLOW_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${WORKFLOW_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fileName, storagePath } = await this.attachmentStorage.save(taskId, file.buffer, file.originalname);

    const [attachment] = await this.db.getClient().$transaction([
      this.db.getClient().contractWorkflowTaskAttachment.create({
        data: {
          taskId,
          fileName,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          storagePath,
          uploadedByUserId: actor.id,
        },
        select: {
          id: true,
          taskId: true,
          fileName: true,
          originalFileName: true,
          mimeType: true,
          fileSize: true,
          uploadedByUserId: true,
          createdAt: true,
          uploadedByUser: { select: { id: true, displayName: true } },
        },
      }),
      this.db.getClient().contractWorkflowTask.update({
        where: { id: taskId },
        data: { lastActivityAt: new Date() },
        select: { id: true },
      }),
    ]);

    return attachment;
  }

  async getAttachmentForDownload(
    taskId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }

    const attachment = await this.db.getClient().contractWorkflowTaskAttachment.findFirst({
      where: { id: attachmentId, taskId },
      select: {
        storagePath: true,
        originalFileName: true,
        mimeType: true,
        task: { select: { contract: { select: { departmentId: true } } } },
      },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'CONTRACT_WORKFLOW_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }

    await this.deptAccess.assertCanAccessDepartment(
      actor,
      ModuleIdentifier.CONTRACTS_MANAGEMENT,
      attachment.task.contract.departmentId,
    );

    return {
      storagePath: attachment.storagePath,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
    };
  }
}
