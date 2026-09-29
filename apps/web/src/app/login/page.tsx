import type { Metadata } from 'next';
import { ShieldUser } from 'lucide-react';
import { loginAction } from './actions';
import { LoginForm } from './_components/login-form';
import { ThemeToggle } from '../_components/theme-toggle';

export const metadata: Metadata = { title: 'Sign in — RECAFCO FMP' };

const MODULE_TAGS = ['Contracts', 'Technical', 'Erection', 'Quality Control', 'Storage Yard', 'Safety', 'Maintenance', 'Tasks'];

// FMP-UI-08B through FMP-UI-13 — this page was a single centered column
// (logo/title/card/footer stacked, no side panel) for a long stretch of
// this project's history, after an earlier split-screen version (FMP-UI-08)
// was replaced for reading "too close to a generic enterprise login."
//
// FMP-UI-17B — deliberately reverses that decision, on the user's own
// explicit instruction after reviewing a split-screen reference: back to a
// left/right split on desktop, but built from scratch for THIS platform
// rather than reusing that reference's own visual style (no mountain
// image, no HRMS copy, no stock people photo — every decorative element on
// the left panel below is plain CSS: gradients, `repeating-linear-gradient`
// hatching, and blurred color blobs, exactly the same "no images" technique
// this login page has used for its background since FMP-UI-08C).
//
// Structure: a `lg:grid lg:grid-cols-[5fr_6fr]` (~45/55) two-column split at
// desktop; below `lg`, the grid never activates, the left panel is simply
// `hidden`, and the right panel (already `min-h-screen`) becomes the only
// visible child — a single centered column again, same as before this
// unit, with a compact mobile-only branding block standing in for the
// hidden left panel's logo/title. None of this touches `LoginForm`,
// `loginAction`, cookies, the welcome-screen redirect, or theme storage —
// `ThemeToggle` is the exact same component, just repositioned to the
// right panel's own top-right corner instead of the whole page's.
//
// FMP-UI-17C — final polish pass on the same split-screen, all still plain
// CSS (no images added): the 45° blueprint hatch became a proper X
// cross-hatch (a real engineering/technical-drawing convention for
// indicating a material in section — reads as deliberate "engineering
// drawing," not a generic diagonal pattern); 2 small corner
// registration/crop-mark brackets were added (another genuine blueprint
// annotation motif) so the panel reads as "placed accents," not texture
// alone; the title now wraps intentionally onto 2 lines ("RECAFCO Factory"
// / "Management Platform") at a larger size; the logo chip and its
// spacing above the title both grew a step; module tags got "QA/QC" (was
// the bare word "Quality," which this unit's own spec explicitly asked to
// avoid), larger/roomier padding, and a hover treatment. The login card's
// icon+heading+subtitle now sit in one connected flex row instead of
// stacked, and its shadow deepened one step. `ThemeToggle` is unchanged as
// a component — only its own wrapper here shrank/softened it
// (`scale-90`, reduced resting opacity) so it reads as a minor utility
// control instead of competing visually with the card below it.
//
// FMP-UI-18 — the user supplied a real RECAFCO product photo ("Desktop
// Lock Image.jpeg" — the actual precast yard at night, with the real
// RECAFCO signage/50-years display, not a stock/generic image) and asked
// for it as this page's background, full-screen, with an opacity
// treatment. Resized/compressed via `sharp` (the original was 8533×4800,
// ~33MB — far too large to ship as-is) into 2 derived assets:
// `public/login-hero.jpg` (2400px wide) and `public/login-hero-mobile.jpg`
// (1000px wide) — both committed alongside the page, not generated at
// request time.
//
// FMP-UI-18B — the photo initially only covered the left panel (FMP-UI-18);
// per direct user feedback ("add background image for the entire screen
// not for just one side"), it now covers the WHOLE page — a single
// `fixed inset-0` photo+overlay layer sits behind BOTH panels (z-0), with
// the left panel's content and the right panel's card/footer/toggle all
// promoted to `relative z-10` so they paint on top of it. The right
// panel's own `bg-background` was removed so the photo shows through the
// space around the card there too; the card itself stays fully opaque
// (`bg-surface`, unchanged) so the actual form never loses contrast. Two
// `<img>`s (`hidden lg:block` / `lg:hidden`) swap in the desktop vs.
// mobile-sized asset so phones don't download the larger file. The
// mobile-only compact branding block lost its OWN separate photo band
// (redundant now that the shared layer already covers that area) and
// became plain white-text content directly over the shared background,
// same as the desktop left panel's content always was. Footer text
// switched from the page's own secondary/muted tokens to light/white
// variants, since it now sits directly over the photo+overlay instead of
// the page's plain surface color. The CSS-only cross-hatch/panel-geometry
// layers from FMP-UI-17C remain removed (as of FMP-UI-18) — the 2 corner
// registration marks and the 1 red brand glow are kept, still scoped to
// the left panel only. A navy gradient overlay (the same
// `--color-nav`/`-hover`/`-active` RGBs the very first solid wash used,
// at high-but-not-total alpha) sits between the photo and every text
// element on the page — this overlay is the "with opacity" treatment: a
// raw dimmed photo with no color tint would fight white text's contrast
// far more than a photo dimmed by a consistent brand-colored wash.
//
// FMP-UI-18D — a design-review pass on a screenshot of the FMP-UI-18B/18C
// result flagged 3 things: the card read as a flat sticker pasted over the
// photo rather than integrated with it; the footer's contrast depended on
// whichever part of the busy photo happened to sit behind it; and the 8
// module tags reflowed unpredictably (7 tags on one row, "Tasks" stranded
// alone on the next). Fixed all 3, each independently: the card's
// `bg-surface` became `bg-surface/90 backdrop-blur-xl` (a frosted-glass
// look — blur does most of the blending work, 90% opacity keeps the form
// itself just as readable as before); the footer gained a small
// `bg-black/25 backdrop-blur-sm` backing so its contrast is guaranteed
// regardless of what's behind it; the tags now render as 2 explicit rows
// of 4 (sliced from `MODULE_TAGS`) instead of one `flex-wrap` row left to
// reflow wherever the browser happens to break it.
//
// FMP-UI-17D — final polish pass, all still on the same photo+split-screen
// direction (kept per this unit's own explicit constraint):
// 1. Re-cropped BOTH hero images (via `sharp`, same one-time script
//    technique as FMP-UI-18) to drop the bottom ~15% of the source photo —
//    that region contained a "www.recafco.com" watermark baked into the
//    photo itself (not a text element this page ever rendered), which this
//    unit's own spec asked to remove; cropping the source was the only way
//    to guarantee it's gone regardless of viewport/crop position, rather
//    than hoping `object-position` always scrolls it out of view.
// 2. Overlay: added a SECOND gradient layer (`90deg`, transparent on the
//    left through ~40%, then ramping to a strong flat navy on the right)
//    stacked on top of the original diagonal wash — the diagonal alone
//    actually left the RIGHT side (where the card sits) with the FEWEST
//    darkening, all the busy midtone photo detail directly behind the
//    card. The new layer specifically flattens/calms that region without
//    touching the left side's existing brand-gradient look.
// 3. Card: `bg-surface/90 backdrop-blur-xl` (FMP-UI-18D) eased to
//    `bg-surface/95 backdrop-blur-lg` — stronger/more solid per this
//    unit's own "should not feel transparent or washed out," while still
//    keeping enough blur to read as integrated rather than pasted on.
// 4. Card header: icon+heading row `items-start`→`items-center` for
//    cleaner alignment.
// 5. Footer: the `bg-black/25 backdrop-blur-sm` "pill" backing from
//    FMP-UI-18D removed entirely — it read as too heavy on its own. The
//    new right-side overlay (point 2) now provides enough contrast for
//    plain text directly on the background, matching this unit's own
//    "subtle centered footer text, not a dark pill" instruction.
// 6. Theme toggle: shrunk/faded further (`scale-90 opacity-70`→
//    `scale-80 opacity-55`) per "reduce visual dominance further" — still
//    returns to full size/opacity on hover/focus-within, so it never
//    becomes harder to actually use, only quieter at rest.
// 7. Left panel: title eased down one step (`text-4xl xl:text-5xl`→
//    `text-3xl xl:text-4xl`) with a tighter custom line-height
//    (`leading-tight`→`leading-[1.08]`); description narrowed
//    (`max-w-md`→`max-w-sm`) for a more comfortable line length; module
//    chips refined (softer `bg-white/6` background, `border-white/12`,
//    explicit `h-9` for guaranteed consistent height regardless of label
//    length).
//
// FMP-UI-17E — FMP-UI-17D's `bg-surface/95 backdrop-blur-lg` card and
// plain-text footer still read as "too transparent, hard to read" per
// direct user feedback ("background image shows through the card... dark
// text on a dark transparent background... footer nearly invisible"). This
// unit prioritizes READABILITY over the frosted-glass look those earlier
// units pursued, while keeping the same background photo/split-screen
// direction (kept per this unit's own explicit constraint):
// 1. Card: `bg-surface/95 backdrop-blur-lg` → `bg-surface/98
//    backdrop-blur-sm` — near-solid (98%) with only a whisper of blur, so
//    the card's own theme-correct surface color dominates over whatever
//    photo detail sits behind it, in both Light and Dark mode. Every text
//    element inside already used semantic tokens (`text-text-primary`/
//    `-secondary`/`-muted`) that are correct for whichever theme is
//    active — the actual bug was the card not being opaque enough for
//    those tokens' contrast guarantees to hold, not the tokens themselves.
// 2. Right-side overlay: strengthened the FMP-UI-17D calming gradient
//    (`rgba(23,32,51,0.55)/0.8` → `0.65/0.88`) so the zone behind the card
//    is calmer still, working together with the card's own higher opacity
//    rather than replacing it.
// 3. Footer: replaced FMP-UI-17D's plain `text-white/85` text sitting
//    directly on the photo with a small "clear footer area" — a soft
//    `bg-surface/85 backdrop-blur-md` strip with a subtle border and this
//    page's own normal `text-text-secondary`/`text-text-muted` tokens
//    (theme-adaptive, matching the card's own text treatment) instead of
//    literal white. This is NOT the FMP-UI-18D "heavy black pill" (that
//    was a flat, high-contrast `bg-black/25` block) — it's a light,
//    adaptive, low-contrast strip that echoes the card's own material
//    above it, satisfying this unit's own "readable but subtle... not a
//    heavy black pill... should not disappear into the image" together.
// 4. Theme toggle: resting opacity nudged back up (`opacity-55`→
//    `opacity-65`) — FMP-UI-17D's reduction went slightly too far past
//    "readable" toward "hard to see"; still meaningfully quieter than its
//    FMP-UI-17C baseline (`opacity-70`), still restores to full
//    size/opacity on hover/focus-within.
//
// FMP-UI-17F — layout/composition polish (spacing, alignment, hierarchy
// only — no new colors/copy/mechanics):
// 1. Left panel content switched from vertically CENTERED
//    (`justify-center`, asymmetric `pt-10 pb-20`) to TOP-ANCHORED
//    (`pt-12 lg:pt-14`, no `justify-center`) — the logo previously sat
//    wherever the centered block happened to land, which on tall
//    viewports read as "lower-left" rather than a true top-left brand
//    mark. Anchoring to the top with generous top/left padding puts the
//    logo where an enterprise brand mark actually belongs — the rest of
//    the content (title/tagline/description/tags) simply flows below it
//    in the same order as before.
// 2. Logo-to-title gap tightened (`mt-8`→`mt-5`) per "reduce the empty
//    vertical gap between logo and heading."
// 3. Right panel's centered content group nudged down slightly
//    (`pt-8 lg:pt-12` added to its own wrapper, inside the still-centered
//    flex column) so the card reads as intentionally, slightly below
//    true-center rather than dead-center — a small, deliberate visual
//    weight shift, not a structural change to the centering mechanism.
// 4. Footer-to-card gap tightened (`mt-8`→`mt-5`) for closer visual
//    grouping with the form, per "place it closer to the form."
//
// FMP-UI-17G — card HEADER redesign only (form fields, card surface,
// footer, left panel, and theme toggle all unchanged): the user compared
// this card against a reference login design with a large circular icon
// and a "Welcome Back" heading, and asked for that STRUCTURE (centered
// icon → heading → supporting text → badge) while keeping RECAFCO's own
// identity, explicitly NOT the reference's blue HRMS styling. Replaced the
// FMP-UI-17C/17D icon-beside-heading row with a centered column: a large
// (`size-16 sm:size-20`) circular `bg-accent-light`/`text-accent` badge
// holding `ShieldUser` (lucide-react's actual "shield with a person"
// icon — a closer literal match for "secure user access" than the
// previous plain `ShieldCheck`), then "Welcome Back" (was "Secure Sign
// in"), then "Secure access to RECAFCO Factory Operations System." (was
// "Use your RECAFCO account to access factory operations."), then the
// unchanged "Authorized Company Access" badge — all centered, all in one
// `flex flex-col items-center text-center` group. Colors are the exact
// same tokens the icon badge already used (`bg-accent-light`/`text-accent`
// — RECAFCO red, never blue); the badge just grew from a small
// `rounded-2xl` square to a large `rounded-full` circle.
//
// FMP-UI-17H — left-panel TYPOGRAPHY only (card, footer, theme toggle,
// background, and layout structure all unchanged): the title had been
// eased down twice before (FMP-UI-13's original `text-3xl sm:text-4xl` on
// the old centered layout, then FMP-UI-17D's `text-4xl xl:text-5xl`→
// `text-3xl xl:text-4xl` "reduce dominance" pass) — with the login card
// now reading as a strong, premium element in its own right (FMP-UI-17G),
// the branding side had fallen behind it in visual weight. Sized up
// responsively rather than jumping straight to `text-5xl`/`text-6xl` at
// every width this element renders at: this `<h1>` is `hidden lg:block`'s
// child, so its NARROWEST real width is exactly the `lg` breakpoint
// (1024px, left panel ≈45% of that ≈460px minus padding) — plenty of room
// for `text-4xl`, tight for `text-5xl`, and risks a 3rd wrapped line for
// "Management Platform" at `text-6xl`. Scaled `text-4xl` (`lg`) →
// `text-5xl` (`xl`, 1280px+) → `text-6xl` (`2xl`, 1536px+) so the BIGGEST
// size only applies once there's genuinely enough width for it, while
// still hitting this unit's own "text-5xl or text-6xl on desktop"
// recommendation at real desktop widths. Subtitle, description (copy
// updated to this unit's own exact new text), and module-chip spacing all
// adjusted to stay proportional to the larger title; the 3 main groups'
// own gap eased `gap-8`→`gap-6` to keep the whole block from growing tall
// enough to push the tags toward the bottom edge on shorter viewports.
export default function LoginPage(): React.JSX.Element {
  return (
    <div className="relative min-h-screen bg-background lg:grid lg:grid-cols-[5fr_6fr]">
      {/* FMP-UI-18B — full-screen background: fixed behind both panels at
          every breakpoint, so it never scrolls away and always covers the
          whole viewport regardless of page height. Two swapped `<img>`s
          (desktop vs. mobile-sized asset) plus the shared navy overlay. */}
      <div aria-hidden="true" className="fixed inset-0 z-0 overflow-hidden">
        <img
          src="/login-hero.jpg"
          alt=""
          className="hidden h-full w-full object-cover object-[60%_40%] lg:block"
        />
        <img
          src="/login-hero-mobile.jpg"
          alt=""
          className="h-full w-full object-cover object-[60%_40%] lg:hidden"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(23,32,51,0.92) 0%, rgba(36,48,71,0.82) 55%, rgba(47,61,89,0.68) 100%)' }}
        />
        {/* FMP-UI-17D — a second, right-biased gradient stacked on top of
            the diagonal wash above. The diagonal alone leaves the RIGHT
            side (where the login card sits) with the LEAST darkening of
            the whole page — exactly backwards from what a calm card
            backdrop needs. This layer adds extra flat navy specifically
            from ~40% across to the right edge, calming the busy photo
            detail behind the card without touching the left panel's own
            look at all (transparent through the left ~40%). FMP-UI-17E —
            strengthened once more (`0.55`/`0.8`→`0.65`/`0.88`) to work
            together with the card's own higher opacity (below) for an
            even calmer backdrop directly behind the form. */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, transparent 0%, transparent 40%, rgba(23,32,51,0.65) 70%, rgba(23,32,51,0.88) 100%)' }}
        />
      </div>

      {/* LEFT PANEL — desktop only (`hidden lg:block`); on tablet/mobile
          this collapses away entirely and the right panel becomes a
          single centered column, per this unit's own "tablet: stacked"
          responsive choice. */}
      <div className="relative z-10 hidden overflow-hidden lg:block">
        {/* Corner registration/crop marks — kept from FMP-UI-17C (a genuine
            blueprint/drafting annotation motif); the CSS cross-hatch and
            precast-panel geometry layers from that unit were removed in
            FMP-UI-18 — stacking that texture over a detailed real photo
            read as busy/competing rather than complementary. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-10 top-10 size-10 border-r border-t border-white/15 xl:right-14 xl:top-14"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-10 left-10 size-10 border-b border-l border-white/15 xl:bottom-14 xl:left-14"
        />

        {/* Very subtle red accent glow — RECAFCO's own brand color, heavily
            blurred, low opacity — kept as the one small brand touch on top
            of the photo, scoped to this panel only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full blur-3xl"
          style={{ backgroundColor: 'rgba(198,40,40,0.16)' }}
        />

        {/* FMP-UI-17F — top-anchored (no `justify-center`, was vertically
            centered) with generous top/left padding (`pt-12 lg:pt-14`,
            `px-10 lg:px-12`) so the logo lands as a true top-left brand
            mark instead of wherever vertical centering happened to place
            it. */}
        {/* FMP-UI-17H — the 3 main groups' own gap eased `gap-8`→`gap-6`
            to help offset the larger title's added height, keeping the
            tags from being pushed too far down on shorter viewports. */}
        <div className="relative z-10 flex h-full flex-col gap-6 px-10 pb-12 pt-12 lg:px-12 lg:pt-14 xl:px-16">
          <div>
            {/* FMP-UI-18C — logo enlarged again (h-16→h-20, chip p-3.5→p-4)
                per direct user feedback on a screenshot ("place the logo a
                little bit top and increase the size"). */}
            <div className="inline-flex rounded-2xl bg-white p-4 shadow-xl">
              <img src="/recafco-logo.png" alt="RECAFCO" width={193} height={150} className="h-20 w-auto" />
            </div>
            {/* FMP-UI-17H — sized back up: `text-3xl xl:text-4xl`→
                `text-4xl xl:text-5xl 2xl:text-6xl`, per direct feedback
                that the branding side had fallen behind the login card's
                own visual weight (FMP-UI-17G). Scaled across 3 steps
                rather than jumping straight to the top size everywhere,
                since this element's narrowest real width is exactly the
                `lg` breakpoint (`hidden lg:block`'s child) — see this
                file's own top-of-file doc comment for the full width
                reasoning. Line-height tightened further
                (`leading-[1.08]`→`leading-[1.05]`) per "line-height:
                tight." Still exactly 2 intentional lines (unchanged since
                FMP-UI-17C) — logo gap unchanged (`mt-5`, FMP-UI-17F). */}
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-white xl:text-5xl 2xl:text-6xl">
              <span className="block">RECAFCO Factory</span>
              <span className="block">Management Platform</span>
            </h1>
            {/* FMP-UI-17H — bumped up a step (`text-xs`→`text-sm`,
                `font-semibold`→`font-medium` per this unit's own "medium
                weight," `white/60`→`white/70` for "slightly more
                visible") with more room below it before the description
                (`mt-3`→`mt-4`) now that the title above it is taller. */}
            <p className="mt-4 text-sm font-medium uppercase tracking-widest text-white/70">
              Factory Operations System
            </p>
          </div>

          {/* FMP-UI-17H — copy replaced with this unit's own exact new
              text; widened `max-w-sm`→`max-w-lg` (~512px, closest
              standard utility to the requested ~520px) and sized up
              `text-sm`→`text-base` for "increase description readability
              slightly" now that the title/subtitle above it both grew. */}
          <p className="max-w-lg text-base leading-relaxed text-white/80">
            Secure access for contracts, technical approvals, erection workflows, production, safety and maintenance.
          </p>

          {/* FMP-UI-18D — split into 2 explicit rows of 4 (was one
              `flex-wrap` row that reflowed unpredictably by viewport
              width, leaving "Tasks" stranded alone on its own row at
              common widths) — a deliberate, even 4+4 grid always looks
              balanced regardless of exact container width, rather than
              depending on where flex-wrap happens to break.
              FMP-UI-17H — padding/gaps nudged up a step (`h-9`→`h-10`,
              `px-3.5`→`px-4`, row gap `gap-2.5`→`gap-3`, row spacing
              `space-y-2.5`→`space-y-3`) to stay proportional now that the
              title/description above are noticeably larger — still 2
              clean rows of 4, never crowded.
              FMP-UI-17J — added a small "System Modules" label above the
              row (this unit's own suggested heading, kept subtle —
              uppercase, muted, small) and stripped every affordance that
              made these plain `<span>`s LOOK clickable even though they
              never were one: `hover:border-white/25 hover:bg-white/12
              hover:text-white` removed entirely (no hover state at all
              now), `transition-colors` removed (nothing left to
              transition), and `cursor-default` added explicitly. Contrast
              eased one notch (`text-white/80`→`text-white/70`,
              `border-white/12`→`border-white/10`) so they read as softer,
              lower-contrast informational labels rather than buttons.
              These were already plain `<span>`s with no `onClick`, no
              `href`, and no `tabIndex` before this unit — i.e. already
              structurally non-interactive and never keyboard-focusable;
              this pass only removes the visual cues that suggested
              otherwise. */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
              System Modules
            </p>
            <div className="space-y-3">
              {[MODULE_TAGS.slice(0, 4), MODULE_TAGS.slice(4)].map((row, i) => (
                <div key={i} className="flex flex-wrap gap-3">
                  {row.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex h-10 cursor-default items-center rounded-full border border-white/10 bg-white/6 px-4 text-sm font-medium text-white/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — FMP-UI-18B: `bg-background` removed so the shared
          full-screen photo shows through the space around the card here
          too, `z-10` added so it paints above that fixed background. The
          card itself (below) stays fully opaque regardless. */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
        {/* Appearance selector — a page utility, not part of the sign-in
            form, in this panel's own top-right corner (not the whole
            page's, now that there are 2 panels) so it never competes with
            the Sign in button below it. FMP-UI-17C — `ThemeToggle` itself
            is unchanged; this wrapper just shrinks it slightly and rests
            at reduced opacity (full opacity/size on hover/focus-within) so
            it reads as a minor utility control rather than a second
            prominent element competing with the login card. FMP-UI-17D —
            shrunk/faded further (`scale-90 opacity-70`→`scale-75
            opacity-55`) per "reduce visual dominance further." FMP-UI-17E
            — resting opacity nudged back up (`opacity-55`→`opacity-65`),
            per "remains readable but does not dominate" — 55% read as
            slightly too faint as a baseline-visible state; still fully
            restores to 100%/full size on hover/focus-within. */}
        <div className="absolute right-4 top-4 z-20 origin-top-right scale-75 opacity-65 transition-opacity hover:opacity-100 focus-within:opacity-100 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>

        {/* FMP-UI-17F — `pt-8 lg:pt-12` nudges this whole centered group
            (mobile branding + card + footer) slightly below true-center
            within the still-`justify-center` parent, so the card reads as
            deliberately, gently lower rather than dead-center — a small
            visual-weight shift, not a structural change to the centering
            itself. */}
        <div className="w-full max-w-md pt-8 lg:pt-12">
          {/* FMP-UI-18B — mobile/tablet-only compact branding: no longer
              its own separate photo band (that would now double up with
              the shared full-screen background behind it) — just the
              logo chip + white text sitting directly on the shared
              photo+overlay, the same way the desktop left panel's content
              always has. */}
          <div className="mb-8 text-center lg:hidden">
            <div className="inline-flex rounded-2xl bg-white p-3 shadow-md">
              <img src="/recafco-logo.png" alt="RECAFCO" width={193} height={150} className="h-14 w-auto" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              RECAFCO Factory Management Platform
            </h1>
            <p className="mt-1.5 text-xs font-semibold uppercase tracking-widest text-white/60">
              Factory Operations System
            </p>
          </div>

          {/* Login card — FMP-UI-17C: shadow deepened one step
              (shadow-xl→shadow-2xl) for more "official" presence; border/
              top-accent/sheen unchanged from FMP-UI-13/17B. FMP-UI-18D —
              `bg-surface`→`bg-surface/90 backdrop-blur-xl`: a frosted-glass
              treatment so the card reads as floating WITHIN the photo
              scene behind it rather than pasted flat on top. FMP-UI-17D —
              eased to `bg-surface/95 backdrop-blur-lg`. FMP-UI-17E — eased
              further to `bg-surface/98 backdrop-blur-sm`: near-solid, only
              a whisper of blur, so this card's own theme-correct surface
              color reliably dominates over the photo behind it in both
              Light and Dark mode — the earlier, more transparent versions
              let too much of the busy photo bleed through, undermining the
              text-contrast guarantees the semantic color tokens inside
              this card depend on. */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/98 p-8 shadow-2xl backdrop-blur-sm sm:p-10">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-accent" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1 h-24 bg-linear-to-b from-white/60 to-transparent dark:from-white/5"
            />

            <div className="relative">
              {/* FMP-UI-17G — replaced the FMP-UI-17C/17D icon-beside-
                  heading row with a centered "Welcome Back" header, taking
                  inspiration from a reference card's friendly structure
                  while keeping RECAFCO's own red/navy identity (never the
                  reference's blue HRMS styling): a large circular icon
                  (`ShieldUser` — secure user access, not a generic shield)
                  above the heading, both centered, with the supporting
                  line and the "Authorized Company Access" badge stacked
                  neatly beneath. */}
              <div className="flex flex-col items-center text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-accent-light text-accent sm:size-20">
                  <ShieldUser className="size-8 sm:size-10" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
                  Welcome Back
                </h2>
                <p className="mt-1.5 text-sm text-text-secondary">
                  Secure access to RECAFCO Factory Operations System.
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-secondary px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                  Authorized Company Access
                </span>
              </div>

              <div className="mt-8">
                <LoginForm action={loginAction} />
              </div>
            </div>
          </div>

          {/* Footer — history: FMP-UI-18B put plain white/light text
              directly on the photo; FMP-UI-18D wrapped that in a heavy
              `bg-black/25 backdrop-blur-sm` pill for guaranteed contrast;
              FMP-UI-17D removed the pill again (too heavy) and went back
              to plain text, relying on the shared background's own
              overlay for contrast — which then read as "nearly invisible"
              per direct user feedback. FMP-UI-17E: a small "clear footer
              area" — `bg-surface/85 backdrop-blur-md` with a subtle
              `border-border/60` and this page's own NORMAL
              `text-text-secondary`/`text-text-muted` tokens (theme-
              adaptive, matching the card's own text above it) instead of
              literal white. This is deliberately NOT the FMP-UI-18D pill:
              that was flat, opaque, high-contrast `bg-black/25`; this is a
              lighter, softer, theme-aware strip that echoes the card's own
              material — "readable but subtle," not heavy, never
              disappearing into the image either way. FMP-UI-17F — gap from
              the card tightened (mt-8→mt-5) for closer visual grouping
              with the form, per "place it closer to the form." */}
          <div className="mx-auto mt-5 w-fit max-w-full rounded-2xl border border-border/60 bg-surface/85 px-5 py-3 text-center shadow-sm backdrop-blur-md">
            <p className="text-xs font-medium tracking-wide text-text-secondary">
              Authorized RECAFCO users only · Internal Use Only
            </p>
            <p className="mt-1 text-xs text-text-muted">© RECAFCO · Since 1976</p>
          </div>
        </div>
      </div>
    </div>
  );
}
