import { IsString, IsOptional, MaxLength, IsBoolean, IsIn, Matches } from 'class-validator';
import { CONTRACT_ERECTION_METHOD_STATEMENT_STATUSES } from './create-contract-erection-method-statement.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractErectionMethodStatementDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedIssueDate must be in YYYY-MM-DD format' })
  plannedIssueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  methodStatementRefNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  jobOrderNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  workLocationYard?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  preparedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  departmentArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  reviewedByInternal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentRevision?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  applicableStandards?: string;

  @IsOptional()
  @IsBoolean()
  includesLiftPlan?: boolean;

  @IsOptional()
  @IsBoolean()
  includesRiskAssessment?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresClientApproval?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  scopeDescription?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_METHOD_STATEMENT_STATUSES)
  status?: string;
}
