'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Paperclip, Download, Trash2, UploadCloud, Loader2 } from 'lucide-react';
import {
  createErectionScheduleAction,
  updateErectionScheduleAction,
  uploadErectionScheduleAttachmentAction,
  deleteErectionScheduleAttachmentAction,
} from '../../../../../../actions';
import type { ContractErectionMethodStatement, ContractErectionMethodStatementApproval, ContractErectionSchedule, ContractActivity } from '@/lib/contracts-api';
import { inputCls, labelCls, gridCls3, InfoBox } from '../../../../../../_components/contract-form-fields';
import {
  validateErectionScheduleFormValues,
  validateErectionScheduleHoldOrReturnRemarks,
  computeDisplayStatus,
  computePlannedDurationDays,
  computeErectionStepTrackerCurrentStep,
} from '../../../../../../_lib/contract-erection-schedule-helpers';
import { ErectionWorkflowStepTracker } from '../../method-statement/_components/erection-workflow-step-tracker';
import { ErectionStaffBackNav } from '../../../_components/erection-staff-back-nav';
import { ErectionStepGuidance } from '../../../_components/erection-step-guidance';
import { ErectionPreviewBanner } from '../../../_components/erection-preview-banner';

interface ContractSummary {
  referenceNumber: string;
  title: string;
  counterpartyName: string;
  /** CM-71H.7 — Job Order No. is always read-only here, sourced from the contract when available, else from Step 1. */
  jobOrderNo: string | null;
}

interface Props {
  contractId: string;
  statement: ContractErectionMethodStatement | null;
  approval: ContractErectionMethodStatementApproval | null;
  schedule: ContractErectionSchedule | null;
  contract: ContractSummary;
  canUpdate: boolean;
  /** Real ContractActivity rows already filtered to Step 2 + Step 3 events (see page.tsx) — never fabricated. */
  recentActivity: ContractActivity[];
  /** CM-71H.6 — see erection-method-statement-panel.tsx's own doc comment. Defaults to false (manager-tier, unchanged). */
  isStaffTier?: boolean;
  /** CM-71H.9 — manager-tier-only, only ever true via `?preview=1` (see erection-preview.ts). Defaults to false (unchanged for every existing caller). */
  isPreviewMode?: boolean;
}

type SubmitIntent = 'draft' | 'issue' | 'hold' | 'return';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * CM-71D — real attachment upload, list, and download/delete for the
 * schedule's own supporting documents (Erection Schedule Detail, Manpower
 * Plan, Equipment Plan, Crane/Site Layout, Coordination Documents — shown as
 * suggested labels only, not a stored field). Same CM-70J robust local-state
 * pattern as Steps 1/2's own AttachmentsSection.
 */
function AttachmentsSection({ contractId, schedule }: { contractId: string; schedule: ContractErectionSchedule }): React.JSX.Element {
  const router = useRouter();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function handleUploadSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (isUploading) return;

    const formData = new FormData(e.currentTarget);
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setUploadError('Please choose a file before uploading.');
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      const result = await uploadErectionScheduleAttachmentAction(contractId, schedule.id, formData);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      setFormKey((k) => k + 1);
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Attachment uploaded but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to upload attachment:', err);
      setUploadError('Failed to upload attachment. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(attachmentId: string, fileName: string): Promise<void> {
    if (!window.confirm(`Remove "${fileName}"? This cannot be undone.`)) return;
    setDeletingId(attachmentId);
    try {
      const result = await deleteErectionScheduleAttachmentAction(contractId, schedule.id, attachmentId);
      if (result.error) {
        setUploadError(result.error);
        return;
      }
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Attachment deleted but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      setUploadError('Failed to delete attachment. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <p className={labelCls}>Attachments</p>

      {schedule.attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {schedule.attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-secondary/50 px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Paperclip className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="truncate text-text-primary font-medium" title={a.originalFileName}>{a.originalFileName}</span>
                <span className="shrink-0 text-text-muted">
                  {a.uploadedByUser ? ` · ${a.uploadedByUser.displayName}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/contracts/${contractId}/workflow/erection/schedule/${schedule.id}/attachments/${a.id}/download`}
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                  title={`Download ${a.originalFileName}`}
                >
                  <Download className="size-3.5 shrink-0" aria-hidden="true" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id, a.originalFileName)}
                  disabled={deletingId === a.id}
                  className="inline-flex items-center gap-1 text-text-muted hover:text-error focus:outline-none disabled:opacity-50"
                  title={`Delete ${a.originalFileName}`}
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-muted">No supporting documents uploaded yet.</p>
      )}

      <form key={formKey} onSubmit={handleUploadSubmit} className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="file"
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
          onChange={() => setUploadError(null)}
          className="flex-1 min-w-40 text-xs text-text-secondary file:mr-2 file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-text-primary hover:file:bg-surface-secondary"
        />
        <button
          type="submit"
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
        >
          {isUploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <UploadCloud className="size-3.5 shrink-0" aria-hidden="true" />}
          {isUploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
      {uploadError && <p className="text-xs text-error">{uploadError}</p>}
      <p className="text-[11px] text-text-muted">
        Suggested: Erection Schedule Detail, Manpower Plan, Equipment Plan, Crane Layout / Site Layout, Coordination Documents.
        Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx). Max 10MB.
      </p>
    </div>
  );
}

/**
 * CM-71D — Erection Workflow, Step 3: Issue Erection Schedule. Same
 * "create-once, edit-forever" shape as Step 1 (mode derived from whether
 * `schedule` is null). Written using the CM-70J robust save pattern.
 * Required-field validation runs on every save — Save Draft included —
 * since every required field here is a real, non-nullable database column
 * (same reasoning as Step 1). Hold/Return additionally require Remarks,
 * mirrored server-side by assertRemarksPresentForHoldOrReturn.
 */
export function ErectionSchedulePanel({
  contractId,
  statement,
  approval,
  schedule,
  contract,
  canUpdate,
  recentActivity,
  isStaffTier = false,
  isPreviewMode = false,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [clientError, setClientError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [plannedStartDate, setPlannedStartDate] = useState(schedule?.plannedStartDate ?? '');
  const [plannedEndDate, setPlannedEndDate] = useState(schedule?.plannedEndDate ?? '');
  const [estimatedManpowerPlanned, setEstimatedManpowerPlanned] = useState(String(schedule?.estimatedManpowerPlanned ?? ''));
  const [requiredEquipmentPlanned, setRequiredEquipmentPlanned] = useState(String(schedule?.requiredEquipmentPlanned ?? ''));
  const submitIntentRef = useRef<SubmitIntent>('draft');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, intent: SubmitIntent): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);

    const errors = validateErectionScheduleFormValues({
      scheduleReferenceNo: String(formData.get('scheduleReferenceNo') ?? ''),
      scheduleDate: String(formData.get('scheduleDate') ?? ''),
      plannedStartDate: String(formData.get('plannedStartDate') ?? ''),
      plannedEndDate: String(formData.get('plannedEndDate') ?? ''),
      jobOrderNo: String(formData.get('jobOrderNo') ?? ''),
      erectionCrewTeam: String(formData.get('erectionCrewTeam') ?? ''),
      estimatedManpowerPlanned: String(formData.get('estimatedManpowerPlanned') ?? ''),
      requiredEquipmentPlanned: String(formData.get('requiredEquipmentPlanned') ?? ''),
      preparedBy: String(formData.get('preparedBy') ?? ''),
    });
    if (intent === 'hold' || intent === 'return') {
      errors.push(...validateErectionScheduleHoldOrReturnRemarks(String(formData.get('remarks') ?? '')));
    }
    if (errors.length > 0) {
      setClientError(errors.join(' '));
      setSavedMessage(null);
      return;
    }

    const status = intent === 'draft' ? 'DRAFT' : intent === 'issue' ? 'ISSUED' : intent === 'hold' ? 'HOLD' : 'RETURNED';
    formData.set('status', status);

    setClientError(null);
    setSavedMessage(null);
    setIsSaving(true);
    try {
      const result =
        schedule !== null
          ? await updateErectionScheduleAction(schedule.id, contractId, formData)
          : await createErectionScheduleAction(contractId, formData);
      if (result.error) {
        setClientError(result.error);
        return;
      }
      setSavedMessage(
        intent === 'draft' ? 'Draft saved.' : intent === 'issue' ? 'Schedule issued for coordination.' : intent === 'hold' ? 'Schedule placed on Hold.' : 'Schedule returned.',
      );
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Erection Schedule saved but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to save Erection Schedule:', err);
      setClientError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  // CM-71H.9 — Manager Preview Mode: see erection-method-statement-approval-panel.tsx's own comment on this pattern.
  const prerequisiteMissing = !statement;
  if (prerequisiteMissing && !isPreviewMode) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Issue Erection Schedule</h1>
          <p className="text-xs text-text-secondary mt-0.5">Erection Workflow · Step 3 of 7</p>
        </div>
        <InfoBox>
          Method Statement approval is pending. Schedule can be issued after approval.
        </InfoBox>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/contracts/${contractId}/workflow/erection/method-statement`}
            className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Go to Step 1
          </Link>
          {isStaffTier && <ErectionStaffBackNav />}
        </div>
      </div>
    );
  }

  const { label: statusLabel, badgeClasses: statusBadgeClasses } = computeDisplayStatus(
    schedule?.status ?? null,
    validateErectionScheduleFormValues({
      scheduleReferenceNo: schedule?.scheduleReferenceNo ?? '',
      scheduleDate: schedule?.scheduleDate ?? '',
      plannedStartDate: schedule?.plannedStartDate ?? '',
      plannedEndDate: schedule?.plannedEndDate ?? '',
      jobOrderNo: schedule?.jobOrderNo ?? '',
      erectionCrewTeam: schedule?.erectionCrewTeam ?? '',
      estimatedManpowerPlanned: schedule ? String(schedule.estimatedManpowerPlanned) : '',
      requiredEquipmentPlanned: schedule ? String(schedule.requiredEquipmentPlanned) : '',
      preparedBy: schedule?.preparedBy ?? '',
    }),
  );
  const currentStep = computeErectionStepTrackerCurrentStep(approval?.reviewStatus ?? null, schedule?.status ?? null);
  const plannedDuration = computePlannedDurationDays(plannedStartDate, plannedEndDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-text-primary">Issue Erection Schedule</h1>
            <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
              Erection Department
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClasses}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">Erection Workflow · Step 3 of 7</p>
        </div>
        <div className="flex items-center gap-2">
          {schedule?.status === 'ISSUED' && (
            <Link
              href={`/contracts/${contractId}/workflow/erection/delivery-start`}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Continue to Step 4 →
            </Link>
          )}
          <Link
            href={`/contracts/${contractId}/workflow/erection/method-statement/approval`}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            View Step 2
          </Link>
          {isStaffTier && <ErectionStaffBackNav />}
          <Link
            href={`/contracts/${contractId}/workflow`}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Back to Workflow
          </Link>
        </div>
      </div>

      <ErectionWorkflowStepTracker currentStep={currentStep} />

      {isPreviewMode && <ErectionPreviewBanner />}

      {approval?.reviewStatus !== 'APPROVED' && (
        <InfoBox variant="subtle">
          Method Statement approval is pending. Schedule can be issued after approval — you can still prepare it early.
        </InfoBox>
      )}

      {/* CM-71H.8 — staff-tier never renders this row: no Guidance, and
          Contract Summary moves into the sidebar (aligned with the form
          top) instead of floating alone above it. Manager-tier unchanged. */}
      {!isStaffTier && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ErectionStepGuidance>
            <ul className="list-disc list-inside space-y-1 text-xs text-text-secondary">
              <li>Prepare the erection schedule based on the approved method statement.</li>
              <li>Coordinate with site, delivery/logistics, contract management, and client/main contractor if required.</li>
              <li>Issue the schedule once manpower, equipment, and timeline are confirmed.</li>
            </ul>
          </ErectionStepGuidance>

          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Contract Summary</h2>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-text-muted">Contract ID</dt>
                <dd className="font-medium text-text-primary font-mono mt-0.5">{contract.referenceNumber}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Contract Name</dt>
                <dd className="font-medium text-text-primary mt-0.5">{contract.title}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Client / Project</dt>
                <dd className="font-medium text-text-primary mt-0.5">{contract.counterpartyName}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Main Contractor</dt>
                <dd className="font-medium text-text-primary mt-0.5">—</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <form
            id="erection-schedule-form"
            onSubmit={(e) => { void handleSubmit(e, submitIntentRef.current); }}
            className="rounded-lg border border-border bg-surface p-4 space-y-4"
          >
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Erection Schedule Information</h2>

            {clientError && (
              <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">
                {clientError}
              </div>
            )}
            {savedMessage && !clientError && (
              <div className="rounded-md border border-success/40 bg-success-light px-4 py-3 text-sm text-success">
                {savedMessage}
              </div>
            )}

            <div className={gridCls3}>
              <div>
                <label htmlFor="scheduleReferenceNo" className={labelCls}>
                  Schedule Reference No. <span className="text-error">*</span>
                </label>
                <input
                  id="scheduleReferenceNo"
                  name="scheduleReferenceNo"
                  type="text"
                  maxLength={50}
                  defaultValue={schedule?.scheduleReferenceNo ?? ''}
                  placeholder="e.g. ESCH-GRM-001"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="scheduleDate" className={labelCls}>
                  Schedule Date <span className="text-error">*</span>
                </label>
                <input
                  id="scheduleDate"
                  name="scheduleDate"
                  type="date"
                  defaultValue={schedule?.scheduleDate ?? ''}
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <span className={labelCls}>Job Order No.</span>
                <p className="text-sm text-text-primary py-2">{schedule?.jobOrderNo ?? contract.jobOrderNo ?? statement?.jobOrderNo ?? 'Not linked yet'}</p>
                <input id="jobOrderNo" name="jobOrderNo" type="hidden" value={schedule?.jobOrderNo ?? contract.jobOrderNo ?? statement?.jobOrderNo ?? ''} />
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="plannedStartDate" className={labelCls}>
                  Planned Start Date <span className="text-error">*</span>
                </label>
                <input
                  id="plannedStartDate"
                  name="plannedStartDate"
                  type="date"
                  value={plannedStartDate}
                  onChange={(e) => setPlannedStartDate(e.target.value)}
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="plannedEndDate" className={labelCls}>
                  Planned End Date <span className="text-error">*</span>
                </label>
                <input
                  id="plannedEndDate"
                  name="plannedEndDate"
                  type="date"
                  value={plannedEndDate}
                  onChange={(e) => setPlannedEndDate(e.target.value)}
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="erectionCrewTeam" className={labelCls}>
                  Erection Crew/Team <span className="text-error">*</span>
                </label>
                <input
                  id="erectionCrewTeam"
                  name="erectionCrewTeam"
                  type="text"
                  maxLength={150}
                  defaultValue={schedule?.erectionCrewTeam ?? ''}
                  placeholder="e.g. Crew A"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="estimatedManpowerPlanned" className={labelCls}>
                  Estimated Manpower Planned <span className="text-error">*</span>
                </label>
                <input
                  id="estimatedManpowerPlanned"
                  name="estimatedManpowerPlanned"
                  type="number"
                  min={0}
                  step={1}
                  value={estimatedManpowerPlanned}
                  onChange={(e) => setEstimatedManpowerPlanned(e.target.value)}
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="requiredEquipmentPlanned" className={labelCls}>
                  Required Equipment Planned <span className="text-error">*</span>
                </label>
                <input
                  id="requiredEquipmentPlanned"
                  name="requiredEquipmentPlanned"
                  type="number"
                  min={0}
                  step={1}
                  value={requiredEquipmentPlanned}
                  onChange={(e) => setRequiredEquipmentPlanned(e.target.value)}
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="preparedBy" className={labelCls}>
                  Prepared By <span className="text-error">*</span>
                </label>
                <input
                  id="preparedBy"
                  name="preparedBy"
                  type="text"
                  maxLength={150}
                  defaultValue={schedule?.preparedBy ?? ''}
                  placeholder="e.g. Site Engineer"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="reviewedByErectionManager" className={labelCls}>Reviewed By (Erection Manager)</label>
                <input
                  id="reviewedByErectionManager"
                  name="reviewedByErectionManager"
                  type="text"
                  maxLength={150}
                  defaultValue={schedule?.reviewedByErectionManager ?? ''}
                  placeholder="e.g. Erection Manager"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="reviewedOn" className={labelCls}>Reviewed On</label>
                <input
                  id="reviewedOn"
                  name="reviewedOn"
                  type="date"
                  defaultValue={schedule?.reviewedOn ?? ''}
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="documentRevision" className={labelCls}>Document Revision</label>
                <input
                  id="documentRevision"
                  name="documentRevision"
                  type="text"
                  maxLength={50}
                  defaultValue={schedule?.documentRevision ?? ''}
                  placeholder="e.g. Rev. 0"
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted pt-1">Schedule Summary</p>

            <div className={gridCls3}>
              <div>
                <span className={labelCls}>Planned Duration</span>
                <p className="text-sm text-text-primary py-2">{plannedDuration !== null ? `${plannedDuration} day${plannedDuration === 1 ? '' : 's'}` : '—'}</p>
              </div>
              <div>
                <span className={labelCls}>Estimated Manpower</span>
                <p className="text-sm text-text-primary py-2">{estimatedManpowerPlanned || '—'}</p>
              </div>
              <div>
                <span className={labelCls}>Required Equipment</span>
                <p className="text-sm text-text-primary py-2">{requiredEquipmentPlanned || '—'}</p>
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="totalActivities" className={labelCls}>Total Activities</label>
                <input
                  id="totalActivities"
                  name="totalActivities"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={schedule?.totalActivities ?? 0}
                  disabled={!canUpdate}
                  className={inputCls}
                />
                <p className="text-[11px] text-text-muted mt-1">No activity list is built in this step yet — enter a count manually, or leave at 0.</p>
              </div>
              <div>
                <label htmlFor="criticalActivities" className={labelCls}>Critical Activities</label>
                <input
                  id="criticalActivities"
                  name="criticalActivities"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={schedule?.criticalActivities ?? 0}
                  disabled={!canUpdate}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label htmlFor="remarks" className={labelCls}>Remarks</label>
              <textarea
                id="remarks"
                name="remarks"
                rows={3}
                maxLength={10000}
                defaultValue={schedule?.remarks ?? ''}
                placeholder="Required when placing on Hold or Returning."
                disabled={!canUpdate}
                className={`${inputCls} resize-y`}
              />
              <p className="text-[11px] text-text-muted mt-1">Required to place this schedule on Hold or Return it.</p>
            </div>

            {schedule ? (
              <AttachmentsSection contractId={contractId} schedule={schedule} />
            ) : (
              <InfoBox variant="subtle">
                Save this Erection Schedule first (Save Draft). Then upload supporting documents.
              </InfoBox>
            )}

            {/* CM-71H.9 — preview mode never enables saving when the real prerequisite is missing. */}
            {canUpdate && (
              prerequisiteMissing && isPreviewMode ? (
                <p className="text-xs text-text-muted italic pt-2 border-t border-border">
                  Complete previous workflow steps before saving this step.
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-border">
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'draft'; }}
                    disabled={isSaving}
                    className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'draft' ? 'Saving…' : 'Save Draft'}
                  </button>
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'return'; }}
                    disabled={isSaving}
                    className="rounded-md border border-warning bg-warning-light px-4 py-2 text-sm font-medium text-warning hover:bg-warning-light/70 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'return' ? 'Saving…' : 'Return'}
                  </button>
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'hold'; }}
                    disabled={isSaving}
                    className="rounded-md border border-error bg-error-light px-4 py-2 text-sm font-medium text-error hover:bg-error-light/70 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'hold' ? 'Saving…' : 'Hold'}
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Step 4 (Delivery Start) has not been built yet."
                    className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted opacity-60 cursor-not-allowed"
                  >
                    Save & Next Step
                  </button>
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'issue'; }}
                    disabled={isSaving}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'issue' ? 'Saving…' : 'Issue Schedule'}
                  </button>
                </div>
              )
            )}
          </form>
        </div>

        <ErectionScheduleSidebar
          schedule={schedule}
          recentActivity={recentActivity}
          contract={isStaffTier ? contract : undefined}
        />
      </div>
    </div>
  );
}

const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  erection_method_statement_approval_draft_saved: 'Step 2 review draft saved',
  erection_method_statement_approval_approved: 'Step 2 approved and forwarded',
  erection_method_statement_approval_revision_requested: 'Step 2 revision requested',
  erection_method_statement_approval_rejected: 'Step 2 rejected',
  erection_schedule_draft_saved: 'Schedule draft saved',
  erection_schedule_issued: 'Schedule issued for coordination',
  erection_schedule_hold: 'Schedule placed on Hold',
  erection_schedule_returned: 'Schedule returned',
  erection_schedule_attachment_uploaded: 'Attachment uploaded',
  erection_schedule_attachment_deleted: 'Attachment removed',
};

/** CM-71H.8 — `contract` is only ever passed by the staff-tier call site (see erection-method-statement-panel.tsx's own doc comment on this pattern). */
function ErectionScheduleSidebar({
  schedule,
  recentActivity,
  contract,
}: {
  schedule: ContractErectionSchedule | null;
  recentActivity: ContractActivity[];
  contract: { referenceNumber: string; title: string; counterpartyName: string } | undefined;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 min-w-0">
      {contract && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Contract Summary</h2>
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-text-muted">Contract ID</dt>
              <dd className="font-medium text-text-primary font-mono mt-0.5">{contract.referenceNumber}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Contract Name</dt>
              <dd className="font-medium text-text-primary mt-0.5">{contract.title}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Client / Project</dt>
              <dd className="font-medium text-text-primary mt-0.5">{contract.counterpartyName}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Main Contractor</dt>
              <dd className="font-medium text-text-primary mt-0.5">—</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Workflow Steps</h2>
        <ol className="space-y-1.5 text-xs">
          <li className="text-text-muted">1. Issue Erection Method Statement</li>
          <li className="text-text-muted">2. Erection Method Statement Approval</li>
          <li className="font-semibold text-text-primary">3. Issue Erection Schedule</li>
        </ol>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Task Details</h2>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="text-text-muted">Created By</dt>
            <dd className="text-text-primary mt-0.5">{schedule?.createdByUser.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated By</dt>
            <dd className="text-text-primary mt-0.5">{schedule?.updatedByUser?.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated</dt>
            <dd className="text-text-primary mt-0.5">{schedule ? formatDateTime(schedule.updatedAt) : '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Issued On</dt>
            <dd className="text-text-primary mt-0.5">{schedule ? formatDateTime(schedule.issuedAt) : '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-xs text-text-muted">No activity yet.</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {recentActivity.map((a) => (
              <li key={a.id} className="text-xs border-b border-border/60 pb-1.5 last:border-0">
                <p className="text-text-secondary">{ACTIVITY_EVENT_LABELS[a.event] ?? a.event}{a.actorName ? ` · ${a.actorName}` : ''}</p>
                <p className="text-text-muted text-[11px]">{formatDateTime(a.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
