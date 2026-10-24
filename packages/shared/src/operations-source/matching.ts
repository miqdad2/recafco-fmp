// ---------------------------------------------------------------------------
// Contract <-> source project matching.
//
// Hard rules (from the business direction):
//  - A CONFIRMED link is by the source's stable project id only.
//  - AUTOMATIC linking needs: a unique match on normalized job order AND
//    factory/branch, with no conflicting existing link. A project NAME may
//    support a suggestion but can never trigger automatic linking.
//  - The same job-order number can exist in PC and HC, so a different factory
//    is never a match.
// ---------------------------------------------------------------------------

/**
 * Normalizes a job order for comparison only (the stored value is never
 * rewritten). Trims, upper-cases, treats "-", "\" and en/em dashes as "/",
 * removes spaces, strips an optional leading "JO" prefix (FMP writes
 * "JO-0050/26" where the source writes "50/26" — to be confirmed with the
 * source owner) and strips leading zeros from numeric segments.
 */
export function normalizeJobOrder(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let s = raw.normalize('NFKC').trim().toUpperCase();
  if (s === '') return null;
  s = s.replace(/[\s]+/g, '').replace(/[\\‐-―-]+/g, '/');
  s = s.replace(/^JO(?=[/\d])\/?/, '');
  const segments = s.split('/').filter((x) => x !== '');
  if (segments.length === 0) return null;
  const cleaned = segments.map((seg) => (/^\d+$/.test(seg) ? String(parseInt(seg, 10)) : seg));
  return cleaned.join('/');
}

export function normalizeFactoryCode(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.normalize('NFKC').trim().toUpperCase();
  return s === '' ? null : s;
}

export interface MatchContract {
  id: string;
  referenceNumber: string;
  title: string;
  counterpartyName: string;
  jobOrder: string | null;
  status: string;
  /** Factory code of the contract's plant, via the explicit factory mapping; null when unmapped or no plant. */
  factoryCode: string | null;
  /** Source project id this contract is already linked to (if any). */
  linkedSourceProjectId: string | null;
}

export interface MatchProject {
  sourceProjectId: string;
  jobOrderNormalized: string | null;
  factoryCode: string | null;
  sourceName: string | null;
  contractId: string | null;
}

export type MatchStrength = 'RELIABLE' | 'POSSIBLE';

export interface MatchCandidate {
  contractId: string;
  referenceNumber: string;
  title: string;
  strength: MatchStrength;
  /** Plain-language reasons shown to the user. */
  reasons: string[];
  /** Reasons this candidate cannot be linked automatically. Non-empty => needs review. */
  blockers: string[];
}

export type MatchState = 'LINKED' | 'AUTO_LINKABLE' | 'SUGGESTED' | 'CONFLICT' | 'AWAITING';

export interface MatchEvaluation {
  state: MatchState;
  candidates: MatchCandidate[];
  /** Set only when state === 'AUTO_LINKABLE'. */
  autoLinkContractId: string | null;
  summary: string;
}

const STOP_WORDS = new Set([
  'THE', 'AND', 'FOR', 'OF', 'NEW', 'PROJECT', 'CONTRACT', 'WORKS', 'CO', 'LTD', 'LLC', 'WLL', 'KSC', 'SUPPLY', 'FOR', 'AT', 'IN', 'TO',
]);

function significantTokens(s: string | null | undefined): Set<string> {
  if (!s) return new Set();
  const tokens = s
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

/** Share of the smaller token set that also appears in the other (0..1). */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const ta = significantTokens(a);
  const tb = significantTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.min(ta.size, tb.size);
}

/** Minimum overlap for a name-only suggestion. Suggestion only — never automatic. */
export const NAME_SUGGESTION_THRESHOLD = 0.6;
/** At least this many shared significant words, so one common word cannot suggest a match. */
export const NAME_SUGGESTION_MIN_SHARED_WORDS = 2;

function sharedWordCount(a: string | null | undefined, b: string | null | undefined): number {
  const ta = significantTokens(a);
  const tb = significantTokens(b);
  let n = 0;
  for (const t of ta) if (tb.has(t)) n += 1;
  return n;
}

/**
 * Evaluates one source project against the contract list.
 * `otherProjectsWithSameIdentity` = how many OTHER registered source projects
 * carry the same normalized job order + factory (ambiguity on the source side).
 */
export function evaluateProjectMatches(
  project: MatchProject,
  contracts: MatchContract[],
  otherProjectsWithSameIdentity = 0,
): MatchEvaluation {
  if (project.contractId !== null) {
    return { state: 'LINKED', candidates: [], autoLinkContractId: null, summary: 'Linked to a contract.' };
  }

  const candidates: MatchCandidate[] = [];

  for (const c of contracts) {
    if (c.status === 'CANCELLED') continue;
    const contractJo = normalizeJobOrder(c.jobOrder);
    const sameJobOrder = project.jobOrderNormalized !== null && contractJo !== null && contractJo === project.jobOrderNormalized;
    const reasons: string[] = [];
    const blockers: string[] = [];

    if (sameJobOrder) {
      reasons.push(`Job order ${project.jobOrderNormalized} matches.`);
      if (project.factoryCode === null) {
        blockers.push('The source has not reported a factory/branch.');
      } else if (c.factoryCode === null) {
        blockers.push(`The contract has no plant mapped to factory ${project.factoryCode}, so the factory could not be compared.`);
      } else if (c.factoryCode !== project.factoryCode) {
        // Same number, different factory: a different job. Not a candidate at all.
        continue;
      } else {
        reasons.push(`Factory ${project.factoryCode} matches.`);
      }
    } else {
      const similar = nameSimilarity(project.sourceName, c.title);
      const shared = sharedWordCount(project.sourceName, c.title);
      if (similar >= NAME_SUGGESTION_THRESHOLD && shared >= NAME_SUGGESTION_MIN_SHARED_WORDS) {
        reasons.push('The project name is similar to the contract title.');
        blockers.push('A name alone is not enough to link automatically.');
      } else {
        continue;
      }
    }

    if (c.linkedSourceProjectId !== null && c.linkedSourceProjectId !== project.sourceProjectId) {
      blockers.push('This contract is already linked to a different source project.');
    }

    candidates.push({
      contractId: c.id,
      referenceNumber: c.referenceNumber,
      title: c.title,
      strength: blockers.length === 0 ? 'RELIABLE' : 'POSSIBLE',
      reasons,
      blockers,
    });
  }

  if (candidates.length === 0) {
    return {
      state: 'AWAITING',
      candidates,
      autoLinkContractId: null,
      summary:
        project.jobOrderNormalized === null
          ? 'Waiting for the source to report this project’s job order.'
          : 'No contract matches yet.',
    };
  }

  const reliable = candidates.filter((c) => c.strength === 'RELIABLE');
  const jobOrderCandidates = candidates.filter((c) => c.reasons.some((r) => r.startsWith('Job order')));
  const linkedElsewhere = candidates.some((c) => c.blockers.some((b) => b.includes('already linked')));

  // Unique reliable match, nothing else competing on job order, and no ambiguity on the source side.
  if (reliable.length === 1 && jobOrderCandidates.length === 1 && otherProjectsWithSameIdentity === 0 && reliable[0]) {
    return {
      state: 'AUTO_LINKABLE',
      candidates,
      autoLinkContractId: reliable[0].contractId,
      summary: 'One contract matches on job order and factory.',
    };
  }

  if (linkedElsewhere || jobOrderCandidates.length > 1 || reliable.length > 1 || otherProjectsWithSameIdentity > 0) {
    return {
      state: 'CONFLICT',
      candidates,
      autoLinkContractId: null,
      summary: 'More than one possible match, or a contract is already linked elsewhere. A person must decide.',
    };
  }

  return {
    state: 'SUGGESTED',
    candidates,
    autoLinkContractId: null,
    summary: 'Possible match found; please confirm.',
  };
}
