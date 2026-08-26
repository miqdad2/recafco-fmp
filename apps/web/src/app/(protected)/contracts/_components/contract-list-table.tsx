'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ContractLifecycleBadge } from './contract-lifecycle-badge';
import { ContractRowActions } from './contract-row-actions';
import { formatContractValue } from '../_lib/contract-ui-helpers';
import type { Contract } from '@/lib/contracts-api';

interface Props {
  contracts: Contract[];
  permissions: string[];
  /** Contract ids with a closeout request currently SUBMITTED/UNDER_REVIEW (CM-38's existing register, pendingOnly filter) — drives the "Review Closeout" primary action. */
  pendingCloseoutContractIds: Set<string>;
}

type ViewMode = 'simple' | 'full';

function formatDate(iso: string | undefined): React.ReactNode {
  if (!iso) return <span className="text-text-muted">—</span>;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatValue(contract: Contract): React.ReactNode {
  if (!contract.contractValue) return <span className="text-text-muted">—</span>;
  return formatContractValue(contract.contractValue, contract.currency);
}

function formatDaysRemaining(endDate: string | undefined): React.ReactNode {
  if (!endDate) return <span className="text-text-muted">—</span>;
  const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const end = new Date(endDate);
  const diffDays = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return <span className="text-danger font-medium">{Math.abs(diffDays)}d overdue</span>;
  }
  if (diffDays <= 30) {
    return <span className="text-warning font-medium">{diffDays}d</span>;
  }
  return <span className="text-text-secondary">{diffDays}d</span>;
}

function NotTracked(): React.JSX.Element {
  return <span className="text-xs text-text-muted italic">Not tracked yet</span>;
}

export function ContractListTable({ contracts, permissions, pendingCloseoutContractIds }: Props): React.JSX.Element {
  const [view, setView] = useState<ViewMode>('simple');
  const full = view === 'full';

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView('simple')}
            aria-pressed={!full}
            className={`px-3 py-1.5 rounded ${!full ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setView('full')}
            aria-pressed={full}
            className={`px-3 py-1.5 rounded ${full ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Full View
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="bg-surface-secondary">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Contract ID</th>
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden lg:table-cell">Contract No.</th>}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Contract Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden md:table-cell">Company / Client</th>
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden xl:table-cell">Contract Type</th>}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden lg:table-cell">Contract Manager</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden xl:table-cell">Start Date</th>
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden sm:table-cell">End Date</th>}
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden sm:table-cell">Forecast Completion</th>}
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden lg:table-cell">Current Value</th>}
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden lg:table-cell">Original Value</th>}
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden xl:table-cell">Site Location</th>}
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden xl:table-cell">Physical Progress %</th>}
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden xl:table-cell">Payment Progress %</th>}
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden xl:table-cell">Open Claims</th>}
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden xl:table-cell">Risk Rating</th>}
              {full && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hidden md:table-cell">Days Remaining</th>}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contracts.map((contract) => {
              return (
                <tr key={contract.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="font-mono text-xs font-medium text-accent hover:underline"
                    >
                      {contract.referenceNumber}
                    </Link>
                  </td>
                  {full && (
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <NotTracked />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="text-sm font-semibold text-text-primary hover:text-accent"
                    >
                      {contract.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary hidden md:table-cell">
                    {contract.counterpartyName}
                  </td>
                  {full && (
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <NotTracked />
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-text-secondary hidden lg:table-cell">
                    {contract.ownerUser.displayName}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary hidden xl:table-cell">
                    {formatDate(contract.startDate)}
                  </td>
                  {full && (
                    <td className="px-4 py-3 text-sm text-text-secondary hidden sm:table-cell">
                      {formatDate(contract.endDate)}
                    </td>
                  )}
                  {full && (
                    <td className="px-4 py-3 text-sm text-text-secondary hidden sm:table-cell">
                      {formatDate(contract.forecastCompletionDate)}
                    </td>
                  )}
                  {full && (
                    <td className="px-4 py-3 text-sm text-text-secondary hidden lg:table-cell">
                      {formatValue(contract)}
                    </td>
                  )}
                  {full && (
                    <td className="px-4 py-3 text-sm text-text-secondary hidden lg:table-cell">
                      {contract.originalContractValue
                        ? formatContractValue(contract.originalContractValue, contract.originalCurrency)
                        : <span className="text-text-muted">—</span>}
                    </td>
                  )}
                  {full && (
                    <td className="px-4 py-3 text-sm text-text-secondary hidden xl:table-cell">
                      {contract.projectSiteLocation || <span className="text-text-muted">—</span>}
                    </td>
                  )}
                  {full && (
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <NotTracked />
                    </td>
                  )}
                  {full && (
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <NotTracked />
                    </td>
                  )}
                  {full && (
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <NotTracked />
                    </td>
                  )}
                  {full && (
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <NotTracked />
                    </td>
                  )}
                  {full && (
                    <td className="px-4 py-3 text-sm hidden md:table-cell">
                      {formatDaysRemaining(contract.endDate)}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <ContractLifecycleBadge status={contract.lifecycleStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <ContractRowActions
                      contractId={contract.id}
                      status={contract.status}
                      version={contract.version}
                      permissions={permissions}
                      hasPendingCloseout={pendingCloseoutContractIds.has(contract.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
