'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { AssignmentQueueContractGroup } from '../../_lib/assignment-queue-grouping';

interface Props {
  groups: AssignmentQueueContractGroup[];
  /** Href for the contract list with current advanced filters applied, e.g. "/contracts/workflow?mode=assignment&team=TECHNICAL" — a contractId is appended client-side per suggestion. Passed as a plain string (not a function) since this is a Client Component. */
  baseHref: string;
}

const TEAM_LABELS: Record<string, string> = {
  TECHNICAL: 'Technical',
  PRODUCTION: 'Production',
  ERECTION: 'Erection',
  QS_COMMERCIAL: 'QS / Commercial',
};

const SUGGESTION_CAP = 6;

function matchesQuery(group: AssignmentQueueContractGroup, query: string): boolean {
  return (
    group.contractReference.toLowerCase().includes(query) ||
    group.contractTitle.toLowerCase().includes(query) ||
    group.counterpartyName.toLowerCase().includes(query)
  );
}

/**
 * CM-40D — "Choose Contract": a live typeahead over the contract groups the
 * server already fetched (respecting whatever Advanced Filters are active),
 * matched client-side against reference/name/client as the manager types.
 * No network request per keystroke and no "Apply" step — this is
 * deliberately decoupled from the Advanced Filters form below it, which
 * still requires Apply Filters for its own (team/department/manager/status/
 * priority/due-date) fields.
 */
export function AssignmentQueueContractPicker({ groups, baseHref }: Props): React.JSX.Element {
  const [query, setQuery] = useState('');
  const trimmed = query.trim().toLowerCase();

  const suggestions = useMemo(
    () => (trimmed ? groups.filter((g) => matchesQuery(g, trimmed)) : []),
    [groups, trimmed],
  );
  const visible = suggestions.slice(0, SUGGESTION_CAP);

  return (
    <section aria-labelledby="choose-contract-heading" className="rounded-lg border border-border bg-surface p-4">
      <h2 id="choose-contract-heading" className="text-sm font-semibold text-text-primary mb-3">Choose Contract</h2>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by contract ID, project name, or client…"
          aria-label="Search contracts needing assignment"
          className="w-full rounded-md border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {trimmed && (
        <div className="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border">
          {visible.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-text-muted">No contracts match &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            visible.map((group) => {
              const teamLabels = group.teams.map((t) => TEAM_LABELS[t] ?? t).join(', ');
              return (
                <div key={group.contractId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-accent">{group.contractReference}</p>
                    <p className="truncate text-sm font-medium text-text-primary" title={group.contractTitle}>{group.contractTitle}</p>
                    <p className="truncate text-xs text-text-muted" title={group.counterpartyName}>Client: {group.counterpartyName}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="whitespace-nowrap text-xs text-text-secondary">
                      {group.unassignedCount} unassigned{teamLabels ? ` · ${teamLabels}` : ''}
                    </span>
                    <Link
                      href={`${baseHref}&contractId=${group.contractId}`}
                      className="inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      Assign Tasks
                    </Link>
                  </div>
                </div>
              );
            })
          )}
          {suggestions.length > SUGGESTION_CAP && (
            <p className="px-3 py-2 text-[11px] text-text-muted">
              Showing {SUGGESTION_CAP} of {suggestions.length} matches — refine your search or browse all contracts below.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
