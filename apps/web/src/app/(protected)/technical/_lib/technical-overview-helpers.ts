import type { TechnicalJobRow, JobReleaseSummary, TechnicalBoqAttentionSummary } from '@/lib/technical-api';
import type { TechnicalAttentionRow } from './technical-dashboard-selector-helpers';

// ---------------------------------------------------------------------------
// FMP-TECH-17 — plain-language helpers for the common Technical Overview.
// Everything is derived from data the dashboard endpoint already returns
// (`jobs` + `releaseByContract` + `boqAttention` + `metrics`); nothing new is
// fetched, written, or invented. Internal workflow terms (SD & Calc., FD
// Issuance, Generated, Grouped, Assigned) are deliberately kept out of these
// labels — they stay on the detail pages.
// ---------------------------------------------------------------------------

export type TechnicalOverviewStatus =
  | 'Not Started'
  | 'BOQ Drawings Available'
  | 'Elements Not Confirmed'
  | 'Elements Confirmed'
  | 'Waiting Final Drawing'
  | 'Partially Covered'
  | 'Ready to Release'
  | 'Released to Production';

export type ProductionReleaseStatus = 'Not ready' | 'Waiting final drawings' | 'Waiting release' | 'Released';

type JobInput = Pick<TechnicalJobRow, 'workflowStarted' | 'currentStage'>;

/** Elements with final drawing coverage: in a group that has files, or with their own files. */
export function coveredElements(r: JobReleaseSummary): number {
  return r.filesAttachedPieces + (r.individuallyCovered ?? 0);
}

/** Elements released to Production, through a group or on their own. */
export function releasedElements(r: JobReleaseSummary): number {
  return r.released + (r.individuallyReleased ?? 0);
}

export function technicalOverviewStatus(job: JobInput, release: JobReleaseSummary | undefined): TechnicalOverviewStatus {
  if (!job.workflowStarted) return 'Not Started';
  if (!release || (release.confirmed === 0 && release.generated === 0)) {
    return job.currentStage === 'DRAWING_RECEIVED' ? 'BOQ Drawings Available' : 'Elements Not Confirmed';
  }
  if (release.generated === 0) return 'Elements Confirmed';
  // FMP-TECH-27 — Drawing Groups are optional. An element is covered by its group's final files or by its own;
  // the project is Ready to Release only when every element is covered.
  const covered = coveredElements(release);
  if (covered === 0) return 'Waiting Final Drawing';
  if (covered < release.generated) return 'Partially Covered';
  if (releasedElements(release) >= release.generated) return 'Released to Production';
  return 'Ready to Release';
}

export function productionReleaseStatus(status: TechnicalOverviewStatus, release: JobReleaseSummary | undefined): ProductionReleaseStatus {
  if (status === 'Released to Production') return 'Released';
  if (status === 'Ready to Release') return 'Waiting release';
  if (status === 'Waiting Final Drawing' || status === 'Partially Covered') {
    return release && releasedElements(release) > 0 ? 'Waiting release' : 'Waiting final drawings';
  }
  return 'Not ready';
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** One short user-friendly line about the job's elements. */
export function piecesStatusText(job: JobInput, release: JobReleaseSummary | undefined): string {
  if (!job.workflowStarted || !release || (release.confirmed === 0 && release.generated === 0)) return 'Not confirmed';
  if (release.generated === 0) return `${plural(release.confirmed, 'element', 'elements')} confirmed`;
  const base = `${plural(release.generated, 'element', 'elements')} generated`;
  const covered = coveredElements(release);
  if (covered === 0) return `${base} · waiting for final drawings`;
  return covered >= release.generated ? `${base} · all have final drawings` : `${base} · ${covered} with final drawings`;
}

export function overviewNextAction(status: TechnicalOverviewStatus): string {
  switch (status) {
    case 'Not Started': return 'Start Technical Work';
    case 'BOQ Drawings Available':
    case 'Elements Not Confirmed': return 'Confirm Elements';
    case 'Elements Confirmed': return 'Generate elements';
    case 'Waiting Final Drawing':
    case 'Partially Covered': return 'Add Final Drawing Files';
    case 'Ready to Release': return 'Release to Production';
    case 'Released to Production': return 'No action needed';
  }
}

export interface TechnicalOverviewRow {
  job: TechnicalJobRow;
  status: TechnicalOverviewStatus;
  piecesText: string;
  production: ProductionReleaseStatus;
  nextAction: string;
}

export function buildOverviewRows(jobs: TechnicalJobRow[], releaseByContract: Record<string, JobReleaseSummary>): TechnicalOverviewRow[] {
  return jobs.map((job) => {
    const release = releaseByContract[job.contractId];
    const status = technicalOverviewStatus(job, release);
    return { job, status, piecesText: piecesStatusText(job, release), production: productionReleaseStatus(status, release), nextAction: overviewNextAction(status) };
  });
}

/** Search by job order, contract no., project name, or client. */
export function filterOverviewRows(rows: TechnicalOverviewRow[], query: string): TechnicalOverviewRow[] {
  const q = query.trim().toLowerCase();
  if (q === '') return rows;
  return rows.filter(({ job }) =>
    (job.jobOrderNo?.toLowerCase().includes(q) ?? false) ||
    job.referenceNumber.toLowerCase().includes(q) ||
    job.projectName.toLowerCase().includes(q) ||
    job.clientEmployer.toLowerCase().includes(q),
  );
}

export interface OverviewSummary {
  projectsInTechnical: number;
  drawingsReceived: number;
  piecesNotConfirmed: number;
  readyForProduction: number;
}

/**
 * The 4 summary cards, all counted in projects. "Drawings Received" = projects
 * whose Technical work has started (the drawing-received step is where it
 * begins); "Elements Not Confirmed" reuses the API's own missing-confirmation
 * count; "Ready for Production" = projects with all groups filed and ready, or
 * already released.
 */
export function buildOverviewSummary(rows: TechnicalOverviewRow[], boqAttention: TechnicalBoqAttentionSummary): OverviewSummary {
  return {
    projectsInTechnical: rows.length,
    drawingsReceived: rows.filter((r) => r.job.workflowStarted).length,
    piecesNotConfirmed: boqAttention.missingBoqConfirmation,
    readyForProduction: rows.filter((r) => r.status === 'Ready to Release' || r.status === 'Released to Production').length,
  };
}

/** The single Needs Attention panel's 5 plain-language rows. */
export function buildOverviewAttentionRows(input: {
  boqAttention: TechnicalBoqAttentionSummary;
  waitingApproval: number;
  releaseByContract: Record<string, JobReleaseSummary>;
}): TechnicalAttentionRow[] {
  const all = Object.values(input.releaseByContract);
  const sum = (fn: (r: JobReleaseSummary) => number): number => all.reduce((t, r) => t + fn(r), 0);
  return [
    { label: 'Elements Not Confirmed', value: input.boqAttention.missingBoqConfirmation, tone: 'warning' },
    { label: 'Elements Waiting Final Drawing', value: sum((r) => Math.max(0, r.generated - coveredElements(r))), tone: 'warning' },
    { label: 'Groups Without Files', value: sum((r) => r.groupsNoFiles), tone: 'warning' },
    { label: 'Groups Not Released', value: sum((r) => r.groupsNotReleased), tone: 'warning' },
    { label: 'Waiting Approval', value: input.waitingApproval, tone: 'warning' },
  ];
}

export const OVERVIEW_STATUS_TONE: Record<TechnicalOverviewStatus, 'muted' | 'info' | 'warning' | 'success'> = {
  'Not Started': 'muted',
  'BOQ Drawings Available': 'info',
  'Elements Not Confirmed': 'warning',
  'Elements Confirmed': 'info',
  'Waiting Final Drawing': 'warning',
  'Partially Covered': 'warning',
  'Ready to Release': 'success',
  'Released to Production': 'success',
};

// ---------------------------------------------------------------------------
// FMP-TECH-18 — quick filters. Pure functions over the rows already built.
// ---------------------------------------------------------------------------

export type OverviewFilter = 'all' | 'new' | 'needs-pieces' | 'needs-final' | 'ready' | 'released';

export const OVERVIEW_FILTERS: { key: OverviewFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'needs-pieces', label: 'Needs Elements' },
  { key: 'needs-final', label: 'Needs Final Drawings' },
  { key: 'ready', label: 'Ready for Production' },
  { key: 'released', label: 'Released' },
];

const FILTER_STATUSES: Record<Exclude<OverviewFilter, 'all'>, TechnicalOverviewStatus[]> = {
  'new': ['Not Started'],
  'needs-pieces': ['BOQ Drawings Available', 'Elements Not Confirmed', 'Elements Confirmed'],
  'needs-final': ['Waiting Final Drawing', 'Partially Covered'],
  'ready': ['Ready to Release'],
  'released': ['Released to Production'],
};

export function filterRowsByQuickFilter(rows: TechnicalOverviewRow[], filter: OverviewFilter): TechnicalOverviewRow[] {
  if (filter === 'all') return rows;
  const allowed = FILTER_STATUSES[filter];
  return rows.filter((r) => allowed.includes(r.status));
}

export function quickFilterCounts(rows: TechnicalOverviewRow[]): Record<OverviewFilter, number> {
  const counts = { all: rows.length } as Record<OverviewFilter, number>;
  for (const f of OVERVIEW_FILTERS) if (f.key !== 'all') counts[f.key] = filterRowsByQuickFilter(rows, f.key).length;
  return counts;
}

/** Which quick filter a Needs Attention row narrows the table to (null = counts only). */
export const ATTENTION_FILTERS: Record<string, OverviewFilter | null> = {
  'Elements Not Confirmed': 'needs-pieces',
  'Elements Waiting Final Drawing': 'needs-final',
  'Groups Without Files': 'needs-final',
  'Groups Not Released': 'ready',
  'Waiting Approval': null,
};
