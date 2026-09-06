import { PieChart } from 'lucide-react';

export interface DonutSegmentInput {
  key: string;
  label: string;
  count: number;
}

interface Props {
  title: string;
  segments: DonutSegmentInput[];
  emptyMessage?: string;
}

// CM-54 — reusable SVG donut + legend, no chart library (none in this repo).
// Used for both "Contracts by Status" and "Claims Status Overview". Colors
// cycle through the existing semantic tokens (ui-tokens.md) via CSS
// variables — never a raw hardcoded hex.
// CM-54C — visual-only polish: header spacing, roomier legend rows, and a
// clearer icon+message empty state (was plain muted text). Same segment
// math/order/colors, no calculation change.
// CM-54D — header spacing tightened a notch and the donut/legend gap
// trimmed for a more compact, balanced card; empty state kept centered
// with its icon, message text unchanged. Same segment math/order/colors.
const PALETTE = [
  'var(--color-info)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-error)',
  'var(--color-team-production)', 'var(--color-accent)', 'var(--color-secondary-accent)', 'var(--color-text-muted)',
];

const SIZE = 160;
const STROKE_WIDTH = 22;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ title, segments, emptyMessage = 'No data in scope.' }: Props): React.JSX.Element {
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  let cumulativeLength = 0;
  const arcs = segments
    .filter((s) => s.count > 0)
    .map((seg, i) => {
      const fraction = total > 0 ? seg.count / total : 0;
      const length = fraction * CIRCUMFERENCE;
      const arc = {
        ...seg,
        color: PALETTE[i % PALETTE.length]!,
        dashArray: `${length} ${CIRCUMFERENCE - length}`,
        dashOffset: -cumulativeLength,
        percent: Math.round(fraction * 100),
      };
      cumulativeLength += length;
      return arc;
    });

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-primary mb-4">{title}</h2>
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-7 text-center">
          <span className="inline-flex items-center justify-center size-10 rounded-full bg-surface-secondary text-text-muted">
            <PieChart className="size-5" aria-hidden="true" />
          </span>
          <p className="text-xs text-text-muted max-w-55">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex items-center gap-5 flex-wrap">
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" role="img" aria-label={title}>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-surface-secondary)" strokeWidth={STROKE_WIDTH} />
              {arcs.map((a) => (
                <circle
                  key={a.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={a.dashArray}
                  strokeDashoffset={a.dashOffset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-text-primary tabular-nums">{total}</span>
              <span className="text-[10px] text-text-muted">Total</span>
            </div>
          </div>
          <ul className="flex-1 min-w-40 space-y-2">
            {arcs.map((a) => (
              <li key={a.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 text-text-secondary">
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} aria-hidden="true" />
                  {a.label}
                </span>
                <span className="font-medium text-text-primary tabular-nums whitespace-nowrap">{a.count} ({a.percent}%)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
