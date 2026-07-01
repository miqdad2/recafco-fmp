import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const MAX_SEQ = 999_999;

type PrismaTx = Parameters<Parameters<ReturnType<DatabaseService['getClient']>['$transaction']>[0]>[0];

@Injectable()
export class SafetyRefService {
  constructor(private readonly db: DatabaseService) {}

  async nextRef(tx: PrismaTx, year: number): Promise<string> {
    const rows = await tx.$queryRaw<[{ last_seq: bigint }]>`
      INSERT INTO safety_inspection_sequences (year, last_seq)
      VALUES (${year}, 1)
      ON CONFLICT (year)
      DO UPDATE SET last_seq = safety_inspection_sequences.last_seq + 1
      RETURNING last_seq
    `;

    const seq = Number(rows[0].last_seq);

    if (seq > MAX_SEQ) {
      throw new UnprocessableEntityException({
        code: 'SAFETY_SEQUENCE_EXHAUSTED',
        message: `Safety inspection sequence exhausted for year ${year}.`,
      });
    }

    return `SAFE-${year}-${String(seq).padStart(6, '0')}`;
  }
}
