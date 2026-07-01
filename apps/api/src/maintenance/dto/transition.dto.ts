import { IsString, IsNotEmpty, MaxLength, IsUUID, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class AssignMrDto {
  @IsUUID('4')
  assignedToUserId!: string;
}

export class RejectMrDto {
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  rejectionReason!: string;
}

export class WaitingForPartsMrDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason is required when waiting for parts' })
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  waitingForPartsReason!: string;
}

export class CompleteMrDto {
  @IsString()
  @IsNotEmpty({ message: 'Completion summary is required' })
  @MinLength(1)
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  completionSummary!: string;
}

export class ReopenMrDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason is required to reopen a maintenance request' })
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  reason!: string;
}

export class CancelMrDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason is required to cancel a maintenance request' })
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  reason!: string;
}
