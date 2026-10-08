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
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Response } from 'express';
import { TechnicalDrawingGroupFileService } from './technical-drawing-group-file.service';
import { TechnicalDrawingGroupFileStorageService } from './technical-drawing-group-file-storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
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

// Category / remarks arrive as multipart text fields; the category value itself is checked in the service so the message stays plain.
class UploadGroupFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined))
  remarks?: string;
}

const uuid = new ParseUUIDPipe({ version: '4' });

// FMP-BOQ-12 — read/download = contracts.read; upload/remove = the Technical write pair.
// The service re-checks that the contract, group and file belong together, and stops
// changes once the group is released to Production.
@Controller('technical/jobs/:contractId/drawing-groups/:groupId/attachments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TechnicalDrawingGroupFileController {
  constructor(
    private readonly service: TechnicalDrawingGroupFileService,
    private readonly storage: TechnicalDrawingGroupFileStorageService,
  ) {}

  @Get()
  @Permissions('contracts.read')
  async list(
    @Param('contractId', uuid) contractId: string,
    @Param('groupId', uuid) groupId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.list(contractId, groupId, actor), meta: meta(), error: null };
  }

  @Post()
  @HttpCode(201)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  // The 25 MB rule and the allowed types are checked in the service (plain messages); this larger cap only bounds memory.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 60 * 1024 * 1024 } }))
  async upload(
    @Param('contractId', uuid) contractId: string,
    @Param('groupId', uuid) groupId: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() body: UploadGroupFileDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return {
      data: await this.service.upload(contractId, groupId, file, { category: body.category, remarks: body.remarks }, actor),
      meta: meta(),
      error: null,
    };
  }

  @Get(':attachmentId/download')
  @Permissions('contracts.read')
  async download(
    @Param('contractId', uuid) contractId: string,
    @Param('groupId', uuid) groupId: string,
    @Param('attachmentId', uuid) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalName, mimeType } = await this.service.getForDownload(contractId, groupId, attachmentId, actor);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}"`,
    });
    return new StreamableFile(this.storage.createReadStream(storagePath));
  }

  @Delete(':attachmentId')
  @HttpCode(200)
  @AnyPermission('contracts.update', 'contracts.workflow_update')
  async remove(
    @Param('contractId', uuid) contractId: string,
    @Param('groupId', uuid) groupId: string,
    @Param('attachmentId', uuid) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<null>> {
    await this.service.remove(contractId, groupId, attachmentId, actor);
    return { data: null, meta: meta(), error: null };
  }
}
