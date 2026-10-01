import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  TechnicalDrawingType,
  TechnicalReceivedFrom,
  TechnicalPriority,
  TechnicalDrawingStatus,
  TechnicalLinkedStage,
} from '@recafco/database';

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

// FMP-TECH-01 — every field is optional at the DTO level: this same shape
// backs both "Save Draft" (nothing required) and "Complete Drawing Receipt &
// Continue" (TechnicalService.completeDrawingReceived enforces the ticket's
// own required-field list imperatively, since "required only to complete,
// optional to draft" isn't expressible as fixed class-validator decorators
// on one DTO). Fields that ARE present are still validated to the correct
// type/enum/length either way.
export class SaveDrawingReceivedDto {
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @IsOptional()
  @IsEnum(TechnicalReceivedFrom)
  receivedFrom?: TechnicalReceivedFrom;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) => trim(value))
  senderName?: string;

  @IsOptional()
  @IsEnum(TechnicalDrawingType)
  drawingType?: TechnicalDrawingType;

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
  @IsInt()
  @Min(1)
  numberOfSheets?: number;

  @IsOptional()
  @IsEnum(TechnicalPriority)
  priority?: TechnicalPriority;

  @IsOptional()
  @IsEnum(TechnicalDrawingStatus)
  status?: TechnicalDrawingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  drawingDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) => trim(value))
  relatedAreaPackage?: string;

  @IsOptional()
  @IsEnum(TechnicalLinkedStage)
  linkedWorkflowStage?: TechnicalLinkedStage;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => trim(value))
  internalReferenceNo?: string;

  @IsOptional()
  @IsBoolean()
  requiresImmediateReview?: boolean;

  @IsOptional()
  @IsBoolean()
  additionalDocumentsReceived?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }: { value: unknown }) => trim(value))
  internalNotes?: string;

  @IsOptional()
  @IsUUID('4')
  assignedToUserId?: string;

  @IsOptional()
  @IsDateString()
  plannedReviewStart?: string;
}
