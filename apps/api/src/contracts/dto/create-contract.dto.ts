import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUUID,
  IsPositive,
  IsNumber,
  Min,
  IsObject,
  IsArray,
  IsIn,
  ValidateNested,
  Length,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreateContractBoqItemDto } from './create-contract-boq-item.dto';

export const CRANE_REQUIRED_OPTIONS = ['YES', 'NO', 'NOT_DECIDED'] as const;
export const CRANE_PROVIDED_BY_OPTIONS = ['RECAFCO', 'CLIENT', 'THIRD_PARTY', 'NOT_DECIDED'] as const;

export class CreateContractDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  counterpartyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  counterpartyContact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobOrder?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'contractDate must be in YYYY-MM-DD format' })
  contractDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  quotationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  projectNumber?: string;

  // Checkbox keys map to booleans; 'otherDescription' (when 'other' is checked) is the
  // one free-text exception living in this same flexible JSON blob.
  @IsOptional()
  @IsObject()
  scopeOfWork?: Record<string, boolean | string>;

  @IsOptional()
  @IsObject()
  paymentTerms?: Record<string, boolean>;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  clientContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  clientContactPhone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'forecastCompletionDate must be in YYYY-MM-DD format' })
  forecastCompletionDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalContractValue?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  originalCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  projectSiteLocation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  scopeDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  scopeExclusions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  deliverables?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  milestones?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  scheduleSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  quantitiesSpecifications?: string;

  @IsOptional()
  @IsIn(CRANE_REQUIRED_OPTIONS)
  craneRequired?: string;

  @IsOptional()
  @IsIn(CRANE_PROVIDED_BY_OPTIONS)
  craneProvidedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  estimatedCraneCapacity?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContractBoqItemDto)
  boqItems?: CreateContractBoqItemDto[];

  @IsOptional()
  @IsNumber()
  @IsPositive()
  contractValue?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be in YYYY-MM-DD format' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be in YYYY-MM-DD format' })
  endDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'renewalNoticeDate must be in YYYY-MM-DD format' })
  renewalNoticeDate?: string;

  @IsOptional()
  @IsUUID('4')
  ownerUserId?: string;

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @IsOptional()
  @IsUUID('4')
  plantId?: string;

  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
