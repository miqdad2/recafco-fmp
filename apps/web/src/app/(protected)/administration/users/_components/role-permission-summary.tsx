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

// Permissions that are NOT purely read-only. update_own_draft is low-risk (own unsaved records only).
const READ_ONLY_SUFFIXES = ['.read', '.comment'];
const LOW_RISK_CODES = new Set(['incidents.update_own_draft', 'tasks.update_own_draft', 'tasks.update_progress']);

function getWritePermissions(permissions: PermissionSummary[]): PermissionSummary[] {
  return permissions.filter((p) => {
    if (LOW_RISK_CODES.has(p.code)) return false;
    return !READ_ONLY_SUFFIXES.some((s) => p.code.endsWith(s));
  });
}

interface Props {
  permissions: PermissionSummary[];
  showWriteWarning?: boolean;
}

export function RolePermissionSummary({ permissions, showWriteWarning = false }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const groups = groupByModule(permissions);
  const moduleCount = Object.keys(groups).length;

  const summary =
    permissions.length === 0
      ? 'No permissions assigned'
      : `${permissions.length} permission${permissions.length !== 1 ? 's' : ''} across ${moduleCount} module${moduleCount !== 1 ? 's' : ''}`;

  const writePerms = showWriteWarning ? getWritePermissions(permissions) : [];

  return (
    <div className="space-y-2">
      {showWriteWarning && writePerms.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-warning bg-warning/10 px-4 py-3 text-sm text-warning-foreground"
        >
          <p className="font-medium">This role includes write permissions.</p>
          <p className="mt-1 text-xs text-text-secondary">
            {writePerms.length} non-read-only permission{writePerms.length !== 1 ? 's' : ''} (
            {writePerms.map((p) => p.code).join(', ')}). Review carefully before assigning to
            users who should have read-only access.
          </p>
        </div>
      )}
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
    </div>
  );
}
