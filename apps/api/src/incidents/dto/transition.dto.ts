import { IsString, IsNotEmpty, MaxLength, IsUUID, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class ResolveIncidentDto {
  @IsString()
  @IsNotEmpty({ message: 'Resolution summary is required' })
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  resolutionSummary!: string;

  @IsOptional()
  @IsBoolean()
  confirmOpenActions?: boolean;
}

export class ReopenIncidentDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason is required to reopen an incident' })
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  reason!: string;
}

export class CancelIncidentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  reason?: string;
}

export class AssignIncidentDto {
  @IsUUID('4')
  assignedToUserId!: string;
}

export class UpdateSeverityDto {
  @IsString()
  @IsNotEmpty()
  severity!: string;
}

export class UpdateInvestigationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  rootCause?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  investigationSummary?: string;
}
