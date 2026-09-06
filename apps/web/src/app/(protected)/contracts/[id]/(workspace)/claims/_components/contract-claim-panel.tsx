'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Pencil, HandCoins, CheckCircle2, FileSearch } from 'lucide-react';
import type { ContractClaim, ContractPerson } from '@/lib/contracts-api';
import { ClaimStatusBadge } from '../../../../claims/_components/claim-status-badge';
import { ClaimFormModal } from '../../../../claims/_components/claim-form-modal';
import { ContractClaimTypeBadge } from './contract-claim-type-badge';
import { closeClaimAction } from '../../../../actions';
import { formatContractValue } from '../../../../_lib/contract-ui-helpers';
import {
  CLAIM_STATUS_FILTER_OPTIONS,
  CLAIM_TYPE_FILTER_OPTIONS,
  formatDaysToDeadline,
} from '../../../../_lib/contract-claim-detail-helpers';

interface ClaimPanelContractContext {
  referenceNumber: string;
  title: string;
  counterpartyName?: string;
}

interface Props {
  contractId: string;
  claims: ContractClaim[];
  people: ContractPerson[];
  canUpdate: boolean;
  /** CM-70C — readable contract identity for the Add Claim modal, so it never falls back to displaying the raw contract UUID. */
  contract?: ClaimPanelContractContext;
}

type ModalState = { mode: 'add' } | { mode: 'edit'; claim: ContractClaim } | null;

/** Terminal claim statuses — no further Edit/Settle/Close action makes sense once reached. Mirrors ClaimRegisterTable's own TERMINAL_STATUSES. */
const TERMINAL_STATUSES = ['CLOSED', 'SETTLED', 'CANCELLED', 'REJECTED'];

const inputCls =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const filterLabelCls = 'text-[11px] font-medium text-text-muted uppercase tracking-wide';

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TABLE_COLUMNS = [
  'Claim ID', 'Intake ID', 'Claim Title', 'Claim Type', 'Date of Event', 'Claim Date', 'Status',
  'Submitted Value (KWD)', 'Approved Value (KWD)', 'Outstanding Value (KWD)', 'EOT Claimed (Days)',
  'EOT Approved (Days)', 'Responsible Person', 'Next Action', 'Action Due Date', 'Days to Deadline',
  'Last Update', 'Action',
];

// CM-61B — Claim ID (first) and Action (last) columns pinned while the other
// 16 columns scroll horizontally underneath, matching Contract List's own
// established sticky-column pattern (contract-list-table.tsx). Opaque
// backgrounds are required on both (a transparent/hover-tinted cell would
// let scrolled columns show through) — header uses bg-surface-secondary to
// match this table's own header row (Contract List's header is dark navy,
// this one isn't), body cells use bg-surface. This is the one known
// tradeoff: a sticky body cell does not pick up the row's own hover tint,
// same as Contract List's.
const STICKY_LEFT_HEADER_CLS = 'sticky left-0 z-10 bg-surface-secondary border-r border-border';
const STICKY_RIGHT_HEADER_CLS = 'sticky right-0 z-10 bg-surface-secondary border-l border-border';
const STICKY_LEFT_CLS = 'sticky left-0 z-10 bg-surface border-r border-border';
const STICKY_RIGHT_CLS = 'sticky right-0 z-10 bg-surface border-l border-border';

/**
 * CM-61 — Claims search/filter row + table + Add/Edit modal trigger, all in
 * one client component. Same bounded, contract-scoped, client-side-filtered
 * pattern established for Production Status/Variations (documented in
 * ui-registry.md) — a contract's claim list is fetched in full server-side
 * (pageSize 200), so search/status/type/responsible/due-date/overdue
 * filtering happens instantly with no round trip and no pagination. Reuses
 * the real ClaimFormModal/closeClaimAction/ClaimStatusBadge from the
 * module-level Claim Log (../../../claims/_components/) unmodified — same
 * Add/Edit fields, same server actions, same contracts.update gate; only
 * the display layer (column set, claim-type wording, filter labels) is
 * contract-scoped-specific. "Intake ID" has no real backing field anywhere
 * in ContractClaim — shown as its own column, always "—", never invented
 * (see final report).
 * CM-61B — empty state reworded to the approved two-line copy; Claim ID
 * (first) and Action (last) columns pinned via sticky positioning so both
 * stay reachable while scrolling through the other 16 columns, matching
 * Contract List's own established sticky-column pattern. Filtering/export/
 * Add Claim behavior unchanged — only presentation.
 */
export function ContractClaimPanel({ contractId, claims, people, canUpdate, contract }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [claimType, setClaimType] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filteredClaims = useMemo(() => {
    const q = search.trim().toLowerCase();
    return claims.filter((c) => {
      if (q && !c.claimTitle.toLowerCase().includes(q) && !(c.claimNo?.toLowerCase().includes(q) ?? false)) return false;
      if (status && c.status !== status) return false;
      if (claimType && c.claimType !== claimType) return false;
      if (responsibleUserId && c.responsibleUserId !== responsibleUserId) return false;
      if (dueDateFrom && (!c.dueDate || c.dueDate < dueDateFrom)) return false;
      if (dueDateTo && (!c.dueDate || c.dueDate > dueDateTo)) return false;
      if (overdueOnly && !c.isOverdue) return false;
      return true;
    });
  }, [claims, search, status, claimType, responsibleUserId, dueDateFrom, dueDateTo, overdueOnly]);

  function handleCloseOrSettle(claimId: string, targetStatus: 'CLOSED' | 'SETTLED'): void {
    const verb = targetStatus === 'SETTLED' ? 'Settle' : 'Close';
    if (!window.confirm(`${verb} this claim? This keeps it in the register but marks it ${targetStatus === 'SETTLED' ? 'Settled' : 'Closed'}.`)) return;
    setClosingId(claimId);
    startTransition(async () => {
      await closeClaimAction(claimId, contractId, targetStatus);
      setClosingId(null);
      router.refresh();
    });
  }

  const exportUrl = `/contracts/claims/export?contractId=${contractId}`;

  return (
    <>
      <section className="rounded-lg border border-border bg-surface shadow-sm p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Claim ID, Title, Intake ID…"
              aria-label="Search by Claim ID, Title, Intake ID"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Claim Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Claim Status" className={`${inputCls} w-auto min-w-32`}>
              {CLAIM_STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Claim Type</span>
            <select value={claimType} onChange={(e) => setClaimType(e.target.value)} aria-label="Claim Type" className={`${inputCls} w-auto min-w-32`}>
              {CLAIM_TYPE_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Responsible Person</span>
            <select value={responsibleUserId} onChange={(e) => setResponsibleUserId(e.target.value)} aria-label="Responsible Person" className={`${inputCls} w-auto min-w-32`}>
              <option value="">All</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Due Date</span>
            <div className="flex items-center gap-1.5">
              <input type="date" value={dueDateFrom} onChange={(e) => setDueDateFrom(e.target.value)} aria-label="Due date from" className={inputCls} />
              <span className="text-text-muted">–</span>
              <input type="date" value={dueDateTo} onChange={(e) => setDueDateTo(e.target.value)} aria-label="Due date to" className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="rounded border-border text-accent focus:ring-accent"
            />
            Overdue Only
          </label>

          <div className="flex items-center gap-2 ml-auto">
            <a
              href={exportUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-primary hover:border-border-strong hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
              title="Export this contract's claims as CSV (opens in Excel)"
            >
              <Download className="size-3.5 shrink-0" aria-hidden="true" />
              Export Excel
            </a>
            {canUpdate && (
              <button
                type="button"
                onClick={() => setModal({ mode: 'add' })}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
              >
                Add Claim
              </button>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Claims</h2>
        {claims.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-12 text-center">
            <FileSearch className="size-6 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-text-secondary mt-1">No claims recorded yet.</p>
            <p className="text-xs text-text-muted">Add a claim when there is a delay, EOT, payment issue, or contractual dispute.</p>
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-6">
            <FileSearch className="size-4 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No claims match the current search/filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
            <table className="w-full min-w-[1800px] divide-y divide-border text-xs">
              <thead className="border-b-2 border-border-strong">
                <tr className="bg-surface-secondary">
                  {TABLE_COLUMNS.map((col, index) => {
                    const stickyCls = index === 0 ? STICKY_LEFT_HEADER_CLS : index === TABLE_COLUMNS.length - 1 ? STICKY_RIGHT_HEADER_CLS : '';
                    return (
                      <th key={col} className={`px-3 py-2.5 text-left font-bold uppercase tracking-wide text-text-primary whitespace-nowrap ${stickyCls}`}>
                        {col}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {filteredClaims.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className={`px-3 py-2 whitespace-nowrap font-medium text-text-primary ${STICKY_LEFT_CLS}`}>{c.claimNo || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-text-muted">—</td>
                    <td className="px-3 py-2 max-w-60 truncate" title={c.claimTitle}>{c.claimTitle}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><ContractClaimTypeBadge claimType={c.claimType} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.eventDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.claimDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><ClaimStatusBadge status={c.status} /></td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{formatContractValue(c.submittedValue, undefined)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums text-success font-medium">{formatContractValue(c.approvedValue, undefined)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums font-medium">{formatContractValue(c.outstandingValue ?? undefined, undefined)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{c.eotClaimedDays ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{c.eotApprovedDays ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{c.responsibleUser?.displayName ?? '—'}</td>
                    <td className="px-3 py-2 max-w-40 truncate" title={c.nextAction}>{c.nextAction || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.dueDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">
                      {c.daysToDeadline !== null ? (
                        <span className={c.daysToDeadline < 0 ? 'text-error font-medium' : 'text-success font-medium'}>
                          {formatDaysToDeadline(c.daysToDeadline)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.updatedAt)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${STICKY_RIGHT_CLS}`}>
                      {canUpdate && !TERMINAL_STATUSES.includes(c.status) ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'edit', claim: c })}
                            className="text-text-muted hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus rounded"
                            title="Edit Claim"
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCloseOrSettle(c.id, 'SETTLED')}
                            disabled={isPending && closingId === c.id}
                            className="text-text-muted hover:text-success focus:outline-none focus:ring-2 focus:ring-focus rounded disabled:opacity-50"
                            title="Settle Claim"
                          >
                            <HandCoins className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCloseOrSettle(c.id, 'CLOSED')}
                            disabled={isPending && closingId === c.id}
                            className="text-text-muted hover:text-success focus:outline-none focus:ring-2 focus:ring-focus rounded disabled:opacity-50"
                            title="Close Claim"
                          >
                            <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal?.mode === 'add' && (
        <ClaimFormModal
          mode="add"
          fixedContractId={contractId}
          {...(contract ? { fixedContract: contract } : {})}
          people={people}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === 'edit' && (
        <ClaimFormModal mode="edit" claim={modal.claim} people={people} onClose={() => setModal(null)} />
      )}
    </>
  );
}
