import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentAccessModule } from '../department-access/department-access.module';
import { SafetyService } from './safety.service';
import { SafetyRefService } from './safety-ref.service';
import { SafetyController } from './safety.controller';

@Module({
  imports: [DatabaseModule, AuthModule, DepartmentAccessModule],
  controllers: [SafetyController],
  providers: [SafetyService, SafetyRefService],
})
export class SafetyModule {}
