import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { TechnicalDrawingGroupStatus as S } from '@recafco/database';
import { TechnicalDrawingGroupFileService } from './technical-drawing-group-file.service';
import type { TechnicalDrawingGroupFileStorageService } from './technical-drawing-group-file-storage.service';
import {
  validateGroupFile,
  groupAcceptsFileChanges,
  groupFileChangeBlockedMessage,
  GROUP_FILE_MAX_BYTES,
  GROUP_FILE_TYPES,
} from './drawing-group-files';
import type { DatabaseService } from '../database/database.service';
import type { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';

const mockContractFindUnique = vi.fn();
const mockGroupFindFirst = vi.fn();
const mockAttCreate = vi.fn();
const mockAttFindMany = vi.fn();
const mockAttFindFirst = vi.fn();
const mockAttDelete = vi.fn();
const mockGroupUpdate = vi.fn(); // a file must never change the group's status

const client = {
  contract: { findUnique: mockContractFindUnique },
  technicalDrawingGroup: { findFirst: mockGroupFindFirst, update: mockGroupUpdate, updateMany: mockGroupUpdate },
  technicalDrawingGroupAttachment: { create: mockAttCreate, findMany: mockAttFindMany, findFirst: mockAttFindFirst, delete: mockAttDelete },
};
const db = { getClient: () => client } as unknown as DatabaseService;
const deptAccess = { assertCanAccessDepartment: vi.fn().mockResolvedValue(undefined) } as unknown as DepartmentAccessService;
const mockSave = vi.fn();
const mockDeleteFile = vi.fn();
const storage = { save: mockSave, deleteFile: mockDeleteFile, createReadStream: vi.fn() } as unknown as TechnicalDrawingGroupFileStorageService;

const actor = (permissions: string[]): AuthUser => ({ id: 'u1', displayName: 'Tech', permissions }) as unknown as AuthUser;
const WRITER = actor(['contracts.read', 'contracts.workflow_update']);
const READER = actor(['contracts.read']);

const pdf = (over: Partial<{ originalname: string; mimetype: string; size: number }> = {}) => ({
  buffer: Buffer.from('x'),
  originalname: 'HC-001 drawing.pdf',
  mimetype: 'application/pdf',
  size: 1000,
  ...over,
});

let service: TechnicalDrawingGroupFileService;
beforeEach(() => {
  vi.clearAllMocks();
  mockContractFindUnique.mockResolvedValue({ id: 'k1', departmentId: null });
  mockGroupFindFirst.mockResolvedValue({ id: 'g1', contractId: 'k1', boqItemId: 'item-1', status: S.DRAFT });
  mockSave.mockResolvedValue({ fileName: 'random.pdf', storagePath: 'g1/random.pdf' });
  mockAttCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ id: 'a1', ...args.data }));
  service = new TechnicalDrawingGroupFileService(db, deptAccess, storage);
});

describe('file rules', () => {
  it('allows pdf, doc, docx, xls, xlsx, png, jpg, jpeg up to 25 MB', () => {
    expect(Object.keys(GROUP_FILE_TYPES).sort()).toEqual(['.doc', '.docx', '.jpeg', '.jpg', '.pdf', '.png', '.xls', '.xlsx']);
    expect(GROUP_FILE_MAX_BYTES).toBe(25 * 1024 * 1024);
    expect(() => validateGroupFile({ originalname: 'a.PDF', mimetype: 'application/pdf', size: 1 })).not.toThrow();
    expect(() => validateGroupFile({ originalname: 'a.jpeg', mimetype: 'image/jpeg', size: GROUP_FILE_MAX_BYTES })).not.toThrow();
  });
  it('rejects an unsupported type with the plain message (wrong extension, wrong MIME, no extension)', () => {
    for (const f of [
      { originalname: 'a.exe', mimetype: 'application/octet-stream', size: 1 },
      { originalname: 'a.dwg', mimetype: 'application/acad', size: 1 },
      { originalname: 'a.pdf', mimetype: 'image/png', size: 1 },
      { originalname: 'noext', mimetype: 'application/pdf', size: 1 },
    ]) {
      expect(() => validateGroupFile(f)).toThrow('This file type is not allowed.');
    }
  });
  it('rejects an oversized file', () => {
    expect(() => validateGroupFile({ originalname: 'a.pdf', mimetype: 'application/pdf', size: GROUP_FILE_MAX_BYTES + 1 })).toThrow('File is too large.');
  });
  it('asks for a file', () => {
    expect(() => validateGroupFile(undefined)).toThrow('Please select a file.');
  });
  it('files can be changed in Draft, Submitted and Approved only', () => {
    expect(groupAcceptsFileChanges(S.DRAFT)).toBe(true);
    expect(groupAcceptsFileChanges(S.SUBMITTED)).toBe(true);
    expect(groupAcceptsFileChanges(S.APPROVED)).toBe(true);
    expect(groupAcceptsFileChanges(S.RELEASED_TO_PRODUCTION)).toBe(false);
    expect(groupFileChangeBlockedMessage(S.RELEASED_TO_PRODUCTION, 'upload')).toBe('Released groups cannot be changed.');
    expect(groupFileChangeBlockedMessage(S.RELEASED_TO_PRODUCTION, 'remove')).toBe('Released groups cannot have files removed.');
    expect(groupFileChangeBlockedMessage(S.CANCELLED, 'upload')).toBe('This group cannot be changed.');
    expect(groupFileChangeBlockedMessage(S.DRAFT, 'upload')).toBeNull();
  });
});

describe('upload', () => {
  it('uploads a drawing file to the group and records who and what', async () => {
    const result = (await service.upload('k1', 'g1', pdf(), { category: 'DRAWING', remarks: 'Rev A' }, WRITER)) as Record<string, unknown>;
    expect(mockSave).toHaveBeenCalledWith('g1', expect.any(Buffer), 'HC-001 drawing.pdf');
    expect(mockAttCreate.mock.calls[0]?.[0].data).toMatchObject({
      groupId: 'g1',
      contractId: 'k1',
      boqItemId: 'item-1',
      originalName: 'HC-001 drawing.pdf',
      fileName: 'random.pdf',
      storagePath: 'g1/random.pdf',
      category: 'DRAWING',
      remarks: 'Rev A',
      uploadedById: 'u1',
      fileSize: 1000,
    });
    expect(result['id']).toBe('a1');
  });

  it('uploads a calculation file (Excel)', async () => {
    await service.upload(
      'k1',
      'g1',
      pdf({ originalname: 'CALC-001.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      { category: 'CALCULATION', remarks: undefined },
      WRITER,
    );
    expect(mockAttCreate.mock.calls[0]?.[0].data.category).toBe('CALCULATION');
  });

  it.each(['DRAFT', 'SUBMITTED', 'APPROVED'] as const)('works while the group is %s', async (status) => {
    mockGroupFindFirst.mockResolvedValue({ id: 'g1', contractId: 'k1', boqItemId: 'item-1', status: S[status] });
    await expect(service.upload('k1', 'g1', pdf(), { category: 'OTHER', remarks: undefined }, WRITER)).resolves.toBeDefined();
  });

  it('never changes the group status', async () => {
    await service.upload('k1', 'g1', pdf(), { category: 'DRAWING', remarks: undefined }, WRITER);
    expect(mockGroupUpdate).not.toHaveBeenCalled();
  });

  it('rejects an unsupported or oversized file before anything is stored', async () => {
    await expect(service.upload('k1', 'g1', pdf({ originalname: 'a.exe', mimetype: 'application/x-msdownload' }), { category: 'DRAWING', remarks: undefined }, WRITER)).rejects.toThrow('This file type is not allowed.');
    await expect(service.upload('k1', 'g1', pdf({ size: GROUP_FILE_MAX_BYTES + 1 }), { category: 'DRAWING', remarks: undefined }, WRITER)).rejects.toThrow('File is too large.');
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockAttCreate).not.toHaveBeenCalled();
  });

  it('asks for a file and a category', async () => {
    await expect(service.upload('k1', 'g1', undefined, { category: 'DRAWING', remarks: undefined }, WRITER)).rejects.toThrow('Please select a file.');
    await expect(service.upload('k1', 'g1', pdf(), { category: undefined, remarks: undefined }, WRITER)).rejects.toThrow('Please select file category.');
    await expect(service.upload('k1', 'g1', pdf(), { category: 'PHOTO', remarks: undefined }, WRITER)).rejects.toThrow(UnprocessableEntityException);
  });

  it('is blocked once the group is released to Production', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: 'g1', contractId: 'k1', boqItemId: 'item-1', status: S.RELEASED_TO_PRODUCTION });
    await expect(service.upload('k1', 'g1', pdf(), { category: 'DRAWING', remarks: undefined }, WRITER)).rejects.toThrow('Released groups cannot be changed.');
    await expect(service.upload('k1', 'g1', pdf(), { category: 'DRAWING', remarks: undefined }, WRITER)).rejects.toThrow(ConflictException);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('read-only users cannot upload', async () => {
    await expect(service.upload('k1', 'g1', pdf(), { category: 'DRAWING', remarks: undefined }, READER)).rejects.toThrow(ForbiddenException);
  });

  it('removes the stored file if the record cannot be saved (no orphan files)', async () => {
    mockAttCreate.mockRejectedValue(new Error('db down'));
    await expect(service.upload('k1', 'g1', pdf(), { category: 'DRAWING', remarks: undefined }, WRITER)).rejects.toThrow('db down');
    expect(mockDeleteFile).toHaveBeenCalledWith('g1/random.pdf');
  });

  it('a group of another contract is not found (cannot upload across contracts)', async () => {
    mockGroupFindFirst.mockResolvedValue(null);
    await expect(service.upload('k1', 'other-group', pdf(), { category: 'DRAWING', remarks: undefined }, WRITER)).rejects.toThrow(NotFoundException);
    expect(mockGroupFindFirst.mock.calls[0]?.[0].where).toEqual({ id: 'other-group', contractId: 'k1' });
  });
});

describe('list and download', () => {
  it('lists the group files for anyone with read access', async () => {
    mockAttFindMany.mockResolvedValue([{ id: 'a1', originalName: 'x.pdf' }]);
    expect(await service.list('k1', 'g1', READER)).toHaveLength(1);
    expect(mockAttFindMany.mock.calls[0]?.[0].where).toEqual({ groupId: 'g1', contractId: 'k1' });
    // the browser never gets the server path
    expect(mockAttFindMany.mock.calls[0]?.[0].select.storagePath).toBeUndefined();
  });

  it('download needs read access and returns the file only for this contract and group', async () => {
    mockAttFindFirst.mockResolvedValue({ storagePath: 'g1/random.pdf', originalName: 'x.pdf', mimeType: 'application/pdf' });
    expect(await service.getForDownload('k1', 'g1', 'a1', READER)).toMatchObject({ originalName: 'x.pdf' });
    expect(mockAttFindFirst.mock.calls[0]?.[0].where).toEqual({ id: 'a1', groupId: 'g1', contractId: 'k1' });
    await expect(service.getForDownload('k1', 'g1', 'a1', actor([]))).rejects.toThrow(ForbiddenException);
  });

  it('an attachment from another contract or group is not found', async () => {
    mockAttFindFirst.mockResolvedValue(null);
    await expect(service.getForDownload('k1', 'g1', 'foreign', READER)).rejects.toThrow('File not found.');
  });
});

describe('remove', () => {
  it('removes the file record and the file while the group is not released', async () => {
    mockAttFindFirst.mockResolvedValue({ id: 'a1', storagePath: 'g1/random.pdf' });
    await service.remove('k1', 'g1', 'a1', WRITER);
    expect(mockAttDelete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(mockDeleteFile).toHaveBeenCalledWith('g1/random.pdf');
    expect(mockGroupUpdate).not.toHaveBeenCalled();
  });

  it('is blocked after release', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: 'g1', contractId: 'k1', boqItemId: 'item-1', status: S.RELEASED_TO_PRODUCTION });
    await expect(service.remove('k1', 'g1', 'a1', WRITER)).rejects.toThrow('Released groups cannot have files removed.');
    expect(mockAttDelete).not.toHaveBeenCalled();
  });

  it('read-only users cannot remove', async () => {
    await expect(service.remove('k1', 'g1', 'a1', READER)).rejects.toThrow(ForbiddenException);
  });

  it('a file from another group is not found', async () => {
    mockAttFindFirst.mockResolvedValue(null);
    await expect(service.remove('k1', 'g1', 'foreign', WRITER)).rejects.toThrow(NotFoundException);
    expect(mockAttDelete).not.toHaveBeenCalled();
  });
});
