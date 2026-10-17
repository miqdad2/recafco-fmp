'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Pencil, ExternalLink } from 'lucide-react';
import type { ContractIssue } from '@/lib/contracts-api';
import { overdueLabel } from '../_lib/issue-register-helpers';
import { IssueStatusBadge } from './issue-status-badge';
import { IssuePriorityBadge } from './issue-priority-badge';

interface Props {
  issue: ContractIssue;
  /** Existing edit permission AND a non-terminal status — the Edit button is hidden otherwise. */
  canEdit: boolean;
  onEdit: () => void;
  onClose: () => void;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs font-medium text-text-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm text-text-primary break-words">{children}</dd>
    </div>
  );
}

function Text({ value }: { value: string | undefined }): React.JSX.Element {
  return value ? <span className="whitespace-pre-wrap">{value}</span> : <>—</>;
}

export function IssueDetailModal({ issue: i, canEdit, onEdit, onClose }: Props): React.JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const overdue = overdueLabel(i.overdueDays);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8 print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="issue-detail-title" className="w-full max-w-3xl rounded-lg border border-border bg-surface shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-secondary">Issue {i.issueNo || '—'}</p>
            <h2 id="issue-detail-title" className="text-lg font-semibold text-text-primary break-words">{i.title}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <IssueStatusBadge status={i.status} />
              <IssuePriorityBadge priority={i.priority} />
              {overdue && <span className="text-xs font-medium text-error">{overdue}</span>}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close issue details"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div className="sm:col-span-2">
              <Field label="Description"><Text value={i.description} /></Field>
            </div>
            <Field label="Contract / Project">
              <Link href={`/contracts/${i.contract.id}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                <span className="font-mono">{i.contract.referenceNumber}</span>
                <ExternalLink className="size-3" aria-hidden="true" />
              </Link>
              <span className="block">{i.contract.title}</span>
            </Field>
            <Field label="Client">{i.contract.counterpartyName || '—'}</Field>
            <Field label="Category">{i.category || '—'}</Field>
            <Field label="Department">{i.contract.department?.name ?? '—'}</Field>
            <Field label="Responsible Person">{i.responsibleUser?.displayName ?? '—'}</Field>
            <Field label="Contract Manager">{i.contract.ownerUser.displayName || '—'}</Field>
            <Field label="Raised Date">{formatDate(i.raisedDate)}</Field>
            <Field label="Due Date">{formatDate(i.dueDate)}</Field>
            <Field label="Closed Date">{formatDate(i.closedDate)}</Field>
            <Field label="Overdue">{overdue ?? '—'}</Field>
            <div className="sm:col-span-2">
              <Field label="Resolution"><Text value={i.resolution} /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Remarks"><Text value={i.remarks} /></Field>
            </div>
          </dl>

          <div className="rounded-md border border-border px-3 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Record history</h3>
            <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Field label="Created">{i.createdByUser.displayName} · {formatDateTime(i.createdAt)}</Field>
              <Field label="Last updated">
                {i.updatedByUser ? `${i.updatedByUser.displayName} · ` : ''}
                {formatDateTime(i.updatedAt)}
              </Field>
            </dl>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Link
            href={`/contracts/${i.contract.id}/issues`}
            className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            View contract issues
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit Issue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
