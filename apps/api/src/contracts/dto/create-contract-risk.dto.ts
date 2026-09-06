import { IsString, IsOptional, IsNotEmpty, MaxLength, IsIn, IsUUID, Matches } from 'class-validator';

export const CONTRACT_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const CONTRACT_RISK_RESPONSES = ['MITIGATE', 'ACCEPT', 'AVOID', 'TRANSFER'] as const;
export const CONTRACT_RISK_STATUSES = ['OPEN', 'IN_PROGRESS', 'MITIGATED', 'CLOSED', 'CANCELLED'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateContractRiskDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  riskNo?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsIn(CONTRACT_RISK_LEVELS)
  riskEvaluation?: string;

  @IsOptional()
  @IsIn(CONTRACT_RISK_RESPONSES)
  riskResponse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  riskResponseDescription?: string;

  // Manual only — never auto-calculated from riskEvaluation/riskResponse.
  @IsOptional()
  @IsIn(CONTRACT_RISK_LEVELS)
  residualRisk?: string;

  @IsOptional()
  @IsIn(CONTRACT_RISK_STATUSES)
  status?: string;

  @IsOptional()
  @IsUUID('4')
  responsibleUserId?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'actionDueDate must be in YYYY-MM-DD format' })
  actionDueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;
}
