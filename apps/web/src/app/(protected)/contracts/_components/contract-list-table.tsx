'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ContractRowActions } from './contract-row-actions';
import { ContractScheduleStatusSelect } from './contract-schedule-status-select';
import { formatContractValue, formatScopeCompact, formatDaysRemainingDisplay } from '../_lib/contract-ui-helpers';
import type { Contract } from '@/lib/contracts-api';

interface Props {
  contracts: Contract[];
  permissions: string[];
  /** Contract ids with a closeout request currently SUBMITTED/UNDER_REVIEW (CM-38's existing register, pendingOnly filter) — drives the "Review Closeout" primary action. */
  pendingCloseoutContractIds: Set<string>;
  /** CM-55D — real pagination context for the "Showing X to Y of Z contracts" top row. Optional: falls back to a plain "Showing N contracts" count when not supplied. */
  page?: number;
  pageSize?: number;
  total?: number;
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

function DaysRemainingCell({ contract }: { contract: Contract }): React.JSX.Element {
  const { label, overdue, dueSoon } = formatDaysRemainingDisplay(contract.forecastCompletionDate, contract.endDate);
  if (label === '—') return <span className="text-text-muted">—</span>;
  if (overdue) return <span className="text-error font-medium">{label}</span>;
  if (dueSoon) return <span className="text-warning font-medium">{label}</span>;
  return <span className="text-text-secondary">{label}</span>;
}

/** Compact progress bar + percentage — CM-55 approved-design style (blue for Progress %, green for Payment Progress %). */
function ProgressCell({ percent, colorClass }: { percent: number | undefined; colorClass: string }): React.JSX.Element {
  const value = percent ?? 0;
  return (
    <div className="flex items-center gap-1.5 min-w-20">
      <div className="h-1.5 w-12 rounded-full bg-surface-secondary overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="text-xs text-text-secondary tabular-nums">{value}%</span>
    </div>
  );
}

/** Contract Type / Scope — CM-55C: compact "First Label +N" instead of the full comma-joined list, which was wrapping across several lines and inflating row height. Full list still reachable via `title`. */
function ScopeCell({ contract }: { contract: Contract }): React.JSX.Element {
  const { display, fullList } = formatScopeCompact(contract.scopeOfWork);
  return (
    <span className="block max-w-32 truncate" title={fullList !== '—' ? fullList : undefined}>
      {display}
    </span>
  );
}

const HEADER_CLS = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-inverse/90 whitespace-nowrap';
const CELL_CLS = 'px-3 py-2 text-sm text-text-secondary align-middle';
// Opaque background required on both sticky columns — a transparent/
// hover-tinted cell would let scrolled content show through underneath it.
// The header variants use bg-nav (matching the rest of the header row)
// instead of bg-surface.
const STICKY_LEFT_CLS = 'sticky left-0 z-10 bg-surface border-r border-border';
// CM-69B — Action column widened to a reserved 180-220px band (min-w-[200px])
// so Open + the "···" More trigger never crowd/overlap regardless of what
// scrolled underneath; the left-edge shadow (body cell only — the header's
// opaque bg-nav already reads as separated on its own) reinforces the
// existing border as the real visual cue that content is scrolling beneath
// a fixed column, not just decoration.
const STICKY_RIGHT_CLS = 'sticky right-0 z-10 bg-surface border-l border-border min-w-[200px] shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.15)]';
const STICKY_LEFT_HEADER_CLS = 'sticky left-0 z-10 bg-nav border-r border-border';
const STICKY_RIGHT_HEADER_CLS = 'sticky right-0 z-10 bg-nav border-l border-border min-w-[200px]';

// CM-55 — approved-design Contract List table: dark navy header, Risk Rating
// column removed entirely, "Physical Progress %" renamed to "Progress %"
// and backed by real workflow-task completion (contract.progressPercent —
// see contracts.service.ts's toListItem()), Payment Progress % and Open
// Claims are now real (previously "Not tracked yet" placeholders), and the
// Status column is the manager-facing schedule-status dropdown
// (ContractScheduleStatusSelect) instead of the lifecycle badge. Full View
// is the default per the approved design.
// CM-55C — UX polish pass: compact row padding, truncated/nowrap text cells
// (with `title` tooltips for the full value) so long Contract Name/Client/
// Contract Type text no longer inflates row height, Contract ID sticky-left
// and Action sticky-right so both stay reachable without horizontal
// scrolling, and Open Claims/Days Remaining centered. Same columns, same
// data, same ContractScheduleStatusSelect/ContractRowActions — visual only.
// CM-55D — compact table-top row (real "Showing X to Y of Z contracts" count
// on the left, the Simple/Full View toggle on the right, labeled "View:")
// replacing the toggle-only row; Contract ID column gained a reserved
// min-width so it never gets visually squeezed into an awkward wrap.
export function ContractListTable({ contracts, permissions, pendingCloseoutContractIds, page, pageSize, total }: Props): React.JSX.Element {
  const [view, setView] = useState<ViewMode>('full');
  const full = view === 'full';
  const canEditScheduleStatus = permissions.includes('contracts.update');

  const countLabel = (() => {
    if (page === undefined || pageSize === undefined || total === undefined || total <= 0) {
      return `Showing ${contracts.length} contract${contracts.length === 1 ? '' : 's'}`;
    }
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(from + contracts.length - 1, total);
    return `Showing ${from} to ${to} of ${total} contracts`;
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="text-text-secondary">{countLabel}</span>
        <div className="flex items-center gap-2">
          <span className="text-text-muted">View:</span>
          <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
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
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="bg-nav">
              <th className={`${HEADER_CLS} ${STICKY_LEFT_HEADER_CLS} min-w-40`}>Contract ID</th>
              {full && <th className={`${HEADER_CLS} hidden lg:table-cell`}>Contract No.</th>}
              <th className={HEADER_CLS}>Contract Name</th>
              <th className={`${HEADER_CLS} hidden md:table-cell`}>Client / Employer</th>
              {full && <th className={`${HEADER_CLS} hidden xl:table-cell`}>Contract Type</th>}
              <th className={`${HEADER_CLS} hidden lg:table-cell`}>Contract Manager</th>
              {full && <th className={`${HEADER_CLS} hidden xl:table-cell`}>Start Date</th>}
              <th className={`${HEADER_CLS} hidden sm:table-cell`}>Forecast Completion</th>
              {full && <th className={`${HEADER_CLS} hidden lg:table-cell text-right`}>Current Value (KWD)</th>}
              {full && <th className={`${HEADER_CLS} hidden xl:table-cell`}>Progress %</th>}
              {full && <th className={`${HEADER_CLS} hidden xl:table-cell`}>Payment Progress %</th>}
              {full && <th className={`${HEADER_CLS} hidden xl:table-cell text-center`}>Open Claims</th>}
              {full && <th className={`${HEADER_CLS} hidden md:table-cell text-center`}>Days Remaining</th>}
              <th className={HEADER_CLS}>Status</th>
              <th className={`${HEADER_CLS} ${STICKY_RIGHT_HEADER_CLS}`}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contracts.map((contract) => {
              const scheduleStatus = contract.effectiveScheduleStatus ?? 'IN_PROGRESS';
              return (
                <tr key={contract.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className={`${CELL_CLS} ${STICKY_LEFT_CLS} min-w-40 whitespace-nowrap`}>
                    <Link
                      href={`/contracts/${contract.id}`}
                      title={contract.referenceNumber}
                      className="font-mono text-xs font-medium text-accent hover:underline"
                    >
                      {contract.referenceNumber}
                    </Link>
                  </td>
                  {full && (
                    <td className={`${CELL_CLS} hidden lg:table-cell whitespace-nowrap max-w-28 truncate`} title={contract.jobOrder || contract.referenceNumber}>
                      {contract.jobOrder || contract.referenceNumber}
                    </td>
                  )}
                  <td className={`${CELL_CLS} max-w-48 truncate`} title={contract.title}>
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="font-semibold text-text-primary hover:text-accent"
                    >
                      {contract.title}
                    </Link>
                  </td>
                  <td className={`${CELL_CLS} hidden md:table-cell max-w-36 truncate`} title={contract.counterpartyName}>
                    {contract.counterpartyName}
                  </td>
                  {full && (
                    <td className={`${CELL_CLS} hidden xl:table-cell`}>
                      <ScopeCell contract={contract} />
                    </td>
                  )}
                  <td className={`${CELL_CLS} hidden lg:table-cell max-w-28 truncate`} title={contract.ownerUser.displayName}>
                    {contract.ownerUser.displayName}
                  </td>
                  {full && (
                    <td className={`${CELL_CLS} hidden xl:table-cell whitespace-nowrap`}>
                      {formatDate(contract.startDate)}
                    </td>
                  )}
                  <td className={`${CELL_CLS} hidden sm:table-cell whitespace-nowrap`}>
                    {formatDate(contract.forecastCompletionDate)}
                  </td>
                  {full && (
                    <td className={`${CELL_CLS} hidden lg:table-cell whitespace-nowrap text-right`}>
                      {formatValue(contract)}
                    </td>
                  )}
                  {full && (
                    <td className={`${CELL_CLS} hidden xl:table-cell whitespace-nowrap`}>
                      <ProgressCell percent={contract.progressPercent} colorClass="bg-info" />
                    </td>
                  )}
                  {full && (
                    <td className={`${CELL_CLS} hidden xl:table-cell whitespace-nowrap`}>
                      <ProgressCell percent={contract.paymentProgressPercent} colorClass="bg-success" />
                    </td>
                  )}
                  {full && (
                    <td className={`${CELL_CLS} hidden xl:table-cell text-center whitespace-nowrap`}>
                      {contract.openClaimsCount ?? 0}
                    </td>
                  )}
                  {full && (
                    <td className={`${CELL_CLS} hidden md:table-cell text-center whitespace-nowrap`}>
                      <DaysRemainingCell contract={contract} />
                    </td>
                  )}
                  <td className={`${CELL_CLS} whitespace-nowrap`}>
                    <ContractScheduleStatusSelect contractId={contract.id} value={scheduleStatus} canEdit={canEditScheduleStatus} />
                  </td>
                  <td className={`${CELL_CLS} ${STICKY_RIGHT_CLS} whitespace-nowrap`}>
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
