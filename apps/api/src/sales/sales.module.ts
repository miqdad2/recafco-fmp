import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
