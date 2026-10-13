import { describe, it, expect } from 'vitest';
import type { BoqConfirmationItem, BoqItemAttachment, DrawingGroup, DrawingGroupItem } from '@/lib/technical-api';
import { guidedWorkflow, GUIDED_COMPLETE_MESSAGE } from './technical-guided-workflow';
import { NO_GROUPING_TITLE } from './element-status-helpers';

const conf = (o: Partial<BoqConfirmationItem> = {}): BoqConfirmationItem =>
  ({ boqItemId: 'i1', sortOrder: 1, description: 'Column', contractQty: '10', contractUnit: 'nos', confirmedPieces: null, confirmations: [], piecesGenerated: 0, statusCounts: {}, pendingPieces: 0, needsAttention: false, ...o }) as BoqConfirmationItem;
const grp = (o: Partial<DrawingGroup> = {}): DrawingGroup =>
  ({ id: 'g1', boqItemId: 'i1', drawingNo: 'HC-1', calculationRef: null, groupTitle: null, status: 'DRAFT', remarks: null, approvedAt: null, releasedAt: null, createdAt: '', pieceCount: 5, fileCount: 0, actions: ['EDIT'], ...o }) as DrawingGroup;
const item = (groups: DrawingGroup[], o: Partial<DrawingGroupItem> = {}): DrawingGroupItem =>
  ({ boqItemId: 'i1', sortOrder: 1, description: 'Column', piecesGenerated: 5, assignedToGroups: 5, notAssigned: 0, approvedPieces: 0, releasedToProduction: 0, groups, ...o });
const file = { id: 'f1' } as BoqItemAttachment;

type Model = ReturnType<typeof guidedWorkflow>;
const stateOf = (m: Model): string[] => m.steps.map((s) => s.state);

describe('guided workflow (FMP-TECH-22)', () => {
  it('starts at Confirm Elements and locks the later steps with a reason', () => {
    const m = guidedWorkflow({ confirmations: [conf()], attachments: [file], groupItems: [item([], { piecesGenerated: 0, assignedToGroups: 0 })] });
    expect(m.currentKey).toBe('confirm-elements');
    expect(stateOf(m)).toEqual(['done', 'current', 'locked', 'locked', 'locked']);
    expect(m.steps[0]!.summary).toBe('1 BOQ item, 1 drawing file attached');
    expect(m.steps[2]!.lockedMessage).toBe('Confirm elements first before creating drawing groups.');
    expect(m.steps[3]!.lockedMessage).toBe('Confirm elements first, then attach final drawing files.');
    expect(m.steps[4]!.lockedMessage).toBe('Final drawing files are required before release to Production.');
    expect(m.nextAction).toBe('Confirm physical elements for each BOQ item.');
  });

  it('does not let missing BOQ drawings block Confirm Elements', () => {
    const m = guidedWorkflow({ confirmations: [conf()], attachments: [], groupItems: [item([], { piecesGenerated: 0 })] });
    expect(m.steps[0]!.state).toBe('pending');
    expect(m.steps[0]!.summary).toBe('No BOQ drawing files attached yet.');
    expect(m.currentKey).toBe('confirm-elements');
  });

  it('after Confirm Elements, Final Drawing Files is next and Drawing Groups is optional', () => {
    const m = guidedWorkflow({ confirmations: [conf({ confirmedPieces: 5, piecesGenerated: 5 })], attachments: [file], groupItems: [item([], { notAssigned: 5, assignedToGroups: 0 })] });
    expect(stateOf(m)).toEqual(['done', 'done', 'optional', 'current', 'locked']);
    expect(m.steps[2]!.summary).toBe('Optional — use only if different elements need different drawings.');
    expect(m.nextAction).toBe('Add final drawing files to a drawing group or to individual elements.');
  });

  it('Drawing Groups becomes the current step once groups are used and elements remain unassigned', () => {
    const m = guidedWorkflow({ confirmations: [conf({ confirmedPieces: 5, piecesGenerated: 5 })], attachments: [file], groupItems: [item([grp()], { notAssigned: 2, assignedToGroups: 3 })] });
    expect(m.currentKey).toBe('drawing-groups');
    expect(stateOf(m)).toEqual(['done', 'done', 'current', 'pending', 'locked']);
  });

  it('no grouping needed: one all-elements set with files makes every element ready to release', () => {
    const all = grp({ groupTitle: NO_GROUPING_TITLE, fileCount: 2, status: 'APPROVED', actions: ['RELEASE'] });
    const m = guidedWorkflow({ confirmations: [conf({ confirmedPieces: 5, piecesGenerated: 5 })], attachments: [], groupItems: [item([all])] });
    expect(stateOf(m)).toEqual(['pending', 'done', 'optional', 'done', 'current']);
    expect(m.currentKey).toBe('release-to-production');
  });

  it('moves to Final Drawing Files, then Release, as groups gain files', () => {
    const base = { confirmations: [conf({ confirmedPieces: 5, piecesGenerated: 5 })], attachments: [file] };
    const noFiles = guidedWorkflow({ ...base, groupItems: [item([grp()])] });
    expect(stateOf(noFiles)).toEqual(['done', 'done', 'done', 'current', 'locked']);
    const withFile = guidedWorkflow({ ...base, groupItems: [item([grp({ fileCount: 1, status: 'APPROVED', actions: ['RELEASE'] })])] });
    expect(stateOf(withFile)).toEqual(['done', 'done', 'done', 'done', 'current']);
  });

  it('is complete once every live group is released', () => {
    const m = guidedWorkflow({
      confirmations: [conf({ confirmedPieces: 5, piecesGenerated: 5 })],
      attachments: [file],
      groupItems: [item([grp({ fileCount: 1, status: 'RELEASED_TO_PRODUCTION', actions: [] })])],
    });
    expect(m.complete).toBe(true);
    expect(m.currentKey).toBeNull();
    expect(m.nextAction).toBe(GUIDED_COMPLETE_MESSAGE);
    expect(stateOf(m)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('keeps the Needs Attention flag on the step', () => {
    const m = guidedWorkflow({ confirmations: [conf({ confirmedPieces: 5, piecesGenerated: 5, needsAttention: true })], attachments: [], groupItems: [item([])] });
    expect(m.steps[1]!.attention).toBe(true);
  });
});

describe('guided workflow with final drawing coverage (FMP-TECH-27)', () => {
  const cov = (o: Partial<{ totalElements: number; coveredByGroup: number; coveredIndividually: number; notCovered: number; readyToRelease: number; released: number }> = {}) => ({
    totalElements: 10, coveredByGroup: 5, coveredIndividually: 0, notCovered: 5, readyToRelease: 5, released: 0, ...o,
  });
  const base = { confirmations: [conf({ confirmedPieces: 10, piecesGenerated: 10 })], attachments: [file] };

  it('shows the overview wording: groups optional, final drawings current, release not ready', () => {
    const m = guidedWorkflow({ ...base, groupItems: [item([], { piecesGenerated: 10, notAssigned: 10, assignedToGroups: 0 })], coverage: cov({ coveredByGroup: 0, readyToRelease: 0 }) });
    expect(stateOf(m)).toEqual(['done', 'done', 'optional', 'current', 'locked']);
    expect(m.steps[2]!.summary).toBe('0 group drawings uploaded, 5 waiting final drawing');
    expect(m.steps[3]!.summary).toBe('5 elements still need a final drawing');
    expect(m.steps[4]!.lockedMessage).toBe('5 elements waiting final drawing. Final drawing files are required before release to Production.');
  });

  it('elements covered individually are enough to unlock Release', () => {
    const m = guidedWorkflow({ ...base, groupItems: [item([], { piecesGenerated: 10 })], coverage: cov({ coveredByGroup: 0, coveredIndividually: 3, notCovered: 7, readyToRelease: 3 }) });
    expect(m.steps[4]!.state).toBe('pending');
  });

  it('is done when every element is covered and released, by group or individually', () => {
    const all = guidedWorkflow({ ...base, groupItems: [item([])], coverage: cov({ coveredByGroup: 4, coveredIndividually: 6, notCovered: 0, readyToRelease: 0, released: 10 }) });
    expect(all.complete).toBe(true);
    expect(stateOf(all).slice(3)).toEqual(['done', 'done']);
  });
});
