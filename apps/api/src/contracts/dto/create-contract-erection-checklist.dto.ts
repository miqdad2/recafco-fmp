import { IsString, IsOptional, IsNotEmpty, MaxLength, IsIn, Matches, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const CONTRACT_ERECTION_CHECKLIST_STATUSES = ['DRAFT', 'SUBMITTED_FOR_VERIFICATION', 'VERIFIED', 'HOLD', 'RETURNED'] as const;
export const CONTRACT_ERECTION_CHECKLIST_ITEM_STATUSES = ['COMPLETED', 'IN_PROGRESS', 'NOT_COMPLETED', 'NOT_APPLICABLE'] as const;

export const CONTRACT_ERECTION_CHECKLIST_TYPES = [
  'Pre-Payment Erection Checklist',
  'QA/QC Verification Checklist',
  'Client Acknowledgement Checklist',
  'Final Erection Checklist',
  'Other',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// CM-71G — unlike Step 4's fixed 4-document checklist or Step 5's own fixed
// 10-item checklist, this unit's own task explicitly allows "add/remove
// rows if practical" — checklistItem is deliberately free text here, not a
// closed @IsIn list, seeded with the 12 default items only at creation.
export class ErectionChecklistItemInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  checklistItem!: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_CHECKLIST_ITEM_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  attachmentRef?: string;
}

export class CreateContractErectionChecklistDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  checklistRefNo!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'checklistDate must be in YYYY-MM-DD format' })
  checklistDate!: string;

  @IsIn(CONTRACT_ERECTION_CHECKLIST_TYPES)
  checklistType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  preparedBy!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  reviewedByQaqc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  verifiedByClientRepresentative?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_CHECKLIST_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  workLocationYard?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  comments?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErectionChecklistItemInputDto)
  items?: ErectionChecklistItemInputDto[];
}
