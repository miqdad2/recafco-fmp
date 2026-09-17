import { IsString, IsOptional, MaxLength, IsBoolean, IsIn, Matches } from 'class-validator';
import {
  CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_STATUSES,
  CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_DECISIONS,
  CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_PRIORITIES,
} from './create-contract-erection-method-statement-approval.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractErectionMethodStatementApprovalDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'reviewRequiredBy must be in YYYY-MM-DD format' })
  reviewRequiredBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  reviewingEngineer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  reviewType?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_STATUSES)
  reviewStatus?: string;

  @IsOptional()
  @IsIn(CONTRACT_ERECTION_METHOD_STATEMENT_APPROVAL_DECISIONS)
  decision?: string;

  @IsOptional()
  @IsBoolean()
  requiresClientApproval?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  comments?: string;
}
