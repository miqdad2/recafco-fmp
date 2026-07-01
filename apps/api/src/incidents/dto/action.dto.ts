import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IncidentActionStatus } from '@recafco/database';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class AddActionDto {
  @IsString()
  @IsNotEmpty({ message: 'Action title is required' })
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) => trim(value))
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  description?: string;

  @IsOptional()
  @IsUUID('4')
  assignedToUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateActionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) => trim(value))
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  description?: string;

  @IsOptional()
  @IsEnum(IncidentActionStatus)
  status?: IncidentActionStatus;

  @IsOptional()
  @IsUUID('4')
  assignedToUserId?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
