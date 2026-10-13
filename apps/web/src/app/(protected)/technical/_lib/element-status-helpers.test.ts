import { describe, it, expect } from 'vitest';
import type { BoqPiece, DrawingGroup } from '@/lib/technical-api';
import {
  NO_GROUPING_TITLE,
  isNoGroupingGroup,
  finalDrawingMethod,
  elementStage,
  elementStatusLabel,
  elementGroupText,
  elementCoverageLabel,
  itemStatusChips,
  ELEMENTS_GENERATED_MESSAGE,
} from './element-status-helpers';

type GroupLink = NonNullable<BoqPiece['drawingGroupLinks']>[number]['group'];
const link = (g: Partial<GroupLink> = {}): Pick<BoqPiece, 'drawingGroupLinks'> => ({
  drawingGroupLinks: [{ group: { id: 'g1', drawingNo: 'HC-1', calculationRef: null, groupTitle: null, status: 'DRAFT', _count: { attachments: 0 }, ...g } }],
});
const el = (status: BoqPiece['currentStatus'], links: Pick<BoqPiece, 'drawingGroupLinks'> = { drawingGroupLinks: [] }) => ({ currentStatus: status, ...links });
const grp = (o: Partial<DrawingGroup> = {}): DrawingGroup => ({ id: 'g1', groupTitle: null, status: 'DRAFT', ...o }) as DrawingGroup;

describe('element status wording (FMP-TECH-25)', () => {
  it('a new element waits for its final drawing — never "Drawing Ready"', () => {
    expect(elementStage(el('DRAWING_READY'))).toBe('waiting-final-drawing');
    expect(elementStatusLabel(el('DRAWING_READY'))).toBe('Waiting Final Drawing');
    expect(elementStatusLabel(el('DRAWING_READY'))).not.toMatch(/Drawing Ready/);
  });

  it('follows the group: no files, files attached, released', () => {
    expect(elementStatusLabel(el('DRAWING_READY', link()))).toBe('Missing Final Drawing');
    expect(elementStatusLabel(el('DRAWING_READY', link({ _count: { attachments: 2 } })))).toBe('Ready to Release');
    expect(elementStatusLabel(el('DRAWING_READY', link({ status: 'RELEASED_TO_PRODUCTION', _count: { attachments: 2 } })))).toBe('Released to Production');
  });

  it('later statuses keep their own names', () => {
    expect(elementStatusLabel(el('IN_PRODUCTION'))).toBe('In Production');
    expect(elementStatusLabel(el('ERECTED'))).toBe('Erected');
  });

  it('Group column: dash before a decision, Not Assigned to Group only once groups are used', () => {
    expect(elementGroupText({ drawingGroupLinks: [] }, false)).toBe('—');
    expect(elementGroupText({ drawingGroupLinks: [] }, true)).toBe('Not Assigned to Group');
    expect(elementGroupText(link({ drawingNo: 'HC-1', calculationRef: 'CALC-1' }), true)).toBe('HC-1 · CALC-1');
    expect(elementGroupText(link({ groupTitle: NO_GROUPING_TITLE }), false)).toBe('No grouping needed');
  });

  it('knows how final drawings are attached for a BOQ item', () => {
    expect(isNoGroupingGroup({ groupTitle: NO_GROUPING_TITLE })).toBe(true);
    expect(isNoGroupingGroup({ groupTitle: 'Zone A' })).toBe(false);
    expect(finalDrawingMethod({ groups: [] })).toBe('not-chosen');
    expect(finalDrawingMethod({ groups: [grp({ status: 'CANCELLED' })] })).toBe('not-chosen');
    expect(finalDrawingMethod({ groups: [grp({ groupTitle: NO_GROUPING_TITLE })] })).toBe('no-grouping');
    expect(finalDrawingMethod({ groups: [grp({ groupTitle: 'Zone A' })] })).toBe('groups');
  });

  it('splits the generated count into waiting and released, and keeps later statuses', () => {
    expect(itemStatusChips({ DRAWING_READY: 10 }, 0).map((c) => `${c.label} ${c.count}`)).toEqual(['Waiting Final Drawing 10']);
    expect(itemStatusChips({ DRAWING_READY: 10 }, 4).map((c) => `${c.label} ${c.count}`)).toEqual(['Waiting Final Drawing 6', 'Released to Production 4']);
    expect(itemStatusChips({ DRAWING_READY: 2, IN_PRODUCTION: 5 }, 2).map((c) => `${c.label} ${c.count}`)).toEqual(['Released to Production 2', 'In Production 5']);
  });

  it('has the confirmation message', () => {
    expect(ELEMENTS_GENERATED_MESSAGE).toBe(
      'Individual elements generated successfully. Next, attach final drawing files. Use Drawing Groups only if different elements need different drawings.',
    );
  });
});

describe('individual element coverage (FMP-TECH-27)', () => {
  const own = (n: number, extra: Record<string, unknown> = {}) => ({ currentStatus: 'DRAWING_READY' as const, drawingGroupLinks: [], _count: { attachments: n }, ...extra });

  it('an element with its own final drawing shows Drawing Uploaded and is ready to release', () => {
    expect(elementStatusLabel(own(1))).toBe('Ready to Release');
    expect(elementCoverageLabel(own(1))).toBe('Drawing Uploaded');
  });

  it('with no file and no group it shows Waiting Final Drawing', () => {
    expect(elementStatusLabel(own(0))).toBe('Waiting Final Drawing');
    expect(elementCoverageLabel(own(0))).toBe('Waiting Final Drawing');
  });

  it('an element in a group with files shows Group Drawing Uploaded', () => {
    expect(elementCoverageLabel(link({ _count: { attachments: 2 } }))).toBe('Group Drawing Uploaded');
    expect(elementCoverageLabel(link())).toBe('Waiting Group Drawing');
  });

  it('released on its own shows Released to Production', () => {
    expect(elementStatusLabel(own(1, { releasedToProductionAt: '2026-10-13T08:00:00Z' }))).toBe('Released to Production');
  });
});

describe('plain drawing wording (FMP-TECH-29)', () => {
  it('an element in a group that has no file yet is Waiting Group Drawing', () => {
    expect(elementCoverageLabel({ drawingGroupLinks: [{ group: { id: 'g1', drawingNo: 'HC-1', calculationRef: null, groupTitle: null, status: 'DRAFT', _count: { attachments: 0 } } }], _count: { attachments: 0 } })).toBe('Waiting Group Drawing');
  });

  it('never uses the confusing words', () => {
    const labels = [
      elementCoverageLabel({ drawingGroupLinks: [], _count: { attachments: 1 } }),
      elementCoverageLabel({ drawingGroupLinks: [], _count: { attachments: 0 } }),
      elementCoverageLabel(link({ _count: { attachments: 1 } })),
      elementCoverageLabel(link()),
    ];
    for (const l of labels) expect(l).not.toMatch(/Covered|Coverage/i);
  });
});
