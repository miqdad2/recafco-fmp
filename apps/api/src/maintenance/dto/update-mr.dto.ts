import { IsString, IsNotEmpty, MaxLength, IsEnum, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { MaintenancePriority } from '@recafco/database';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateMrDto {
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
  problemDescription?: string;

  @IsOptional()
  @IsEnum(MaintenancePriority)
  priority?: MaintenancePriority;

  @IsOptional()
  @IsUUID('4')
  requestedByUserId?: string;

  @IsOptional()
  @IsUUID('4')
  affectedDepartmentId?: string;

  @IsOptional()
  @IsUUID('4')
  plantId?: string;

  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  equipmentDescription?: string;

  @IsOptional()
  @IsDateString()
  requestedCompletionAt?: string | null;
}
