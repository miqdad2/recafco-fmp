import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../../auth/auth.module';
import { OperationsDemoController } from './operations-demo.controller';
import { OperationsDemoService } from './operations-demo.service';

// FMP-OPS-02 — only imported by AppModule when operationsDemoAllowed() (development + explicit flag).
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [OperationsDemoController],
  providers: [OperationsDemoService],
})
export class OperationsDemoModule {}
