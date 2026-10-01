import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsDateString,
  IsUUID,
  IsInt,
  Min,
  IsEmail,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  TechnicalFdPurpose,
  TechnicalFdIssueType,
  TechnicalFdDistribution,
  TechnicalFdIssueMethod,
  TechnicalFdStatus,
  TechnicalPriority,
} from '@recafco/database';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

// FMP-TECH-04 — every field optional at the DTO level, same reasoning as
// SaveGettingApprovalDto: this one shape backs Save Draft, Submit FD Issue,
// and Issue FD & Complete Technical Workflow, each enforcing its own
// required-field list imperatively in TechnicalService.
export class SaveFdIssuanceDto {
  @IsOptional()
  @IsUUID('4')
  relatedApprovalId?: string;

  @IsOptional()
  @IsDateString()
  fdIssueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) => trim(value))
  issuedTo?: string;

  @IsOptional()
  @IsEnum(TechnicalFdPurpose)
  purposeFor?: TechnicalFdPurpose;

  @IsOptional()
  @IsEnum(TechnicalFdIssueType)
  issueType?: TechnicalFdIssueType;

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
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => trim(value))
  approvedReferenceNo?: string;

  @IsOptional()
  @IsDateString()
  approvedDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfSheetsOrFiles?: number;

  @IsOptional()
  @IsEnum(TechnicalFdDistribution)
  distribution?: TechnicalFdDistribution;

  @IsOptional()
  @IsEnum(TechnicalFdIssueMethod)
  issueMethod?: TechnicalFdIssueMethod;

  @IsOptional()
  @IsUUID('4')
  issuedById?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) => trim(value))
  issuedByName?: string;

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
  @Transform(({ value }: { value: unknown }) => trim(value))
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  remarks?: string;

  @IsOptional()
  @IsEnum(TechnicalPriority)
  priority?: TechnicalPriority;

  @IsOptional()
  @IsEnum(TechnicalFdStatus)
  status?: TechnicalFdStatus;
}
