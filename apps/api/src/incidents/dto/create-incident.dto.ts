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

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) => trim(value))
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MaxLength(10000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  description!: string;

  @IsEnum(IncidentSeverity)
  severity!: IncidentSeverity;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  immediateAction?: string;

  @IsOptional()
  @IsUUID('4')
  reportedForUserId?: string;

  @IsOptional()
  @IsUUID('4')
  affectedPlantId?: string;

  @IsOptional()
  @IsUUID('4')
  affectedLocationId?: string;

  @IsOptional()
  @IsUUID('4')
  affectedDepartmentId?: string;
}
