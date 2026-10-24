import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { exclusionReasonFor, parseProgressReport, parseProjectList, type ParsedProgressReport } from '@recafco/shared';
import { hashContent } from './publication';

const ID = 'shapoorji-2025-92';
const NOW = new Date('2026-10-22T12:00:00Z');

/** The REAL report captured from the source on 22 Oct 2026 (client/contractor/description redacted). */
function captured(): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'report-92-25.captured-2026-10-22.json'), 'utf8')) as Record<string, unknown>;
  delete raw['_fixture'];
  return raw;
}

function parse(mutate: (b: Record<string, unknown>) => void = () => undefined): ParsedProgressReport {
  const b = captured();
  mutate(b);
  const r = parseProgressReport(b, ID, NOW);
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
  return r.report;
}

describe('the captured real report', () => {
  it('parses completely: every top-level key is understood and the six totals are the project aggregate', () => {
    const r = parse();
    expect(r.unrecognisedKeys).toEqual([]);
    expect(r.totals).toEqual({ total: 2727, issued: 2727, produced: 2219, delivered: 1629, installed: 1512, pendingInputs: 1979 });
    expect(r.generatedAt.toISOString()).toBe('2026-10-22T11:27:37.000Z');
    expect(r.reviewRequiredFlag).toBe(false);
    expect(r.reviewNotes).toEqual([]);
    expect(r.conflictMarks).toEqual({ count: 0, raw: [] });
    expect(r.sourceNotes.length).toBeGreaterThan(5);
  });

  it('carries the richer figures, exactly as the source supplied them', () => {
    const m = parse().measures;
    expect(m['balance_produce']).toBe(508);
    expect(m['balance_deliver']).toBe(1098);
    expect(m['stock']).toBe(590);
    expect(m['scheduled']).toBe(0); // a supplied zero is data
    expect(m['produced_pct']).toBeCloseTo(0.8137, 4);
    expect(m['total_volume']).toBe(5384.408);
    expect(m['missing_total_volume']).toBe(204);
    expect(m['total_area']).toBe(7988.982);
    expect(m['missing_total_area']).toBe(1751);
    expect(m['installed_length']).toBe(4192.65);
    expect(m['missing_concrete']).toBe(2727);
  });

  it('keeps the historical figures SEPARATE: current and historical cast volume differ and are both preserved', () => {
    const r = parse();
    expect(r.measures['cast_volume']).toBe(4719.547);
    expect(r.historical?.cast_volume).toBe(4687.351);
    expect(r.historical?.factory_stock).toBe(590);
    expect(r.measures['cast_volume']).not.toBe(r.historical?.cast_volume);
  });

  it('reads rows as the breakdown and never folds them into the totals', () => {
    const r = parse();
    expect(r.breakdown?.groupField).toBe('building');
    expect(r.breakdown?.rows).toHaveLength(1);
    expect(r.breakdown?.rows[0]?.label).toBe('Main building / area');
    expect(r.breakdown?.rows[0]?.values['produced']).toBe(2219); // the core counts are kept per row, never summed
    expect(r.breakdown?.rows[0]?.values['stock']).toBe(590);
    // Totals come from `totals` once, whatever rows/tree/kpis say.
    const r2 = parse((b) => {
      (b['rows'] as Record<string, unknown>[])[0]!['stock'] = 1;
      (b['tree'] as Record<string, unknown>[])[0]!['stock'] = 2;
      (b['kpis'] as Record<string, unknown>[])[0]!['value'] = 3;
    });
    expect(r2.measures['stock']).toBe(590);
    expect(r2.totals.total).toBe(2727);
  });

  it('does not store tree or kpis at all (they duplicate totals/rows)', () => {
    const r = parse();
    expect(JSON.stringify(r)).not.toContain('"subtotal"');
    expect(JSON.stringify(r)).not.toContain('Accepted drawing pieces');
  });
});

describe('missing and malformed optional figures', () => {
  it('a missing measure stays absent (never zero)', () => {
    const r = parse((b) => {
      delete (b['totals'] as Record<string, unknown>)['stock'];
      delete (b['totals'] as Record<string, unknown>)['total_volume'];
    });
    expect('stock' in r.measures).toBe(false);
    expect('total_volume' in r.measures).toBe(false);
  });

  it('a wrong-type or negative figure is dropped and reported, the response is still accepted', () => {
    const r = parse((b) => {
      const t = b['totals'] as Record<string, unknown>;
      t['total_volume'] = 'abc';
      t['produced_area'] = -5;
      t['missing_total_area'] = 1.5;
      t['cast_volume'] = null;
    });
    for (const k of ['total_volume', 'produced_area', 'missing_total_area', 'cast_volume']) expect(k in r.measures).toBe(false);
    expect(r.shapeWarnings.join(' ')).toMatch(/unexpected type/);
    expect(r.totals.total).toBe(2727);
  });

  it('a negative balance or stock is kept (the source can report an inconsistency) but a negative count is not', () => {
    const r = parse((b) => {
      const t = b['totals'] as Record<string, unknown>;
      t['stock'] = -3;
      t['drawings'] = -1;
    });
    expect(r.measures['stock']).toBe(-3);
    expect('drawings' in r.measures).toBe(false);
  });

  it('absent rows/historical simply mean no breakdown / no history', () => {
    const r = parse((b) => {
      delete b['rows'];
      delete b['historical'];
    });
    expect(r.breakdown).toBeNull();
    expect(r.historical).toBeNull();
    expect(r.historicalPresent).toBe(false);
  });

  it('a malformed rows array does not reject the response', () => {
    const r = parse((b) => {
      b['rows'] = [1, null, { nolabel: 1 }, { building: 'B1', stock: 4 }];
    });
    expect(r.breakdown?.rows.map((x) => x.label)).toEqual(['B1']);
  });

  it('caps the number of breakdown rows', () => {
    const r = parse((b) => {
      b['rows'] = Array.from({ length: 500 }, (_, i) => ({ building: `B${i}`, stock: i }));
    });
    expect(r.breakdown?.rows).toHaveLength(200);
    expect(r.breakdown?.truncated).toBe(true);
  });

  it('review_notes lines and conflict marks are surfaced', () => {
    const r = parse((b) => {
      b['review_required'] = true;
      b['review_notes'] = ['Mark A-12 needs review'];
      b['conflict_marks'] = [{ mark: 'A-12' }, { mark: 'B-3' }];
    });
    expect(r.reviewRequiredFlag).toBe(true);
    expect(r.reviewNotes).toEqual(['Mark A-12 needs review']);
    expect(r.conflictMarks?.count).toBe(2);
  });
});

describe('scope: only the whole-project report is accepted', () => {
  it.each([
    ['filtered flag', (b: Record<string, unknown>) => { b['filtered'] = true; }],
    ['building filter', (b: Record<string, unknown>) => { b['building_id'] = 'B1'; }],
    ['level filter', (b: Record<string, unknown>) => { b['level'] = 'L2'; }],
  ])('rejects a %s response', (_n, mutate) => {
    const b = captured();
    mutate(b);
    expect(parseProgressReport(b, ID, NOW)).toMatchObject({ ok: false, code: 'SCOPE_MISMATCH' });
  });
});

describe('content hash covers the richer content', () => {
  it('changes when a measure, the breakdown or the history changes, not when only generated_at moves', () => {
    const base = hashContent(parse());
    expect(hashContent(parse((b) => { b['generated_at'] = '2026-10-22T11:40:00+00:00'; }))).toBe(base);
    expect(hashContent(parse((b) => { (b['totals'] as Record<string, unknown>)['stock'] = 591; }))).not.toBe(base);
    expect(hashContent(parse((b) => { (b['historical'] as Record<string, unknown>)['cast_volume'] = 4700; }))).not.toBe(base);
    expect(hashContent(parse((b) => { (b['rows'] as Record<string, unknown>[])[0]!['balance_produce'] = 1; }))).not.toBe(base);
    expect(hashContent(parse((b) => { b['review_notes'] = ['x']; }))).not.toBe(base);
  });
});

// ---------------------------------------------------------------------------
// Project list
// ---------------------------------------------------------------------------

/** A synthetic list shaped like the real one: 421 projects, 70 codes shared between factories, one training project, one described test project. */
function syntheticList(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < 351; i++) out.push({ id: `p-${i}`, code: `${(i % 99) + 1}/${25 + (i % 2)}-${i}`, name: `Project ${i}`, project_type: i % 5 === 0 ? 'HC' : 'PC', is_training: false, client: 'x', contractor: 'y', description: 'z', created: '2026-01-01T00:00:00+00:00', coordinator: '' });
  // 70 more projects re-using an existing code in the OTHER factory
  for (let i = 0; i < 70; i++) {
    const base = out[i]!;
    out.push({ ...base, id: `shared-${i}`, name: `Shared ${i}`, project_type: base['project_type'] === 'PC' ? 'HC' : 'PC' });
  }
  out.push({ id: 'project_8671d24f243d', code: 'REV-TRIAL', name: 'Training', project_type: '', is_training: true });
  return out;
}

describe('parseProjectList', () => {
  it('accepts a realistic list and keeps only what FMP needs', () => {
    const r = parseProjectList(syntheticList());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.projects).toHaveLength(422);
    expect(Object.keys(r.projects[0]!).sort()).toEqual(['code', 'factory', 'id', 'isTraining', 'name']);
    const shared = r.projects.filter((p) => p.id.startsWith('shared-'));
    expect(shared).toHaveLength(70);
  });

  it('rejects anything that is not a list, an absurdly long list, or a list repeating an id', () => {
    expect(parseProjectList({ projects: [] }).ok).toBe(false);
    expect(parseProjectList('x').ok).toBe(false);
    expect(parseProjectList(Array.from({ length: 6000 }, (_, i) => ({ id: `p-${i}` }))).ok).toBe(false);
    expect(parseProjectList([{ id: 'same-1' }, { id: 'same-1' }])).toMatchObject({ ok: false });
  });

  it('skips and counts malformed entries without losing the rest', () => {
    const r = parseProjectList([{ id: 'ok-1', code: '1/26', project_type: 'PC', is_training: false }, null, 'x', { id: '../bad' }, { id: '' }, { code: 'no-id' }]);
    expect(r).toMatchObject({ ok: true, skipped: 5 });
    if (r.ok) expect(r.projects.map((p) => p.id)).toEqual(['ok-1']);
  });

  it('does not treat a missing is_training as false', () => {
    const r = parseProjectList([{ id: 'p-1', code: '1/26', project_type: 'PC' }]);
    expect(r.ok && r.projects[0]?.isTraining).toBeNull();
  });
});

describe('exclusionReasonFor', () => {
  const none = new Set<string>();
  const p = (over: Partial<{ id: string; isTraining: boolean | null; factory: string | null }> = {}) => ({ id: 'p-1', code: '1/26', name: 'n', factory: 'PC', isTraining: false as boolean | null, ...over });
  it('a normal project is eligible', () => expect(exclusionReasonFor(p(), none)).toBeNull());
  it('excludes training projects', () => expect(exclusionReasonFor(p({ isTraining: true, factory: '' as never }), none)).toBe('TRAINING'));
  it('excludes the configured test project even though the source flags it is_training=false', () => {
    expect(exclusionReasonFor(p({ id: 'project_b29b21f0f3fb' }), new Set(['project_b29b21f0f3fb']))).toBe('CONFIGURED_EXCLUSION');
  });
  it('excludes projects whose training status is unknown or that have no factory', () => {
    expect(exclusionReasonFor(p({ isTraining: null }), none)).toBe('TRAINING_STATUS_UNKNOWN');
    expect(exclusionReasonFor(p({ factory: null }), none)).toBe('NO_FACTORY');
  });
});
