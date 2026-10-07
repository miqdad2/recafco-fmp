import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { FactoryTaskAttachmentsService } from './factory-task-attachments.service';
import type { AuthUser } from '../common/types/auth-user';

const findOne = vi.fn();
const attFindMany = vi.fn();
const attFindFirst = vi.fn();
const attCreate = vi.fn();
const attDelete = vi.fn();
const activityCreate = vi.fn();
const save = vi.fn();
const deleteFile = vi.fn();

const db = {
  getClient: () => ({
    factoryTaskAttachment: { findMany: attFindMany, findFirst: attFindFirst, create: attCreate, delete: attDelete },
    factoryTaskActivity: { create: activityCreate },
  }),
};

const service = new FactoryTaskAttachmentsService(
  db as never,
  { findOne } as never,
  { save, deleteFile } as never,
);

const actor = (permissions: string[], id = 'u1'): AuthUser => ({ id, displayName: 'U', permissions } as unknown as AuthUser);
const pdf = { buffer: Buffer.from('x'), originalname: 'a.pdf', mimetype: 'application/pdf', size: 10 };

beforeEach(() => {
  vi.clearAllMocks();
  findOne.mockResolvedValue({ id: 't1', createdByUserId: 'u1' });
  save.mockResolvedValue({ fileName: 'f.pdf', storagePath: 't1/f.pdf' });
  attCreate.mockResolvedValue({ id: 'a1' });
});

describe('FactoryTaskAttachmentsService.create', () => {
  it('stores the file and logs activity for the task creator', async () => {
    const result = await service.create('t1', pdf, actor(['tasks.create']));
    expect(result).toEqual({ id: 'a1' });
    expect(save).toHaveBeenCalledWith('t1', pdf.buffer, 'a.pdf');
    expect(activityCreate).toHaveBeenCalled();
  });

  it('rejects without tasks.create', async () => {
    await expect(service.create('t1', pdf, actor(['tasks.read']))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a non-creator without tasks.manage, allows tasks.manage', async () => {
    findOne.mockResolvedValue({ id: 't1', createdByUserId: 'someone-else' });
    await expect(service.create('t1', pdf, actor(['tasks.create']))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create('t1', pdf, actor(['tasks.create', 'tasks.manage']))).resolves.toBeDefined();
  });

  it('rejects executable / unlisted types and oversize files', async () => {
    await expect(
      service.create('t1', { ...pdf, originalname: 'x.exe', mimetype: 'application/x-msdownload' }, actor(['tasks.create'])),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      service.create('t1', { ...pdf, size: 26 * 1024 * 1024 }, actor(['tasks.create'])),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('FactoryTaskAttachmentsService.remove / download', () => {
  it('only the uploader or tasks.manage can delete', async () => {
    attFindFirst.mockResolvedValue({ id: 'a1', storagePath: 't1/f.pdf', originalFileName: 'a.pdf', uploadedByUserId: 'other' });
    await expect(service.remove('t1', 'a1', actor(['tasks.create']))).rejects.toBeInstanceOf(ForbiddenException);
    await service.remove('t1', 'a1', actor(['tasks.create', 'tasks.manage']));
    expect(attDelete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(deleteFile).toHaveBeenCalledWith('t1/f.pdf');
  });

  it('download of a missing attachment is a 404', async () => {
    attFindFirst.mockResolvedValue(null);
    await expect(service.getForDownload('t1', 'a1', actor(['tasks.read']))).rejects.toBeInstanceOf(NotFoundException);
  });
});
