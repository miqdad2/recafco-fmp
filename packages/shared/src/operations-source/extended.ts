// ---------------------------------------------------------------------------
// FMP-OPS-03 — the richer source report (verified live 22 Oct 2026 with the supplied demo sign-in) and the
// source project list. Shapes below are exactly what the captured responses contain; anything not present stays
// absent (never zero-filled) and anything unrecognised is only recorded by name.
// ---------------------------------------------------------------------------

const STAGES = ['total', 'issued', 'produced', 'delivered', 'installed'] as const;
const UNITS = ['volume', 'area', 'length'] as const;

/** Signed whole-number measures (a balance or stock can be negative if the source data is inconsistent). */
const SIGNED_COUNT_KEYS = ['balance_produce', 'balance_deliver', 'stock'] as const;
/** Non-negative whole-number measures. */
const COUNT_KEYS = ['drawings', 'scheduled', 'missing_cast_volume', 'missing_concrete'] as const;
/** Source-calculated ratios ("of GA requirement"). FMP never computes these itself. */
export const PERCENT_KEYS = ['issued_pct', 'produced_pct', 'balance_produce_pct', 'delivered_pct', 'balance_deliver_pct', 'installed_pct'] as const;
/** Physical quantities: volume (m³), area (m²), length (LM) per stage, plus current cast volume. */
const QUANTITY_KEYS = ['cast_volume', ...STAGES.flatMap((s) => UNITS.map((u) => `${s}_${u}`))] as const;
/** Number of pieces whose measurement is unknown, per quantity. Unknown is NOT zero. */
const MISSING_KEYS = STAGES.flatMap((s) => UNITS.map((u) => `missing_${s}_${u}`));

export const OPERATIONS_MEASURE_KEYS: readonly string[] = [
  ...SIGNED_COUNT_KEYS,
  ...COUNT_KEYS,
  ...PERCENT_KEYS,
  ...QUANTITY_KEYS,
  ...MISSING_KEYS,
];

const MEASURE_KIND = new Map<string, 'signed_count' | 'count' | 'percent' | 'quantity'>([
  ...SIGNED_COUNT_KEYS.map((k) => [k, 'signed_count'] as const),
  ...COUNT_KEYS.map((k) => [k, 'count'] as const),
  ...PERCENT_KEYS.map((k) => [k, 'percent'] as const),
  ...QUANTITY_KEYS.map((k) => [k, 'quantity'] as const),
  ...MISSING_KEYS.map((k) => [k, 'count'] as const),
]);

/** Only the supplied, valid measures. A key that is absent here is "not supplied by source". */
export type OperationsMeasures = Record<string, number>;

export const HISTORICAL_KEYS = ['produced', 'delivered', 'installed', 'factory_stock', 'cast_volume', 'unallocated_produced', 'held', 'surplus', 'rejected'] as const;
export type HistoricalKey = (typeof HISTORICAL_KEYS)[number];
/** Whole-project physical history. Kept apart from the current figures and never reconciled with them. */
export type HistoricalFigures = Partial<Record<HistoricalKey, number>>;

export interface BreakdownRow {
  /** The row's group label, e.g. the building name. */
  label: string;
  values: OperationsMeasures;
}

export interface Breakdown {
  /** Source grouping field (we always request "building"). */
  groupField: string;
  rows: BreakdownRow[];
  /** True if more rows were supplied than FMP keeps. */
  truncated: boolean;
}

export const MAX_BREAKDOWN_ROWS = 200;
const MAX_ABS = 1e12;

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_ABS;
}

/**
 * Keeps only the measures that are present AND valid for their kind. Wrong-typed or out-of-range values are dropped
 * (and reported), never replaced by zero.
 */
export function pickMeasures(source: Record<string, unknown>, rejected?: string[]): OperationsMeasures {
  const out: OperationsMeasures = {};
  for (const [key, kind] of MEASURE_KIND) {
    if (!(key in source)) continue;
    const v = source[key];
    let ok = false;
    if (finite(v)) {
      if (kind === 'signed_count') ok = Number.isInteger(v);
      else if (kind === 'count') ok = Number.isInteger(v) && v >= 0;
      else if (kind === 'percent') ok = true;
      else ok = v >= 0;
    }
    if (ok) out[key] = v as number;
    else rejected?.push(key);
  }
  return out;
}

export function pickHistorical(source: unknown, rejected?: string[]): HistoricalFigures | null {
  if (typeof source !== 'object' || source === null || Array.isArray(source)) return null;
  const rec = source as Record<string, unknown>;
  const out: HistoricalFigures = {};
  for (const key of HISTORICAL_KEYS) {
    if (!(key in rec)) continue;
    const v = rec[key];
    if (finite(v) && v >= 0) out[key] = v;
    else rejected?.push(`historical.${key}`);
  }
  return out;
}

/** The six core counts also appear on every breakdown row (per building); they are kept per row, never summed. */
const ROW_CORE_KEYS = ['total', 'issued', 'produced', 'delivered', 'installed', 'pending_inputs'] as const;

export function pickBreakdown(rows: unknown, groupField: string | null, rejected?: string[]): Breakdown | null {
  if (!Array.isArray(rows) || groupField === null) return null;
  const kept: BreakdownRow[] = [];
  for (const raw of rows.slice(0, MAX_BREAKDOWN_ROWS)) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue;
    const rec = raw as Record<string, unknown>;
    const label = rec[groupField];
    if (typeof label !== 'string' || label.trim() === '') continue;
    const values = pickMeasures(rec, rejected);
    for (const k of ROW_CORE_KEYS) {
      const v = rec[k];
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_ABS) values[k] = v;
    }
    kept.push({ label: label.trim().slice(0, 200), values });
  }
  return { groupField, rows: kept, truncated: rows.length > MAX_BREAKDOWN_ROWS };
}

// ---------------------------------------------------------------------------
// Project list (GET /api/projects)
// ---------------------------------------------------------------------------

export interface SourceProjectListItem {
  id: string;
  code: string | null;
  name: string | null;
  /** project.project_type — the factory/branch (PC / HC). Empty or absent => unknown. */
  factory: string | null;
  /** Explicit flag from the source. `null` = the source did not say (treated as NOT eligible). */
  isTraining: boolean | null;
}

export type ProjectListParseResult =
  | { ok: true; projects: SourceProjectListItem[]; skipped: number }
  | { ok: false; message: string };

export const MAX_PROJECT_LIST = 5000;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,199}$/;

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t.slice(0, max);
}

/**
 * Validates the whole list. A response that is not an array, is implausibly large, or contains duplicate ids is
 * rejected whole (the previous knowledge stays). An individual malformed entry is skipped and counted.
 */
export function parseProjectList(body: unknown): ProjectListParseResult {
  if (!Array.isArray(body)) return { ok: false, message: 'The project list is not a JSON array.' };
  if (body.length > MAX_PROJECT_LIST) return { ok: false, message: 'The project list is larger than expected and was discarded.' };
  const seen = new Set<string>();
  const projects: SourceProjectListItem[] = [];
  let skipped = 0;
  for (const raw of body) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) { skipped += 1; continue; }
    const r = raw as Record<string, unknown>;
    const id = typeof r['id'] === 'string' ? r['id'].trim() : '';
    if (!ID_PATTERN.test(id)) { skipped += 1; continue; }
    if (seen.has(id)) return { ok: false, message: 'The project list repeats a project id; it was discarded.' };
    seen.add(id);
    projects.push({
      id,
      code: text(r['code'], 100),
      name: text(r['name'], 300),
      factory: text(r['project_type'], 20),
      isTraining: typeof r['is_training'] === 'boolean' ? r['is_training'] : null,
    });
  }
  return { ok: true, projects, skipped };
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export type ExclusionReason = 'TRAINING' | 'CONFIGURED_EXCLUSION' | 'TRAINING_STATUS_UNKNOWN' | 'NO_FACTORY';

/**
 * A project is eligible for linking and progress retrieval only when the source explicitly says it is not a training
 * project, it carries a factory, and it is not on the configured exclusion list (e.g. a described test project that is
 * flagged is_training=false). Returns null when eligible.
 */
export function exclusionReasonFor(p: SourceProjectListItem, configuredExclusions: ReadonlySet<string>): ExclusionReason | null {
  if (configuredExclusions.has(p.id)) return 'CONFIGURED_EXCLUSION';
  if (p.isTraining === true) return 'TRAINING';
  if (p.isTraining === null) return 'TRAINING_STATUS_UNKNOWN';
  if (p.factory === null) return 'NO_FACTORY';
  return null;
}
