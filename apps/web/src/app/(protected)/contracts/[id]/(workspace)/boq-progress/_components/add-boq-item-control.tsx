'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Paperclip } from 'lucide-react';
import { addBoqItemAction } from '../actions';
import { uploadBoqItemFileAction } from '../../../../../technical/actions';
import { BoqFilePicker, BoqFileTypesHint } from '../../../../../technical/_components/boq-staged-files';
import { splitValidBoqFiles, registerFilesTotalError } from '../../../../../technical/_lib/boq-attachment-helpers';
import { formatFileSize } from '../../../../../technical/_lib/technical-format';
import { formatContractValue } from '../../../../_lib/contract-ui-helpers';
import {
  ADD_BOQ_ITEM_TEXT,
  REGISTER_UNIT_OPTIONS,
  unitLabel,
  validateNewBoqItem,
  newBoqItemTotal,
} from '../../../../_lib/add-boq-item-helpers';
import type { NewBoqItemErrors } from '../../../../_lib/add-boq-item-helpers';

interface Props {
  contractId: string;
  currency: string;
  /** Already checked on the server: contracts.update and a contract that is not closed / cancelled / terminated. */
  canAdd: boolean;
  /** The BOQ Progress heading, shown on the left of the button. */
  children: React.ReactNode;
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'mb-1 block text-sm font-medium text-text-primary';

interface StagedFile {
  key: string;
  file: File;
}

/**
 * FMP-CONTRACT-11 — the "+ Add BOQ Item" button (top right of BOQ Progress), its
 * form and the success banner. Saving only ADDS one item; if some files then fail
 * to upload the item stays saved and the form stays open to retry just those files.
 */
export function AddBoqItemControl({ contractId, currency, canAdd, children }: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [contractQty, setContractQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [errors, setErrors] = useState<NewBoqItemErrors>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Once the item is saved its id is kept: a retry uploads files only and never creates the item again.
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [failedFiles, setFailedFiles] = useState<string[]>([]);
  const savingRef = useRef(false);
  const counter = useRef(0);

  const total = newBoqItemTotal(contractQty, unitPrice);

  function reset(): void {
    setDescription('');
    setUnit('');
    setContractQty('');
    setUnitPrice('');
    setFiles([]);
    setErrors({});
    setFileError(null);
    setServerError(null);
    setSavedItemId(null);
    setFailedFiles([]);
  }

  function openForm(): void {
    reset();
    setBanner(null);
    setOpen(true);
  }

  function pickFiles(picked: File[]): void {
    const { valid, errors: rejected } = splitValidBoqFiles(picked);
    const next = [...files, ...valid.map((file) => ({ key: `f-${(counter.current += 1)}`, file }))];
    const totalError = registerFilesTotalError(next.map((f) => f.file));
    if (totalError) {
      setFileError(totalError);
      return;
    }
    setFileError(rejected.length > 0 ? rejected.join(' ') : null);
    setFiles(next);
  }

  async function save(): Promise<void> {
    if (savingRef.current) return; // a second click while saving does nothing
    if (!savedItemId) {
      const found = validateNewBoqItem({ description, unit, contractQty, unitPrice });
      setErrors(found);
      if (Object.keys(found).length > 0) return;
    }
    savingRef.current = true;
    setSaving(true);
    setServerError(null);

    try {
      let itemId = savedItemId;
      let duplicate = false;
      if (!itemId) {
        const result = await addBoqItemAction(contractId, { description, unit, contractQty, unitPrice });
        if (result.error || !result.itemId) {
          setServerError(result.error ?? ADD_BOQ_ITEM_TEXT.saveFailed);
          return;
        }
        itemId = result.itemId;
        duplicate = result.duplicate === true;
        setSavedItemId(itemId);
      }

      // Files go one by one so a single bad file never stops the rest.
      const failures: string[] = [];
      const stillFailing: StagedFile[] = [];
      for (const staged of files) {
        const result = await uploadBoqItemFileAction(contractId, itemId, staged.file);
        if (result.error) {
          failures.push(result.error);
          stillFailing.push(staged);
        }
      }

      if (failures.length > 0) {
        setFiles(stillFailing); // retry uploads only these
        setFailedFiles(failures);
        router.refresh(); // the item is saved — show it behind the form
        return;
      }

      setOpen(false);
      reset();
      setBanner(duplicate ? ADD_BOQ_ITEM_TEXT.duplicate : ADD_BOQ_ITEM_TEXT.success);
      router.refresh();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function closeForm(): void {
    if (saving) return;
    setOpen(false);
    if (savedItemId) {
      // The item was saved even though the form was left open for retrying files.
      setBanner(failedFiles.length > 0 ? `${ADD_BOQ_ITEM_TEXT.filesFailed} You can add them again from BOQ Drawing Files.` : ADD_BOQ_ITEM_TEXT.success);
    }
    reset();
    router.refresh();
  }

  const partial = savedItemId !== null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>{children}</div>
        {canAdd && (
          <button
            type="button"
            onClick={openForm}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add BOQ Item
          </button>
        )}
      </div>

      {banner && (
        <div role="status" className="rounded-md border border-success bg-success-light px-4 py-3 text-sm text-success">
          {banner}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-boq-item-title"
        >
          <div className="my-4 flex max-h-[92vh] w-[min(96vw,620px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
              <h2 id="add-boq-item-title" className="text-lg font-semibold text-text-primary">{ADD_BOQ_ITEM_TEXT.title}</h2>
              <button type="button" onClick={closeForm} disabled={saving} aria-label="Close" className="rounded-md p-1.5 text-text-muted hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {serverError && <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">{serverError}</div>}
              {partial && (
                <div role="alert" className="rounded-md border border-warning bg-warning-light px-4 py-3 text-sm text-text-primary">
                  <p className="font-medium">{ADD_BOQ_ITEM_TEXT.filesFailed}</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-text-secondary">
                    {failedFiles.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs">Press Retry Files to upload only the files listed below. The item will not be added twice.</p>
                </div>
              )}

              {!partial && (
                <>
                  <div>
                    <label htmlFor="abi-description" className={labelCls}>Item Description <span className="text-error">*</span></label>
                    <input
                      id="abi-description"
                      type="text"
                      maxLength={500}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter item description"
                      aria-invalid={Boolean(errors.description)}
                      className={inputCls}
                      autoFocus
                    />
                    {errors.description && <p className="mt-1 text-xs text-error">{errors.description}</p>}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="abi-unit" className={labelCls}>Unit <span className="text-error">*</span></label>
                      <select id="abi-unit" value={unit} onChange={(e) => setUnit(e.target.value)} aria-invalid={Boolean(errors.unit)} className={inputCls}>
                        <option value="">Select unit</option>
                        {REGISTER_UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>{unitLabel(u)}</option>
                        ))}
                      </select>
                      {errors.unit && <p className="mt-1 text-xs text-error">{errors.unit}</p>}
                    </div>
                    <div>
                      <label htmlFor="abi-qty" className={labelCls}>Contract Qty <span className="text-error">*</span></label>
                      <input
                        id="abi-qty"
                        type="number"
                        min="0"
                        step="any"
                        value={contractQty}
                        onChange={(e) => setContractQty(e.target.value)}
                        placeholder="0"
                        aria-invalid={Boolean(errors.contractQty)}
                        className={`${inputCls} text-right tabular-nums`}
                      />
                      {errors.contractQty && <p className="mt-1 text-xs text-error">{errors.contractQty}</p>}
                    </div>
                    <div>
                      <label htmlFor="abi-price" className={labelCls}>Unit Price <span className="text-error">*</span></label>
                      <input
                        id="abi-price"
                        type="number"
                        min="0"
                        step="any"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        placeholder="0.000"
                        aria-invalid={Boolean(errors.unitPrice)}
                        className={`${inputCls} text-right tabular-nums`}
                      />
                      {errors.unitPrice && <p className="mt-1 text-xs text-error">{errors.unitPrice}</p>}
                    </div>
                  </div>

                  <div>
                    <span className={labelCls}>Total Amount</span>
                    <div className="rounded-md bg-surface-secondary px-3 py-2 text-right text-sm font-semibold tabular-nums text-text-primary" title="Contract Qty × Unit Price">
                      {formatContractValue(total.toString(), currency)}
                    </div>
                  </div>
                </>
              )}

              <div>
                <span className={labelCls}>Attach Drawing / File <span className="font-normal text-text-muted">(optional)</span></span>
                <BoqFilePicker label="Choose Files" disabled={saving} onPick={pickFiles} />
                <div className="mt-1"><BoqFileTypesHint /></div>
                {fileError && <p className="mt-1 text-xs text-error">{fileError}</p>}
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1.5" aria-label="Files to upload">
                    {files.map((f) => (
                      <li key={f.key} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                        <Paperclip className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate" title={f.file.name}>{f.file.name}</span>
                        <span className="shrink-0 text-xs text-text-muted">{formatFileSize(f.file.size)}</span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setFiles(files.filter((x) => x.key !== f.key))}
                          className="shrink-0 text-xs text-error hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-5 py-3">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
              >
                {partial ? 'Close' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
              >
                {saving ? 'Saving…' : partial ? 'Retry Files' : 'Save BOQ Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

