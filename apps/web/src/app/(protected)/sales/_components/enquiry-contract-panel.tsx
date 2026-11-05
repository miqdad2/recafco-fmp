'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, FolderOpen, Link2, Loader2, Plus, Search, X } from 'lucide-react';
import type { SalesEnquiryContract } from '@/lib/sales-api';
import type { ContractChoice } from '../_lib/form-state';
import { linkContractAction, searchContractsToLinkAction } from '../actions';
import { BTN_ADD, BTN_NEUTRAL, BTN_OPEN, INPUT_CLASS } from './sales-ui';

/**
 * FMP-SALES-09 — the enquiry's contract step. A contract is NEVER created or linked just because an enquiry is Confirmed:
 * this panel only offers the explicit choices to an authorised user — Create Contract (opens the existing New Contract
 * Register with the supported enquiry fields filled in for review), Link Existing Contract (search, choose, confirm) and,
 * once linked, Open Contract.
 */
interface Props {
  enquiryId: string;
  enquiryNumber: string;
  companyName: string;
  confirmed: boolean;
  contract: SalesEnquiryContract | null;
  /** sales.update */
  canUpdate: boolean;
  /** contracts.create */
  canCreateContract: boolean;
  /** contracts.read (search and Open Contract need it) */
  canReadContracts: boolean;
}

export function EnquiryContractPanel({ enquiryId, enquiryNumber, companyName, confirmed, contract, canUpdate, canCreateContract, canReadContracts }: Props): React.JSX.Element | null {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContractChoice[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<ContractChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Search as the user types (short pause), only while the popup is open.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setSearching(true);
      const res = await searchContractsToLinkAction(query);
      if (cancelled) return;
      setSearching(false);
      setResults(res.items);
      setError(res.error);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, open]);

  if (!confirmed && !contract) return null;

  function show(): void {
    setQuery('');
    setChosen(null);
    setError(null);
    setOpen(true);
    dialog.current?.showModal();
  }

  async function save(): Promise<void> {
    if (busy.current || !chosen) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const res = await linkContractAction(enquiryId, chosen.id);
      if (!res.ok) {
        setError(`Not linked. ${res.error ?? 'Please try again.'}`);
        return;
      }
      dialog.current?.close();
      router.refresh();
    } catch {
      setError('Not linked. The connection failed; please try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="enquiry-contract-title" className="rounded-xl border border-green-300 bg-green-50/50 p-5 shadow-sm">
      <h2 id="enquiry-contract-title" className="flex items-center gap-2 text-xl font-bold text-text-primary">
        <FileText className="size-6 text-green-800" aria-hidden="true" /> Contract
      </h2>

      {contract ? (
        <div className="mt-3 space-y-3">
          <p className="text-lg text-text-primary">
            Linked contract: <span className="font-bold">{contract.referenceNumber}</span>
            {contract.title ? <span className="block break-words text-text-secondary">{contract.title}</span> : null}
          </p>
          {contract.linkedAt && <p className="text-base text-text-secondary">Linked {contract.linkedAt.slice(0, 10)}{contract.linkedBy ? ` by ${contract.linkedBy}` : ''}</p>}
          {contract.id ? (
            <Link href={`/contracts/${contract.id}`} className={BTN_OPEN}>
              <FolderOpen className="size-5 shrink-0" aria-hidden="true" /> Open Contract
            </Link>
          ) : (
            <p className="text-base text-text-secondary">You do not have access to open contracts.</p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-lg text-text-primary">
            This enquiry is Confirmed. No contract is linked yet. {canUpdate ? 'Creating or linking a contract is a separate step you choose.' : ''}
          </p>
          {canUpdate && (
            <div className="flex flex-wrap items-center gap-2">
              {canCreateContract && (
                <Link href={`/contracts/new?fromEnquiry=${enquiryId}`} className={BTN_ADD}>
                  <Plus className="size-5 shrink-0" aria-hidden="true" /> Create Contract
                </Link>
              )}
              {canReadContracts && (
                <button type="button" onClick={show} aria-haspopup="dialog" className={BTN_NEUTRAL}>
                  <Link2 className="size-5 shrink-0" aria-hidden="true" /> Link Existing Contract
                </button>
              )}
              {!canCreateContract && !canReadContracts && <p className="text-base text-text-secondary">Your account cannot create or link contracts.</p>}
            </div>
          )}
        </div>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="link-contract-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current && !busy.current) dialog.current?.close();
        }}
        className="m-auto max-h-[94vh] w-[min(94vw,38rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-slate-900/55"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 id="link-contract-title" className="text-2xl font-extrabold">Link Existing Contract</h2>
            <p className="mt-1 break-words text-lg font-semibold">{companyName}</p>
            <p className="text-base text-text-secondary">{enquiryNumber}</p>
          </div>
          <button type="button" onClick={() => !busy.current && dialog.current?.close()} aria-label="Close" className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="link-contract-search" className="mb-1.5 block text-lg font-semibold">Find a contract</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <input id="link-contract-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Contract number, project or client" className={`${INPUT_CLASS} pl-12`} autoComplete="off" />
            </div>
          </div>
          <div aria-live="polite" className="min-h-6 text-base text-text-secondary">{searching ? 'Searching…' : results.length === 0 && !error ? 'No matching contracts.' : ''}</div>
          <ul className="max-h-72 space-y-2 overflow-y-auto" role="listbox" aria-label="Contracts">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={chosen?.id === c.id}
                  onClick={() => setChosen(c)}
                  className={`block w-full rounded-lg border-2 px-4 py-2 text-left text-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-focus ${
                    chosen?.id === c.id ? 'border-blue-700 bg-blue-50' : 'border-slate-400 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="block font-bold">{c.referenceNumber}</span>
                  <span className="block break-words">{c.title}</span>
                  <span className="block break-words text-base text-text-secondary">{c.counterpartyName}</span>
                </button>
              </li>
            ))}
          </ul>
          {chosen && <p className="text-lg">Link <span className="font-bold">{enquiryNumber}</span> to <span className="font-bold">{chosen.referenceNumber}</span>?</p>}
          {error && <div role="alert" className="rounded-lg border border-error bg-error-light px-4 py-3 text-base font-semibold text-error">{error}</div>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => dialog.current?.close()} disabled={saving} className={BTN_NEUTRAL}>Cancel</button>
            <button type="button" onClick={() => void save()} disabled={saving || !chosen} className={BTN_OPEN}>
              {saving ? <><Loader2 className="size-5 animate-spin" aria-hidden="true" /> Linking…</> : 'Link Contract'}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
