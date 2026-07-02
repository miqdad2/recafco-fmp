import { IsOptional, IsInt, Min, Max, IsString, IsUUID, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

const STORED_STATUSES = ['DRAFT', 'ACTIVE', 'TERMINATED', 'CLOSED'];
const DERIVED_STATUSES = ['DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED', 'CLOSED'];

export class ContractListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @IsIn(STORED_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(DERIVED_STATUSES)
  lifecycleStatus?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4')
  ownerUserId?: string;

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @IsOptional()
  @IsUUID('4')
  plantId?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
