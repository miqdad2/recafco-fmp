import { IsString, IsOptional, MaxLength, IsIn, Matches, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import {
  CONTRACT_ERECTION_CHECKLIST_STATUSES,
  CONTRACT_ERECTION_CHECKLIST_TYPES,
  ErectionChecklistItemInputDto,
} from './create-contract-erection-checklist.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractErectionChecklistDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  checklistRefNo?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'checklistDate must be in YYYY-MM-DD format' })
  checklistDate?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_CHECKLIST_TYPES)
  checklistType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  preparedBy?: string;

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
