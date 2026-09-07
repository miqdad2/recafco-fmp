'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, CheckCircle2 } from 'lucide-react';
import type { ContractIssue, ContractPerson } from '@/lib/contracts-api';
import { closeIssueAction } from '../../actions';
import { IssueStatusBadge } from './issue-status-badge';
import { IssuePriorityBadge } from './issue-priority-badge';
import { IssueFormModal } from './issue-form-modal';

interface ContractOption {
  id: string;
  referenceNumber: string;
  title: string;
}

interface Props {
  issues: ContractIssue[];
  contracts: ContractOption[];
  people: ContractPerson[];
  canUpdate: boolean;
  /** When set, Add Issue always creates for this one contract — no contract selector, and the Contract columns are hidden (used by the per-contract tab). */
  fixedContractId?: string;
}

type ModalState = { mode: 'add' } | { mode: 'edit'; issue: ContractIssue } | null;

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CLOSED_LIKE = ['CLOSED', 'RESOLVED', 'CANCELLED'];

export function IssueRegisterTable({ issues, contracts, people, canUpdate, fixedContractId }: Props): React.JSX.Element {
  const [modal, setModal] = useState<ModalState>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const compact = Boolean(fixedContractId);

  function handleClose(issueId: string, contractId: string): void {
    if (!window.confirm('Close this issue? This keeps it in the register but marks it Closed.')) return;
    setClosingId(issueId);
    startTransition(async () => {
      await closeIssueAction(issueId, contractId);
      setClosingId(null);
      router.refresh();
    });
  }

  const columns = compact
    ? ['Issue No', 'Issue Title', 'Category', 'Priority', 'Responsible', 'Raised Date', 'Due Date', 'Overdue Days', 'Status', 'Action']
    : ['Issue No', 'Contract ID', 'Contract Name', 'Company / Client', 'Issue Title', 'Category', 'Priority', 'Responsible', 'Raised Date', 'Due Date', 'Overdue Days', 'Status', 'Action'];

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
            Add Issue
          </button>
        </div>
      )}

      {issues.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <p className="text-sm text-text-secondary">No issues recorded yet.</p>
          <p className="text-sm text-text-muted mt-1">Add the first issue from a contract or from this register.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className={`w-full ${compact ? 'min-w-[1200px]' : 'min-w-[1700px]'} divide-y divide-border text-xs`}>
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
              {issues.map((issue) => (
                <tr key={issue.id}>
                  <td className="px-3 py-2 font-medium text-text-primary whitespace-nowrap">{issue.issueNo || '—'}</td>
                  {!compact && (
                    <>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={`/contracts/${issue.contract.id}`} className="font-mono text-accent hover:underline">
                          {issue.contract.referenceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 max-w-[180px] truncate" title={issue.contract.title}>{issue.contract.title}</td>
                      <td className="px-3 py-2 max-w-[150px] truncate" title={issue.contract.counterpartyName}>{issue.contract.counterpartyName}</td>
                    </>
                  )}
                  <td className="px-3 py-2 max-w-[220px] truncate" title={issue.title}>{issue.title}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{issue.category || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><IssuePriorityBadge priority={issue.priority} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{issue.responsibleUser?.displayName ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(issue.raisedDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(issue.dueDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {issue.overdueDays !== null ? (
                      <span className="text-error font-medium">{issue.overdueDays}d</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap"><IssueStatusBadge status={issue.status} /></td>
                  <td className="px-3 py-2 whitespace-nowrap print:hidden">
                    <div className="flex items-center gap-2">
                      {!compact && (
                        <Link href={`/contracts/${issue.contract.id}`} className="text-text-muted hover:text-text-primary" title="View Contract">
                          View
                        </Link>
                      )}
                      {canUpdate && !CLOSED_LIKE.includes(issue.status) && (
                        <>
                          <button
                            type="button"
                            onClick={() => setModal({ mode: 'edit', issue })}
                            className="text-text-muted hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus rounded"
                            title="Edit Issue"
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClose(issue.id, issue.contractId)}
                            disabled={isPending && closingId === issue.id}
                            className="text-text-muted hover:text-success focus:outline-none focus:ring-2 focus:ring-focus rounded disabled:opacity-50"
                            title="Close Issue"
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
        <IssueFormModal
          mode="add"
          contracts={contracts}
          {...(fixedContractId !== undefined ? { fixedContractId } : {})}
          people={people}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === 'edit' && (
        <IssueFormModal mode="edit" issue={modal.issue} people={people} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
