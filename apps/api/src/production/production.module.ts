import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';
import { ProductionRefService } from './production-ref.service';
import { ProductionLinesService } from './production-lines.service';
import { ProductionOrdersService } from './production-orders.service';
import { ProductionController } from './production.controller';
import { ProductionPiecesController } from './production-pieces.controller';
import { ProductionPiecesService } from './production-pieces.service';
import { TechnicalDrawingGroupFileStorageService } from '../technical/technical-drawing-group-file-storage.service';

@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  providers: [ProductionRefService, ProductionLinesService, ProductionOrdersService, ProductionPiecesService, TechnicalDrawingGroupFileStorageService],
  controllers: [ProductionPiecesController, ProductionController],
  exports: [ProductionOrdersService],
})
export class ProductionModule {}
