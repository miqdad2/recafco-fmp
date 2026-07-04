'use client';

import { useState } from 'react';
import type { PermissionSummary } from '@/lib/roles-api';

function groupByModule(perms: PermissionSummary[]): Record<string, PermissionSummary[]> {
  const groups: Record<string, PermissionSummary[]> = {};
  for (const p of perms) {
    if (!groups[p.module]) groups[p.module] = [];
    groups[p.module]!.push(p);
  }
  return groups;
}

interface Props {
  permissions: PermissionSummary[];
}

export function RolePermissionSummary({ permissions }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const groups = groupByModule(permissions);
  const moduleCount = Object.keys(groups).length;

  const summary =
    permissions.length === 0
      ? 'No permissions assigned'
      : `${permissions.length} permission${permissions.length !== 1 ? 's' : ''} across ${moduleCount} module${moduleCount !== 1 ? 's' : ''}`;

  return (
    <div className="rounded-md border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-focus"
      >
        <span className="font-medium text-text-primary">{summary}</span>
        <span className="text-text-muted text-xs select-none">
          {expanded ? '▲ Collapse' : '▼ View permissions'}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {permissions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">This role has no permissions assigned.</p>
          ) : (
            <div className="divide-y divide-border">
              {Object.entries(groups).map(([module, perms]) => (
                <div key={module} className="px-4 py-3">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                    {module}
                  </p>
                  <ul className="space-y-1.5">
                    {perms.map((p) => (
                      <li key={p.id} className="flex items-start gap-2">
                        <span
                          className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-success flex-shrink-0"
                          aria-hidden="true"
                        />
                        <div>
                          <span className="text-sm text-text-primary">{p.name}</span>
                          {p.description && (
                            <p className="text-xs text-text-muted mt-0.5">{p.description}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
