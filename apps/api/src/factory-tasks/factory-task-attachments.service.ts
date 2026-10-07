import { Injectable, NotFoundException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FactoryTasksService } from './factory-tasks.service';
import {
  TaskAttachmentStorageService,
  TASK_ATTACHMENT_ALLOWED_MIME_TYPES,
  TASK_ATTACHMENT_MAX_BYTES,
} from './task-attachment-storage.service';
import type { AuthUser } from '../common/types/auth-user';

const ATTACHMENT_SELECT = {
  id: true,
  taskId: true,
  originalFileName: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  uploadedByUserId: true,
  createdAt: true,
  uploadedByUser: { select: { id: true, displayName: true, username: true } },
} as const;

/**
 * FMP-TASK-05 - task attachments. Access to the parent task (including the
 * department-scope check) always goes through FactoryTasksService.findOne(),
 * so an attachment is never reachable by someone who cannot see its task.
 *
 * Permissions: list/download = tasks.read; upload = tasks.create AND (the
 * task's creator OR tasks.manage); delete = tasks.create AND (the uploader
 * OR tasks.manage).
 */
@Injectable()
export class FactoryTaskAttachmentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tasks: FactoryTasksService,
    private readonly storage: TaskAttachmentStorageService,
  ) {}

  async list(taskId: string, actor: AuthUser): Promise<unknown[]> {
    await this.tasks.findOne(taskId, actor);
    return this.db.getClient().factoryTaskAttachment.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'desc' }],
      select: ATTACHMENT_SELECT,
    });
  }

  async create(
    taskId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: AuthUser,
  ): Promise<unknown> {
    if (!actor.permissions.includes('tasks.create')) {
      throw new ForbiddenException({ code: 'TASK_PERMISSION_DENIED', message: 'Missing tasks.create' });
    }
    const task = await this.tasks.findOne(taskId, actor);
    if (task.createdByUserId !== actor.id && !actor.permissions.includes('tasks.manage')) {
      throw new ForbiddenException({
        code: 'TASK_ATTACHMENT_NOT_OWNER',
        message: 'You can only attach files to tasks you created, unless you have tasks.manage',
      });
    }

    if (!(TASK_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'TASK_ATTACHMENT_INVALID_TYPE',
        message: 'Unsupported file type. Allowed: PDF, Word, Excel, JPG/PNG/WEBP photos, CSV and TXT files.',
      });
    }
    if (file.size > TASK_ATTACHMENT_MAX_BYTES) {
      throw new UnprocessableEntityException({
        code: 'TASK_ATTACHMENT_TOO_LARGE',
        message: `File exceeds the ${TASK_ATTACHMENT_MAX_BYTES / (1024 * 1024)}MB upload limit.`,
      });
    }

    const { fileName, storagePath } = await this.storage.save(taskId, file.buffer, file.originalname);

    const attachment = await this.db.getClient().factoryTaskAttachment.create({
      data: {
        taskId,
        fileName,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedByUserId: actor.id,
      },
      select: ATTACHMENT_SELECT,
    });

    await this.db.getClient().factoryTaskActivity.create({
      data: {
        taskId,
        actorUserId: actor.id,
        actorName: actor.displayName,
        event: 'TASK_ATTACHMENT_UPLOADED',
        metadata: { attachmentId: attachment.id, fileName: file.originalname },
      },
    });

    return attachment;
  }

  async getForDownload(
    taskId: string,
    attachmentId: string,
    actor: AuthUser,
  ): Promise<{ storagePath: string; originalFileName: string; mimeType: string }> {
    await this.tasks.findOne(taskId, actor);
    const attachment = await this.db.getClient().factoryTaskAttachment.findFirst({
      where: { id: attachmentId, taskId },
      select: { storagePath: true, originalFileName: true, mimeType: true },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'TASK_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }
    return attachment;
  }

  async remove(taskId: string, attachmentId: string, actor: AuthUser): Promise<void> {
    if (!actor.permissions.includes('tasks.create')) {
      throw new ForbiddenException({ code: 'TASK_PERMISSION_DENIED', message: 'Missing tasks.create' });
    }
    await this.tasks.findOne(taskId, actor);
    const attachment = await this.db.getClient().factoryTaskAttachment.findFirst({
      where: { id: attachmentId, taskId },
      select: { id: true, storagePath: true, originalFileName: true, uploadedByUserId: true },
    });
    if (!attachment) {
      throw new NotFoundException({ code: 'TASK_ATTACHMENT_NOT_FOUND', message: 'Attachment not found' });
    }
    if (attachment.uploadedByUserId !== actor.id && !actor.permissions.includes('tasks.manage')) {
      throw new ForbiddenException({
        code: 'TASK_ATTACHMENT_NOT_OWNER',
        message: 'You can only delete files you uploaded, unless you have tasks.manage',
      });
    }

    await this.db.getClient().factoryTaskAttachment.delete({ where: { id: attachmentId } });
    await this.storage.deleteFile(attachment.storagePath);

    await this.db.getClient().factoryTaskActivity.create({
      data: {
        taskId,
        actorUserId: actor.id,
        actorName: actor.displayName,
        event: 'TASK_ATTACHMENT_DELETED',
        metadata: { attachmentId, fileName: attachment.originalFileName },
      },
    });
  }
}
