import { IsOptional, IsIn } from 'class-validator';

/** Close/Settle is one dedicated action — target status defaults to CLOSED, but SETTLED is equally valid ("settle" is just a labeled close). */
export const CONTRACT_CLAIM_CLOSE_STATUSES = ['CLOSED', 'SETTLED'] as const;

export class CloseContractClaimDto {
  @IsOptional()
  @IsIn(CONTRACT_CLAIM_CLOSE_STATUSES)
  status?: string;
}
