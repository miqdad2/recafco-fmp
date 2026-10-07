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
 *
 * FMP-UI-23B — every size eased down one more notch so 11 cards (3 rows of
 * 4/4/3) fit a normal 1920×1080 desktop viewport without the page scrolling
 * vertically: card floor `min-h-56`→`min-h-48`, padding `p-3.5`→`p-3`, icon
 * `size-9`→`size-8` (glyph `size-4.5`→`size-4`), title `18px`→`15px`,
 * description `text-xs`→`11px`, metric-tile padding/gap tightened
 * (`px-2.5 py-2`→`px-2 py-1.5`, `gap-2.5`→`gap-2`), metric number
 * `22px`→`17px`, metric label `text-xs`→`11px`, placeholder block padding
 * `px-3 py-2.5`→`px-2.5 py-2` with its own text sized down to match, button
 * `min-h-10`→`min-h-9`/`py-2`→`py-1.5`/`text-sm`→`13px`. The placeholder
 * block (Setup Pending) was deliberately kept noticeably SHORTER than the
 * 2-row metrics grid, not just re-scaled proportionally — a placeholder
 * card sharing a grid row with a live metrics card must never be the taller
 * one, or the grid's row-stretch would force the live card up to match it,
 * undoing the whole point of this pass. No mechanism changed (still literal
 * hex via inline `style`, still `flex flex-col h-full` + `flex-1` + `mt-auto`
 * button, still nothing that can clip the button) — purely a size pass, the
 * same category of change as FMP-UI-10C's own "narrower grid, smaller card"
 * easing.
 *
 * FMP-UI-24 — standardized card: every card is now the SAME structure and
 * the SAME height, live or setup-pending. This supersedes two earlier
 * decisions in this history:
 * - FMP-UI-23B kept the placeholder block deliberately SHORTER than the
 *   metric grid. It now fills exactly the same content zone instead, so a
 *   setup-pending card no longer looks smaller/emptier than a live one.
 * - The card relied on per-row stretch only. The grid (dashboard/page.tsx)
 *   now uses `auto-rows-fr`, so all rows — not just cards within a row —
 *   share one height.
 * Three fixed zones, top to bottom:
 * 1. Header — icon + title (max 2 lines) left, status badge right (a
 *    container query re-flows this for narrow 2-per-row tablet cards — see
 *    the inline note), then the
 *    subtitle on its own full-width line with 2 lines of height RESERVED
 *    (`min-h` + `line-clamp-2`), so the content zone starts at the same
 *    offset on every card whether the subtitle is 1 line or 2.
 * 2. Content — `flex-1`, so it absorbs any extra row height itself (the
 *    metric tiles / pending block grow; no gap opens above the button, the
 *    failure mode FMP-UI-09B warned about). Live: 2x2 grid with
 *    `auto-rows-fr` (4 equal tiles). Pending: one block with the same
 *    minimum height as that grid.
 * 3. Button — fixed `h-9`, single line (`truncate` as a safety net), so
 *    every button is the same height at the same vertical position.
 * Style: full module-colored border (was a 3px left accent on a grey
 * border), `rounded-2xl`, `p-3.5`. Tints are now derived from the module's
 * BASE color at low alpha (`${base}12`) rather than the palette's fixed
 * `light` pastel, so tiles read correctly on both the light and the dark
 * card surface. Still literal hex via inline `style` only (see the top of
 * this comment for why).
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
  // Module tint that works on both the light and the dark card surface.
  const tint = `${palette.base}12`;

  return (
    <Link
      href={href}
      className="group @container flex h-full min-h-64 flex-col rounded-2xl border-[1.5px] bg-surface p-3.5 shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
      style={{ borderColor: `${palette.base}8c` }}
    >
      {/* 1. Header zone — identical height on every card. Normally one row:
          icon, title (flex-1, max 2 lines), badge. In a NARROW card (content
          box under 15.5rem — the 2-per-row tablet layout) a long title can't
          fit between the icon and the "Setup Pending" badge, so via a
          container query the title drops to its own full-width row and the
          badge moves up beside the icon. Every card in the grid shares one
          column width, so they all switch together and stay identical. */}
      <div className="flex min-h-10 flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span
          className="order-1 flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: palette.light, color: palette.base }}
        >
          <Icon className="size-[1.125rem]" aria-hidden="true" />
        </span>
        <h2 className="order-2 line-clamp-2 min-w-0 flex-1 text-[15px] font-bold leading-tight text-text-primary @max-[15.5rem]:order-3 @max-[15.5rem]:basis-full">
          {title}
        </h2>
        <span
          className={`order-3 inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase leading-4 tracking-wide @max-[15.5rem]:order-2 @max-[15.5rem]:ml-auto ${
            isPlaceholder ? 'border-border bg-surface-secondary text-text-secondary' : 'border-transparent bg-success-light text-success'
          }`}
        >
          {isPlaceholder ? 'Setup Pending' : 'Live'}
        </span>
      </div>
      {/* Two lines always reserved, so the content zone starts at the same offset on every card. */}
      <p className="mt-1.5 line-clamp-2 min-h-8 text-xs leading-4 text-text-secondary" title={description}>
        {description}
      </p>

      {/* 2. Content zone — flex-1: it (not a gap above the button) absorbs any extra height. */}
      <div className="mt-2.5 flex flex-1 flex-col">
        {isPlaceholder ? (
          <div
            className="flex min-h-26 flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-3 py-2 text-center"
            style={{ backgroundColor: tint, borderColor: `${palette.base}40` }}
          >
            <p className="text-sm font-bold text-text-primary">Setup Pending</p>
            <p className="mt-1 text-xs leading-snug text-text-secondary">Module will be configured in a future unit.</p>
          </div>
        ) : (
          <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-2">
            {metrics.map((m) => (
              <div key={m.label} className="flex min-h-12 flex-col justify-center rounded-xl px-2.5 py-1.5" style={{ backgroundColor: tint }}>
                {m.value !== null ? (
                  <p className="text-xl font-extrabold tabular-nums leading-none text-text-primary">{m.value}</p>
                ) : (
                  <p className="text-xs font-medium leading-[1.125rem] text-text-secondary">Not available</p>
                )}
                <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold leading-tight text-text-secondary">
                  <span className="mt-[0.1875rem] inline-block size-1.5 shrink-0 rounded-full" style={{ backgroundColor: palette.base }} aria-hidden="true" />
                  <span>{m.label}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Button zone — fixed height, always at the card's bottom edge. A
          `<span>`, not a `<Link>`: the whole card is the one real anchor
          (FMP-UI-07); `group-hover` gives hover feedback from anywhere on it. */}
      <span
        style={{ backgroundColor: palette.base }}
        className="mt-2.5 flex h-9 w-full shrink-0 items-center justify-center rounded-xl px-3 text-[13px] font-semibold text-white shadow-sm transition group-hover:shadow-md group-hover:brightness-95 @max-[15.5rem]:px-2 @max-[15.5rem]:text-xs"
      >
        <span className="truncate">Open {title}</span>
      </span>
    </Link>
  );
}
