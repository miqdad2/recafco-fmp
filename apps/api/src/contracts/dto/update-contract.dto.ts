import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUUID,
  IsPositive,
  IsNumber,
  IsInt,
  Min,
  Length,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

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
