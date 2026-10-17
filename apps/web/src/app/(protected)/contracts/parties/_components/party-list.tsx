'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Pencil, X } from 'lucide-react';
import type { ContractParty, ContractPartyType } from '@/lib/contracts-api';
import { PARTY_PANEL_PAGE_SIZE, filterParties } from '../../_lib/contract-party-helpers';
import { setPartyActiveAction } from '../actions';
import { PartyFormModal } from './party-form-modal';

interface Props {
  /** Page title + subtitle. */
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
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-surface text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-60';
const addBtnCls =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-accent text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus';

const PANEL_TITLE: Record<ContractPartyType, string> = {
  FIRST_PARTY: 'Customers (First Party)',
  SECOND_PARTY: 'Second Parties',
};
const EMPTY_TEXT: Record<ContractPartyType, string> = {
  FIRST_PARTY: 'No customers added yet',
  SECOND_PARTY: 'No second parties added yet',
};
const ADD_LABEL: Record<ContractPartyType, string> = {
  FIRST_PARTY: 'Add Customer',
  SECOND_PARTY: 'Add Second Party',
};

interface PanelProps {
  type: ContractPartyType;
  /** Companies matching the search, already filtered for this panel. */
  parties: ContractParty[];
  searching: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  busyId: string | null;
  onAdd: (type: ContractPartyType) => void;
  onEdit: (party: ContractParty) => void;
  onToggle: (party: ContractParty) => void;
  onClearSearch: () => void;
}

function PartyPanel({ type, parties, searching, canCreate, canUpdate, busyId, onAdd, onEdit, onToggle, onClearSearch }: PanelProps): React.JSX.Element {
  const headingId = `party-panel-${type}`;
  const [limit, setLimit] = useState(PARTY_PANEL_PAGE_SIZE);
  const shown = parties.slice(0, limit);

  return (
    <section aria-labelledby={headingId} className="min-w-0 rounded-lg border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 id={headingId} className="text-base font-semibold text-text-primary">
          {PANEL_TITLE[type]} <span className="font-normal text-text-secondary">({parties.length})</span>
        </h2>
        {canCreate && (
          <button type="button" onClick={() => onAdd(type)} className={addBtnCls}>
            <Plus className="size-4" aria-hidden="true" />
            {ADD_LABEL[type]}
          </button>
        )}
      </div>

      {parties.length === 0 ? (
        <div className="px-4 py-8 text-center">
          {searching ? (
            <>
              <p className="text-sm font-medium text-text-primary">No matching companies found</p>
              <button type="button" onClick={onClearSearch} className={`${actionBtnCls} mt-3`}>
                Clear Search
              </button>
            </>
          ) : (
            <p className="text-sm text-text-secondary">{EMPTY_TEXT[type]}</p>
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {shown.map((party) => (
              <li key={party.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="break-words text-sm font-medium text-text-primary">{party.name}</p>
                  {party.contactNo && <p className="mt-0.5 text-xs text-text-secondary">{party.contactNo}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      party.isActive ? 'bg-success-light text-success' : 'bg-surface-secondary text-text-muted'
                    }`}
                  >
                    {party.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {canUpdate && (
                    <>
                      <button type="button" onClick={() => onEdit(party)} className={actionBtnCls} aria-label={`Edit ${party.name}`}>
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggle(party)}
                        disabled={busyId === party.id}
                        className={actionBtnCls}
                        aria-label={`${party.isActive ? 'Deactivate' : 'Activate'} ${party.name}`}
                      >
                        {party.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {parties.length > shown.length && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-text-secondary">
              <span>Showing {shown.length} of {parties.length}</span>
              <button type="button" onClick={() => setLimit((l) => l + PARTY_PANEL_PAGE_SIZE)} className={actionBtnCls}>
                Show more
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Contract Parties as two side-by-side panels (Customers (First Party) | Second
 * Parties) with real per-panel counts, one shared search and a dedicated Add
 * button per panel (FMP-PARTIES-01 removed the global Add Party button). Stacks
 * on small screens. Parties are never deleted: Deactivate / Activate only, and
 * both ask for confirmation.
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
    const question = party.isActive
      ? `Deactivate ${party.name}? It will no longer be offered for new contracts. Existing contracts and records are not changed, and you can activate it again later.`
      : `Activate ${party.name}? It will be available for new contracts again.`;
    if (!window.confirm(question)) return;
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
    onClearSearch: () => setQuery(''),
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">{header}</div>

      <div className="relative w-full max-w-3xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company name or contact number"
          aria-label="Search company name or contact number"
          className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-24 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1 rounded-md px-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <X className="size-4" aria-hidden="true" />
            Clear Search
          </button>
        )}
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
          existingParties={parties}
          onClose={() => setModal({ kind: 'closed' })}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
