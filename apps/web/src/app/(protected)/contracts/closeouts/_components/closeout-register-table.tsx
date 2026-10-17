import Link from 'next/link';
import { Eye } from 'lucide-react';
import type { CloseoutListItem } from '@/lib/contracts-api';
import { CloseoutStatusBadge } from './closeout-status-badge';
import { formatContractValue } from '../../_lib/contract-ui-helpers';

interface Props {
  items: CloseoutListItem[];
  canClose: boolean;
  hasActiveFilters: boolean;
}

const PENDING_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** What the request's own page lets this user do — shown as the button's accessible name; the visible label is always "Open Request". Same permission/status rules as before. */
function reviewActionLabel(status: string, canClose: boolean): string {
  if (!canClose) return 'View';
  if (status === 'APPROVED') return 'Final Close';
  if (PENDING_STATUSES.includes(status)) return 'Review';
  return 'View';
}

const openBtn =
  'inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus';

export function CloseoutRegisterTable({ items, canClose, hasActiveFilters }: Props): React.JSX.Element {
  if (items.length === 0) {
    if (hasActiveFilters) {
      return (
        <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center">
          <h2 className="text-base font-semibold text-text-primary">No matching requests</h2>
          <p className="mt-1 text-sm text-text-secondary">Try changing your search or filters.</p>
          <Link
            href="/contracts/closeouts"
            className="mt-4 inline-flex h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-text-primary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus print:hidden"
          >
            Clear Filters
          </Link>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center">
        <h2 className="text-base font-semibold text-text-primary">No closeout requests yet</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Closeout requests will appear here after they are submitted from an individual contract.
        </p>
        <p className="mt-4 inline-block rounded-md bg-surface-secondary px-4 py-2 text-sm font-medium text-text-secondary">
          Contract List → Open Contract → Request Closeout
        </p>
      </div>
    );
  }

  const openLink = (item: CloseoutListItem): React.JSX.Element => (
    <Link
      href={item.actionUrl}
      className={openBtn}
      aria-label={`Open request ${item.requestNo} (${reviewActionLabel(item.status, canClose)})`}
      title="Open the contract's Closeout tab"
    >
      <Eye className="size-4" aria-hidden="true" />
      Open Request
    </Link>
  );

  return (
    <div>
      {/* Desktop / tablet-landscape: compact five-column table. */}
      <div className="hidden md:block rounded-lg border border-border bg-surface print:hidden">
        <table className="w-full table-fixed divide-y divide-border text-sm">
          <colgroup>
            <col className="w-[36%]" />
            <col className="w-[20%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="border-b-2 border-border-strong bg-surface-secondary">
            <tr>
              <th scope="col" className="px-3 py-3 text-left font-semibold text-text-secondary">Contract / Project</th>
              <th scope="col" className="px-3 py-3 text-left font-semibold text-text-secondary">Requested By</th>
              <th scope="col" className="px-3 py-3 text-left font-semibold text-text-secondary">Requested Date</th>
              <th scope="col" className="px-3 py-3 text-left font-semibold text-text-secondary">Status</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.requestId} className="align-top">
                <td className="px-3 py-3">
                  <Link href={`/contracts/${item.contractId}`} className="font-medium text-accent hover:underline break-words line-clamp-2" title={item.contractTitle}>
                    {item.contractTitle}
                  </Link>
                  <p className="text-xs text-text-secondary font-mono">{item.contractReference}</p>
                  <p className="text-xs text-text-muted">{item.requestNo} · {item.companyName}</p>
                </td>
                <td className="px-3 py-3 break-words">{item.requestedBy.displayName}</td>
                <td className="px-3 py-3">{formatDate(item.requestedAt)}</td>
                <td className="px-3 py-3"><CloseoutStatusBadge status={item.status} /></td>
                <td className="px-3 py-3"><div className="flex justify-end">{openLink(item)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per request. */}
      <ul className="md:hidden space-y-3 print:hidden">
        {items.map((item) => (
          <li key={item.requestId} className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/contracts/${item.contractId}`} className="font-medium text-accent hover:underline break-words">
                  {item.contractTitle}
                </Link>
                <p className="text-xs text-text-secondary font-mono">{item.contractReference}</p>
                <p className="text-xs text-text-muted">{item.requestNo} · {item.companyName}</p>
              </div>
              <CloseoutStatusBadge status={item.status} />
            </div>
            <p className="text-sm text-text-secondary">
              Requested by {item.requestedBy.displayName} on {formatDate(item.requestedAt)}
            </p>
            <div className="flex justify-end">{openLink(item)}</div>
          </li>
        ))}
      </ul>

      {/* Print: the complete original register columns. */}
      <table className="hidden print:table w-full text-[9px] border-collapse">
        <thead>
          <tr>
            {[
              'Request No', 'Contract ID', 'Contract Name', 'Company / Client', 'Requested By', 'Requested Date',
              'Status', 'Workflow Open', 'Issues Open', 'Claims Open', 'Outstanding Payment', 'Documents',
              'Reviewed By', 'Reviewed Date',
            ].map((c) => (
              <th key={c} className="border border-border px-1 py-1 text-left font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.requestId}>
              <td className="border border-border px-1 py-1">{item.requestNo}</td>
              <td className="border border-border px-1 py-1">{item.contractReference}</td>
              <td className="border border-border px-1 py-1">{item.contractTitle}</td>
              <td className="border border-border px-1 py-1">{item.companyName}</td>
              <td className="border border-border px-1 py-1">{item.requestedBy.displayName}</td>
              <td className="border border-border px-1 py-1">{formatDate(item.requestedAt)}</td>
              <td className="border border-border px-1 py-1">{item.status}</td>
              <td className="border border-border px-1 py-1">{item.riskSnapshot ? item.riskSnapshot.openWorkflowTasksCount : '—'}</td>
              <td className="border border-border px-1 py-1">{item.riskSnapshot ? item.riskSnapshot.openIssuesCount : '—'}</td>
              <td className="border border-border px-1 py-1">{item.riskSnapshot ? item.riskSnapshot.openClaimsCount : '—'}</td>
              <td className="border border-border px-1 py-1 text-right">
                {item.riskSnapshot ? formatContractValue(item.riskSnapshot.outstandingPaymentAmount, 'KWD') : '—'}
              </td>
              <td className="border border-border px-1 py-1">{item.attachmentsCount}</td>
              <td className="border border-border px-1 py-1">{item.reviewedBy?.displayName ?? '—'}</td>
              <td className="border border-border px-1 py-1">{formatDate(item.reviewedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
