import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContractBoqAttachmentSource as Source } from '@recafco/database';
import { TechnicalBoqAttachmentService, boqAttachmentSourceFor, BOQ_ATTACHMENT_MESSAGES } from './technical-boq-attachment.service';
import { TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES } from './technical-attachment-storage.service';
import type { TechnicalAttachmentStorageService } from './technical-attachment-storage.service';
import type { DatabaseService } from '../database/database.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';

const mockContractFindUnique = vi.fn();
const mockItemFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockDelete = vi.fn();
const mockPieceCreate = vi.fn(); // an attachment must never create pieces
const mockGroupWrite = vi.fn(); // ...or change a drawing group / confirmation

const client = {
  contract: { findUnique: mockContractFindUnique },
  contractBoqItem: { findFirst: mockItemFindFirst },
  contractBoqItemAttachment: { create: mockCreate, findMany: mockFindMany, findFirst: mockFindFirst, delete: mockDelete },
  contractBoqPiece: { create: mockPieceCreate, createMany: mockPieceCreate },
  contractBoqDrawingConfirmation: { create: mockGroupWrite, update: mockGroupWrite },
  technicalDrawingGroup: { create: mockGroupWrite, update: mockGroupWrite },
};
const db = { getClient: () => client } as unknown as DatabaseService;
const assertCanAccessDepartment = vi.fn().mockResolvedValue(undefined);
const deptAccess = { assertCanAccessDepartment } as unknown as DepartmentAccessService;
const mockSave = vi.fn();
const mockDeleteFile = vi.fn();
const storage = { save: mockSave, deleteFile: mockDeleteFile, createReadStream: vi.fn() } as unknown as TechnicalAttachmentStorageService;

const actor = (permissions: string[], id = 'u1'): AuthUser => ({ id, displayName: 'User', permissions }) as unknown as AuthUser;
const CONTRACT_MANAGER = actor(['contracts.read', 'contracts.update']);
const TECHNICAL_USER = actor(['technical.read', 'technical.update']);
const READ_ONLY = actor(['technical.read']);

const file = (over: Partial<{ originalname: string; mimetype: string; size: number }> = {}) => ({
  buffer: Buffer.from('x'),
  originalname: 'GA-01.pdf',
  mimetype: 'application/pdf',
  size: 1000,
  ...over,
});
const input = { boqItemId: 'item-1', notes: undefined };

let service: TechnicalBoqAttachmentService;
beforeEach(() => {
  vi.clearAllMocks();
  mockContractFindUnique.mockResolvedValue({ id: 'k1', departmentId: 'd1' });
  mockItemFindFirst.mockResolvedValue({ id: 'item-1' });
  mockSave.mockResolvedValue({ fileName: 'random.pdf', storagePath: 'boq-items/item-1/random.pdf' });
  mockCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ id: 'a1', ...args.data }));
  service = new TechnicalBoqAttachmentService(db, deptAccess, storage);
});

describe('source type', () => {
  it('contract updaters add client drawings; technical-only users add technical references', () => {
    expect(boqAttachmentSourceFor(['contracts.update'])).toBe(Source.CLIENT_INITIAL_DRAWING);
    expect(boqAttachmentSourceFor(['contracts.manage'])).toBe(Source.CLIENT_INITIAL_DRAWING);
    expect(boqAttachmentSourceFor(['technical.update'])).toBe(Source.TECHNICAL_REFERENCE);
  });
});

describe('upload', () => {
  it('saves a PDF for a BOQ item of this contract, under a per-item folder', async () => {
    await service.upload('k1', input, file(), CONTRACT_MANAGER);
    expect(mockItemFindFirst).toHaveBeenCalledWith({ where: { id: 'item-1', contractId: 'k1' }, select: { id: true } });
    expect(mockSave).toHaveBeenCalledWith('boq-items/item-1', expect.any(Buffer), 'GA-01.pdf');
    expect(mockCreate.mock.calls[0]![0].data).toMatchObject({
      contractId: 'k1',
      boqItemId: 'item-1',
      mimeType: 'application/pdf',
      sourceType: Source.CLIENT_INITIAL_DRAWING,
      uploadedByUserId: 'u1',
    });
  });

  it('lets Technical add a reference file and tags it as such', async () => {
    await service.upload('k1', { boqItemId: 'item-1', notes: 'rev B' }, file(), TECHNICAL_USER);
    expect(mockCreate.mock.calls[0]![0].data).toMatchObject({ sourceType: Source.TECHNICAL_REFERENCE, notes: 'rev B' });
  });

  it('keeps TIF/TIFF support (normalised to image/tiff even with an empty browser MIME type)', async () => {
    await service.upload('k1', input, file({ originalname: 'scan.TIF', mimetype: '' }), CONTRACT_MANAGER);
    expect(mockCreate.mock.calls[0]![0].data.mimeType).toBe('image/tiff');
  });

  it('accepts DWG and DXF', async () => {
    await service.upload('k1', input, file({ originalname: 'a.dwg', mimetype: 'application/acad' }), CONTRACT_MANAGER);
    await service.upload('k1', input, file({ originalname: 'a.dxf', mimetype: 'application/dxf' }), CONTRACT_MANAGER);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('rejects a disallowed type with a plain message and stores nothing', async () => {
    await expect(
      service.upload('k1', input, file({ originalname: 'run.exe', mimetype: 'application/x-msdownload' }), CONTRACT_MANAGER),
    ).rejects.toMatchObject({ response: { message: BOQ_ATTACHMENT_MESSAGES.badType } });
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a file over the size limit', async () => {
    await expect(
      service.upload('k1', input, file({ size: TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES + 1 }), CONTRACT_MANAGER),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('needs a BOQ item and a file', async () => {
    await expect(service.upload('k1', { boqItemId: undefined, notes: undefined }, file(), CONTRACT_MANAGER)).rejects.toMatchObject({
      response: { code: 'BOQ_ATTACHMENT_ITEM_REQUIRED' },
    });
    await expect(service.upload('k1', input, undefined, CONTRACT_MANAGER)).rejects.toMatchObject({
      response: { code: 'BOQ_ATTACHMENT_NO_FILE' },
    });
  });

  it('refuses a BOQ item that belongs to another contract', async () => {
    mockItemFindFirst.mockResolvedValue(null);
    await expect(service.upload('k1', { boqItemId: 'other', notes: undefined }, file(), CONTRACT_MANAGER)).rejects.toBeInstanceOf(NotFoundException);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('is a write: a read-only user is refused', async () => {
    await expect(service.upload('k1', input, file(), READ_ONLY)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('checks department access and removes the stored file if the record cannot be saved', async () => {
    mockCreate.mockRejectedValueOnce(new Error('db down'));
    await expect(service.upload('k1', input, file(), CONTRACT_MANAGER)).rejects.toThrow('db down');
    expect(assertCanAccessDepartment).toHaveBeenCalled();
    expect(mockDeleteFile).toHaveBeenCalledWith('boq-items/item-1/random.pdf');
  });

  it('never creates pieces, drawing groups or confirmations', async () => {
    await service.upload('k1', input, file(), CONTRACT_MANAGER);
    expect(mockPieceCreate).not.toHaveBeenCalled();
    expect(mockGroupWrite).not.toHaveBeenCalled();
  });
});

describe('list / download', () => {
  it('Technical (read-only) can list and get a file to download', async () => {
    mockFindMany.mockResolvedValue([{ id: 'a1' }]);
    mockFindFirst.mockResolvedValue({ storagePath: 'p', originalFileName: 'GA-01.pdf', mimeType: 'application/pdf' });
    expect(await service.list('k1', READ_ONLY)).toEqual([{ id: 'a1' }]);
    expect(await service.getForDownload('k1', 'a1', READ_ONLY)).toMatchObject({ originalFileName: 'GA-01.pdf' });
    expect(mockFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1', contractId: 'k1' } }));
  });

  it('a user with no read permission is refused', async () => {
    await expect(service.list('k1', actor(['incidents.read']))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a file from another contract is not found', async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(service.getForDownload('k1', 'a1', READ_ONLY)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('remove', () => {
  it('lets the uploader remove their own file and deletes it from disk', async () => {
    mockFindFirst.mockResolvedValue({ id: 'a1', storagePath: 'boq-items/item-1/random.pdf', uploadedByUserId: 'u1' });
    await service.remove('k1', 'a1', CONTRACT_MANAGER);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(mockDeleteFile).toHaveBeenCalledWith('boq-items/item-1/random.pdf');
  });

  it("refuses removing someone else's file without manage rights", async () => {
    mockFindFirst.mockResolvedValue({ id: 'a1', storagePath: 'p', uploadedByUserId: 'someone-else' });
    await expect(service.remove('k1', 'a1', CONTRACT_MANAGER)).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("lets a manager remove someone else's file", async () => {
    mockFindFirst.mockResolvedValue({ id: 'a1', storagePath: 'p', uploadedByUserId: 'someone-else' });
    await service.remove('k1', 'a1', actor(['contracts.update', 'contracts.manage']));
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe('TIFF preview (FMP-TECH-20)', () => {
  const files = new Map<string, Buffer>();
  const previewStorage = {
    save: mockSave,
    deleteFile: mockDeleteFile,
    createReadStream: vi.fn(),
    exists: async (p: string) => files.has(p),
    readBuffer: async (p: string) => {
      const b = files.get(p);
      if (!b) throw new Error('missing');
      return b;
    },
    writeDerived: async (p: string, b: Buffer) => {
      files.set(p, b);
    },
  } as unknown as TechnicalAttachmentStorageService;

  async function makeTiff(): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    return sharp({ create: { width: 40, height: 20, channels: 3, background: '#336699' } }).tiff().toBuffer();
  }

  beforeEach(() => {
    files.clear();
    service = new TechnicalBoqAttachmentService(db, deptAccess, previewStorage);
  });

  it('makes a PNG once, keeps the original, and reuses the stored preview', async () => {
    const tiff = await makeTiff();
    files.set('boq-items/item-1/a.tif', tiff);
    mockFindFirst.mockResolvedValue({ storagePath: 'boq-items/item-1/a.tif', originalFileName: 'GA-01.tif', mimeType: 'image/tiff' });

    const first = await service.getTiffPreview('k1', 'a1', TECHNICAL_USER);
    expect(first.previewPath).toBe('boq-items/item-1/a.tif.preview.png');
    const png = files.get(first.previewPath)!;
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(files.get('boq-items/item-1/a.tif')).toBe(tiff); // original untouched

    files.set(first.previewPath, Buffer.from('cached'));
    await service.getTiffPreview('k1', 'a1', TECHNICAL_USER);
    expect(files.get(first.previewPath)!.toString()).toBe('cached'); // not converted again
  });

  it('shares one conversion between simultaneous requests', async () => {
    files.set('boq-items/item-1/a.tif', await makeTiff());
    mockFindFirst.mockResolvedValue({ storagePath: 'boq-items/item-1/a.tif', originalFileName: 'GA-01.tif', mimeType: 'image/tiff' });
    const results = await Promise.all([service.getTiffPreview('k1', 'a1', TECHNICAL_USER), service.getTiffPreview('k1', 'a1', TECHNICAL_USER)]);
    expect(results[0]!.previewPath).toBe(results[1]!.previewPath);
  });

  it('gives a plain message when the file is not a readable TIFF', async () => {
    files.set('boq-items/item-1/bad.tif', Buffer.from('not a tiff'));
    mockFindFirst.mockResolvedValue({ storagePath: 'boq-items/item-1/bad.tif', originalFileName: 'bad.tif', mimeType: 'image/tiff' });
    await expect(service.getTiffPreview('k1', 'a1', TECHNICAL_USER)).rejects.toThrow(BOQ_ATTACHMENT_MESSAGES.previewFailed);
    expect(files.has('boq-items/item-1/bad.tif.preview.png')).toBe(false);
  });

  it('only converts TIFF files and keeps the read permission check', async () => {
    mockFindFirst.mockResolvedValue({ storagePath: 'boq-items/item-1/a.pdf', originalFileName: 'a.pdf', mimeType: 'application/pdf' });
    await expect(service.getTiffPreview('k1', 'a1', TECHNICAL_USER)).rejects.toThrow(BOQ_ATTACHMENT_MESSAGES.previewNotNeeded);
    await expect(service.getTiffPreview('k1', 'a1', actor([]))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
