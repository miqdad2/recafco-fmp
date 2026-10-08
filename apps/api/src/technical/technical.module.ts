import { Module } from '@nestjs/common';
import { TechnicalController } from './technical.controller';
import { TechnicalService } from './technical.service';
import { TechnicalAttachmentStorageService } from './technical-attachment-storage.service';
import { TechnicalBoqConfirmationController } from './technical-boq-confirmation.controller';
import { TechnicalBoqConfirmationService } from './technical-boq-confirmation.service';
import { TechnicalBoqPieceController } from './technical-boq-piece.controller';
import { TechnicalBoqPieceService } from './technical-boq-piece.service';
import { TechnicalDrawingGroupController } from './technical-drawing-group.controller';
import { TechnicalDrawingGroupService } from './technical-drawing-group.service';
import { TechnicalDrawingGroupFileController } from './technical-drawing-group-file.controller';
import { TechnicalDrawingGroupFileService } from './technical-drawing-group-file.service';
import { TechnicalDrawingGroupFileStorageService } from './technical-drawing-group-file-storage.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';

@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  controllers: [TechnicalController, TechnicalBoqConfirmationController, TechnicalBoqPieceController, TechnicalDrawingGroupController, TechnicalDrawingGroupFileController],
  providers: [TechnicalService, TechnicalAttachmentStorageService, TechnicalBoqConfirmationService, TechnicalBoqPieceService, TechnicalDrawingGroupService, TechnicalDrawingGroupFileService, TechnicalDrawingGroupFileStorageService],
  exports: [TechnicalService],
})
export class TechnicalModule {}
