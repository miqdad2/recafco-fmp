import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TechnicalDrawingGroupStatus as S } from '@recafco/database';
import { ProductionPiecesService } from './production-pieces.service';
import { ProductionPiecesController } from './production-pieces.controller';
import { toProductionDrawingGroup, PRODUCTION_FILE_MESSAGES } from './production-drawing-files';
import type { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/types/auth-user';

const mockPieceFindMany = vi.fn();
const mockPieceCount = vi.fn();
const mockPieceFindUnique = vi.fn();
const mockAttFindMany = vi.fn();
const mockAttFindFirst = vi.fn();
const mockAttWrite = vi.fn(); // Production must never create / update / delete a Technical file
const mockGroupWrite = vi.fn(); // ...or touch a group

const client = {
  contractBoqPiece: { findMany: mockPieceFindMany, count: mockPieceCount, findUnique: mockPieceFindUnique },
  technicalDrawingGroupAttachment: {
    findMany: mockAttFindMany,
    findFirst: mockAttFindFirst,
    create: mockAttWrite,
    update: mockAttWrite,
    delete: mockAttWrite,
    deleteMany: mockAttWrite,
  },
  technicalDrawingGroup: { update: mockGroupWrite, updateMany: mockGroupWrite, create: mockGroupWrite },
};
const db = { getClient: () => client } as unknown as DatabaseService;

const actor = (permissions: string[]): AuthUser => ({ id: 'u1', displayName: 'Prod', permissions }) as unknown as AuthUser;
const PRODUCER = actor(['production.read', 'production.update']);
const VIEWER = actor(['production.read']);
const TECHNICAL_ONLY = actor(['contracts.read', 'contracts.update', 'contracts.workflow_update']);

const group = (status: S, over: Record<string, unknown> = {}) => ({
  id: 'g1',
  drawingNo: 'HC-001',
  calculationRef: 'CALC-001',
  groupTitle: 'Zone A',
  status,
  _count: { attachments: 2 },
  ...over,
});
const link = (status: S) => [{ group: group(status) }];

const pieceWithGroup = (status: S | null) => ({
  id: 'p1',
  pieceCode: 'HC-001-001',
  contract: { referenceNumber: 'CONTRACT-2026-000001', jobOrder: 'JO-1', title: 'Tower A' },
  drawingGroupLinks: status ? [{ group: { id: 'g1', drawingNo: 'HC-001', calculationRef: 'CALC-001', groupTitle: 'Zone A', status } }] : [],
});

let service: ProductionPiecesService;
beforeEach(() => {
  vi.clearAllMocks();
  service = new ProductionPiecesService(db);
});

describe('toProductionDrawingGroup', () => {
  it('a piece in no group is null ("No drawing group")', () => {
    expect(toProductionDrawingGroup([])).toBeNull();
    expect(toProductionDrawingGroup(undefined)).toBeNull();
  });
  it('a released group exposes drawing no, calculation ref, title and file count', () => {
    expect(toProductionDrawingGroup(link(S.RELEASED_TO_PRODUCTION))).toEqual({
      released: true,
      drawingNo: 'HC-001',
      calculationRef: 'CALC-001',
      groupTitle: 'Zone A',
      fileCount: 2,
    });
  });
  it.each([S.DRAFT, S.SUBMITTED, S.APPROVED, S.REVISED, S.CANCELLED])(
    'a %s group exposes nothing but "not released" — no drawing no, title or files',
    (status) => {
      expect(toProductionDrawingGroup(link(status))).toEqual({ released: false });
    },
  );
});

describe('Production piece list carries the drawing group', () => {
  it('asks for the group and maps it per piece', async () => {
    mockPieceFindMany.mockResolvedValue([
      { id: 'a', pieceCode: 'A', drawingGroupLinks: link(S.RELEASED_TO_PRODUCTION) },
      { id: 'b', pieceCode: 'B', drawingGroupLinks: link(S.SUBMITTED) },
      { id: 'c', pieceCode: 'C', drawingGroupLinks: [] },
    ]);
    mockPieceCount.mockResolvedValue(3);
    const result = await service.list({}, VIEWER);
    expect(mockPieceFindMany.mock.calls[0]?.[0].select.drawingGroupLinks.where).toEqual({ activeSlot: 1 });
    expect(result.items.map((i) => i.drawingGroup)).toEqual([
      { released: true, drawingNo: 'HC-001', calculationRef: 'CALC-001', groupTitle: 'Zone A', fileCount: 2 },
      { released: false },
      null,
    ]);
    // the raw links never reach the browser
    expect(result.items[0]).not.toHaveProperty('drawingGroupLinks');
  });

  it('the default list is unchanged (Drawing Ready + In Production, cancelled never listed)', async () => {
    mockPieceFindMany.mockResolvedValue([]);
    mockPieceCount.mockResolvedValue(0);
    await service.list({}, VIEWER);
    const where = mockPieceFindMany.mock.calls[0]?.[0].where;
    expect(where.currentStatus).toEqual({ in: ['DRAWING_READY', 'IN_PRODUCTION'] });
    expect(where.isCancelled).toBe(false);
  });
});

describe('released drawing files', () => {
  it('a production user can list the files of a released group (no raw paths)', async () => {
    mockPieceFindUnique.mockResolvedValue(pieceWithGroup(S.RELEASED_TO_PRODUCTION));
    mockAttFindMany.mockResolvedValue([{ id: 'f1', originalName: 'HC-001.pdf', mimeType: 'application/pdf', fileSize: 1000, category: 'DRAWING', createdAt: new Date() }]);
    const result = await service.drawingFiles('p1', VIEWER);
    expect(result).toMatchObject({
      pieceCode: 'HC-001-001',
      contract: { jobOrder: 'JO-1', title: 'Tower A' },
      group: { drawingNo: 'HC-001', calculationRef: 'CALC-001', groupTitle: 'Zone A' },
    });
    expect(result.files).toHaveLength(1);
    expect(mockAttFindMany.mock.calls[0]?.[0].where).toEqual({ groupId: 'g1' });
    expect(mockAttFindMany.mock.calls[0]?.[0].select.storagePath).toBeUndefined();
  });

  it.each([S.DRAFT, S.SUBMITTED, S.APPROVED])('a %s group does not expose its files to Production', async (status) => {
    mockPieceFindUnique.mockResolvedValue(pieceWithGroup(status));
    await expect(service.drawingFiles('p1', VIEWER)).rejects.toThrow('Drawing files are not released to Production yet.');
    await expect(service.drawingFiles('p1', VIEWER)).rejects.toThrow(ForbiddenException);
    expect(mockAttFindMany).not.toHaveBeenCalled();
  });

  it('a piece with no drawing group says so', async () => {
    mockPieceFindUnique.mockResolvedValue(pieceWithGroup(null));
    await expect(service.drawingFiles('p1', VIEWER)).rejects.toThrow('No drawing group assigned.');
  });

  it('an unknown piece is not found', async () => {
    mockPieceFindUnique.mockResolvedValue(null);
    await expect(service.drawingFiles('x', VIEWER)).rejects.toThrow(NotFoundException);
  });

  it('a production user can download a file of the released group only', async () => {
    mockPieceFindUnique.mockResolvedValue(pieceWithGroup(S.RELEASED_TO_PRODUCTION));
    mockAttFindFirst.mockResolvedValue({ storagePath: 'g1/random.pdf', originalName: 'HC-001.pdf', mimeType: 'application/pdf' });
    expect(await service.drawingFileForDownload('p1', 'f1', VIEWER)).toMatchObject({ originalName: 'HC-001.pdf' });
    // the file must belong to THIS piece's released group
    expect(mockAttFindFirst.mock.calls[0]?.[0].where).toEqual({ id: 'f1', groupId: 'g1' });
  });

  it('a file of another group (or unknown) is not found', async () => {
    mockPieceFindUnique.mockResolvedValue(pieceWithGroup(S.RELEASED_TO_PRODUCTION));
    mockAttFindFirst.mockResolvedValue(null);
    await expect(service.drawingFileForDownload('p1', 'foreign', VIEWER)).rejects.toThrow('File not found.');
  });

  it('cannot download a file of a group that is not released', async () => {
    mockPieceFindUnique.mockResolvedValue(pieceWithGroup(S.APPROVED));
    await expect(service.drawingFileForDownload('p1', 'f1', VIEWER)).rejects.toThrow(PRODUCTION_FILE_MESSAGES.notReleased);
    expect(mockAttFindFirst).not.toHaveBeenCalled();
  });

  it('needs production access — Technical / contract users do not gain it', async () => {
    await expect(service.drawingFiles('p1', TECHNICAL_ONLY)).rejects.toThrow(ForbiddenException);
    await expect(service.drawingFileForDownload('p1', 'f1', TECHNICAL_ONLY)).rejects.toThrow(ForbiddenException);
    await expect(service.list({}, TECHNICAL_ONLY)).rejects.toThrow(ForbiddenException);
  });

  it('is read-only: reading never creates, changes or deletes a file or a group', async () => {
    mockPieceFindUnique.mockResolvedValue(pieceWithGroup(S.RELEASED_TO_PRODUCTION));
    mockAttFindMany.mockResolvedValue([]);
    mockAttFindFirst.mockResolvedValue({ storagePath: 'g1/r.pdf', originalName: 'x.pdf', mimeType: 'application/pdf' });
    await service.drawingFiles('p1', PRODUCER);
    await service.drawingFileForDownload('p1', 'f1', PRODUCER);
    expect(mockAttWrite).not.toHaveBeenCalled();
    expect(mockGroupWrite).not.toHaveBeenCalled();
  });
});

describe('Production has no way to upload, edit or delete Technical files', () => {
  it('the Production controller and service expose no file write methods', () => {
    const names = [...Object.getOwnPropertyNames(ProductionPiecesController.prototype), ...Object.getOwnPropertyNames(ProductionPiecesService.prototype)];
    expect(names.filter((n) => /upload|delete|remove|attach/i.test(n))).toEqual([]);
    expect(names).toEqual(expect.arrayContaining(['drawingFiles', 'downloadDrawingFile', 'drawingFileForDownload']));
  });
});
