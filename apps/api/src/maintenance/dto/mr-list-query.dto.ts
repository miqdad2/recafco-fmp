import { IsOptional, IsEnum, IsUUID, IsDateString, IsInt, Min, Max, IsString, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MaintenanceStatus, MaintenancePriority } from '@recafco/database';

function splitComma(value: unknown): unknown {
  return typeof value === 'string' ? value.split(',') : value;
}

export class MrListQueryDto {
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

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => splitComma(value))
  @IsEnum(MaintenanceStatus, { each: true })
  status?: MaintenanceStatus | MaintenanceStatus[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => splitComma(value))
  @IsEnum(MaintenancePriority, { each: true })
  priority?: MaintenancePriority | MaintenancePriority[];

  // Pass "me" to resolve to current user's ID server-side (handled in service)
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

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
  @IsDateString()
  requestedCompletionFrom?: string;

  @IsOptional()
  @IsDateString()
  requestedCompletionTo?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  overdue?: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
