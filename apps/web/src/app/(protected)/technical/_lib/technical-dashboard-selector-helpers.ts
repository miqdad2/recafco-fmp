import type { TechnicalJobRow, TechnicalAttentionItem, TechnicalStage, JobReleaseSummary } from '@/lib/technical-api';
import type { BoqConfirmationItem } from '@/lib/technical-api';
import { contractTotals } from '../../contracts/_lib/boq-progress-helpers';

// ---------------------------------------------------------------------------
// FMP-UI-31 — pure helpers for the redesigned Technical Dashboard
// (/technical). Every number comes from data the dashboard or the existing
// per-contract BOQ Progress endpoint already returns — nothing invented,
// nothing written.
// ---------------------------------------------------------------------------

/**
 * Default selected job: the first job real Needs Attention data already
 * flags, falling back to the most recently updated job whose workflow has
 * actually started and isn't complete (jobs is already updatedAt-desc from
 * the API), falling back further to the first job of any kind so the
 * selector always has something to show when jobs exist at all.
 */
export function pickDefaultTechnicalJob(jobs: TechnicalJobRow[], needsAttention: TechnicalAttentionItem[]): TechnicalJobRow | null {
  const flagged = needsAttention[0] ? jobs.find((j) => j.contractId === needsAttention[0]!.contractId) : undefined;
  if (flagged) return flagged;
  const active = jobs.find((j) => j.workflowStarted && j.status !== 'COMPLETED');
  return active ?? jobs[0] ?? null;
}

/** Client-side search over the already-loaded jobs list — by contract no., job order, or project name. No network call: `jobs` already holds every job in scope (capped the same way the API already caps it). */
export function searchJobsLocally(jobs: TechnicalJobRow[], query: string): TechnicalJobRow[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return jobs.filter((j) =>
    (j.jobOrderNo?.toLowerCase().includes(q) ?? false) ||
    j.referenceNumber.toLowerCase().includes(q) ||
    j.projectName.toLowerCase().includes(q),
  );
}

export type StageFlowState = 'done' | 'current' | 'pending';
export interface StageFlowStep {
  key: string;
  label: string;
  state: StageFlowState;
}

const FIVE_STEP_ORDER: { stage: TechnicalStage; label: string }[] = [
  { stage: 'DRAWING_RECEIVED', label: 'Drawing' },
  { stage: 'SD_CALCULATION_SUBMISSION', label: 'SD & Calc.' },
  { stage: 'GETTING_APPROVAL', label: 'Approval' },
  { stage: 'FD_ISSUANCE', label: 'FD Issued' },
];

/** The Selected Job Progress card's 5-step flow (4 real stages + "Ready", which is really "workflow completed"). A job that hasn't started yet shows every step Pending; a completed job shows every step Done. */
export function fiveStepFlow(job: Pick<TechnicalJobRow, 'workflowStarted' | 'currentStage' | 'status'>): StageFlowStep[] {
  const currentIdx = job.currentStage ? FIVE_STEP_ORDER.findIndex((s) => s.stage === job.currentStage) : -1;
  const steps: StageFlowStep[] = FIVE_STEP_ORDER.map((s, i) => {
    let state: StageFlowState = 'pending';
    if (job.workflowStarted) {
      if (job.status === 'COMPLETED') state = 'done';
      else if (i < currentIdx) state = 'done';
      else if (i === currentIdx) state = 'current';
    }
    return { key: s.stage, label: s.label, state };
  });
  steps.push({ key: 'READY', label: 'Ready', state: job.status === 'COMPLETED' ? 'done' : 'pending' });
  return steps;
}

export interface SelectedJobBoqSummary {
  /** Non-null means "show this message instead of numbers". */
  emptyMessage: string | null;
  boqItemCount: number;
  confirmedPieces: number;
  piecesGenerated: number;
  needsAttention: boolean;
}

/** BOQ Items / Drawing Confirmed Pieces / Pieces Generated / Needs Attention for the Selected Job Progress card — reuses the exact same per-item rules `contractTotals()` already applies on the per-contract BOQ Progress tab. */
export function selectedJobBoqSummary(items: BoqConfirmationItem[] | null): SelectedJobBoqSummary {
  if (items === null || items.length === 0) {
    return { emptyMessage: 'No BOQ drawing confirmation yet.', boqItemCount: 0, confirmedPieces: 0, piecesGenerated: 0, needsAttention: false };
  }
  const totals = contractTotals(items);
  return {
    emptyMessage: null,
    boqItemCount: items.length,
    confirmedPieces: totals.confirmedPieces,
    piecesGenerated: totals.piecesGenerated,
    needsAttention: totals.needsAttention > 0,
  };
}

export interface TechnicalAttentionRow {
  label: string;
  value: number;
  tone: 'error' | 'warning';
}

/**
 * The redesigned Needs Attention panel's 5 fixed rows. "Overdue jobs" and
 * "Waiting approval" come from data already on the dashboard (the real
 * per-record Needs Attention list, and the existing waitingApproval metric);
 * the 3 BOQ-related rows come from the new `boqAttention` aggregate
 * (technical.service.ts's own `buildBoqAttentionSummary()`).
 */
export function buildTechnicalNeedsAttentionRows(input: {
  needsAttention: TechnicalAttentionItem[];
  waitingApproval: number;
  missingBoqConfirmation: number;
  confirmedPiecesNotGenerated: number;
  rejectedOrHoldPieces: number;
}): TechnicalAttentionRow[] {
  const overdueJobs = new Set(
    input.needsAttention.filter((i) => i.reason.startsWith('OVERDUE')).map((i) => i.contractId),
  ).size;
  return [
    { label: 'Overdue Jobs', value: overdueJobs, tone: 'error' },
    { label: 'Waiting Approval', value: input.waitingApproval, tone: 'warning' },
    { label: 'Missing BOQ Drawing Confirmation', value: input.missingBoqConfirmation, tone: 'warning' },
    { label: 'Confirmed Pieces Not Generated', value: input.confirmedPiecesNotGenerated, tone: 'warning' },
    { label: 'Rejected / Hold Pieces', value: input.rejectedOrHoldPieces, tone: 'warning' },
  ];
}

/** Dashboard jobs table: real jobs, reordered (not filtered) so a job with a real Needs Attention flag or URGENT priority shows up inside the first 5 — the rest of the list keeps its existing most-recently-updated order. */
export function prioritizeJobsForTable(jobs: TechnicalJobRow[], needsAttention: TechnicalAttentionItem[]): TechnicalJobRow[] {
  const flaggedIds = new Set(needsAttention.map((i) => i.contractId));
  const isPriority = (j: TechnicalJobRow): boolean => flaggedIds.has(j.contractId) || j.priority === 'URGENT';
  return [...jobs].sort((a, b) => Number(isPriority(b)) - Number(isPriority(a)));
}

// ---------------------------------------------------------------------------
// FMP-BOQ-16 — Drawing / Calculation Group release status on the dashboard.
// All numbers come from `releaseByContract` (read-only, built by the API).
// ---------------------------------------------------------------------------

export const RELEASE_MESSAGES = {
  noPieces: 'No pieces generated yet.',
  noBoq: 'No BOQ pieces generated yet.',
  noGroups: 'No drawing groups created yet.',
  noneReleased: 'No pieces released to Production yet.',
  noFiles: 'No files attached.',
  upToDate: 'All Technical release work is up to date.',
} as const;

/** The plain note for a job's release box: what is missing first, otherwise null. */
export function jobReleaseNote(r: JobReleaseSummary | undefined): string | null {
  if (!r) return null;
  if (r.generated === 0) return RELEASE_MESSAGES.noPieces;
  if (r.groupsTotal === 0) return RELEASE_MESSAGES.noGroups;
  if (r.released === 0) return RELEASE_MESSAGES.noneReleased;
  return null;
}

/** Confirmed → Generated → Grouped → Files Attached → Released (pieces; Files Attached = pieces in groups that have a file). */
export function releaseFlow(r: JobReleaseSummary): { key: string; label: string; count: number }[] {
  return [
    { key: 'confirmed', label: 'Confirmed', count: r.confirmed },
    { key: 'generated', label: 'Generated', count: r.generated },
    { key: 'grouped', label: 'Grouped', count: r.assigned },
    { key: 'files', label: 'Files Attached', count: r.filesAttachedPieces },
    { key: 'released', label: 'Released', count: r.released },
  ];
}

/** The compact counts in Selected Job Progress. */
export function releaseCounts(r: JobReleaseSummary): { label: string; value: number; warn: boolean }[] {
  return [
    { label: 'Pieces Generated', value: r.generated, warn: false },
    { label: 'Assigned to Groups', value: r.assigned, warn: false },
    { label: 'Not Assigned', value: r.notAssigned, warn: r.notAssigned > 0 },
    { label: 'Released to Production', value: r.released, warn: false },
    { label: 'Not Released', value: r.notReleased, warn: r.notReleased > 0 },
    { label: 'Groups with No Files', value: r.groupsNoFiles, warn: r.groupsNoFiles > 0 },
  ];
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Short indicator for a row in the jobs table: "20 generated / 15 released", "5 not assigned", "No groups" or null. */
export function jobReleaseIndicator(r: JobReleaseSummary | undefined): string | null {
  if (!r || r.generated === 0) return null;
  if (r.groupsTotal === 0) return 'No groups';
  if (r.notAssigned > 0) return `${r.notAssigned} not assigned`;
  return `${r.generated} generated / ${r.released} released`;
}

/** Technical-specific Needs Attention rows, summed over every job. */
export function buildReleaseAttentionRows(releaseByContract: Record<string, JobReleaseSummary>): TechnicalAttentionRow[] {
  const all = Object.values(releaseByContract);
  const sum = (fn: (r: JobReleaseSummary) => number): number => all.reduce((t, r) => t + fn(r), 0);
  return [
    { label: 'Pieces Not Assigned', value: sum((r) => r.notAssigned), tone: 'warning' },
    { label: 'Groups Not Released', value: sum((r) => r.groupsNotReleased), tone: 'warning' },
    { label: 'Groups With No Files', value: sum((r) => r.groupsNoFiles), tone: 'warning' },
  ];
}

export interface NextActionItem {
  key: string;
  jobLabel: string;
  project: string;
  text: string;
  /** Only for the existing workflow items — they open their stage page. */
  stage: TechnicalStage | null;
  contractId: string;
}

/**
 * Next Action Focus, at most 5, in this order: confirmed pieces not generated,
 * generated pieces not assigned, groups with no files, submitted groups waiting
 * approval, approved groups waiting release, then the existing workflow actions.
 */
export function buildNextActionItems(
  jobs: TechnicalJobRow[],
  releaseByContract: Record<string, JobReleaseSummary>,
  needsAttention: TechnicalAttentionItem[],
  limit = 5,
): NextActionItem[] {
  const jobOf = (id: string): TechnicalJobRow | undefined => jobs.find((j) => j.contractId === id);
  const rules: { id: string; count: (r: JobReleaseSummary) => number; text: (n: number) => string }[] = [
    { id: 'not-generated', count: (r) => r.confirmedNotGenerated, text: (n) => `${n} confirmed ${n === 1 ? 'piece' : 'pieces'} not generated` },
    { id: 'not-assigned', count: (r) => r.notAssigned, text: (n) => `${n} ${n === 1 ? 'piece' : 'pieces'} not assigned to groups` },
    { id: 'no-files', count: (r) => r.groupsNoFiles, text: (n) => plural(n, 'group has no files', 'groups have no files') },
    { id: 'waiting-approval', count: (r) => r.groupsSubmitted, text: (n) => plural(n, 'submitted group waiting approval', 'submitted groups waiting approval') },
    { id: 'waiting-release', count: (r) => r.groupsApproved, text: (n) => plural(n, 'approved group waiting release', 'approved groups waiting release') },
  ];
  const items: NextActionItem[] = [];
  for (const rule of rules) {
    for (const [contractId, r] of Object.entries(releaseByContract)) {
      const n = rule.count(r);
      const job = jobOf(contractId);
      if (n > 0 && job) {
        items.push({ key: `${rule.id}-${contractId}`, jobLabel: job.jobOrderNo ?? job.referenceNumber, project: job.projectName, text: rule.text(n), stage: null, contractId });
      }
    }
  }
  for (const a of needsAttention) {
    items.push({ key: `wf-${a.contractId}-${a.reason}`, jobLabel: a.jobOrderNo ?? a.referenceNumber, project: a.projectName, text: '', stage: a.stage, contractId: a.contractId });
  }
  return items.slice(0, limit);
}
