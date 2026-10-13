import { Injectable, ForbiddenException, NotFoundException, UnprocessableEntityException, BadRequestException, Logger } from '@nestjs/common';
import { ContractBoqAttachmentSource, ModuleIdentifier } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import type { AuthUser } from '../common/types/auth-user';
import { canDeleteOthersTechnicalFiles, hasTechnicalRead, hasTechnicalWrite } from './technical-permissions';
import {
  TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES,
  TechnicalAttachmentStorageService,
  TECHNICAL_FILE_BAD_TYPE_MESSAGE,
  resolveTechnicalAttachmentMimeType,
} from './technical-attachment-storage.service';

import { convertTiffToPng, isTiffAttachment, previewStoragePath } from './tiff-preview';

// ---------------------------------------------------------------------------
// FMP-BOQ-17 — optional reference drawings/files on a BOQ item. Reference only:
// nothing here creates pieces, confirms quantities or touches any Technical /
// Production status. Same file-type and size rules as every other Technical
// drawing upload (including TIF/TIFF), same permission pair, same department
// access check, same local-disk storage (under a "boq-items" sub-folder).
// ---------------------------------------------------------------------------

export const BOQ_ATTACHMENT_MESSAGES = {
  itemRequired: 'Please select the BOQ item this file belongs to.',
  itemNotFound: 'BOQ item not found for this contract.',
  noFile: 'Please choose a file to upload.',
  badType: TECHNICAL_FILE_BAD_TYPE_MESSAGE,
  tooLarge: `This file is too large. The limit is ${TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MB per file.`,
  notFound: 'File not found.',
  notOwner: 'You can only remove a file you added.',
  previewFailed: 'Preview could not be prepared. Please download the file.',
  previewNotNeeded: 'This file type does not need a converted preview.',
} as const;

const STORAGE_FOLDER_PREFIX = 'boq-items';

const ATTACHMENT_SELECT = {
  id: true,
  contractId: true,
  boqItemId: true,
  originalFileName: true,
  mimeType: true,
  fileSize: true,
  sourceType: true,
  notes: true,
  createdAt: true,
  uploadedByUserId: true,
  uploadedByUser: { select: { id: true, displayName: true } },
  boqItem: { select: { sortOrder: true, itemCode: true, description: true } },
} as const;

/** Client initial drawings come from Contract Management; anyone else (Technical) adds technical references. */
export function boqAttachmentSourceFor(permissions: string[]): ContractBoqAttachmentSource {
  return permissions.includes('contracts.update') || permissions.includes('contracts.manage')
    ? ContractBoqAttachmentSource.CLIENT_INITIAL_DRAWING
    : ContractBoqAttachmentSource.TECHNICAL_REFERENCE;
}

@Injectable()
export class TechnicalBoqAttachmentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly storage: TechnicalAttachmentStorageService,
  ) {}

  private readonly logger = new Logger(TechnicalBoqAttachmentService.name);
  /** One conversion per file at a time, so many people opening the same TIFF share one job. */
  private readonly previewJobs = new Map<string, Promise<void>>();

  private requireRead(actor: AuthUser): void {
    if (!hasTechnicalRead(actor.permissions)) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
  }

  private requireWrite(actor: AuthUser): void {
    if (!hasTechnicalWrite(actor.permissions)) {
      throw new ForbiddenException({
        code: 'CONTRACTS_PERMISSION_DENIED',
        message: 'Missing contracts.update or contracts.workflow_update',
      });
    }
  }

  private async assertContractAccess(contractId: string, actor: AuthUser): Promise<void> {
    const contract = await this.db.getClient().contract.findUnique({
      where: { id: contractId },
      select: { id: true, departmentId: true },
    });
    if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);
  }

  async list(contractId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.assertContractAccess(contractId, actor);
    return this.db.getClient().contractBoqItemAttachment.findMany({
      where: { contractId },
      orderBy: [{ boqItem: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
      select: { ...ATTACHMENT_SELECT },
    });
  }

  async upload(
    contractId: string,
    input: { boqItemId: string | undefined; notes: string | undefined },
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    actor: AuthUser,
  ) {
    this.requireWrite(actor);
    await this.assertContractAccess(contractId, actor);

    if (!input.boqItemId) {
      throw new UnprocessableEntityException({ code: 'BOQ_ATTACHMENT_ITEM_REQUIRED', message: BOQ_ATTACHMENT_MESSAGES.itemRequired });
    }
    const item = await this.db.getClient().contractBoqItem.findFirst({
      where: { id: input.boqItemId, contractId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException({ code: 'BOQ_ITEM_NOT_FOUND', message: BOQ_ATTACHMENT_MESSAGES.itemNotFound });

    if (!file) {
      throw new UnprocessableEntityException({ code: 'BOQ_ATTACHMENT_NO_FILE', message: BOQ_ATTACHMENT_MESSAGES.noFile });
    }
    const mimeType = resolveTechnicalAttachmentMimeType(file);
    if (mimeType === null) {
      throw new UnprocessableEntityException({ code: 'BOQ_ATTACHMENT_INVALID_TYPE', message: BOQ_ATTACHMENT_MESSAGES.badType });
    }
    if (file.size > TECHNICAL_DRAWING_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({ code: 'BOQ_ATTACHMENT_TOO_LARGE', message: BOQ_ATTACHMENT_MESSAGES.tooLarge });
    }

    const { fileName, storagePath } = await this.storage.save(`${STORAGE_FOLDER_PREFIX}/${item.id}`, file.buffer, file.originalname);
    try {
      return await this.db.getClient().contractBoqItemAttachment.create({
        data: {
          contractId,
          boqItemId: item.id,
          fileName,
          originalFileName: file.originalname.slice(0, 255),
          mimeType,
          fileSize: file.size,
          storagePath,
          sourceType: boqAttachmentSourceFor(actor.permissions),
          ...(input.notes ? { notes: input.notes } : {}),
          uploadedByUserId: actor.id,
        },
        select: { ...ATTACHMENT_SELECT },
      });
    } catch (err) {
      // No orphan file on disk if the record could not be saved.
      await this.storage.deleteFile(storagePath);
      throw err;
    }
  }

  async getForDownload(contractId: string, attachmentId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.assertContractAccess(contractId, actor);
    const attachment = await this.db.getClient().contractBoqItemAttachment.findFirst({
      where: { id: attachmentId, contractId },
      select: { storagePath: true, originalFileName: true, mimeType: true },
    });
    if (!attachment) throw new NotFoundException({ code: 'BOQ_ATTACHMENT_NOT_FOUND', message: BOQ_ATTACHMENT_MESSAGES.notFound });
    return attachment;
  }

  /**
   * FMP-TECH-20 — a browser-viewable PNG for a TIFF drawing. Same read permission and department
   * access as download. Made on the first request, stored next to the original, and reused after
   * that; the original file is never touched. Returns the storage key of the preview.
   */
  async getTiffPreview(contractId: string, attachmentId: string, actor: AuthUser): Promise<{ previewPath: string; originalFileName: string }> {
    const attachment = await this.getForDownload(contractId, attachmentId, actor);
    if (!isTiffAttachment(attachment)) {
      throw new BadRequestException({ code: 'BOQ_PREVIEW_NOT_NEEDED', message: BOQ_ATTACHMENT_MESSAGES.previewNotNeeded });
    }
    const previewPath = previewStoragePath(attachment.storagePath);
    if (!(await this.storage.exists(previewPath))) {
      let job = this.previewJobs.get(previewPath);
      if (!job) {
        job = this.buildPreview(attachment.storagePath, previewPath).finally(() => this.previewJobs.delete(previewPath));
        this.previewJobs.set(previewPath, job);
      }
      await job;
    }
    return { previewPath, originalFileName: attachment.originalFileName };
  }

  private async buildPreview(storagePath: string, previewPath: string): Promise<void> {
    try {
      const png = await convertTiffToPng(await this.storage.readBuffer(storagePath));
      await this.storage.writeDerived(previewPath, png);
    } catch (err) {
      this.logger.warn(`TIFF preview failed for ${storagePath}: ${err instanceof Error ? err.message : String(err)}`);
      throw new UnprocessableEntityException({ code: 'BOQ_PREVIEW_FAILED', message: BOQ_ATTACHMENT_MESSAGES.previewFailed });
    }
  }

  async remove(contractId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    this.requireWrite(actor);
    await this.assertContractAccess(contractId, actor);
    const client = this.db.getClient();
    const attachment = await client.contractBoqItemAttachment.findFirst({
      where: { id: attachmentId, contractId },
      select: { id: true, storagePath: true, uploadedByUserId: true },
    });
    if (!attachment) throw new NotFoundException({ code: 'BOQ_ATTACHMENT_NOT_FOUND', message: BOQ_ATTACHMENT_MESSAGES.notFound });
    if (attachment.uploadedByUserId !== actor.id && !canDeleteOthersTechnicalFiles(actor.permissions)) {
      throw new ForbiddenException({ code: 'BOQ_ATTACHMENT_NOT_OWNER', message: BOQ_ATTACHMENT_MESSAGES.notOwner });
    }
    await client.contractBoqItemAttachment.delete({ where: { id: attachment.id } });
    await this.storage.deleteFile(attachment.storagePath);
    await this.storage.deleteFile(previewStoragePath(attachment.storagePath));
  }
}
