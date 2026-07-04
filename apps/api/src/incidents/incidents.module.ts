import { Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { IncidentsRefService } from './incidents-ref.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';

@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, IncidentsRefService],
})
export class IncidentsModule {}
