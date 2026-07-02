import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { ProductionRefService } from './production-ref.service';
import { ProductionLinesService } from './production-lines.service';
import { ProductionOrdersService } from './production-orders.service';
import { ProductionController } from './production.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [ProductionRefService, ProductionLinesService, ProductionOrdersService],
  controllers: [ProductionController],
})
export class ProductionModule {}
