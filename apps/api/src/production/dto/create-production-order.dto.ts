import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUUID,
  IsInt,
  IsPositive,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateProductionOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsUUID('4')
  productionLineId?: string;

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @IsOptional()
  @IsUUID('4')
  plantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  productCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  productName?: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  targetQuantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit!: string;

  @IsOptional()
  @IsString()
  scheduledStartAt?: string;

  @IsOptional()
  @IsString()
  scheduledEndAt?: string;

  @IsOptional()
  @IsUUID('4')
  supervisorUserId?: string;
}
