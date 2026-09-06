import type { TeamProgress } from '../_lib/contract-overview-helpers';

const SIZE = 88;
const CENTER = SIZE / 2;
const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface RingProps {
  percent: number;
  colorClassName: string;
  label: string;
}

/** Plain inline SVG ring — no chart library dependency, matches the approved design's circular progress indicators. */
function ProgressRing({ percent, colorClassName, label }: RingProps): React.JSX.Element {
  const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth="8" className="stroke-surface-secondary" />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          className={colorClassName}
        />
        <text x={CENTER} y={CENTER + 5} textAnchor="middle" className="fill-text-primary text-base font-extrabold">
          {percent}%
        </text>
      </svg>
      <span className="text-xs font-medium text-text-secondary text-center leading-tight">{label}</span>
    </div>
  );
}

interface Props {
  technical: TeamProgress;
  production: TeamProgress;
  erection: TeamProgress;
  overall: TeamProgress;
}

/**
 * CM-57 — Contract Detail Overview, Section 2 "Progress Summary". Every
 * percentage is a real completed/total workflow-task ratio for that team
 * (contractsApi.getWorkflow()), computed by contract-overview-helpers.ts.
 * A contract with no workflow tasks generated yet shows 0% on all four
 * rings — never a fabricated number. Deliberately does not use the word
 * "Physical" anywhere (the approved screenshot's "Overall Physical
 * Progress" is relabeled "Overall Progress").
 */
export function ContractOverviewProgressCard({ technical, production, erection, overall }: Props): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-sm p-5 h-full">
      <h2 className="text-sm font-semibold text-text-primary mb-4 pb-3 border-b border-border">Progress Summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ProgressRing percent={technical.percent} colorClassName="stroke-info" label="Technical Progress" />
        <ProgressRing percent={production.percent} colorClassName="stroke-success" label="Production Progress" />
        <ProgressRing percent={erection.percent} colorClassName="stroke-accent" label="Erection Progress" />
        <ProgressRing percent={overall.percent} colorClassName="stroke-text-primary" label="Overall Progress" />
      </div>
    </section>
  );
}
