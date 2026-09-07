'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, CheckCircle2, HandCoins } from 'lucide-react';
import type { ContractClaim, ContractPerson } from '@/lib/contracts-api';
import { closeClaimAction } from '../../actions';
import { ClaimStatusBadge } from './claim-status-badge';
import { ClaimTypeBadge } from './claim-type-badge';
import { ClaimFormModal } from './claim-form-modal';
import { formatContractValue } from '../../_lib/contract-ui-helpers';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  claims: ContractClaim[];
  contracts: ContractOption[];
  people: ContractPerson[];
  canUpdate: boolean;
  /** When set, Add Claim always creates for this one contract — no contract selector, and the Contract columns are hidden (used by the per-contract tab). */
  fixedContractId?: string;
}

type ModalState = { mode: 'add' } | { mode: 'edit'; claim: ContractClaim } | null;

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Terminal claim statuses — no further Close/Settle/Edit action makes sense once reached. Mirrors the backend's OVERDUE_EXCLUDED_STATUSES (APPROVED deliberately excluded — an approved claim can still be edited or settled/closed). */
const TERMINAL_STATUSES = ['CLOSED', 'SETTLED', 'CANCELLED', 'REJECTED'];

export function ClaimRegisterTable({ claims, contracts, people, canUpdate, fixedContractId }: Props): React.JSX.Element {
  const [modal, setModal] = useState<ModalState>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const compact = Boolean(fixedContractId);

  function handleCloseOrSettle(claimId: string, contractId: string, targetStatus: 'CLOSED' | 'SETTLED'): void {
    const verb = targetStatus === 'SETTLED' ? 'Settle' : 'Close';
    if (!window.confirm(`${verb} this claim? This keeps it in the register but marks it ${targetStatus === 'SETTLED' ? 'Settled' : 'Closed'}.`)) return;
    setClosingId(claimId);
    startTransition(async () => {
      await closeClaimAction(claimId, contractId, targetStatus);
      setClosingId(null);
      router.refresh();
    });
  }

  const columns = compact
    ? ['Claim No', 'Claim Title', 'Claim Type', 'Submitted Value', 'Approved Value', 'Outstanding Value', 'EOT Claimed', 'EOT Approved', 'Responsible', 'Next Action', 'Due Date', 'Overdue Days', 'Status', 'Action']
    : ['Claim No', 'Contract ID', 'Contract Name', 'Company / Client', 'Claim Title', 'Claim Type', 'Submitted Value', 'Approved Value', 'Outstanding Value', 'EOT Claimed', 'EOT Approved', 'Responsible', 'Next Action', 'Due Date', 'Overdue Days', 'Status', 'Action'];

  return (
    <div>
      {canUpdate && (
        <div className="flex items-center justify-end mb-3 print:hidden">
          <button
            type="button"
            onClick={() => setModal({ mode: 'add' })}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            Add Claim
          </button>
        </div>
      )}

      {claims.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <p className="text-sm text-text-secondary">No claims recorded yet.</p>
          <p className="text-sm text-text-muted mt-1">Add the first claim from a contract or from this register.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className={`w-full ${compact ? 'min-w-[1500px]' : 'min-w-[2000px]'} divide-y divide-border text-xs`}>
            <thead className="border-b-2 border-border-strong">
              <tr className="bg-surface-secondary">
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {claims.map((claim) => (
                <tr key={claim.id}>
                  <td className="px-3 py-2 font-medium text-text-primary whitespace-nowrap">{claim.claimNo || '—'}</td>
                  {!compact && (
                    <>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={`/contracts/${claim.contract.id}`} className="font-mono text-accent hover:underline">
                          {claim.contract.referenceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 max-w-[180px] truncate" title={claim.contract.title}>{claim.contract.title}</td>
                      <td className="px-3 py-2 max-w-[150px] truncate" title={claim.contract.counterpartyName}>{claim.contract.counterpartyName}</td>
                    </>
                  )}
                  <td className="px-3 py-2 max-w-[220px] truncate" title={claim.claimTitle}>{claim.claimTitle}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><ClaimTypeBadge claimType={claim.claimType} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatContractValue(claim.submittedValue, claim.contract.currency ?? 'KWD')}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatContractValue(claim.approvedValue, claim.contract.currency ?? 'KWD')}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatContractValue(claim.outstandingValue ?? undefined, claim.contract.currency ?? 'KWD')}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{claim.eotClaimedDays ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{claim.eotApprovedDays ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{claim.responsibleUser?.displayName ?? '—'}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={claim.nextAction}>{claim.nextAction || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(claim.dueDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {claim.overdueDays !== null ? (
                      <span className="text-error font-medium">{claim.overdueDays}d</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap"><ClaimStatusBadge status={claim.status} /></td>
                  <td className="px-3 py-2 whitespace-nowrap print:hidden">
                    <div className="flex items-center gap-2">
                      {!compact && (
                        <Link href={`/contracts/${claim.contract.id}`} className="text-text-muted hover:text-text-primary" title="View Contract">
                          View
                        </Link>
                      )}
                      {canUpdate && !TERMINAL_STATUSES.includes(claim.status) && (
                        <>
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'edit', claim })}
                            className="text-text-muted hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus rounded"
                            title="Edit Claim"
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCloseOrSettle(claim.id, claim.contractId, 'SETTLED')}
                            disabled={isPending && closingId === claim.id}
                            className="text-text-muted hover:text-success focus:outline-none focus:ring-2 focus:ring-focus rounded disabled:opacity-50"
                            title="Settle Claim"
                          >
                            <HandCoins className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCloseOrSettle(claim.id, claim.contractId, 'CLOSED')}
                            disabled={isPending && closingId === claim.id}
                            className="text-text-muted hover:text-success focus:outline-none focus:ring-2 focus:ring-focus rounded disabled:opacity-50"
                            title="Close Claim"
                          >
                            <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.mode === 'add' && (
        <ClaimFormModal
          mode="add"
          contracts={contracts}
          {...(fixedContractId !== undefined ? { fixedContractId } : {})}
          people={people}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === 'edit' && (
        <ClaimFormModal mode="edit" claim={modal.claim} people={people} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
