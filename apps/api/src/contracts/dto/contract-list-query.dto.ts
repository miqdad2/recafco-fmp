import { IsOptional, IsInt, Min, Max, IsString, IsUUID, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

// CM-69C — 'ALL' is a real, explicit filter value (not the absence of one):
// it deliberately bypasses the default CANCELLED-excluding behavior in
// buildListWhere() to show every real status, CANCELLED included, for audit.
const STORED_STATUSES = ['DRAFT', 'ACTIVE', 'TERMINATED', 'CLOSED', 'CANCELLED', 'ALL'];
const DERIVED_STATUSES = ['DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED', 'CLOSED', 'CANCELLED', 'ALL'];

// CM-55 — Contract List filters. `scheduleStatus` here filters on the
// manager-facing display status (see computeEffectiveScheduleStatus in
// contracts.service.ts) — completely separate from `lifecycleStatus` above.
const SCHEDULE_STATUSES = ['IN_PROGRESS', 'ON_TRACK', 'DELAYED', 'COMPLETED', 'AHEAD_OF_SCHEDULE'];

// Mirrors SCOPE_OF_WORK_OPTIONS keys in the web app's contract-ui-helpers.ts
// (contracts.service.ts has no dedicated "contract type" column — this
// filters the real scopeOfWork JSONB flags a contract already carries).
const CONTRACT_TYPE_KEYS = [
  'shopDrawing', 'designProduction', 'production', 'delivery', 'erection', 'exFactory', 'other', 'notApplicable',
];

const DAYS_REMAINING_OPTIONS = ['DUE_30', 'DUE_60', 'OVERDUE'];

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
  @IsIn(SCHEDULE_STATUSES)
  scheduleStatus?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTRACT_TYPE_KEYS)
  contractType?: string;

  @IsOptional()
  @IsString()
  @IsIn(DAYS_REMAINING_OPTIONS)
  daysRemaining?: string;

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
