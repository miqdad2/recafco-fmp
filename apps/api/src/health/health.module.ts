import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ReadinessController } from './readiness.controller';
import { RuntimeStateService } from './runtime-state.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, ReadinessController],
  providers: [RuntimeStateService],
  exports: [RuntimeStateService],
})
export class HealthModule {}
