import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const MAX_SEQ = 999_999;

type PrismaTx = Parameters<Parameters<ReturnType<DatabaseService['getClient']>['$transaction']>[0]>[0];

@Injectable()
export class ProductionRefService {
  constructor(private readonly db: DatabaseService) {}

  async nextRef(tx: PrismaTx, year: number): Promise<string> {
    const rows = await tx.$queryRaw<[{ last_seq: bigint }]>`
      INSERT INTO production_sequences (year, last_seq) VALUES (${year}, 1)
      ON CONFLICT (year) DO UPDATE SET last_seq = production_sequences.last_seq + 1
      RETURNING last_seq
    `;

    const seq = Number(rows[0]!.last_seq);

    if (seq > MAX_SEQ) {
      throw new UnprocessableEntityException({
        code: 'PRODUCTION_SEQUENCE_EXHAUSTED',
        message: `Production order sequence exhausted for year ${year}.`,
      });
    }

    return `PROD-${year}-${String(seq).padStart(6, '0')}`;
  }
}
