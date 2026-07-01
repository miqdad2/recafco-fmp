import { IsString, IsNotEmpty, MaxLength, IsEnum, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { TaskPriority } from '@recafco/database';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) => trim(value))
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  description?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  // requestedByUserId: only tasks.manage may supply a value other than actor.id
  @IsOptional()
  @IsUUID('4')
  requestedByUserId?: string;

  @IsOptional()
  @IsUUID('4')
  requestingDepartmentId?: string;

  @IsOptional()
  @IsUUID('4')
  responsibleDepartmentId?: string;

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
  dueAt?: string;
}
