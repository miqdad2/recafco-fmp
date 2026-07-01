import { IsString, IsNotEmpty, MaxLength, IsUUID, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class AssignTaskDto {
  @IsUUID('4')
  assignedToUserId!: string;
}

export class BlockTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Blocked reason is required' })
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  blockedReason!: string;
}

export class CompleteTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Completion summary is required' })
  @MinLength(1)
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  completionSummary!: string;
}

export class ReopenTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason is required to reopen a task' })
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  reason!: string;
}

export class CancelTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason is required to cancel a task' })
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  reason!: string;
}
