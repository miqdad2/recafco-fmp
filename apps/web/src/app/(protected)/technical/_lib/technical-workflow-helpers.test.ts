import { describe, it, expect } from 'vitest';
import type { BoqConfirmationItem, BoqItemAttachment, DrawingGroup, DrawingGroupItem } from '@/lib/technical-api';
import { workflowStepStatuses, releaseSummary, groupsWithoutFiles, WORKFLOW_STEPS } from './technical-workflow-helpers';

const conf = (o: Partial<BoqConfirmationItem> = {}): BoqConfirmationItem =>
  ({ boqItemId: 'i1', sortOrder: 1, description: 'Column', contractQty: '10', contractUnit: 'nos', confirmedPieces: null, confirmations: [], piecesGenerated: 0, statusCounts: {}, pendingPieces: 0, needsAttention: false, ...o }) as BoqConfirmationItem;
const grp = (o: Partial<DrawingGroup> = {}): DrawingGroup =>
  ({ id: 'g1', boqItemId: 'i1', drawingNo: 'HC-1', calculationRef: null, groupTitle: null, status: 'DRAFT', remarks: null, approvedAt: null, releasedAt: null, createdAt: '', pieceCount: 5, fileCount: 0, actions: ['EDIT'], ...o }) as DrawingGroup;
const item = (groups: DrawingGroup[], o: Partial<DrawingGroupItem> = {}): DrawingGroupItem =>
  ({ boqItemId: 'i1', sortOrder: 1, description: 'Column', piecesGenerated: 5, assignedToGroups: 5, notAssigned: 0, approvedPieces: 0, releasedToProduction: 0, groups, ...o });
const file = { id: 'f1' } as BoqItemAttachment;

describe('workflow steps', () => {
  it('lists the 5 BOQ-to-Production steps and no old stage names', () => {
    expect(WORKFLOW_STEPS.map((s) => s.label)).toEqual(['BOQ Drawings', 'Confirm Elements', 'Drawing Groups', 'Final Drawing Files', 'Release to Production']);
  });

  it('everything is Pending with no data', () => {
    const s = workflowStepStatuses({ confirmations: [conf()], attachments: [], groupItems: [item([], { piecesGenerated: 0, assignedToGroups: 0 })] });
    expect(Object.values(s)).toEqual(['Pending', 'Pending', 'Pending', 'Pending', 'Pending']);
  });

  it('tracks each step as work happens', () => {
    const s = workflowStepStatuses({
      confirmations: [conf({ confirmedPieces: 5, piecesGenerated: 5 })],
      attachments: [file],
      groupItems: [item([grp({ fileCount: 1, status: 'APPROVED', actions: ['RELEASE'] })])],
    });
    expect(s).toEqual({ 'boq-drawings': 'Done', 'confirm-elements': 'Done', 'drawing-groups': 'Done', 'final-drawing-files': 'Done', 'release-to-production': 'In Progress' });
  });

  it('flags element mismatches and unassigned elements', () => {
    const s = workflowStepStatuses({
      confirmations: [conf({ confirmedPieces: 5, piecesGenerated: 5, needsAttention: true })],
      attachments: null,
      groupItems: [item([grp()], { notAssigned: 2 })],
    });
    expect(s['confirm-elements']).toBe('Needs Attention');
    expect(s['drawing-groups']).toBe('In Progress');
  });

  it('is Done for release once every live group is released; cancelled groups are ignored', () => {
    const s = workflowStepStatuses({
      confirmations: [],
      attachments: [],
      groupItems: [item([grp({ status: 'RELEASED_TO_PRODUCTION', fileCount: 1 }), grp({ id: 'g2', status: 'CANCELLED' })])],
    });
    expect(s['release-to-production']).toBe('Done');
  });
});

describe('release summary', () => {
  it('splits groups into ready, missing files and released', () => {
    const ready = grp({ id: 'a', status: 'DRAFT', fileCount: 2, actions: ['EDIT'] });
    const noFile = grp({ id: 'b', status: 'APPROVED', fileCount: 0, actions: ['RELEASE'] });
    const done = grp({ id: 'c', status: 'RELEASED_TO_PRODUCTION', fileCount: 1, actions: [] });
    const r = releaseSummary([item([ready, noFile, done])]);
    expect(r.ready.map((g) => g.id)).toEqual(['a']);
    expect(r.missingFiles.map((g) => g.id)).toEqual(['b']);
    expect(r.released.map((g) => g.id)).toEqual(['c']);
    expect(groupsWithoutFiles(item([ready, noFile, done]))).toBe(1);
  });
});
