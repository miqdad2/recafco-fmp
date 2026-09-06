'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, FileSearch } from 'lucide-react';
import type { ContractActivity } from '@/lib/contracts-api';
import { ContractActivitySourceBadge } from './contract-activity-source-badge';
import { ContractActivityActionBadge } from './contract-activity-action-badge';
import {
  ACTIVITY_SOURCE_OPTIONS,
  ACTIVITY_TYPE_LABELS,
  activityActionLabel,
  activityType,
  activitySource,
  activityDetails,
  activityOldValue,
  activityNewValue,
  type ActivitySource,
  type ActivityType,
} from '../../../../_lib/contract-activity-helpers';

interface Props {
  contractId: string;
  activities: ContractActivity[];
}

const inputCls =
  'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const filterLabelCls = 'text-[11px] font-medium text-text-muted uppercase tracking-wide';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TABLE_COLUMNS = ['Date & Time', 'User', 'Activity / Action', 'Source', 'Details', 'Old Value', 'New Value', 'Action'];

// CM-66 — Date & Time (first) and Action (last) columns pinned, reusing the
// established sticky-column pattern (contract-claim-panel.tsx / Attachments
// / Issue Log tabs' own panels).
const STICKY_LEFT_HEADER_CLS = 'sticky left-0 z-10 bg-surface-secondary border-r border-border';
const STICKY_RIGHT_HEADER_CLS = 'sticky right-0 z-10 bg-surface-secondary border-l border-border';
const STICKY_LEFT_CLS = 'sticky left-0 z-10 bg-surface border-r border-border';
const STICKY_RIGHT_CLS = 'sticky right-0 z-10 bg-surface border-l border-border';

/** Real, already-existing routes only — a source with no direct tab (none currently) would have no link. */
const SOURCE_TAB_SEGMENT: Record<ActivitySource, string> = {
  Overview: '',
  Payments: 'payments',
  'Workflow & Team Tasks': 'workflow',
  'Variations / Change Orders': 'variations',
  Claims: 'claims',
  'Risk Assessment': 'risks',
  'Documents & Obligations': 'documents',
  'Issue Log': 'issues',
  Attachments: 'attachments',
  Closeout: 'closeout',
};

/**
 * CM-66 — Activity / Audit History search/filter row + table, all in one
 * client component. Same bounded, contract-scoped, client-side-filtered
 * pattern established for Claims/Risk/Issue Log — this contract's full
 * activity list is already fetched server-side (contractsApi.listActivities(),
 * newest first), so search/type/user/source/date filtering happens
 * instantly with no round trip. No Add/Edit here — Activity / Audit History
 * is a read-only log, not a data-entry surface. "Action" links to the real
 * workspace tab the event happened in (derived from the real event string)
 * when one exists — never a fake/dead link.
 */
export function ContractActivityPanel({ contractId, activities }: Props): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<ActivityType | ''>('');
  const [user, setUser] = useState('');
  const [source, setSource] = useState<ActivitySource | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const userOptions = useMemo(() => {
    const values = new Set<string>();
    for (const a of activities) values.add(a.actorName ?? 'System');
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [activities]);

  const filteredActivities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((a) => {
      const actionLabel = activityActionLabel(a.event);
      const actorLabel = a.actorName ?? 'System';
      const details = activityDetails(a);
      if (
        q &&
        !actionLabel.toLowerCase().includes(q) &&
        !actorLabel.toLowerCase().includes(q) &&
        !details.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (type && activityType(a.event) !== type) return false;
      if (user && actorLabel !== user) return false;
      if (source && activitySource(a.event) !== source) return false;
      const activityDate = a.createdAt.slice(0, 10);
      if (dateFrom && activityDate < dateFrom) return false;
      if (dateTo && activityDate > dateTo) return false;
      return true;
    });
  }, [activities, search, type, user, source, dateFrom, dateTo]);

  const hasActiveFilters = Boolean(search || type || user || source || dateFrom || dateTo);

  function clearFilters(): void {
    setSearch('');
    setType('');
    setUser('');
    setSource('');
    setDateFrom('');
    setDateTo('');
  }

  return (
    <>
      <section className="rounded-lg border border-border bg-surface shadow-sm p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, user, or details…"
              aria-label="Search by action, user, or details"
              className={`${inputCls} w-full`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Activity Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as ActivityType | '')} aria-label="Activity Type" className={`${inputCls} w-auto min-w-40`}>
              <option value="">All Types</option>
              {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((t) => (
                <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>User</span>
            <select value={user} onChange={(e) => setUser(e.target.value)} aria-label="User" className={`${inputCls} w-auto min-w-32`}>
              <option value="">All Users</option>
              {userOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Source / Tab</span>
            <select value={source} onChange={(e) => setSource(e.target.value as ActivitySource | '')} aria-label="Source / Tab" className={`${inputCls} w-auto min-w-40`}>
              <option value="">All Sources</option>
              {ACTIVITY_SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={filterLabelCls}>Date Range</span>
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Date from" className={inputCls} />
              <span className="text-text-muted">–</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Date to" className={inputCls} />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus ml-auto"
            >
              Clear Filters
            </button>
          )}
        </div>
      </section>

      <section>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-12 text-center">
            <FileSearch className="size-6 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-text-secondary mt-1">No activity recorded yet.</p>
            <p className="text-xs text-text-muted">New contract updates, uploads, approvals, and status changes will appear here.</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex items-center justify-center gap-2.5 rounded-lg border border-dashed border-border bg-surface-secondary/40 py-6">
            <FileSearch className="size-4 text-text-muted shrink-0" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No activity matches the current search/filters.</p>
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
                {filteredActivities.map((a) => {
                  const src = activitySource(a.event);
                  const segment = SOURCE_TAB_SEGMENT[src];
                  const href = segment === '' ? `/contracts/${contractId}` : `/contracts/${contractId}/${segment}`;
                  return (
                    <tr key={a.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className={`px-3 py-2 whitespace-nowrap text-text-secondary ${STICKY_LEFT_CLS}`}>{formatDateTime(a.createdAt)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-text-primary">{a.actorName ?? 'System'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <ContractActivityActionBadge type={activityType(a.event)} label={activityActionLabel(a.event)} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap"><ContractActivitySourceBadge source={src} /></td>
                      <td className="px-3 py-2 max-w-64 truncate text-text-secondary" title={activityDetails(a)}>{activityDetails(a)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-text-muted">{activityOldValue(a)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-text-muted">{activityNewValue(a)}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${STICKY_RIGHT_CLS}`}>
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-text-secondary hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-focus"
                          title={`Open ${src}`}
                        >
                          View
                          <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
