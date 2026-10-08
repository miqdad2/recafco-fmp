import { describe, it, expect, vi } from 'vitest';
import 'reflect-metadata';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { StreamableFile } from '@nestjs/common';
import { Readable } from 'node:stream';
import { TechnicalController } from './technical.controller';

const ACTOR = { id: 'u1' } as never;

function build(att: { originalFileName: string; mimeType: string }) {
  const getAttachmentForDownload = vi.fn().mockResolvedValue({ storagePath: 'd/x', ...att });
  const createReadStream = vi.fn().mockReturnValue(Readable.from(['x']));
  const controller = new TechnicalController({ getAttachmentForDownload } as never, { createReadStream } as never);
  const res = { set: vi.fn() };
  return { controller, res, getAttachmentForDownload };
}

describe('TechnicalController — attachment view/download (FMP-TECH-06)', () => {
  it('view streams inline with the stored content type', async () => {
    const { controller, res, getAttachmentForDownload } = build({ originalFileName: 'a.pdf', mimeType: 'application/pdf' });
    const out = await controller.viewAttachment('c', 'a', ACTOR, res as never);
    expect(out).toBeInstanceOf(StreamableFile);
    expect(getAttachmentForDownload).toHaveBeenCalledWith('c', 'a', ACTOR);
    expect(res.set).toHaveBeenCalledWith({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="a.pdf"' });
  });

  it('view serves TIFF as image/tiff inline', async () => {
    const { controller, res } = build({ originalFileName: 'scan.TIF', mimeType: 'application/octet-stream' });
    await controller.viewAttachment('c', 'a', ACTOR, res as never);
    expect(res.set).toHaveBeenCalledWith({ 'Content-Type': 'image/tiff', 'Content-Disposition': 'inline; filename="scan.TIF"' });
  });

  it('download still uses attachment disposition', async () => {
    const { controller, res } = build({ originalFileName: 'a.pdf', mimeType: 'application/pdf' });
    await controller.downloadAttachment('c', 'a', ACTOR, res as never);
    expect(res.set).toHaveBeenCalledWith({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="a.pdf"' });
  });

  it('view uses the same permission as download', () => {
    const view = Reflect.getMetadata(PERMISSIONS_KEY, TechnicalController.prototype.viewAttachment);
    const dl = Reflect.getMetadata(PERMISSIONS_KEY, TechnicalController.prototype.downloadAttachment);
    expect(view).toEqual(dl);
  });
});
