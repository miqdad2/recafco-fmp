import { IsString, IsOptional, MaxLength, IsNumber, Min, IsIn, Matches } from 'class-validator';
import { CONTRACT_PAYMENT_STATUSES } from './create-contract-payment.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateContractPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'invoiceDate must be in YYYY-MM-DD format' })
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentTerm?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  submittedAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  certifiedAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'dueDate must be in YYYY-MM-DD format' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'paidDate must be in YYYY-MM-DD format' })
  paidDate?: string;

  @IsOptional()
  @IsIn(CONTRACT_PAYMENT_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  remarks?: string;
}
