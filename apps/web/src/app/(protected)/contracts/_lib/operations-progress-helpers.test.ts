import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  NOT_SUPPLIED,
  PENDING_INPUTS_LABEL,
  REQUIREMENT_LABEL,
  STAGES,
  STAGE_MEASURES,
  STAGE_HISTORY_KEYS,
  formatMeasure,
  formatQuantity,
  formatSourcePercent,
  missingText,
  visibleBreakdownColumns,
  cadenceText,
  delayedMessage,
  STATE_LABELS,
  describeChange,
  formatAge,
  formatCount,
  formatKuwaitDateTime,
  outcomeLabel,
  sortWarnings,
  stageShare,
} from './operations-progress-helpers';

describe('Operations progress wording (approved mapping)', () => {
  it('uses the approved labels for each source total', () => {
    expect(REQUIREMENT_LABEL).toBe('Current approved GA requirements');
    expect(PENDING_INPUTS_LABEL).toBe('Outstanding earlier-stage input details');
    expect(STAGES.map((s) => [s.title, s.figureLabel, s.field])).toEqual([
      ['Technical', 'Issued for production', 'issued'],
      ['Production & Planning', 'Produced elements', 'produced'],
      ['Delivery', 'Delivered elements', 'delivered'],
      ['Erection', 'Erected elements', 'installed'],
    ]);
  });
  it('says "Not supplied by source" for missing detail', () => {
    expect(NOT_SUPPLIED).toBe('Not supplied by source');
  });
  it('describes polling as automatic updates, never real-time', () => {
    expect(cadenceText(60)).toBe('Updated automatically about every 60 seconds (not instant).');
    expect(cadenceText(300)).toMatch(/5 minutes \(not instant\)/);
    expect(cadenceText(null)).not.toMatch(/real-?time|instant(ly)?\b(?!\))/i);
  });
});

describe('formatting', () => {
  it('formats counts with separators', () => {
    expect(formatCount(2727)).toBe('2,727');
    expect(formatCount(0)).toBe('0');
  });
  it('shows times in Kuwait local time (UTC+3)', () => {
    expect(formatKuwaitDateTime('2026-10-21T10:25:00+00:00')).toBe('21 Oct 2026, 13:25');
    expect(formatKuwaitDateTime(null)).toBe('—');
    expect(formatKuwaitDateTime('not a date')).toBe('—');
  });
  it('formats ages', () => {
    const now = new Date('2026-10-21T10:30:00Z');
    expect(formatAge('2026-10-21T10:29:40Z', now)).toBe('just now');
    expect(formatAge('2026-10-21T10:25:00Z', now)).toBe('5 min ago');
    expect(formatAge('2026-10-21T07:30:00Z', now)).toBe('3 h ago');
    expect(formatAge('2026-10-18T10:30:00Z', now)).toBe('3 days ago');
    expect(formatAge(null, now)).toBe('—');
  });
  it('labels outcomes for humans', () => {
    expect(outcomeLabel('TIMEOUT')).toBe('Source did not answer in time');
    expect(outcomeLabel(null)).toBe('Not checked yet');
  });
});

describe('stageShare', () => {
  it('is a plain ratio of two piece counts, clamped, and absent without a requirement', () => {
    expect(stageShare(1482, 2727)).toBeCloseTo(54.35, 1);
    expect(stageShare(10, 0)).toBeNull();
    expect(stageShare(5000, 2727)).toBe(100);
    expect(stageShare(-1, 2727)).toBe(0);
  });
});

describe('change description and warning order', () => {
  it('shows direction explicitly, including decreases', () => {
    expect(describeChange({ field: 'produced', from: 2219, to: 2150 })).toBe('Produced: 2,219 → 2,150 (-69)');
    expect(describeChange({ field: 'installed', from: 1482, to: 1500 })).toBe('Erected: 1,482 → 1,500 (+18)');
  });
  it('orders critical before warning before info', () => {
    const sorted = sortWarnings([
      { code: 'a', severity: 'info', message: 'i' },
      { code: 'b', severity: 'critical', message: 'c' },
      { code: 'c', severity: 'warning', message: 'w' },
    ]);
    expect(sorted.map((w) => w.severity)).toEqual(['critical', 'warning', 'info']);
  });
});

describe('screens never combine the overlapping stage counts', () => {
  const dir = path.resolve(__dirname, '../_components');
  for (const file of ['operations-progress-panel.tsx', 'operations-progress-summary-card.tsx', 'operations-stage-panel.tsx', 'operations-list-cell.tsx']) {
    it(`${file} does not add produced, delivered or erected together`, () => {
      // Comments may name the forbidden wording to explain the rule; only code and JSX text count.
      const text = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(text).not.toMatch(/produced\s*\+\s*|\+\s*totals\.delivered|\+\s*data\.totals\.installed|reduce\(/);
      expect(text).not.toMatch(/Not started|Delivered, not yet erected|Awaiting Erection/);
      expect(text).not.toMatch(/real-?time|live sync(hronization)? is on/i);
    });
  }
});

describe('stage meanings (what each figure must not be read as)', () => {
  const by = (k: string) => STAGES.find((s) => s.key === k)!;
  it('issued is not technical completion', () => {
    expect(by('technical').meaning).toMatch(/not technical completion/i);
    expect(by('technical').meaning).toMatch(/pending input/i);
  });
  it('produced and delivered are cumulative; delivered includes erected', () => {
    expect(by('production').meaning).toMatch(/cumulative/i);
    expect(by('delivery').meaning).toMatch(/includes elements that have already been erected/i);
    expect(by('delivery').meaning).not.toMatch(/not yet erected/i);
  });
  it('erected is not final acceptance or completion', () => {
    expect(by('erection').meaning).toMatch(/not final acceptance or contract completion/i);
  });
  it('lists what is not supplied and invents nothing', () => {
    expect(by('technical').notSupplied).toContain('Drawing counts');
    expect(by('production').notSupplied).toEqual(expect.arrayContaining(['Casting schedule', 'Production by BOQ item']));
    // rejected quantities are now supplied (in the source history), so they are no longer listed as missing
    expect(by('production').notSupplied).not.toContain('Rejected quantities');
    expect(by('delivery').notSupplied).toContain('Storage yard figures');
  });
});

describe('connection state wording', () => {
  it('has the five approved states, separate from the commercial status', () => {
    expect(STATE_LABELS).toEqual({
      NOT_LINKED: 'Not connected to Operations',
      WAITING_FIRST_UPDATE: 'Linked, waiting for first update',
      UPDATED: 'Updated successfully',
      DELAYED: 'Update delayed or source unavailable',
      DEMONSTRATION: 'Demonstration data — live source not connected',
    });
  });
  it('the delayed message keeps the retrieval time and the reason', () => {
    const m = delayedMessage('2026-10-21T10:25:00Z', 'The source did not answer in time.');
    expect(m).toMatch(/Update delayed — showing the last accepted figures/);
    expect(m).toMatch(/21 Oct 2026, 13:25/);
    expect(m).toMatch(/did not answer in time/);
  });
});

describe('richer figures (balances, stock, quantities, history)', () => {
  it('formats quantities and the source percentage without computing anything', () => {
    expect(formatQuantity(4719.547)).toBe('4,719.547');
    expect(formatQuantity(5384.4)).toBe('5,384.4');
    expect(formatSourcePercent(0.8137147048038137)).toBe('81.4%');
    expect(formatSourcePercent(1)).toBe('100.0%');
  });

  it('labels every source percentage "of GA requirement"', () => {
    const def = STAGE_MEASURES.production.find((d) => d.key === 'produced_pct')!;
    expect(formatMeasure(def, 0.8137)).toBe('81.4% of GA requirement');
    const all = Object.values(STAGE_MEASURES).flat().filter((d) => d.unit === 'percent');
    expect(all.length).toBeGreaterThanOrEqual(5);
    for (const d of all) expect(formatMeasure(d, 0.5)).toMatch(/of GA requirement$/);
  });

  it('formats quantities with their units', () => {
    const vol = STAGE_MEASURES.technical.find((d) => d.key === 'total_volume')!;
    expect(formatMeasure(vol, 5384.408)).toBe('5,384.408 m³');
    const len = STAGE_MEASURES.technical.find((d) => d.key === 'total_length')!;
    expect(formatMeasure(len, 6763.68)).toBe('6,763.68 LM');
    const bal = STAGE_MEASURES.production.find((d) => d.key === 'balance_produce')!;
    expect(formatMeasure(bal, 508)).toBe('508 pieces');
  });

  it('missing-measurement text appears only when the source reports pieces without a measurement', () => {
    const vol = STAGE_MEASURES.technical.find((d) => d.key === 'total_volume')!;
    expect(missingText(vol, { missing_total_volume: 204 })).toBe('204 pieces have no known volume');
    expect(missingText(vol, { missing_total_volume: 0 })).toBeNull();
    expect(missingText(vol, {})).toBeNull();
    const bal = STAGE_MEASURES.production.find((d) => d.key === 'stock')!;
    expect(missingText(bal, { stock: 1 })).toBeNull();
  });

  it('balance and stock explain they are calculated by the source', () => {
    const prod = STAGE_MEASURES.production;
    expect(prod.find((d) => d.key === 'stock')?.hint).toMatch(/calculated by the source/);
    expect(prod.find((d) => d.key === 'balance_produce')?.hint).toMatch(/calculated by the source/);
    expect(STAGE_MEASURES.delivery.find((d) => d.key === 'balance_deliver')?.hint).toMatch(/calculated by the source/);
  });

  it('history stays out of the current-figure definitions', () => {
    const currentKeys = new Set(Object.values(STAGE_MEASURES).flat().map((d) => d.key));
    expect(currentKeys.has('factory_stock')).toBe(false);
    expect(STAGE_HISTORY_KEYS.technical).toEqual([]);
    expect(STAGE_HISTORY_KEYS.production).toContain('cast_volume');
  });

  it('breakdown columns only appear when some row supplies them (no invented zeros)', () => {
    const rows = [{ label: 'A', values: { produced: 10, stock: 3 } }, { label: 'B', values: { produced: 5 } }];
    expect(visibleBreakdownColumns('production', rows).map((c) => c.key)).toEqual(['produced', 'stock']);
    expect(visibleBreakdownColumns('erection', rows)).toEqual([]);
  });
});
