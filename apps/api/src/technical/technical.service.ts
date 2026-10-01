import { Injectable, ForbiddenException, NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import {
  ModuleIdentifier,
  ContractStatus,
  TechnicalStage,
  TechnicalWorkflowStatus,
  TechnicalDrawingStatus,
  TechnicalSdSubmissionStatus,
  TechnicalApprovalStatus,
  TechnicalApprovalRecordStatus,
  TechnicalFdStatus,
} from '@recafco/database';
import type { TechnicalDrawing, TechnicalWorkflow, TechnicalSdCalculationSubmission, TechnicalApproval, TechnicalFdIssuance } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { TechnicalAttachmentStorageService, TECHNICAL_DRAWING_ATTACHMENT_ALLOWED_MIME_TYPES, TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES } from './technical-attachment-storage.service';
import type { SaveDrawingReceivedDto } from './dto/save-drawing-received.dto';
import type { SaveSdCalculationSubmissionDto } from './dto/save-sd-calculation-submission.dto';
import type { SaveGettingApprovalDto } from './dto/save-getting-approval.dto';
import type { SaveFdIssuanceDto } from './dto/save-fd-issuance.dto';
import type { AuthUser } from '../common/types/auth-user';

// ---------------------------------------------------------------------------
// FMP-TECH-01 — Technical Workflow Foundation.
//
// Permissions: reuses the SAME contracts.* permission codes every other
// Contract Management sub-feature (Erection, Workflow board, Technical's own
// existing Executive Dashboard card) already uses — contracts.read for reads,
// contracts.update OR contracts.workflow_update for writes (the exact
// Manager-or-Staff pattern contract-workflow.service.ts already establishes
// for team-task updates). No new technical.* permission was introduced —
// Technical is a Contract Management sub-view, gated the same way Erection
// and Technical's own existing card already are.
//
// Department scope: reuses DepartmentAccessService + ModuleIdentifier.
// CONTRACTS_MANAGEMENT — the same scope every other contract-family service
// already resolves against. No new ModuleIdentifier was added.
// ---------------------------------------------------------------------------

const NOT_CANCELLED_STATUS = { not: ContractStatus.CANCELLED };

const CONTRACT_SUMMARY_SELECT = {
  id: true,
  referenceNumber: true,
  title: true,
  jobOrder: true,
  quotationNumber: true,
  counterpartyName: true,
  departmentId: true,
  status: true,
  updatedAt: true,
  ownerUser: { select: { id: true, displayName: true } },
} as const;

export interface TechnicalDashboardResult {
  metrics: {
    pendingTechnicalReview: number;
    drawingReceived: number;
    sdCalculationPending: number;
    waitingApproval: number;
    fdIssued: number;
    readyForProductionRelease: number;
    needsAttention: number;
  };
  jobs: TechnicalJobRow[];
  needsAttention: TechnicalAttentionItem[];
  recentActivities: TechnicalActivityFeedItem[];
  /** Same 4 counts as `metrics.drawingReceived`/`sdCalculationPending`/`waitingApproval`/`fdIssued`, keyed by stage for a compact stage-progress display — no extra query, just the same numbers restructured. */
  stageBreakdown: Record<TechnicalStage, number>;
}

export interface TechnicalJobRow {
  contractId: string;
  jobOrderNo: string | null;
  referenceNumber: string;
  projectName: string;
  clientEmployer: string;
  contractManager: string;
  currentStage: TechnicalStage | null;
  nextStage: TechnicalStage | null;
  status: TechnicalWorkflowStatus | null;
  priority: string | null;
  dueDate: string | null;
  assignedTo: string | null;
  updatedAt: string;
  workflowStarted: boolean;
}

export type TechnicalAttentionReason =
  | 'OVERDUE_PLANNED_REVIEW'
  | 'URGENT_PRIORITY'
  | 'DRAWING_RECEIVED_NOT_COMPLETED'
  | 'CLARIFICATION_REQUESTED'
  | 'WAITING_APPROVAL_TOO_LONG'
  | 'OVERDUE_TARGET_APPROVAL'
  | 'OVERDUE_EXPECTED_APPROVAL'
  | 'OVERDUE_FD_ISSUE_DATE';

export interface TechnicalAttentionItem {
  contractId: string;
  jobOrderNo: string | null;
  referenceNumber: string;
  projectName: string;
  reason: TechnicalAttentionReason;
  detail: string;
  /** FMP-TECH-05 — the workflow's real currentStage at the moment this condition was detected, so the dashboard's Needs Attention panel can show a stage badge without a separate lookup. Every source query already knows this stage literally (it's part of the query's own WHERE clause) or has it selected already, so this is a response-shape addition only — no new query, no business-logic change. */
  stage: TechnicalStage;
}

export interface TechnicalActivityFeedItem {
  id: string;
  contractId: string;
  jobOrderNo: string | null;
  referenceNumber: string;
  event: string;
  stage: TechnicalStage;
  actorName: string | null;
  createdAt: string;
}

const STAGE_ORDER: TechnicalStage[] = [
  TechnicalStage.DRAWING_RECEIVED,
  TechnicalStage.SD_CALCULATION_SUBMISSION,
  TechnicalStage.GETTING_APPROVAL,
  TechnicalStage.FD_ISSUANCE,
];

export const TECHNICAL_STAGE_LABELS: Record<TechnicalStage, string> = {
  DRAWING_RECEIVED: 'Drawing Received',
  SD_CALCULATION_SUBMISSION: 'SD & Calculation Submission',
  GETTING_APPROVAL: 'Getting Approval',
  FD_ISSUANCE: 'FD Issuance',
};

/** Pure function: the stage after `stage`, or null once at the last stage (FD Issuance has no next stage — completing it finishes the workflow). */
export function nextStageOf(stage: TechnicalStage): TechnicalStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1]! : null;
}

const REQUIRED_COMPLETE_FIELDS: (keyof SaveDrawingReceivedDto)[] = [
  'receivedDate',
  'receivedFrom',
  'drawingType',
  'drawingReferenceNo',
  'revisionNo',
  'numberOfSheets',
  'drawingDescription',
  'relatedAreaPackage',
  'linkedWorkflowStage',
  'internalReferenceNo',
  'assignedToUserId',
  'plannedReviewStart',
];

// FMP-TECH-02 — the ticket's own two SD & Calculation actions ask for
// different validation depths: "Submit SD & Calculation" checks the "core
// submission fields," while "Complete & Move to Getting Approval" checks
// "all required fields" plus the related-drawing/attachment rules below.
// The ticket's own field list is ambiguous about which of the 12 form
// fields count as "core" vs. only-required-at-completion — this codebase's
// own reading: Target Approval Date and Related Drawing Received are the
// two fields that only make sense to demand once a submission is actually
// being handed off to the next stage, not merely recorded/submitted for the
// record, so CORE excludes them and COMPLETE adds them back.
const CORE_SD_SUBMIT_FIELDS: (keyof SaveSdCalculationSubmissionDto)[] = [
  'submissionDate',
  'submissionType',
  'submittedTo',
  'drawingReferenceNo',
  'revisionNo',
  'calculationType',
  'numberOfSheetsOrFiles',
  'scopeDescription',
  'submissionMethod',
  'referenceSubmissionNo',
];

const COMPLETE_SD_REQUIRED_FIELDS: (keyof SaveSdCalculationSubmissionDto)[] = [
  ...CORE_SD_SUBMIT_FIELDS,
  'targetApprovalDate',
  'relatedDrawingId',
];

// FMP-TECH-03 — the ticket's own explicit "Required fields" list for the
// Approval Information form. Used by Approve & Move to FD Issuance (the
// stage's one "full validation" action) — Save Draft stays lenient (same
// draft-first philosophy as Drawing Received/SD Submission), and Send Back
// for Changes / Reject each only require their own narrow field (resubmission
// reason / reviewer comments respectively), checked separately.
const CORE_APPROVAL_REQUIRED_FIELDS: (keyof SaveGettingApprovalDto)[] = [
  'relatedSdSubmissionId',
  'submittedOn',
  'submittedTo',
  'approvalStatus',
  'expectedApprovalDate',
  'revisionNo',
];

// FMP-TECH-04 — the ticket's own "Submit FD Issue" (lighter) vs "Issue FD &
// Complete Technical Workflow" (full validation) split mirrors the SD
// stage's Submit/Complete split exactly. Related Approval, Approved
// Reference No, and Approved Date are the 3 fields that only make sense to
// demand once the issuance is actually being finalized against a confirmed
// approval — same reasoning CORE_SD_SUBMIT_FIELDS uses to exclude Target
// Approval Date/Related Drawing — so CORE excludes them and COMPLETE adds
// them back, matching the ticket's own full 12-field "Required fields" list.
const CORE_FD_SUBMIT_FIELDS: (keyof SaveFdIssuanceDto)[] = [
  'fdIssueDate',
  'issuedTo',
  'purposeFor',
  'issueType',
  'drawingReferenceNo',
  'revisionNo',
  'numberOfSheetsOrFiles',
  'distribution',
  'issueMethod',
];

const COMPLETE_FD_REQUIRED_FIELDS: (keyof SaveFdIssuanceDto)[] = [
  ...CORE_FD_SUBMIT_FIELDS,
  'relatedApprovalId',
  'approvedReferenceNo',
  'approvedDate',
];

@Injectable()
export class TechnicalService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly attachmentStorage: TechnicalAttachmentStorageService,
  ) {}

  private requireRead(actor: AuthUser): void {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
  }

  /** Manager (contracts.update) or staff (contracts.workflow_update) — the same pair contract-workflow.service.ts already uses for team-task writes. */
  private requireWrite(actor: AuthUser): void {
    if (!actor.permissions.includes('contracts.update') && !actor.permissions.includes('contracts.workflow_update')) {
      throw new ForbiddenException({
        code: 'CONTRACTS_PERMISSION_DENIED',
        message: 'Missing contracts.update or contracts.workflow_update',
      });
    }
  }

  private async loadContractOrThrow(contractId: string, actor: AuthUser) {
    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: CONTRACT_SUMMARY_SELECT,
    });
    if (!contract) {
      throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    }
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);
    return contract;
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  async getDashboard(actor: AuthUser): Promise<TechnicalDashboardResult> {
    this.requireRead(actor);

    const deptFilter = await this.deptAccess.buildDeptFilter(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT);
    const contractWhere = {
      status: NOT_CANCELLED_STATUS,
      ...(deptFilter !== null ? { departmentId: deptFilter } : {}),
    };

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    // FMP-TECH-01C — everything the redesigned dashboard needs (summary
    // counts, the jobs list with its latest-drawing due date/assignee,
    // Needs Attention, Recent Activity, and the stage breakdown) is
    // gathered in ONE batch of targeted queries here, not one call per
    // section — recentActivitiesRaw is deliberately fetched once and reused
    // for both the Recent Activity feed AND clarification detection inside
    // Needs Attention, rather than querying activities twice.
    const [
      pendingTechnicalReview,
      drawingReceived,
      sdCalculationPending,
      waitingApproval,
      fdIssued,
      readyForProductionRelease,
      contracts,
      overdueReviewDrawings,
      urgentWorkflows,
      staleDrawingReceived,
      staleWaitingApproval,
      overdueTargetApprovals,
      overdueExpectedApprovals,
      overdueFdIssueDates,
      recentActivitiesRaw,
    ] = await Promise.all([
      this.db.getClient().contract.count({ where: { ...contractWhere, technicalWorkflow: null } }),
      this.db.getClient().technicalWorkflow.count({ where: { currentStage: TechnicalStage.DRAWING_RECEIVED, contract: contractWhere } }),
      this.db.getClient().technicalWorkflow.count({ where: { currentStage: TechnicalStage.SD_CALCULATION_SUBMISSION, contract: contractWhere } }),
      this.db.getClient().technicalWorkflow.count({ where: { currentStage: TechnicalStage.GETTING_APPROVAL, contract: contractWhere } }),
      this.db.getClient().technicalWorkflow.count({ where: { currentStage: TechnicalStage.FD_ISSUANCE, contract: contractWhere } }),
      this.db.getClient().technicalWorkflow.count({ where: { status: TechnicalWorkflowStatus.COMPLETED, contract: contractWhere } }),
      this.db.getClient().contract.findMany({
        where: contractWhere,
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          ...CONTRACT_SUMMARY_SELECT,
          technicalWorkflow: {
            select: {
              currentStage: true,
              status: true,
              priority: true,
              updatedAt: true,
              drawings: {
                take: 1,
                orderBy: { createdAt: 'desc' },
                select: { plannedReviewStart: true, assignedToUser: { select: { displayName: true } } },
              },
            },
          },
        },
      }),
      this.db.getClient().technicalDrawing.findMany({
        where: { plannedReviewStart: { lt: todayStart }, status: { not: TechnicalDrawingStatus.COMPLETED }, contract: contractWhere },
        select: { contractId: true, plannedReviewStart: true, contract: { select: { jobOrder: true, referenceNumber: true, title: true } } },
        take: 20,
      }),
      this.db.getClient().technicalWorkflow.findMany({
        where: { priority: 'URGENT', status: TechnicalWorkflowStatus.IN_PROGRESS, contract: contractWhere },
        select: { contractId: true, currentStage: true, contract: { select: { jobOrder: true, referenceNumber: true, title: true } } },
        take: 20,
      }),
      this.db.getClient().technicalDrawing.findMany({
        where: { status: { not: TechnicalDrawingStatus.COMPLETED }, technicalWorkflow: { currentStage: TechnicalStage.DRAWING_RECEIVED, contract: contractWhere } },
        select: { contractId: true, contract: { select: { jobOrder: true, referenceNumber: true, title: true } } },
        take: 20,
      }),
      this.db.getClient().technicalWorkflow.findMany({
        where: { currentStage: TechnicalStage.GETTING_APPROVAL, status: TechnicalWorkflowStatus.IN_PROGRESS, updatedAt: { lt: sevenDaysAgo }, contract: contractWhere },
        select: { contractId: true, updatedAt: true, contract: { select: { jobOrder: true, referenceNumber: true, title: true } } },
        take: 20,
      }),
      // FMP-TECH-02 — an SD & Calculation Submission whose real target
      // approval date has passed and hasn't been completed yet.
      this.db.getClient().technicalSdCalculationSubmission.findMany({
        where: { targetApprovalDate: { lt: todayStart }, status: { not: TechnicalSdSubmissionStatus.COMPLETED }, contract: contractWhere },
        select: { contractId: true, targetApprovalDate: true, contract: { select: { jobOrder: true, referenceNumber: true, title: true } } },
        take: 20,
      }),
      // FMP-TECH-03 — a Getting Approval record whose real expected approval
      // date has passed and hasn't been completed yet.
      this.db.getClient().technicalApproval.findMany({
        where: { expectedApprovalDate: { lt: todayStart }, status: { not: TechnicalApprovalRecordStatus.COMPLETED }, contract: contractWhere },
        select: { contractId: true, expectedApprovalDate: true, contract: { select: { jobOrder: true, referenceNumber: true, title: true } } },
        take: 20,
      }),
      // FMP-TECH-04 — an FD Issuance record whose real FD Issue Date has
      // passed and hasn't been issued/completed yet.
      this.db.getClient().technicalFdIssuance.findMany({
        where: { fdIssueDate: { lt: todayStart }, status: { notIn: [TechnicalFdStatus.ISSUED, TechnicalFdStatus.COMPLETED] }, contract: contractWhere },
        select: { contractId: true, fdIssueDate: true, contract: { select: { jobOrder: true, referenceNumber: true, title: true } } },
        take: 20,
      }),
      this.db.getClient().technicalWorkflowActivity.findMany({
        where: { technicalWorkflow: { contract: contractWhere } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          event: true,
          actorName: true,
          createdAt: true,
          previousStage: true,
          newStage: true,
          technicalWorkflowId: true,
          technicalWorkflow: {
            select: { contractId: true, currentStage: true, contract: { select: { jobOrder: true, referenceNumber: true, title: true } } },
          },
        },
      }),
    ]);

    const jobs: TechnicalJobRow[] = contracts.map((c) => {
      const wf = c.technicalWorkflow;
      const latestDrawing = wf?.drawings[0];
      return {
        contractId: c.id,
        jobOrderNo: c.jobOrder,
        referenceNumber: c.referenceNumber,
        projectName: c.title,
        clientEmployer: c.counterpartyName,
        contractManager: c.ownerUser.displayName,
        currentStage: wf?.currentStage ?? null,
        nextStage: wf ? nextStageOf(wf.currentStage) : TechnicalStage.DRAWING_RECEIVED,
        status: wf?.status ?? null,
        priority: wf?.priority ?? null,
        dueDate: latestDrawing?.plannedReviewStart?.toISOString() ?? null,
        assignedTo: latestDrawing?.assignedToUser?.displayName ?? null,
        updatedAt: (wf?.updatedAt ?? c.updatedAt).toISOString(),
        workflowStarted: wf !== null,
      };
    });

    // Most recent activity per workflow (recentActivitiesRaw is already
    // ordered newest-first, so the first occurrence of each workflowId is
    // its latest) — used to flag a workflow whose latest action is still an
    // unresolved clarification request.
    const latestActivityByWorkflow = new Map<string, (typeof recentActivitiesRaw)[number]>();
    for (const a of recentActivitiesRaw) {
      if (!latestActivityByWorkflow.has(a.technicalWorkflowId)) latestActivityByWorkflow.set(a.technicalWorkflowId, a);
    }

    const needsAttention: TechnicalAttentionItem[] = [
      ...overdueReviewDrawings.map((d): TechnicalAttentionItem => ({
        contractId: d.contractId,
        jobOrderNo: d.contract.jobOrder,
        referenceNumber: d.contract.referenceNumber,
        projectName: d.contract.title,
        reason: 'OVERDUE_PLANNED_REVIEW',
        detail: `Planned review start was ${d.plannedReviewStart!.toISOString().slice(0, 10)} and has passed.`,
        stage: TechnicalStage.DRAWING_RECEIVED,
      })),
      ...urgentWorkflows.map((w): TechnicalAttentionItem => ({
        contractId: w.contractId,
        jobOrderNo: w.contract.jobOrder,
        referenceNumber: w.contract.referenceNumber,
        projectName: w.contract.title,
        reason: 'URGENT_PRIORITY',
        detail: 'Marked Urgent priority.',
        stage: w.currentStage,
      })),
      ...staleDrawingReceived.map((d): TechnicalAttentionItem => ({
        contractId: d.contractId,
        jobOrderNo: d.contract.jobOrder,
        referenceNumber: d.contract.referenceNumber,
        projectName: d.contract.title,
        reason: 'DRAWING_RECEIVED_NOT_COMPLETED',
        detail: 'Drawing received but the step has not been completed yet.',
        stage: TechnicalStage.DRAWING_RECEIVED,
      })),
      ...staleWaitingApproval.map((w): TechnicalAttentionItem => ({
        contractId: w.contractId,
        jobOrderNo: w.contract.jobOrder,
        referenceNumber: w.contract.referenceNumber,
        projectName: w.contract.title,
        reason: 'WAITING_APPROVAL_TOO_LONG',
        detail: `Waiting on approval since ${w.updatedAt.toISOString().slice(0, 10)} (over 7 days).`,
        stage: TechnicalStage.GETTING_APPROVAL,
      })),
      ...overdueTargetApprovals.map((s): TechnicalAttentionItem => ({
        contractId: s.contractId,
        jobOrderNo: s.contract.jobOrder,
        referenceNumber: s.contract.referenceNumber,
        projectName: s.contract.title,
        reason: 'OVERDUE_TARGET_APPROVAL',
        detail: `Target approval date was ${s.targetApprovalDate!.toISOString().slice(0, 10)} and has passed.`,
        stage: TechnicalStage.SD_CALCULATION_SUBMISSION,
      })),
      ...overdueExpectedApprovals.map((a): TechnicalAttentionItem => ({
        contractId: a.contractId,
        jobOrderNo: a.contract.jobOrder,
        referenceNumber: a.contract.referenceNumber,
        projectName: a.contract.title,
        reason: 'OVERDUE_EXPECTED_APPROVAL',
        detail: `Expected approval date was ${a.expectedApprovalDate!.toISOString().slice(0, 10)} and has passed.`,
        stage: TechnicalStage.GETTING_APPROVAL,
      })),
      ...overdueFdIssueDates.map((f): TechnicalAttentionItem => ({
        contractId: f.contractId,
        jobOrderNo: f.contract.jobOrder,
        referenceNumber: f.contract.referenceNumber,
        projectName: f.contract.title,
        reason: 'OVERDUE_FD_ISSUE_DATE',
        detail: `FD Issue Date was ${f.fdIssueDate!.toISOString().slice(0, 10)} and has passed.`,
        stage: TechnicalStage.FD_ISSUANCE,
      })),
      ...Array.from(latestActivityByWorkflow.values())
        .filter((a) => a.event === 'CLARIFICATION_REQUESTED')
        .map((a): TechnicalAttentionItem => ({
          contractId: a.technicalWorkflow.contractId,
          jobOrderNo: a.technicalWorkflow.contract.jobOrder,
          referenceNumber: a.technicalWorkflow.contract.referenceNumber,
          projectName: a.technicalWorkflow.contract.title,
          reason: 'CLARIFICATION_REQUESTED',
          detail: 'A clarification was requested and has not been resolved yet.',
          stage: a.technicalWorkflow.currentStage,
        })),
    ];

    const recentActivities: TechnicalActivityFeedItem[] = recentActivitiesRaw.slice(0, 10).map((a) => ({
      id: a.id,
      contractId: a.technicalWorkflow.contractId,
      jobOrderNo: a.technicalWorkflow.contract.jobOrder,
      referenceNumber: a.technicalWorkflow.contract.referenceNumber,
      event: a.event,
      stage: a.newStage ?? a.previousStage ?? a.technicalWorkflow.currentStage,
      actorName: a.actorName,
      createdAt: a.createdAt.toISOString(),
    }));

    return {
      metrics: {
        pendingTechnicalReview,
        drawingReceived,
        sdCalculationPending,
        waitingApproval,
        fdIssued,
        readyForProductionRelease,
        needsAttention: needsAttention.length,
      },
      jobs,
      needsAttention,
      recentActivities,
      stageBreakdown: {
        DRAWING_RECEIVED: drawingReceived,
        SD_CALCULATION_SUBMISSION: sdCalculationPending,
        GETTING_APPROVAL: waitingApproval,
        FD_ISSUANCE: fdIssued,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Workflow overview / start
  // ---------------------------------------------------------------------------

  async getWorkflowOverview(contractId: string, actor: AuthUser): Promise<{
    contract: Awaited<ReturnType<TechnicalService['loadContractOrThrow']>>;
    workflow: (TechnicalWorkflow & { assignedToUser: { id: string; displayName: string } | null }) | null;
    nextStage: TechnicalStage | null;
  }> {
    this.requireRead(actor);
    const contract = await this.loadContractOrThrow(contractId, actor);

    const workflow = await this.db.getClient().technicalWorkflow.findUnique({
      where: { contractId },
      include: { assignedToUser: { select: { id: true, displayName: true } } },
    });

    return {
      contract,
      workflow,
      nextStage: workflow ? nextStageOf(workflow.currentStage) : TechnicalStage.DRAWING_RECEIVED,
    };
  }

  /** Idempotent — re-calling on an already-started contract just returns the existing workflow, never a duplicate or an error. */
  async startWorkflow(contractId: string, actor: AuthUser): Promise<TechnicalWorkflow> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);

    const existing = await this.db.getClient().technicalWorkflow.findUnique({ where: { contractId } });
    if (existing) return existing;

    const workflow = await this.db.getClient().technicalWorkflow.create({
      data: { contractId, createdByUserId: actor.id },
    });

    await this.logActivity(workflow.id, actor, 'WORKFLOW_STARTED', null, workflow.currentStage);

    return workflow;
  }

  private async requireWorkflow(contractId: string): Promise<TechnicalWorkflow> {
    const workflow = await this.db.getClient().technicalWorkflow.findUnique({ where: { contractId } });
    if (!workflow) {
      throw new NotFoundException({
        code: 'TECHNICAL_WORKFLOW_NOT_STARTED',
        message: 'Technical workflow not started for this contract',
      });
    }
    return workflow;
  }

  private async logActivity(
    technicalWorkflowId: string,
    actor: AuthUser,
    event: string,
    previousStage: TechnicalStage | null,
    newStage: TechnicalStage | null,
    metadata?: Record<string, string>,
  ): Promise<void> {
    await this.db.getClient().technicalWorkflowActivity.create({
      data: {
        technicalWorkflowId,
        actorUserId: actor.id,
        actorName: actor.displayName,
        event,
        previousStage,
        newStage,
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Drawing Received screen
  // ---------------------------------------------------------------------------

  async getDrawingReceived(contractId: string, actor: AuthUser): Promise<{
    contract: Awaited<ReturnType<TechnicalService['loadContractOrThrow']>>;
    workflow: TechnicalWorkflow;
    drawing: TechnicalDrawing | null;
    attachments: unknown[];
    activities: unknown[];
    nextStage: TechnicalStage | null;
  }> {
    this.requireRead(actor);
    const contract = await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const [drawing, activities] = await Promise.all([
      this.db.getClient().technicalDrawing.findFirst({
        where: { technicalWorkflowId: workflow.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.getClient().technicalWorkflowActivity.findMany({
        where: { technicalWorkflowId: workflow.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const attachments = drawing ? await this.listAttachmentsForDrawing(drawing.id) : [];

    return {
      contract,
      workflow,
      drawing,
      attachments,
      activities,
      nextStage: nextStageOf(workflow.currentStage),
    };
  }

  /** Shared by save-draft and the attachment upload path — the intake record is created implicitly by whichever happens first (a field save or a file upload), never requiring an artificial ordering. */
  private async getOrCreateDrawing(workflow: TechnicalWorkflow, contractId: string, actor: AuthUser): Promise<{ drawing: TechnicalDrawing; created: boolean }> {
    const existing = await this.db.getClient().technicalDrawing.findFirst({
      where: { technicalWorkflowId: workflow.id },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { drawing: existing, created: false };

    const drawing = await this.db.getClient().technicalDrawing.create({
      data: { technicalWorkflowId: workflow.id, contractId, createdByUserId: actor.id },
    });
    return { drawing, created: true };
  }

  async saveDrawingReceivedDraft(contractId: string, dto: SaveDrawingReceivedDto, actor: AuthUser): Promise<TechnicalDrawing> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    if (workflow.currentStage !== TechnicalStage.DRAWING_RECEIVED) {
      throw new ConflictException({
        code: 'TECHNICAL_STAGE_ALREADY_ADVANCED',
        message: 'Drawing Received has already been completed for this workflow',
      });
    }

    const { drawing: existing, created } = await this.getOrCreateDrawing(workflow, contractId, actor);

    const updated = await this.db.getClient().technicalDrawing.update({
      where: { id: existing.id },
      data: toUpdateData(dto),
    });

    await this.logActivity(
      workflow.id,
      actor,
      created ? 'DRAWING_PACKAGE_RECEIVED' : 'DETAILS_SAVED',
      null,
      null,
    );

    return updated;
  }

  async requestClarification(contractId: string, note: string, actor: AuthUser): Promise<void> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    await this.logActivity(workflow.id, actor, 'CLARIFICATION_REQUESTED', null, null, { note });
  }

  async completeDrawingReceived(contractId: string, dto: SaveDrawingReceivedDto, actor: AuthUser): Promise<{ workflow: TechnicalWorkflow; nextStage: TechnicalStage | null }> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    if (workflow.currentStage !== TechnicalStage.DRAWING_RECEIVED) {
      throw new ConflictException({
        code: 'TECHNICAL_STAGE_ALREADY_ADVANCED',
        message: 'Drawing Received has already been completed for this workflow',
      });
    }

    const missing = REQUIRED_COMPLETE_FIELDS.filter((field) => dto[field] === undefined || dto[field] === null || dto[field] === '');
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_DRAWING_RECEIVED_INCOMPLETE',
        message: `Missing required fields: ${missing.join(', ')}`,
        details: { missing },
      });
    }

    const receivedDate = new Date(dto.receivedDate!);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    if (receivedDate.getTime() > todayEnd.getTime()) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_RECEIVED_DATE_IN_FUTURE',
        message: 'Received Date cannot be in the future',
      });
    }

    const plannedReviewStart = new Date(dto.plannedReviewStart!);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    if (plannedReviewStart.getTime() < todayStart.getTime()) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_PLANNED_REVIEW_START_IN_PAST',
        message: 'Planned Review Start must be today or a future date',
      });
    }

    const { drawing: existing } = await this.getOrCreateDrawing(workflow, contractId, actor);

    await this.db.getClient().technicalDrawing.update({
      where: { id: existing.id },
      data: { ...toUpdateData(dto), status: TechnicalDrawingStatus.COMPLETED, completedAt: new Date() },
    });

    const newStage = nextStageOf(workflow.currentStage) ?? workflow.currentStage;
    const updatedWorkflow = await this.db.getClient().technicalWorkflow.update({
      where: { id: workflow.id },
      data: { currentStage: newStage },
    });

    await this.logActivity(workflow.id, actor, 'DRAWING_RECEIVED_COMPLETED', workflow.currentStage, newStage);

    return { workflow: updatedWorkflow, nextStage: nextStageOf(newStage) };
  }

  // ---------------------------------------------------------------------------
  // Attachments
  // ---------------------------------------------------------------------------

  private async listAttachmentsForDrawing(technicalDrawingId: string): Promise<unknown[]> {
    return this.db.getClient().technicalDrawingAttachment.findMany({
      where: { technicalDrawingId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalFileName: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        uploadedByUserId: true,
        createdAt: true,
        uploadedByUser: { select: { id: true, displayName: true, username: true } },
      },
    });
  }

  async listAttachments(contractId: string, actor: AuthUser): Promise<unknown[]> {
    this.requireRead(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    const drawing = await this.db.getClient().technicalDrawing.findFirst({ where: { technicalWorkflowId: workflow.id }, orderBy: { createdAt: 'desc' } });
    if (!drawing) return [];
    return this.listAttachmentsForDrawing(drawing.id);
  }

  async createAttachment(
    contractId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    if (!(TECHNICAL_DRAWING_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: JPG/PNG/WEBP images, PDF/DOC/DOCX/XLS/XLSX documents, DWG/DXF drawings.',
      });
    }
    if (file.size > TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { drawing } = await this.getOrCreateDrawing(workflow, contractId, actor);
    const { fileName, storagePath } = await this.attachmentStorage.save(drawing.id, file.buffer, file.originalname);

    const attachment = await this.db.getClient().technicalDrawingAttachment.create({
      data: {
        technicalDrawingId: drawing.id,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: {
        id: true,
        originalFileName: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        uploadedByUserId: true,
        createdAt: true,
      },
    });

    await this.logActivity(workflow.id, actor, 'FILES_UPLOADED', null, null, { fileName: file.originalname });

    return attachment;
  }

  async getAttachmentForDownload(
    contractId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    this.requireRead(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const attachment = await this.db.getClient().technicalDrawingAttachment.findFirst({
      where: { id: attachmentId, technicalDrawing: { technicalWorkflowId: workflow.id } },
      select: { storagePath: true, originalFileName: true, mimeType: true },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'TECHNICAL_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }
    return attachment;
  }

  async deleteAttachment(contractId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const attachment = await this.db.getClient().technicalDrawingAttachment.findFirst({
      where: { id: attachmentId, technicalDrawing: { technicalWorkflowId: workflow.id } },
      select: { id: true, storagePath: true, originalFileName: true, uploadedByUserId: true },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'TECHNICAL_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }
    if (attachment.uploadedByUserId !== actor.id && !actor.permissions.includes('contracts.manage')) {
      throw new ForbiddenException({
        code: 'TECHNICAL_ATTACHMENT_NOT_OWNER',
        message: 'You can only delete a file you uploaded, unless you have contracts.manage',
      });
    }

    await this.db.getClient().technicalDrawingAttachment.delete({ where: { id: attachmentId } });
    await this.attachmentStorage.deleteFile(attachment.storagePath);

    await this.logActivity(workflow.id, actor, 'ATTACHMENT_REMOVED', null, null, { fileName: attachment.originalFileName });
  }

  // ---------------------------------------------------------------------------
  // FMP-TECH-02 — SD & Calculation Submission screen (Technical Stage 2).
  // Mirrors the Drawing Received methods above exactly in shape; the one
  // real difference is `relatedDrawingId`, which must point at a real,
  // COMPLETED TechnicalDrawing belonging to this SAME workflow — enforced
  // by assertRelatedDrawingValid() below, never trusting an id the caller
  // sends without re-checking it server-side.
  // ---------------------------------------------------------------------------

  async getSdCalculationSubmission(contractId: string, actor: AuthUser): Promise<{
    contract: Awaited<ReturnType<TechnicalService['loadContractOrThrow']>>;
    workflow: TechnicalWorkflow;
    submission: TechnicalSdCalculationSubmission | null;
    completedDrawings: { id: string; drawingReferenceNo: string | null; revisionNo: string | null; receivedDate: Date | null }[];
    attachments: unknown[];
    activities: unknown[];
    nextStage: TechnicalStage | null;
  }> {
    this.requireRead(actor);
    const contract = await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const [submission, completedDrawings, activities] = await Promise.all([
      this.db.getClient().technicalSdCalculationSubmission.findFirst({
        where: { technicalWorkflowId: workflow.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.getClient().technicalDrawing.findMany({
        where: { technicalWorkflowId: workflow.id, status: TechnicalDrawingStatus.COMPLETED },
        orderBy: { createdAt: 'desc' },
        select: { id: true, drawingReferenceNo: true, revisionNo: true, receivedDate: true },
      }),
      this.db.getClient().technicalWorkflowActivity.findMany({
        where: { technicalWorkflowId: workflow.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const attachments = submission ? await this.listSdAttachmentsForSubmission(submission.id) : [];

    return {
      contract,
      workflow,
      submission,
      completedDrawings,
      attachments,
      activities,
      nextStage: nextStageOf(workflow.currentStage),
    };
  }

  /** Same "created implicitly by whichever happens first" reasoning as getOrCreateDrawing(). */
  private async getOrCreateSdSubmission(workflow: TechnicalWorkflow, contractId: string, actor: AuthUser): Promise<{ submission: TechnicalSdCalculationSubmission; created: boolean }> {
    const existing = await this.db.getClient().technicalSdCalculationSubmission.findFirst({
      where: { technicalWorkflowId: workflow.id },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { submission: existing, created: false };

    const submission = await this.db.getClient().technicalSdCalculationSubmission.create({
      data: { technicalWorkflowId: workflow.id, contractId, createdByUserId: actor.id },
    });
    return { submission, created: true };
  }

  /** relatedDrawingId must belong to THIS workflow (never another contract's drawing) and be a completed record — re-checked server-side on every write, never trusted from the request alone. */
  private async assertRelatedDrawingValid(technicalWorkflowId: string, relatedDrawingId: string): Promise<void> {
    const drawing = await this.db.getClient().technicalDrawing.findFirst({
      where: { id: relatedDrawingId, technicalWorkflowId },
      select: { id: true, status: true },
    });
    if (!drawing) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_RELATED_DRAWING_INVALID',
        message: 'Related Drawing Received must belong to this same job order',
      });
    }
    if (drawing.status !== TechnicalDrawingStatus.COMPLETED) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_RELATED_DRAWING_NOT_COMPLETED',
        message: 'Related Drawing Received must be a completed record',
      });
    }
  }

  private assertSdDateRules(dto: SaveSdCalculationSubmissionDto): void {
    if (dto.submissionDate !== undefined) {
      const submissionDate = new Date(dto.submissionDate);
      const todayEnd = new Date();
      todayEnd.setUTCHours(23, 59, 59, 999);
      if (submissionDate.getTime() > todayEnd.getTime()) {
        throw new UnprocessableEntityException({
          code: 'TECHNICAL_SUBMISSION_DATE_IN_FUTURE',
          message: 'Submission Date cannot be in the future',
        });
      }
    }
    if (dto.submissionDate !== undefined && dto.targetApprovalDate !== undefined) {
      const submissionDate = new Date(dto.submissionDate);
      const targetApprovalDate = new Date(dto.targetApprovalDate);
      if (targetApprovalDate.getTime() < submissionDate.getTime()) {
        throw new UnprocessableEntityException({
          code: 'TECHNICAL_TARGET_APPROVAL_BEFORE_SUBMISSION',
          message: 'Target Approval Date must be the same day or after Submission Date',
        });
      }
    }
  }

  /**
   * A workflow only ever reaches SD_CALCULATION_SUBMISSION by way of
   * completeDrawingReceived() advancing it there — so this single stage
   * check correctly rejects BOTH "too early" (Drawing Received not
   * completed yet, workflow still at DRAWING_RECEIVED) and "too late"
   * (already advanced to GETTING_APPROVAL/FD_ISSUANCE) without needing a
   * separate "is Drawing Received done" query on every write. The
   * ticket's own "Complete Drawing Received before creating SD &
   * Calculation Submission" message is shown by the FRONTEND for the
   * "too early" case (using this same signal — `workflow.currentStage`),
   * not thrown here as a distinct error.
   */
  // FMP-TECH-05L — reworded from the earlier raw "X is not the current
  // stage for this workflow" text: internal staff can now attempt this
  // action from any stage page at any time, so a rejection needs to read
  // as ordinary guidance, not a bureaucratic restriction notice. The
  // underlying rule (submit/complete only while this genuinely is the
  // current stage) is unchanged.
  private assertSdStageIsCurrent(workflow: TechnicalWorkflow): void {
    if (workflow.currentStage !== TechnicalStage.SD_CALCULATION_SUBMISSION) {
      throw new ConflictException({
        code: 'TECHNICAL_STAGE_NOT_CURRENT',
        message: "This workflow isn't at the SD & Calculation Submission stage right now, so this action isn't available yet.",
      });
    }
  }

  /**
   * FMP-TECH-05K — Save Draft must work even before this stage is reached
   * (internal staff prepare future-stage data ahead of time), so this
   * checks only that the workflow hasn't already moved PAST this stage —
   * unlike assertSdStageIsCurrent() (still used by Submit/Complete below,
   * unchanged), which requires this to be the exact current stage.
   */
  private assertSdStageNotAlreadyPassed(workflow: TechnicalWorkflow): void {
    if (STAGE_ORDER.indexOf(TechnicalStage.SD_CALCULATION_SUBMISSION) < STAGE_ORDER.indexOf(workflow.currentStage)) {
      throw new ConflictException({
        code: 'TECHNICAL_STAGE_ALREADY_ADVANCED',
        message: 'SD & Calculation Submission has already been completed for this workflow',
      });
    }
  }

  async saveSdSubmissionDraft(contractId: string, dto: SaveSdCalculationSubmissionDto, actor: AuthUser): Promise<TechnicalSdCalculationSubmission> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    this.assertSdStageNotAlreadyPassed(workflow);
    this.assertSdDateRules(dto);
    if (dto.relatedDrawingId !== undefined) await this.assertRelatedDrawingValid(workflow.id, dto.relatedDrawingId);

    const { submission: existing } = await this.getOrCreateSdSubmission(workflow, contractId, actor);
    const updated = await this.db.getClient().technicalSdCalculationSubmission.update({
      where: { id: existing.id },
      data: toSdUpdateData(dto),
    });

    await this.logActivity(workflow.id, actor, 'SD_SUBMISSION_SAVED', null, null);
    return updated;
  }

  async submitSdCalculation(contractId: string, dto: SaveSdCalculationSubmissionDto, actor: AuthUser): Promise<TechnicalSdCalculationSubmission> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    this.assertSdStageIsCurrent(workflow);

    const missing = CORE_SD_SUBMIT_FIELDS.filter((field) => dto[field] === undefined || dto[field] === null || dto[field] === '');
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_SD_SUBMISSION_INCOMPLETE',
        message: `Missing required fields: ${missing.join(', ')}`,
        details: { missing },
      });
    }
    this.assertSdDateRules(dto);
    if (dto.relatedDrawingId !== undefined) await this.assertRelatedDrawingValid(workflow.id, dto.relatedDrawingId);

    const { submission: existing } = await this.getOrCreateSdSubmission(workflow, contractId, actor);
    const updated = await this.db.getClient().technicalSdCalculationSubmission.update({
      where: { id: existing.id },
      data: { ...toSdUpdateData(dto), status: TechnicalSdSubmissionStatus.SUBMITTED },
    });

    // "Submit" records the submission but deliberately does NOT advance
    // TechnicalWorkflow.currentStage — per the ticket's own "does not move
    // to Getting Approval yet" instruction. Only Complete & Move to Getting
    // Approval (below) advances the stage.
    await this.logActivity(workflow.id, actor, 'SD_CALCULATION_SUBMITTED', null, null);
    return updated;
  }

  async requestSdClarification(contractId: string, note: string, actor: AuthUser): Promise<void> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const submission = await this.db.getClient().technicalSdCalculationSubmission.findFirst({
      where: { technicalWorkflowId: workflow.id },
      orderBy: { createdAt: 'desc' },
    });
    // Unlike Drawing Received's clarification (activity-only — TechnicalDrawing
    // has no clarification status value), TechnicalSdSubmissionStatus DOES
    // define CLARIFICATION_REQUESTED, so the ticket's own "records
    // clarification activity/status" is honored literally when a submission
    // record already exists to carry that status.
    if (submission) {
      await this.db.getClient().technicalSdCalculationSubmission.update({
        where: { id: submission.id },
        data: { status: TechnicalSdSubmissionStatus.CLARIFICATION_REQUESTED },
      });
    }

    await this.logActivity(workflow.id, actor, 'SD_CLARIFICATION_REQUESTED', null, null, { note });
  }

  async completeSdCalculationSubmission(contractId: string, dto: SaveSdCalculationSubmissionDto, actor: AuthUser): Promise<{ workflow: TechnicalWorkflow; nextStage: TechnicalStage | null }> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    this.assertSdStageIsCurrent(workflow);

    const missing = COMPLETE_SD_REQUIRED_FIELDS.filter((field) => dto[field] === undefined || dto[field] === null || dto[field] === '');
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_SD_SUBMISSION_INCOMPLETE',
        message: `Missing required fields: ${missing.join(', ')}`,
        details: { missing },
      });
    }
    this.assertSdDateRules(dto);
    await this.assertRelatedDrawingValid(workflow.id, dto.relatedDrawingId!);

    const { submission: existing } = await this.getOrCreateSdSubmission(workflow, contractId, actor);

    // Completion attachment rule — the ticket's own documented fallback: no
    // file-category taxonomy exists yet to distinguish "a drawing/submission
    // file" from "a calculation file," so this requires at least ONE
    // attachment rather than the stricter "one of each" rule the ticket's
    // own ideal version describes. Flagged as a future enhancement in this
    // unit's own final report.
    const attachmentCount = await this.db.getClient().technicalSdSubmissionAttachment.count({
      where: { technicalSdSubmissionId: existing.id },
    });
    if (attachmentCount === 0) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_SD_SUBMISSION_ATTACHMENT_REQUIRED',
        message: 'At least one attachment is required before completing this stage',
      });
    }

    await this.db.getClient().technicalSdCalculationSubmission.update({
      where: { id: existing.id },
      data: { ...toSdUpdateData(dto), status: TechnicalSdSubmissionStatus.COMPLETED, completedAt: new Date() },
    });

    const newStage = nextStageOf(workflow.currentStage) ?? workflow.currentStage;
    const updatedWorkflow = await this.db.getClient().technicalWorkflow.update({
      where: { id: workflow.id },
      data: { currentStage: newStage },
    });

    await this.logActivity(workflow.id, actor, 'SD_CALCULATION_STAGE_COMPLETED', workflow.currentStage, newStage);

    return { workflow: updatedWorkflow, nextStage: nextStageOf(newStage) };
  }

  // ---------------------------------------------------------------------------
  // SD & Calculation Submission attachments — same TechnicalAttachmentStorageService,
  // same allowed MIME types/size limit as Drawing Received attachments (the
  // ticket's own "Allowed file types: PDF, DWG, XLSX, DOCX, JPG, PNG" is
  // already fully covered by TECHNICAL_DRAWING_ATTACHMENT_ALLOWED_MIME_TYPES —
  // no new storage code needed, only a new metadata table/folder namespace).
  // ---------------------------------------------------------------------------

  private async listSdAttachmentsForSubmission(technicalSdSubmissionId: string): Promise<unknown[]> {
    return this.db.getClient().technicalSdSubmissionAttachment.findMany({
      where: { technicalSdSubmissionId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalFileName: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        uploadedByUserId: true,
        createdAt: true,
        uploadedByUser: { select: { id: true, displayName: true, username: true } },
      },
    });
  }

  async listSdAttachments(contractId: string, actor: AuthUser): Promise<unknown[]> {
    this.requireRead(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    const submission = await this.db.getClient().technicalSdCalculationSubmission.findFirst({ where: { technicalWorkflowId: workflow.id }, orderBy: { createdAt: 'desc' } });
    if (!submission) return [];
    return this.listSdAttachmentsForSubmission(submission.id);
  }

  async createSdAttachment(
    contractId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    if (!(TECHNICAL_DRAWING_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: JPG/PNG/WEBP images, PDF/DOC/DOCX/XLS/XLSX documents, DWG/DXF drawings.',
      });
    }
    if (file.size > TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { submission } = await this.getOrCreateSdSubmission(workflow, contractId, actor);
    const { fileName, storagePath } = await this.attachmentStorage.save(submission.id, file.buffer, file.originalname);

    const attachment = await this.db.getClient().technicalSdSubmissionAttachment.create({
      data: {
        technicalSdSubmissionId: submission.id,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: {
        id: true,
        originalFileName: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        uploadedByUserId: true,
        createdAt: true,
      },
    });

    await this.logActivity(workflow.id, actor, 'SD_ATTACHMENTS_UPLOADED', null, null, { fileName: file.originalname });

    return attachment;
  }

  async getSdAttachmentForDownload(
    contractId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    this.requireRead(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const attachment = await this.db.getClient().technicalSdSubmissionAttachment.findFirst({
      where: { id: attachmentId, technicalSdSubmission: { technicalWorkflowId: workflow.id } },
      select: { storagePath: true, originalFileName: true, mimeType: true },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'TECHNICAL_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }
    return attachment;
  }

  async deleteSdAttachment(contractId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const attachment = await this.db.getClient().technicalSdSubmissionAttachment.findFirst({
      where: { id: attachmentId, technicalSdSubmission: { technicalWorkflowId: workflow.id } },
      select: { id: true, storagePath: true, originalFileName: true, uploadedByUserId: true },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'TECHNICAL_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }
    if (attachment.uploadedByUserId !== actor.id && !actor.permissions.includes('contracts.manage')) {
      throw new ForbiddenException({
        code: 'TECHNICAL_ATTACHMENT_NOT_OWNER',
        message: 'You can only delete a file you uploaded, unless you have contracts.manage',
      });
    }

    await this.db.getClient().technicalSdSubmissionAttachment.delete({ where: { id: attachmentId } });
    await this.attachmentStorage.deleteFile(attachment.storagePath);

    await this.logActivity(workflow.id, actor, 'ATTACHMENT_REMOVED', null, null, { fileName: attachment.originalFileName });
  }

  // ---------------------------------------------------------------------------
  // FMP-TECH-03 — Getting Approval (Technical Stage 3). Mirrors the SD &
  // Calculation Submission methods above in shape. The one real behavioral
  // difference is Send Back for Changes, which — unlike a simple activity
  // log — reverts `TechnicalWorkflow.currentStage` back to
  // SD_CALCULATION_SUBMISSION so the existing SD screen's own write methods
  // (already gated on `currentStage === SD_CALCULATION_SUBMISSION`) become
  // writable again for revision, reusing that machinery unchanged rather
  // than building a separate "revision" concept. See
  // sendApprovalBackForChanges()'s own doc comment for the full reasoning.
  // ---------------------------------------------------------------------------

  async getGettingApproval(contractId: string, actor: AuthUser): Promise<{
    contract: Awaited<ReturnType<TechnicalService['loadContractOrThrow']>>;
    workflow: TechnicalWorkflow;
    approval: TechnicalApproval | null;
    eligibleSdSubmissions: { id: string; drawingReferenceNo: string | null; revisionNo: string | null; submissionDate: string | Date | null }[];
    attachments: unknown[];
    activities: unknown[];
    nextStage: TechnicalStage | null;
  }> {
    this.requireRead(actor);
    const contract = await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const [approval, eligibleSdSubmissions, activities] = await Promise.all([
      this.db.getClient().technicalApproval.findFirst({
        where: { technicalWorkflowId: workflow.id },
        orderBy: { createdAt: 'desc' },
      }),
      // "Must list real completed/submitted SD & Calculation Submission
      // records for this workflow" — the ticket's own wording.
      this.db.getClient().technicalSdCalculationSubmission.findMany({
        where: { technicalWorkflowId: workflow.id, status: { in: [TechnicalSdSubmissionStatus.SUBMITTED, TechnicalSdSubmissionStatus.COMPLETED] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, drawingReferenceNo: true, revisionNo: true, submissionDate: true },
      }),
      this.db.getClient().technicalWorkflowActivity.findMany({
        where: { technicalWorkflowId: workflow.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const attachments = approval ? await this.listApprovalAttachmentsForApproval(approval.id) : [];

    return {
      contract,
      workflow,
      approval,
      eligibleSdSubmissions,
      attachments,
      activities,
      nextStage: nextStageOf(workflow.currentStage),
    };
  }

  private async getOrCreateApproval(workflow: TechnicalWorkflow, contractId: string, actor: AuthUser): Promise<{ approval: TechnicalApproval; created: boolean }> {
    const existing = await this.db.getClient().technicalApproval.findFirst({
      where: { technicalWorkflowId: workflow.id },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { approval: existing, created: false };

    const approval = await this.db.getClient().technicalApproval.create({
      data: { technicalWorkflowId: workflow.id, contractId, createdByUserId: actor.id },
    });
    return { approval, created: true };
  }

  /** relatedSdSubmissionId must belong to THIS workflow and be submitted or completed — re-checked server-side, never trusted from the request alone. */
  private async assertRelatedSdSubmissionValid(technicalWorkflowId: string, relatedSdSubmissionId: string): Promise<void> {
    const submission = await this.db.getClient().technicalSdCalculationSubmission.findFirst({
      where: { id: relatedSdSubmissionId, technicalWorkflowId },
      select: { id: true, status: true },
    });
    if (!submission) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_RELATED_SD_SUBMISSION_INVALID',
        message: 'Related SD & Calculation Submission must belong to this same job order',
      });
    }
    if (submission.status !== TechnicalSdSubmissionStatus.SUBMITTED && submission.status !== TechnicalSdSubmissionStatus.COMPLETED) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_RELATED_SD_SUBMISSION_NOT_READY',
        message: 'Related SD & Calculation Submission must be submitted or completed',
      });
    }
  }

  private assertApprovalDateRules(dto: SaveGettingApprovalDto): void {
    if (dto.submittedOn !== undefined && dto.reviewedOn !== undefined) {
      if (new Date(dto.reviewedOn).getTime() < new Date(dto.submittedOn).getTime()) {
        throw new UnprocessableEntityException({
          code: 'TECHNICAL_REVIEWED_ON_BEFORE_SUBMITTED_ON',
          message: 'Reviewed On cannot be before Submitted On',
        });
      }
    }
    if (dto.submittedOn !== undefined && dto.expectedApprovalDate !== undefined) {
      if (new Date(dto.expectedApprovalDate).getTime() < new Date(dto.submittedOn).getTime()) {
        throw new UnprocessableEntityException({
          code: 'TECHNICAL_EXPECTED_APPROVAL_BEFORE_SUBMITTED_ON',
          message: 'Expected Approval Date must be the same day or after Submitted On',
        });
      }
    }
    if (dto.reviewedOn !== undefined && dto.resubmissionDate !== undefined) {
      if (new Date(dto.resubmissionDate).getTime() < new Date(dto.reviewedOn).getTime()) {
        throw new UnprocessableEntityException({
          code: 'TECHNICAL_RESUBMISSION_BEFORE_REVIEWED_ON',
          message: 'Resubmission Date must be the same day or after Reviewed On',
        });
      }
    }
  }

  /** Same "too early or too late, one check" reasoning as assertSdStageIsCurrent(). */
  // FMP-TECH-05L — same reasoning/reword as assertSdStageIsCurrent().
  private assertApprovalStageIsCurrent(workflow: TechnicalWorkflow): void {
    if (workflow.currentStage !== TechnicalStage.GETTING_APPROVAL) {
      throw new ConflictException({
        code: 'TECHNICAL_STAGE_NOT_CURRENT',
        message: "This workflow isn't at the Getting Approval stage right now, so this action isn't available yet.",
      });
    }
  }

  /** FMP-TECH-05K — same "not yet reached is fine, already passed is not" reasoning as assertSdStageNotAlreadyPassed(). Send Back/Reject/Approve below keep the strict assertApprovalStageIsCurrent() gate, unchanged. */
  private assertApprovalStageNotAlreadyPassed(workflow: TechnicalWorkflow): void {
    if (STAGE_ORDER.indexOf(TechnicalStage.GETTING_APPROVAL) < STAGE_ORDER.indexOf(workflow.currentStage)) {
      throw new ConflictException({
        code: 'TECHNICAL_STAGE_ALREADY_ADVANCED',
        message: 'Getting Approval has already been completed for this workflow',
      });
    }
  }

  async saveApprovalDraft(contractId: string, dto: SaveGettingApprovalDto, actor: AuthUser): Promise<TechnicalApproval> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    this.assertApprovalStageNotAlreadyPassed(workflow);
    if (dto.relatedSdSubmissionId !== undefined) await this.assertRelatedSdSubmissionValid(workflow.id, dto.relatedSdSubmissionId);

    const { approval: existing } = await this.getOrCreateApproval(workflow, contractId, actor);
    const updated = await this.db.getClient().technicalApproval.update({
      where: { id: existing.id },
      data: toApprovalUpdateData(dto),
    });

    await this.logActivity(workflow.id, actor, 'APPROVAL_DETAILS_SAVED', null, null);
    return updated;
  }

  /** No status change — TechnicalApprovalRecordStatus has no CLARIFICATION_REQUESTED value (unlike the SD stage's own status enum), so this mirrors Drawing Received's simpler activity-only clarification, not SD's status-changing one. */
  async requestApprovalClarification(contractId: string, note: string, actor: AuthUser): Promise<void> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    await this.logActivity(workflow.id, actor, 'APPROVAL_CLARIFICATION_REQUESTED', null, null, { note });
  }

  /**
   * Send Back for Changes — implements the ticket's own PREFERRED behavior
   * ("should return workflow to SD & Calculation Submission for revision if
   * current architecture supports revision flow"), not its fallback: this
   * architecture already supports it cleanly, because every SD & Calculation
   * write method (saveSdSubmissionDraft/submitSdCalculation/
   * completeSdCalculationSubmission) is ALREADY gated purely on
   * `workflow.currentStage === SD_CALCULATION_SUBMISSION` — reverting the
   * stage here makes that screen writable again with zero new SD-side code.
   * Nothing is deleted: the existing TechnicalSdCalculationSubmission row
   * (still holding its last submitted content) and this TechnicalApproval
   * row (kept as history) both survive untouched aside from the status
   * fields this method itself sets.
   */
  async sendApprovalBackForChanges(contractId: string, dto: SaveGettingApprovalDto, actor: AuthUser): Promise<TechnicalApproval> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    this.assertApprovalStageIsCurrent(workflow);

    if (!dto.resubmissionReason) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_RESUBMISSION_REASON_REQUIRED',
        message: 'Resubmission Reason / Comments is required to send back for changes',
      });
    }

    const { approval: existing } = await this.getOrCreateApproval(workflow, contractId, actor);
    const updated = await this.db.getClient().technicalApproval.update({
      where: { id: existing.id },
      data: {
        ...toApprovalUpdateData(dto),
        approvalStatus: TechnicalApprovalStatus.CHANGES_REQUIRED,
        resubmissionRequired: true,
        status: TechnicalApprovalRecordStatus.CHANGES_REQUIRED,
      },
    });

    await this.db.getClient().technicalWorkflow.update({
      where: { id: workflow.id },
      data: { currentStage: TechnicalStage.SD_CALCULATION_SUBMISSION },
    });

    await this.logActivity(workflow.id, actor, 'CHANGES_REQUESTED', TechnicalStage.GETTING_APPROVAL, TechnicalStage.SD_CALCULATION_SUBMISSION);

    return updated;
  }

  async rejectApproval(contractId: string, dto: SaveGettingApprovalDto, actor: AuthUser): Promise<TechnicalApproval> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    this.assertApprovalStageIsCurrent(workflow);

    if (!dto.reviewerComments) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_REVIEWER_COMMENTS_REQUIRED',
        message: 'Reviewer Comments are required to reject this submission',
      });
    }

    const { approval: existing } = await this.getOrCreateApproval(workflow, contractId, actor);
    const updated = await this.db.getClient().technicalApproval.update({
      where: { id: existing.id },
      data: {
        ...toApprovalUpdateData(dto),
        approvalStatus: TechnicalApprovalStatus.REJECTED,
        status: TechnicalApprovalRecordStatus.REJECTED,
      },
    });

    // Rejection never advances or reverts the workflow stage, and never
    // deletes the workflow/approval/SD-submission rows — the ticket's own
    // explicit "does not delete workflow" instruction.
    await this.logActivity(workflow.id, actor, 'REJECTED', null, null);

    return updated;
  }

  async approveAndMoveToFdIssuance(contractId: string, dto: SaveGettingApprovalDto, actor: AuthUser): Promise<{ workflow: TechnicalWorkflow; nextStage: TechnicalStage | null }> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    this.assertApprovalStageIsCurrent(workflow);

    const missing = CORE_APPROVAL_REQUIRED_FIELDS.filter((field) => dto[field] === undefined || dto[field] === null || dto[field] === '');
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_APPROVAL_INCOMPLETE',
        message: `Missing required fields: ${missing.join(', ')}`,
        details: { missing },
      });
    }

    if (dto.approvalStatus !== TechnicalApprovalStatus.APPROVED && dto.approvalStatus !== TechnicalApprovalStatus.APPROVED_WITH_COMMENTS) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_APPROVAL_STATUS_NOT_APPROVED',
        message: 'Approval Status must be Approved or Approved with Comments to move to FD Issuance',
      });
    }
    if (dto.approvalStatus === TechnicalApprovalStatus.APPROVED_WITH_COMMENTS && !dto.reviewerComments) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_REVIEWER_COMMENTS_REQUIRED',
        message: 'Reviewer Comments are required when Approval Status is Approved with Comments',
      });
    }

    this.assertApprovalDateRules(dto);
    await this.assertRelatedSdSubmissionValid(workflow.id, dto.relatedSdSubmissionId!);

    const { approval: existing } = await this.getOrCreateApproval(workflow, contractId, actor);

    await this.db.getClient().technicalApproval.update({
      where: { id: existing.id },
      data: { ...toApprovalUpdateData(dto), status: TechnicalApprovalRecordStatus.COMPLETED, completedAt: new Date() },
    });

    // Two activity rows for one action — the ticket's own Recent Activity
    // list names "Approval received" and "Stage completed" as 2 distinct
    // entries (unlike Drawing Received/SD's single terminal event), so this
    // records the real business moment (the reviewer approved) separately
    // from the mechanical stage advance.
    await this.logActivity(workflow.id, actor, 'APPROVAL_RECEIVED', null, null);

    const newStage = nextStageOf(workflow.currentStage) ?? workflow.currentStage;
    const updatedWorkflow = await this.db.getClient().technicalWorkflow.update({
      where: { id: workflow.id },
      data: { currentStage: newStage },
    });

    await this.logActivity(workflow.id, actor, 'GETTING_APPROVAL_STAGE_COMPLETED', workflow.currentStage, newStage);

    return { workflow: updatedWorkflow, nextStage: nextStageOf(newStage) };
  }

  // ---------------------------------------------------------------------------
  // Getting Approval attachments — same TechnicalAttachmentStorageService,
  // same allowed MIME types/size limit as Drawing Received/SD attachments.
  // ---------------------------------------------------------------------------

  private async listApprovalAttachmentsForApproval(technicalApprovalId: string): Promise<unknown[]> {
    return this.db.getClient().technicalApprovalAttachment.findMany({
      where: { technicalApprovalId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalFileName: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        uploadedByUserId: true,
        createdAt: true,
        uploadedByUser: { select: { id: true, displayName: true, username: true } },
      },
    });
  }

  async listApprovalAttachments(contractId: string, actor: AuthUser): Promise<unknown[]> {
    this.requireRead(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    const approval = await this.db.getClient().technicalApproval.findFirst({ where: { technicalWorkflowId: workflow.id }, orderBy: { createdAt: 'desc' } });
    if (!approval) return [];
    return this.listApprovalAttachmentsForApproval(approval.id);
  }

  async createApprovalAttachment(
    contractId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    if (!(TECHNICAL_DRAWING_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: JPG/PNG/WEBP images, PDF/DOC/DOCX/XLS/XLSX documents, DWG/DXF drawings.',
      });
    }
    if (file.size > TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { approval } = await this.getOrCreateApproval(workflow, contractId, actor);
    const { fileName, storagePath } = await this.attachmentStorage.save(approval.id, file.buffer, file.originalname);

    const attachment = await this.db.getClient().technicalApprovalAttachment.create({
      data: {
        technicalApprovalId: approval.id,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: {
        id: true,
        originalFileName: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        uploadedByUserId: true,
        createdAt: true,
      },
    });

    await this.logActivity(workflow.id, actor, 'APPROVAL_ATTACHMENTS_UPLOADED', null, null, { fileName: file.originalname });

    return attachment;
  }

  async getApprovalAttachmentForDownload(
    contractId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    this.requireRead(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const attachment = await this.db.getClient().technicalApprovalAttachment.findFirst({
      where: { id: attachmentId, technicalApproval: { technicalWorkflowId: workflow.id } },
      select: { storagePath: true, originalFileName: true, mimeType: true },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'TECHNICAL_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }
    return attachment;
  }

  async deleteApprovalAttachment(contractId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const attachment = await this.db.getClient().technicalApprovalAttachment.findFirst({
      where: { id: attachmentId, technicalApproval: { technicalWorkflowId: workflow.id } },
      select: { id: true, storagePath: true, originalFileName: true, uploadedByUserId: true },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'TECHNICAL_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }
    if (attachment.uploadedByUserId !== actor.id && !actor.permissions.includes('contracts.manage')) {
      throw new ForbiddenException({
        code: 'TECHNICAL_ATTACHMENT_NOT_OWNER',
        message: 'You can only delete a file you uploaded, unless you have contracts.manage',
      });
    }

    await this.db.getClient().technicalApprovalAttachment.delete({ where: { id: attachmentId } });
    await this.attachmentStorage.deleteFile(attachment.storagePath);

    await this.logActivity(workflow.id, actor, 'ATTACHMENT_REMOVED', null, null, { fileName: attachment.originalFileName });
  }

  // ---------------------------------------------------------------------------
  // FMP-TECH-04 — FD Issuance (Technical Stage 4, the final stage). Mirrors
  // the Getting Approval methods above in shape. The one real behavioral
  // difference is Return/Reopen — same real revision-flow reasoning as
  // Send Back for Changes in FMP-TECH-03: Getting Approval's own write
  // methods (saveApprovalDraft/sendApprovalBackForChanges/rejectApproval/
  // approveAndMoveToFdIssuance) are ALL gated purely on
  // `workflow.currentStage === GETTING_APPROVAL`, so reverting the stage
  // here makes that screen writable again with zero new Approval-side code.
  // "Issue FD & Complete Technical Workflow" does NOT advance
  // `currentStage` (nextStageOf(FD_ISSUANCE) is already null — there is no
  // later stage) — it sets `TechnicalWorkflow.status = COMPLETED` instead,
  // which is the exact field TechnicalDashboard's own
  // readyForProductionRelease metric has counted against since FMP-TECH-01.
  // ---------------------------------------------------------------------------

  async getFdIssuance(contractId: string, actor: AuthUser): Promise<{
    contract: Awaited<ReturnType<TechnicalService['loadContractOrThrow']>>;
    workflow: TechnicalWorkflow;
    fdIssuance: TechnicalFdIssuance | null;
    eligibleApprovals: { id: string; approvalStatus: TechnicalApprovalStatus | null; revisionNo: string | null; reviewedOn: string | Date | null }[];
    attachments: unknown[];
    activities: unknown[];
    nextStage: TechnicalStage | null;
  }> {
    this.requireRead(actor);
    const contract = await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const [fdIssuance, eligibleApprovals, activities] = await Promise.all([
      this.db.getClient().technicalFdIssuance.findFirst({
        where: { technicalWorkflowId: workflow.id },
        orderBy: { createdAt: 'desc' },
      }),
      // "Must list real approved/approved-with-comments Getting Approval
      // records for this workflow" — same reasoning as Getting Approval's
      // own eligibleSdSubmissions list.
      this.db.getClient().technicalApproval.findMany({
        where: { technicalWorkflowId: workflow.id, approvalStatus: { in: [TechnicalApprovalStatus.APPROVED, TechnicalApprovalStatus.APPROVED_WITH_COMMENTS] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, approvalStatus: true, revisionNo: true, reviewedOn: true },
      }),
      this.db.getClient().technicalWorkflowActivity.findMany({
        where: { technicalWorkflowId: workflow.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const attachments = fdIssuance ? await this.listFdAttachmentsForIssuance(fdIssuance.id) : [];

    return {
      contract,
      workflow,
      fdIssuance,
      eligibleApprovals,
      attachments,
      activities,
      nextStage: nextStageOf(workflow.currentStage),
    };
  }

  private async getOrCreateFdIssuance(workflow: TechnicalWorkflow, contractId: string, actor: AuthUser): Promise<{ fdIssuance: TechnicalFdIssuance; created: boolean }> {
    const existing = await this.db.getClient().technicalFdIssuance.findFirst({
      where: { technicalWorkflowId: workflow.id },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { fdIssuance: existing, created: false };

    const fdIssuance = await this.db.getClient().technicalFdIssuance.create({
      data: { technicalWorkflowId: workflow.id, contractId, createdByUserId: actor.id },
    });
    return { fdIssuance, created: true };
  }

  /** relatedApprovalId must belong to THIS workflow and be approved or approved-with-comments — re-checked server-side, never trusted from the request alone. */
  private async assertRelatedApprovalValid(technicalWorkflowId: string, relatedApprovalId: string): Promise<void> {
    const approval = await this.db.getClient().technicalApproval.findFirst({
      where: { id: relatedApprovalId, technicalWorkflowId },
      select: { id: true, approvalStatus: true },
    });
    if (!approval) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_RELATED_APPROVAL_INVALID',
        message: 'Related Approval must belong to this same job order',
      });
    }
    if (approval.approvalStatus !== TechnicalApprovalStatus.APPROVED && approval.approvalStatus !== TechnicalApprovalStatus.APPROVED_WITH_COMMENTS) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_RELATED_APPROVAL_NOT_APPROVED',
        message: 'Related Approval must be Approved or Approved with Comments',
      });
    }
  }

  private assertFdDateRules(dto: SaveFdIssuanceDto): void {
    if (dto.fdIssueDate !== undefined && dto.approvedDate !== undefined) {
      if (new Date(dto.fdIssueDate).getTime() < new Date(dto.approvedDate).getTime()) {
        throw new UnprocessableEntityException({
          code: 'TECHNICAL_FD_ISSUE_DATE_BEFORE_APPROVED_DATE',
          message: 'FD Issue Date cannot be before Approved Date',
        });
      }
    }
    if (dto.fdIssueDate !== undefined) {
      const todayEnd = new Date();
      todayEnd.setUTCHours(23, 59, 59, 999);
      if (new Date(dto.fdIssueDate).getTime() > todayEnd.getTime()) {
        throw new UnprocessableEntityException({
          code: 'TECHNICAL_FD_ISSUE_DATE_IN_FUTURE',
          message: 'FD Issue Date cannot be in the future',
        });
      }
    }
  }

  /** Same "too early or too late, one check" reasoning as assertApprovalStageIsCurrent() — plus a second check blocking further writes once this final stage has actually been completed (workflow.status === COMPLETED), since FD_ISSUANCE has no later stage to have "advanced past". */
  // FMP-TECH-05L — same reasoning/reword as assertSdStageIsCurrent().
  private assertFdStageIsCurrent(workflow: TechnicalWorkflow): void {
    if (workflow.currentStage !== TechnicalStage.FD_ISSUANCE) {
      throw new ConflictException({
        code: 'TECHNICAL_STAGE_NOT_CURRENT',
        message: "This workflow isn't at the FD Issuance stage right now, so this action isn't available yet.",
      });
    }
    if (workflow.status === TechnicalWorkflowStatus.COMPLETED) {
      throw new ConflictException({
        code: 'TECHNICAL_WORKFLOW_ALREADY_COMPLETED',
        message: 'This Technical workflow has already been completed',
      });
    }
  }

  /** FMP-TECH-05K — same "not yet reached is fine, already passed is not" reasoning as assertSdStageNotAlreadyPassed(). FD_ISSUANCE is the final stage (nothing comes after it in STAGE_ORDER), so the only "already done" signal is workflow.status === COMPLETED. Submit/Return/Issue below keep the strict assertFdStageIsCurrent() gate, unchanged. */
  private assertFdStageNotAlreadyCompleted(workflow: TechnicalWorkflow): void {
    if (workflow.status === TechnicalWorkflowStatus.COMPLETED) {
      throw new ConflictException({
        code: 'TECHNICAL_WORKFLOW_ALREADY_COMPLETED',
        message: 'This Technical workflow has already been completed',
      });
    }
  }

  async saveFdIssuanceDraft(contractId: string, dto: SaveFdIssuanceDto, actor: AuthUser): Promise<TechnicalFdIssuance> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    this.assertFdStageNotAlreadyCompleted(workflow);
    this.assertFdDateRules(dto);
    if (dto.relatedApprovalId !== undefined) await this.assertRelatedApprovalValid(workflow.id, dto.relatedApprovalId);

    const { fdIssuance: existing } = await this.getOrCreateFdIssuance(workflow, contractId, actor);
    const updated = await this.db.getClient().technicalFdIssuance.update({
      where: { id: existing.id },
      data: toFdUpdateData(dto),
    });

    await this.logActivity(workflow.id, actor, 'FD_DETAILS_SAVED', null, null);
    return updated;
  }

  async submitFdIssue(contractId: string, dto: SaveFdIssuanceDto, actor: AuthUser): Promise<TechnicalFdIssuance> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    this.assertFdStageIsCurrent(workflow);

    const missing = CORE_FD_SUBMIT_FIELDS.filter((field) => dto[field] === undefined || dto[field] === null || dto[field] === '');
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_FD_ISSUANCE_INCOMPLETE',
        message: `Missing required fields: ${missing.join(', ')}`,
        details: { missing },
      });
    }
    this.assertFdDateRules(dto);
    if (dto.relatedApprovalId !== undefined) await this.assertRelatedApprovalValid(workflow.id, dto.relatedApprovalId);

    const { fdIssuance: existing } = await this.getOrCreateFdIssuance(workflow, contractId, actor);
    const updated = await this.db.getClient().technicalFdIssuance.update({
      where: { id: existing.id },
      data: { ...toFdUpdateData(dto), status: TechnicalFdStatus.SUBMITTED },
    });

    // "Submit FD Issue" records the submission but deliberately does NOT
    // complete the Technical workflow — per the ticket's own "does not
    // complete the workflow" instruction. Only Issue FD & Complete
    // Technical Workflow (below) does that.
    await this.logActivity(workflow.id, actor, 'FD_ISSUE_SUBMITTED', null, null);
    return updated;
  }

  /**
   * Return/Reopen — implements the ticket's own PREFERRED behavior
   * ("if architecture supports returning to Getting Approval, allow
   * controlled return"), not its fallback: this architecture already
   * supports it cleanly, for the exact same reason
   * sendApprovalBackForChanges() reverts to SD & Calculation Submission —
   * Getting Approval's own write methods are already gated purely on
   * `workflow.currentStage === GETTING_APPROVAL`. Nothing is deleted: the
   * existing TechnicalApproval row and this TechnicalFdIssuance row both
   * survive untouched aside from the status fields this method itself
   * sets. The reason is recorded only in the activity metadata (same
   * pattern as every other clarification/note field in this schema family
   * — TechnicalFdIssuance has no dedicated "reason" column).
   */
  async returnOrReopenFd(contractId: string, reason: string, actor: AuthUser): Promise<TechnicalFdIssuance> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    this.assertFdStageIsCurrent(workflow);

    const { fdIssuance: existing } = await this.getOrCreateFdIssuance(workflow, contractId, actor);
    const updated = await this.db.getClient().technicalFdIssuance.update({
      where: { id: existing.id },
      data: { status: TechnicalFdStatus.RETURNED_REOPENED },
    });

    await this.db.getClient().technicalWorkflow.update({
      where: { id: workflow.id },
      data: { currentStage: TechnicalStage.GETTING_APPROVAL },
    });

    await this.logActivity(workflow.id, actor, 'FD_RETURNED_REOPENED', TechnicalStage.FD_ISSUANCE, TechnicalStage.GETTING_APPROVAL, { reason });

    return updated;
  }

  async issueFdAndCompleteWorkflow(contractId: string, dto: SaveFdIssuanceDto, actor: AuthUser): Promise<{ workflow: TechnicalWorkflow; nextStage: TechnicalStage | null }> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    this.assertFdStageIsCurrent(workflow);

    const missing = COMPLETE_FD_REQUIRED_FIELDS.filter((field) => dto[field] === undefined || dto[field] === null || dto[field] === '');
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_FD_ISSUANCE_INCOMPLETE',
        message: `Missing required fields: ${missing.join(', ')}`,
        details: { missing },
      });
    }
    this.assertFdDateRules(dto);
    await this.assertRelatedApprovalValid(workflow.id, dto.relatedApprovalId!);

    const { fdIssuance: existing } = await this.getOrCreateFdIssuance(workflow, contractId, actor);

    // Completion attachment rule — same "at least one attachment" fallback
    // as SD & Calculation Submission's own completion rule (no file-category
    // taxonomy exists yet to distinguish "final drawing" from "final
    // document").
    const attachmentCount = await this.db.getClient().technicalFdIssuanceAttachment.count({
      where: { technicalFdIssuanceId: existing.id },
    });
    if (attachmentCount === 0) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_FD_ATTACHMENT_REQUIRED',
        message: 'At least one FD attachment is required before completing this stage',
      });
    }

    await this.db.getClient().technicalFdIssuance.update({
      where: { id: existing.id },
      data: { ...toFdUpdateData(dto), status: TechnicalFdStatus.COMPLETED, completedAt: new Date() },
    });

    // FD_ISSUANCE has no next stage (nextStageOf already returns null) — this
    // is the ONE completion action across all 4 stages that does not advance
    // `currentStage`, it marks the whole TechnicalWorkflow completed instead.
    const updatedWorkflow = await this.db.getClient().technicalWorkflow.update({
      where: { id: workflow.id },
      data: { status: TechnicalWorkflowStatus.COMPLETED, completedAt: new Date() },
    });

    await this.logActivity(workflow.id, actor, 'TECHNICAL_WORKFLOW_COMPLETED', null, null);

    return { workflow: updatedWorkflow, nextStage: null };
  }

  // ---------------------------------------------------------------------------
  // FD Issuance attachments — same TechnicalAttachmentStorageService, same
  // allowed MIME types/size limit as Drawing Received/SD/Approval
  // attachments.
  // ---------------------------------------------------------------------------

  private async listFdAttachmentsForIssuance(technicalFdIssuanceId: string): Promise<unknown[]> {
    return this.db.getClient().technicalFdIssuanceAttachment.findMany({
      where: { technicalFdIssuanceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalFileName: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        uploadedByUserId: true,
        createdAt: true,
        uploadedByUser: { select: { id: true, displayName: true, username: true } },
      },
    });
  }

  async listFdAttachments(contractId: string, actor: AuthUser): Promise<unknown[]> {
    this.requireRead(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);
    const fdIssuance = await this.db.getClient().technicalFdIssuance.findFirst({ where: { technicalWorkflowId: workflow.id }, orderBy: { createdAt: 'desc' } });
    if (!fdIssuance) return [];
    return this.listFdAttachmentsForIssuance(fdIssuance.id);
  }

  async createFdAttachment(
    contractId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    if (!(TECHNICAL_DRAWING_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: JPG/PNG/WEBP images, PDF/DOC/DOCX/XLS/XLSX documents, DWG/DXF drawings.',
      });
    }
    if (file.size > TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'TECHNICAL_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fdIssuance } = await this.getOrCreateFdIssuance(workflow, contractId, actor);
    const { fileName, storagePath } = await this.attachmentStorage.save(fdIssuance.id, file.buffer, file.originalname);

    const attachment = await this.db.getClient().technicalFdIssuanceAttachment.create({
      data: {
        technicalFdIssuanceId: fdIssuance.id,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: {
        id: true,
        originalFileName: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        uploadedByUserId: true,
        createdAt: true,
      },
    });

    await this.logActivity(workflow.id, actor, 'FD_ATTACHMENTS_UPLOADED', null, null, { fileName: file.originalname });

    return attachment;
  }

  async getFdAttachmentForDownload(
    contractId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    this.requireRead(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const attachment = await this.db.getClient().technicalFdIssuanceAttachment.findFirst({
      where: { id: attachmentId, technicalFdIssuance: { technicalWorkflowId: workflow.id } },
      select: { storagePath: true, originalFileName: true, mimeType: true },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'TECHNICAL_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }
    return attachment;
  }

  async deleteFdAttachment(contractId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    this.requireWrite(actor);
    await this.loadContractOrThrow(contractId, actor);
    const workflow = await this.requireWorkflow(contractId);

    const attachment = await this.db.getClient().technicalFdIssuanceAttachment.findFirst({
      where: { id: attachmentId, technicalFdIssuance: { technicalWorkflowId: workflow.id } },
      select: { id: true, storagePath: true, originalFileName: true, uploadedByUserId: true },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'TECHNICAL_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }
    if (attachment.uploadedByUserId !== actor.id && !actor.permissions.includes('contracts.manage')) {
      throw new ForbiddenException({
        code: 'TECHNICAL_ATTACHMENT_NOT_OWNER',
        message: 'You can only delete a file you uploaded, unless you have contracts.manage',
      });
    }

    await this.db.getClient().technicalFdIssuanceAttachment.delete({ where: { id: attachmentId } });
    await this.attachmentStorage.deleteFile(attachment.storagePath);

    await this.logActivity(workflow.id, actor, 'ATTACHMENT_REMOVED', null, null, { fileName: attachment.originalFileName });
  }
}

/** Only copies fields the caller actually provided — a `saveDrawingReceivedDraft` payload from a partially-filled form must never null out fields the user hasn't touched yet. */
function toUpdateData(dto: SaveDrawingReceivedDto): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (dto.receivedDate !== undefined) data['receivedDate'] = new Date(dto.receivedDate);
  if (dto.receivedFrom !== undefined) data['receivedFrom'] = dto.receivedFrom;
  if (dto.senderName !== undefined) data['senderName'] = dto.senderName;
  if (dto.drawingType !== undefined) data['drawingType'] = dto.drawingType;
  if (dto.drawingReferenceNo !== undefined) data['drawingReferenceNo'] = dto.drawingReferenceNo;
  if (dto.revisionNo !== undefined) data['revisionNo'] = dto.revisionNo;
  if (dto.numberOfSheets !== undefined) data['numberOfSheets'] = dto.numberOfSheets;
  if (dto.priority !== undefined) data['priority'] = dto.priority;
  if (dto.status !== undefined) data['status'] = dto.status;
  if (dto.drawingDescription !== undefined) data['drawingDescription'] = dto.drawingDescription;
  if (dto.relatedAreaPackage !== undefined) data['relatedAreaPackage'] = dto.relatedAreaPackage;
  if (dto.linkedWorkflowStage !== undefined) data['linkedWorkflowStage'] = dto.linkedWorkflowStage;
  if (dto.internalReferenceNo !== undefined) data['internalReferenceNo'] = dto.internalReferenceNo;
  if (dto.requiresImmediateReview !== undefined) data['requiresImmediateReview'] = dto.requiresImmediateReview;
  if (dto.additionalDocumentsReceived !== undefined) data['additionalDocumentsReceived'] = dto.additionalDocumentsReceived;
  if (dto.remarks !== undefined) data['remarks'] = dto.remarks;
  if (dto.internalNotes !== undefined) data['internalNotes'] = dto.internalNotes;
  if (dto.assignedToUserId !== undefined) data['assignedToUserId'] = dto.assignedToUserId;
  if (dto.plannedReviewStart !== undefined) data['plannedReviewStart'] = new Date(dto.plannedReviewStart);
  return data;
}

/** Same "only copy fields actually provided" rule as toUpdateData() above. */
function toSdUpdateData(dto: SaveSdCalculationSubmissionDto): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (dto.submissionDate !== undefined) data['submissionDate'] = new Date(dto.submissionDate);
  if (dto.submissionType !== undefined) data['submissionType'] = dto.submissionType;
  if (dto.submittedTo !== undefined) data['submittedTo'] = dto.submittedTo;
  if (dto.targetApprovalDate !== undefined) data['targetApprovalDate'] = new Date(dto.targetApprovalDate);
  if (dto.drawingReferenceNo !== undefined) data['drawingReferenceNo'] = dto.drawingReferenceNo;
  if (dto.revisionNo !== undefined) data['revisionNo'] = dto.revisionNo;
  if (dto.relatedDrawingId !== undefined) data['relatedDrawingId'] = dto.relatedDrawingId;
  if (dto.calculationType !== undefined) data['calculationType'] = dto.calculationType;
  if (dto.numberOfSheetsOrFiles !== undefined) data['numberOfSheetsOrFiles'] = dto.numberOfSheetsOrFiles;
  if (dto.scopeDescription !== undefined) data['scopeDescription'] = dto.scopeDescription;
  if (dto.submissionMethod !== undefined) data['submissionMethod'] = dto.submissionMethod;
  if (dto.referenceSubmissionNo !== undefined) data['referenceSubmissionNo'] = dto.referenceSubmissionNo;
  if (dto.submittedById !== undefined) data['submittedById'] = dto.submittedById;
  if (dto.submittedByName !== undefined) data['submittedByName'] = dto.submittedByName;
  if (dto.designation !== undefined) data['designation'] = dto.designation;
  if (dto.contactNo !== undefined) data['contactNo'] = dto.contactNo;
  if (dto.email !== undefined) data['email'] = dto.email;
  if (dto.remarks !== undefined) data['remarks'] = dto.remarks;
  if (dto.priority !== undefined) data['priority'] = dto.priority;
  if (dto.status !== undefined) data['status'] = dto.status;
  return data;
}

/** Same "only copy fields actually provided" rule as toUpdateData()/toSdUpdateData() above. */
function toApprovalUpdateData(dto: SaveGettingApprovalDto): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (dto.relatedSdSubmissionId !== undefined) data['relatedSdSubmissionId'] = dto.relatedSdSubmissionId;
  if (dto.submittedOn !== undefined) data['submittedOn'] = new Date(dto.submittedOn);
  if (dto.submittedById !== undefined) data['submittedById'] = dto.submittedById;
  if (dto.submittedByName !== undefined) data['submittedByName'] = dto.submittedByName;
  if (dto.submittedTo !== undefined) data['submittedTo'] = dto.submittedTo;
  if (dto.approvalStatus !== undefined) data['approvalStatus'] = dto.approvalStatus;
  if (dto.expectedApprovalDate !== undefined) data['expectedApprovalDate'] = new Date(dto.expectedApprovalDate);
  if (dto.reviewedOn !== undefined) data['reviewedOn'] = new Date(dto.reviewedOn);
  if (dto.reviewedBy !== undefined) data['reviewedBy'] = dto.reviewedBy;
  if (dto.revisionNo !== undefined) data['revisionNo'] = dto.revisionNo;
  if (dto.reviewerComments !== undefined) data['reviewerComments'] = dto.reviewerComments;
  if (dto.resubmissionRequired !== undefined) data['resubmissionRequired'] = dto.resubmissionRequired;
  if (dto.resubmissionDate !== undefined) data['resubmissionDate'] = new Date(dto.resubmissionDate);
  if (dto.resubmissionReason !== undefined) data['resubmissionReason'] = dto.resubmissionReason;
  if (dto.priority !== undefined) data['priority'] = dto.priority;
  if (dto.status !== undefined) data['status'] = dto.status;
  return data;
}

/** Same "only copy fields actually provided" rule as toUpdateData()/toSdUpdateData()/toApprovalUpdateData() above. */
function toFdUpdateData(dto: SaveFdIssuanceDto): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (dto.relatedApprovalId !== undefined) data['relatedApprovalId'] = dto.relatedApprovalId;
  if (dto.fdIssueDate !== undefined) data['fdIssueDate'] = new Date(dto.fdIssueDate);
  if (dto.issuedTo !== undefined) data['issuedTo'] = dto.issuedTo;
  if (dto.purposeFor !== undefined) data['purposeFor'] = dto.purposeFor;
  if (dto.issueType !== undefined) data['issueType'] = dto.issueType;
  if (dto.drawingReferenceNo !== undefined) data['drawingReferenceNo'] = dto.drawingReferenceNo;
  if (dto.revisionNo !== undefined) data['revisionNo'] = dto.revisionNo;
  if (dto.approvedReferenceNo !== undefined) data['approvedReferenceNo'] = dto.approvedReferenceNo;
  if (dto.approvedDate !== undefined) data['approvedDate'] = new Date(dto.approvedDate);
  if (dto.numberOfSheetsOrFiles !== undefined) data['numberOfSheetsOrFiles'] = dto.numberOfSheetsOrFiles;
  if (dto.distribution !== undefined) data['distribution'] = dto.distribution;
  if (dto.issueMethod !== undefined) data['issueMethod'] = dto.issueMethod;
  if (dto.issuedById !== undefined) data['issuedById'] = dto.issuedById;
  if (dto.issuedByName !== undefined) data['issuedByName'] = dto.issuedByName;
  if (dto.designation !== undefined) data['designation'] = dto.designation;
  if (dto.contactNo !== undefined) data['contactNo'] = dto.contactNo;
  if (dto.email !== undefined) data['email'] = dto.email;
  if (dto.remarks !== undefined) data['remarks'] = dto.remarks;
  if (dto.priority !== undefined) data['priority'] = dto.priority;
  if (dto.status !== undefined) data['status'] = dto.status;
  return data;
}
