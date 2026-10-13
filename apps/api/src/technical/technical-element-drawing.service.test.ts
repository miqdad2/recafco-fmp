import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { TechnicalDrawingGroupStatus as S } from '@recafco/database';
import { TechnicalElementDrawingService, ELEMENT_DRAWING_MESSAGES } from './technical-element-drawing.service';
import { classifyElement, individualReleaseBlocker, summarizeCoverage } from './element-coverage';
import type { TechnicalAttachmentStorageService } from './technical-attachment-storage.service';
import type { DatabaseService } from '../database/database.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';

describe('element coverage rules (FMP-TECH-27)', () => {
  const noGroup = { group: null, releasedToProductionAt: null };

  it('an element with no group file and no own file is not covered and waits', () => {
    expect(classifyElement({ ...noGroup, individualFileCount: 0 })).toEqual({ coverage: 'NONE', releaseState: 'WAITING' });
    expect(classifyElement({ group: { status: S.DRAFT, fileCount: 0 }, individualFileCount: 0, releasedToProductionAt: null })).toEqual({ coverage: 'NONE', releaseState: 'WAITING' });
  });

  it('is covered by its group once the group has a file, or individually by its own file', () => {
    expect(classifyElement({ group: { status: S.DRAFT, fileCount: 2 }, individualFileCount: 0, releasedToProductionAt: null })).toEqual({ coverage: 'GROUP', releaseState: 'READY' });
    expect(classifyElement({ ...noGroup, individualFileCount: 1 })).toEqual({ coverage: 'INDIVIDUAL', releaseState: 'READY' });
  });

  it('is released through its released group, or on its own', () => {
    expect(classifyElement({ group: { status: S.RELEASED_TO_PRODUCTION, fileCount: 1 }, individualFileCount: 0, releasedToProductionAt: null }).releaseState).toBe('RELEASED');
    expect(classifyElement({ ...noGroup, individualFileCount: 1, releasedToProductionAt: new Date() }).releaseState).toBe('RELEASED');
  });

  it('summarises Total / Covered by Group / Covered Individually / Not Covered Yet / Ready to Release', () => {
    const rows = [
      classifyElement({ group: { status: S.DRAFT, fileCount: 1 }, individualFileCount: 0, releasedToProductionAt: null }),
      classifyElement({ group: { status: S.DRAFT, fileCount: 1 }, individualFileCount: 0, releasedToProductionAt: null }),
      classifyElement({ ...noGroup, individualFileCount: 1 }),
      classifyElement({ ...noGroup, individualFileCount: 0 }),
      classifyElement({ group: { status: S.RELEASED_TO_PRODUCTION, fileCount: 1 }, individualFileCount: 0, releasedToProductionAt: null }),
    ];
    expect(summarizeCoverage(rows)).toEqual({ totalElements: 5, coveredByGroup: 3, coveredIndividually: 1, notCovered: 1, readyToRelease: 3, released: 1 });
  });

  it('explains why an element cannot be released on its own', () => {
    const base = { cancelled: false, group: null, individualFileCount: 1, releasedToProductionAt: null };
    expect(individualReleaseBlocker(base)).toBeNull();
    expect(individualReleaseBlocker({ ...base, individualFileCount: 0 })).toBe('Final drawing coverage is required before release to Production.');
    expect(individualReleaseBlocker({ ...base, group: { status: S.DRAFT, fileCount: 1 } })).toMatch(/Release its group/);
    expect(individualReleaseBlocker({ ...base, releasedToProductionAt: new Date() })).toMatch(/already released/);
    expect(individualReleaseBlocker({ ...base, cancelled: true })).toMatch(/cancelled/);
  });
});

const mockPieceFindFirst = vi.fn();
const mockPieceFindMany = vi.fn();
const mockPieceUpdateMany = vi.fn();
const mockAttCreate = vi.fn();
const mockAttFindFirst = vi.fn();
const mockAttFindMany = vi.fn();
const mockAttDelete = vi.fn();
const mockContractFindUnique = vi.fn();
const mockUserFindMany = vi.fn();

const client = {
  contract: { findUnique: mockContractFindUnique },
  user: { findMany: mockUserFindMany },
  contractBoqPiece: { findFirst: mockPieceFindFirst, findMany: mockPieceFindMany, updateMany: mockPieceUpdateMany },
  contractBoqPieceAttachment: { create: mockAttCreate, findFirst: mockAttFindFirst, findMany: mockAttFindMany, delete: mockAttDelete },
};
const db = { getClient: () => client } as unknown as DatabaseService;
const deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;
const mockSave = vi.fn();
const mockDeleteFile = vi.fn();
const storage = { save: mockSave, deleteFile: mockDeleteFile, createReadStream: vi.fn() } as unknown as TechnicalAttachmentStorageService;

const actor = (permissions: string[], id = 'u1'): AuthUser => ({ id, displayName: 'User', permissions }) as unknown as AuthUser;
const WRITER = actor(['technical.read', 'technical.update']);
const READER = actor(['technical.read']);
const file = (over: Partial<{ originalname: string; mimetype: string; size: number }> = {}) => ({ buffer: Buffer.from('x'), originalname: 'GA-01.pdf', mimetype: 'application/pdf', size: 1000, ...over });

const freePiece = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  pieceCode: 'DN-0001-001',
  boqItemId: 'item-1',
  isCancelled: false,
  currentStatus: 'DRAWING_READY',
  releasedToProductionAt: null,
  drawingGroupLinks: [],
  _count: { attachments: 0 },
  ...over,
});

let service: TechnicalElementDrawingService;
beforeEach(() => {
  vi.clearAllMocks();
  mockContractFindUnique.mockResolvedValue({ id: 'k1', departmentId: null });
  mockUserFindMany.mockResolvedValue([]);
  mockPieceFindFirst.mockResolvedValue(freePiece());
  mockSave.mockResolvedValue({ fileName: 'r.pdf', storagePath: 'boq-elements/p1/r.pdf' });
  mockAttCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ id: 'a1', ...args.data }));
  mockPieceUpdateMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) => ({ count: args.where.id.in.length }));
  service = new TechnicalElementDrawingService(db, deptAccess, storage);
});

describe('TechnicalElementDrawingService.upload', () => {
  it('attaches a final drawing to an individual element, under that element\'s own folder', async () => {
    await service.upload('k1', 'p1', { drawingRefNo: 'DN-1', revision: 'Rev A', remarks: undefined }, file(), WRITER);
    expect(mockSave).toHaveBeenCalledWith('boq-elements/p1', expect.any(Buffer), 'GA-01.pdf');
    expect(mockAttCreate.mock.calls[0]![0].data).toMatchObject({ pieceId: 'p1', contractId: 'k1', boqItemId: 'item-1', drawingRefNo: 'DN-1', revision: 'Rev A', uploadedById: 'u1' });
  });

  it('accepts TIF/TIFF like every other Technical drawing', async () => {
    await service.upload('k1', 'p1', { drawingRefNo: undefined, revision: undefined, remarks: undefined }, file({ originalname: 'sheet.tif', mimetype: '' }), WRITER);
    expect(mockAttCreate.mock.calls[0]![0].data.mimeType).toBe('image/tiff');
  });

  it('refuses an element that is in a Drawing Group, or already released', async () => {
    mockPieceFindFirst.mockResolvedValue(freePiece({ drawingGroupLinks: [{ group: { status: S.DRAFT, _count: { attachments: 0 } } }] }));
    await expect(service.upload('k1', 'p1', { drawingRefNo: undefined, revision: undefined, remarks: undefined }, file(), WRITER)).rejects.toThrow(ELEMENT_DRAWING_MESSAGES.inGroup);
    mockPieceFindFirst.mockResolvedValue(freePiece({ releasedToProductionAt: new Date() }));
    await expect(service.upload('k1', 'p1', { drawingRefNo: undefined, revision: undefined, remarks: undefined }, file(), WRITER)).rejects.toThrow(ELEMENT_DRAWING_MESSAGES.released);
    expect(mockAttCreate).not.toHaveBeenCalled();
  });

  it('plain messages for a missing file, a wrong type and a too-large file; read-only users cannot upload', async () => {
    const input = { drawingRefNo: undefined, revision: undefined, remarks: undefined };
    await expect(service.upload('k1', 'p1', input, undefined, WRITER)).rejects.toThrow(UnprocessableEntityException);
    await expect(service.upload('k1', 'p1', input, file({ originalname: 'x.exe', mimetype: 'application/x-msdownload' }), WRITER)).rejects.toThrow(ELEMENT_DRAWING_MESSAGES.badType);
    await expect(service.upload('k1', 'p1', input, file({ size: 26 * 1024 * 1024 }), WRITER)).rejects.toThrow(ELEMENT_DRAWING_MESSAGES.tooLarge);
    await expect(service.upload('k1', 'p1', input, file(), READER)).rejects.toThrow(ForbiddenException);
  });

  it('404s for an element of another job and removes the file if saving the record fails', async () => {
    mockPieceFindFirst.mockResolvedValue(null);
    await expect(service.upload('k1', 'p1', { drawingRefNo: undefined, revision: undefined, remarks: undefined }, file(), WRITER)).rejects.toThrow(NotFoundException);
    mockPieceFindFirst.mockResolvedValue(freePiece());
    mockAttCreate.mockRejectedValue(new Error('db down'));
    await expect(service.upload('k1', 'p1', { drawingRefNo: undefined, revision: undefined, remarks: undefined }, file(), WRITER)).rejects.toThrow('db down');
    expect(mockDeleteFile).toHaveBeenCalledWith('boq-elements/p1/r.pdf');
  });
});

describe('TechnicalElementDrawingService.release', () => {
  const releasable = (id: string, over: Record<string, unknown> = {}) => freePiece({ id, pieceCode: `DN-${id}`, _count: { attachments: 1 }, ...over });

  it('releases individually covered elements only, recording who and when', async () => {
    mockPieceFindMany.mockResolvedValue([releasable('p1'), releasable('p2')]);
    const result = await service.release('k1', ['p1', 'p2'], WRITER);
    expect(result).toEqual({ released: 2 });
    const call = mockPieceUpdateMany.mock.calls[0]![0];
    expect(call.where).toMatchObject({ id: { in: ['p1', 'p2'] }, releasedToProductionAt: null });
    expect(call.data.releasedToProductionById).toBe('u1');
    expect(call.data.releasedToProductionAt).toBeInstanceOf(Date);
  });

  it('refuses everything if any selected element has no final drawing coverage', async () => {
    mockPieceFindMany.mockResolvedValue([releasable('p1'), releasable('p2', { _count: { attachments: 0 } })]);
    await expect(service.release('k1', ['p1', 'p2'], WRITER)).rejects.toThrow('Final drawing coverage is required before release to Production.');
    expect(mockPieceUpdateMany).not.toHaveBeenCalled();
  });

  it('a grouped element is released with its group, not on its own', async () => {
    mockPieceFindMany.mockResolvedValue([releasable('p1', { drawingGroupLinks: [{ group: { status: S.APPROVED, _count: { attachments: 2 } } }] })]);
    await expect(service.release('k1', ['p1'], WRITER)).rejects.toThrow(ConflictException);
  });

  it('needs a selection, existing elements of this job, and write permission', async () => {
    await expect(service.release('k1', [], WRITER)).rejects.toThrow(ELEMENT_DRAWING_MESSAGES.noneSelected);
    mockPieceFindMany.mockResolvedValue([]);
    await expect(service.release('k1', ['p1'], WRITER)).rejects.toThrow(NotFoundException);
    await expect(service.release('k1', ['p1'], READER)).rejects.toThrow(ForbiddenException);
  });
});

describe('TechnicalElementDrawingService.coverage', () => {
  it('lists live elements with coverage and a summary, never writing anything', async () => {
    const row = (id: string, over: Record<string, unknown>) => ({
      id, boqItemId: 'item-1', pieceNo: 1, pieceCode: `DN-${id}`, drawingNo: 'DN', currentStatus: 'DRAWING_READY', releasedToProductionAt: null,
      boqItem: { sortOrder: 1, description: 'Beam' }, drawingGroupLinks: [], _count: { attachments: 0 }, ...over,
    });
    mockPieceFindMany.mockResolvedValue([
      row('a', { drawingGroupLinks: [{ group: { id: 'g1', drawingNo: 'G', calculationRef: null, groupTitle: null, status: S.DRAFT, _count: { attachments: 1 } } }] }),
      row('b', { _count: { attachments: 2 } }),
      row('c', {}),
    ]);
    const result = await service.coverage('k1', READER);
    expect(result.summary).toEqual({ totalElements: 3, coveredByGroup: 1, coveredIndividually: 1, notCovered: 1, readyToRelease: 2, released: 0 });
    expect(result.elements.map((e) => [e.id, e.coverage, e.releaseState])).toEqual([['a', 'GROUP', 'READY'], ['b', 'INDIVIDUAL', 'READY'], ['c', 'NONE', 'WAITING']]);
    expect(mockPieceUpdateMany).not.toHaveBeenCalled();
  });
});

describe('TechnicalElementDrawingService.coverage — release details (FMP-TECH-31)', () => {
  const row = (id: string, over: Record<string, unknown>) => ({
    id, boqItemId: 'item-1', pieceNo: 1, pieceCode: `DN-${id}`, drawingNo: 'DN', currentStatus: 'DRAWING_READY', releasedToProductionAt: null, releasedToProductionById: null,
    boqItem: { sortOrder: 1, description: 'Beam' }, drawingGroupLinks: [], _count: { attachments: 0 }, ...over,
  });

  it('shows when, by whom and how each released element was released; nothing is invented for the others', async () => {
    const releasedAt = new Date('2026-10-13T08:30:00Z');
    mockUserFindMany.mockResolvedValue([{ id: 'u9', displayName: 'Sara Technical' }]);
    mockPieceFindMany.mockResolvedValue([
      row('g', { drawingGroupLinks: [{ group: { id: 'g1', drawingNo: 'G', calculationRef: null, groupTitle: null, status: S.RELEASED_TO_PRODUCTION, releasedAt, releasedByUser: { displayName: 'Omar Manager' }, _count: { attachments: 1 } } }] }),
      row('i', { _count: { attachments: 1 }, releasedToProductionAt: releasedAt, releasedToProductionById: 'u9' }),
      row('r', { _count: { attachments: 1 } }),
      row('w', {}),
    ]);
    const { elements } = await service.coverage('k1', READER);
    const by = Object.fromEntries(elements.map((e) => [e.id, e]));
    expect(by['g']).toMatchObject({ releaseState: 'RELEASED', releasedVia: 'GROUP', releasedAt, releasedByName: 'Omar Manager' });
    expect(by['i']).toMatchObject({ releaseState: 'RELEASED', releasedVia: 'INDIVIDUAL', releasedAt, releasedByName: 'Sara Technical' });
    expect(by['r']).toMatchObject({ releaseState: 'READY', releasedVia: null, releasedAt: null, releasedByName: null });
    expect(by['w']).toMatchObject({ releaseState: 'WAITING', releasedVia: null, releasedAt: null, releasedByName: null });
    expect(mockUserFindMany).toHaveBeenCalledTimes(1);
  });
});

describe('TechnicalElementDrawingService.remove', () => {
  it('removes your own file (and the stored copy) while the element is not released; others need manage', async () => {
    mockAttFindFirst.mockResolvedValue({ id: 'a1', storagePath: 'boq-elements/p1/r.pdf', uploadedById: 'u1' });
    await service.remove('k1', 'p1', 'a1', WRITER);
    expect(mockAttDelete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(mockDeleteFile).toHaveBeenCalledWith('boq-elements/p1/r.pdf');
    mockAttFindFirst.mockResolvedValue({ id: 'a2', storagePath: 'x', uploadedById: 'someone-else' });
    await expect(service.remove('k1', 'p1', 'a2', WRITER)).rejects.toThrow(ForbiddenException);
    mockPieceFindFirst.mockResolvedValue(freePiece({ releasedToProductionAt: new Date() }));
    await expect(service.remove('k1', 'p1', 'a1', WRITER)).rejects.toThrow(ELEMENT_DRAWING_MESSAGES.released);
  });
});
