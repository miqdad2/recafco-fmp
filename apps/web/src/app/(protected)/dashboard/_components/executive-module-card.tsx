import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { PlatformMetric } from '@/lib/platform-api';
import { ACCENT_PALETTE } from '../../_lib/module-accent';
import type { ModuleAccent } from '../../_lib/module-accent';

export type { ModuleAccent };

/**
 * FMP-UI-05 — brings module-specific button/accent color back (FMP-UI-04D
 * had removed it entirely after 3 rounds of "invisible button" reports),
 * but through literal hex values in inline `style`, never a CSS custom
 * property or Tailwind color utility. See this file's git history for the
 * full reasoning; the short version: `var(--color-module-*)` and the
 * Tailwind class both ultimately depend on the same custom property being
 * defined in whatever CSS the browser actually loaded — a literal hex in
 * `style` needs no CSS resolution of any kind, so it cannot fail the same
 * way. FMP-UI-06 reuses `light` for metric tiles too (previously icon-badge
 * only) — see that section's own note for why. FMP-UI-07 — the palette
 * itself moved to `_lib/module-accent.ts` so the new Executive Module
 * Landing Pages can reuse the exact same colors; this file just re-exports
 * `ModuleAccent` so existing imports of it from here keep working.
 */

interface ExecutiveModuleCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  metrics: PlatformMetric[];
  accent: ModuleAccent;
}

/**
 * FMP-UI-06 — card polish pass (weight/spacing only, mechanism unchanged
 * since FMP-UI-05: literal hex via inline `style`, `flex flex-col h-full` +
 * `flex-1` content + `mt-auto` button — nothing here can hide or clip the
 * button): left accent thinned 4px→3px at ~80% opacity; card border
 * softened to `border-border/60` + a subtle `hover:shadow-md`; metric
 * tiles moved off flat grey onto `palette.light`; padding/gaps tightened;
 * description moved to `text-text-muted`; button hover eased to
 * `brightness-95`.
 *
 * FMP-UI-06B — the FMP-UI-06 metric tiles (a *solid* `palette.light` fill)
 * still read as "color-blocked" per live feedback — 4 fully-saturated
 * pastel tiles side by side is busier than a premium dashboard wants. Diluted
 * further to ~56% opacity via the same alpha-hex-suffix trick already used
 * for the left border (`` `${palette.light}90` ``) so each tile reads as a
 * bare whisper of the module's color over the white card, not a distinct
 * colored block. Card border opacity also eased `/60` → `/50`, and a small
 * `mt-0.5` gap was added between the title and description for breathing
 * room ("better spacing between icon, title, and description").
 *
 * FMP-UI-07 (nav pass) — the whole card is now the clickable target, not
 * just the "Open {title}" button (senior-friendly: a bigger hit target is
 * easier for aged users than a small button at the bottom). The root element
 * became the `<Link>` itself; the button-looking element below is now a
 * plain `<span>` — HTML forbids a nested `<a>` inside an `<a>`, so there can
 * only be one real anchor per card. `group`/`group-hover:brightness-95` on
 * that span reproduces the exact same hover feedback the button alone used
 * to give, but now triggers from a hover anywhere on the card; the focus
 * ring moved from the (no-longer-focusable) span onto the outer `<Link>`
 * so keyboard users still get exactly one, clearly visible, focus stop per
 * card.
 *
 * FMP-UI-09B — every element inside the card grew a step (icon size-9→10,
 * title 18px→20px, description text-xs→text-sm, metric number 26px→28px,
 * tile/card padding and gaps all widened, button h-10→h-11, min-h-52→
 * min-h-64) so the card's own NATURAL content height grows to fill more of
 * the extra room a 1080p desktop leaves in a 4×2 grid — deliberately NOT
 * done by stretching the existing (smaller) content to fill a taller row
 * via `auto-rows-fr`, which would just relocate the "too much empty space"
 * complaint to a gap between the metrics and the button instead of fixing
 * it. The dashboard page (`../page.tsx`) separately centers the whole 2-row
 * grid within its own available height, so any leftover slack past this
 * card's own natural size becomes balanced top/bottom breathing room rather
 * than one lopsided gap at the bottom.
 *
 * FMP-UI-10C — two changes for the 10-card, 5-column grid:
 * 1. Every size from FMP-UI-09B eased back down one step (icon size-10→9,
 *    title 20px→18px, description text-sm→text-xs, metric number 28px→22px,
 *    tile/card padding and gaps all tightened again, button h-11→h-10,
 *    min-h-64→min-h-56) — 5 narrower columns need a more compact card than
 *    4 wider ones did; this is the mirror-image adjustment of FMP-UI-09B's
 *    own enlargement, not a return to the original FMP-UI-06 sizing.
 * 2. A module whose metrics are ALL `null` (QA/QC, Storage & Delivery — any
 *    module with no real backend yet) no longer renders 4 repeated "Not
 *    available" tiles. It renders one small honest status block instead,
 *    computed purely from the metrics array already passed in (`every(m =>
 *    m.value === null)`), no new prop, no backend flag, so this applies
 *    automatically to any future placeholder module too.
 *
 * FMP-UI-14 — executive polish pass (spacing/alignment/wording only, same
 * literal-hex-in-`style` mechanism throughout, same 5-column card sizing):
 * header row switched `items-center`→`items-start` (with the icon nudged
 * `mt-0.5`) so a 2-line wrapped title (e.g. "Quality Assurance & Control")
 * aligns with the icon's top edge instead of its own vertical midpoint —
 * the previous center alignment looked fine for 1-line titles but visibly
 * off-center once a title wrapped. Title `leading-snug`→`leading-tight` for
 * a cleaner 2-line look. Card border eased `/50`→`/60` (a touch clearer
 * without losing "soft"), resting `shadow-sm` kept but hover upgraded
 * `hover:shadow-md`→`hover:shadow-lg` for a more noticeable premium lift.
 * Metric tiles: alpha suffix eased `90`→`80` (a shade lighter, "less
 * blocky") and corner radius `rounded-lg`→`rounded-xl`; the label row
 * switched `items-center`→`items-start` (dot nudged `mt-1`) so a label that
 * wraps to 2 words-per-line doesn't look vertically mis-centered against
 * its bullet dot. Placeholder block reworded from "Status: Coming next" /
 * "Data: Not configured yet" to a small uppercase "Module Status" label
 * over a bold "Configuration Pending" value (superseded again in FMP-UI-15
 * below — see that note for the current wording).
 *
 * FMP-UI-15 — "Factory Operations Control Center" polish pass:
 * 1. New status badge in the header (top-right, `Live`/`Setup Pending`,
 *    same `isPlaceholder` detection this component already computed —
 *    no new prop) using this app's existing semantic status tokens
 *    (`bg-success-light`/`text-success` for Live, a neutral
 *    `bg-surface-secondary`/`border-border` pill for Setup Pending) rather
 *    than the module's own literal-hex accent — a status badge is a
 *    platform-wide concept, not a module-specific color, so it belongs on
 *    the shared token system every other status chip in this app already
 *    uses.
 * 2. Placeholder block reworded again, per this unit's own exact spec:
 *    "Configuration Pending" → "Setup Pending" (bold headline) plus
 *    "Module will be configured in a future unit." (a plain explanatory
 *    line, not a second label/value pair) — the badge and this panel now
 *    intentionally share the words "Setup Pending" so the card reads as
 *    one consistent state, not two different half-finished-sounding ones.
 * 3. Metric tiles diluted one shade further (`80`→`70` alpha) and their
 *    gap widened (`gap-2`→`gap-2.5`) for a less "blocked-in" look. Card
 *    border gained `transition-colors hover:border-border` (full opacity
 *    on hover, still `/60` at rest) as a small refined hover cue. The
 *    button gained its own resting `shadow-sm` plus `group-hover:shadow-md`
 *    (was hover-brightness only) for a slightly more premium lift,
 *    matching the shadow-on-hover language already used on the login
 *    page's own submit button.
 */
export function ExecutiveModuleCard({
  title,
  description,
  href,
  icon: Icon,
  metrics,
  accent,
}: ExecutiveModuleCardProps): React.JSX.Element {
  const palette = ACCENT_PALETTE[accent];
  const isPlaceholder = metrics.every((m) => m.value === null);

  return (
    <Link
      href={href}
      className="group flex h-full min-h-56 flex-col rounded-xl border border-border/60 bg-surface p-3.5 shadow-sm transition-[box-shadow,border-color] hover:border-border hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
      style={{ borderLeftWidth: '3px', borderLeftColor: `${palette.base}cc` }}
    >
      {/* Content — header + metrics, flex-1 so the button wrapper below is always pushed to the bottom. */}
      <div className="flex-1">
        {/* Header — items-start (not items-center) so the icon aligns with
            the title's top line rather than its vertical midpoint once the
            title wraps to 2 lines. A status badge sits top-right, on the
            same row, so it reads at a glance without competing with the
            title for space. */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: palette.light, color: palette.base }}
            >
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[18px] font-bold leading-tight text-text-primary">{title}</h2>
              <p className="mt-1 text-xs leading-snug text-text-muted">{description}</p>
            </div>
          </div>
          {isPlaceholder ? (
            <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-surface-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              Setup Pending
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full bg-success-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
              Live
            </span>
          )}
        </div>

        {isPlaceholder ? (
          <div className="mt-2.5 rounded-xl px-3 py-2.5" style={{ backgroundColor: `${palette.light}80` }}>
            <p className="text-sm font-bold text-text-primary">Setup Pending</p>
            <p className="mt-0.5 text-xs text-text-muted">Module will be configured in a future unit.</p>
          </div>
        ) : (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-xl px-2.5 py-2" style={{ backgroundColor: `${palette.light}70` }}>
                {m.value !== null ? (
                  <p className="text-[22px] font-extrabold leading-none text-text-primary">{m.value}</p>
                ) : (
                  <p className="text-xs font-medium leading-none text-text-muted">Not available</p>
                )}
                <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold leading-snug text-text-secondary">
                  <span className="mt-1 inline-block size-1.5 shrink-0 rounded-full" style={{ backgroundColor: palette.base }} aria-hidden="true" />
                  <span>{m.label}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Button-look wrapper — mt-auto anchors it to the card's bottom. Module-
          colored via literal hex in style (never a CSS variable/Tailwind
          color class — see this file's own doc comment). A `<span>`, not a
          `<Link>` — the whole card above is now the one real anchor (FMP-UI-07);
          `group-hover` reproduces the old hover feedback from anywhere on
          the card, not just this element. */}
      <div className="mt-auto pt-2.5">
        {/* min-h, not h — "Open Quality Assurance & Control"/"Open Storage
            Yard & Delivery" are long enough to wrap to 2 lines on a narrow
            5-column card; a fixed height would clip that text. A wrapped
            button just makes its own row a little taller, and the grid's
            default row-stretch (see dashboard/page.tsx) keeps every other
            card in that same row matching it — still equal heights across
            the row, never a clipped label. */}
        <span
          style={{ backgroundColor: palette.base }}
          className="flex min-h-10 w-full items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-semibold leading-snug text-white shadow-sm transition group-hover:shadow-md group-hover:brightness-95"
        >
          Open {title}
        </span>
      </div>
    </Link>
  );
}
