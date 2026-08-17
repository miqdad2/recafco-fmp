'use client';

import { useMemo, useState } from 'react';
import type { ContractActivity } from '@/lib/contracts-api';

interface Props {
  activities: ContractActivity[];
}

interface Filters {
  search: string;
  type: string;
  user: string;
}

const EMPTY_FILTERS: Filters = { search: '', type: '', user: '' };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function detailsFor(a: ContractActivity): string {
  if (a.previousStatus && a.newStatus) return `${a.previousStatus} → ${a.newStatus}`;
  return '—';
}

const inputCls =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

export function ContractActivityTable({ activities }: Props): React.JSX.Element {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const types = useMemo(() => Array.from(new Set(activities.map((a) => a.event))).sort(), [activities]);
  const users = useMemo(
    () => Array.from(new Set(activities.map((a) => a.actorName ?? 'System'))).sort(),
    [activities],
  );

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (filters.type && a.event !== filters.type) return false;
      const user = a.actorName ?? 'System';
      if (filters.user && user !== filters.user) return false;
      if (filters.search) {
        const haystack = `${a.event} ${user}`.toLowerCase();
        if (!haystack.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    });
  }, [activities, filters]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Search</label>
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Activity or user…"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Activity Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              className={inputCls}
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>User</label>
            <select
              value={filters.user}
              onChange={(e) => setFilters((f) => ({ ...f, user: e.target.value }))}
              className={inputCls}
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
          >
            Clear Filters
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Activity / Audit History</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full divide-y divide-border text-xs">
            <thead>
              <tr className="bg-surface-secondary">
                {['Date & Time', 'User', 'Action', 'Details', 'Old Status', 'New Status'].map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-text-muted">
                    {activities.length === 0 ? 'No activity history yet.' : 'No activity matches the current filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                    <td className="px-3 py-2 text-text-primary whitespace-nowrap">{a.actorName ?? 'System'}</td>
                    <td className="px-3 py-2 text-text-primary whitespace-nowrap">{a.event.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{detailsFor(a)}</td>
                    <td className="px-3 py-2 text-text-muted">{a.previousStatus ?? '—'}</td>
                    <td className="px-3 py-2 text-text-muted">{a.newStatus ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
