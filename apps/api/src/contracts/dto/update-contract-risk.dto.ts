import { IsString, IsOptional, MaxLength, IsIn, IsUUID, Matches } from 'class-validator';
import { CONTRACT_RISK_LEVELS, CONTRACT_RISK_RESPONSES, CONTRACT_RISK_STATUSES } from './create-contract-risk.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractRiskDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  riskNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

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
