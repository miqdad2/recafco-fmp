'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Paperclip, Download, Loader2 } from 'lucide-react';
import { updateWorkflowTaskAction, addWorkflowTaskCommentAction, uploadWorkflowTaskAttachmentAction } from '../../actions';
import type {
  ContractWorkflowTask,
  ContractPerson,
  ContractWorkflowTaskComment,
  ContractWorkflowTaskAttachment,
} from '@/lib/contracts-api';
import { inputCls, labelCls } from '../../_components/contract-form-fields';
import { WorkflowTaskStatusBadge } from './workflow-task-status-badge';
import { WorkflowTaskPriorityBadge } from './workflow-task-priority-badge';

interface Props {
  task: ContractWorkflowTask;
  contractId: string;
  people: ContractPerson[];
  /** Has contracts.update — may change every field, including manager-only ones. */
  canManage: boolean;
  /** May edit this specific task at all — true for a manager, or for staff editing their own assigned task (staff-allowed fields only). */
  canEdit: boolean;
  onClose: () => void;
  /** CM-53 — real contract identity for the Task Summary section, passed through from the caller's already-fetched contract data. Omitted (not fabricated) where the caller doesn't have it. */
  contractReference?: string;
  contractTitle?: string;
}

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

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const TEAM_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical Team',
  PRODUCTION: 'Production Team',
  ERECTION: 'Erection Team',
  QS_COMMERCIAL: 'QS / Commercial Team',
};

const DELAY_REASON_STATUSES = ['ON_HOLD', 'REJECTED'];
const SUBMITTED_LIKE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];

/**
 * CM-53 — human-readable labels for every key the backend's
 * sanitizeWorkflowTaskFormData() allow-list accepts (contract-workflow.service.ts,
 * WORKFLOW_TASK_FORM_DATA_TEXT_KEYS/BOOLEAN_KEYS), covering all four
 * Technical-step task-specific forms (Drawing Received/CM-46B, SD & Calculation/
 * CM-49, Getting Approval/CM-50, FD Issuance/CM-51). Deliberately one flat
 * label map rather than grouped-by-taskKey: a task's own formData only ever
 * contains the keys its own frontend form saved, so rendering whichever keys
 * are actually present, in this fixed order, already produces the right
 * per-task-type subset with no taskKey branching needed here.
 */
const FORM_DATA_FIELD_LABELS: Record<string, string> = {
  receivedDate: 'Received Date',
  receivedFrom: 'Received From',
  senderName: 'Sender Name',
  drawingType: 'Drawing Type',
  drawingReferenceNo: 'Drawing Reference No',
  revisionNo: 'Revision No',
  numberOfSheets: 'Number of Sheets',
  drawingDescription: 'Drawing Description',
  relatedAreaPackage: 'Related Area / Package',
  linkedContractStage: 'Linked Contract Stage',
  internalReferenceNo: 'Internal Reference No',
  internalNotes: 'Internal Notes',
  plannedReviewStart: 'Planned Review Start',
  submissionDate: 'Submission Date',
  submissionType: 'Submission Type',
  submittedTo: 'Submitted To',
  targetApprovalDate: 'Target Approval Date',
  relatedDrawingReceived: 'Related Drawing Received',
  calculationType: 'Calculation Type',
  numberOfSheetsFiles: 'Number of Sheets / Files',
  scopeDescription: 'Scope Description',
  submittedBy: 'Submitted By',
  designation: 'Designation',
  submissionMethod: 'Submission Method',
  submissionReferenceNo: 'Submission Reference No',
  contactNo: 'Contact No',
  email: 'Email',
  submittedOn: 'Submitted On',
  submittedToReviewerClient: 'Submitted To Reviewer / Client',
  approvalStatus: 'Approval Status',
  expectedApprovalDate: 'Expected Approval Date',
  reviewedOn: 'Reviewed On',
  reviewedBy: 'Reviewed By',
  clientReviewerComments: 'Client / Reviewer Comments',
  resubmissionDate: 'Resubmission Date',
  resubmissionReasonComments: 'Resubmission Reason / Comments',
  fdIssueDate: 'FD Issue Date',
  issuedTo: 'Issued To',
  purposeFor: 'Purpose / For',
  issueType: 'Issue Type',
  approvedReferenceNo: 'Approved Reference No',
  approvedDate: 'Approved Date',
  scale: 'Scale',
  distribution: 'Distribution',
  issueMethod: 'Issue Method',
  issuedBy: 'Issued By',
  requiresImmediateReview: 'Requires Immediate Review',
  additionalDocumentsReceived: 'Additional Documents Received',
  resubmissionRequired: 'Resubmission Required',
};
const FORM_DATA_FIELD_ORDER = Object.keys(FORM_DATA_FIELD_LABELS);

function formatFormDataValue(value: string | boolean): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
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

interface ActivityEntry {
  key: string;
  at: string;
  label: string;
}

const sectionHeadingCls = 'text-[11px] font-semibold text-text-secondary uppercase tracking-wide';

export function WorkflowTaskDrawer({ task, contractId, people, canManage, canEdit, onClose, contractReference, contractTitle }: Props): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<string>(task.status);

  // --- Task fields form ------------------------------------------------
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSaving, setUpdateSaving] = useState(false);

  async function handleUpdateSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (updateSaving) return;

    const formData = new FormData(e.currentTarget);
    setUpdateError(null);
    setUpdateSaving(true);
    try {
      const result = await updateWorkflowTaskAction(task.id, contractId, { error: null }, formData);
      if (result.error) {
        setUpdateError(result.error);
        return;
      }
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Task updated but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to save task update:', err);
      setUpdateError('Failed to save task update. Please try again.');
    } finally {
      setUpdateSaving(false);
    }
  }

  // --- Comments ----------------------------------------------------------
  const [comments, setComments] = useState<ContractWorkflowTaskComment[] | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentFormKey, setCommentFormKey] = useState(0);
  const [commentSaving, setCommentSaving] = useState(false);

  async function loadComments(): Promise<void> {
    try {
      const res = await fetch(`/contracts/workflow/tasks/${task.id}/comments`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load comments');
      const body = (await res.json()) as { data: ContractWorkflowTaskComment[] };
      setComments(body.data);
      setCommentsError(null);
    } catch {
      setCommentsError('Could not load comments.');
    }
  }

  useEffect(() => {
    void loadComments();
  }, [task.id]);

  const [commentError, setCommentError] = useState<string | null>(null);

  async function handleCommentSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (commentSaving) return;

    const formData = new FormData(e.currentTarget);
    setCommentError(null);
    setCommentSaving(true);
    try {
      const result = await addWorkflowTaskCommentAction(task.id, contractId, { error: null }, formData);
      if (result.error) {
        setCommentError(result.error);
        return;
      }
      setCommentFormKey((k) => k + 1);
      void loadComments();
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Comment added but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
      setCommentError('Failed to add comment. Please try again.');
    } finally {
      setCommentSaving(false);
    }
  }

  // --- Attachments ---------------------------------------------------------
  const [attachments, setAttachments] = useState<ContractWorkflowTaskAttachment[] | null>(null);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [attachmentFormKey, setAttachmentFormKey] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSaving, setUploadSaving] = useState(false);

  async function loadAttachments(): Promise<void> {
    try {
      const res = await fetch(`/contracts/workflow/tasks/${task.id}/attachments`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load attachments');
      const body = (await res.json()) as { data: ContractWorkflowTaskAttachment[] };
      setAttachments(body.data);
      setAttachmentsError(null);
    } catch {
      setAttachmentsError('Could not load attachments.');
    }
  }

  useEffect(() => {
    void loadAttachments();
  }, [task.id]);

  async function handleUploadSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (uploadSaving) return;

    const formData = new FormData(e.currentTarget);
    setUploadError(null);
    setUploadSaving(true);
    try {
      const result = await uploadWorkflowTaskAttachmentAction(task.id, contractId, { error: null }, formData);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      setAttachmentFormKey((k) => k + 1);
      void loadAttachments();
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Attachment uploaded but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to upload attachment:', err);
      setUploadError('Failed to upload attachment. Please try again.');
    } finally {
      setUploadSaving(false);
    }
  }

  // --- Recent Activity (CM-53) --------------------------------------------
  // Not a formal audit trail — this project has no task-history table. Merges
  // three real, already-fetched sources (task created/last-updated, comments,
  // attachments) into one time-sorted feed. Waits for both comments and
  // attachments to have loaded so the merged list isn't rendered half-built.
  const recentActivity = useMemo<ActivityEntry[] | null>(() => {
    if (comments === null || attachments === null) return null;
    const entries: ActivityEntry[] = [
      { key: 'created', at: task.createdAt, label: `Task created by ${task.createdByUser.displayName}` },
    ];
    if (task.updatedByUser && task.updatedAt !== task.createdAt) {
      entries.push({ key: 'updated', at: task.updatedAt, label: `Last updated by ${task.updatedByUser.displayName}` });
    }
    for (const c of comments) {
      entries.push({ key: `comment-${c.id}`, at: c.createdAt, label: `${c.createdByUser.displayName} added a comment` });
    }
    for (const a of attachments) {
      entries.push({ key: `attachment-${a.id}`, at: a.createdAt, label: `${a.uploadedByUser.displayName} uploaded ${a.originalFileName}` });
    }
    return entries.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
  }, [comments, attachments, task]);

  // --- Staff Submission (CM-53) -------------------------------------------
  // No distinct submittedAt column exists on this task — the best real data
  // is completedDate for a finished task, otherwise lastActivityAt (the same
  // backend-computed value the board's task cards already show). Never
  // invented; labeled "Last submitted/updated" rather than an exact
  // submission instant that isn't actually stored.
  const submissionTimestamp =
    task.status === 'COMPLETED' && task.completedDate
      ? { label: 'Completed', value: formatDate(task.completedDate) }
      : SUBMITTED_LIKE_STATUSES.includes(task.status)
        ? { label: 'Last submitted/updated', value: formatDateTime(task.lastActivityAt) }
        : null;
  const formDataEntries = task.formData
    ? FORM_DATA_FIELD_ORDER.filter((k) => task.formData?.[k] !== undefined)
    : [];

  const showDelayReason = DELAY_REASON_STATUSES.includes(status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workflow-task-drawer-title"
    >
      <div className="flex h-full w-full sm:w-[min(96vw,620px)] flex-col overflow-hidden border-l border-border bg-surface shadow-xl">
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-border bg-surface px-6 py-4">
          <div className="min-w-0">
            <h2 id="workflow-task-drawer-title" className="text-base font-semibold text-text-primary truncate">{task.taskName}</h2>
            <p className="text-xs text-text-secondary mt-0.5">{TEAM_LABELS[task.team] ?? task.team}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <WorkflowTaskStatusBadge status={task.status} />
              <WorkflowTaskPriorityBadge priority={task.priority} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
          {/* Section 1 — Task Summary */}
          <section className="space-y-2">
            <h3 className={sectionHeadingCls}>Task Summary</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {contractReference && (
                <div className="col-span-2">
                  <dt className="text-text-muted">Contract</dt>
                  <dd className="text-text-primary font-medium mt-0.5">
                    <span className="font-mono">{contractReference}</span>{contractTitle ? ` · ${contractTitle}` : ''}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-text-muted">Team</dt>
                <dd className="text-text-primary mt-0.5">{TEAM_LABELS[task.team] ?? task.team}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Last Activity</dt>
                <dd className="text-text-primary mt-0.5">{formatDateTime(task.lastActivityAt)}</dd>
              </div>
            </dl>
          </section>

          {/* Section 2 — Assignment & Dates */}
          <section className="space-y-2">
            <h3 className={sectionHeadingCls}>Assignment &amp; Dates</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="text-text-muted">Assigned To</dt>
                <dd className="text-text-primary mt-0.5">{task.responsibleUser?.displayName ?? 'Unassigned'}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Start Date</dt>
                <dd className="text-text-primary mt-0.5">{formatDate(task.startDate)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Due Date</dt>
                <dd className="text-text-primary mt-0.5">{formatDate(task.dueDate)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Completed Date</dt>
                <dd className="text-text-primary mt-0.5">{formatDate(task.completedDate)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Created</dt>
                <dd className="text-text-primary mt-0.5">{formatDateTime(task.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Last Updated</dt>
                <dd className="text-text-primary mt-0.5">{formatDateTime(task.updatedAt)}</dd>
              </div>
            </dl>
          </section>

          {/* Section 3 — Staff Submission */}
          <section className="space-y-2">
            <h3 className={sectionHeadingCls}>Staff Submission</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="text-text-muted">{task.updatedByUser ? 'Last Updated By' : 'Created By'}</dt>
                <dd className="text-text-primary mt-0.5">{task.updatedByUser?.displayName ?? task.createdByUser.displayName}</dd>
              </div>
              {submissionTimestamp && (
                <div>
                  <dt className="text-text-muted">{submissionTimestamp.label}</dt>
                  <dd className="text-text-primary mt-0.5">{submissionTimestamp.value}</dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-text-muted">Remarks / Update Note</dt>
                <dd className="text-text-primary mt-0.5 whitespace-pre-wrap">{task.remarks || '—'}</dd>
              </div>
            </dl>
            {!submissionTimestamp && (
              <p className="text-[11px] text-text-muted">
                No separate submission timestamp is stored for this task's current status — see Last Activity above.
              </p>
            )}

            {formDataEntries.length > 0 && (
              <div className="rounded-md border border-border bg-surface-secondary/40 p-3">
                <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Saved Task Details</p>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {formDataEntries.map((key) => (
                    <div key={key}>
                      <dt className="text-[11px] text-text-muted">{FORM_DATA_FIELD_LABELS[key]}</dt>
                      <dd className="text-xs text-text-primary whitespace-pre-wrap">{formatFormDataValue(task.formData![key]!)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>

          {/* Section 4 — Uploaded Documents */}
          <section className="space-y-3">
            <h3 className={sectionHeadingCls}>
              Uploaded Documents {attachments ? `(${attachments.length})` : ''}
            </h3>

            {attachmentsError && <p className="text-xs text-error">{attachmentsError}</p>}
            {attachments === null && !attachmentsError && <p className="text-xs text-text-muted">Loading…</p>}
            {attachments && attachments.length === 0 && <p className="text-xs text-text-muted">No documents uploaded yet.</p>}

            <div className="space-y-1.5">
              {attachments?.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface p-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-text-primary" title={a.originalFileName}>{a.originalFileName}</p>
                      <p className="text-text-muted">{formatBytes(a.fileSize)} · {a.uploadedByUser.displayName} · {formatDateTime(a.createdAt)}</p>
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

            {canEdit && (
              <form
                key={attachmentFormKey}
                onSubmit={handleUploadSubmit}
                className="space-y-2"
              >
                {uploadError && <p className="text-xs text-error">{uploadError}</p>}
                <input
                  type="file"
                  name="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="block w-full text-xs text-text-secondary file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text-primary hover:file:bg-surface-secondary"
                />
                <p className="text-[11px] text-text-muted">PDF, PNG, JPEG, Excel or Word — up to 10MB.</p>
                <button
                  type="submit"
                  disabled={uploadSaving}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                >
                  {uploadSaving && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                  {uploadSaving ? 'Uploading…' : 'Upload Attachment'}
                </button>
              </form>
            )}
          </section>

          {/* Section 5 — Progress Comments */}
          <section className="space-y-3">
            <h3 className={sectionHeadingCls}>
              Progress Comments {comments ? `(${comments.length})` : ''}
            </h3>

            {commentsError && <p className="text-xs text-error">{commentsError}</p>}
            {comments === null && !commentsError && <p className="text-xs text-text-muted">Loading…</p>}
            {comments && comments.length === 0 && <p className="text-xs text-text-muted">No comments yet.</p>}

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {comments?.map((c) => (
                <div key={c.id} className="rounded-md border border-border bg-surface p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2 text-text-muted mb-1">
                    <span className="font-medium text-text-primary">{c.createdByUser.displayName}</span>
                    <span>{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="text-text-secondary whitespace-pre-wrap">{c.comment}</p>
                </div>
              ))}
            </div>

            {canEdit && (
              <form
                key={commentFormKey}
                onSubmit={handleCommentSubmit}
                className="space-y-2"
              >
                {commentError && <p className="text-xs text-error">{commentError}</p>}
                <textarea
                  name="comment"
                  rows={2}
                  maxLength={5000}
                  required
                  placeholder="Add a progress comment…"
                  className={`${inputCls} resize-y`}
                />
                <button
                  type="submit"
                  disabled={commentSaving}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                >
                  {commentSaving ? 'Posting…' : 'Add Comment'}
                </button>
              </form>
            )}
          </section>

          {/* Section 6 — Manager Update */}
          <section>
            <h3 className={`${sectionHeadingCls} mb-3`}>Manager Update</h3>
            <form
              id="workflow-task-drawer-form"
              onSubmit={handleUpdateSubmit}
              className="space-y-4"
            >
              {updateError && (
                <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
                  {updateError}
                </div>
              )}

              {canEdit && !canManage && (
                <p className="text-xs text-info bg-info-light border border-info/20 rounded-md px-3 py-2">
                  You can update status, dates completed, remarks and delay reason for tasks assigned to you.
                  Only a manager can reassign, reschedule or change priority.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="status" className={labelCls}>Status</label>
                  <select
                    id="status"
                    name="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={!canEdit}
                    className={inputCls}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="priority" className={labelCls}>
                    Priority {canEdit && !canManage && <span className="text-text-muted font-normal">(manager only)</span>}
                  </label>
                  <select id="priority" name="priority" defaultValue={task.priority} disabled={!canManage} className={inputCls}>
                    {PRIORITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="responsibleUserId" className={labelCls}>
                  Responsible Person {canEdit && !canManage && <span className="text-text-muted font-normal">(manager only)</span>}
                </label>
                <select id="responsibleUserId" name="responsibleUserId" defaultValue={task.responsibleUserId ?? ''} disabled={!canManage} className={inputCls}>
                  <option value="">— Unassigned —</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.displayName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="startDate" className={labelCls}>
                    Start Date {canEdit && !canManage && <span className="text-text-muted font-normal">(manager only)</span>}
                  </label>
                  <input id="startDate" name="startDate" type="date" defaultValue={task.startDate ?? ''} disabled={!canManage} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="dueDate" className={labelCls}>
                    Due Date {canEdit && !canManage && <span className="text-text-muted font-normal">(manager only)</span>}
                  </label>
                  <input id="dueDate" name="dueDate" type="date" defaultValue={task.dueDate ?? ''} disabled={!canManage} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="completedDate" className={labelCls}>Completed Date</label>
                  <input id="completedDate" name="completedDate" type="date" defaultValue={task.completedDate ?? ''} disabled={!canEdit} className={inputCls} />
                </div>
              </div>

              {showDelayReason && (
                <div>
                  <label htmlFor="delayReason" className={labelCls}>Delay Reason</label>
                  <textarea
                    id="delayReason"
                    name="delayReason"
                    rows={2}
                    maxLength={2000}
                    defaultValue={task.delayReason ?? ''}
                    disabled={!canEdit}
                    placeholder="Why is this task on hold or rejected?"
                    className={`${inputCls} resize-y`}
                  />
                </div>
              )}

              <div>
                <label htmlFor="remarks" className={labelCls}>Remarks</label>
                <textarea
                  id="remarks"
                  name="remarks"
                  rows={2}
                  maxLength={5000}
                  defaultValue={task.remarks ?? ''}
                  disabled={!canEdit}
                  className={`${inputCls} resize-y`}
                />
              </div>

              {canEdit && (
                <button
                  type="submit"
                  disabled={updateSaving}
                  className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                >
                  {updateSaving ? 'Saving…' : 'Save Task Update'}
                </button>
              )}
            </form>
          </section>

          {/* Section 7 — Recent Activity */}
          <section className="space-y-2">
            <h3 className={sectionHeadingCls}>Recent Activity</h3>
            <p className="text-[11px] text-text-muted">Comments, uploads and this task's own last update — not a full audit trail.</p>
            {recentActivity === null ? (
              <p className="text-xs text-text-muted">Loading…</p>
            ) : recentActivity.length === 0 ? (
              <p className="text-xs text-text-muted">No recent activity.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {recentActivity.map((entry) => (
                  <div key={entry.key} className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 text-[11px] last:border-0">
                    <span className="text-text-secondary">{entry.label}</span>
                    <span className="shrink-0 text-text-muted">{formatDateTime(entry.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
