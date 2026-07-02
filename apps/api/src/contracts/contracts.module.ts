import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { ContractsRefService } from './contracts-ref.service';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [ContractsRefService, ContractsService],
  controllers: [ContractsController],
})
export class ContractsModule {}
