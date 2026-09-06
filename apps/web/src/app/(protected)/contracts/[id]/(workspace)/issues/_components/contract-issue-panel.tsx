'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, PencilLine, CheckCircle2, FileSearch } from 'lucide-react';
import type { ContractIssue, ContractPerson } from '@/lib/contracts-api';
import { ContractIssueCategoryBadge } from './contract-issue-category-badge';
import { ContractIssuePriorityBadge } from './contract-issue-priority-badge';
import { ContractIssueStatusBadge } from './contract-issue-status-badge';
import { IssueFormModal } from '../../../../issues/_components/issue-form-modal';
import { closeIssueAction } from '../../../../actions';
import {
  ISSUE_CATEGORY_FILTER_OPTIONS,
  ISSUE_PRIORITY_FILTER_OPTIONS,
  ISSUE_STATUS_FILTER_OPTIONS,
  computeIssueDaysRemaining,
  formatIssueDaysRemaining,
} from '../../../../_lib/contract-issue-detail-helpers';

interface IssuePanelContractContext {
  referenceNumber: string;
  title: string;
  counterpartyName?: string;
}

interface Props {
  contractId: string;
  issues: ContractIssue[];
  people: ContractPerson[];
  canUpdate: boolean;
  /** CM-70D — readable contract identity for the Add Issue modal, so it never falls back to displaying the raw contract UUID. */
  contract?: IssuePanelContractContext;
}

type ModalState = { mode: 'add' } | { mode: 'edit'; issue: ContractIssue } | null;

/** Terminal statuses — no further Edit/Close action makes sense once reached; mirrors IssueRegisterTable's own CLOSED_LIKE. */
const TERMINAL_STATUSES = ['CLOSED', 'RESOLVED', 'CANCELLED'];

const inputCls =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const filterLabelCls = 'text-[11px] font-medium text-text-muted uppercase tracking-wide';

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TABLE_COLUMNS = [
  'Issue ID', 'Issue Title', 'Category', 'Priority', 'Raised By', 'Raised Date',
  'Responsible Person', 'Action Due Date', 'Status', 'Action',
];

// CM-65 — Issue ID (first) and Action (last) columns pinned, reusing the
// established sticky-column pattern (contract-claim-panel.tsx / Attachments
// tab's contract-attachment-panel.tsx / Contract List's own
// contract-list-table.tsx).
const STICKY_LEFT_HEADER_CLS = 'sticky left-0 z-10 bg-surface-secondary border-r border-border';
const STICKY_RIGHT_HEADER_CLS = 'sticky right-0 z-10 bg-surface-secondary border-l border-border';
const STICKY_LEFT_CLS = 'sticky left-0 z-10 bg-surface border-r border-border';
const STICKY_RIGHT_CLS = 'sticky right-0 z-10 bg-surface border-l border-border';

/**
 * CM-65 — Issue Log search/filter row + table + Add/Edit modal trigger, all
 * in one client component. Same bounded, contract-scoped, client-side-
 * filtered pattern established for Claims/Risk/Documents & Obligations — a
 * contract's issue list is fetched in full server-side (pageSize 100), so
 * search/category/status/priority/responsible/date/overdue filtering
 * happens instantly with no round trip. Reuses the real IssueFormModal/
 * closeIssueAction from the module-level Issue Log (../../../issues/_components/)
 * completely unmodified — same Add/Edit fields, same server actions, same
 * contracts.update gate; only the display layer (KPI strip, category/
 * priority/status badges, column set, "Action Due Date" wording) is
 * contract-scoped-specific. "Raised By" is the real createdByUser on every
 * issue (set from the actual authenticated actor on create) — never
 * fabricated. The reused modal's own internal field is still labeled "Due
 * Date" (left unmodified, since it's shared with the module-level Issue
 * Register) — this tab's own table column/filter/KPI wording is "Action
 * Due Date", same underlying dueDate field, display wording only.
 */
export function ContractIssuePanel({ contractId, issues, people, canUpdate, contract }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (q && !issue.title.toLowerCase().includes(q) && !(issue.issueNo?.toLowerCase().includes(q) ?? false)) return false;
      if (category && issue.category !== category) return false;
      if (status && issue.status !== status) return false;
      if (priority && issue.priority !== priority) return false;
      if (responsibleUserId && issue.responsibleUserId !== responsibleUserId) return false;
      if (dueDateFrom && (!issue.dueDate || issue.dueDate < dueDateFrom)) return false;
      if (dueDateTo && (!issue.dueDate || issue.dueDate > dueDateTo)) return false;
      if (overdueOnly && !issue.isOverdue) return false;
      return true;
    });
  }, [issues, search, category, status, priority, responsibleUserId, dueDateFrom, dueDateTo, overdueOnly]);

  function handleClose(issueId: string): void {
    if (!window.confirm('Close this issue? This keeps it in the log but marks it Closed.')) return;
    setClosingId(issueId);
    startTransition(async () => {
      await closeIssueAction(issueId, contractId);
      setClosingId(null);
      router.refresh();
    });
  }

  const exportUrl = `/contracts/issues/export?contractId=${contractId}`;

  return (
    <>
      <section className="rounded-lg border border-border bg-surface shadow-sm p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by issue ID or title…"
              aria-label="Search by issue ID or title"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={`${inputCls} w-auto min-w-36`}>
              {ISSUE_CATEGORY_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={`${inputCls} w-auto min-w-32`}>
              {ISSUE_STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority" className={`${inputCls} w-auto min-w-32`}>
              {ISSUE_PRIORITY_FILTER_OPTIONS.map((o) => (
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
            <span className={filterLabelCls}>Action Due Date</span>
            <div className="flex items-center gap-1.5">
              <input type="date" value={dueDateFrom} onChange={(e) => setDueDateFrom(e.target.value)} aria-label="Action due date from" className={inputCls} />
              <span className="text-text-muted">–</span>
              <input type="date" value={dueDateTo} onChange={(e) => setDueDateTo(e.target.value)} aria-label="Action due date to" className={inputCls} />
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
              title="Export this contract's issues as CSV (opens in Excel)"
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
                Raise New Issue
              </button>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Issue Log</h2>
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-12 text-center">
            <FileSearch className="size-6 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-text-secondary mt-1">No issues recorded yet.</p>
            <p className="text-xs text-text-muted">Raise an issue when there is a payment, document, delivery, technical, site, quality, or approval problem.</p>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-6">
            <FileSearch className="size-4 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No issues match the current search/filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
            <table className="w-full min-w-350 divide-y divide-border text-xs">
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
                {filteredIssues.map((issue) => {
                  const daysRemaining = computeIssueDaysRemaining(issue.dueDate);
                  return (
                    <tr key={issue.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className={`px-3 py-2 whitespace-nowrap font-medium text-text-primary ${STICKY_LEFT_CLS}`}>{issue.issueNo || '—'}</td>
                      <td className="px-3 py-2 max-w-64 truncate" title={issue.title}>{issue.title}</td>
                      <td className="px-3 py-2 whitespace-nowrap"><ContractIssueCategoryBadge category={issue.category} /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><ContractIssuePriorityBadge priority={issue.priority} /></td>
                      <td className="px-3 py-2 whitespace-nowrap">{issue.createdByUser.displayName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(issue.raisedDate)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{issue.responsibleUser?.displayName ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {issue.dueDate ? (
                          <div className="flex items-center gap-1.5">
                            <span>{formatDate(issue.dueDate)}</span>
                            <span
                              className={
                                daysRemaining !== null && daysRemaining < 0
                                  ? 'text-error font-medium'
                                  : daysRemaining !== null && daysRemaining <= 30
                                    ? 'text-warning font-medium'
                                    : 'text-success font-medium'
                              }
                            >
                              ({formatIssueDaysRemaining(daysRemaining)}d)
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap"><ContractIssueStatusBadge status={issue.status} /></td>
                      <td className={`px-3 py-2 whitespace-nowrap ${STICKY_RIGHT_CLS}`}>
                        {canUpdate && !TERMINAL_STATUSES.includes(issue.status) ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setModal({ mode: 'edit', issue })}
                              className="text-text-muted hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus rounded"
                              title="Edit Issue"
                            >
                              <PencilLine className="size-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleClose(issue.id)}
                              disabled={isPending && closingId === issue.id}
                              className="text-text-muted hover:text-success focus:outline-none focus:ring-2 focus:ring-focus rounded disabled:opacity-50"
                              title="Close Issue"
                            >
                              <CheckCircle2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal?.mode === 'add' && (
        <IssueFormModal
          mode="add"
          fixedContractId={contractId}
          {...(contract ? { fixedContract: contract } : {})}
          people={people}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === 'edit' && (
        <IssueFormModal mode="edit" issue={modal.issue} people={people} onClose={() => setModal(null)} />
      )}
    </>
  );
}
