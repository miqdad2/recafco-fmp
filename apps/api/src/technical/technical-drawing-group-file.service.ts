import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ModuleIdentifier, TechnicalDrawingGroupFileCategory } from '@recafco/database';
import { DatabaseService } from '../database/database.service';
import { DepartmentAccessService } from '../department-access/department-access.service';
import { TechnicalDrawingGroupFileStorageService } from './technical-drawing-group-file-storage.service';
import type { AuthUser } from '../common/types/auth-user';
import {
  GROUP_FILE_MESSAGES,
  groupFileChangeBlockedMessage,
  validateGroupFile,
  GROUP_FILE_CATEGORIES,
} from './drawing-group-files';
import type { GroupFileCategory } from './drawing-group-files';
import { UnprocessableEntityException } from '@nestjs/common';

const ATTACHMENT_SELECT = {
  id: true,
  originalName: true,
  mimeType: true,
  fileSize: true,
  category: true,
  remarks: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, displayName: true } },
} as const;

/**
 * FMP-BOQ-12 — files on a Drawing / Calculation Group (drawing PDF, calculation,
 * approval document, other). Upload and remove are Technical writes and are only
 * possible until the group is released to Production; listing and downloading
 * need contracts.read. Uploading a file never changes the group's status.
 */
@Injectable()
export class TechnicalDrawingGroupFileService {
  constructor(
    private readonly db: DatabaseService,
    private readonly deptAccess: DepartmentAccessService,
    private readonly storage: TechnicalDrawingGroupFileStorageService,
  ) {}

  private requireRead(actor: AuthUser): void {
    if (!actor.permissions.includes('contracts.read')) {
      throw new ForbiddenException({ code: 'CONTRACTS_PERMISSION_DENIED', message: 'Missing contracts.read' });
    }
  }

  // Same write rule as every other Technical write.
  private requireWrite(actor: AuthUser): void {
    if (!actor.permissions.includes('contracts.update') && !actor.permissions.includes('contracts.workflow_update')) {
      throw new ForbiddenException({
        code: 'CONTRACTS_PERMISSION_DENIED',
        message: 'Missing contracts.update or contracts.workflow_update',
      });
    }
  }

  /** The contract must exist and be accessible; the group must belong to it. */
  private async loadGroup(contractId: string, groupId: string, actor: AuthUser) {
    const client = this.db.getClient();
    const contract = await client.contract.findUnique({ where: { id: contractId }, select: { id: true, departmentId: true } });
    if (!contract) throw new NotFoundException({ code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' });
    await this.deptAccess.assertCanAccessDepartment(actor, ModuleIdentifier.CONTRACTS_MANAGEMENT, contract.departmentId);

    const group = await client.technicalDrawingGroup.findFirst({
      where: { id: groupId, contractId },
      select: { id: true, contractId: true, boqItemId: true, status: true },
    });
    if (!group) throw new NotFoundException({ code: 'DRAWING_GROUP_NOT_FOUND', message: GROUP_FILE_MESSAGES.groupNotFound });
    return group;
  }

  async list(contractId: string, groupId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.loadGroup(contractId, groupId, actor);
    return this.db.getClient().technicalDrawingGroupAttachment.findMany({
      where: { groupId, contractId },
      orderBy: { createdAt: 'desc' },
      select: { ...ATTACHMENT_SELECT },
    });
  }

  async upload(
    contractId: string,
    groupId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    input: { category: string | undefined; remarks: string | undefined },
    actor: AuthUser,
  ) {
    this.requireWrite(actor);
    const group = await this.loadGroup(contractId, groupId, actor);

    const blocked = groupFileChangeBlockedMessage(group.status, 'upload');
    if (blocked) throw new ConflictException({ code: 'DRAWING_GROUP_FILES_LOCKED', message: blocked });

    validateGroupFile(file);
    if (!input.category || !(GROUP_FILE_CATEGORIES as readonly string[]).includes(input.category)) {
      throw new UnprocessableEntityException({ code: 'GROUP_FILE_CATEGORY_REQUIRED', message: GROUP_FILE_MESSAGES.noCategory });
    }
    const upload = file!;

    const { fileName, storagePath } = await this.storage.save(groupId, upload.buffer, upload.originalname);
    try {
      return await this.db.getClient().technicalDrawingGroupAttachment.create({
        data: {
          groupId,
          contractId,
          boqItemId: group.boqItemId,
          fileName,
          originalName: upload.originalname,
          mimeType: upload.mimetype,
          fileSize: upload.size,
          storagePath,
          category: input.category as GroupFileCategory as TechnicalDrawingGroupFileCategory,
          uploadedById: actor.id,
          ...(input.remarks ? { remarks: input.remarks } : {}),
        },
        select: { ...ATTACHMENT_SELECT },
      });
    } catch (err) {
      // No orphan file on disk if the record could not be saved.
      await this.storage.deleteFile(storagePath);
      throw err;
    }
  }

  async getForDownload(contractId: string, groupId: string, attachmentId: string, actor: AuthUser) {
    this.requireRead(actor);
    await this.loadGroup(contractId, groupId, actor);
    const attachment = await this.db.getClient().technicalDrawingGroupAttachment.findFirst({
      where: { id: attachmentId, groupId, contractId },
      select: { storagePath: true, originalName: true, mimeType: true },
    });
    if (!attachment) throw new NotFoundException({ code: 'GROUP_FILE_NOT_FOUND', message: GROUP_FILE_MESSAGES.notFound });
    return attachment;
  }

  async remove(contractId: string, groupId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    this.requireWrite(actor);
    const group = await this.loadGroup(contractId, groupId, actor);

    const blocked = groupFileChangeBlockedMessage(group.status, 'remove');
    if (blocked) throw new ConflictException({ code: 'DRAWING_GROUP_FILES_LOCKED', message: blocked });

    const client = this.db.getClient();
    const attachment = await client.technicalDrawingGroupAttachment.findFirst({
      where: { id: attachmentId, groupId, contractId },
      select: { id: true, storagePath: true },
    });
    if (!attachment) throw new NotFoundException({ code: 'GROUP_FILE_NOT_FOUND', message: GROUP_FILE_MESSAGES.notFound });

    // Same safe pattern as every other attachment in the app: remove the record, then the file (best effort).
    await client.technicalDrawingGroupAttachment.delete({ where: { id: attachmentId } });
    await this.storage.deleteFile(attachment.storagePath);
  }
}
