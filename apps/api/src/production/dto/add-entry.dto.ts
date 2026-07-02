import {
  IsString,
  IsOptional,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddEntryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityProduced?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityAccepted?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityRejected?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  downtimeMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  adjustmentQty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsString()
  recordedAt?: string;
}
