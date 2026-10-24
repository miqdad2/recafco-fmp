import type { MonitoringState, OperationsTotals, ProgressWarning, FieldChange } from '@/lib/operations-api';

// ---------------------------------------------------------------------------
// FMP-OPS-01 — display helpers for the Operations progress screens.
// Wording and mapping follow the approved business direction exactly.
// ---------------------------------------------------------------------------

export const NOT_SUPPLIED = 'Not supplied by source';

/** Whole-piece count with thousands separators. */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** Kuwait local time, e.g. "21 Oct 2026, 13:25". Dates are always shown in Kuwait time. */
export function formatKuwaitDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Kuwait',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "just now", "3 min ago", "2 h ago", "4 days ago". */
export function formatAge(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const secs = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(secs)) return '—';
  if (secs < 45) return 'just now';
  if (secs < 3600) return `${Math.round(secs / 60)} min ago`;
  if (secs < 86_400) return `${Math.round(secs / 3600)} h ago`;
  return `${Math.round(secs / 86_400)} days ago`;
}

export interface StageDef {
  key: 'technical' | 'production' | 'delivery' | 'erection';
  title: string;
  /** Label of the headline figure, as approved. */
  figureLabel: string;
  field: keyof Pick<OperationsTotals, 'issued' | 'produced' | 'delivered' | 'installed'>;
  /** What this figure means — and what it must not be read as. Shown under the number. */
  meaning: string;
  /** Things this stage would normally show that the source does not supply (never invented). */
  notSupplied: string[];
}

/**
 * Mapping (approved wording):
 *   totals.total   -> Current approved GA requirements, in pieces
 *   totals.issued  -> Issued for production (with the pending-input qualification)
 *   totals.produced  -> Produced elements, cumulative
 *   totals.delivered -> Delivered elements, cumulative, including erected elements
 *   totals.installed -> Erected elements
 *   totals.pending_inputs -> Outstanding earlier-stage input details
 * Produced, delivered and erected overlap; they are never added together. "Issued" is not technical completion and
 * "erected" is not final acceptance or contract completion.
 */
export const STAGES: StageDef[] = [
  {
    key: 'technical', title: 'Technical', figureLabel: 'Issued for production', field: 'issued',
    meaning: 'Pieces issued for production, including confirmed “Done – pending input” issues. This is not technical completion.',
    notSupplied: ['Drawing counts', 'Drawing completion', 'BOQ progress'],
  },
  {
    key: 'production', title: 'Production & Planning', figureLabel: 'Produced elements', field: 'produced',
    meaning: 'Cumulative count. Overlaps the delivered and erected elements.',
    notSupplied: ['Casting schedule', 'Production by BOQ item'],
  },
  {
    key: 'delivery', title: 'Delivery', figureLabel: 'Delivered elements', field: 'delivered',
    meaning: 'Cumulative count. Includes elements that have already been erected.',
    notSupplied: ['Storage yard figures', 'Delivery schedule'],
  },
  {
    key: 'erection', title: 'Erection', figureLabel: 'Erected elements', field: 'installed',
    meaning: 'Cumulative erected count. It is not final acceptance or contract completion.',
    notSupplied: ['Erection schedule', 'Detailed erection records'],
  },
];

export const DEMO_BANNER = 'Demonstration data — live source not connected';

/** The one-line label for a contract's operational connection (never its commercial status). */
export const STATE_LABELS: Record<MonitoringState, string> = {
  NOT_LINKED: 'Not connected to Operations',
  WAITING_FIRST_UPDATE: 'Linked, waiting for first update',
  UPDATED: 'Updated successfully',
  DELAYED: 'Update delayed or source unavailable',
  DEMONSTRATION: DEMO_BANNER,
};

export type StateTone = 'neutral' | 'info' | 'success' | 'warning' | 'demo';

export const STATE_TONES: Record<MonitoringState, StateTone> = {
  NOT_LINKED: 'neutral',
  WAITING_FIRST_UPDATE: 'info',
  UPDATED: 'success',
  DELAYED: 'warning',
  DEMONSTRATION: 'demo',
};

/** Tailwind classes per tone (semantic tokens only). */
export const TONE_CLASSES: Record<StateTone, string> = {
  neutral: 'bg-surface-secondary text-text-secondary',
  info: 'bg-info-light text-info',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
  demo: 'bg-error-light text-error',
};

/** The sentence shown when the latest update failed but earlier figures are kept. */
export function delayedMessage(lastSuccessfulRetrievalAt: string | null, reason: string | null): string {
  const when = lastSuccessfulRetrievalAt
    ? ' Figures retrieved ' + formatKuwaitDateTime(lastSuccessfulRetrievalAt) + ' (' + formatAge(lastSuccessfulRetrievalAt) + ').'
    : '';
  return 'Update delayed — showing the last accepted figures.' + when + (reason ? ' ' + reason : '');
}

export const REQUIREMENT_LABEL = 'Current approved GA requirements';
export const PENDING_INPUTS_LABEL = 'Outstanding earlier-stage input details';

/**
 * Share of the current requirement a stage count represents, for a thin bar only.
 * It is a ratio of two piece counts — never presented as "completion". 0..100; null when the requirement is 0.
 */
export function stageShare(count: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.max(0, Math.min(100, (count / total) * 100));
}

export const FIELD_LABELS: Record<keyof OperationsTotals, string> = {
  total: REQUIREMENT_LABEL,
  issued: 'Issued for production',
  produced: 'Produced',
  delivered: 'Delivered',
  installed: 'Erected',
  pendingInputs: 'Outstanding input details',
};

export function describeChange(c: FieldChange): string {
  const delta = c.to - c.from;
  const sign = delta > 0 ? '+' : '';
  return `${FIELD_LABELS[c.field]}: ${formatCount(c.from)} → ${formatCount(c.to)} (${sign}${formatCount(delta)})`;
}

const OUTCOME_LABELS: Record<string, string> = {
  ACCEPTED: 'Updated',
  UNCHANGED: 'Checked, no change',
  REJECTED_OLDER: 'Older response ignored',
  REJECTED_INVALID: 'Response could not be used',
  AUTH_FAILED: 'Sign-in to the source failed',
  FORBIDDEN: 'Source denied access to the project',
  NOT_FOUND: 'Source does not know the project',
  RATE_LIMITED: 'Source asked us to slow down',
  TIMEOUT: 'Source did not answer in time',
  NETWORK_ERROR: 'Source could not be reached',
  SOURCE_ERROR: 'Source reported an error',
};

export function outcomeLabel(outcome: string | null): string {
  if (!outcome) return 'Not checked yet';
  return OUTCOME_LABELS[outcome] ?? 'Unknown';
}

const SEVERITY_ORDER: Record<ProgressWarning['severity'], number> = { critical: 0, warning: 1, info: 2 };

export function sortWarnings(warnings: ProgressWarning[]): ProgressWarning[] {
  return [...warnings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Plain description of the update cadence. Polling is "automatic updates", never "real-time". */
export function cadenceText(pollIntervalSeconds: number | null): string {
  if (pollIntervalSeconds === null) return 'Updated automatically in the background.';
  if (pollIntervalSeconds < 120) return `Updated automatically about every ${pollIntervalSeconds} seconds (not instant).`;
  return `Updated automatically about every ${Math.round(pollIntervalSeconds / 60)} minutes (not instant).`;
}

// ---------------------------------------------------------------------------
// FMP-OPS-03 — richer figures from the source report: balances, stock, source percentages, volume/area/length with
// missing-measurement counts, a breakdown by building and the separate history. Everything here is formatting and
// labelling of values the source supplied; nothing is calculated, summed or reconciled by FMP.
// ---------------------------------------------------------------------------

/** Whole-number or up-to-3-decimal quantity with thousands separators (4,719.547). */
export function formatQuantity(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

/** The source's own ratio (0..1) as a percentage. Always shown with "of GA requirement". */
export function formatSourcePercent(ratio: number): string {
  return `${(ratio * 100).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export type MeasureUnit = 'pieces' | 'm³' | 'm²' | 'LM' | 'percent';

export interface MeasureDef {
  key: string;
  label: string;
  unit: MeasureUnit;
  /** The source's count of pieces whose measurement is unknown. Unknown is never shown as zero. */
  missingKey?: string;
  hint?: string;
}

export function formatMeasure(def: MeasureDef, value: number): string {
  if (def.unit === 'percent') return `${formatSourcePercent(value)} of GA requirement`;
  if (def.unit === 'pieces') return `${formatCount(value)} pieces`;
  return `${formatQuantity(value)} ${def.unit}`;
}

/** "204 pieces have no known volume", or null when the source reports none (or did not say). */
export function missingText(def: MeasureDef, measures: Record<string, number>): string | null {
  if (!def.missingKey) return null;
  const n = measures[def.missingKey];
  if (typeof n !== 'number' || n <= 0) return null;
  const what = def.unit === 'm³' ? 'volume' : def.unit === 'm²' ? 'area' : def.unit === 'LM' ? 'length' : 'value';
  return `${formatCount(n)} pieces have no known ${what}`;
}

const PCT = (key: string, label: string): MeasureDef => ({ key, label, unit: 'percent' });
const QTY = (stage: string, unit: 'volume' | 'area' | 'length', label: string): MeasureDef => ({
  key: `${stage}_${unit}`,
  label,
  unit: unit === 'volume' ? 'm³' : unit === 'area' ? 'm²' : 'LM',
  missingKey: `missing_${stage}_${unit}`,
});

/** What each stage tab shows from the optional figures, in order. Only supplied keys render. */
export const STAGE_MEASURES: Record<StageDef['key'], MeasureDef[]> = {
  technical: [
    PCT('issued_pct', 'Issued for production'),
    QTY('total', 'volume', 'GA requirement volume'),
    QTY('total', 'area', 'GA requirement area'),
    QTY('total', 'length', 'GA requirement length'),
  ],
  production: [
    PCT('produced_pct', 'Produced'),
    { key: 'balance_produce', label: 'Balance to produce', unit: 'pieces', hint: 'GA requirement minus produced, calculated by the source.' },
    PCT('balance_produce_pct', 'Balance to produce'),
    { key: 'stock', label: 'Stock', unit: 'pieces', hint: 'Produced minus delivered, calculated by the source.' },
    { key: 'scheduled', label: 'Scheduled', unit: 'pieces', hint: 'Current quantity awaiting casting, as reported by the source.' },
    { key: 'cast_volume', label: 'Current cast volume', unit: 'm³', missingKey: 'missing_cast_volume' },
    QTY('produced', 'volume', 'Produced volume'),
    QTY('produced', 'area', 'Produced area'),
    QTY('produced', 'length', 'Produced length'),
  ],
  delivery: [
    PCT('delivered_pct', 'Delivered'),
    { key: 'balance_deliver', label: 'Balance to deliver', unit: 'pieces', hint: 'GA requirement minus delivered, calculated by the source.' },
    PCT('balance_deliver_pct', 'Balance to deliver'),
    { key: 'stock', label: 'Stock', unit: 'pieces', hint: 'Produced minus delivered, calculated by the source.' },
    QTY('delivered', 'volume', 'Delivered volume'),
    QTY('delivered', 'area', 'Delivered area'),
    QTY('delivered', 'length', 'Delivered length'),
  ],
  erection: [
    PCT('installed_pct', 'Erected'),
    QTY('installed', 'volume', 'Erected volume'),
    QTY('installed', 'area', 'Erected area'),
    QTY('installed', 'length', 'Erected length'),
  ],
};

/** Whole-project history. Kept in its own section, never blended into the current figures. */
export const HISTORICAL_DEFS: Record<string, MeasureDef> = {
  produced: { key: 'produced', label: 'Produced (history)', unit: 'pieces' },
  delivered: { key: 'delivered', label: 'Delivered (history)', unit: 'pieces' },
  installed: { key: 'installed', label: 'Erected (history)', unit: 'pieces' },
  factory_stock: { key: 'factory_stock', label: 'Factory stock (history)', unit: 'pieces' },
  cast_volume: { key: 'cast_volume', label: 'Cast volume (history)', unit: 'm³' },
  unallocated_produced: { key: 'unallocated_produced', label: 'Unallocated produced pieces', unit: 'pieces' },
  held: { key: 'held', label: 'Held', unit: 'pieces' },
  surplus: { key: 'surplus', label: 'Surplus', unit: 'pieces' },
  rejected: { key: 'rejected', label: 'Rejected', unit: 'pieces' },
};

export const STAGE_HISTORY_KEYS: Record<StageDef['key'], string[]> = {
  technical: [],
  production: ['produced', 'factory_stock', 'cast_volume', 'unallocated_produced', 'held', 'surplus', 'rejected'],
  delivery: ['delivered'],
  erection: ['installed'],
};

export const HISTORY_EXPLANATION =
  'Whole-project physical history as retained by the source, including quantities of requirements that were later withdrawn. It is shown separately and is not reconciled with the current figures above.';

export interface BreakdownColumn {
  key: string;
  label: string;
}

/** Per-building columns for each stage (the row's own counts and calculated balances). */
export const STAGE_BREAKDOWN_COLUMNS: Record<StageDef['key'], BreakdownColumn[]> = {
  technical: [
    { key: 'total', label: 'GA requirement' },
    { key: 'issued', label: 'Issued for production' },
    { key: 'pending_inputs', label: 'Outstanding input details' },
  ],
  production: [
    { key: 'produced', label: 'Produced' },
    { key: 'balance_produce', label: 'Balance to produce' },
    { key: 'stock', label: 'Stock' },
  ],
  delivery: [
    { key: 'delivered', label: 'Delivered' },
    { key: 'balance_deliver', label: 'Balance to deliver' },
    { key: 'stock', label: 'Stock' },
  ],
  erection: [{ key: 'installed', label: 'Erected' }],
};

/** Columns for which at least one row has a value (so unsupplied columns never appear as zeros). */
export function visibleBreakdownColumns(
  stage: StageDef['key'],
  rows: { label: string; values: Record<string, number> }[],
): BreakdownColumn[] {
  return STAGE_BREAKDOWN_COLUMNS[stage].filter((c) => rows.some((r) => typeof r.values[c.key] === 'number'));
}
