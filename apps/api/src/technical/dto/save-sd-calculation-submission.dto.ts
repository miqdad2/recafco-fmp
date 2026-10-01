import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsUUID,
  IsEmail,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  TechnicalSubmissionType,
  TechnicalCalculationType,
  TechnicalSubmissionMethod,
  TechnicalSdSubmissionStatus,
  TechnicalPriority,
} from '@recafco/database';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

// FMP-TECH-02 — every field optional at the DTO level, same reasoning as
// SaveDrawingReceivedDto: this one shape backs Save Draft, Submit SD &
// Calculation, and Complete & Move to Getting Approval, each enforcing its
// own required-field list imperatively in TechnicalService (see that
// file's own CORE_SD_SUBMIT_FIELDS/COMPLETE_SD_REQUIRED_FIELDS constants).
export class SaveSdCalculationSubmissionDto {
  @IsOptional()
  @IsDateString()
  submissionDate?: string;

  @IsOptional()
  @IsEnum(TechnicalSubmissionType)
  submissionType?: TechnicalSubmissionType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) => trim(value))
  submittedTo?: string;

  @IsOptional()
  @IsDateString()
  targetApprovalDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => trim(value))
  drawingReferenceNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) => trim(value))
  revisionNo?: string;

  @IsOptional()
  @IsUUID('4')
  relatedDrawingId?: string;

  @IsOptional()
  @IsEnum(TechnicalCalculationType)
  calculationType?: TechnicalCalculationType;

  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfSheetsOrFiles?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  scopeDescription?: string;

  @IsOptional()
  @IsEnum(TechnicalSubmissionMethod)
  submissionMethod?: TechnicalSubmissionMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => trim(value))
  referenceSubmissionNo?: string;

  @IsOptional()
  @IsUUID('4')
  submittedById?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) => trim(value))
  submittedByName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }: { value: unknown }) => trim(value))
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) => trim(value))
  contactNo?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  remarks?: string;

  @IsOptional()
  @IsEnum(TechnicalSdSubmissionStatus)
  status?: TechnicalSdSubmissionStatus;

  @IsOptional()
  @IsEnum(TechnicalPriority)
  priority?: TechnicalPriority;
}
