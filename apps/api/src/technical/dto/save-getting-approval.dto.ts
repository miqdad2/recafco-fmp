import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsDateString,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TechnicalApprovalStatus, TechnicalApprovalRecordStatus, TechnicalPriority } from '@recafco/database';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

// FMP-TECH-03 — every field optional at the DTO level, same reasoning as
// SaveDrawingReceivedDto/SaveSdCalculationSubmissionDto: this one shape
// backs Save Draft, Send Back for Changes, Reject, and Approve & Move to FD
// Issuance, each enforcing its own required-field list imperatively in
// TechnicalService.
export class SaveGettingApprovalDto {
  @IsOptional()
  @IsUUID('4')
  relatedSdSubmissionId?: string;

  @IsOptional()
  @IsDateString()
  submittedOn?: string;

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
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) => trim(value))
  submittedTo?: string;

  @IsOptional()
  @IsEnum(TechnicalApprovalStatus)
  approvalStatus?: TechnicalApprovalStatus;

  @IsOptional()
  @IsDateString()
  expectedApprovalDate?: string;

  @IsOptional()
  @IsDateString()
  reviewedOn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) => trim(value))
  reviewedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) => trim(value))
  revisionNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  reviewerComments?: string;

  @IsOptional()
  @IsBoolean()
  resubmissionRequired?: boolean;

  @IsOptional()
  @IsDateString()
  resubmissionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  resubmissionReason?: string;

  @IsOptional()
  @IsEnum(TechnicalPriority)
  priority?: TechnicalPriority;

  @IsOptional()
  @IsEnum(TechnicalApprovalRecordStatus)
  status?: TechnicalApprovalRecordStatus;
}
