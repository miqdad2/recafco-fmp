interface Props {
  children: React.ReactNode;
}

/**
 * CM-71H.7 — "Do not show the Step Guidance card [for staff-tier]... do not
 * reserve empty space." Manager-tier keeps the exact always-visible section
 * every guided step has shown since CM-71A; a staff-tier viewer simply never
 * renders this component at all (see each panel's own `{!isStaffTier && ...}`
 * call site) rather than getting a collapsed/empty version of it.
 */
export function ErectionStepGuidance({ children }: Props): React.JSX.Element {
  return (
    <section className="lg:col-span-2 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Step Guidance</h2>
      {children}
    </section>
  );
}
