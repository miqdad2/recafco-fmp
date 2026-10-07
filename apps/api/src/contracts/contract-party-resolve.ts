import { UnprocessableEntityException } from '@nestjs/common';
import { ContractPartyType } from '@recafco/database';

// FMP-CONTRACT-01 — Contract Party resolution used by ContractsService.create().

export const DEFAULT_SECOND_PARTY_NAME = 'RECAFCO';

export interface ResolvedParty {
  id: string;
  name: string;
  contactNo: string | null;
}

interface PartyLookupClient {
  contractParty: {
    findUnique: (args: { where: { id: string } }) => Promise<(ResolvedParty & { partyType: ContractPartyType; isActive: boolean }) | null>;
    findFirst: (args: { where: { name: string; partyType: ContractPartyType; isActive: boolean } }) => Promise<ResolvedParty | null>;
  };
}

/**
 * Resolves the Customer (First Party) and Second Party chosen on a new
 * contract. Returns null when the caller sent no party ids (old-style create),
 * so existing callers behave exactly as before. A missing Second Party falls
 * back to the active default party RECAFCO.
 */
export async function resolveContractParties(
  tx: unknown,
  dto: { firstPartyId?: string | undefined; secondPartyId?: string | undefined },
): Promise<{ firstParty: ResolvedParty; secondParty: ResolvedParty } | null> {
  if (!dto.firstPartyId && !dto.secondPartyId) return null;
  const db = tx as PartyLookupClient;

  if (!dto.firstPartyId) {
    throw new UnprocessableEntityException({ code: 'CONTRACT_FIRST_PARTY_REQUIRED', message: 'Please select Customer (First Party).' });
  }
  const firstParty = await db.contractParty.findUnique({ where: { id: dto.firstPartyId } });
  if (!firstParty || firstParty.partyType !== ContractPartyType.FIRST_PARTY || !firstParty.isActive) {
    throw new UnprocessableEntityException({ code: 'CONTRACT_FIRST_PARTY_INVALID', message: 'Please select Customer (First Party).' });
  }

  let secondParty: ResolvedParty | null;
  if (dto.secondPartyId) {
    const found = await db.contractParty.findUnique({ where: { id: dto.secondPartyId } });
    secondParty = found && found.partyType === ContractPartyType.SECOND_PARTY && found.isActive ? found : null;
  } else {
    secondParty = await db.contractParty.findFirst({
      where: { name: DEFAULT_SECOND_PARTY_NAME, partyType: ContractPartyType.SECOND_PARTY, isActive: true },
    });
  }
  if (!secondParty) {
    throw new UnprocessableEntityException({ code: 'CONTRACT_SECOND_PARTY_INVALID', message: 'Please select Second Party.' });
  }
  return { firstParty, secondParty };
}
