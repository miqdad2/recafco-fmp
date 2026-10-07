import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { StorageDeliveryPiecesController } from './storage-delivery-pieces.controller';
import { StorageDeliveryPiecesService } from './storage-delivery-pieces.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [StorageDeliveryPiecesService],
  controllers: [StorageDeliveryPiecesController],
})
export class StorageDeliveryModule {}
