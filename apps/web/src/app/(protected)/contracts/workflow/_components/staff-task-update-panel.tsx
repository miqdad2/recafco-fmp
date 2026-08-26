'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Paperclip, Download, Loader2, Check, Circle, Info } from 'lucide-react';
import type { ActionResult } from '../../actions';
import { updateWorkflowTaskAction, addWorkflowTaskCommentAction, uploadWorkflowTaskAttachmentAction } from '../../actions';
import type { ContractWorkflowTaskComment, ContractWorkflowTaskAttachment } from '@/lib/contracts-api';
import type { StaffFlatTask } from '../../_lib/staff-task-grouping';
import { WorkflowTaskStatusBadge } from './workflow-task-status-badge';
import { WorkflowTaskPriorityBadge } from './workflow-task-priority-badge';

interface Props {
  task: StaffFlatTask;
  backHref: string;
  /** CM-45 — "Back to My Tasks" from My Tasks, "Back to Overdue Tasks" when opened from the Overdue list. Defaults to "Back to My Tasks" for any caller that doesn't pass one. */
  backLabel?: string;
}

const UPDATE_FORM_ID = 'staff-task-update-form';

// CM-49/CM-50/CM-51 — the one place task type is detected, keyed off the
// stable, backend-defined taskKey (contract-workflow-templates.ts) rather
// than the display taskName, which is just copy. Every task without a
// specific form (including Drawing Received) falls through to the
// original, unchanged form.
const SD_CALCULATION_TASK_KEY = 'technical_sd_calculation_submission';
const GETTING_APPROVAL_TASK_KEY = 'technical_getting_approval';
const FD_ISSUANCE_TASK_KEY = 'technical_fd_issuance';

// CM-46C — compact field styles scoped to this screen only (smaller than the
// shared inputCls/labelCls from contract-form-fields.tsx, which every other
// contract form still uses unchanged) — shrinking input height is this
// unit's own explicit requirement, not a global design-token change.
const fieldCls =
  'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const fieldLabelCls = 'block text-[11px] font-medium text-text-secondary mb-0.5';

const STATUS_OPTIONS = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On Hold' },
];

const TEAM_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical Team',
  PRODUCTION: 'Production Team',
  ERECTION: 'Erection Team',
  QS_COMMERCIAL: 'QS / Commercial Team',
};

const DELAY_REASON_STATUSES = ['ON_HOLD', 'REJECTED'];
const DONE_STATUSES = ['COMPLETED', 'APPROVED'];
const READY_FOR_NEXT_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED'];
const ALREADY_SUBMITTED_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED'];
const APPROVAL_STATUS_OPTIONS = ['Under Review', 'Approved', 'Approved with Comments', 'Changes Required', 'Rejected'];

// CM-51 — FD Issuance select options. formData values only (plain strings,
// same as every other optional field) — no new database enum, per the
// task's own instruction.
const ISSUED_TO_OPTIONS = ['Production Team', 'Erection Team', 'Client / Consultant', 'Project Team', 'Other'];
const PURPOSE_FOR_OPTIONS = ['Production', 'Erection', 'Client Submission', 'Record', 'Other'];
const ISSUE_TYPE_OPTIONS = ['Final Drawing (FD)', 'Revised Final Drawing', 'Approved Drawing', 'For Construction', 'Other'];
const SCALE_OPTIONS = ['As Per Drawing', 'Not Applicable', 'Other'];
const DISTRIBUTION_OPTIONS = ['Electronic', 'Hard Copy', 'Electronic + Hard Copy'];
const ISSUE_METHOD_OPTIONS = ['Email', 'Hand Delivery', 'System Upload', 'Other'];

function formatDate(iso: string | undefined): string {
  if (!iso) return 'No due date';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** CM-45 — whole days between dueDate and today, for the "Overdue by N days" badge. Never negative (only called when isOverdue is already true). */
function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - due.getTime()) / 86_400_000));
}

function formField(formData: Record<string, string | boolean> | null | undefined, key: string): string {
  const value = formData?.[key];
  return typeof value === 'string' ? value : '';
}

function formFlag(formData: Record<string, string | boolean> | null | undefined, key: string): boolean {
  return formData?.[key] === true;
}

type ActivityEntry = { at: string; label: string };
type SubmitIntent = 'draft' | 'save' | 'complete' | 'submit' | 'sendback' | 'reject';

/**
 * CM-44/CM-45/CM-46/CM-46B/CM-46C/CM-49/CM-50/CM-51 — the focused task work
 * screen Contract Staff use instead of the full manager contract detail
 * page. Deliberately a separate, smaller component from WorkflowTaskDrawer
 * (not a staff-mode variant of it): only ever renders the fields staff are
 * actually allowed to change (Status, Remarks, Delay Reason, task-specific
 * optional intake fields) plus Comments/Attachments — no responsible
 * person, due date, priority, or contract-lifecycle controls exist in the
 * markup at all, not just disabled. Submits through the exact same server
 * actions the manager drawer uses (updateWorkflowTaskAction /
 * addWorkflowTaskCommentAction / uploadWorkflowTaskAttachmentAction) — no
 * new backend mutation.
 *
 * CM-46C's single-window shell (h-full flex column; header/summary/
 * stepper/guidance shrink-0; a single flex-1 min-h-0 overflow-y-auto work
 * grid; a non-sticky bottom bar as the last flex child) is unchanged and
 * shared by every task type.
 *
 * CM-49/CM-50/CM-51 — task-specific work forms, one per Technical workflow
 * step: `isSdCalculation`/`isGettingApproval`/`isFdIssuance` (detected from
 * the task's stable, backend-defined taskKey, never the display taskName)
 * branch the header description, step guidance copy, the main work grid's
 * field section(s), and the right rail between Drawing Received's original
 * A/B/C/D layout (completely unchanged) and three "wide card + compact
 * right rail" layouts: SD & Calculation Submission's "Submission
 * Information", Getting Approval's "Approval Information", and FD
 * Issuance's "FD Issuance Information" (each with its own optional fields,
 * allow-listed server-side alongside the others — see
 * sanitizeWorkflowTaskFormData in contract-workflow.service.ts). SD,
 * Getting Approval and FD Issuance share the exact same right rail shape
 * (Workflow Steps / Task Details / Recent Activity, via the shared
 * `compactRightRail` block below) instead of Drawing Received's Checklist /
 * Activity Timeline / Task Details. All four forms share the exact same
 * Status select, Remarks textarea, comment form and attachment form — the
 * same core fields and the same three server actions — only which
 * *optional* fields render, and how the layout is titled/arranged, differs.
 *
 * Getting Approval's bottom-bar actions map onto existing statuses only,
 * never an invented one: Approve & Continue → COMPLETED (same mapping as
 * Mark Complete, just relabeled); Reject → REJECTED; Send Back for Changes
 * → ON_HOLD (distinct from Reject so the two buttons never collide on the
 * same status — "on hold pending resubmission" is the closest existing fit
 * for "sent back, awaiting a revised submission"). Both REJECTED and
 * ON_HOLD are already in DELAY_REASON_STATUSES, so clicking either button
 * naturally reveals the existing Delay Reason field — a real, already-built
 * place to record why, with no new field added for it.
 */
export function StaffTaskUpdatePanel({ task, backHref, backLabel = 'Back to My Tasks' }: Props): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<string>(task.status);
  const formData = task.formData;
  const isSdCalculation = task.taskKey === SD_CALCULATION_TASK_KEY;
  const isGettingApproval = task.taskKey === GETTING_APPROVAL_TASK_KEY;
  const isFdIssuance = task.taskKey === FD_ISSUANCE_TASK_KEY;
  // CM-50 — Getting Approval's "Resubmission Required" toggle: a plain
  // checkbox (not a separate Yes/No select) for the same simple boolean the
  // existing requiresImmediateReview/additionalDocumentsReceived checkboxes
  // already use; conditionally reveals Resubmission Date/Reason, neither of
  // which is mandatory.
  const [resubmissionRequired, setResubmissionRequired] = useState<boolean>(formFlag(formData, 'resubmissionRequired'));

  // --- Task fields form (Status + task-specific optional fields + Remarks) ---
  const formRef = useRef<HTMLFormElement>(null);
  const updateAction = updateWorkflowTaskAction.bind(null, task.id, task.contractId);
  const [updateState, updateFormAction, updatePending] = useActionState<ActionResult, FormData>(updateAction, { error: null });
  const updateSubmittedRef = useRef(false);
  const submitIntentRef = useRef<SubmitIntent>('save');
  // CM-49 — generalized from CM-46's boolean pendingComplete so both Mark
  // Complete and SD's Submit button can reuse the same "set status, wait
  // for the state update to land, then submit the form" flow.
  const [pendingStatusSubmit, setPendingStatusSubmit] = useState<string | null>(null);

  useEffect(() => {
    if (updateSubmittedRef.current && !updatePending && !updateState.error) {
      updateSubmittedRef.current = false;
      if (submitIntentRef.current === 'draft') {
        // Save Draft — stay on this screen so saved optional values are visible immediately.
        router.refresh();
      } else {
        router.push(backHref);
        router.refresh();
      }
    }
  }, [updateState, updatePending, router, backHref]);

  useEffect(() => {
    if (pendingStatusSubmit !== null && status === pendingStatusSubmit) {
      setPendingStatusSubmit(null);
      updateSubmittedRef.current = true;
      formRef.current?.requestSubmit();
    }
  }, [pendingStatusSubmit, status]);

  function handleMarkComplete(): void {
    submitIntentRef.current = 'complete';
    setStatus('COMPLETED');
    setPendingStatusSubmit('COMPLETED');
  }

  // CM-49 — SD & Calculation Submission's "Submit" button: sets the same,
  // already-existing SUBMITTED status (never a new/invented one) and saves
  // through the same form/action as everything else here.
  function handleSubmitForReview(): void {
    submitIntentRef.current = 'submit';
    setStatus('SUBMITTED');
    setPendingStatusSubmit('SUBMITTED');
  }

  // CM-50 — Getting Approval's "Send Back for Changes" and "Reject": both
  // map onto existing statuses only (see the component doc comment above
  // for why ON_HOLD, not REJECTED, was picked for "send back").
  function handleSendBackForChanges(): void {
    submitIntentRef.current = 'sendback';
    setStatus('ON_HOLD');
    setPendingStatusSubmit('ON_HOLD');
  }

  function handleReject(): void {
    submitIntentRef.current = 'reject';
    setStatus('REJECTED');
    setPendingStatusSubmit('REJECTED');
  }

  // --- Comments ----------------------------------------------------------
  const [comments, setComments] = useState<ContractWorkflowTaskComment[] | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentFormKey, setCommentFormKey] = useState(0);
  const addCommentAction = addWorkflowTaskCommentAction.bind(null, task.id, task.contractId);
  const [commentState, commentFormAction, commentPending] = useActionState<ActionResult, FormData>(addCommentAction, { error: null });
  const commentSubmittedRef = useRef(false);

  async function loadComments(): Promise<void> {
    try {
      const res = await fetch(`/contracts/workflow/tasks/${task.id}/comments`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load progress updates');
      const body = (await res.json()) as { data: ContractWorkflowTaskComment[] };
      setComments(body.data);
      setCommentsError(null);
    } catch {
      setCommentsError('Could not load progress updates.');
    }
  }

  useEffect(() => {
    void loadComments();
  }, [task.id]);

  useEffect(() => {
    if (commentSubmittedRef.current && !commentPending && !commentState.error) {
      commentSubmittedRef.current = false;
      setCommentFormKey((k) => k + 1);
      void loadComments();
    }
  }, [commentState, commentPending]);

  // --- Attachments ---------------------------------------------------------
  const [attachments, setAttachments] = useState<ContractWorkflowTaskAttachment[] | null>(null);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [attachmentFormKey, setAttachmentFormKey] = useState(0);
  const uploadAction = uploadWorkflowTaskAttachmentAction.bind(null, task.id, task.contractId);
  const [uploadState, uploadFormAction, uploadPending] = useActionState<ActionResult, FormData>(uploadAction, { error: null });
  const uploadSubmittedRef = useRef(false);

  async function loadAttachments(): Promise<void> {
    try {
      const res = await fetch(`/contracts/workflow/tasks/${task.id}/attachments`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load work documents');
      const body = (await res.json()) as { data: ContractWorkflowTaskAttachment[] };
      setAttachments(body.data);
      setAttachmentsError(null);
    } catch {
      setAttachmentsError('Could not load work documents.');
    }
  }

  useEffect(() => {
    void loadAttachments();
  }, [task.id]);

  useEffect(() => {
    if (uploadSubmittedRef.current && !uploadPending && !uploadState.error) {
      uploadSubmittedRef.current = false;
      setAttachmentFormKey((k) => k + 1);
      void loadAttachments();
    }
  }, [uploadState, uploadPending]);

  const showDelayReason = DELAY_REASON_STATUSES.includes(status);
  const canSubmit = (isSdCalculation || isFdIssuance) && !ALREADY_SUBMITTED_STATUSES.includes(status);
  const canSendBack = isGettingApproval && !['ON_HOLD', 'REJECTED', 'COMPLETED'].includes(status);
  const canReject = isGettingApproval && !['REJECTED', 'COMPLETED'].includes(status);

  // --- Workflow progress (same-team step sequence) ------------------------
  const stepIndex = task.teamTasks.findIndex((t) => t.id === task.id);
  const nextStep = stepIndex >= 0 ? task.teamTasks[stepIndex + 1] : undefined;
  const teamLabel = TEAM_LABELS[task.team] ?? task.team;
  const stepContext = stepIndex >= 0 && task.teamTasks.length > 1
    ? `${teamLabel} · Step ${stepIndex + 1} of ${task.teamTasks.length}`
    : teamLabel;

  const headerDescription = isFdIssuance
    ? 'Issue final drawings/documents to the next stage based on approved submissions.'
    : isGettingApproval
      ? 'Review submitted shop drawings and calculations, record approval status, and manage resubmission follow-up.'
      : isSdCalculation
        ? 'Prepare and submit shop drawings and structural calculations for review and approval.'
        : 'Record task progress, supporting documents and follow-up details for this workflow step.';

  const guidanceLines = isFdIssuance
    ? [
        'Issue final drawing/documents to Production or the next stage based on approved submissions.',
        'Upload final drawings and mention revision details.',
        'After issuance, mark the task complete.',
      ]
    : isGettingApproval
      ? [
          'Review submitted Shop Drawings and Calculations.',
          'Record reviewer/client approval status.',
          'If changes are required, record comments for resubmission.',
          'Upload approval or returned documents.',
        ]
      : isSdCalculation
        ? [
            'Prepare and submit Shop Drawing and Structural Calculation documents for review.',
            'Upload all required supporting documents.',
            'After submission, this task will move toward Getting Approval.',
          ]
        : [
            'Complete this assigned workflow task.',
            'Upload required supporting documents.',
            'Add progress updates or follow-up notes when needed.',
            'Mark complete when finished.',
          ];

  const remarksPlaceholder = isFdIssuance
    ? 'Final drawings issued to the relevant team/stage.'
    : isGettingApproval
      ? 'Review is in progress. Approval comments will be updated here.'
      : isSdCalculation
        ? 'Submitted shop drawings and structural calculations for review and approval.'
        : 'Add a note about your progress…';

  // --- Checklist (Drawing Received only) — derived from real data already on the task, never invented ---
  const hasReceiptOrTaskInfo = Boolean(
    formField(formData, 'receivedDate') || formField(formData, 'receivedFrom') || formField(formData, 'senderName') ||
    formField(formData, 'drawingType') || formField(formData, 'numberOfSheets') || formField(formData, 'drawingDescription') ||
    formField(formData, 'relatedAreaPackage') || formField(formData, 'linkedContractStage') || formField(formData, 'internalReferenceNo'),
  );
  const hasReferenceOrRevision = Boolean(formField(formData, 'drawingReferenceNo') || formField(formData, 'revisionNo'));
  const checklist = [
    { label: 'Received/task details recorded', done: hasReceiptOrTaskInfo },
    { label: 'Work documents uploaded', done: (attachments?.length ?? 0) > 0 },
    { label: 'Reference/revision captured', done: hasReferenceOrRevision },
    { label: 'Ready for next step', done: READY_FOR_NEXT_STATUSES.includes(task.status) },
  ];

  // --- Activity timeline — merged from comments, attachments and the task's own last-updated record ---
  const activity = useMemo<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];
    for (const c of comments ?? []) {
      entries.push({ at: c.createdAt, label: `${c.createdByUser.displayName} added a progress update` });
    }
    for (const a of attachments ?? []) {
      entries.push({ at: a.createdAt, label: `${a.uploadedByUser.displayName} uploaded ${a.originalFileName}` });
    }
    if (task.updatedByUser && task.updatedAt !== task.createdAt) {
      entries.push({ at: task.updatedAt, label: `${task.updatedByUser.displayName} last updated this task` });
    }
    return entries.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime()).slice(0, 8);
  }, [comments, attachments, task.updatedByUser, task.updatedAt, task.createdAt]);

  // Shared "Add Progress Update" block — identical JSX used inside both task-specific layouts below.
  const progressUpdatesBlock = (
    <div>
      <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
        Progress Updates {comments ? `(${comments.length})` : ''}
      </h3>
      {commentsError && <p className="text-xs text-danger">{commentsError}</p>}
      {comments === null && !commentsError && <p className="text-xs text-text-muted">Loading…</p>}
      {comments && comments.length === 0 && <p className="text-xs text-text-muted">No progress updates yet.</p>}
      <div className="space-y-1 max-h-20 overflow-y-auto mb-1.5">
        {comments?.map((c) => (
          <div key={c.id} className="rounded-md border border-border bg-surface-secondary/40 p-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2 text-text-muted mb-0.5">
              <span className="font-medium text-text-primary">{c.createdByUser.displayName}</span>
              <span>{formatDateTime(c.createdAt)}</span>
            </div>
            <p className="text-text-secondary whitespace-pre-wrap">{c.comment}</p>
          </div>
        ))}
      </div>
      <form key={commentFormKey} action={commentFormAction} onSubmit={() => { commentSubmittedRef.current = true; }} className="space-y-1.5">
        {commentState.error && <p className="text-xs text-danger">{commentState.error}</p>}
        <textarea
          name="comment"
          rows={1}
          maxLength={5000}
          required
          placeholder="Add a progress update…"
          className={`${fieldCls} resize-y`}
        />
        <button
          type="submit"
          disabled={commentPending}
          className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
        >
          {commentPending ? 'Adding…' : 'Add Progress Update'}
        </button>
      </form>
    </div>
  );

  // Shared Attachments card — identical markup for every task-specific layout, only the
  // section title differs (Getting Approval calls it "Approval Attachments" per spec).
  // No delete/remove control: the backend has no attachment-delete support (see CM-32/
  // CM-44 notes), so none was added.
  function attachmentsSection(title: string): React.JSX.Element {
    return (
    <section className="rounded-lg border border-border bg-surface p-2.5 space-y-2">
      <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
        {title} {attachments ? `(${attachments.length})` : ''}
      </h2>

      {attachmentsError && <p className="text-xs text-danger">{attachmentsError}</p>}
      {attachments === null && !attachmentsError && <p className="text-xs text-text-muted">Loading…</p>}
      {attachments && attachments.length === 0 && <p className="text-xs text-text-muted">No work documents uploaded yet.</p>}

      <div className="space-y-1 max-h-24 overflow-y-auto">
        {attachments?.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface p-1.5 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Paperclip className="size-3 shrink-0 text-text-muted" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-text-primary" title={a.originalFileName}>{a.originalFileName}</p>
                <p className="text-text-muted text-[10px]">{formatBytes(a.fileSize)} · {a.uploadedByUser.displayName}</p>
              </div>
            </div>
            <a
              href={`/contracts/workflow/tasks/${task.id}/attachments/${a.id}/download`}
              className="shrink-0 inline-flex items-center gap-1 text-accent hover:underline"
              title="Download"
            >
              <Download className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        ))}
      </div>

      <form key={attachmentFormKey} action={uploadFormAction} onSubmit={() => { uploadSubmittedRef.current = true; }} className="space-y-1.5">
        {uploadState.error && <p className="text-xs text-danger">{uploadState.error}</p>}
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="block w-full text-[11px] text-text-secondary file:mr-2 file:rounded-md file:border file:border-border file:bg-surface file:px-2 file:py-1 file:text-[11px] file:font-medium file:text-text-primary hover:file:bg-surface-secondary"
        />
        <p className="text-[10px] text-text-muted">PDF, PNG, JPEG, Excel or Word — up to 10MB.</p>
        <button
          type="submit"
          disabled={uploadPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
        >
          {uploadPending && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
          {uploadPending ? 'Uploading…' : 'Upload Work Document'}
        </button>
      </form>
    </section>
    );
  }

  // Shared right rail — Workflow Steps / Task Details / Recent Activity — used identically
  // by SD & Calculation Submission and Getting Approval.
  // Workflow Steps reuses the same real, sortOrder-sequenced task.teamTasks data the
  // horizontal stepper above already renders — never a hardcoded step-name list.
  const compactRightRail = (
    <div className="flex flex-col gap-2.5 min-w-0">
      <div className="rounded-lg border border-border bg-surface p-2.5">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1.5">Workflow Steps</h2>
        <ol className="space-y-1.5">
          {task.teamTasks.map((t, i) => {
            const isCurrent = t.id === task.id;
            const isDone = DONE_STATUSES.includes(t.status);
            return (
              <li key={t.id} className="flex items-center gap-1.5 text-xs">
                <span
                  className={[
                    'flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold',
                    isDone ? 'border-success bg-success text-white' : isCurrent ? 'border-accent text-accent' : 'border-border text-text-muted',
                  ].join(' ')}
                >
                  {isDone ? <Check className="size-2.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className={isCurrent ? 'font-semibold text-text-primary' : 'text-text-muted'}>{t.taskName}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="rounded-lg border border-border bg-surface p-2.5">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1.5">Task Details</h2>
        <dl className="space-y-1.5 text-xs">
          <div>
            <dt className="text-text-muted">Task Owner / Assigned To</dt>
            <dd className="text-text-primary font-medium mt-0.5">{task.responsibleUser?.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Team</dt>
            <dd className="text-text-primary font-medium mt-0.5">{teamLabel}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Created On</dt>
            <dd className="text-text-primary font-medium mt-0.5">{formatDate(task.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated</dt>
            <dd className="text-text-primary font-medium mt-0.5">{formatDateTime(task.lastActivityAt)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Priority</dt>
            <dd className="mt-0.5"><WorkflowTaskPriorityBadge priority={task.priority} /></dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-surface p-2.5">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1.5">Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="text-xs text-text-muted">No activity yet.</p>
        ) : (
          <ul className="space-y-1.5 max-h-32 overflow-y-auto">
            {activity.map((entry, i) => (
              <li key={i} className="text-xs">
                <p className="text-text-primary">{entry.label}</p>
                <p className="text-text-muted text-[10px]">{formatDateTime(entry.at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full min-h-0 flex flex-col px-4 lg:px-6 py-2.5 max-w-[1900px] mx-auto w-full gap-2.5">
      <div className="flex items-center justify-between shrink-0">
        <Link href={backHref} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {backLabel}
        </Link>
      </div>

      {/* Header — task name, task-specific description, badges */}
      <div className="rounded-lg border border-border bg-surface px-4 py-2 shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-text-primary leading-tight">{task.taskName}</h1>
            <p className="text-xs text-text-secondary mt-0.5">{headerDescription}</p>
            <p className="text-[11px] text-text-muted mt-0.5">{stepContext}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <WorkflowTaskStatusBadge status={task.status} />
            <WorkflowTaskPriorityBadge priority={task.priority} />
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${task.isOverdue ? 'bg-danger-light text-danger' : 'bg-surface-secondary text-text-secondary'}`}>
              {task.isOverdue && task.dueDate
                ? `Overdue by ${daysOverdue(task.dueDate)} day${daysOverdue(task.dueDate) === 1 ? '' : 's'}`
                : `Due ${formatDate(task.dueDate)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Contract summary strip — shared, task-agnostic */}
      <div className="rounded-lg border border-border bg-surface px-4 py-2 shrink-0">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-1.5 text-xs">
          <div>
            <dt className="text-text-muted">Contract ID</dt>
            <dd className="text-text-primary font-medium font-mono mt-0.5 truncate">{task.contractReference}</dd>
          </div>
          <div className="lg:col-span-2">
            <dt className="text-text-muted">Contract Name</dt>
            <dd className="text-text-primary font-medium mt-0.5 truncate" title={task.contractTitle}>{task.contractTitle}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Company / Client</dt>
            <dd className="text-text-primary font-medium mt-0.5 truncate" title={task.counterpartyName}>{task.counterpartyName}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Contract Manager</dt>
            <dd className="text-text-primary font-medium mt-0.5 truncate">{task.contractManagerName}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Current Stage</dt>
            <dd className="text-text-primary font-medium mt-0.5 truncate" title={task.taskName}>
              {task.taskName}{nextStep ? <span className="text-text-muted font-normal"> → {nextStep.taskName}</span> : null}
            </dd>
          </div>
        </dl>
      </div>

      {/* Workflow progress stepper — horizontal, compact, wraps on small screens. Shared, driven by real teamTasks. */}
      {task.teamTasks.length > 1 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-2 shrink-0">
          <ol className="flex flex-wrap items-center gap-y-1.5">
            {task.teamTasks.map((t, i) => {
              const isCurrent = t.id === task.id;
              const isDone = DONE_STATUSES.includes(t.status);
              return (
                <li key={t.id} className="flex items-center">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={[
                        'flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                        isDone
                          ? 'border-success bg-success text-white'
                          : isCurrent
                            ? 'border-accent text-accent'
                            : 'border-border text-text-muted',
                      ].join(' ')}
                    >
                      {isDone ? <Check className="size-3" aria-hidden="true" /> : i + 1}
                    </span>
                    <span
                      className={`text-[11px] leading-tight max-w-[110px] truncate ${isCurrent ? 'font-semibold text-text-primary' : 'text-text-muted'}`}
                      title={t.taskName}
                    >
                      {t.taskName}
                    </span>
                  </div>
                  {i < task.teamTasks.length - 1 && (
                    <span className="h-px w-4 sm:w-8 bg-border mx-1.5 shrink-0" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Step Guidance strip — compact, 2-column bullets on wide screens. Content is task-specific. */}
      <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info-light/40 px-3 py-2 shrink-0">
        <Info className="size-4 shrink-0 text-info mt-0.5" aria-hidden="true" />
        <div className="text-xs text-text-secondary min-w-0">
          <span className="font-semibold text-text-primary mr-1.5">Step Guidance:</span>
          <ul className="inline lg:grid lg:grid-cols-2 lg:gap-x-4">
            {guidanceLines.map((line, i) => (
              <li
                key={line}
                className={`inline lg:list-item ${i < guidanceLines.length - 1 ? "after:content-['_·_'] lg:after:content-none" : ''}`}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Main work grid — the only internally-scrolling region if content exceeds the available height. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isFdIssuance ? (
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_2fr_1fr] gap-2.5 items-start">
            {/* Main content — FD Issuance Information (wide), Final Drawing Attachments, Progress Updates */}
            <div className="lg:col-span-2 flex flex-col gap-2.5 min-w-0">
              <form id={UPDATE_FORM_ID} ref={formRef} action={updateFormAction} onSubmit={() => { updateSubmittedRef.current = true; }}>
                <input type="hidden" name="hasTaskFormFields" value="true" />

                {updateState.error && (
                  <div role="alert" className="mb-2.5 rounded-md border border-danger bg-danger-light px-3 py-2 text-xs text-danger">
                    {updateState.error}
                  </div>
                )}

                <div className="rounded-lg border border-border bg-surface p-2.5">
                  <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">FD Issuance Information</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="col-span-2 lg:col-span-1">
                      <label htmlFor="status" className={fieldLabelCls}>Status</label>
                      <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={fieldCls}>
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="fdIssueDate" className={fieldLabelCls}>FD Issue Date</label>
                      <input id="fdIssueDate" name="fdIssueDate" type="date" defaultValue={formField(formData, 'fdIssueDate')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="issuedTo" className={fieldLabelCls}>Issued To</label>
                      <select id="issuedTo" name="issuedTo" defaultValue={formField(formData, 'issuedTo')} className={fieldCls}>
                        <option value="">—</option>
                        {ISSUED_TO_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="purposeFor" className={fieldLabelCls}>Purpose / For</label>
                      <select id="purposeFor" name="purposeFor" defaultValue={formField(formData, 'purposeFor')} className={fieldCls}>
                        <option value="">—</option>
                        {PURPOSE_FOR_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="issueType" className={fieldLabelCls}>Issue Type</label>
                      <select id="issueType" name="issueType" defaultValue={formField(formData, 'issueType')} className={fieldCls}>
                        <option value="">—</option>
                        {ISSUE_TYPE_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="drawingReferenceNo" className={fieldLabelCls}>Drawing Reference No</label>
                      <input id="drawingReferenceNo" name="drawingReferenceNo" type="text" maxLength={200} defaultValue={formField(formData, 'drawingReferenceNo')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="revisionNo" className={fieldLabelCls}>Revision No</label>
                      <input id="revisionNo" name="revisionNo" type="text" maxLength={50} defaultValue={formField(formData, 'revisionNo')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="approvedReferenceNo" className={fieldLabelCls}>Approved Reference No</label>
                      <input id="approvedReferenceNo" name="approvedReferenceNo" type="text" maxLength={200} defaultValue={formField(formData, 'approvedReferenceNo')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="approvedDate" className={fieldLabelCls}>Approved Date</label>
                      <input id="approvedDate" name="approvedDate" type="date" defaultValue={formField(formData, 'approvedDate')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="numberOfSheetsFiles" className={fieldLabelCls}>No. of Sheets / Files</label>
                      <input id="numberOfSheetsFiles" name="numberOfSheetsFiles" type="text" inputMode="numeric" maxLength={20} defaultValue={formField(formData, 'numberOfSheetsFiles')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="scale" className={fieldLabelCls}>Scale</label>
                      <select id="scale" name="scale" defaultValue={formField(formData, 'scale')} className={fieldCls}>
                        <option value="">—</option>
                        {SCALE_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="distribution" className={fieldLabelCls}>Distribution</label>
                      <select id="distribution" name="distribution" defaultValue={formField(formData, 'distribution')} className={fieldCls}>
                        <option value="">—</option>
                        {DISTRIBUTION_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="issueMethod" className={fieldLabelCls}>Issue Method</label>
                      <select id="issueMethod" name="issueMethod" defaultValue={formField(formData, 'issueMethod')} className={fieldCls}>
                        <option value="">—</option>
                        {ISSUE_METHOD_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="issuedBy" className={fieldLabelCls}>Issued By</label>
                      <input id="issuedBy" name="issuedBy" type="text" maxLength={200} defaultValue={formField(formData, 'issuedBy')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="designation" className={fieldLabelCls}>Designation</label>
                      <input id="designation" name="designation" type="text" maxLength={200} defaultValue={formField(formData, 'designation')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="contactNo" className={fieldLabelCls}>Contact No</label>
                      <input id="contactNo" name="contactNo" type="text" maxLength={50} defaultValue={formField(formData, 'contactNo')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="email" className={fieldLabelCls}>Email</label>
                      <input id="email" name="email" type="email" maxLength={200} defaultValue={formField(formData, 'email')} className={fieldCls} />
                    </div>
                  </div>

                  {showDelayReason && (
                    <div className="mt-2">
                      <label htmlFor="delayReason" className={fieldLabelCls}>Delay Reason</label>
                      <textarea
                        id="delayReason"
                        name="delayReason"
                        rows={2}
                        maxLength={2000}
                        defaultValue={task.delayReason ?? ''}
                        placeholder="Why is this task on hold or rejected?"
                        className={`${fieldCls} resize-y`}
                      />
                    </div>
                  )}

                  <div className="mt-2">
                    <label htmlFor="remarks" className={fieldLabelCls}>Remarks / Update Note</label>
                    <textarea
                      id="remarks"
                      name="remarks"
                      rows={3}
                      maxLength={5000}
                      defaultValue={task.remarks ?? ''}
                      placeholder={remarksPlaceholder}
                      className={`${fieldCls} resize-y`}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted">All fields except Status are optional.</p>
                </div>
              </form>

              {attachmentsSection('Final Drawing Attachments')}

              <section className="rounded-lg border border-border bg-surface p-2.5">
                {progressUpdatesBlock}
              </section>
            </div>

            {compactRightRail}
          </div>
        ) : isGettingApproval ? (
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_2fr_1fr] gap-2.5 items-start">
            {/* Main content — Approval Information (wide), Approval Attachments, Progress Updates */}
            <div className="lg:col-span-2 flex flex-col gap-2.5 min-w-0">
              <form id={UPDATE_FORM_ID} ref={formRef} action={updateFormAction} onSubmit={() => { updateSubmittedRef.current = true; }}>
                <input type="hidden" name="hasTaskFormFields" value="true" />

                {updateState.error && (
                  <div role="alert" className="mb-2.5 rounded-md border border-danger bg-danger-light px-3 py-2 text-xs text-danger">
                    {updateState.error}
                  </div>
                )}

                <div className="rounded-lg border border-border bg-surface p-2.5">
                  <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Approval Information</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="col-span-2 lg:col-span-1">
                      <label htmlFor="status" className={fieldLabelCls}>Status</label>
                      <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={fieldCls}>
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="submittedOn" className={fieldLabelCls}>Submitted On</label>
                      <input id="submittedOn" name="submittedOn" type="date" defaultValue={formField(formData, 'submittedOn')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="submittedBy" className={fieldLabelCls}>Submitted By</label>
                      <input id="submittedBy" name="submittedBy" type="text" maxLength={200} defaultValue={formField(formData, 'submittedBy')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="submittedToReviewerClient" className={fieldLabelCls}>Submitted To (Reviewer / Client)</label>
                      <input id="submittedToReviewerClient" name="submittedToReviewerClient" type="text" maxLength={200} defaultValue={formField(formData, 'submittedToReviewerClient')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="approvalStatus" className={fieldLabelCls}>Approval Status</label>
                      <select id="approvalStatus" name="approvalStatus" defaultValue={formField(formData, 'approvalStatus')} className={fieldCls}>
                        <option value="">—</option>
                        {APPROVAL_STATUS_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="expectedApprovalDate" className={fieldLabelCls}>Expected Approval Date</label>
                      <input id="expectedApprovalDate" name="expectedApprovalDate" type="date" defaultValue={formField(formData, 'expectedApprovalDate')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="reviewedOn" className={fieldLabelCls}>Reviewed On</label>
                      <input id="reviewedOn" name="reviewedOn" type="date" defaultValue={formField(formData, 'reviewedOn')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="reviewedBy" className={fieldLabelCls}>Reviewed By</label>
                      <input id="reviewedBy" name="reviewedBy" type="text" maxLength={200} defaultValue={formField(formData, 'reviewedBy')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="revisionNo" className={fieldLabelCls}>Revision No</label>
                      <input id="revisionNo" name="revisionNo" type="text" maxLength={50} defaultValue={formField(formData, 'revisionNo')} className={fieldCls} />
                    </div>
                  </div>

                  <div className="mt-2">
                    <label htmlFor="clientReviewerComments" className={fieldLabelCls}>Client / Reviewer Comments</label>
                    <textarea id="clientReviewerComments" name="clientReviewerComments" rows={2} maxLength={2000} defaultValue={formField(formData, 'clientReviewerComments')} className={`${fieldCls} resize-y`} />
                  </div>

                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        name="resubmissionRequired"
                        defaultChecked={formFlag(formData, 'resubmissionRequired')}
                        onChange={(e) => setResubmissionRequired(e.target.checked)}
                        className="rounded border-border text-accent focus:ring-accent"
                      />
                      Resubmission Required
                    </label>
                  </div>

                  {resubmissionRequired && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="resubmissionDate" className={fieldLabelCls}>Resubmission Date</label>
                        <input id="resubmissionDate" name="resubmissionDate" type="date" defaultValue={formField(formData, 'resubmissionDate')} className={fieldCls} />
                      </div>
                      <div>
                        <label htmlFor="resubmissionReasonComments" className={fieldLabelCls}>Resubmission Reason / Comments</label>
                        <input id="resubmissionReasonComments" name="resubmissionReasonComments" type="text" maxLength={500} defaultValue={formField(formData, 'resubmissionReasonComments')} className={fieldCls} />
                      </div>
                    </div>
                  )}

                  {showDelayReason && (
                    <div className="mt-2">
                      <label htmlFor="delayReason" className={fieldLabelCls}>Delay Reason</label>
                      <textarea
                        id="delayReason"
                        name="delayReason"
                        rows={2}
                        maxLength={2000}
                        defaultValue={task.delayReason ?? ''}
                        placeholder="Why is this task on hold or rejected?"
                        className={`${fieldCls} resize-y`}
                      />
                    </div>
                  )}

                  <div className="mt-2">
                    <label htmlFor="remarks" className={fieldLabelCls}>Remarks / Update Note</label>
                    <textarea
                      id="remarks"
                      name="remarks"
                      rows={3}
                      maxLength={5000}
                      defaultValue={task.remarks ?? ''}
                      placeholder={remarksPlaceholder}
                      className={`${fieldCls} resize-y`}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted">All fields except Status are optional.</p>
                </div>
              </form>

              {attachmentsSection('Approval Attachments')}

              <section className="rounded-lg border border-border bg-surface p-2.5">
                {progressUpdatesBlock}
              </section>
            </div>

            {compactRightRail}
          </div>
        ) : isSdCalculation ? (
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_2fr_1fr] gap-2.5 items-start">
            {/* Main content — Submission Information (wide), Attachments, Progress Updates */}
            <div className="lg:col-span-2 flex flex-col gap-2.5 min-w-0">
              <form id={UPDATE_FORM_ID} ref={formRef} action={updateFormAction} onSubmit={() => { updateSubmittedRef.current = true; }}>
                <input type="hidden" name="hasTaskFormFields" value="true" />

                {updateState.error && (
                  <div role="alert" className="mb-2.5 rounded-md border border-danger bg-danger-light px-3 py-2 text-xs text-danger">
                    {updateState.error}
                  </div>
                )}

                <div className="rounded-lg border border-border bg-surface p-2.5">
                  <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Submission Information</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="col-span-2 lg:col-span-1">
                      <label htmlFor="status" className={fieldLabelCls}>Status</label>
                      <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className={fieldCls}>
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="submissionDate" className={fieldLabelCls}>Submission Date</label>
                      <input id="submissionDate" name="submissionDate" type="date" defaultValue={formField(formData, 'submissionDate')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="submissionType" className={fieldLabelCls}>Submission Type</label>
                      <input id="submissionType" name="submissionType" type="text" maxLength={200} defaultValue={formField(formData, 'submissionType')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="submittedTo" className={fieldLabelCls}>Submitted To</label>
                      <input id="submittedTo" name="submittedTo" type="text" maxLength={200} defaultValue={formField(formData, 'submittedTo')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="targetApprovalDate" className={fieldLabelCls}>Target Approval Date</label>
                      <input id="targetApprovalDate" name="targetApprovalDate" type="date" defaultValue={formField(formData, 'targetApprovalDate')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="drawingReferenceNo" className={fieldLabelCls}>Drawing Reference No</label>
                      <input id="drawingReferenceNo" name="drawingReferenceNo" type="text" maxLength={200} defaultValue={formField(formData, 'drawingReferenceNo')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="revisionNo" className={fieldLabelCls}>Revision No</label>
                      <input id="revisionNo" name="revisionNo" type="text" maxLength={50} defaultValue={formField(formData, 'revisionNo')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="relatedDrawingReceived" className={fieldLabelCls}>Related Drawing Received</label>
                      <input id="relatedDrawingReceived" name="relatedDrawingReceived" type="text" maxLength={200} defaultValue={formField(formData, 'relatedDrawingReceived')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="calculationType" className={fieldLabelCls}>Calculation Type</label>
                      <input id="calculationType" name="calculationType" type="text" maxLength={200} defaultValue={formField(formData, 'calculationType')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="numberOfSheetsFiles" className={fieldLabelCls}>No. of Sheets / Files</label>
                      <input id="numberOfSheetsFiles" name="numberOfSheetsFiles" type="text" inputMode="numeric" maxLength={20} defaultValue={formField(formData, 'numberOfSheetsFiles')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="submittedBy" className={fieldLabelCls}>Submitted By</label>
                      <input id="submittedBy" name="submittedBy" type="text" maxLength={200} defaultValue={formField(formData, 'submittedBy')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="designation" className={fieldLabelCls}>Designation</label>
                      <input id="designation" name="designation" type="text" maxLength={200} defaultValue={formField(formData, 'designation')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="submissionMethod" className={fieldLabelCls}>Submission Method</label>
                      <input id="submissionMethod" name="submissionMethod" type="text" maxLength={200} defaultValue={formField(formData, 'submissionMethod')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="submissionReferenceNo" className={fieldLabelCls}>Submission Reference No</label>
                      <input id="submissionReferenceNo" name="submissionReferenceNo" type="text" maxLength={200} defaultValue={formField(formData, 'submissionReferenceNo')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="contactNo" className={fieldLabelCls}>Contact No</label>
                      <input id="contactNo" name="contactNo" type="text" maxLength={50} defaultValue={formField(formData, 'contactNo')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="email" className={fieldLabelCls}>Email</label>
                      <input id="email" name="email" type="email" maxLength={200} defaultValue={formField(formData, 'email')} className={fieldCls} />
                    </div>
                  </div>

                  <div className="mt-2">
                    <label htmlFor="scopeDescription" className={fieldLabelCls}>Scope Description</label>
                    <textarea id="scopeDescription" name="scopeDescription" rows={2} maxLength={2000} defaultValue={formField(formData, 'scopeDescription')} className={`${fieldCls} resize-y`} />
                  </div>

                  {showDelayReason && (
                    <div className="mt-2">
                      <label htmlFor="delayReason" className={fieldLabelCls}>Delay Reason</label>
                      <textarea
                        id="delayReason"
                        name="delayReason"
                        rows={2}
                        maxLength={2000}
                        defaultValue={task.delayReason ?? ''}
                        placeholder="Why is this task on hold or rejected?"
                        className={`${fieldCls} resize-y`}
                      />
                    </div>
                  )}

                  <div className="mt-2">
                    <label htmlFor="remarks" className={fieldLabelCls}>Remarks / Update Note</label>
                    <textarea
                      id="remarks"
                      name="remarks"
                      rows={3}
                      maxLength={5000}
                      defaultValue={task.remarks ?? ''}
                      placeholder={remarksPlaceholder}
                      className={`${fieldCls} resize-y`}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-text-muted">All fields except Status are optional.</p>
                </div>
              </form>

              {attachmentsSection('Attachments')}

              <section className="rounded-lg border border-border bg-surface p-2.5">
                {progressUpdatesBlock}
              </section>
            </div>

            {compactRightRail}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_2fr_1fr] gap-2.5 items-start">
            {/* Left column — A. Receipt Details, C. Attachments */}
            <div className="flex flex-col gap-2.5 min-w-0">
              <form id={UPDATE_FORM_ID} ref={formRef} action={updateFormAction} onSubmit={() => { updateSubmittedRef.current = true; }}>
                <input type="hidden" name="hasTaskFormFields" value="true" />

                {updateState.error && (
                  <div role="alert" className="mb-2.5 rounded-md border border-danger bg-danger-light px-3 py-2 text-xs text-danger">
                    {updateState.error}
                  </div>
                )}

                <div className="rounded-lg border border-border bg-surface p-2.5">
                  <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">A. Receipt Details</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label htmlFor="status" className={fieldLabelCls}>Status</label>
                      <select
                        id="status"
                        name="status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className={fieldCls}
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="receivedDate" className={fieldLabelCls}>Received Date</label>
                      <input id="receivedDate" name="receivedDate" type="date" defaultValue={formField(formData, 'receivedDate')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="receivedFrom" className={fieldLabelCls}>Received From</label>
                      <input id="receivedFrom" name="receivedFrom" type="text" maxLength={200} defaultValue={formField(formData, 'receivedFrom')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="senderName" className={fieldLabelCls}>Sender Name</label>
                      <input id="senderName" name="senderName" type="text" maxLength={200} defaultValue={formField(formData, 'senderName')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="drawingType" className={fieldLabelCls}>Drawing / Document Type</label>
                      <input id="drawingType" name="drawingType" type="text" maxLength={200} defaultValue={formField(formData, 'drawingType')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="drawingReferenceNo" className={fieldLabelCls}>Drawing / Document Ref. No</label>
                      <input id="drawingReferenceNo" name="drawingReferenceNo" type="text" maxLength={200} defaultValue={formField(formData, 'drawingReferenceNo')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="revisionNo" className={fieldLabelCls}>Revision No</label>
                      <input id="revisionNo" name="revisionNo" type="text" maxLength={50} defaultValue={formField(formData, 'revisionNo')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="numberOfSheets" className={fieldLabelCls}>No. of Sheets / Pages</label>
                      <input id="numberOfSheets" name="numberOfSheets" type="text" inputMode="numeric" maxLength={20} defaultValue={formField(formData, 'numberOfSheets')} className={fieldCls} />
                    </div>
                  </div>

                  {showDelayReason && (
                    <div className="mt-2">
                      <label htmlFor="delayReason" className={fieldLabelCls}>Delay Reason</label>
                      <textarea
                        id="delayReason"
                        name="delayReason"
                        rows={2}
                        maxLength={2000}
                        defaultValue={task.delayReason ?? ''}
                        placeholder="Why is this task on hold or rejected?"
                        className={`${fieldCls} resize-y`}
                      />
                    </div>
                  )}
                  <p className="mt-1.5 text-[10px] text-text-muted">All fields except Status are optional.</p>
                </div>
              </form>

              {attachmentsSection('Attachments')}
            </div>

            {/* Middle column — B. Drawing/Task Information, D. Remarks & Follow-up (incl. Progress Updates) */}
            <div className="flex flex-col gap-2.5 min-w-0">
              <div className="rounded-lg border border-border bg-surface p-2.5">
                <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">B. Drawing / Task Information</h2>
                <div className="space-y-2">
                  <div>
                    <label htmlFor="drawingDescription" className={fieldLabelCls}>Description</label>
                    <textarea form={UPDATE_FORM_ID} id="drawingDescription" name="drawingDescription" rows={2} maxLength={2000} defaultValue={formField(formData, 'drawingDescription')} className={`${fieldCls} resize-y`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="relatedAreaPackage" className={fieldLabelCls}>Related Area / Package</label>
                      <input form={UPDATE_FORM_ID} id="relatedAreaPackage" name="relatedAreaPackage" type="text" maxLength={200} defaultValue={formField(formData, 'relatedAreaPackage')} className={fieldCls} />
                    </div>
                    <div>
                      <label htmlFor="linkedContractStage" className={fieldLabelCls}>Linked Contract Stage</label>
                      <input form={UPDATE_FORM_ID} id="linkedContractStage" name="linkedContractStage" type="text" maxLength={200} defaultValue={formField(formData, 'linkedContractStage')} className={fieldCls} />
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="internalReferenceNo" className={fieldLabelCls}>Internal Reference / Intake No</label>
                      <input form={UPDATE_FORM_ID} id="internalReferenceNo" name="internalReferenceNo" type="text" maxLength={200} defaultValue={formField(formData, 'internalReferenceNo')} className={fieldCls} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <input form={UPDATE_FORM_ID} type="checkbox" name="requiresImmediateReview" defaultChecked={formFlag(formData, 'requiresImmediateReview')} className="rounded border-border text-accent focus:ring-accent" />
                      Requires immediate review
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <input form={UPDATE_FORM_ID} type="checkbox" name="additionalDocumentsReceived" defaultChecked={formFlag(formData, 'additionalDocumentsReceived')} className="rounded border-border text-accent focus:ring-accent" />
                      Additional documents received
                    </label>
                  </div>
                </div>
              </div>

              {/* D. Remarks & Follow-up — Progress Updates lives inside this card, not a separate section below the grid */}
              <div className="rounded-lg border border-border bg-surface p-2.5 space-y-2">
                <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">D. Remarks &amp; Follow-up</h2>
                <div>
                  <label htmlFor="remarks" className={fieldLabelCls}>Remarks / Update Note</label>
                  <textarea
                    form={UPDATE_FORM_ID}
                    id="remarks"
                    name="remarks"
                    rows={2}
                    maxLength={5000}
                    defaultValue={task.remarks ?? ''}
                    placeholder={remarksPlaceholder}
                    className={`${fieldCls} resize-y`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="internalNotes" className={fieldLabelCls}>Internal Notes</label>
                    <textarea form={UPDATE_FORM_ID} id="internalNotes" name="internalNotes" rows={2} maxLength={2000} defaultValue={formField(formData, 'internalNotes')} className={`${fieldCls} resize-y`} />
                  </div>
                  <div>
                    <label htmlFor="plannedReviewStart" className={fieldLabelCls}>Planned Review Start</label>
                    <input form={UPDATE_FORM_ID} id="plannedReviewStart" name="plannedReviewStart" type="date" defaultValue={formField(formData, 'plannedReviewStart')} className={fieldCls} />
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  {progressUpdatesBlock}
                </div>
                <p className="text-[10px] text-text-muted pt-1 border-t border-border">
                  Mark Complete below updates this task&apos;s status — optional fields above are saved but never required to complete it.
                </p>
              </div>
            </div>

            {/* Right rail — checklist, activity, task details */}
            <div className="flex flex-col gap-2.5 min-w-0">
              <div className="rounded-lg border border-border bg-surface p-2.5">
                <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1.5">Task Checklist</h2>
                <ul className="space-y-1">
                  {checklist.map((item) => (
                    <li key={item.label} className="flex items-center gap-1.5 text-xs">
                      {item.done ? (
                        <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
                      ) : (
                        <Circle className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                      )}
                      <span className={item.done ? 'text-text-primary' : 'text-text-muted'}>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-surface p-2.5">
                <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1.5">Activity Timeline</h2>
                {activity.length === 0 ? (
                  <p className="text-xs text-text-muted">No activity yet.</p>
                ) : (
                  <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                    {activity.map((entry, i) => (
                      <li key={i} className="text-xs">
                        <p className="text-text-primary">{entry.label}</p>
                        <p className="text-text-muted text-[10px]">{formatDateTime(entry.at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-border bg-surface p-2.5">
                <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1.5">Task Details</h2>
                <dl className="space-y-1.5 text-xs">
                  <div>
                    <dt className="text-text-muted">Assigned To</dt>
                    <dd className="text-text-primary font-medium mt-0.5">{task.responsibleUser?.displayName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Team / Department</dt>
                    <dd className="text-text-primary font-medium mt-0.5">{teamLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Last Updated</dt>
                    <dd className="text-text-primary font-medium mt-0.5">{formatDateTime(task.lastActivityAt)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar — last flex child of the h-full column, so it's always visible without overlaying content */}
      <div className="rounded-lg border border-border bg-surface px-4 py-2 shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            form={UPDATE_FORM_ID}
            onClick={() => { submitIntentRef.current = 'draft'; }}
            disabled={updatePending}
            className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {updatePending && submitIntentRef.current === 'draft' ? 'Saving Draft…' : 'Save Draft'}
          </button>
          <Link
            href={backHref}
            className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            {backLabel}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canSubmit && (
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={updatePending}
              className="rounded-md border border-accent bg-accent/10 px-3.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {updatePending && submitIntentRef.current === 'submit' ? 'Submitting…' : 'Submit'}
            </button>
          )}
          {canSendBack && (
            <button
              type="button"
              onClick={handleSendBackForChanges}
              disabled={updatePending}
              className="rounded-md border border-warning bg-warning-light px-3.5 py-1.5 text-xs font-medium text-warning hover:bg-warning-light/70 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {updatePending && submitIntentRef.current === 'sendback' ? 'Sending Back…' : 'Send Back for Changes'}
            </button>
          )}
          {canReject && (
            <button
              type="button"
              onClick={handleReject}
              disabled={updatePending}
              className="rounded-md border border-danger bg-danger-light px-3.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-light/70 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {updatePending && submitIntentRef.current === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          )}
          {status !== 'COMPLETED' && (
            <button
              type="button"
              onClick={handleMarkComplete}
              disabled={updatePending}
              className="rounded-md border border-success bg-success-light px-3.5 py-1.5 text-xs font-medium text-success hover:bg-success-light/70 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {isGettingApproval ? 'Approve & Continue' : isFdIssuance ? 'Mark Complete & Continue' : 'Mark Complete'}
            </button>
          )}
          <button
            type="submit"
            form={UPDATE_FORM_ID}
            onClick={() => { submitIntentRef.current = 'save'; }}
            disabled={updatePending}
            className="rounded-md bg-accent px-3.5 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
          >
            {updatePending && submitIntentRef.current === 'save' ? 'Saving Update…' : 'Save Update'}
          </button>
        </div>
      </div>
    </div>
  );
}
