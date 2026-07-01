import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IncidentSeverity } from '@recafco/database';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) => trim(value))
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  description?: string;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  immediateAction?: string;

  @IsOptional()
  @IsUUID('4')
  reportedForUserId?: string | null;

  @IsOptional()
  @IsUUID('4')
  affectedPlantId?: string | null;

  @IsOptional()
  @IsUUID('4')
  affectedLocationId?: string | null;

  @IsOptional()
  @IsUUID('4')
  affectedDepartmentId?: string | null;
}
