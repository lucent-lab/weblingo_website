# Prospect Demo Buyer Journey UX Follow-Up

Date: 2026-06-06

## Scope

This report captures follow-up analysis from the restrained P0/P1 prospect demo dashboard pass. The implemented direction keeps the real dashboard flow:

`/dashboard/demo#token=...` -> `/dashboard/sites/:siteId`

The demo remains scoped to the claimed site/account, read-only, side-effect-free, and conversion remains the only activation path.

## Current Outcome

The latest preview deployment built successfully and the local mock-auth dashboard route audit passed after one small fix to preserve the `Quality` route heading.

The guided buyer journey is now clearer than before:

- The overview has a demo explanation banner and a five-step walkthrough for inspecting the translated site, reviewing pages/crawl status, controlling translation rules, checking domains/serving, and activating.
- Demo users get a persistent activation reminder on scoped site dashboard pages that links back to the real overview conversion card.
- The Quality route now frames glossary, manual overrides, localized slugs, and consistency as translation-control proof.
- Settings has demo-specific read-only copy rather than mislabeling demo access as a billing problem.
- Source-vs-translated comparison only appears when existing dashboard data exposes a safe live URL.

## Validation Evidence

Validated with:

- Vercel preview deployment: `https://weblingo-website-cdznaylu0-fgueguens-projects.vercel.app`
- `corepack pnpm test:e2e:smoke`
- `corepack pnpm test:showcase:fixtures`
- `corepack pnpm test`
- `corepack pnpm test:contracts`
- `corepack pnpm run check`
- Browser route audit against `DASHBOARD_E2E_MOCK=1` for overview, pages, domains, quality, settings, source selection, runtime requests, history/deployments, `/dashboard/demo#token=...`, and `/en/try`.

The Vercel preview was deployed successfully but is protected by Vercel login, so browser UX inspection used the local deterministic mock server.

## What Works

### Real Dashboard Trust

The demo direction is credible because it does not introduce a fake workspace or dashboard-wide fake data layer. Normal customer dashboard behavior remains unchanged, and demo-only guidance does not appear for standard authenticated users.

### Read-Only State

The read-only concept is now more visible. The explanation banner, persistent activation reminder, settings copy, and existing mutation guards work together to communicate that no changes are saved until activation.

### Buyer Narrative

The walkthrough gives prospects a reasonable path through the product:

1. Inspect translated output.
2. Review crawl/page coverage.
3. Understand translation controls.
4. Check serving readiness.
5. Activate.

That is a stronger buyer story than a dashboard that starts with raw operational cards.

### Quality Page

The Quality route is the strongest narrative improvement. It now explains why glossary, overrides, slugs, and consistency matter before showing the operational cards.

### Showcase Safety

Live showcase generation was intentionally not triggered during this audit because it would call real backend/provider paths. The fixture suite verifies the safe showcase rendering/linking behaviors and passed.

## Remaining Product Gap

The key remaining trust tradeoff is the one previously called out:

> Remaining product gap: existing example-mode subpages still use clearly labeled examples when real data is empty. That fits the allowed P1 scope, but it remains the main buyer-trust tradeoff compared with a fully real-data-only demo. Goal usage: 832,448 tokens, elapsed about 2h 34m.

Treat the token/time note as implementation-session context, not a product metric. The product issue is that even visibly labeled examples can make a prospect wonder which parts are real saved site state.

## Improvement Suggestions

### P1 Follow-Up: Add a True Demo Browser Fixture

Create a safe Playwright fixture for the full claim flow:

- Start at `/dashboard/demo#token=...`.
- Mock or seed a valid demo claim and demo session without calling live Redis/provider services.
- Redirect to `/dashboard/sites/:siteId`.
- Assert the overview demo banner, walkthrough, conversion card, and persistent activation CTA.
- Assert no mutation controls are submit-capable in demo mode.

This would close the biggest validation gap. Current tests cover render behavior and action guards, but not the complete browser handoff with a valid demo session.

### P1 Follow-Up: Make Example Mode More Explicit

Keep examples only where they teach a buyer something concrete, but add stronger framing:

- Use a consistent `Example only` badge near every example group.
- Add compact copy that says real saved values appear first and examples are not saved site data.
- Prefer empty real-state summaries over example rows on highly trust-sensitive pages.
- Consider adding a route-level example disclosure when a page contains any example-mode controls.

This keeps the current P1 allowance while reducing the risk that examples feel like fake account state.

### P1 Follow-Up: Improve Mobile Dashboard Header Actions

At a 390px viewport, the site header action row is cramped and the `Back to dashboard` button can overflow. Improve the shared site header by stacking or wrapping action buttons on small screens.

Suggested direction:

- Keep the site URL and status first.
- Wrap secondary actions into a two-row grid or compact menu on mobile.
- Keep destructive/localization actions visually separate from navigation links.

### P1 Follow-Up: Add a Compact Demo Settings Summary

Settings remains operationally dense. For demo users, add a compact read-only summary before the full settings form:

- Source URL and source language.
- Target languages and routing mode.
- Brand voice / site profile status.
- Runtime/client routing state.
- Integration/webhook state.

The full form can remain available below, but the buyer should get the proof point before seeing the control surface.

### P2: Reduce Local QA Analytics Noise

Local browser QA currently emits PostHog `config.js` 404 noise when using fake test keys. It does not block the dashboard, but it makes console review less useful.

Suggested direction:

- Add a local/test analytics no-op mode, or
- Update the analytics proxy/test env so expected local config requests do not surface as browser errors.

### P2: Deployed Preview Browser Access

The Vercel preview was protected by login, which limited direct browser inspection of the deployed URL.

Suggested direction:

- Use a Vercel protection bypass token for QA runs, or
- Add a documented preview QA command that injects the bypass token into Playwright.

## Recommended Next Task

Run a short follow-up analysis focused on demo trust and browser validation:

1. Design the valid demo-session Playwright fixture.
2. Decide where examples should remain, where they should be replaced by empty real-state summaries, and where an `Example only` badge is enough.
3. Tighten the mobile site-header action layout.
4. Decide whether the Settings demo summary belongs in P1 or should wait for a broader settings simplification pass.

The follow-up should remain restrained. It should not add a fake dashboard, fake workspace, public overlay, or backend contract changes unless the demo-session browser fixture cannot be built safely without a small test-only seam.
