// ---------------------------------------------------------------------------
// CM-39C — "Today's Focus" summary sentence for the Manager Dashboard.
// Pure, dependency-free so it can be unit tested directly, matching the
// pattern used by ./contract-dashboard-attention.ts.
// ---------------------------------------------------------------------------

import type { ManagerDashboardSummary } from '@/lib/contracts-api';

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Builds the ordered list of "N thing(s)" segments for the focus sentence,
 * using the same real, already-fetched summary counts as the KPI cards.
 * Only non-zero counts are included; callers join with " · " or show a
 * positive empty-state message when the list is empty.
 */
export function buildTodaysFocusSegments(summary: ManagerDashboardSummary | undefined): string[] {
  if (!summary) return [];
  const segments: string[] = [];
  if (summary.pendingCloseoutRequests > 0) {
    segments.push(`${pluralize(summary.pendingCloseoutRequests, 'closeout request')} waiting review`);
  }
  if (summary.overdueWorkflowTasks > 0) {
    segments.push(`${pluralize(summary.overdueWorkflowTasks, 'overdue workflow task')}`);
  }
  if (summary.openIssues > 0) {
    segments.push(`${pluralize(summary.openIssues, 'open issue')}`);
  }
  if (summary.openClaims > 0) {
    segments.push(`${pluralize(summary.openClaims, 'open claim')}`);
  }
  return segments;
}
