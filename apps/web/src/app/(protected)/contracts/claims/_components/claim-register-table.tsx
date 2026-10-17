'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';
import type { ContractClaim, ContractPerson } from '@/lib/contracts-api';
import { closeClaimAction } from '../../actions';
import { formatContractValue } from '../../_lib/contract-ui-helpers';
import { claimAmountCell, formatDays, overdueLabel } from '../_lib/claim-register-helpers';
import { ClaimStatusBadge } from './claim-status-badge';
import { ClaimTypeBadge } from './claim-type-badge';
import { ClaimFormModal } from './claim-form-modal';
import { ClaimDetailModal } from './claim-detail-modal';

interface Props {
  claims: ContractClaim[];
  people: ContractPerson[];
  canUpdate: boolean;
}

type ModalState = { mode: 'view'; claim: ContractClaim } | { mode: 'edit'; claim: ContractClaim } | null;

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Terminal claim statuses — no further Close/Settle/Edit action makes sense once reached. Mirrors the backend's OVERDUE_EXCLUDED_STATUSES (APPROVED deliberately excluded — an approved claim can still be edited or settled/closed). */
const TERMINAL_STATUSES = ['CLOSED', 'SETTLED', 'CANCELLED', 'REJECTED'];

const openBtn =
  'inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus';

/** One figure per cell: KWD for money claims, days for Extension of Time — never mixed. */
function AmountText({ claim, which }: { claim: ContractClaim; which: 'claimed' | 'approved' }): React.JSX.Element {
  const cell = claimAmountCell(claim);
  const raw = which === 'claimed' ? cell.claimed : cell.approved;
  const extra = which === 'claimed' ? cell.extraDaysClaimed : cell.extraDaysApproved;
  if (cell.kind === 'days') {
    return <span>{raw === undefined ? '—' : formatDays(Number(raw))}</span>;
  }
  return (
    <>
      <span>{formatContractValue(raw, claim.contract.currency ?? 'KWD')}</span>
      {extra !== undefined && <span className="block text-xs text-text-secondary">+ {formatDays(extra)} EOT</span>}
    </>
  );
}

function StatusCell({ claim }: { claim: ContractClaim }): React.JSX.Element {
  const overdue = overdueLabel(claim.overdueDays);
  return (
    <div className="flex flex-col items-start gap-1">
      <ClaimStatusBadge status={claim.status} />
      <span className="text-xs text-text-secondary">Due {formatDate(claim.dueDate)}</span>
      {overdue && <span className="text-xs font-medium text-error">{overdue}</span>}
    </div>
  );
}

export function ClaimRegisterTable({ claims, people, canUpdate }: Props): React.JSX.Element {
  const [modal, setModal] = useState<ModalState>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCloseOrSettle(claim: ContractClaim, targetStatus: 'CLOSED' | 'SETTLED'): void {
    const verb = targetStatus === 'SETTLED' ? 'Settle' : 'Close';
    if (!window.confirm(`${verb} this claim? This keeps it in the register but marks it ${targetStatus === 'SETTLED' ? 'Settled' : 'Closed'}.`)) return;
    startTransition(async () => {
      await closeClaimAction(claim.id, claim.contractId, targetStatus);
      setModal(null);
      router.refresh();
    });
  }

  if (claims.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No claims match these filters.</p>
        <p className="text-sm text-text-muted mt-1">Clear the filters, or add a claim with the Add Claim button.</p>
      </div>
    );
  }

  const openButton = (claim: ContractClaim): React.JSX.Element => (
    <button
      type="button"
      onClick={() => setModal({ mode: 'view', claim })}
      className={openBtn}
      aria-label={`Open claim ${claim.claimNo || claim.claimTitle}`}
    >
      <Eye className="size-4" aria-hidden="true" />
      Open Claim
    </button>
  );

  return (
    <div>
      {/* Desktop / tablet-landscape: compact six-column table. */}
      <div className="hidden md:block rounded-lg border border-border bg-surface print:hidden">
        <table className="w-full table-fixed divide-y divide-border text-sm">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
            <col className="w-[15%]" />
          </colgroup>
          <thead className="border-b-2 border-border-strong bg-surface-secondary">
            <tr>
              <th scope="col" className="px-3 py-3 text-left font-semibold text-text-secondary">Claim / Project</th>
              <th scope="col" className="px-3 py-3 text-left font-semibold text-text-secondary">Claim Type</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold text-text-secondary">Claimed</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold text-text-secondary">Approved</th>
              <th scope="col" className="px-3 py-3 text-left font-semibold text-text-secondary">Status / Due Date</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {claims.map((claim) => (
              <tr key={claim.id} className="align-top">
                <td className="px-3 py-3">
                  <p className="font-medium text-text-primary break-words line-clamp-2" title={claim.claimTitle}>{claim.claimTitle}</p>
                  <p className="text-xs text-text-secondary">{claim.claimNo || '—'}</p>
                  <Link href={`/contracts/${claim.contract.id}`} className="text-xs text-accent hover:underline break-words line-clamp-1" title={claim.contract.title}>
                    {claim.contract.title}
                  </Link>
                </td>
                <td className="px-3 py-3"><ClaimTypeBadge claimType={claim.claimType} /></td>
                <td className="px-3 py-3 text-right tabular-nums"><AmountText claim={claim} which="claimed" /></td>
                <td className="px-3 py-3 text-right tabular-nums"><AmountText claim={claim} which="approved" /></td>
                <td className="px-3 py-3"><StatusCell claim={claim} /></td>
                <td className="px-3 py-3"><div className="flex justify-end">{openButton(claim)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per claim. */}
      <ul className="md:hidden space-y-3 print:hidden">
        {claims.map((claim) => (
          <li key={claim.id} className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div>
              <p className="font-medium text-text-primary break-words">{claim.claimTitle}</p>
              <p className="text-xs text-text-secondary">{claim.claimNo || '—'}</p>
              <Link href={`/contracts/${claim.contract.id}`} className="text-sm text-accent hover:underline break-words">
                {claim.contract.title}
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ClaimTypeBadge claimType={claim.claimType} />
              <StatusCell claim={claim} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-right">
              <div><dt className="text-xs text-text-secondary">Claimed</dt><dd className="text-sm tabular-nums"><AmountText claim={claim} which="claimed" /></dd></div>
              <div><dt className="text-xs text-text-secondary">Approved</dt><dd className="text-sm tabular-nums"><AmountText claim={claim} which="approved" /></dd></div>
            </dl>
            <div className="flex justify-end">{openButton(claim)}</div>
          </li>
        ))}
      </ul>

      {/* Print: the complete original register columns. */}
      <table className="hidden print:table w-full text-[9px] border-collapse">
        <thead>
          <tr>
            {[
              'Claim No', 'Contract ID', 'Contract Name', 'Company / Client', 'Claim Title', 'Claim Type', 'Submitted Value',
              'Approved Value', 'Outstanding Value', 'EOT Claimed', 'EOT Approved', 'Responsible', 'Next Action', 'Due Date',
              'Overdue Days', 'Status',
            ].map((c) => (
              <th key={c} className="border border-border px-1 py-1 text-left font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => {
            const cur = claim.contract.currency ?? 'KWD';
            return (
              <tr key={claim.id}>
                <td className="border border-border px-1 py-1">{claim.claimNo || '—'}</td>
                <td className="border border-border px-1 py-1">{claim.contract.referenceNumber}</td>
                <td className="border border-border px-1 py-1">{claim.contract.title}</td>
                <td className="border border-border px-1 py-1">{claim.contract.counterpartyName}</td>
                <td className="border border-border px-1 py-1">{claim.claimTitle}</td>
                <td className="border border-border px-1 py-1">{claim.claimType}</td>
                <td className="border border-border px-1 py-1 text-right">{formatContractValue(claim.submittedValue, cur)}</td>
                <td className="border border-border px-1 py-1 text-right">{formatContractValue(claim.approvedValue, cur)}</td>
                <td className="border border-border px-1 py-1 text-right">{formatContractValue(claim.outstandingValue ?? undefined, cur)}</td>
                <td className="border border-border px-1 py-1">{claim.eotClaimedDays ?? '—'}</td>
                <td className="border border-border px-1 py-1">{claim.eotApprovedDays ?? '—'}</td>
                <td className="border border-border px-1 py-1">{claim.responsibleUser?.displayName ?? '—'}</td>
                <td className="border border-border px-1 py-1">{claim.nextAction || '—'}</td>
                <td className="border border-border px-1 py-1">{formatDate(claim.dueDate)}</td>
                <td className="border border-border px-1 py-1">{claim.overdueDays !== null ? `${claim.overdueDays}d` : '—'}</td>
                <td className="border border-border px-1 py-1">{claim.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {modal?.mode === 'view' && (
        <ClaimDetailModal
          claim={modal.claim}
          canAct={canUpdate && !TERMINAL_STATUSES.includes(modal.claim.status)}
          pending={isPending}
          onEdit={() => setModal({ mode: 'edit', claim: modal.claim })}
          onSettleOrClose={(target) => handleCloseOrSettle(modal.claim, target)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === 'edit' && (
        <ClaimFormModal mode="edit" claim={modal.claim} people={people} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
