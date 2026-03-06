# Landing Expansion Engagement Enhancements Plan (Valid Fixes Only)

## Summary

- Goal: implement only the validated landing-page improvements for the active expansion homepage (`/en` when `HOME_PAGE_VARIANT=expansion`).
- Planned markdown artifact to create during implementation: `docs/plans/landing-expansion-valid-fixes-2026-02-26.md`.
- Scope includes: hero outcome rotator (#1, toned), stats count-up/stagger (#3), social-proof highlight card (#8), button micro-interactions (#9), and animated how-it-works connector (#5).
- Scope excludes: preview progress rewrite (#2), flip-card pain points (#4), FAQ accordion conversion (#6), extra sticky CTA (#7), and launch-banner urgency animation changes (#10).

## Final Decisions (Locked)

1. Surface scope: expansion landing only (`modules/landing/segment-page.tsx`), no variant-35 parity work.
2. Shadcn approach: use existing shadcn-style primitives/patterns already in repo; do not initialize shadcn CLI/`components.json`.
3. Plan file location: new file under `docs/plans/`.

## Public APIs / Interfaces / Type Changes

1. `TryFormProps` in `components/try-form.tsx` gains optional `primaryButtonClassName?: string` so landing-specific micro-interactions can be passed without global button behavior changes.
2. `LandingContent["hero"]` in `modules/landing/content.ts` gains rotator metadata keys:
   - `rotatorPrefixKey: string`
   - `rotatorOutcomeKeys: [string, string, string, string]`
3. i18n message contract adds new keys in `internal/i18n/messages/{en,fr,ja}.json`:
   - Hero rotator keys (`landing.expansion.hero.rotator.prefix`, `landing.expansion.hero.rotator.outcome.1..4`)
   - Social-proof callout keys (`landing.cost.callout.title`, `landing.cost.callout.stat.1.value`, `.1.label`, `.2.value`, `.2.label`, `landing.cost.callout.source`)

## Implementation Plan

### Phase 0 — Create Plan Artifact

1. Create `docs/plans/landing-expansion-valid-fixes-2026-02-26.md` with this exact structure and decisions for implementation handoff.
2. Include sections: scope, interfaces, milestones, tests, acceptance criteria, assumptions.

### Phase 1 — Motion Foundations (Client Islands + Accessibility)

1. Add `modules/landing/components/hero-outcome-rotator.tsx` (`"use client"`):
   - Props: `prefix`, `outcomes`, `intervalMs=3000`, `className`.
   - Behavior: rotate one word at a time, crossfade/slide transition, `aria-live="polite"`.
   - Reduced motion: lock to first outcome (no interval).
2. Add `modules/landing/components/in-view-count-up.tsx` (`"use client"`):
   - Props: `target`, `suffix`, `durationMs`, `delayMs`, `className`, `ariaLabel`.
   - Behavior: trigger once on viewport entry (IntersectionObserver), animate integer value.
   - Reduced motion or no observer: render final value immediately.
3. Add lightweight CSS module for expansion-only motion classes:
   - `modules/landing/segment-page.module.css`
   - Include `@media (prefers-reduced-motion: reduce)` overrides for every new animation.

### Phase 2 — Hero Rotator (#1, toned and SEO-safe)

1. Keep current H1 unchanged for SEO and copy stability.
2. Insert rotator line under subtitle in `modules/landing/segment-page.tsx` using new client component and translated keys.
3. Prevent layout shift:
   - Reserve width for rotating token.
   - Keep line-height fixed across states.
4. Ensure server-rendered fallback text is meaningful before hydration.

### Phase 3 — Stats + Social Proof (#3 + #8)

1. Stats row:
   - Replace raw `330+` rendering with `InViewCountUp(target=330, suffix="+")`.
   - Apply staggered reveal class delays for three stat cards.
2. Social-proof callout card in pain section:
   - Promote 76% and 40% into two visual stat chips using same count-up component with `%`.
   - Keep supporting sentence/source below (translated key).
3. Preserve semantic structure and readability:
   - Headings unchanged.
   - Numeric emphasis remains text (not canvas/svg-only).

### Phase 4 — How-It-Works Connector (#5)

1. Add `modules/landing/components/how-steps-timeline.tsx` (`"use client"`):
   - Props: translated step items.
   - Render existing three steps plus a connector rail and animated fill.
2. Behavior:
   - Fill progresses as each step intersects viewport.
   - Step cards get subtle enter transition.
3. Reduced motion:
   - No animated fill transitions.
   - All steps rendered static and fully readable.

### Phase 5 — Button Micro-Interactions (#9)

1. `TryForm`:
   - Wire new `primaryButtonClassName` prop into Generate button class merge.
2. Expansion landing usage:
   - Pass landing-specific motion classes to TryForm generate button (`hover` lift/scale, `active` press scale).
   - Apply same motion class to final CTA primary button in expansion section.
3. Do not modify `components/ui/button.tsx` base variants globally to avoid dashboard-wide regressions.

### Phase 6 — Localization and Copy Updates

1. Add all new i18n keys in `en`, `fr`, `ja`.
2. Keep existing keys untouched unless directly superseded by new callout presentation.
3. Validate no hardcoded user-facing strings are introduced in components.

## Test Cases and Scenarios

1. Unit tests (Vitest + Testing Library):
   - `hero-outcome-rotator` cycles with fake timers.
   - `hero-outcome-rotator` stops animation when reduced motion is enabled.
   - `in-view-count-up` animates to target and clamps correctly.
   - `in-view-count-up` renders final value immediately in reduced motion.
2. Component regression tests:
   - `TryForm` accepts `primaryButtonClassName` and preserves existing disabled/loading behavior.
3. E2E tests (Playwright):
   - Expand `tests/landing.spec.ts` to assert presence of rotator line, highlighted social-proof stats, and how-it-works connector container.
   - Verify no console errors on `/en` in expansion mode.
4. Manual QA:
   - Desktop and mobile at `/en`.
   - Reduced-motion simulation.
   - Ensure no overlap with fixed launch banner and sticky header.
   - Confirm preview flow remains unchanged (queued/stage updates still visible).

## Acceptance Criteria

1. Expansion landing visibly includes all five validated improvements (#1 toned, #3, #5, #8, #9).
2. Preview form progress UX remains intact and unchanged functionally.
3. No global button-style regressions outside expansion landing.
4. New animations respect `prefers-reduced-motion`.
5. `corepack pnpm check`, targeted Vitest tests, and `tests/landing.spec.ts` pass.

## Rollout and Risk Controls

1. Implement in small commits by phase, validating after each phase.
2. Keep all motion changes expansion-scoped; no global style overrides.
3. If instability appears, disable client islands individually (rotator/count-up/timeline) without reverting structural copy/layout.

## Assumptions and Defaults

1. Locale set for this landing is `en/fr/ja`; keys will be added for those locales only.
2. No shadcn CLI initialization is desired in this task; existing shadcn-style primitives are sufficient.
3. Expansion page is the only production target for this change set.
4. Plan artifact will be stored under `docs/plans/` with a dated filename.
