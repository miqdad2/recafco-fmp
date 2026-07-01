import { IsOptional, IsEnum, IsUUID, IsDateString, IsBoolean, Min, Max, IsInt, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TaskStatus, TaskPriority } from '@recafco/database';

function splitComma(value: unknown): unknown {
  return typeof value === 'string' ? value.split(',') : value;
}

export class TaskListQueryDto {
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
  @IsEnum(TaskStatus, { each: true })
  status?: TaskStatus | TaskStatus[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => splitComma(value))
  @IsEnum(TaskPriority, { each: true })
  priority?: TaskPriority | TaskPriority[];

  // Pass "me" to resolve to current user's ID server-side (handled in service)
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsUUID('4')
  responsibleDepartmentId?: string;

  @IsOptional()
  @IsUUID('4')
  requestingDepartmentId?: string;

  @IsOptional()
  @IsUUID('4')
  plantId?: string;

  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  @IsOptional()
  @IsUUID('4')
  incidentId?: string;

  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @IsOptional()
  @IsDateString()
  dueTo?: string;

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
