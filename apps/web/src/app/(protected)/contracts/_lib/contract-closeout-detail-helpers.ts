// ---------------------------------------------------------------------------
// CM-67 — Contract Detail Closeout, approved design, simplified. Pure,
// dependency-free helpers (matching the ../../_lib/root-dashboard-helpers.ts
// pattern) so every derived number/status on the Closeout tab is testable
// without a DB or React. Every "open"/"final" status set below MIRRORS the
// real backend definition it's paired with (cited in each comment) rather
// than inventing a new classification — this keeps row-level Blocking Items
// counts consistent with the aggregate counts already returned by
// GET :id/closeout/checks and the other real per-module summaries.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Closeout Status — the real, current state of this contract's closeout.
// ---------------------------------------------------------------------------

export type ClosureStatus =
  | 'NOT_READY'
  | 'READY'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED'
  | 'CANCELLED';

export const CLOSURE_STATUS_LABELS: Record<ClosureStatus, string> = {
  NOT_READY: 'Not Ready',
  READY: 'Ready for Closeout',
  DRAFT: 'Draft Request',
  SUBMITTED: 'Submitted for Review',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved for Closure',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export const CLOSURE_STATUS_BADGE_CLASSES: Record<ClosureStatus, string> = {
  NOT_READY: 'bg-warning-light text-warning',
  READY: 'bg-success-light text-success',
  DRAFT: 'bg-surface-secondary text-text-secondary',
  SUBMITTED: 'bg-info-light text-info',
  UNDER_REVIEW: 'bg-warning-light text-warning',
  APPROVED: 'bg-success-light text-success',
  REJECTED: 'bg-error-light text-error',
  CLOSED: 'bg-surface-secondary text-text-muted',
  CANCELLED: 'bg-surface-secondary text-text-muted',
};

/**
 * Uses the real latest closeout request's own status when one exists — a
 * REJECTED request still reflects the real current state even though a new
 * request may be started. Only falls back to a computed Not Ready/Ready
 * verdict (from the real isReadyForClosure check) when no request exists
 * yet, exactly as this unit's spec requires.
 */
export function computeClosureStatus(
  contractStatus: string,
  latestRequestStatus: string | null | undefined,
  isReadyForClosure: boolean | undefined,
): ClosureStatus {
  if (contractStatus === 'CLOSED') return 'CLOSED';
  if (latestRequestStatus) return latestRequestStatus as ClosureStatus;
  return isReadyForClosure ? 'READY' : 'NOT_READY';
}

// ---------------------------------------------------------------------------
// Final Completion Checklist — real checklist categories only, no invented
// items. Each item's Required?/Responsible/Completed Date is only ever set
// from a real stored value; every other field honestly shows "—".
// ---------------------------------------------------------------------------

export type ChecklistStatus = 'COMPLETED' | 'PENDING' | 'NOT_REQUIRED' | 'BLOCKED';

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  COMPLETED: 'Completed',
  PENDING: 'Pending',
  NOT_REQUIRED: 'Not Required',
  BLOCKED: 'Blocked',
};

export const CHECKLIST_STATUS_BADGE_CLASSES: Record<ChecklistStatus, string> = {
  COMPLETED: 'bg-success-light text-success',
  PENDING: 'bg-warning-light text-warning',
  NOT_REQUIRED: 'bg-surface-secondary text-text-muted',
  BLOCKED: 'bg-error-light text-error',
};

export interface ChecklistItem {
  key: string;
  label: string;
  required: boolean;
  status: ChecklistStatus;
  /** Only ever a real stored user name (closeout request reviewer/approver) — "—" for every cross-module aggregate row, since those have no single real owner. */
  responsible: string;
  /** Only ever a real stored date (e.g. closeout approvedAt) — "—" when no such event has happened yet. */
  completedDate: string | null;
  actionHref: string;
}

export interface ChecklistInput {
  contractId: string;
  workflowOpen: number;
  workflowOverdue: number;
  productionTasksTotal: number;
  productionTasksOpen: number;
  erectionTasksTotal: number;
  erectionTasksOpen: number;
  paymentsNonFinalCount: number;
  claimsOpen: number;
  risksOpen: number;
  issuesOpen: number;
  documentObligationsTotal: number;
  documentObligationsPendingOrExpired: number;
  closeoutAttachmentsCount: number;
  hasActiveOrClosedRequest: boolean;
  latestRequestStatus: string | null;
  latestRequestApprovedAt: string | null;
  latestRequestApprovedBy: string | null;
}

export function computeChecklist(input: ChecklistInput): ChecklistItem[] {
  const base = `/contracts/${input.contractId}`;

  const workflowStatus: ChecklistStatus = input.workflowOpen === 0 && input.workflowOverdue === 0 ? 'COMPLETED' : 'PENDING';

  const productionStatus: ChecklistStatus =
    input.productionTasksTotal === 0 ? 'NOT_REQUIRED' : input.productionTasksOpen === 0 ? 'COMPLETED' : 'PENDING';

  const erectionStatus: ChecklistStatus =
    input.erectionTasksTotal === 0 ? 'NOT_REQUIRED' : input.erectionTasksOpen === 0 ? 'COMPLETED' : 'PENDING';

  const paymentsStatus: ChecklistStatus = input.paymentsNonFinalCount === 0 ? 'COMPLETED' : 'PENDING';
  const claimsStatus: ChecklistStatus = input.claimsOpen === 0 ? 'COMPLETED' : 'PENDING';
  const risksStatus: ChecklistStatus = input.risksOpen === 0 ? 'COMPLETED' : 'PENDING';
  const issuesStatus: ChecklistStatus = input.issuesOpen === 0 ? 'COMPLETED' : 'PENDING';

  const documentsStatus: ChecklistStatus =
    input.documentObligationsTotal === 0
      ? 'NOT_REQUIRED'
      : input.documentObligationsPendingOrExpired === 0
        ? 'COMPLETED'
        : 'PENDING';

  const attachmentsStatus: ChecklistStatus = input.hasActiveOrClosedRequest
    ? input.closeoutAttachmentsCount > 0
      ? 'COMPLETED'
      : 'PENDING'
    : 'PENDING';

  const approvalStatus: ChecklistStatus =
    input.latestRequestStatus === 'APPROVED' || input.latestRequestStatus === 'CLOSED'
      ? 'COMPLETED'
      : input.latestRequestStatus === 'REJECTED'
        ? 'BLOCKED'
        : 'PENDING';

  return [
    { key: 'workflow', label: 'Workflow completed', required: true, status: workflowStatus, responsible: '—', completedDate: null, actionHref: `${base}/workflow` },
    { key: 'production', label: 'Production completed', required: productionStatus !== 'NOT_REQUIRED', status: productionStatus, responsible: '—', completedDate: null, actionHref: `${base}/production` },
    { key: 'erection', label: 'Delivery / Erection completed', required: erectionStatus !== 'NOT_REQUIRED', status: erectionStatus, responsible: '—', completedDate: null, actionHref: `${base}/workflow` },
    { key: 'payments', label: 'Payments cleared', required: true, status: paymentsStatus, responsible: '—', completedDate: null, actionHref: `${base}/payments` },
    { key: 'claims', label: 'Claims cleared', required: true, status: claimsStatus, responsible: '—', completedDate: null, actionHref: `${base}/claims` },
    { key: 'risks', label: 'Risks cleared', required: true, status: risksStatus, responsible: '—', completedDate: null, actionHref: `${base}/risks` },
    { key: 'issues', label: 'Issues cleared', required: true, status: issuesStatus, responsible: '—', completedDate: null, actionHref: `${base}/issues` },
    { key: 'documents', label: 'Required documents submitted', required: documentsStatus !== 'NOT_REQUIRED', status: documentsStatus, responsible: '—', completedDate: null, actionHref: `${base}/documents` },
    { key: 'attachments', label: 'Closeout attachments uploaded', required: true, status: attachmentsStatus, responsible: '—', completedDate: null, actionHref: `${base}/closeout` },
    {
      key: 'approval',
      label: 'Closeout request approved',
      required: true,
      status: approvalStatus,
      responsible: input.latestRequestApprovedBy ?? '—',
      completedDate: input.latestRequestApprovedAt,
      actionHref: `${base}/closeout`,
    },
  ];
}

export interface ChecklistProgress {
  totalRequired: number;
  completed: number;
  pending: number;
  notRequired: number;
  blocked: number;
  /** completed / totalRequired, rounded to the nearest whole percent — 0 when nothing is required (never divides by zero). */
  percent: number;
}

export function computeChecklistProgress(items: ChecklistItem[]): ChecklistProgress {
  const required = items.filter((i) => i.required);
  const completed = required.filter((i) => i.status === 'COMPLETED').length;
  const pending = items.filter((i) => i.status === 'PENDING').length;
  const notRequired = items.filter((i) => i.status === 'NOT_REQUIRED').length;
  const blocked = items.filter((i) => i.status === 'BLOCKED').length;
  const totalRequired = required.length;
  return {
    totalRequired,
    completed,
    pending,
    notRequired,
    blocked,
    percent: totalRequired === 0 ? 0 : Math.round((completed / totalRequired) * 100),
  };
}

// ---------------------------------------------------------------------------
// Blocking Items — one real row per actual blocking record, never an
// aggregated/invented row. Status sets mirror the real backend definitions:
// - Issues:   OPEN_ISSUE_STATUSES  (contract-closeout.service.ts)
// - Claims:   OPEN_CLAIM_STATUSES  (contract-closeout.service.ts)
// - Workflow: NOT IN CLOSEOUT_READY_WORKFLOW_STATUSES (contract-closeout.service.ts)
// - Payments: NOT IN FINAL_PAYMENT_STATUSES (contract-closeout.service.ts)
// - Risks:    NOT IN RESOLVED_STATUSES (contract-risks.service.ts)
// - Documents: status is PENDING or EXPIRED_OVERDUE (contract-document-obligations.service.ts)
// ---------------------------------------------------------------------------

const OPEN_ISSUE_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'WAITING_RESPONSE', 'RESOLVED']);
const OPEN_CLAIM_STATUSES = new Set(['DRAFT', 'UNDER_REVIEW', 'SUBMITTED', 'UNDER_NEGOTIATION', 'PARTIALLY_APPROVED']);
const CLOSEOUT_READY_WORKFLOW_STATUSES = new Set(['APPROVED', 'COMPLETED']);
const FINAL_PAYMENT_STATUSES = new Set(['PAID', 'CANCELLED']);
const RESOLVED_RISK_STATUSES = new Set(['MITIGATED', 'CLOSED', 'CANCELLED']);
const BLOCKING_DOCUMENT_STATUSES = new Set(['PENDING', 'EXPIRED_OVERDUE']);

export type BlockingSource = 'Workflow' | 'Payments' | 'Claims' | 'Risk Assessment' | 'Issue Log' | 'Documents & Obligations' | 'Closeout';

export interface BlockingItem {
  source: BlockingSource;
  item: string;
  priority: string;
  actionRequired: string;
  actionDueDate: string | null;
  status: string;
  actionHref: string;
}

interface WorkflowTaskLike { id: string; taskName: string; status: string; priority: string; dueDate: string | null; isOverdue: boolean }
interface PaymentLike { id: string; paymentNo?: string | undefined; invoiceNumber?: string | undefined; status: string; dueDate?: string | undefined }
interface ClaimLike { id: string; claimNo?: string | undefined; claimTitle: string; status: string; dueDate?: string | undefined }
interface RiskLike { id: string; riskNo?: string | undefined; description: string; status: string; riskEvaluation: string; actionDueDate?: string | undefined }
interface IssueLike { id: string; issueNo?: string | undefined; title: string; status: string; priority: string; dueDate?: string | undefined }
interface DocumentObligationLike { id: string; itemNo?: string | undefined; title: string; status: string; submissionOrExpiryDate?: string | undefined }

export interface BlockingItemsInput {
  contractId: string;
  workflowTasks: WorkflowTaskLike[];
  payments: PaymentLike[];
  claims: ClaimLike[];
  risks: RiskLike[];
  issues: IssueLike[];
  documentObligations: DocumentObligationLike[];
  latestRequestStatus: string | null;
}

export function computeBlockingItems(input: BlockingItemsInput): BlockingItem[] {
  const base = `/contracts/${input.contractId}`;
  const items: BlockingItem[] = [];

  for (const t of input.workflowTasks) {
    if (CLOSEOUT_READY_WORKFLOW_STATUSES.has(t.status)) continue;
    items.push({
      source: 'Workflow',
      item: t.taskName,
      priority: t.priority,
      // CM-67C — concise action text (the Status column already shows the real overdue/status value, so it doesn't need repeating here).
      actionRequired: 'Complete task',
      actionDueDate: t.dueDate,
      status: t.status,
      actionHref: `${base}/workflow`,
    });
  }

  for (const p of input.payments) {
    if (FINAL_PAYMENT_STATUSES.has(p.status)) continue;
    items.push({
      source: 'Payments',
      item: p.paymentNo ?? p.invoiceNumber ?? '—',
      priority: '—',
      actionRequired: 'Clear payment',
      actionDueDate: p.dueDate ?? null,
      status: p.status,
      actionHref: `${base}/payments`,
    });
  }

  for (const c of input.claims) {
    if (!OPEN_CLAIM_STATUSES.has(c.status)) continue;
    items.push({
      source: 'Claims',
      item: c.claimNo ?? c.claimTitle,
      priority: '—',
      actionRequired: 'Resolve claim',
      actionDueDate: c.dueDate ?? null,
      status: c.status,
      actionHref: `${base}/claims`,
    });
  }

  for (const r of input.risks) {
    if (RESOLVED_RISK_STATUSES.has(r.status)) continue;
    items.push({
      source: 'Risk Assessment',
      item: r.riskNo ?? r.description,
      priority: r.riskEvaluation,
      actionRequired: 'Mitigate risk',
      actionDueDate: r.actionDueDate ?? null,
      status: r.status,
      actionHref: `${base}/risks`,
    });
  }

  for (const i of input.issues) {
    if (!OPEN_ISSUE_STATUSES.has(i.status)) continue;
    items.push({
      source: 'Issue Log',
      item: i.issueNo ?? i.title,
      priority: i.priority,
      actionRequired: 'Resolve issue',
      actionDueDate: i.dueDate ?? null,
      status: i.status,
      actionHref: `${base}/issues`,
    });
  }

  for (const d of input.documentObligations) {
    if (!BLOCKING_DOCUMENT_STATUSES.has(d.status)) continue;
    items.push({
      source: 'Documents & Obligations',
      item: d.itemNo ?? d.title,
      priority: '—',
      actionRequired: d.status === 'EXPIRED_OVERDUE' ? 'Renew document' : 'Submit document',
      actionDueDate: d.submissionOrExpiryDate ?? null,
      status: d.status,
      actionHref: `${base}/documents`,
    });
  }

  if (input.latestRequestStatus === null || input.latestRequestStatus === 'REJECTED') {
    items.push({
      source: 'Closeout',
      item: input.latestRequestStatus === 'REJECTED' ? 'Closeout request was rejected' : 'Closeout approval missing',
      priority: '—',
      actionRequired: input.latestRequestStatus === 'REJECTED' ? 'Submit new request' : 'Submit for approval',
      actionDueDate: null,
      status: input.latestRequestStatus ?? 'NOT_STARTED',
      actionHref: `${base}/closeout`,
    });
  }

  return items;
}

// CM-67B — compact-layout ordering: real priority first, insertion order as
// the stable tiebreak. Items with no real priority (Payments/Claims/
// Documents/Closeout, which have no priority field — see computeBlockingItems
// above) rank lowest rather than being guessed at; this never invents a
// priority, it only orders by whichever real value already exists.
const BLOCKING_PRIORITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export function sortBlockingItemsByPriority(items: BlockingItem[]): BlockingItem[] {
  return [...items].sort((a, b) => (BLOCKING_PRIORITY_RANK[b.priority] ?? 0) - (BLOCKING_PRIORITY_RANK[a.priority] ?? 0));
}

// CM-67D — a real BlockingItem.status can be any real status value from any
// of its 6 sources (workflow/payments/claims/risks/issues/documents — see
// computeBlockingItems above), each with its own enum. Rather than
// enumerating every source's status set here, this generically converts the
// real stored SNAKE_CASE value into Title Case ("NOT_STARTED" → "Not
// Started") — it never invents a new label, only reformats the real one.
export function humanizeStatus(status: string): string {
  return status
    .split('_')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

// CM-67D — a small honest severity bucket for coloring the Status badge in
// the Blocking Items table, based only on the real status word's own
// meaning (never a per-source lookup table that could drift). Every status
// shown here is already a "not yet resolved" one (computeBlockingItems only
// ever includes open/non-final rows), so "neutral" means merely "not
// started yet" (calmer than an active-but-stuck state), "error" flags a
// genuinely overdue/rejected/expired condition, and "warning" is everything
// in between (in progress, under review, submitted, on hold, etc.).
export type BlockingStatusTone = 'neutral' | 'warning' | 'error';

const ERROR_STATUS_KEYWORDS = ['OVERDUE', 'REJECTED', 'EXPIRED'];
const NEUTRAL_STATUS_KEYWORDS = ['NOT_STARTED', 'DRAFT', 'PENDING'];

export function blockingStatusTone(status: string): BlockingStatusTone {
  if (ERROR_STATUS_KEYWORDS.some((k) => status.includes(k))) return 'error';
  if (NEUTRAL_STATUS_KEYWORDS.some((k) => status.includes(k))) return 'neutral';
  return 'warning';
}

// ---------------------------------------------------------------------------
// Claims / Risks / Issues Summary — real counts only, from each module's
// own already-computed summary + (for risks/variations, which have no
// closed-count field in their summary) a safe client-side count over the
// already-fetched, unpaginated real items list.
// ---------------------------------------------------------------------------

export function countRisksByBucket(risks: { status: string }[]): { open: number; mitigated: number; closedOrCancelled: number } {
  let open = 0;
  let mitigated = 0;
  let closedOrCancelled = 0;
  for (const r of risks) {
    if (r.status === 'OPEN' || r.status === 'IN_PROGRESS') open += 1;
    else if (r.status === 'MITIGATED') mitigated += 1;
    else if (r.status === 'CLOSED' || r.status === 'CANCELLED') closedOrCancelled += 1;
  }
  return { open, mitigated, closedOrCancelled };
}

const PENDING_VARIATION_STATUSES = new Set(['SUBMITTED', 'PENDING_APPROVAL']);

export function countVariationsByBucket(variations: { status: string }[]): { approved: number; pending: number } {
  let approved = 0;
  let pending = 0;
  for (const v of variations) {
    if (v.status === 'APPROVED') approved += 1;
    else if (PENDING_VARIATION_STATUSES.has(v.status)) pending += 1;
  }
  return { approved, pending };
}

// ---------------------------------------------------------------------------
// Financial Closeout Summary — Final Payment Status is a derived label
// (never a stored field), computed the same way isReadyForClosure already
// treats payments: no non-final (unpaid/partial/overdue) payments left.
// ---------------------------------------------------------------------------

export function computeFinalPaymentStatus(paymentsNonFinalCount: number): 'Fully Paid' | 'Outstanding' {
  return paymentsNonFinalCount === 0 ? 'Fully Paid' : 'Outstanding';
}
