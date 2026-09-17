'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Paperclip, Download, Trash2, UploadCloud, Loader2, Plus, Link2, XCircle } from 'lucide-react';
import {
  createErectionDeliveryStartAction,
  updateErectionDeliveryStartAction,
  uploadErectionDeliveryStartAttachmentAction,
  deleteErectionDeliveryStartAttachmentAction,
} from '../../../../../../actions';
import type {
  ContractErectionSchedule,
  ContractErectionDeliveryStart,
  ContractErectionDeliveryItemStatus,
  ContractActivity,
} from '@/lib/contracts-api';
import { inputCls, labelCls, gridCls3, InfoBox } from '../../../../../../_components/contract-form-fields';
import {
  ERECTION_DELIVERY_ITEM_STATUS_LABELS,
  ERECTION_DELIVERY_DOCUMENT_STATUS_LABELS,
  ERECTION_DELIVERY_DOCUMENT_STATUS_BADGE_CLASSES,
  ERECTION_DELIVERY_DOCUMENT_NAMES,
  validateErectionDeliveryStartFormValues,
  validateErectionDeliveryStartHoldOrReturnComments,
  validateErectionDeliveryItemRows,
  computeDisplayStatus,
  computeDeliveryTotalsPreview,
  computeErectionStepTrackerCurrentStep,
  type ErectionDeliveryItemFormRow,
} from '../../../../../../_lib/contract-erection-delivery-start-helpers';
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
  schedule: ContractErectionSchedule | null;
  deliveryStart: ContractErectionDeliveryStart | null;
  contract: ContractSummary;
  canUpdate: boolean;
  /** Real ContractActivity rows already filtered to Step 3 + Step 4 events (see page.tsx) — never fabricated. */
  recentActivity: ContractActivity[];
  /** CM-71H.6 — see erection-method-statement-panel.tsx's own doc comment. Defaults to false (manager-tier, unchanged). */
  isStaffTier?: boolean;
  /** CM-71H.9 — manager-tier-only, only ever true via `?preview=1` (see erection-preview.ts). Defaults to false (unchanged for every existing caller). */
  isPreviewMode?: boolean;
}

type SubmitIntent = 'draft' | 'confirm' | 'hold' | 'return';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function emptyItemRow(): ErectionDeliveryItemFormRow {
  return { description: '', packageNo: '', weight: '', volume: '', quantity: '', status: 'READY_TO_DISPATCH' };
}

/**
 * CM-71E — real, editable Items Overview table. Local component state only
 * (no per-row save) — the whole array is submitted together with the main
 * form, and the backend fully replaces the item set on every save (see
 * contract-erection-delivery-start.service.ts's own update()). Delivery
 * Items Summary above it is a live client-side preview
 * (computeDeliveryTotalsPreview) — the real, authoritative totals are
 * always recomputed server-side.
 */
function ItemsOverviewSection({
  rows,
  setRows,
  canUpdate,
}: {
  rows: ErectionDeliveryItemFormRow[];
  setRows: (rows: ErectionDeliveryItemFormRow[]) => void;
  canUpdate: boolean;
}): React.JSX.Element {
  function updateRow(index: number, patch: Partial<ErectionDeliveryItemFormRow>): void {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number): void {
    setRows(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className={labelCls}>Items Overview</p>
        {canUpdate && (
          <button
            type="button"
            onClick={() => setRows([...rows, emptyItemRow()])}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add Item
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-text-muted">No delivery items added yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] divide-y divide-border text-xs">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="py-1.5 pr-2 font-medium w-10">Sr.</th>
                <th className="py-1.5 pr-2 font-medium">Description</th>
                <th className="py-1.5 pr-2 font-medium w-28">Package No.</th>
                <th className="py-1.5 pr-2 font-medium w-24">Weight</th>
                <th className="py-1.5 pr-2 font-medium w-24">Volume</th>
                <th className="py-1.5 pr-2 font-medium w-20">Qty</th>
                <th className="py-1.5 pr-2 font-medium w-36">Status</th>
                {canUpdate && <th className="py-1.5 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="py-1.5 pr-2 text-text-muted">{index + 1}</td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => updateRow(index, { description: e.target.value })}
                      disabled={!canUpdate}
                      placeholder="e.g. Precast Boundary Wall Panel Type A"
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={row.packageNo}
                      onChange={(e) => updateRow(index, { packageNo: e.target.value })}
                      disabled={!canUpdate}
                      placeholder="PKG-001"
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={row.weight}
                      onChange={(e) => updateRow(index, { weight: e.target.value })}
                      disabled={!canUpdate}
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={row.volume}
                      onChange={(e) => updateRow(index, { volume: e.target.value })}
                      disabled={!canUpdate}
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      value={row.quantity}
                      onChange={(e) => updateRow(index, { quantity: e.target.value })}
                      disabled={!canUpdate}
                      className={`${inputCls} py-1`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      value={row.status}
                      onChange={(e) => updateRow(index, { status: e.target.value as ContractErectionDeliveryItemStatus })}
                      disabled={!canUpdate}
                      className={`${inputCls} py-1`}
                    >
                      {(Object.keys(ERECTION_DELIVERY_ITEM_STATUS_LABELS) as ContractErectionDeliveryItemStatus[]).map((s) => (
                        <option key={s} value={s}>{ERECTION_DELIVERY_ITEM_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  {canUpdate && (
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="text-text-muted hover:text-error"
                        title="Remove item"
                      >
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

/**
 * CM-71E — real per-document checklist. Each row saves immediately (its own
 * small, independent update call) rather than piggy-backing on the main
 * form's submit — linking/unlinking an attachment or marking Not Required
 * is a lightweight, self-contained action. ATTACHED is never settable here
 * directly: it only appears once the server confirms a real attachmentId
 * link (see computeDeliveryDocumentStatus on the backend) — the "Not
 * Required" button is the only status this section ever requests directly.
 */
function RequiredDocumentsSection({
  contractId,
  deliveryStart,
  canUpdate,
}: {
  contractId: string;
  deliveryStart: ContractErectionDeliveryStart;
  canUpdate: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const [savingDoc, setSavingDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [selectedAttachmentByDoc, setSelectedAttachmentByDoc] = useState<Record<string, string>>({});

  async function saveDocument(documentName: string, attachmentId: string | undefined, status: string | undefined): Promise<void> {
    setDocError(null);
    setSavingDoc(documentName);
    try {
      const result = await updateErectionDeliveryStartAction(deliveryStart.id, contractId, {
        documents: [{ documentName, ...(attachmentId !== undefined ? { attachmentId } : {}), ...(status !== undefined ? { status } : {}) }],
      });
      if (result.error) {
        setDocError(result.error);
        return;
      }
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Document status saved but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to save document status:', err);
      setDocError('Failed to save. Please try again.');
    } finally {
      setSavingDoc(null);
    }
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <p className={labelCls}>Required Documents</p>
      {docError && <p className="text-xs text-error">{docError}</p>}
      <ul className="space-y-1.5">
        {ERECTION_DELIVERY_DOCUMENT_NAMES.map((documentName) => {
          const doc = deliveryStart.documents.find((d) => d.documentName === documentName);
          const status = doc?.status ?? 'PENDING';
          const linkedAttachment = doc?.attachmentId ? deliveryStart.attachments.find((a) => a.id === doc.attachmentId) : null;
          const isSaving = savingDoc === documentName;

          return (
            <li key={documentName} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-secondary/50 px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-text-primary">{documentName}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ERECTION_DELIVERY_DOCUMENT_STATUS_BADGE_CLASSES[status]}`}>
                  {ERECTION_DELIVERY_DOCUMENT_STATUS_LABELS[status]}
                </span>
                {linkedAttachment && <span className="truncate text-text-muted">({linkedAttachment.originalFileName})</span>}
              </div>
              {canUpdate && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {status === 'ATTACHED' ? (
                    <button
                      type="button"
                      onClick={() => void saveDocument(documentName, undefined, 'PENDING')}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1 text-text-muted hover:text-error disabled:opacity-50"
                    >
                      <XCircle className="size-3.5" aria-hidden="true" />
                      Unlink
                    </button>
                  ) : (
                    <>
                      <select
                        value={selectedAttachmentByDoc[documentName] ?? ''}
                        onChange={(e) => setSelectedAttachmentByDoc((s) => ({ ...s, [documentName]: e.target.value }))}
                        className="rounded-md border border-border bg-surface px-1.5 py-1 text-[11px]"
                      >
                        <option value="">— Link attachment —</option>
                        {deliveryStart.attachments.map((a) => (
                          <option key={a.id} value={a.id}>{a.originalFileName}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const attachmentId = selectedAttachmentByDoc[documentName];
                          if (attachmentId) void saveDocument(documentName, attachmentId, undefined);
                        }}
                        disabled={isSaving || !selectedAttachmentByDoc[documentName]}
                        className="inline-flex items-center gap-1 text-accent hover:underline disabled:opacity-50 disabled:no-underline"
                      >
                        <Link2 className="size-3.5" aria-hidden="true" />
                        Link
                      </button>
                      {status !== 'NOT_REQUIRED' && (
                        <button
                          type="button"
                          onClick={() => void saveDocument(documentName, undefined, 'NOT_REQUIRED')}
                          disabled={isSaving}
                          className="text-text-muted hover:text-text-primary disabled:opacity-50"
                        >
                          Not Required
                        </button>
                      )}
                    </>
                  )}
                  {isSaving && <Loader2 className="size-3.5 animate-spin text-text-muted" aria-hidden="true" />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-text-muted">A document reads Attached only once a real uploaded attachment is linked to it — never set directly.</p>
    </div>
  );
}

/** CM-71E — real attachment upload, list, and download/delete. Same CM-70J-robust local-state pattern as Steps 1/2/3's own AttachmentsSection. */
function AttachmentsSection({ contractId, deliveryStart }: { contractId: string; deliveryStart: ContractErectionDeliveryStart }): React.JSX.Element {
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
      const result = await uploadErectionDeliveryStartAttachmentAction(contractId, deliveryStart.id, formData);
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
      const result = await deleteErectionDeliveryStartAttachmentAction(contractId, deliveryStart.id, attachmentId);
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

      {deliveryStart.attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {deliveryStart.attachments.map((a) => (
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
                  href={`/contracts/${contractId}/workflow/erection/delivery-start/${deliveryStart.id}/attachments/${a.id}/download`}
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
        Suggested: Packing List, Material Test Certificates, Delivery Note, Bill of Lading / LR.
        Allowed: PDF, PNG, JPEG, Excel (.xlsx), Word (.docx). Max 10MB.
      </p>
    </div>
  );
}

/**
 * CM-71E — Erection Workflow, Step 4: Delivery Start. Owned by the
 * Delivery / Logistics Team — the header badge below always reads
 * "Delivery / Logistics Team", never "Erection Department", per this
 * unit's own explicit ownership instruction. Same "create-once,
 * edit-forever" shape as Steps 1/3 (mode derived from whether
 * `deliveryStart` is null). Written using the CM-70J robust save pattern.
 * Required-field validation runs on every save — Save Draft included —
 * since every required field here is a real, non-nullable database column
 * (same reasoning as Steps 1/3). Hold/Return additionally require
 * Comments, mirrored server-side by assertCommentsPresentForHoldOrReturn.
 */
export function ErectionDeliveryStartPanel({
  contractId,
  schedule,
  deliveryStart,
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
  const [itemRows, setItemRows] = useState<ErectionDeliveryItemFormRow[]>(
    deliveryStart
      ? deliveryStart.items.map((i) => ({
          description: i.description,
          packageNo: i.packageNo ?? '',
          weight: i.weight !== null ? String(i.weight) : '',
          volume: i.volume !== null ? String(i.volume) : '',
          quantity: String(i.quantity),
          status: i.status,
        }))
      : [],
  );
  const submitIntentRef = useRef<SubmitIntent>('draft');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, intent: SubmitIntent): Promise<void> {
    e.preventDefault();
    if (isSaving) return;

    const formData = new FormData(e.currentTarget);

    const errors = validateErectionDeliveryStartFormValues({
      deliveryReferenceNo: String(formData.get('deliveryReferenceNo') ?? ''),
      deliveryDate: String(formData.get('deliveryDate') ?? ''),
      plannedDeliveryWindowStart: String(formData.get('plannedDeliveryWindowStart') ?? ''),
      plannedDeliveryWindowEnd: String(formData.get('plannedDeliveryWindowEnd') ?? ''),
      transportMode: String(formData.get('transportMode') ?? ''),
      dispatchProductionSource: String(formData.get('dispatchProductionSource') ?? ''),
      dispatchFromYard: String(formData.get('dispatchFromYard') ?? ''),
      deliveryToSiteLocation: String(formData.get('deliveryToSiteLocation') ?? ''),
    });
    errors.push(...validateErectionDeliveryItemRows(itemRows));
    if (intent === 'hold' || intent === 'return') {
      errors.push(...validateErectionDeliveryStartHoldOrReturnComments(String(formData.get('comments') ?? '')));
    }
    if (errors.length > 0) {
      setClientError(errors.join(' '));
      setSavedMessage(null);
      return;
    }

    const status = intent === 'draft' ? 'DRAFT' : intent === 'confirm' ? 'STARTED' : intent === 'hold' ? 'HOLD' : 'RETURNED';

    const input = {
      deliveryReferenceNo: String(formData.get('deliveryReferenceNo') ?? ''),
      deliveryDate: String(formData.get('deliveryDate') ?? ''),
      plannedDeliveryWindowStart: String(formData.get('plannedDeliveryWindowStart') ?? ''),
      plannedDeliveryWindowEnd: String(formData.get('plannedDeliveryWindowEnd') ?? ''),
      transportMode: String(formData.get('transportMode') ?? ''),
      dispatchProductionSource: String(formData.get('dispatchProductionSource') ?? ''),
      dispatchFromYard: String(formData.get('dispatchFromYard') ?? ''),
      deliveryToSiteLocation: String(formData.get('deliveryToSiteLocation') ?? ''),
      gateEntryContact: String(formData.get('gateEntryContact') ?? ''),
      deliveryNoteOrLrNo: String(formData.get('deliveryNoteOrLrNo') ?? ''),
      vehicleNo: String(formData.get('vehicleNo') ?? ''),
      driverName: String(formData.get('driverName') ?? ''),
      driverContact: String(formData.get('driverContact') ?? ''),
      status,
      comments: String(formData.get('comments') ?? ''),
      items: itemRows.map((row) => ({
        description: row.description,
        ...(row.packageNo.trim() ? { packageNo: row.packageNo } : {}),
        ...(row.weight.trim() ? { weight: Number(row.weight) } : {}),
        ...(row.volume.trim() ? { volume: Number(row.volume) } : {}),
        quantity: Number(row.quantity),
        status: row.status,
      })),
    };

    setClientError(null);
    setSavedMessage(null);
    setIsSaving(true);
    try {
      const result =
        deliveryStart !== null
          ? await updateErectionDeliveryStartAction(deliveryStart.id, contractId, input)
          : await createErectionDeliveryStartAction(contractId, input);
      if (result.error) {
        setClientError(result.error);
        return;
      }
      setSavedMessage(
        intent === 'draft' ? 'Draft saved.' : intent === 'confirm' ? 'Delivery start confirmed.' : intent === 'hold' ? 'Delivery placed on Hold.' : 'Delivery returned.',
      );
      try {
        router.refresh();
      } catch (refreshErr) {
        console.warn('Delivery Start saved but router.refresh() failed:', refreshErr);
      }
    } catch (err) {
      console.error('Failed to save Delivery Start:', err);
      setClientError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  // CM-71H.9 — Manager Preview Mode: see erection-method-statement-approval-panel.tsx's own comment on this pattern.
  const prerequisiteMissing = !schedule || schedule.status !== 'ISSUED';
  if (prerequisiteMissing && !isPreviewMode) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-base font-semibold text-text-primary">Delivery Start</h1>
          <p className="text-xs text-text-secondary mt-0.5">Erection Workflow · Step 4 of 7</p>
        </div>
        <InfoBox>
          Erection Schedule has not been issued yet.
        </InfoBox>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/contracts/${contractId}/workflow/erection/schedule`}
            className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            Go to Step 3
          </Link>
          {isStaffTier && <ErectionStaffBackNav />}
        </div>
      </div>
    );
  }

  const { label: statusLabel, badgeClasses: statusBadgeClasses } = computeDisplayStatus(
    deliveryStart?.status ?? null,
    validateErectionDeliveryStartFormValues({
      deliveryReferenceNo: deliveryStart?.deliveryReferenceNo ?? '',
      deliveryDate: deliveryStart?.deliveryDate ?? '',
      plannedDeliveryWindowStart: deliveryStart?.plannedDeliveryWindowStart ?? '',
      plannedDeliveryWindowEnd: deliveryStart?.plannedDeliveryWindowEnd ?? '',
      transportMode: deliveryStart?.transportMode ?? '',
      dispatchProductionSource: deliveryStart?.dispatchProductionSource ?? '',
      dispatchFromYard: deliveryStart?.dispatchFromYard ?? '',
      deliveryToSiteLocation: deliveryStart?.deliveryToSiteLocation ?? '',
    }),
  );
  const currentStep = computeErectionStepTrackerCurrentStep(schedule?.status ?? null, deliveryStart?.status ?? null);
  const totalsPreview = computeDeliveryTotalsPreview(
    itemRows.map((row) => ({ weight: row.weight.trim() ? Number(row.weight) : null, volume: row.volume.trim() ? Number(row.volume) : null, quantity: Number(row.quantity) || 0 })),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold text-text-primary">Delivery Start</h1>
            <span className="inline-flex items-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
              Delivery / Logistics Team
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClasses}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">Erection Workflow · Step 4 of 7</p>
        </div>
        <div className="flex items-center gap-2">
          {deliveryStart?.status === 'STARTED' && (
            <Link
              href={`/contracts/${contractId}/workflow/erection/start`}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              Continue to Step 5 →
            </Link>
          )}
          <Link
            href={`/contracts/${contractId}/workflow/erection/schedule`}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            View Step 3
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
              <li>Confirm that materials and equipment are ready and released for delivery.</li>
              <li>Coordinate with delivery/logistics team and site team for dispatch confirmation.</li>
              <li>Verify delivery documents, packing list, gate entry, vehicle, driver, and transport details.</li>
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
            id="erection-delivery-start-form"
            onSubmit={(e) => { void handleSubmit(e, submitIntentRef.current); }}
            className="rounded-lg border border-border bg-surface p-4 space-y-4"
          >
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Delivery Information</h2>

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
                <label htmlFor="deliveryReferenceNo" className={labelCls}>
                  Delivery Reference No. <span className="text-error">*</span>
                </label>
                <input
                  id="deliveryReferenceNo" name="deliveryReferenceNo" type="text" maxLength={50}
                  defaultValue={deliveryStart?.deliveryReferenceNo ?? ''} placeholder="e.g. DEL-GRM-001"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="deliveryDate" className={labelCls}>
                  Delivery Date <span className="text-error">*</span>
                </label>
                <input
                  id="deliveryDate" name="deliveryDate" type="date"
                  defaultValue={deliveryStart?.deliveryDate ?? ''} disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="transportMode" className={labelCls}>
                  Transport Mode <span className="text-error">*</span>
                </label>
                <input
                  id="transportMode" name="transportMode" type="text" maxLength={100}
                  defaultValue={deliveryStart?.transportMode ?? ''} placeholder="e.g. Road"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="plannedDeliveryWindowStart" className={labelCls}>
                  Planned Delivery Window Start <span className="text-error">*</span>
                </label>
                <input
                  id="plannedDeliveryWindowStart" name="plannedDeliveryWindowStart" type="date"
                  defaultValue={deliveryStart?.plannedDeliveryWindowStart ?? ''} disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="plannedDeliveryWindowEnd" className={labelCls}>
                  Planned Delivery Window End <span className="text-error">*</span>
                </label>
                <input
                  id="plannedDeliveryWindowEnd" name="plannedDeliveryWindowEnd" type="date"
                  defaultValue={deliveryStart?.plannedDeliveryWindowEnd ?? ''} disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="dispatchProductionSource" className={labelCls}>
                  Dispatch / Production Source <span className="text-error">*</span>
                </label>
                <input
                  id="dispatchProductionSource" name="dispatchProductionSource" type="text" maxLength={200}
                  defaultValue={deliveryStart?.dispatchProductionSource ?? ''} placeholder="e.g. RECAFCO Precast Yard"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="dispatchFromYard" className={labelCls}>
                  Dispatch From / Yard <span className="text-error">*</span>
                </label>
                <input
                  id="dispatchFromYard" name="dispatchFromYard" type="text" maxLength={200}
                  defaultValue={deliveryStart?.dispatchFromYard ?? ''} placeholder="e.g. RECAFCO Mina Abdullah Yard"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="deliveryToSiteLocation" className={labelCls}>
                  Delivery To Site / Location <span className="text-error">*</span>
                </label>
                <input
                  id="deliveryToSiteLocation" name="deliveryToSiteLocation" type="text" maxLength={200}
                  defaultValue={deliveryStart?.deliveryToSiteLocation ?? ''} placeholder="e.g. GRM Site - Boundary Wall Zone A"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="gateEntryContact" className={labelCls}>Gate Entry Contact</label>
                <input
                  id="gateEntryContact" name="gateEntryContact" type="text" maxLength={150}
                  defaultValue={deliveryStart?.gateEntryContact ?? ''} placeholder="e.g. Site Coordinator"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="deliveryNoteOrLrNo" className={labelCls}>Delivery Note / LR No.</label>
                <input
                  id="deliveryNoteOrLrNo" name="deliveryNoteOrLrNo" type="text" maxLength={100}
                  defaultValue={deliveryStart?.deliveryNoteOrLrNo ?? ''} placeholder="e.g. DN-GRM-001"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="vehicleNo" className={labelCls}>Vehicle No.</label>
                <input
                  id="vehicleNo" name="vehicleNo" type="text" maxLength={50}
                  defaultValue={deliveryStart?.vehicleNo ?? ''} placeholder="e.g. KWT 45872"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="driverName" className={labelCls}>Driver Name</label>
                <input
                  id="driverName" name="driverName" type="text" maxLength={150}
                  defaultValue={deliveryStart?.driverName ?? ''} placeholder="e.g. Ramesh Kumar"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
            </div>

            <div className={gridCls3}>
              <div>
                <label htmlFor="driverContact" className={labelCls}>Driver Contact</label>
                <input
                  id="driverContact" name="driverContact" type="text" maxLength={50}
                  defaultValue={deliveryStart?.driverContact ?? ''} placeholder="e.g. +965 5555 1234"
                  disabled={!canUpdate} className={inputCls}
                />
              </div>
            </div>

            <div>
              <label htmlFor="comments" className={labelCls}>Comments / Notes</label>
              <textarea
                id="comments" name="comments" rows={3} maxLength={10000}
                defaultValue={deliveryStart?.comments ?? ''} placeholder="Required when placing on Hold or Returning."
                disabled={!canUpdate} className={`${inputCls} resize-y`}
              />
              <p className="text-[11px] text-text-muted mt-1">Required to place this delivery on Hold or Return it.</p>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted pt-1">Delivery Items Summary</p>
            <div className={gridCls3}>
              <div>
                <span className={labelCls}>Total Packages</span>
                <p className="text-sm text-text-primary py-2">{totalsPreview.totalPackages}</p>
              </div>
              <div>
                <span className={labelCls}>Total Weight</span>
                <p className="text-sm text-text-primary py-2">{totalsPreview.totalWeight !== null ? totalsPreview.totalWeight.toFixed(2) : '—'}</p>
              </div>
              <div>
                <span className={labelCls}>Total Volume</span>
                <p className="text-sm text-text-primary py-2">{totalsPreview.totalVolume !== null ? totalsPreview.totalVolume.toFixed(2) : '—'}</p>
              </div>
              <div>
                <span className={labelCls}>Total Items</span>
                <p className="text-sm text-text-primary py-2">{totalsPreview.totalItems}</p>
              </div>
            </div>

            <ItemsOverviewSection rows={itemRows} setRows={setItemRows} canUpdate={canUpdate} />

            {deliveryStart ? (
              <RequiredDocumentsSection contractId={contractId} deliveryStart={deliveryStart} canUpdate={canUpdate} />
            ) : (
              <InfoBox variant="subtle">
                Save this Delivery Start first (Save Draft). Then upload attachments and link them to the required documents checklist.
              </InfoBox>
            )}

            {deliveryStart ? (
              <AttachmentsSection contractId={contractId} deliveryStart={deliveryStart} />
            ) : (
              <InfoBox variant="subtle">
                Save this Delivery Start first (Save Draft). Then upload supporting documents.
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
                    title="Erection Start will be available after Step 5 is implemented"
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
                    {isSaving && submitIntentRef.current === 'confirm' ? 'Saving…' : 'Confirm Delivery Start'}
                  </button>
                </div>
              )
            )}
          </form>
        </div>

        <ErectionDeliveryStartSidebar
          deliveryStart={deliveryStart}
          recentActivity={recentActivity}
          contract={isStaffTier ? contract : undefined}
        />
      </div>
    </div>
  );
}

const ACTIVITY_EVENT_LABELS: Record<string, string> = {
  erection_schedule_issued: 'Step 3 schedule issued',
  erection_schedule_hold: 'Step 3 schedule placed on Hold',
  erection_schedule_returned: 'Step 3 schedule returned',
  erection_delivery_start_draft_saved: 'Delivery draft saved',
  erection_delivery_start_confirmed: 'Delivery start confirmed',
  erection_delivery_start_hold: 'Delivery placed on Hold',
  erection_delivery_start_returned: 'Delivery returned',
  erection_delivery_start_attachment_uploaded: 'Attachment uploaded',
  erection_delivery_start_attachment_deleted: 'Attachment removed',
};

/** CM-71H.8 — `contract` is only ever passed by the staff-tier call site (see erection-method-statement-panel.tsx's own doc comment on this pattern). */
function ErectionDeliveryStartSidebar({
  deliveryStart,
  recentActivity,
  contract,
}: {
  deliveryStart: ContractErectionDeliveryStart | null;
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
          <li className="font-semibold text-text-primary">4. Delivery Start</li>
        </ol>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">Task Details</h2>
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="text-text-muted">Created By</dt>
            <dd className="text-text-primary mt-0.5">{deliveryStart?.createdByUser.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated By</dt>
            <dd className="text-text-primary mt-0.5">{deliveryStart?.updatedByUser?.displayName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Last Updated</dt>
            <dd className="text-text-primary mt-0.5">{deliveryStart ? formatDateTime(deliveryStart.updatedAt) : '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Confirmed On</dt>
            <dd className="text-text-primary mt-0.5">{deliveryStart ? formatDateTime(deliveryStart.confirmedAt) : '—'}</dd>
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
