import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { TechnicalDrawingGroupStatus as S } from '@recafco/database';
import { TechnicalDrawingGroupService } from './technical-drawing-group.service';
import {
  allowedGroupActions,
  summarizeGroupAssignments,
  commonDrawingConfirmationId,
  piecesAlreadyGroupedMessage,
  buildJobReleaseSummary,
} from './drawing-group-rules';
import type { DatabaseService } from '../database/database.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import type { SaveDrawingGroupDto } from './dto/drawing-group.dto';

const mockContractFindUnique = vi.fn();
const mockItemFindFirst = vi.fn();
const mockItemFindMany = vi.fn();
const mockPieceFindMany = vi.fn();
const mockPieceGroupBy = vi.fn();
const mockPieceUpdate = vi.fn(); // a group must never change a piece
const mockGroupCreate = vi.fn();
const mockGroupFindFirst = vi.fn();
const mockGroupUpdate = vi.fn();
const mockGroupUpdateMany = vi.fn();
const mockGroupFindUniqueOrThrow = vi.fn();
const mockLinkFindMany = vi.fn();
const mockLinkCreateMany = vi.fn();
const mockLinkDeleteMany = vi.fn();
const mockLinkUpdateMany = vi.fn();

const client = {
  contract: { findUnique: mockContractFindUnique },
  contractBoqItem: { findFirst: mockItemFindFirst, findMany: mockItemFindMany },
  contractBoqPiece: { findMany: mockPieceFindMany, groupBy: mockPieceGroupBy, update: mockPieceUpdate, updateMany: mockPieceUpdate, createMany: mockPieceUpdate },
  contractBoqPieceStatusHistory: { createMany: mockPieceUpdate },
  technicalDrawingGroup: {
    create: mockGroupCreate,
    findFirst: mockGroupFindFirst,
    update: mockGroupUpdate,
    updateMany: mockGroupUpdateMany,
    findUniqueOrThrow: mockGroupFindUniqueOrThrow,
  },
  technicalDrawingGroupPiece: {
    findMany: mockLinkFindMany,
    createMany: mockLinkCreateMany,
    deleteMany: mockLinkDeleteMany,
    updateMany: mockLinkUpdateMany,
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client)),
};
const db = { getClient: () => client } as unknown as DatabaseService;
const deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;

const actor = (permissions: string[]): AuthUser => ({ id: 'u1', displayName: 'Tech', permissions }) as unknown as AuthUser;
const WRITER = actor(['contracts.read', 'contracts.workflow_update']);
const READER = actor(['contracts.read']);

const dto = (over: Partial<SaveDrawingGroupDto> = {}): SaveDrawingGroupDto => ({
  action: 'DRAFT',
  boqItemId: 'item-1',
  drawingNo: 'HC-001',
  pieceIds: ['p1', 'p2'],
  ...over,
});

const piece = (id: string, conf = 'conf-1') => ({ id, drawingConfirmationId: conf });
const group = (status: S, pieces = 2) => ({ id: 'g1', contractId: 'k1', boqItemId: 'item-1', drawingNo: 'HC-001', status, _count: { pieces } });

let service: TechnicalDrawingGroupService;
beforeEach(() => {
  vi.clearAllMocks();
  mockContractFindUnique.mockResolvedValue({ id: 'k1', departmentId: null });
  mockItemFindFirst.mockResolvedValue({ id: 'item-1' });
  mockPieceFindMany.mockResolvedValue([piece('p1'), piece('p2')]);
  mockLinkFindMany.mockResolvedValue([]);
  mockLinkCreateMany.mockResolvedValue({ count: 2 });
  mockGroupCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ id: 'g1', ...args.data }));
  mockGroupUpdateMany.mockResolvedValue({ count: 1 });
  mockGroupFindUniqueOrThrow.mockResolvedValue({ id: 'g1', status: S.SUBMITTED });
  mockGroupUpdate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ id: 'g1', ...args.data }));
  service = new TechnicalDrawingGroupService(db, deptAccess);
});

describe('drawing group rules', () => {
  it('shows only the actions allowed for each status', () => {
    expect(allowedGroupActions(S.DRAFT)).toEqual(['EDIT', 'SUBMIT', 'CANCEL']);
    expect(allowedGroupActions(S.SUBMITTED)).toEqual(['APPROVE', 'CANCEL']);
    expect(allowedGroupActions(S.APPROVED)).toEqual(['RELEASE', 'CANCEL']);
    expect(allowedGroupActions(S.RELEASED_TO_PRODUCTION)).toEqual([]);
    expect(allowedGroupActions(S.CANCELLED)).toEqual([]);
    expect(allowedGroupActions(S.REVISED)).toEqual([]);
  });

  it('summary counts assigned / unassigned / approved / released pieces', () => {
    // 140 generated; 50 draft, 50 approved, 30 released, 10 not in any group
    const links = [...Array(50).fill(S.DRAFT), ...Array(50).fill(S.APPROVED), ...Array(30).fill(S.RELEASED_TO_PRODUCTION)];
    expect(summarizeGroupAssignments(140, links)).toEqual({
      piecesGenerated: 140,
      assignedToGroups: 130,
      notAssigned: 10,
      approvedPieces: 80,
      releasedToProduction: 30,
    });
    expect(summarizeGroupAssignments(0, [])).toEqual({ piecesGenerated: 0, assignedToGroups: 0, notAssigned: 0, approvedPieces: 0, releasedToProduction: 0 });
  });

  it('links a group to a drawing confirmation only when all its pieces share one', () => {
    expect(commonDrawingConfirmationId([piece('a', 'c1'), piece('b', 'c1')])).toBe('c1');
    expect(commonDrawingConfirmationId([piece('a', 'c1'), piece('b', 'c2')])).toBeNull();
    expect(commonDrawingConfirmationId([])).toBeNull();
  });

  it('words the already-grouped message plainly', () => {
    expect(piecesAlreadyGroupedMessage(1)).toBe('1 piece is already in another drawing group.');
    expect(piecesAlreadyGroupedMessage(3)).toBe('3 pieces are already in another drawing group.');
  });
});

describe('TechnicalDrawingGroupService.create', () => {
  it('creates a draft with the selected pieces (one active link per piece)', async () => {
    const created = (await service.create('k1', dto({ calculationRef: 'CALC-001', groupTitle: 'HC slabs zone A' }), WRITER)) as Record<string, unknown>;
    expect(created['status']).toBe(S.DRAFT);
    expect(created['drawingNo']).toBe('HC-001');
    expect(created['calculationRef']).toBe('CALC-001');
    expect(created['createdById']).toBe('u1');
    expect(created['drawingConfirmationId']).toBe('conf-1');
    expect(mockLinkCreateMany.mock.calls[0]?.[0].data).toEqual([
      { groupId: 'g1', pieceId: 'p1', activeSlot: 1 },
      { groupId: 'g1', pieceId: 'p2', activeSlot: 1 },
    ]);
  });

  it('submit needs a drawing number', async () => {
    await expect(service.create('k1', dto({ action: 'SUBMIT', drawingNo: '  ' }), WRITER)).rejects.toThrow('Please enter drawing number.');
    expect(mockGroupCreate).not.toHaveBeenCalled();
  });

  it('submit needs at least one selected piece', async () => {
    await expect(service.create('k1', dto({ action: 'SUBMIT', pieceIds: [] }), WRITER)).rejects.toThrow('Please select at least one piece.');
    await expect(service.create('k1', dto({ action: 'SUBMIT', pieceIds: [] }), WRITER)).rejects.toThrow(UnprocessableEntityException);
    expect(mockGroupCreate).not.toHaveBeenCalled();
  });

  it('submit with pieces creates a Submitted group', async () => {
    const created = (await service.create('k1', dto({ action: 'SUBMIT' }), WRITER)) as Record<string, unknown>;
    expect(created['status']).toBe(S.SUBMITTED);
  });

  it('a draft may be saved with no pieces yet', async () => {
    const created = (await service.create('k1', dto({ pieceIds: [] }), WRITER)) as Record<string, unknown>;
    expect(created['status']).toBe(S.DRAFT);
    expect(mockLinkCreateMany).not.toHaveBeenCalled();
  });

  it('asks for a BOQ item', async () => {
    const withoutItem: SaveDrawingGroupDto = { action: 'DRAFT', drawingNo: 'HC-001', pieceIds: ['p1'] };
    await expect(service.create('k1', withoutItem, WRITER)).rejects.toThrow('Please select BOQ item.');
  });

  it('a piece cannot be in two active groups', async () => {
    mockLinkFindMany.mockResolvedValue([{ pieceId: 'p2' }]);
    await expect(service.create('k1', dto(), WRITER)).rejects.toThrow('1 piece is already in another drawing group.');
    await expect(service.create('k1', dto(), WRITER)).rejects.toThrow(ConflictException);
    expect(mockGroupCreate).not.toHaveBeenCalled();
    // only ACTIVE links count — a cancelled group's pieces are free again
    expect(mockLinkFindMany.mock.calls[0]?.[0].where).toMatchObject({ activeSlot: 1 });
  });

  it('a simultaneous second assignment is stopped by the unique active link', async () => {
    mockLinkCreateMany.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    await expect(service.create('k1', dto(), WRITER)).rejects.toThrow(ConflictException);
  });

  it('rejects pieces that are not generated pieces of this BOQ item', async () => {
    mockPieceFindMany.mockResolvedValue([piece('p1')]); // p2 not found / cancelled / other item
    await expect(service.create('k1', dto(), WRITER)).rejects.toThrow('Some selected pieces are not available for this BOQ item.');
  });

  it('read-only users cannot create', async () => {
    await expect(service.create('k1', dto(), READER)).rejects.toThrow(ForbiddenException);
  });

  it('never changes a piece (no status, no history)', async () => {
    await service.create('k1', dto({ action: 'SUBMIT' }), WRITER);
    expect(mockPieceUpdate).not.toHaveBeenCalled();
  });
});

describe('status flow', () => {
  it('edits a draft by replacing its piece list and can submit it', async () => {
    mockGroupFindFirst.mockResolvedValue(group(S.DRAFT));
    await service.updateDraft('k1', 'g1', dto({ action: 'SUBMIT', pieceIds: ['p1', 'p2'] }), WRITER);
    expect(mockLinkDeleteMany).toHaveBeenCalledWith({ where: { groupId: 'g1' } });
    expect(mockLinkCreateMany).toHaveBeenCalledTimes(1);
    expect(mockGroupUpdate.mock.calls[0]?.[0].data.status).toBe(S.SUBMITTED);
    // pieces of THIS group do not count as "taken" while editing it
    expect(mockLinkFindMany.mock.calls[0]?.[0].where.groupId).toEqual({ not: 'g1' });
  });

  it('only a draft can be edited', async () => {
    mockGroupFindFirst.mockResolvedValue(group(S.APPROVED));
    await expect(service.updateDraft('k1', 'g1', dto(), WRITER)).rejects.toThrow('Only a draft group can be changed.');
  });

  it('submits a draft that has a drawing number and pieces', async () => {
    mockGroupFindFirst.mockResolvedValue(group(S.DRAFT, 2));
    await service.submit('k1', 'g1', WRITER);
    expect(mockGroupUpdateMany.mock.calls[0]?.[0]).toMatchObject({ where: { id: 'g1', status: S.DRAFT }, data: { status: S.SUBMITTED } });
  });

  it('cannot submit a group with no pieces', async () => {
    mockGroupFindFirst.mockResolvedValue(group(S.DRAFT, 0));
    await expect(service.submit('k1', 'g1', WRITER)).rejects.toThrow('Please select at least one piece.');
  });

  it('approves a submitted group and records who and when', async () => {
    mockGroupFindFirst.mockResolvedValue(group(S.SUBMITTED));
    await service.approve('k1', 'g1', WRITER);
    const data = mockGroupUpdateMany.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ status: S.APPROVED, approvedById: 'u1' });
    expect(data.approvedAt).toBeInstanceOf(Date);
  });

  it('only a submitted group can be approved', async () => {
    mockGroupFindFirst.mockResolvedValue(group(S.DRAFT));
    await expect(service.approve('k1', 'g1', WRITER)).rejects.toThrow('Only a submitted group can be approved.');
  });

  it('releases an approved group to Production — recording only the group, never a piece', async () => {
    mockGroupFindFirst.mockResolvedValue(group(S.APPROVED));
    await service.release('k1', 'g1', WRITER);
    const data = mockGroupUpdateMany.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ status: S.RELEASED_TO_PRODUCTION, releasedById: 'u1' });
    expect(data.releasedAt).toBeInstanceOf(Date);
    expect(mockPieceUpdate).not.toHaveBeenCalled();
  });

  it('only an approved group can be released', async () => {
    mockGroupFindFirst.mockResolvedValue(group(S.SUBMITTED));
    await expect(service.release('k1', 'g1', WRITER)).rejects.toThrow('Only an approved group can be released to Production.');
  });

  it('two people clicking at once: the second change is refused, not applied twice', async () => {
    mockGroupFindFirst.mockResolvedValue(group(S.SUBMITTED));
    mockGroupUpdateMany.mockResolvedValue({ count: 0 });
    await expect(service.approve('k1', 'g1', WRITER)).rejects.toThrow(ConflictException);
  });

  it('cancelling keeps the group and frees its pieces', async () => {
    mockGroupFindFirst.mockResolvedValue(group(S.APPROVED));
    await service.cancel('k1', 'g1', WRITER);
    expect(mockGroupUpdateMany.mock.calls[0]?.[0].data).toEqual({ status: S.CANCELLED });
    expect(mockLinkUpdateMany.mock.calls[0]?.[0]).toEqual({ where: { groupId: 'g1' }, data: { activeSlot: null } });
    expect(mockLinkDeleteMany).not.toHaveBeenCalled();
  });

  it('a released group cannot be cancelled', async () => {
    mockGroupFindFirst.mockResolvedValue(group(S.RELEASED_TO_PRODUCTION));
    await expect(service.cancel('k1', 'g1', WRITER)).rejects.toThrow('This group cannot be cancelled.');
  });

  it('read-only users cannot submit, approve, release or cancel', async () => {
    for (const fn of [service.submit, service.approve, service.release, service.cancel]) {
      await expect(fn.call(service, 'k1', 'g1', READER)).rejects.toThrow(ForbiddenException);
    }
  });

  it('404s for an unknown group', async () => {
    mockGroupFindFirst.mockResolvedValue(null);
    await expect(service.approve('k1', 'nope', WRITER)).rejects.toThrow(NotFoundException);
  });
});

describe('TechnicalDrawingGroupService.list', () => {
  it('shows pieces generated, assigned, not assigned, approved and released per BOQ item', async () => {
    mockItemFindMany.mockResolvedValue([
      { id: 'item-1', sortOrder: 1, description: 'Hollowcore Slab', technicalDrawingGroups: [{ id: 'g1', status: S.DRAFT, _count: { pieces: 5 } }] },
    ]);
    mockPieceGroupBy.mockResolvedValue([{ boqItemId: 'item-1', _count: { _all: 10 } }]);
    mockLinkFindMany.mockResolvedValue([
      ...Array(3).fill({ group: { boqItemId: 'item-1', status: S.RELEASED_TO_PRODUCTION } }),
      ...Array(2).fill({ group: { boqItemId: 'item-1', status: S.DRAFT } }),
    ]);
    const result = await service.list('k1', READER);
    expect(result[0]).toMatchObject({
      piecesGenerated: 10,
      assignedToGroups: 5,
      notAssigned: 5,
      approvedPieces: 3,
      releasedToProduction: 3,
    });
    expect(result[0]?.groups[0]).toMatchObject({ pieceCount: 5, actions: ['EDIT', 'SUBMIT', 'CANCEL'] });
  });

  it('only counts ACTIVE links', async () => {
    mockItemFindMany.mockResolvedValue([]);
    mockPieceGroupBy.mockResolvedValue([]);
    await service.list('k1', READER);
    expect(mockLinkFindMany.mock.calls[0]?.[0].where).toMatchObject({ activeSlot: 1 });
  });
});

describe('buildJobReleaseSummary (Technical dashboard)', () => {
  const g = (status: S, pieceCount: number, fileCount: number) => ({ status, pieceCount, fileCount });
  it('counts assigned / not assigned / released / not released and groups', () => {
    const r = buildJobReleaseSummary(140, 140, [
      g(S.RELEASED_TO_PRODUCTION, 50, 2),
      g(S.APPROVED, 50, 0),
      g(S.SUBMITTED, 20, 1),
      g(S.DRAFT, 5, 0),
    ]);
    expect(r).toMatchObject({
      generated: 140,
      assigned: 125,
      notAssigned: 15,
      released: 50,
      notReleased: 75,
      groupsTotal: 4,
      groupsWithFiles: 2,
      groupsNoFiles: 2,
      groupsSubmitted: 1,
      groupsApproved: 1,
      groupsNotReleased: 3,
      filesAttachedPieces: 70,
    });
  });
  it('ignores cancelled / revised groups (they hold no pieces)', () => {
    const r = buildJobReleaseSummary(10, 10, [g(S.CANCELLED, 10, 3), g(S.REVISED, 10, 1)]);
    expect(r).toMatchObject({ assigned: 0, notAssigned: 10, groupsTotal: 0 });
  });
  it('reports confirmed pieces not generated and never goes negative', () => {
    expect(buildJobReleaseSummary(12, 4, []).confirmedNotGenerated).toBe(8);
    expect(buildJobReleaseSummary(4, 12, [g(S.DRAFT, 20, 0)])).toMatchObject({ confirmedNotGenerated: 0, notAssigned: 0 });
  });
  it('a job with nothing yet is all zeros', () => {
    expect(buildJobReleaseSummary(0, 0, [])).toMatchObject({ generated: 0, assigned: 0, groupsTotal: 0, notReleased: 0 });
  });
});
