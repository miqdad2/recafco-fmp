// ---------------------------------------------------------------------------
// CM-57 — Pure, presentation-agnostic helpers for the Contract Detail
// Overview approved-design rebuild. Every number here is derived from real
// workflow/payment/claim/issue data already returned by existing endpoints
// (contractsApi.getWorkflow / listPayments / getCloseoutChecks /
// listCloseoutRequests) — nothing here invents or estimates a value.
// Dependency-free so it can be unit tested directly, matching the pattern
// used by contract-ui-helpers.ts / dashboard-insights-helpers.ts.
// ---------------------------------------------------------------------------

export interface OverviewWorkflowTask {
  team: string;
  status: string;
  isOverdue?: boolean;
}

export interface TeamProgress {
  completed: number;
  total: number;
  /** 0-100, rounded. 0 (never NaN) when there are no tasks for this team yet. */
  percent: number;
}

/** Technical / Production / Erection progress circles — completed/total tasks for one workflow team. */
export function computeTeamProgress(tasks: OverviewWorkflowTask[], team: string): TeamProgress {
  const teamTasks = tasks.filter((t) => t.team === team);
  const completed = teamTasks.filter((t) => t.status === 'COMPLETED').length;
  const total = teamTasks.length;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

/** Overall progress circle — completed/total across every workflow team combined. */
export function computeOverallProgress(tasks: OverviewWorkflowTask[]): TeamProgress {
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
  const total = tasks.length;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

export interface ProductionTaskSummary {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
}

const IN_PROGRESS_STATUSES = new Set(['IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED']);

/**
 * Section 9 (Production Summary) fallback when no production-quantity
 * module exists — real PRODUCTION-team workflow task counts, never fake
 * casted/delivered/stock numbers. `overdue` is a cross-cutting flag (a task
 * can be both "in progress" and overdue), so it is NOT part of the
 * completed+inProgress+pending partition.
 */
export function computeProductionTaskSummary(tasks: OverviewWorkflowTask[]): ProductionTaskSummary {
  const productionTasks = tasks.filter((t) => t.team === 'PRODUCTION');
  const completed = productionTasks.filter((t) => t.status === 'COMPLETED').length;
  const inProgress = productionTasks.filter((t) => IN_PROGRESS_STATUSES.has(t.status)).length;
  const overdue = productionTasks.filter((t) => t.isOverdue === true).length;
  return {
    total: productionTasks.length,
    completed,
    inProgress,
    pending: productionTasks.length - completed - inProgress,
    overdue,
  };
}

/** Financial Summary's Payment Progress — Received Payments ÷ Current Contract Value × 100. 0% (never divides by zero) when there's no current value to compare against. */
export function computePaymentProgressPercent(receivedPayments: number, currentContractValue: number): number {
  if (currentContractValue <= 0) return 0;
  return Math.round((receivedPayments / currentContractValue) * 100);
}

export type AttentionSeverity = 'high' | 'medium' | 'low';

export interface AttentionItem {
  key: string;
  severity: AttentionSeverity;
  text: string;
  actionLabel: string;
  actionHref: string;
}

export interface AttentionInput {
  contractId: string;
  overdueWorkflowTasks: number;
  overduePayments: number;
  openClaims: number;
  openIssues: number;
  pendingCloseoutStatus: 'SUBMITTED' | 'UNDER_REVIEW' | null;
  daysRemaining: { label: string; overdue: boolean; dueSoon: boolean } | null;
}

/**
 * Section 7 (Attention Required) — every row here is gated behind a real
 * count > 0 (or a real pending-closeout/overdue-date condition). Expiring
 * documents/performance bonds/insurance are deliberately never included —
 * no document-expiry tracking exists in this schema (see
 * ManagementAttentionRequiredPanel's own CM-54 note for the same reason at
 * dashboard scope).
 */
export function buildAttentionItems(input: AttentionInput): AttentionItem[] {
  const base = `/contracts/${input.contractId}`;
  const items: AttentionItem[] = [];

  if (input.overdueWorkflowTasks > 0) {
    items.push({
      key: 'overdue-tasks',
      severity: 'high',
      text: `${input.overdueWorkflowTasks} overdue workflow task${input.overdueWorkflowTasks === 1 ? '' : 's'}`,
      actionLabel: 'View Workflow',
      actionHref: `${base}/workflow`,
    });
  }
  if (input.overduePayments > 0) {
    items.push({
      key: 'overdue-payments',
      severity: 'high',
      text: `${input.overduePayments} overdue payment follow-up${input.overduePayments === 1 ? '' : 's'}`,
      actionLabel: 'View Payments',
      actionHref: `${base}/payments`,
    });
  }
  if (input.openClaims > 0) {
    items.push({
      key: 'open-claims',
      severity: 'medium',
      text: `${input.openClaims} open claim${input.openClaims === 1 ? '' : 's'}`,
      actionLabel: 'View Claims',
      actionHref: `${base}/claims`,
    });
  }
  if (input.openIssues > 0) {
    items.push({
      key: 'open-issues',
      severity: 'medium',
      text: `${input.openIssues} open issue${input.openIssues === 1 ? '' : 's'}`,
      actionLabel: 'View Issues',
      actionHref: `${base}/issues`,
    });
  }
  if (input.pendingCloseoutStatus) {
    items.push({
      key: 'pending-closeout',
      severity: 'low',
      text: `Closeout request ${input.pendingCloseoutStatus === 'SUBMITTED' ? 'submitted' : 'under review'}`,
      actionLabel: 'View Closeout',
      actionHref: `${base}/closeout`,
    });
  }
  if (input.daysRemaining?.overdue) {
    items.push({
      key: 'contract-overdue',
      severity: 'high',
      text: `Contract completion date has passed (${input.daysRemaining.label})`,
      actionLabel: 'View Schedule',
      actionHref: `${base}/schedule`,
    });
  } else if (input.daysRemaining?.dueSoon) {
    items.push({
      key: 'contract-closing-soon',
      severity: 'low',
      text: `Contract completion date is approaching (${input.daysRemaining.label})`,
      actionLabel: 'View Schedule',
      actionHref: `${base}/schedule`,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Scope of Work display — Overview shows a fixed 5-option checklist matching
// the New Contract Register's own option set (CM-56). 'designProduction' is
// deliberately excluded even when a legacy contract has it stored `true` —
// it is a legacy key from before the approved-design rebuild, never shown
// as "Design Production" or mapped to any other visible label here.
// ---------------------------------------------------------------------------
export const OVERVIEW_SCOPE_DISPLAY_KEYS = ['shopDrawing', 'production', 'delivery', 'erection', 'exFactory'];
