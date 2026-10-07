import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** FMP-BOQ-07 — Production piece list filters. `statuses` is a comma list (e.g. DRAWING_READY,IN_PRODUCTION). */
export class ProductionPieceListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  statuses?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  contractId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  drawingNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  boqItem?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
