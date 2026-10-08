import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { ErectionPiecesController } from './erection-pieces.controller';
import { ErectionPiecesService } from './erection-pieces.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [ErectionPiecesService],
  controllers: [ErectionPiecesController],
})
export class ErectionModule {}
