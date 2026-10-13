import { describe, it, expect } from 'vitest';
import { drawingFileButtons, drawingRowStatus, drawingReadiness, nextReleaseNote, REPLACE_DRAWING_HINT } from './drawing-file-ui';

const labels = (n: number, canWrite: boolean, canChange: boolean): string[] => drawingFileButtons(n, canWrite, canChange).map((b) => b.label);

describe('drawing file buttons (FMP-TECH-30)', () => {
  it('no files: only Add Drawing — never "View Files (0)"', () => {
    expect(labels(0, true, true)).toEqual(['Add Drawing']);
    expect(labels(0, true, true).join(' ')).not.toMatch(/\(0\)|Add Final Drawing Files/);
  });

  it('with files: View Drawing Files, Add More Files and Replace Drawing', () => {
    expect(labels(2, true, true)).toEqual(['View Drawing Files', 'Add More Files', 'Replace Drawing']);
  });

  it('replace and add are hidden when the drawing cannot be changed (released) or the user is read-only', () => {
    expect(labels(2, true, false)).toEqual(['View Drawing Files']);
    expect(labels(2, false, true)).toEqual(['View Drawing Files']);
    expect(labels(0, false, true)).toEqual([]);
    expect(labels(0, true, false)).toEqual([]);
  });
});

describe('drawing row status', () => {
  it('Waiting Final Drawing, Drawing Uploaded, Released to Production', () => {
    expect(drawingRowStatus(0, false).label).toBe('Waiting Final Drawing');
    expect(drawingRowStatus(3, false).label).toBe('Drawing Uploaded');
    expect(drawingRowStatus(3, true).label).toBe('Released to Production');
  });
  it('never uses the confusing words', () => {
    for (const [n, r] of [[0, false], [1, false], [1, true]] as const) expect(drawingRowStatus(n, r).label).not.toMatch(/Cover|Coverage|Mapping/i);
  });
});

describe('release readiness', () => {
  it('shows the success message only when every element has a drawing', () => {
    expect(drawingReadiness({ totalElements: 10, notCovered: 0 })).toEqual({ ready: true, message: 'All elements have final drawings. You can continue to Release to Production.' });
    expect(drawingReadiness({ totalElements: 10, notCovered: 3 })).toEqual({ ready: false, message: 'Some elements are still waiting for final drawings. Upload drawings before release to Production.' });
    expect(drawingReadiness({ totalElements: 0, notCovered: 0 })).toBeNull();
  });

  it('words the Next button note', () => {
    expect(nextReleaseNote(null, false)).toBe('Final drawings are required before release to Production.');
    expect(nextReleaseNote({ totalElements: 4, notCovered: 0 }, true)).toBe('All required final drawings are uploaded.');
    expect(nextReleaseNote({ totalElements: 4, notCovered: 1 }, true)).toBe('Some elements are still waiting for final drawings.');
  });

  it('has the replace hint', () => {
    expect(REPLACE_DRAWING_HINT).toMatch(/Nothing is deleted/);
  });
});
