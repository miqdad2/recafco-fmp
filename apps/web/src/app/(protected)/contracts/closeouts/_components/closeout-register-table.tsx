import Link from 'next/link';
import type { CloseoutListItem } from '@/lib/contracts-api';
import { CloseoutStatusBadge } from './closeout-status-badge';
import { formatContractValue } from '../../_lib/contract-ui-helpers';

interface Props {
  items: CloseoutListItem[];
  canClose: boolean;
}

const PENDING_STATUSES = ['SUBMITTED', 'UNDER_REVIEW'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function reviewActionLabel(status: string, canClose: boolean): string {
  if (!canClose) return 'View Closeout';
  if (status === 'APPROVED') return 'Final Close';
  if (PENDING_STATUSES.includes(status)) return 'Review Closeout';
  return 'View Closeout';
}

export function CloseoutRegisterTable({ items, canClose }: Props): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-12 text-center">
        <p className="text-sm text-text-secondary">No closeout requests found.</p>
        <p className="text-sm text-text-muted mt-1">
          Closeout requests will appear here after users submit contract closeout for review.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[1700px] divide-y divide-border text-xs">
        <thead className="border-b-2 border-border-strong">
          <tr className="bg-surface-secondary">
            {[
              'Request No', 'Contract ID', 'Contract Name', 'Company / Client', 'Requested By', 'Requested Date',
              'Status', 'Workflow Open', 'Issues Open', 'Claims Open', 'Outstanding Payment', 'Documents',
              'Reviewed By', 'Reviewed Date', 'Action',
            ].map((col) => (
              <th key={col} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {items.map((item) => (
            <tr key={item.requestId}>
              <td className="px-3 py-2 whitespace-nowrap font-mono">{item.requestNo}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <Link href={`/contracts/${item.contractId}`} className="font-mono text-accent hover:underline">
                  {item.contractReference}
                </Link>
              </td>
              <td className="px-3 py-2 max-w-[180px] truncate" title={item.contractTitle}>{item.contractTitle}</td>
              <td className="px-3 py-2 max-w-[150px] truncate" title={item.companyName}>{item.companyName}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.requestedBy.displayName}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.requestedAt)}</td>
              <td className="px-3 py-2 whitespace-nowrap"><CloseoutStatusBadge status={item.status} /></td>
              <td className="px-3 py-2 whitespace-nowrap">
                {item.riskSnapshot ? (
                  <span className={item.riskSnapshot.openWorkflowTasksCount > 0 ? 'text-warning font-medium' : ''}>
                    {item.riskSnapshot.openWorkflowTasksCount}
                  </span>
                ) : '—'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {item.riskSnapshot ? (
                  <span className={item.riskSnapshot.openIssuesCount > 0 ? 'text-warning font-medium' : ''}>
                    {item.riskSnapshot.openIssuesCount}
                  </span>
                ) : '—'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {item.riskSnapshot ? (
                  <span className={item.riskSnapshot.openClaimsCount > 0 ? 'text-warning font-medium' : ''}>
                    {item.riskSnapshot.openClaimsCount}
                  </span>
                ) : '—'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {item.riskSnapshot ? formatContractValue(item.riskSnapshot.outstandingPaymentAmount, 'KWD') : '—'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{item.attachmentsCount}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.reviewedBy?.displayName ?? '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.reviewedAt)}</td>
              <td className="px-3 py-2 whitespace-nowrap print:hidden">
                <div className="flex items-center gap-2">
                  <Link href={`/contracts/${item.contractId}`} className="text-text-muted hover:text-text-primary" title="View contract">
                    View
                  </Link>
                  <Link href={item.actionUrl} className="text-accent hover:underline font-medium" title="Open the contract's Closeout tab">
                    {reviewActionLabel(item.status, canClose)}
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
