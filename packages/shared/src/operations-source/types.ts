// ---------------------------------------------------------------------------
// FMP-OPS-01 — shared types for the read-only Operations source integration.
//
// Only fields that the source's own documentation (READ-ME-FIRST + the 92/25
// API reference, 21 Oct 2026) and its example client describe are modelled
// here. Anything else the response carries is NOT interpreted; its key names
// are recorded as `unrecognisedKeys` for provenance.
// ---------------------------------------------------------------------------

/** Query used for the one documented progress request. Nothing else is requested by default. */
export const OPERATIONS_REPORT_GROUP_BY = 'building';
export const OPERATIONS_REPORT_COLUMNS = 'total,issued,produced,delivered,installed';

/** Largest value that fits the INTEGER columns that store the counts. */
export const OPERATIONS_MAX_COUNT = 2_147_483_647;

import type { Breakdown, HistoricalFigures, OperationsMeasures } from './extended';

/** Project-level aggregate (the six required totals). Use ONCE; never add to rows or tree subtotals. */
export interface OperationsTotals {
  /** totals.total — current approved GA requirements, pieces. */
  total: number;
  /** totals.issued — issued for production, pieces. */
  issued: number;
  /** totals.produced — produced, pieces (cumulative, overlaps delivered/installed). */
  produced: number;
  /** totals.delivered — delivered, pieces (also counted in produced). */
  delivered: number;
  /** totals.installed — erected, pieces (cumulative, overlaps produced/delivered). */
  installed: number;
  /** totals.pending_inputs — pieces with outstanding earlier-stage input details. */
  pendingInputs: number;
}

export const OPERATIONS_TOTAL_FIELDS = ['total', 'issued', 'produced', 'delivered', 'installed', 'pendingInputs'] as const;
export type OperationsTotalField = (typeof OPERATIONS_TOTAL_FIELDS)[number];

export interface ParsedProgressReport {
  sourceProjectId: string;
  /** project.code — the job order as the source writes it (e.g. "92/25"). */
  code: string | null;
  /** project.project_type — the factory / branch (e.g. "PC"). */
  factory: string | null;
  /** project.name — display only; never used for automatic linking. */
  name: string | null;
  totals: OperationsTotals;
  /** generated_at — when the source generated THIS response. Not last activity. */
  generatedAt: Date;
  /** Derived from `review_required` only when it is a boolean; otherwise null (unclear). */
  reviewRequiredFlag: boolean | null;
  /** `review_required` exactly as supplied (size-capped) so nothing is lost. */
  reviewRequiredRaw: unknown;
  /** `notes` when it is an array of strings; otherwise []. */
  sourceNotes: string[];
  /** Top-level keys that FMP does not interpret (names only). */
  unrecognisedKeys: string[];
  /** Whether a `historical` object was present. */
  historicalPresent: boolean;
  /**
   * Optional richer figures from `totals` (balances, stock, source percentages, volume/area/length and the
   * missing-measurement counts). Only keys the source supplied and that validated are present.
   */
  measures: OperationsMeasures;
  /** Whole-project physical history: separate from the current figures, never reconciled with them. */
  historical: HistoricalFigures | null;
  /** `rows` as a breakdown (never added to the totals). */
  breakdown: Breakdown | null;
  /** review_notes as text lines. */
  reviewNotes: string[];
  /** conflict_marks: how many the source reported, plus the raw entries (size-capped) for investigation. */
  conflictMarks: { count: number; raw: unknown } | null;
  /** Non-fatal observations about the response shape. */
  shapeWarnings: string[];
}

export type ReportRejectionCode =
  | 'MALFORMED'
  | 'IDENTITY_MISMATCH'
  | 'INVALID_FIELD'
  | 'INVALID_TIMESTAMP'
  | 'FUTURE_TIMESTAMP'
  /** The response was filtered (a level/building), so it is NOT the whole-project report we asked for. */
  | 'SCOPE_MISMATCH';

export type ReportParseResult =
  | { ok: true; report: ParsedProgressReport }
  | { ok: false; code: ReportRejectionCode; message: string };

export type FlagSeverity = 'info' | 'warning';

export interface SnapshotFlag {
  code: string;
  severity: FlagSeverity;
  message: string;
}

export interface FieldChange {
  field: OperationsTotalField;
  from: number;
  to: number;
}

export type PublicationDecision = 'PUBLISH' | 'DUPLICATE' | 'OLDER';
