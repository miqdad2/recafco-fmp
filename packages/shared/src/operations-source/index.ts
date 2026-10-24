export * from './types';
export { parseProgressReport, MAX_CLOCK_SKEW_MS } from './report-validator';
export { canonicalContentOf, decidePublication, diffTotals, evaluateFlags } from './change-rules';
export {
  normalizeJobOrder,
  normalizeFactoryCode,
  nameSimilarity,
  evaluateProjectMatches,
  NAME_SUGGESTION_THRESHOLD,
  NAME_SUGGESTION_MIN_SHARED_WORDS,
} from './matching';
export type { MatchContract, MatchProject, MatchCandidate, MatchEvaluation, MatchState, MatchStrength } from './matching';
export * from './extended';
