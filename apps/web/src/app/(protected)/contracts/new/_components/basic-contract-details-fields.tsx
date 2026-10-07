'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import type { ContractParty } from '@/lib/contracts-api';
import { inputCls, labelCls } from '../../_components/contract-form-fields';
import { pickDefaultSecondPartyId } from '../../_lib/contract-party-helpers';
import type { BasicDetailsErrors } from '../../_lib/contract-party-helpers';
import { PartyFormModal } from '../../parties/_components/party-form-modal';

interface Props {
  firstParties: ContractParty[];
  secondParties: ContractParty[];
  /** Whether the viewer may add a new customer from here (contracts.create). */
  canAddParty: boolean;
  errors: BasicDetailsErrors;
  onClearError: (field: keyof BasicDetailsErrors) => void;
}

const linkCls = 'text-xs font-medium text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-focus rounded';

function FieldError({ id, message }: { id: string; message: string | undefined }): React.JSX.Element | null {
  if (!message) return null;
  return <p id={id} className="mt-1 text-xs text-error">{message}</p>;
}

/**
 * FMP-CONTRACT-01 — Basic Contract Details inputs for New Contract Register:
 * Customer (First Party) and Second Party come from the Contract Party master
 * (Second Party starts on RECAFCO); the rest are plain text inputs. Selected
 * party ids are submitted as `firstPartyId` / `secondPartyId`; the old
 * free-text Company Name field is gone — the API copies the selected
 * customer's name into it.
 */
export function BasicContractDetailsFields({
  firstParties: initialFirstParties,
  secondParties,
  canAddParty,
  errors,
  onClearError,
}: Props): React.JSX.Element {
  const [firstParties, setFirstParties] = useState(initialFirstParties);
  const [firstPartyId, setFirstPartyId] = useState('');
  const [secondPartyId, setSecondPartyId] = useState(() => pickDefaultSecondPartyId(secondParties));
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const selectedFirstParty = firstParties.find((p) => p.id === firstPartyId);

  function handleQuickAdded(party: ContractParty): void {
    setFirstParties((prev) => [...prev, party].sort((a, b) => a.name.localeCompare(b.name)));
    setFirstPartyId(party.id);
    onClearError('firstPartyId');
    setShowQuickAdd(false);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
      <div className="sm:col-span-3">
        <label htmlFor="firstPartyId" className={labelCls}>
          Customer (First Party) <span className="text-error">*</span>
        </label>
        <select
          id="firstPartyId"
          name="firstPartyId"
          value={firstPartyId}
          onChange={(e) => {
            setFirstPartyId(e.target.value);
            onClearError('firstPartyId');
          }}
          aria-invalid={Boolean(errors.firstPartyId)}
          aria-describedby={errors.firstPartyId ? 'firstPartyId-error' : undefined}
          className={inputCls}
        >
          <option value="">Select customer</option>
          {firstParties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <FieldError id="firstPartyId-error" message={errors.firstPartyId} />
        {selectedFirstParty?.contactNo && (
          <p className="mt-1 text-xs text-text-secondary">Contact No: {selectedFirstParty.contactNo}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          {canAddParty && (
            <button type="button" onClick={() => setShowQuickAdd(true)} className={`${linkCls} inline-flex items-center gap-1`}>
              <Plus className="size-3" aria-hidden="true" />
              Add new customer
            </button>
          )}
          <a href="/contracts/parties" target="_blank" rel="noopener noreferrer" className={linkCls}>
            Manage parties
          </a>
        </div>
      </div>

      <div className="sm:col-span-3">
        <label htmlFor="secondPartyId" className={labelCls}>
          Second Party <span className="text-error">*</span>
        </label>
        <select
          id="secondPartyId"
          name="secondPartyId"
          value={secondPartyId}
          onChange={(e) => {
            setSecondPartyId(e.target.value);
            onClearError('secondPartyId');
          }}
          aria-invalid={Boolean(errors.secondPartyId)}
          aria-describedby={errors.secondPartyId ? 'secondPartyId-error' : undefined}
          className={inputCls}
        >
          <option value="">Select second party</option>
          {secondParties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <FieldError id="secondPartyId-error" message={errors.secondPartyId} />
        <div className="mt-1.5">
          <a href="/contracts/parties" target="_blank" rel="noopener noreferrer" className={linkCls}>
            Manage parties
          </a>
        </div>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="jobOrder" className={labelCls}>Job Order</label>
        <input id="jobOrder" name="jobOrder" type="text" maxLength={100} placeholder="Enter job order no." className={inputCls} />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="quotationNumber" className={labelCls}>Quotation No</label>
        <input id="quotationNumber" name="quotationNumber" type="text" maxLength={100} placeholder="Enter quotation no." className={inputCls} />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="projectNumber" className={labelCls}>Project Number</label>
        <input id="projectNumber" name="projectNumber" type="text" maxLength={100} placeholder="Enter project number" className={inputCls} />
      </div>

      <div className="sm:col-span-6">
        <label htmlFor="title" className={labelCls}>
          Project Name <span className="text-error">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={300}
          placeholder="Enter project name"
          onChange={() => onClearError('title')}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'title-error' : undefined}
          className={inputCls}
        />
        <FieldError id="title-error" message={errors.title} />
      </div>

      {/* Rendered into <body>: the popup has its own <form>, which must not sit inside the register form. */}
      {showQuickAdd &&
        createPortal(
          <PartyFormModal compact fixedType="FIRST_PARTY" onClose={() => setShowQuickAdd(false)} onSaved={handleQuickAdded} />,
          document.body,
        )}
    </div>
  );
}
