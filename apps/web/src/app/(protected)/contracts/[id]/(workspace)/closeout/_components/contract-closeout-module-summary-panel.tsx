interface Props {
  openClaims: number;
  closedOrSettledClaims: number;
  approvedVariations: number;
  pendingVariations: number;
  openRisks: number;
  mitigatedOrClosedRisks: number;
  openIssues: number;
  closedOrResolvedIssues: number;
}

function Stat({ label, value, valueClassName }: { label: string; value: number; valueClassName: string }): React.JSX.Element {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold leading-none ${valueClassName}`}>{value}</p>
      <p className="text-[11px] text-text-muted mt-1.5">{label}</p>
    </div>
  );
}

/**
 * CM-67 — Claims / Risks / Issues Summary. Every count is a real value
 * already returned by each module's own contract-scoped summary
 * (ContractClaimSummary/ContractIssueSummary from the module's real
 * summary fields) or a safe client-side count over the already-fetched,
 * unpaginated real items list (risks/variations, whose summaries don't
 * expose a closed/pending breakdown — see countRisksByBucket()/
 * countVariationsByBucket()). "Mitigated / Closed Risks" deliberately
 * drops "Accepted" from this unit's own suggested label — ACCEPT is a real
 * riskResponse value, not a risk STATUS, so folding it in here would be
 * dishonest; only real MITIGATED + CLOSED statuses are counted.
 * CM-67B — moved into the left column of the final-approval grid row;
 * internal grid capped at 4 columns (was up to 8) since this card is now
 * half-width — wraps into 2 rows of 4 instead of straining 8 across.
 */
export function ContractCloseoutModuleSummaryPanel({
  openClaims,
  closedOrSettledClaims,
  approvedVariations,
  pendingVariations,
  openRisks,
  mitigatedOrClosedRisks,
  openIssues,
  closedOrResolvedIssues,
}: Props): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-4">
      <h2 className="text-sm font-semibold text-text-primary mb-3">Claims / Risks / Issues Summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Open Claims" value={openClaims} valueClassName="text-warning" />
        <Stat label="Closed / Settled Claims" value={closedOrSettledClaims} valueClassName="text-success" />
        <Stat label="Approved Variations" value={approvedVariations} valueClassName="text-success" />
        <Stat label="Pending Variations" value={pendingVariations} valueClassName="text-warning" />
        <Stat label="Open Risks" value={openRisks} valueClassName="text-warning" />
        <Stat label="Mitigated / Closed Risks" value={mitigatedOrClosedRisks} valueClassName="text-success" />
        <Stat label="Open Issues" value={openIssues} valueClassName="text-warning" />
        <Stat label="Closed / Resolved Issues" value={closedOrResolvedIssues} valueClassName="text-success" />
      </div>
    </section>
  );
}
