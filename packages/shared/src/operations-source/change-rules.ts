import {
  OPERATIONS_TOTAL_FIELDS,
  type FieldChange,
  type OperationsTotals,
  type ParsedProgressReport,
  type PublicationDecision,
  type SnapshotFlag,
} from './types';

// ---------------------------------------------------------------------------
// Publication ordering, change detection and suspicious-change flags.
//
// Business rules used (all from the source documentation):
//  - Stage figures are cumulative AND overlap; "a delivered piece is also
//    included in produced" => delivered > produced breaks the documented rule.
//  - Totals apply to CURRENT approved requirements, so revisions and
//    corrections may legitimately lower figures: a decrease is flagged for
//    visibility but is NEVER rejected.
// Nothing here invents a threshold (no "more than X% swing" rule): the source
// owner has not defined one.
// ---------------------------------------------------------------------------

/**
 * Canonical text of the content that matters (NOT generated_at, which advances on every poll).
 * The caller hashes it (sha256) — this package stays free of Node built-ins.
 */
export function canonicalContentOf(report: ParsedProgressReport): string {
  return JSON.stringify({
    id: report.sourceProjectId,
    code: report.code,
    factory: report.factory,
    name: report.name,
    totals: OPERATIONS_TOTAL_FIELDS.map((f) => report.totals[f]),
    review: report.reviewRequiredRaw ?? null,
    notes: report.sourceNotes,
    // Extended content: a change here is a real change of what viewers see, so it must produce a new snapshot.
    measures: Object.keys(report.measures).sort().map((k) => [k, report.measures[k]]),
    breakdown: report.breakdown ? [report.breakdown.groupField, report.breakdown.rows.map((r) => [r.label, Object.keys(r.values).sort().map((k) => [k, r.values[k]])])] : null,
    historical: report.historical ? Object.keys(report.historical).sort().map((k) => [k, (report.historical as Record<string, number>)[k]]) : null,
    reviewNotes: report.reviewNotes,
    conflicts: report.conflictMarks ? report.conflictMarks.count : null,
  });
}

/**
 * Decide what an already-validated report does to the current accepted state.
 *  - OLDER:     generated before the newest accepted response => never replaces newer data.
 *  - DUPLICATE: same content as the current snapshot => only the retrieval time moves.
 *  - PUBLISH:   new content, not older.
 * A response with the SAME generated_at but different content is published (the
 * source's timestamp resolution may be coarse and this retrieval is the later one).
 */
export function decidePublication(
  current: { latestGeneratedAt: Date | null; contentHash: string | null },
  incoming: { generatedAt: Date; contentHash: string },
): PublicationDecision {
  if (current.latestGeneratedAt !== null && incoming.generatedAt.getTime() < current.latestGeneratedAt.getTime()) {
    return 'OLDER';
  }
  if (current.contentHash !== null && current.contentHash === incoming.contentHash) return 'DUPLICATE';
  return 'PUBLISH';
}

export function diffTotals(previous: OperationsTotals | null, next: OperationsTotals): FieldChange[] {
  if (previous === null) return [];
  const changes: FieldChange[] = [];
  for (const field of OPERATIONS_TOTAL_FIELDS) {
    if (previous[field] !== next[field]) changes.push({ field, from: previous[field], to: next[field] });
  }
  return changes;
}

const FIELD_LABELS: Record<(typeof OPERATIONS_TOTAL_FIELDS)[number], string> = {
  total: 'current approved requirement',
  issued: 'issued for production',
  produced: 'produced',
  delivered: 'delivered',
  installed: 'erected',
  pendingInputs: 'pending input details',
};

export function evaluateFlags(
  previous: { totals: OperationsTotals; code: string | null; factory: string | null } | null,
  next: ParsedProgressReport,
): SnapshotFlag[] {
  const flags: SnapshotFlag[] = [];
  const t = next.totals;

  if (t.delivered > t.produced) {
    flags.push({
      code: 'DELIVERED_EXCEEDS_PRODUCED',
      severity: 'warning',
      message: `The source reports more delivered (${t.delivered}) than produced (${t.produced}) pieces, although a delivered piece is documented as also counted in produced. Check with the source.`,
    });
  }

  if (previous !== null) {
    const changes = diffTotals(previous.totals, t);
    const decreased = changes.filter((c) => c.to < c.from);
    if (decreased.length > 0) {
      flags.push({
        code: 'FIGURE_DECREASED',
        severity: 'info',
        message: `Lower than the previous update: ${decreased
          .map((c) => `${FIELD_LABELS[c.field]} ${c.from} → ${c.to}`)
          .join('; ')}. Revisions and corrections can legitimately reduce figures.`,
      });
    }
    const requirement = changes.find((c) => c.field === 'total');
    if (requirement) {
      flags.push({
        code: 'REQUIREMENT_CHANGED',
        severity: 'info',
        message: `The current approved requirement changed from ${requirement.from} to ${requirement.to} pieces (a source revision).`,
      });
    }
    const allZero = OPERATIONS_TOTAL_FIELDS.every((f) => t[f] === 0);
    const wasNonZero = OPERATIONS_TOTAL_FIELDS.some((f) => previous.totals[f] > 0);
    if (allZero && wasNonZero) {
      flags.push({
        code: 'ALL_ZERO_AFTER_NONZERO',
        severity: 'warning',
        message: 'Every figure is now zero although the previous update had progress. Confirm with the source that this is intended.',
      });
    }
    if (
      (previous.code !== null && next.code !== null && previous.code !== next.code) ||
      (previous.factory !== null && next.factory !== null && previous.factory !== next.factory)
    ) {
      flags.push({
        code: 'IDENTITY_CHANGED',
        severity: 'warning',
        message: `The source now reports job order/factory ${next.code ?? '—'}/${next.factory ?? '—'} (previously ${previous.code ?? '—'}/${previous.factory ?? '—'}). The link is kept; please confirm it is still correct.`,
      });
    }
  }
  return flags;
}
