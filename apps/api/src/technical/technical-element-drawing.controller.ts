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
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Response } from 'express';
import { TechnicalElementDrawingService } from './technical-element-drawing.service';
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

const optionalText = (max: number) => [
  IsOptional(),
  IsString(),
  MaxLength(max),
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined)),
];
function applyAll(decorators: PropertyDecorator[]): PropertyDecorator {
  return (target, key) => decorators.forEach((d) => d(target, key));
}

// Multipart text fields for one element's final drawing.
class UploadElementDrawingDto {
  @applyAll(optionalText(100))
  drawingRefNo?: string;

  @applyAll(optionalText(50))
  revision?: string;

  @applyAll(optionalText(1000))
  remarks?: string;
}

class ReleaseElementsDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @IsUUID('4', { each: true })
  pieceIds!: string[];
}

const uuid = new ParseUUIDPipe({ version: '4' });

// FMP-TECH-27 — read/view/download = technical.read or contracts.read; add/remove/release = the
// Technical write pair. The service re-checks department access on every call.
@Controller('technical/jobs/:contractId/element-drawings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TechnicalElementDrawingController {
  constructor(
    private readonly service: TechnicalElementDrawingService,
    private readonly storage: TechnicalAttachmentStorageService,
  ) {}

  @Get('coverage')
  @AnyPermission('technical.read', 'contracts.read')
  async coverage(@Param('contractId', uuid) contractId: string, @CurrentUser() actor: AuthUser): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.coverage(contractId, actor), meta: meta(), error: null };
  }

  @Post('release')
  @HttpCode(200)
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async release(
    @Param('contractId', uuid) contractId: string,
    @Body() dto: ReleaseElementsDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.release(contractId, dto.pieceIds, actor), meta: meta(), error: null };
  }

  @Get(':pieceId/files')
  @AnyPermission('technical.read', 'contracts.read')
  async list(
    @Param('contractId', uuid) contractId: string,
    @Param('pieceId', uuid) pieceId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return { data: await this.service.listFiles(contractId, pieceId, actor), meta: meta(), error: null };
  }

  @Post(':pieceId/files')
  @HttpCode(201)
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  // File type and the 25 MB rule are checked in the service (plain messages); this larger cap only bounds memory.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 60 * 1024 * 1024 } }))
  async upload(
    @Param('contractId', uuid) contractId: string,
    @Param('pieceId', uuid) pieceId: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() body: UploadElementDrawingDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    return {
      data: await this.service.upload(contractId, pieceId, { drawingRefNo: body.drawingRefNo, revision: body.revision, remarks: body.remarks }, file, actor),
      meta: meta(),
      error: null,
    };
  }

  @Get(':pieceId/files/:attachmentId/download')
  @AnyPermission('technical.read', 'contracts.read')
  async download(
    @Param('contractId', uuid) contractId: string,
    @Param('pieceId', uuid) pieceId: string,
    @Param('attachmentId', uuid) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalName, mimeType } = await this.service.getForDownload(contractId, pieceId, attachmentId, actor);
    res.set({ 'Content-Type': mimeType, 'Content-Disposition': `attachment; filename="${encodeURIComponent(originalName)}"` });
    return new StreamableFile(this.storage.createReadStream(storagePath));
  }

  @Get(':pieceId/files/:attachmentId/view')
  @AnyPermission('technical.read', 'contracts.read')
  async view(
    @Param('contractId', uuid) contractId: string,
    @Param('pieceId', uuid) pieceId: string,
    @Param('attachmentId', uuid) attachmentId: string,
    @CurrentUser() actor: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { storagePath, originalName, mimeType } = await this.service.getForDownload(contractId, pieceId, attachmentId, actor);
    res.set({ 'Content-Type': mimeType, 'Content-Disposition': `inline; filename="${encodeURIComponent(originalName)}"` });
    return new StreamableFile(this.storage.createReadStream(storagePath));
  }

  @Delete(':pieceId/files/:attachmentId')
  @HttpCode(200)
  @AnyPermission('technical.update', 'contracts.update', 'contracts.workflow_update')
  async remove(
    @Param('contractId', uuid) contractId: string,
    @Param('pieceId', uuid) pieceId: string,
    @Param('attachmentId', uuid) attachmentId: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApiSuccessResponse<unknown>> {
    await this.service.remove(contractId, pieceId, attachmentId, actor);
    return { data: { removed: true }, meta: meta(), error: null };
  }
}
