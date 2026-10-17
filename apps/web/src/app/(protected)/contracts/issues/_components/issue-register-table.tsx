'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, CheckCircle2 } from 'lucide-react';
import type { ContractIssue, ContractPerson } from '@/lib/contracts-api';
import { closeIssueAction } from '../../actions';
import { overdueLabel } from '../_lib/issue-register-helpers';
import { IssueStatusBadge } from './issue-status-badge';
import { IssuePriorityBadge } from './issue-priority-badge';
import { IssueFormModal } from './issue-form-modal';
import { IssueDetailModal } from './issue-detail-modal';

interface Props {
  issues: ContractIssue[];
  people: ContractPerson[];
  canUpdate: boolean;
}

type ModalState = { mode: 'view'; issue: ContractIssue } | { mode: 'edit'; issue: ContractIssue } | null;

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const CLOSED_LIKE = ['CLOSED', 'RESOLVED', 'CANCELLED'];

const openBtn =
  'inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus';

function ResponsibleCell({ issue }: { issue: ContractIssue }): React.JSX.Element {
  const overdue = overdueLabel(issue.overdueDays);
  return (
    <div>
      <p className="text-text-primary break-words">{issue.responsibleUser?.displayName ?? '—'}</p>
      <p className="text-xs text-text-secondary">Due {formatDate(issue.dueDate)}</p>
      {overdue && <p className="text-xs font-medium text-error">{overdue}</p>}
    </div>
  );
}

export function IssueRegisterTable({ issues, people, canUpdate }: Props): React.JSX.Element {
  const [modal, setModal] = useState<ModalState>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClose(issueId: string, contractId: string): void {
    if (!window.confirm('Close this issue? This keeps it in the register but marks it Closed.')) return;
    setClosingId(issueId);
    startTransition(async () => {
      await closeIssueAction(issueId, contractId);
      setClosingId(null);
      router.refresh();
    });
  }

  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No issues match these filters.</p>
        <p className="text-sm text-text-muted mt-1">Clear the filters, or add an issue with the Add Issue button.</p>
      </div>
    );
  }

  const openButton = (issue: ContractIssue): React.JSX.Element => (
    <button
      type="button"
      onClick={() => setModal({ mode: 'view', issue })}
      className={openBtn}
      aria-label={`Open issue ${issue.issueNo || issue.title}`}
    >
      <Eye className="size-4" aria-hidden="true" />
      Open Issue
    </button>
  );

  const closeButton = (issue: ContractIssue): React.JSX.Element | null =>
    canUpdate && !CLOSED_LIKE.includes(issue.status) ? (
      <button
        type="button"
        onClick={() => handleClose(issue.id, issue.contractId)}
        disabled={isPending && closingId === issue.id}
        className="inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-success-light hover:text-success focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
        title="Close Issue"
        aria-label="Close issue"
      >
        <CheckCircle2 className="size-4" aria-hidden="true" />
      </button>
    ) : null;

  return (
    <div>
      {/* Desktop / tablet-landscape: compact six-column table. */}
      <div className="hidden md:block rounded-lg border border-border bg-surface print:hidden">
        <table className="w-full table-fixed divide-y divide-border text-sm">
          <colgroup>
            <col className="w-[27%]" />
            <col className="w-[22%]" />
            <col className="w-[18%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead className="border-b-2 border-border-strong bg-surface-secondary">
            <tr>
              {['Issue', 'Project / Contract', 'Responsible / Due Date', 'Priority', 'Status'].map((c) => (
                <th key={c} scope="col" className="px-3 py-3 text-left font-semibold text-text-secondary">{c}</th>
              ))}
              <th scope="col" className="px-3 py-3 text-right font-semibold text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {issues.map((issue) => (
              <tr key={issue.id} className="align-top">
                <td className="px-3 py-3">
                  <p className="font-medium text-text-primary break-words line-clamp-2" title={issue.title}>{issue.title}</p>
                  <p className="text-xs text-text-secondary">{issue.issueNo || '—'}</p>
                </td>
                <td className="px-3 py-3">
                  <Link href={`/contracts/${issue.contract.id}`} className="font-medium text-accent hover:underline break-words line-clamp-2" title={issue.contract.title}>
                    {issue.contract.title}
                  </Link>
                  <p className="text-xs text-text-secondary font-mono">{issue.contract.referenceNumber}</p>
                </td>
                <td className="px-3 py-3"><ResponsibleCell issue={issue} /></td>
                <td className="px-3 py-3"><IssuePriorityBadge priority={issue.priority} /></td>
                <td className="px-3 py-3"><IssueStatusBadge status={issue.status} /></td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {openButton(issue)}
                    {closeButton(issue)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per issue. */}
      <ul className="md:hidden space-y-3 print:hidden">
        {issues.map((issue) => (
          <li key={issue.id} className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div>
              <p className="font-medium text-text-primary break-words">{issue.title}</p>
              <p className="text-xs text-text-secondary">{issue.issueNo || '—'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <IssueStatusBadge status={issue.status} />
              <IssuePriorityBadge priority={issue.priority} />
            </div>
            <div className="text-sm">
              <Link href={`/contracts/${issue.contract.id}`} className="font-medium text-accent hover:underline break-words">
                {issue.contract.title}
              </Link>
              <p className="text-xs text-text-secondary font-mono">{issue.contract.referenceNumber}</p>
            </div>
            <ResponsibleCell issue={issue} />
            <div className="flex items-center justify-end gap-1">
              {openButton(issue)}
              {closeButton(issue)}
            </div>
          </li>
        ))}
      </ul>

      {/* Print: the complete original register columns. */}
      <table className="hidden print:table w-full text-[10px] border-collapse">
        <thead>
          <tr>
            {[
              'Issue No', 'Contract ID', 'Contract Name', 'Company / Client', 'Issue Title', 'Category', 'Priority',
              'Responsible', 'Raised Date', 'Due Date', 'Overdue Days', 'Status',
            ].map((c) => (
              <th key={c} className="border border-border px-1.5 py-1 text-left font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td className="border border-border px-1.5 py-1">{issue.issueNo || '—'}</td>
              <td className="border border-border px-1.5 py-1">{issue.contract.referenceNumber}</td>
              <td className="border border-border px-1.5 py-1">{issue.contract.title}</td>
              <td className="border border-border px-1.5 py-1">{issue.contract.counterpartyName}</td>
              <td className="border border-border px-1.5 py-1">{issue.title}</td>
              <td className="border border-border px-1.5 py-1">{issue.category || '—'}</td>
              <td className="border border-border px-1.5 py-1">{issue.priority}</td>
              <td className="border border-border px-1.5 py-1">{issue.responsibleUser?.displayName ?? '—'}</td>
              <td className="border border-border px-1.5 py-1">{formatDate(issue.raisedDate)}</td>
              <td className="border border-border px-1.5 py-1">{formatDate(issue.dueDate)}</td>
              <td className="border border-border px-1.5 py-1">{issue.overdueDays !== null ? `${issue.overdueDays}d` : '—'}</td>
              <td className="border border-border px-1.5 py-1">{issue.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal?.mode === 'view' && (
        <IssueDetailModal
          issue={modal.issue}
          canEdit={canUpdate && !CLOSED_LIKE.includes(modal.issue.status)}
          onEdit={() => setModal({ mode: 'edit', issue: modal.issue })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === 'edit' && (
        <IssueFormModal mode="edit" issue={modal.issue} people={people} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
