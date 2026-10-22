import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ManagementIntelligenceController } from './management-intelligence.controller';
import { ManagementIntelligenceService } from './management-intelligence.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ManagementIntelligenceController],
  providers: [ManagementIntelligenceService],
})
export class ManagementIntelligenceModule {}
