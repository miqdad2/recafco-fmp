import { TechnicalDrawingGroupStatus as S } from '@recafco/database';

// ---------------------------------------------------------------------------
// FMP-TECH-27 — final drawing coverage of individual elements.
//
// Every element is its own record. Before release it must be covered by final
// drawing files in one of two ways:
//   * GROUP       — it sits in an active Drawing Group that has at least one file;
//   * INDIVIDUAL  — it has final drawing files attached to the element itself.
// Only covered elements can be released. An element in a group is released through
// that group; an element covered individually is released on its own.
// ---------------------------------------------------------------------------

export type ElementCoverage = 'GROUP' | 'INDIVIDUAL' | 'NONE';
export type ElementReleaseState = 'WAITING' | 'READY' | 'RELEASED';

export interface ElementCoverageInput {
  /** The element's active drawing group, if any (cancelled / revised groups never appear here). */
  group: { status: S; fileCount: number } | null;
  /** Final drawing files attached to the element itself. */
  individualFileCount: number;
  releasedToProductionAt: Date | string | null;
}

export interface ElementCoverageResult {
  coverage: ElementCoverage;
  releaseState: ElementReleaseState;
}

export function classifyElement(input: ElementCoverageInput): ElementCoverageResult {
  const groupCovered = input.group !== null && input.group.fileCount > 0;
  const coverage: ElementCoverage = groupCovered ? 'GROUP' : input.individualFileCount > 0 ? 'INDIVIDUAL' : 'NONE';

  const released = input.group?.status === S.RELEASED_TO_PRODUCTION || input.releasedToProductionAt !== null;
  const releaseState: ElementReleaseState = released ? 'RELEASED' : coverage !== 'NONE' ? 'READY' : 'WAITING';
  return { coverage, releaseState };
}

export interface ElementCoverageSummary {
  totalElements: number;
  coveredByGroup: number;
  coveredIndividually: number;
  notCovered: number;
  readyToRelease: number;
  released: number;
}

export function summarizeCoverage(rows: ElementCoverageResult[]): ElementCoverageSummary {
  return {
    totalElements: rows.length,
    coveredByGroup: rows.filter((r) => r.coverage === 'GROUP').length,
    coveredIndividually: rows.filter((r) => r.coverage === 'INDIVIDUAL').length,
    notCovered: rows.filter((r) => r.coverage === 'NONE').length,
    readyToRelease: rows.filter((r) => r.releaseState === 'READY').length,
    released: rows.filter((r) => r.releaseState === 'RELEASED').length,
  };
}

/** Why an element cannot be released yet, in plain words (null = it can be released on its own). */
export function individualReleaseBlocker(input: ElementCoverageInput & { cancelled: boolean }): string | null {
  if (input.cancelled) return 'This element is cancelled.';
  if (input.group !== null) return 'This element is in a Drawing Group. Release its group instead.';
  const { coverage, releaseState } = classifyElement(input);
  if (releaseState === 'RELEASED') return 'This element is already released to Production.';
  if (coverage === 'NONE') return 'Final drawing coverage is required before release to Production.';
  return null;
}
