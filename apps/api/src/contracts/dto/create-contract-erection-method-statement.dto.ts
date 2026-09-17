import { IsString, IsOptional, IsNotEmpty, MaxLength, IsBoolean, IsIn, Matches } from 'class-validator';

export const CONTRACT_ERECTION_METHOD_STATEMENT_STATUSES = ['DRAFT', 'SUBMITTED_FOR_APPROVAL', 'ISSUED'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateContractErectionMethodStatementDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'plannedIssueDate must be in YYYY-MM-DD format' })
  plannedIssueDate?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  methodStatementRefNo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  jobOrderNo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  workLocationYard!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  preparedBy!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  departmentArea!: string;

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

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  scopeDescription!: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_METHOD_STATEMENT_STATUSES)
  status?: string;
}
