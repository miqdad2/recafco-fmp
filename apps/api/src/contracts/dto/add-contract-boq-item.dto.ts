import { IsIn, IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

/** The units offered on New Contract Register (same list and meaning). */
export const ADD_BOQ_ITEM_UNITS = ['m²', 'm³', 'nos', 'lm'] as const;

/**
 * FMP-CONTRACT-11 — one new BOQ item for an existing contract. Same field rules
 * as New Contract Register: description, unit, Contract Qty, Unit Price; the
 * total is always calculated by the server.
 */
export class AddContractBoqItemDto {
  @IsString({ message: 'Please enter item description.' })
  @IsNotEmpty({ message: 'Please enter item description.' })
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  description!: string;

  @IsIn(ADD_BOQ_ITEM_UNITS, { message: 'Please select unit.' })
  unitOfMeasure!: string;

  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Please enter Contract Qty.' })
  @Min(0.001, { message: 'Contract Qty must be more than 0.' })
  contractQty!: number;

  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Please enter unit price.' })
  @Min(0, { message: 'Unit price must be 0 or more.' })
  unitPrice!: number;
}
