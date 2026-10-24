import { describe, it, expect } from 'vitest';
import { parseProgressReport } from '@recafco/shared';
import { reportBody } from './test-support';

const ID = 'shapoorji-2025-92';
const NOW = new Date('2026-10-21T10:30:00Z');

describe('parseProgressReport', () => {
  it('accepts the documented excerpt and maps every documented field', () => {
    const r = parseProgressReport(reportBody(), ID, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.code).toBe('92/25');
    expect(r.report.factory).toBe('PC');
    expect(r.report.name).toBe('Shapoorji · New Sabah Hospital');
    expect(r.report.totals).toEqual({ total: 2727, issued: 2727, produced: 2219, delivered: 1610, installed: 1482, pendingInputs: 1966 });
    expect(r.report.generatedAt.toISOString()).toBe('2026-10-21T10:25:00.000Z');
  });

  it('rejects a response for a different project (project isolation)', () => {
    const r = parseProgressReport(reportBody({ project: { id: 'someone-else-2025-01' } }), ID, NOW);
    expect(r).toMatchObject({ ok: false, code: 'IDENTITY_MISMATCH' });
  });

  it('rejects a missing project block, non-object bodies and arrays', () => {
    expect(parseProgressReport(null, ID, NOW)).toMatchObject({ ok: false, code: 'MALFORMED' });
    expect(parseProgressReport([], ID, NOW)).toMatchObject({ ok: false, code: 'MALFORMED' });
    expect(parseProgressReport('x', ID, NOW)).toMatchObject({ ok: false, code: 'MALFORMED' });
    expect(parseProgressReport({ totals: {}, generated_at: 'x' }, ID, NOW)).toMatchObject({ ok: false, code: 'MALFORMED' });
  });

  it('rejects when totals is missing', () => {
    const body = reportBody();
    delete body['totals'];
    expect(parseProgressReport(body, ID, NOW)).toMatchObject({ ok: false, code: 'MALFORMED' });
  });

  it.each(['total', 'issued', 'produced', 'delivered', 'installed', 'pending_inputs'])(
    'never treats a missing %s as zero',
    (field) => {
      const body = reportBody();
      delete (body['totals'] as Record<string, unknown>)[field];
      expect(parseProgressReport(body, ID, NOW)).toMatchObject({ ok: false, code: 'INVALID_FIELD' });
    },
  );

  it.each([
    ['null', null],
    ['string', '12'],
    ['float', 1.5],
    ['negative', -1],
    ['NaN-ish', Number.NaN],
    ['too large', 3_000_000_000],
    ['boolean', true],
  ])('rejects a %s count', (_label, value) => {
    expect(parseProgressReport(reportBody({ totals: { produced: value } }), ID, NOW)).toMatchObject({ ok: false, code: 'INVALID_FIELD' });
  });

  it('accepts a legitimate zero (zero is data, absence is not)', () => {
    const r = parseProgressReport(reportBody({ totals: { installed: 0, delivered: 0 } }), ID, NOW);
    expect(r.ok).toBe(true);
  });

  it('requires a generation time with an explicit offset', () => {
    expect(parseProgressReport(reportBody({ generated_at: '' }), ID, NOW)).toMatchObject({ ok: false, code: 'INVALID_TIMESTAMP' });
    expect(parseProgressReport(reportBody({ generated_at: '2026-10-21T10:25:00' }), ID, NOW)).toMatchObject({ ok: false, code: 'INVALID_TIMESTAMP' });
    expect(parseProgressReport(reportBody({ generated_at: 'yesterday' }), ID, NOW)).toMatchObject({ ok: false, code: 'INVALID_TIMESTAMP' });
    expect(parseProgressReport(reportBody({ generated_at: '2026-10-21T10:25:00Z' }), ID, NOW).ok).toBe(true);
    expect(parseProgressReport(reportBody({ generated_at: '2026-10-21T13:25:00+03:00' }), ID, NOW).ok).toBe(true);
  });

  it('rejects a generation time far in the future (it would block all newer data)', () => {
    expect(parseProgressReport(reportBody({ generated_at: '2027-01-01T00:00:00+00:00' }), ID, NOW)).toMatchObject({
      ok: false,
      code: 'FUTURE_TIMESTAMP',
    });
    // Small clock skew is tolerated.
    expect(parseProgressReport(reportBody({ generated_at: '2026-10-21T10:35:00+00:00' }), ID, NOW).ok).toBe(true);
  });

  it('records unrecognised top-level keys by name only (rows/tree/historical are now understood separately)', () => {
    const r = parseProgressReport(
      reportBody({ extra: { rows: [{ building: 'A', total: 1 }], tree: {}, historical: { x: 1 }, mystery: 1 } }),
      ID,
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.unrecognisedKeys).toEqual(['mystery']);
    // rows without a `fields` grouping cannot be read as a breakdown: not stored, and said so.
    expect(r.report.breakdown).toBeNull();
    expect(r.report.shapeWarnings.join(' ')).toMatch(/rows could not be read/);
    expect(r.report.historicalPresent).toBe(true);
  });

  it('keeps boolean review_required, and stores other shapes verbatim without interpreting them', () => {
    const t = parseProgressReport(reportBody({ extra: { review_required: true } }), ID, NOW);
    expect(t.ok && t.report.reviewRequiredFlag).toBe(true);
    const odd = parseProgressReport(reportBody({ extra: { review_required: ['piece A'] } }), ID, NOW);
    expect(odd.ok).toBe(true);
    if (odd.ok) {
      expect(odd.report.reviewRequiredFlag).toBeNull();
      expect(odd.report.reviewRequiredRaw).toEqual(['piece A']);
      expect(odd.report.shapeWarnings.join(' ')).toMatch(/review_required/);
    }
  });

  it('only keeps notes that are a list of text lines', () => {
    const ok = parseProgressReport(reportBody({ extra: { notes: ['Measurements missing for 12 pieces'] } }), ID, NOW);
    expect(ok.ok && ok.report.sourceNotes).toEqual(['Measurements missing for 12 pieces']);
    const bad = parseProgressReport(reportBody({ extra: { notes: [{ a: 1 }] } }), ID, NOW);
    expect(bad.ok && bad.report.sourceNotes).toEqual([]);
  });

  it('survives an absent code/factory (identity unverified, not guessed)', () => {
    const body = reportBody();
    body['project'] = { id: ID };
    const r = parseProgressReport(body, ID, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.report.code).toBeNull();
      expect(r.report.factory).toBeNull();
    }
  });
});
