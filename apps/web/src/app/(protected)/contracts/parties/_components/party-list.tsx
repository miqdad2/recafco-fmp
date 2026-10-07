'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import type { ContractParty, ContractPartyType } from '@/lib/contracts-api';
import { PARTY_TYPE_LABELS, filterParties } from '../../_lib/contract-party-helpers';
import { setPartyActiveAction } from '../actions';
import { PartyFormModal } from './party-form-modal';

interface Props {
  /** Page title + subtitle, shown top left next to the + Add Party button. */
  header: React.ReactNode;
  parties: ContractParty[];
  canCreate: boolean;
  canUpdate: boolean;
}

type ModalState =
  | { kind: 'closed' }
  | { kind: 'add'; defaultType: ContractPartyType }
  | { kind: 'edit'; party: ContractParty };

const actionBtnCls =
  'inline-flex items-center h-8 px-3 rounded-md border border-border bg-surface text-xs font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60';
const addBtnCls =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-accent/30 bg-accent/5 text-xs font-medium text-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-focus';

const EMPTY_TEXT: Record<ContractPartyType, string> = {
  FIRST_PARTY: 'No customers added yet.',
  SECOND_PARTY: 'No second party companies added yet.',
};
const ADD_LABEL: Record<ContractPartyType, string> = {
  FIRST_PARTY: 'Add Customer',
  SECOND_PARTY: 'Add Second Party',
};

interface PanelProps {
  type: ContractPartyType;
  parties: ContractParty[];
  searching: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  busyId: string | null;
  onAdd: (type: ContractPartyType) => void;
  onEdit: (party: ContractParty) => void;
  onToggle: (party: ContractParty) => void;
}

function PartyPanel({ type, parties, searching, canCreate, canUpdate, busyId, onAdd, onEdit, onToggle }: PanelProps): React.JSX.Element {
  const headingId = `party-panel-${type}`;
  return (
    <section aria-labelledby={headingId} className="min-w-0 rounded-lg border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 id={headingId} className="text-base font-semibold text-text-primary">
          {PARTY_TYPE_LABELS[type]} — {parties.length}
        </h2>
        {canCreate && (
          <button type="button" onClick={() => onAdd(type)} className={addBtnCls}>
            <Plus className="size-3.5" aria-hidden="true" />
            {ADD_LABEL[type]}
          </button>
        )}
      </div>

      {parties.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-text-muted">{searching ? 'No matching companies.' : EMPTY_TEXT[type]}</p>
          {!searching && canCreate && (
            <button type="button" onClick={() => onAdd(type)} className={`${addBtnCls} mt-3`}>
              Add Party
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {parties.map((party) => (
            <li key={party.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium text-text-primary" title={party.name}>{party.name}</p>
                <p className="mt-0.5 text-xs text-text-secondary">Contact No: {party.contactNo || '—'}</p>
                <span
                  className={`mt-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    party.isActive ? 'bg-success-light text-success' : 'bg-surface-secondary text-text-muted'
                  }`}
                >
                  {party.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              {canUpdate && (
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => onEdit(party)} className={actionBtnCls}>
                    Edit
                  </button>
                  <button type="button" onClick={() => onToggle(party)} disabled={busyId === party.id} className={actionBtnCls}>
                    {party.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * FMP-CONTRACT-02 — Contract Parties as two side-by-side panels (Customer
 * (First Party) | Second Party) with per-panel counts, a shared search box and
 * quick-add buttons. Stacks (customers first) on small screens. Parties are
 * never deleted: Deactivate / Activate only.
 */
export function PartyList({ header, parties, canCreate, canUpdate }: Props): React.JSX.Element {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');

  const visible = filterParties(parties, query);
  const customers = visible.filter((p) => p.partyType === 'FIRST_PARTY');
  const secondParties = visible.filter((p) => p.partyType === 'SECOND_PARTY');
  const searching = query.trim() !== '';

  function handleSaved(saved: ContractParty): void {
    setMessage({ tone: 'ok', text: modal.kind === 'edit' ? `${saved.name} updated.` : `${saved.name} added.` });
    setModal({ kind: 'closed' });
    router.refresh();
  }

  async function toggleActive(party: ContractParty): Promise<void> {
    if (busyId) return;
    setBusyId(party.id);
    setMessage(null);
    try {
      const result = await setPartyActiveAction(party.id, !party.isActive);
      if (result.error) {
        setMessage({ tone: 'error', text: result.error });
        return;
      }
      setMessage({ tone: 'ok', text: party.isActive ? `${party.name} deactivated.` : `${party.name} activated.` });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const panelProps = {
    searching,
    canCreate,
    canUpdate,
    busyId,
    onAdd: (type: ContractPartyType) => setModal({ kind: 'add', defaultType: type }),
    onEdit: (party: ContractParty) => setModal({ kind: 'edit', party }),
    onToggle: (party: ContractParty) => void toggleActive(party),
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        {header}
        {canCreate && (
          <button
            type="button"
            onClick={() => setModal({ kind: 'add', defaultType: 'FIRST_PARTY' })}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-md bg-accent text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add Party
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company name or contact no"
          aria-label="Search company name or contact no"
          className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {message && (
        <div
          role="status"
          className={`rounded-md border px-4 py-3 text-sm ${
            message.tone === 'ok' ? 'border-success bg-success-light text-success' : 'border-error bg-error-light text-error'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <PartyPanel type="FIRST_PARTY" parties={customers} {...panelProps} />
        <PartyPanel type="SECOND_PARTY" parties={secondParties} {...panelProps} />
      </div>

      {modal.kind !== 'closed' && (
        <PartyFormModal
          {...(modal.kind === 'edit' ? { party: modal.party } : { defaultType: modal.defaultType })}
          onClose={() => setModal({ kind: 'closed' })}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
