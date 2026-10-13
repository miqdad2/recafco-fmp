import { Gauge } from 'lucide-react';

/**
 * FMP-UI-36 — the RECAFCO Factory Performance Dashboard runs as a fully
 * separate application (http://192.168.1.17:83), not a module inside this
 * platform — there is no API, permission, or route to wire this card to, and
 * this unit explicitly says not to invent one. This card is therefore a pure
 * navigation tile, deliberately NOT built on `ExecutiveModuleCard` (which is
 * driven by `PlatformModuleCard` data from `platformApi.dashboard()` and
 * navigates in-app via `next/link`): reusing it here would mean teaching a
 * permission-driven, same-tab-navigation component about a permission-less,
 * new-tab external link it was never designed for. Visual structure
 * (header zone / 2x2 metric grid / fixed-height button) deliberately mirrors
 * `ExecutiveModuleCard` so it reads as "one of the cards," per this unit's
 * own "match the existing module cards" requirement — only the anchor
 * behavior and color differ.
 *
 * Color is a one-off literal navy (`#0b2545`), not added to the shared
 * `ACCENT_PALETTE` in `_lib/module-accent.ts`: that palette is keyed by
 * `ModuleAccent`/`PlatformModuleCode`, both closed unions describing real,
 * permission-gated platform modules — this card is neither, so extending
 * those types for a one-off external link would be the wrong home for the
 * color rather than a genuine reuse.
 */
const FACTORY_PERFORMANCE_URL = 'http://192.168.1.17:83';
const PERFORMANCE_BASE = '#0b2545';
const PERFORMANCE_LIGHT = '#eaf1fb';

// Labels only, per this unit's own requirement list — no invented figures.
// "Do not show fake live API data" rules out a plausible-looking number next
// to each one, so the tile shows what the figure IS, not a demo value that
// could be mistaken for a real one; the caption below the grid states the
// real data's home explicitly.
const METRIC_LABELS = ['Current Orders', 'Production Orders', 'Concrete Output', 'Delivered Output'];

export function FactoryPerformanceCard(): React.JSX.Element {
  return (
    <a
      href={FACTORY_PERFORMANCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group @container flex h-full min-h-64 flex-col rounded-2xl border-[1.5px] bg-surface p-3.5 shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
      style={{ borderColor: `${PERFORMANCE_BASE}8c` }}
    >
      <div className="flex min-h-10 flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span
          className="order-1 flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: PERFORMANCE_LIGHT, color: PERFORMANCE_BASE }}
        >
          <Gauge className="size-[1.125rem]" aria-hidden="true" />
        </span>
        <h2 className="order-2 line-clamp-2 min-w-0 flex-1 text-[15px] font-bold leading-tight text-text-primary @max-[15.5rem]:order-3 @max-[15.5rem]:basis-full">
          Factory Performance
        </h2>
        <span className="order-3 inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-transparent bg-success-light px-2 py-0.5 text-[11px] font-semibold uppercase leading-4 tracking-wide text-success @max-[15.5rem]:order-2 @max-[15.5rem]:ml-auto">
          Live
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 min-h-8 text-xs leading-4 text-text-secondary" title="Live production, delivery, concrete output, and plant capacity.">
        Live production, delivery, concrete output, and plant capacity.
      </p>

      <div className="mt-2.5 flex flex-1 flex-col">
        <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-2">
          {METRIC_LABELS.map((label) => (
            <div key={label} className="flex min-h-12 flex-col justify-center rounded-xl px-2.5 py-1.5" style={{ backgroundColor: `${PERFORMANCE_BASE}12` }}>
              <p className="flex items-start gap-1.5 text-xs font-semibold leading-tight text-text-secondary">
                <span className="mt-[0.1875rem] inline-block size-1.5 shrink-0 rounded-full" style={{ backgroundColor: PERFORMANCE_BASE }} aria-hidden="true" />
                <span>{label}</span>
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-text-muted">Live figures are on the Factory Performance Dashboard — not SAP-connected here.</p>
      </div>

      <span
        style={{ backgroundColor: PERFORMANCE_BASE }}
        className="mt-2.5 flex h-9 w-full shrink-0 items-center justify-center rounded-xl px-3 text-[13px] font-semibold text-white shadow-sm transition group-hover:shadow-md group-hover:brightness-95 @max-[15.5rem]:px-2 @max-[15.5rem]:text-xs"
      >
        <span className="truncate">Open Factory Performance</span>
      </span>
    </a>
  );
}
