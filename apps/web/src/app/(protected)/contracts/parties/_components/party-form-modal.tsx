'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { ContractParty, ContractPartyType } from '@/lib/contracts-api';
import { inputCls, labelCls } from '../../_components/contract-form-fields';
import { PARTY_TYPE_OPTIONS, PARTY_TYPE_LABELS, validatePartyForm } from '../../_lib/contract-party-helpers';
import type { PartyFormErrors } from '../../_lib/contract-party-helpers';
import { createPartyAction, updatePartyAction } from '../actions';

interface Props {
  /** Edit an existing party; omit to add a new one. */
  party?: ContractParty;
  /** Preselect the Type but leave it editable (+ Add Customer / + Add Second Party). */
  defaultType?: ContractPartyType;
  /** Lock the Type (used by the quick-add on New Contract Register). */
  fixedType?: ContractPartyType;
  /** Quick-add: only Company Name and Contact No. */
  compact?: boolean;
  onClose: () => void;
  onSaved: (party: ContractParty) => void;
}

function FieldError({ id, message }: { id: string; message: string | undefined }): React.JSX.Element | null {
  if (!message) return null;
  return <p id={id} className="mt-1 text-xs text-error">{message}</p>;
}

/**
 * FMP-CONTRACT-01 — Add / Edit party popup. Used on the Contract Parties page
 * (full form) and as the compact "+ Add new customer" quick-add on New
 * Contract Register. Errors appear under the field; the server message shows
 * in a banner.
 */
export function PartyFormModal({ party, fixedType, defaultType, compact = false, onClose, onSaved }: Props): React.JSX.Element {
  const [name, setName] = useState(party?.name ?? '');
  const [partyType, setPartyType] = useState<string>(party?.partyType ?? fixedType ?? defaultType ?? 'FIRST_PARTY');
  const [contactNo, setContactNo] = useState(party?.contactNo ?? '');
  const [email, setEmail] = useState(party?.email ?? '');
  const [address, setAddress] = useState(party?.address ?? '');
  const [errors, setErrors] = useState<PartyFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isEdit = Boolean(party);
  const titleText = isEdit
    ? 'Edit Party'
    : fixedType === 'FIRST_PARTY'
      ? 'Add new customer'
      : 'Add Party';
  const lockedDefault = party?.name === 'RECAFCO' && party.partyType === 'SECOND_PARTY';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    // This form can sit inside the New Contract Register <form> in the DOM
    // tree via a portal-less modal — never let the submit reach the parent.
    e.preventDefault();
    e.stopPropagation();
    if (isSaving) return;

    const found = validatePartyForm({ name, partyType, email });
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;

    setIsSaving(true);
    try {
      const input = {
        name,
        partyType: partyType as ContractPartyType,
        contactNo,
        email,
        address,
      };
      const result = party ? await updatePartyAction(party.id, input) : await createPartyAction(input);
      if (result.error || !result.party) {
        setServerError(result.error ?? 'Party could not be saved. Please try again.');
        return;
      }
      onSaved(result.party);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="party-form-title"
    >
      <div className="flex max-h-[92vh] w-[min(96vw,520px)] my-4 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 id="party-form-title" className="text-lg font-semibold text-text-primary">{titleText}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            {serverError && (
              <div className="rounded-md border border-error bg-error-light px-4 py-3 text-sm text-error">{serverError}</div>
            )}

            <div>
              <label htmlFor="party-name" className={labelCls}>
                Company Name <span className="text-error">*</span>
              </label>
              <input
                id="party-name"
                type="text"
                maxLength={300}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={lockedDefault}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'party-name-error' : undefined}
                placeholder="Enter company name"
                className={inputCls}
                autoFocus
              />
              <FieldError id="party-name-error" message={errors.name} />
            </div>

            {!compact && (
              <div>
                <label htmlFor="party-type" className={labelCls}>
                  Type <span className="text-error">*</span>
                </label>
                <select
                  id="party-type"
                  value={partyType}
                  onChange={(e) => setPartyType(e.target.value)}
                  disabled={lockedDefault || Boolean(fixedType)}
                  aria-invalid={Boolean(errors.partyType)}
                  className={inputCls}
                >
                  {PARTY_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <FieldError id="party-type-error" message={errors.partyType} />
                {lockedDefault && (
                  <p className="mt-1 text-xs text-text-muted">RECAFCO is the default Second Party. Its name and type are fixed.</p>
                )}
              </div>
            )}
            {compact && fixedType && (
              <p className="text-xs text-text-muted">Type: {PARTY_TYPE_LABELS[fixedType]}</p>
            )}

            <div>
              <label htmlFor="party-contact" className={labelCls}>Contact No</label>
              <input
                id="party-contact"
                type="text"
                maxLength={50}
                value={contactNo}
                onChange={(e) => setContactNo(e.target.value)}
                placeholder="Enter contact no."
                className={inputCls}
              />
            </div>

            {!compact && (
              <>
                <div>
                  <label htmlFor="party-email" className={labelCls}>Email (optional)</label>
                  <input
                    id="party-email"
                    type="email"
                    maxLength={200}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'party-email-error' : undefined}
                    placeholder="Enter email"
                    className={inputCls}
                  />
                  <FieldError id="party-email-error" message={errors.email} />
                </div>
                <div>
                  <label htmlFor="party-address" className={labelCls}>Address (optional)</label>
                  <textarea
                    id="party-address"
                    rows={2}
                    maxLength={500}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter address"
                    className={`${inputCls} resize-y`}
                  />
                </div>
              </>
            )}
          </div>

          <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border bg-surface px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex items-center h-10 px-4 rounded-md border border-border bg-surface text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center h-10 px-4 rounded-md bg-accent text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
