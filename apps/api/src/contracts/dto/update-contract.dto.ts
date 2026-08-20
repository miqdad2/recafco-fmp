import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUUID,
  IsPositive,
  IsNumber,
  IsObject,
  IsArray,
  IsIn,
  ValidateNested,
  IsInt,
  Min,
  Length,
  Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreateContractBoqItemDto } from './create-contract-boq-item.dto';
import { CRANE_REQUIRED_OPTIONS, CRANE_PROVIDED_BY_OPTIONS } from './create-contract.dto';

export class UpdateContractDto {
  @IsInt()
  @Min(1)
  version!: number;
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  counterpartyName?: string;

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

  // undefined = BOQ items untouched by this update; [] = clear all BOQ items;
  // non-empty array = replace the full BOQ item set for this contract.
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
