import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Res,
  HttpCode,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Response } from 'express';
import { TechnicalBoqAttachmentService } from './technical-boq-attachment.service';
import { TechnicalAttachmentStorageService } from './technical-attachment-storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AnyPermission } from '../common/decorators/any-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { getRequestId } from '@recafco/observability';
import type { ApiSuccessResponse } from '@recafco/shared';
import type { AuthUser } from '../common/types/auth-user';

interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function meta(): { requestId?: string } {
  const id = getRequestId();
  return id !== undefined ? { requestId: id } : {};
}

// Multipart text fields. The BOQ item is checked in the service so the message stays plain.
class UploadBoqAttachmentDto {
  @IsOptional()
  @IsUUID('4')
  boqItemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined))
  notes?: string;
}

const uuid = new ParseUUIDPipe({ version: '4' });

// FMP-BOQ-17 — read/view/download = technical.read or contracts.read; add/remove =
// the Technical write pair (so Contract Management users with contracts.update can
// add client drawings). The service re-checks department access on every call.
@Controller('technical/jobs/:contractId/boq-attachments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TechnicalBoqAttachmentController {
  constructor(
    private readonly service: TechnicalBoqAttachmentService,
    private readonly storage: TechnicalAttachmentStorageService,
  ) {}

  @Get()
  @AnyPermission('technical.read', 'contracts.read')
  async list(@Param('contractId', uuid) contractId: string, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.list(contractId, actor), meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  // File type and the 25 MB rule are checked in the service (plain messages); this larger cap only bounds memory.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 60 * 1024 * 1024 } }))
  async upload(
    @Param('contractId', uuid) contractId: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() body: UploadBoqAttachmentDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return {
      data: await this.service.upload(contractId, { boqItemId: body.boqItemId, notes: body.notes }, file, actor),
      meta: meta(),
      error: null,
    };
  }

  @Get(':attachmentId/download')
  @AnyPermission('technical.read', 'contracts.read')
  async download(
    @Param('contractId', uuid) contractId: string,
    @Param('attachmentId', uuid) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.service.getForDownload(contractId, attachmentId, actor);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.storage.createReadStream(storagePath));
  }

  @Get(':attachmentId/view')
  @AnyPermission('technical.read', 'contracts.read')
  async view(
    @Param('contractId', uuid) contractId: string,
    @Param('attachmentId', uuid) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalFileName, mimeType } = await this.service.getForDownload(contractId, attachmentId, actor);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(originalFileName)}"`,
    });
    return new StreamableFile(this.storage.createReadStream(storagePath));
  }

  /** FMP-TECH-20 — PNG preview of a TIFF drawing, for the viewer only. Download still serves the original. */
  @Get(':attachmentId/preview')
  @AnyPermission('technical.read', 'contracts.read')
  async preview(
    @Param('contractId', uuid) contractId: string,
    @Param('attachmentId', uuid) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { previewPath, originalFileName } = await this.service.getTiffPreview(contractId, attachmentId, actor);
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="${encodeURIComponent(originalFileName.replace(/.tiff?$/i, ''))}.png"`,
    });
    return new StreamableFile(this.storage.createReadStream(previewPath));
  }

  @Delete(':attachmentId')
  @HttpCode(200)
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async remove(
    @Param('contractId', uuid) contractId: string,
    @Param('attachmentId', uuid) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.service.remove(contractId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }
}
