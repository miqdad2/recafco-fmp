import { describe, it, expect } from 'vitest';
import { decidePublication, diffTotals, evaluateFlags, parseProgressReport, type OperationsTotals } from '@recafco/shared';
import { hashContent, planPublication } from './publication';
import { reportBody } from './test-support';

const ID = 'shapoorji-2025-92';
const NOW = new Date('2026-10-21T12:00:00Z');

function report(totals: Partial<Record<string, unknown>> = {}, generated_at = '2026-10-21T10:25:00+00:00', extra: Record<string, unknown> = {}) {
  const r = parseProgressReport(reportBody({ totals, generated_at, extra }), ID, NOW);
  if (!r.ok) throw new Error(r.message);
  return r.report;
}

const totals = (over: Partial<OperationsTotals> = {}): OperationsTotals => ({
  total: 2727,
  issued: 2727,
  produced: 2219,
  delivered: 1610,
  installed: 1482,
  pendingInputs: 1966,
  ...over,
});

describe('decidePublication', () => {
  const t = (iso: string) => new Date(iso);
  it('publishes the first response', () => {
    expect(decidePublication({ latestGeneratedAt: null, contentHash: null }, { generatedAt: t('2026-10-21T10:00:00Z'), contentHash: 'a' })).toBe('PUBLISH');
  });
  it('treats identical content as a duplicate even though generated_at advanced', () => {
    expect(decidePublication({ latestGeneratedAt: t('2026-10-21T10:00:00Z'), contentHash: 'a' }, { generatedAt: t('2026-10-21T10:05:00Z'), contentHash: 'a' })).toBe('DUPLICATE');
  });
  it('never lets an older response replace newer data', () => {
    expect(decidePublication({ latestGeneratedAt: t('2026-10-21T10:05:00Z'), contentHash: 'a' }, { generatedAt: t('2026-10-21T10:00:00Z'), contentHash: 'b' })).toBe('OLDER');
  });
  it('publishes a same-timestamp response whose content differs', () => {
    expect(decidePublication({ latestGeneratedAt: t('2026-10-21T10:00:00Z'), contentHash: 'a' }, { generatedAt: t('2026-10-21T10:00:00Z'), contentHash: 'b' })).toBe('PUBLISH');
  });
  it('an older response with identical content is still OLDER (ordering wins)', () => {
    expect(decidePublication({ latestGeneratedAt: t('2026-10-21T10:05:00Z'), contentHash: 'a' }, { generatedAt: t('2026-10-21T10:00:00Z'), contentHash: 'a' })).toBe('OLDER');
  });
});

describe('contentHash', () => {
  it('ignores generated_at but not the figures', () => {
    expect(hashContent(report({}, '2026-10-21T10:25:00+00:00'))).toBe(hashContent(report({}, '2026-10-21T10:40:00+00:00')));
    expect(hashContent(report({ produced: 2220 }))).not.toBe(hashContent(report()));
  });
});

describe('diffTotals / evaluateFlags', () => {
  it('lists changed fields only', () => {
    expect(diffTotals(totals(), totals({ produced: 2300, installed: 1500 }))).toEqual([
      { field: 'produced', from: 2219, to: 2300 },
      { field: 'installed', from: 1482, to: 1500 },
    ]);
    expect(diffTotals(null, totals())).toEqual([]);
  });

  it('accepts and flags a legitimate decrease as informational (corrections can reduce totals)', () => {
    const prev = { totals: totals(), code: '92/25', factory: 'PC' };
    const flags = evaluateFlags(prev, report({ total: 2600, produced: 2100 }));
    const dec = flags.find((f) => f.code === 'FIGURE_DECREASED');
    expect(dec?.severity).toBe('info');
    expect(dec?.message).toMatch(/Revisions and corrections can legitimately reduce/);
    expect(flags.find((f) => f.code === 'REQUIREMENT_CHANGED')).toBeTruthy();
    // And planPublication still PUBLISHES it.
    const plan = planPublication(
      { lastGeneratedAt: new Date('2026-10-21T10:00:00Z'), current: { id: 's1', contentHash: 'x', ...prev } },
      report({ total: 2600, produced: 2100 }),
      'y',
    );
    expect(plan.kind).toBe('PUBLISH');
  });

  it('flags delivered > produced, the one documented overlap rule', () => {
    const flags = evaluateFlags(null, report({ produced: 100, delivered: 150 }));
    expect(flags.map((f) => f.code)).toContain('DELIVERED_EXCEEDS_PRODUCED');
  });

  it('does not invent thresholds: a big increase raises no flag', () => {
    const flags = evaluateFlags({ totals: totals({ produced: 10 }), code: '92/25', factory: 'PC' }, report({ produced: 2219 }));
    expect(flags).toEqual([]);
  });

  it('warns when everything drops to zero after progress', () => {
    const flags = evaluateFlags(
      { totals: totals(), code: '92/25', factory: 'PC' },
      report({ total: 0, issued: 0, produced: 0, delivered: 0, installed: 0, pending_inputs: 0 }),
    );
    expect(flags.find((f) => f.code === 'ALL_ZERO_AFTER_NONZERO')?.severity).toBe('warning');
  });

  it('warns when the source changes the job order or factory of a project', () => {
    const parsed = parseProgressReport(reportBody({ project: { code: '99/25' } }), ID, NOW);
    if (!parsed.ok) throw new Error('fixture invalid');
    const flags = evaluateFlags({ totals: totals(), code: '92/25', factory: 'PC' }, parsed.report);
    expect(flags.map((f) => f.code)).toContain('IDENTITY_CHANGED');
  });
});
