'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Paperclip, Download, Trash2, UploadCloud, Loader2, Plus } from 'lucide-react';
import {
  createErectionStartAction,
  updateErectionStartAction,
  uploadErectionStartAttachmentAction,
  deleteErectionStartAttachmentAction,
} from '../../../../../../actions';
import type {
  ContractErectionDeliveryStart,
  ContractErectionStart,
  ContractErectionStartChecklistStatus,
  ContractActivity,
} from '@/lib/contracts-api';
import { inputCls, labelCls, gridCls3, InfoBox } from '../../../../../../_components/contract-form-fields';
import {
  ERECTION_START_CHECKLIST_STATUS_LABELS,
  ERECTION_START_DEFAULT_MANPOWER_TRADES,
  ERECTION_START_CHECKLIST_ITEMS,
  ERECTION_START_EQUIPMENT_TYPE_OPTIONS,
  ERECTION_START_CRANE_CAPACITY_OPTIONS,
  validateErectionStartFormValues,
  validateErectionStartHoldOrReturnComments,
  validateErectionStartConfirmRequirements,
  computeDisplayStatus,
  computeResourcesSummaryPreview,
  computeErectionStepTrackerCurrentStep,
  type ErectionStartManpowerFormRow,
} from '../../../../../../_lib/contract-erection-start-helpers';
import { ErectionWorkflowStepTracker } from '../../method-statement/_components/erection-workflow-step-tracker';
import { ErectionStaffBackNav } from '../../../_components/erection-staff-back-nav';
import { ErectionStepGuidance } from '../../../_components/erection-step-guidance';
import { ErectionPreviewBanner } from '../../../_components/erection-preview-banner';

interface ContractSummary {
  referenceNumber: string;
  title: string;
  counterpartyName: string;
}

interface Props {
  contractId: string;
  deliveryStart: ContractErectionDeliveryStart | null;
  erectionStart: ContractErectionStart | null;
  contract: ContractSummary;
  canUpdate: boolean;
  /** Real ContractActivity rows already filtered to Step 4 + Step 5 events (see page.tsx) — never fabricated. */
  recentActivity: ContractActivity[];
  /** CM-71H.6 — see erection-method-statement-panel.tsx's own doc comment. Defaults to false (manager-tier, unchanged). */
  isStaffTier?: boolean;
  /** CM-71H.9 — manager-tier-only, only ever true via `?preview=1` (see erection-preview.ts). Defaults to false (unchanged for every existing caller). */
  isPreviewMode?: boolean;
}

type SubmitIntent = 'draft' | 'confirm' | 'hold' | 'return';

interface EquipmentFormRow {
  equipmentType: string;
  descriptionCapacity: string;
  ownedOrRental: string;
  assignedQty: string;
  operatorDriver: string;
  remarks: string;
}

interface ChecklistFormRow {
  checklistItem: string;
  status: ContractErectionStartChecklistStatus;
  remarks: string;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** ISO datetime -> value a native <input type="datetime-local"> accepts (YYYY-MM-DDTHH:mm, no seconds/timezone). */
function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultManpowerRows(): ErectionStartManpowerFormRow[] {
  return ERECTION_START_DEFAULT_MANPOWER_TRADES.map((trade) => ({ trade, plannedNos: '0', actualDeployedNos: '0', remarks: '' }));
}

function defaultChecklistRows(): ChecklistFormRow[] {
  return ERECTION_START_CHECKLIST_ITEMS.map((checklistItem) => ({ checklistItem, status: 'PENDING' as const, remarks: '' }));
}

/** CM-71F — real, editable Manpower / Work Activity table. Local component state only — the whole array is submitted with the main form, and the backend fully replaces the row set on every save (see contract-erection-start.service.ts's own update()). */
function ManpowerTableSection({
  rows,
  setRows,
  canUpdate,
}: {
  rows: ErectionStartManpowerFormRow[];
  setRows: (rows: ErectionStartManpowerFormRow[]) => void;
  canUpdate: boolean;
}): React.JSX.Element {
  function updateRow(index: number, patch: Partial<ErectionStartManpowerFormRow>): void {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeRow(index: number): void {
    setRows(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className={labelCls}>Manpower / Work Activity</p>
        {canUpdate && (
          <button
            type="button"
            onClick={() => setRows([...rows, { trade: '', plannedNos: '0', actualDeployedNos: '0', remarks: '' }])}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add Row
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] divide-y divide-border text-xs">
          <thead>
            <tr className="text-left text-text-muted">
              <th className="py-1.5 pr-2 font-medium">Work Activity / Trade</th>
              <th className="py-1.5 pr-2 font-medium w-28">Planned Nos.</th>
              <th className="py-1.5 pr-2 font-medium w-28">Actual Deployed Nos.</th>
              <th className="py-1.5 pr-2 font-medium">Remarks</th>
              {canUpdate && <th className="py-1.5 w-8" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={row.trade}
                    onChange={(e) => updateRow(index, { trade: e.target.value })}
                    disabled={!canUpdate}
                    className={`${inputCls} py-1`}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={row.plannedNos}
                    onChange={(e) => updateRow(index, { plannedNos: e.target.value })}
                    disabled={!canUpdate}
                    className={`${inputCls} py-1`}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={0}
                    value={row.actualDeployedNos}
                    onChange={(e) => updateRow(index, { actualDeployedNos: e.target.value })}
                    disabled={!canUpdate}
                    className={`${inputCls} py-1`}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={row.remarks}
                    onChange={(e) => updateRow(index, { remarks: e.target.value })}
                    disabled={!canUpdate}
                    className={`${inputCls} py-1`}
                  />
                </td>
                {canUpdate && (
                  <td className="py-1.5">
                    <button type="button" onClick={() => removeRow(index)} className="text-text-muted hover:text-error" title="Remove row">
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** CM-71F — real, editable Equipment / Vehicle Assignment table. Equipment Type and Description/Capacity are free-text inputs backed by <datalist> suggestions — a site can type its own value, per this unit's own explicit instruction. */
function EquipmentTableSection({
  rows,
  setRows,
  canUpdate,
}: {
  rows: EquipmentFormRow[];
  setRows: (rows: EquipmentFormRow[]) => void;
  canUpdate: boolean;
}): React.JSX.Element {
  function updateRow(index: number, patch: Partial<EquipmentFormRow>): void {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeRow(index: number): void {
    setRows(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className={labelCls}>Equipment / Vehicle Assignment</p>
        {canUpdate && (
          <button
            type="button"
            onClick={() => setRows([...rows, { equipmentType: '', descriptionCapacity: '', ownedOrRental: '', assignedQty: '0', operatorDriver: '', remarks: '' }])}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add Row
          </button>
        )}
      </div>
      <datalist id="erection-start-equipment-type-options">
        {ERECTION_START_EQUIPMENT_TYPE_OPTIONS.map((o) => <option key={o} value={o} />)}
      </datalist>
      <datalist id="erection-start-crane-capacity-options">
        {ERECTION_START_CRANE_CAPACITY_OPTIONS.map((o) => <option key={o} value={o} />)}
      </datalist>

      {rows.length === 0 ? (
        <p className="text-xs text-text-muted">No equipment/vehicles assigned yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] divide-y divide-border text-xs">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="py-1.5 pr-2 font-medium w-36">Equipment Type</th>
                <th className="py-1.5 pr-2 font-medium">Description / Capacity</th>
                <th className="py-1.5 pr-2 font-medium w-28">Owned / Rental</th>
                <th className="py-1.5 pr-2 font-medium w-20">Qty</th>
                <th className="py-1.5 pr-2 font-medium w-36">Operator / Driver</th>
                <th className="py-1.5 pr-2 font-medium">Remarks</th>
                {canUpdate && <th className="py-1.5 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text" list="erection-start-equipment-type-options"
                      value={row.equipmentType}
                      onChange={(e) => updateRow(index, { equipmentType: e.target.value })}
                      disabled={!canUpdate}
                      placeholder="e.g. Crane"
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text" list="erection-start-crane-capacity-options"
                      value={row.descriptionCapacity}
                      onChange={(e) => updateRow(index, { descriptionCapacity: e.target.value })}
                      disabled={!canUpdate}
                      placeholder="e.g. 50 T Mobile Crane"
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={row.ownedOrRental}
                      onChange={(e) => updateRow(index, { ownedOrRental: e.target.value })}
                      disabled={!canUpdate}
                      placeholder="Owned / Rental"
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number" min={0}
                      value={row.assignedQty}
                      onChange={(e) => updateRow(index, { assignedQty: e.target.value })}
                      disabled={!canUpdate}
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={row.operatorDriver}
                      onChange={(e) => updateRow(index, { operatorDriver: e.target.value })}
                      disabled={!canUpdate}
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={row.remarks}
                      onChange={(e) => updateRow(index, { remarks: e.target.value })}
                      disabled={!canUpdate}
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  {canUpdate && (
                    <td className="py-1.5">
                      <button type="button" onClick={() => removeRow(index)} className="text-text-muted hover:text-error" title="Remove row">
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** CM-71F — real, editable Pre-Erection Checklist. Submitted together with the main form — no per-row immediate save (unlike Step 4's document-linking section, which genuinely needed one for attachment linking). Do not fake Completed values — every row starts Pending. */
function ChecklistSection({
  rows,
  setRows,
  canUpdate,
}: {
  rows: ChecklistFormRow[];
  setRows: (rows: ChecklistFormRow[]) => void;
  canUpdate: boolean;
}): React.JSX.Element {
  function updateRow(index: number, patch: Partial<ChecklistFormRow>): void {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <p className={labelCls}>Pre-Erection Checklist</p>
      <ul className="space-y-1.5">
        {rows.map((row, index) => (
          <li key={row.checklistItem} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-secondary/50 px-2.5 py-1.5 text-xs">
            <span className="font-medium text-text-primary">{row.checklistItem}</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={row.remarks}
                onChange={(e) => updateRow(index, { remarks: e.target.value })}
                disabled={!canUpdate}
                placeholder="Remarks (optional)"
                className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] w-40"
              />
              <select
                value={row.status}
                onChange={(e) => updateRow(index, { status: e.target.value as ContractErectionStartChecklistStatus })}
                disabled={!canUpdate}
                className="rounded-md border border-border bg-surface px-2 py-1 text-[11px]"
              >
                {(Object.keys(ERECTION_START_CHECKLIST_STATUS_LABELS) as ContractErectionStartChecklistStatus[]).map((s) => (
                  <option key={s} value={s}>{ERECTION_START_CHECKLIST_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** CM-71F — real attachment upload, list, and download/delete. Same CM-70J-robust local-state pattern as Steps 1/2/3/4's own AttachmentsSection. */
function AttachmentsSection({ contractId, erectionStart }: { contractId: string; erectionStart: ContractErectionStart }): React.JSX.Element {
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
      const result = await uploadErectionStartAttachmentAction(contractId, erectionStart.id, formData);
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
      const result = await deleteErectionStartAttachmentAction(contractId, erectionStart.id, attachmentId);
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

      {erectionStart.attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {erectionStart.attachments.map((a) => (
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
                  href={`/contracts/${contractId}/workflow/erection/start/${erectionStart.id}/attachments/${a.id}/download`}
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
        Suggested: Toolbox Talk Sheet, Pre-Erection Checklist, Crane Documents, Site Photos, Work Start Confirmation.
        Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx). Max 10MB.
      </p>
    </div>
  );
}

/**
 * CM-71F — Erection Workflow, Step 5: Erection Start. Owned by the Erection
 * Department / Site-Erection Team — the header badge below reads "Erection
 * Department", matching Step 3's own established badge text (the task
 * itself offers either "Site / Erection Team" or "Erection Department").
 * Same "create-once, edit-forever" shape as Steps 1/3/4 (mode derived from
 * whether `erectionStart` is null). Written using the CM-70J robust save
 * pattern. Required-field validation for Work Location/Yard, Erection Crew/
 * Team, Supervisor, and Scope of Work Today runs on every save — Save Draft
 * included; Actual Start Date/Time and the manpower-row requirement only
 * apply to Confirm Erection Start, per this unit's own field split. Hold/
 * Return additionally require Comments, mirrored server-side by
 * assertCommentsPresentForHoldOrReturn.
 */
export function ErectionStartPanel({
  contractId,
  deliveryStart,
  erectionStart,
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
  const [actualStartDateTime, setActualStartDateTime] = useState(toDateTimeLocalValue(erectionStart?.actualStartDateTime ?? null));
  const [manpowerRows, setManpowerRows] = useState<ErectionStartManpowerFormRow[]>(
    erectionStart
      ? erectionStart.manpowerRows.map((r) => ({ trade: r.trade, plannedNos: String(r.plannedNos), actualDeployedNos: String(r.actualDeployedNos), remarks: r.remarks ?? '' }))
      : defaultManpowerRows(),
  );
  const [equipmentRows, setEquipmentRows] = useState<EquipmentFormRow[]>(
    erectionStart
      ? erectionStart.equipmentRows.map((r) => ({
          equipmentType: r.equipmentType, descriptionCapacity: r.descriptionCapacity, ownedOrRental: r.ownedOrRental,
          assignedQty: String(r.assignedQty), operatorDriver: r.operatorDriver ?? '', remarks: r.remarks ?? '',
        }))
      : [],
  );
  const [checklistRows, setChecklistRows] = useState<ChecklistFormRow[]>(
    erectionStart && erectionStart.checklistRows.length > 0
      ? erectionStart.checklistRows.map((r) => ({ checklistItem: r.checklistItem, status: r.status, remarks: r.remarks ?? '' }))
      : defaultChecklistRows(),
  );
  const submitIntentRef = useRef<SubmitIntent>('draft');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, intent: SubmitIntent): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);

    const errors = validateErectionStartFormValues({
      workLocationYard: String(formData.get('workLocationYard') ?? ''),
      erectionCrewTeam: String(formData.get('erectionCrewTeam') ?? ''),
      supervisor: String(formData.get('supervisor') ?? ''),
      scopeOfWorkToday: String(formData.get('scopeOfWorkToday') ?? ''),
    });
    if (intent === 'confirm') {
      errors.push(...validateErectionStartConfirmRequirements(actualStartDateTime, manpowerRows));
    }
    if (intent === 'hold' || intent === 'return') {
      errors.push(...validateErectionStartHoldOrReturnComments(String(formData.get('comments') ?? '')));
    }
    if (errors.length > 0) {
      setClientError(errors.join(' '));
      setSavedMessage(null);
      return;
    }

    const status = intent === 'draft' ? 'DRAFT' : intent === 'confirm' ? 'STARTED' : intent === 'hold' ? 'HOLD' : 'RETURNED';

    const input = {
      ...(actualStartDateTime ? { actualStartDateTime: new Date(actualStartDateTime).toISOString() } : {}),
      workLocationYard: String(formData.get('workLocationYard') ?? ''),
      erectionCrewTeam: String(formData.get('erectionCrewTeam') ?? ''),
      supervisor: String(formData.get('supervisor') ?? ''),
      weatherCondition: String(formData.get('weatherCondition') ?? ''),
      windSpeed: String(formData.get('windSpeed') ?? ''),
      scopeOfWorkToday: String(formData.get('scopeOfWorkToday') ?? ''),
      status,
      comments: String(formData.get('comments') ?? ''),
      manpowerRows: manpowerRows
        .filter((r) => r.trade.trim())
        .map((r) => ({ trade: r.trade, plannedNos: Number(r.plannedNos) || 0, actualDeployedNos: Number(r.actualDeployedNos) || 0, ...(r.remarks.trim() ? { remarks: r.remarks } : {}) })),
      equipmentRows: equipmentRows
        .filter((r) => r.equipmentType.trim())
        .map((r) => ({
          equipmentType: r.equipmentType, descriptionCapacity: r.descriptionCapacity, ownedOrRental: r.ownedOrRental,
          assignedQty: Number(r.assignedQty) || 0, ...(r.operatorDriver.trim() ? { operatorDriver: r.operatorDriver } : {}),
          ...(r.remarks.trim() ? { remarks: r.remarks } : {}),
        })),
      checklistRows: checklistRows.map((r) => ({ checklistItem: r.checklistItem, status: r.status, ...(r.remarks.trim() ? { remarks: r.remarks } : {}) })),
    };

    setClientError(null);
    setSavedMessage(null);
    setIsSaving(true);
    try {
      const result =
        erectionStart !== null
          ? await updateErectionStartAction(erectionStart.id, contractId, input)
          : await createErectionStartAction(contractId, input);
      if (result.error) {
        setClientError(result.error);
        return;
      }
      setSavedMessage(
        intent === 'draft' ? 'Draft saved.' : intent === 'confirm' ? 'Erection start confirmed.' : intent === 'hold' ? 'Erection placed on Hold.' : 'Erection returned.',
      );
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Erection Start saved but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to save Erection Start:', err);
      setClientError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  // CM-71H.9 — Manager Preview Mode: see erection-method-statement-approval-panel.tsx's own comment on this pattern.
  const prerequisiteMissing = !deliveryStart || deliveryStart.status !== 'STARTED';
  if (prerequisiteMissing && !isPreviewMode) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Erection Start</h1>
          <p className="text-xs text-text-secondary mt-0.5">Erection Workflow · Step 5 of 7</p>
        </div>
        <InfoBox>
          Delivery Start has not been confirmed yet.
        </InfoBox>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/contracts/${contractId}/workflow/erection/delivery-start`}
            className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Go to Step 4
          </Link>
          {isStaffTier && <ErectionStaffBackNav />}
        </div>
      </div>
    );
  }

  const { label: statusLabel, badgeClasses: statusBadgeClasses } = computeDisplayStatus(
    erectionStart?.status ?? null,
    validateErectionStartFormValues({
      workLocationYard: erectionStart?.workLocationYard ?? '',
      erectionCrewTeam: erectionStart?.erectionCrewTeam ?? '',
      supervisor: erectionStart?.supervisor ?? '',
      scopeOfWorkToday: erectionStart?.scopeOfWorkToday ?? '',
    }),
  );
  const currentStep = computeErectionStepTrackerCurrentStep(deliveryStart?.status ?? null, erectionStart?.status ?? null);
  const resourcesSummaryPreview = computeResourcesSummaryPreview({ manpowerRows, equipmentRows });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-text-primary">Erection Start</h1>
            <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
              Erection Department
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClasses}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">Erection Workflow · Step 5 of 7</p>
        </div>
        <div className="flex items-center gap-2">
          {erectionStart?.status === 'STARTED' && (
            <Link
              href={`/contracts/${contractId}/workflow/erection/checklist`}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Continue to Step 6 →
            </Link>
          )}
          <Link
            href={`/contracts/${contractId}/workflow/erection/delivery-start`}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            View Step 4
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

      {/* CM-71H.8 — staff-tier never renders this row: no Guidance, and
          Contract Summary moves into the sidebar (aligned with the form
          top) instead of floating alone above it. Manager-tier unchanged. */}
      {!isStaffTier && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ErectionStepGuidance>
            <ul className="list-disc list-inside space-y-1 text-xs text-text-secondary">
              <li>Verify that all pre-erection requirements and resources are in place.</li>
              <li>Confirm delivery, site access, manpower, crane/trailer, tools, and equipment readiness.</li>
              <li>Conduct site readiness check before confirming erection start.</li>
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
            id="erection-start-form"
            onSubmit={(e) => { void handleSubmit(e, submitIntentRef.current); }}
            className="rounded-lg border border-border bg-surface p-4 space-y-4"
          >
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Erection Start Information</h2>

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
                <span className={labelCls}>Job Order No.</span>
                <p className="text-sm text-text-primary py-2">{erectionStart?.jobOrderNo ?? 'Auto-fetched on save'}</p>
              </div>
              <div>
                <span className={labelCls}>Planned Start Date</span>
                <p className="text-sm text-text-primary py-2">{formatDate(erectionStart?.plannedStartDate ?? null)}</p>
              </div>
              <div>
                <label htmlFor="actualStartDateTime" className={labelCls}>
                  Actual Start Date / Time <span className="text-error">*</span>
                </label>
                <input
                  id="actualStartDateTime"
                  name="actualStartDateTime"
                  type="datetime-local"
                  value={actualStartDateTime}
                  onChange={(e) => setActualStartDateTime(e.target.value)}
                  disabled={!canUpdate}
                  className={inputCls}
                />
                <p className="text-[11px] text-text-muted mt-1">Required to confirm Erection Start.</p>
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="workLocationYard" className={labelCls}>
                  Work Location / Yard <span className="text-error">*</span>
                </label>
                <input
                  id="workLocationYard" name="workLocationYard" type="text" maxLength={200}
                  defaultValue={erectionStart?.workLocationYard ?? ''} placeholder="e.g. GRM Site - Boundary Wall Zone A"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="erectionCrewTeam" className={labelCls}>
                  Erection Crew / Team <span className="text-error">*</span>
                </label>
                <input
                  id="erectionCrewTeam" name="erectionCrewTeam" type="text" maxLength={150}
                  defaultValue={erectionStart?.erectionCrewTeam ?? ''} placeholder="e.g. Erection Crew A"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="supervisor" className={labelCls}>
                  Supervisor <span className="text-error">*</span>
                </label>
                <input
                  id="supervisor" name="supervisor" type="text" maxLength={150}
                  defaultValue={erectionStart?.supervisor ?? ''} placeholder="e.g. Site Supervisor"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="weatherCondition" className={labelCls}>Weather Condition</label>
                <input
                  id="weatherCondition" name="weatherCondition" type="text" maxLength={100}
                  defaultValue={erectionStart?.weatherCondition ?? ''} placeholder="e.g. Clear / 32°C"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="windSpeed" className={labelCls}>Wind Speed</label>
                <input
                  id="windSpeed" name="windSpeed" type="text" maxLength={50}
                  defaultValue={erectionStart?.windSpeed ?? ''} placeholder="e.g. 12 km/h"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <span className={labelCls}>Method Statement Ref.</span>
                <p className="text-sm text-text-primary py-2">{erectionStart?.methodStatementRefNo ?? 'Not linked yet'}</p>
              </div>
            </div>

            <div>
              <label htmlFor="scopeOfWorkToday" className={labelCls}>
                Scope of Work Today <span className="text-error">*</span>
              </label>
              <textarea
                id="scopeOfWorkToday" name="scopeOfWorkToday" rows={4} maxLength={10000}
                defaultValue={erectionStart?.scopeOfWorkToday ?? ''}
                disabled={!canUpdate} className={`${inputCls} resize-y`}
              />
            </div>

            <ManpowerTableSection rows={manpowerRows} setRows={setManpowerRows} canUpdate={canUpdate} />
            <EquipmentTableSection rows={equipmentRows} setRows={setEquipmentRows} canUpdate={canUpdate} />

            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted pt-1">Resources Summary</p>
            <div className={gridCls3}>
              <div>
                <span className={labelCls}>Total Manpower</span>
                <p className="text-sm text-text-primary py-2">{resourcesSummaryPreview.totalManpower}</p>
              </div>
              <div>
                <span className={labelCls}>Equipment</span>
                <p className="text-sm text-text-primary py-2">{resourcesSummaryPreview.totalEquipment}</p>
              </div>
              <div>
                <span className={labelCls}>Crane Assigned</span>
                <p className="text-sm text-text-primary py-2">{resourcesSummaryPreview.craneAssigned}</p>
              </div>
              <div>
                <span className={labelCls}>Trailer Assigned</span>
                <p className="text-sm text-text-primary py-2">{resourcesSummaryPreview.trailerAssigned}</p>
              </div>
            </div>

            <ChecklistSection rows={checklistRows} setRows={setChecklistRows} canUpdate={canUpdate} />

            <div>
              <label htmlFor="comments" className={labelCls}>Comments / Notes</label>
              <textarea
                id="comments" name="comments" rows={3} maxLength={10000}
                defaultValue={erectionStart?.comments ?? ''} placeholder="Required when placing on Hold or Returning."
                disabled={!canUpdate} className={`${inputCls} resize-y`}
              />
              <p className="text-[11px] text-text-muted mt-1">Required to place this erection start on Hold or Return it.</p>
            </div>

            {erectionStart ? (
              <AttachmentsSection contractId={contractId} erectionStart={erectionStart} />
            ) : (
              <InfoBox variant="subtle">
                Save this Erection Start first (Save Draft). Then upload supporting documents.
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
                    title="Erection Checklist will be available after Step 6 is implemented"
                    className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted opacity-60 cursor-not-allowed"
                  >
                    Save & Next Step
                  </button>
                  <button
                    type="submit"
                    onClick={() => { submitIntentRef.current = 'confirm'; }}
                    disabled={isSaving}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
                  >
                    {isSaving && submitIntentRef.current === 'confirm' ? 'Saving…' : 'Confirm Erection Start'}
                  </button>
                </div>
              )
            )}
          </form>
        </div>

        <ErectionStartSidebar
          erectionStart={erectionStart}
          recentActivity={recentActivity}
          contract={isStaffTier ? contract : undefined}
        />
      </div>
    </div>
  );
}

const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  erection_delivery_start_confirmed: 'Step 4 delivery start confirmed',
  erection_delivery_start_hold: 'Step 4 delivery placed on Hold',
  erection_delivery_start_returned: 'Step 4 delivery returned',
  erection_start_draft_saved: 'Erection start draft saved',
  erection_start_confirmed: 'Erection start confirmed',
  erection_start_hold: 'Erection start placed on Hold',
  erection_start_returned: 'Erection start returned',
  erection_start_attachment_uploaded: 'Attachment uploaded',
  erection_start_attachment_deleted: 'Attachment removed',
};

/** CM-71H.8 — `contract` is only ever passed by the staff-tier call site (see erection-method-statement-panel.tsx's own doc comment on this pattern). */
function ErectionStartSidebar({
  erectionStart,
  recentActivity,
  contract,
}: {
  erectionStart: ContractErectionStart | null;
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
          <li className="text-text-muted">3. Issue Erection Schedule</li>
          <li className="text-text-muted">4. Delivery Start</li>
          <li className="font-semibold text-text-primary">5. Erection Start</li>
        </ol>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Task Details</h2>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="text-text-muted">Created By</dt>
            <dd className="text-text-primary mt-0.5">{erectionStart?.createdByUser.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated By</dt>
            <dd className="text-text-primary mt-0.5">{erectionStart?.updatedByUser?.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated</dt>
            <dd className="text-text-primary mt-0.5">{erectionStart ? formatDateTime(erectionStart.updatedAt) : '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Confirmed On</dt>
            <dd className="text-text-primary mt-0.5">{erectionStart ? formatDateTime(erectionStart.confirmedAt) : '—'}</dd>
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
