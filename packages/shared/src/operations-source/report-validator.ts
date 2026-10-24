import { pickBreakdown, pickHistorical, pickMeasures } from './extended';
import {
  OPERATIONS_MAX_COUNT,
  type OperationsTotals,
  type ParsedProgressReport,
  type ReportParseResult,
} from './types';

// Runtime validation of the source's progress response. Mirrors the checks in
// the source's own example client (project identity, integer totals, a
// generation time) and adds bounds the client does not have. A response that
// fails ANY check is rejected whole: it must never be repaired, zero-filled or
// partially applied.

// Keys FMP understands. `tree` and `kpis` are duplicates of totals/rows in other shapes: recognised, deliberately NOT
// stored or used, so they can never be added to the totals. The rest are presentation/export metadata.
const KNOWN_TOP_LEVEL_KEYS = new Set([
  'project', 'totals', 'generated_at', 'review_required', 'review_notes', 'conflict_marks', 'notes', 'historical', 'rows', 'tree', 'kpis',
  'fields', 'columns', 'column_labels', 'group_labels', 'export_basename', 'level', 'building_id', 'building_name', 'filtered', 'legend',
]);
const REQUIRED_TOTAL_FIELDS = [
  ['total', 'total'],
  ['issued', 'issued'],
  ['produced', 'produced'],
  ['delivered', 'delivered'],
  ['installed', 'installed'],
  ['pending_inputs', 'pendingInputs'],
] as const;

/** ISO-8601 with an explicit offset. A timestamp without one is ambiguous and is rejected. */
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** A response claiming to be generated further ahead than this is not trusted (it would block newer data). */
export const MAX_CLOCK_SKEW_MS = 10 * 60_000;

const MAX_NOTES = 20;
const MAX_NOTE_LENGTH = 500;
const MAX_RAW_REVIEW_JSON = 4_000;
const MAX_UNRECOGNISED_KEYS = 30;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t === '') return null;
  return t.length > max ? t.slice(0, max) : t;
}

export function parseProgressReport(body: unknown, expectedProjectId: string, now: Date = new Date()): ReportParseResult {
  if (!isRecord(body)) return { ok: false, code: 'MALFORMED', message: 'The source response is not a JSON object.' };

  const project = body['project'];
  if (!isRecord(project)) return { ok: false, code: 'MALFORMED', message: 'The source response is missing project information.' };
  // Project isolation: a response for any other project is never used.
  if (project['id'] !== expectedProjectId) {
    return { ok: false, code: 'IDENTITY_MISMATCH', message: 'The response belongs to a different project and was discarded.' };
  }

  const rawTotals = body['totals'];
  if (!isRecord(rawTotals)) return { ok: false, code: 'MALFORMED', message: 'The source response is missing progress totals.' };

  const totals: Partial<OperationsTotals> = {};
  for (const [sourceKey, ourKey] of REQUIRED_TOTAL_FIELDS) {
    const value = rawTotals[sourceKey];
    // Missing, null, string, float, negative or absurdly large: reject — never treat as zero.
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > OPERATIONS_MAX_COUNT) {
      return { ok: false, code: 'INVALID_FIELD', message: `Missing or invalid totals.${sourceKey}; the response was discarded.` };
    }
    totals[ourKey] = value;
  }

  // We always ask for the whole project. A filtered report is a different scope and must not become the project's figures.
  const filtered = body['filtered'];
  const scopeFields = ['level', 'building_id', 'building_name'] as const;
  if (filtered === true || scopeFields.some((k) => typeof body[k] === 'string' && body[k] !== 'All')) {
    return { ok: false, code: 'SCOPE_MISMATCH', message: 'The response is filtered to part of the project, not the whole project; it was discarded.' };
  }

  const generatedRaw = body['generated_at'];
  if (typeof generatedRaw !== 'string' || generatedRaw === '') {
    return { ok: false, code: 'INVALID_TIMESTAMP', message: 'The source response is missing its generation time.' };
  }
  if (!ISO_WITH_OFFSET.test(generatedRaw) || Number.isNaN(Date.parse(generatedRaw))) {
    return { ok: false, code: 'INVALID_TIMESTAMP', message: 'The source generation time is not a valid timestamp with a time zone.' };
  }
  const generatedAt = new Date(generatedRaw);
  if (generatedAt.getTime() > now.getTime() + MAX_CLOCK_SKEW_MS) {
    return { ok: false, code: 'FUTURE_TIMESTAMP', message: 'The source generation time is in the future; the response was not trusted.' };
  }

  const shapeWarnings: string[] = [];

  const code = cleanText(project['code'], 100);
  const factory = cleanText(project['project_type'], 20);
  const name = cleanText(project['name'], 300);
  if (code === null) shapeWarnings.push('project.code was not supplied.');
  if (factory === null) shapeWarnings.push('project.project_type was not supplied.');

  // review_required: shape is not documented. Keep it verbatim (capped) and only derive a flag from a boolean.
  let reviewRequiredFlag: boolean | null = null;
  let reviewRequiredRaw: unknown = null;
  if ('review_required' in body) {
    const rr = body['review_required'];
    if (typeof rr === 'boolean') {
      reviewRequiredFlag = rr;
      reviewRequiredRaw = rr;
    } else if (rr !== null && rr !== undefined) {
      const serialised = safeStringify(rr);
      if (serialised !== null && serialised.length <= MAX_RAW_REVIEW_JSON) reviewRequiredRaw = rr;
      shapeWarnings.push('review_required is not a boolean; its meaning is not interpreted.');
    }
  }

  // notes: documented only as `report.get("notes", [])`. Accept an array of strings.
  let sourceNotes: string[] = [];
  if ('notes' in body && body['notes'] !== null && body['notes'] !== undefined) {
    const n = body['notes'];
    if (Array.isArray(n) && n.every((x) => typeof x === 'string')) {
      sourceNotes = (n as string[]).slice(0, MAX_NOTES).map((x) => x.slice(0, MAX_NOTE_LENGTH));
    } else {
      shapeWarnings.push('notes is not a list of text lines and was not stored.');
    }
  }

  // Richer optional figures: present-and-valid only. Never zero-filled.
  const rejectedMeasures: string[] = [];
  const measures = pickMeasures(rawTotals, rejectedMeasures);
  const rows = body['rows'];
  const fields = body['fields'];
  const groupField = Array.isArray(fields) && typeof fields[0] === 'string' ? fields[0] : null;
  const breakdown = pickBreakdown(rows, groupField, rejectedMeasures);
  const historical = pickHistorical(body['historical'], rejectedMeasures);
  if (rejectedMeasures.length > 0) shapeWarnings.push('Some optional figures had an unexpected type and were not stored: ' + [...new Set(rejectedMeasures)].slice(0, 6).join(', ') + '.');
  if ('rows' in body && breakdown === null) shapeWarnings.push('rows could not be read as a breakdown and was not stored.');

  let reviewNotes: string[] = [];
  const rn = body['review_notes'];
  if (Array.isArray(rn)) {
    if (rn.every((x) => typeof x === 'string')) reviewNotes = (rn as string[]).slice(0, MAX_NOTES).map((x) => x.slice(0, MAX_NOTE_LENGTH));
    else shapeWarnings.push('review_notes is not a list of text lines and was not stored.');
  }
  let conflictMarks: { count: number; raw: unknown } | null = null;
  const cm = body['conflict_marks'];
  if (Array.isArray(cm)) {
    const serialised = safeStringify(cm.slice(0, 50));
    conflictMarks = { count: cm.length, raw: serialised !== null && serialised.length <= MAX_RAW_REVIEW_JSON ? cm.slice(0, 50) : null };
  }

  const unrecognisedKeys = Object.keys(body)
    .filter((k) => !KNOWN_TOP_LEVEL_KEYS.has(k))
    .slice(0, MAX_UNRECOGNISED_KEYS)
    .map((k) => k.slice(0, 60));

  const parsed: ParsedProgressReport = {
    sourceProjectId: expectedProjectId,
    code,
    factory,
    name,
    totals: totals as OperationsTotals,
    generatedAt,
    reviewRequiredFlag,
    reviewRequiredRaw,
    sourceNotes,
    unrecognisedKeys,
    historicalPresent: isRecord(body['historical']),
    measures,
    historical,
    breakdown,
    reviewNotes,
    conflictMarks,
    shapeWarnings,
  };
  return { ok: true, report: parsed };
}

function safeStringify(v: unknown): string | null {
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}
