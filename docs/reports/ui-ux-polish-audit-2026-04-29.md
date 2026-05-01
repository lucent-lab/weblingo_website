# WebLingo UI/UX Polish Audit

Date: 2026-04-29
Worktree: `/Users/francoisgueguen/Documents/workspaces-self/saas/weblingo_website-ui-ux-audit`
Branch: `codex/ui-ux-audit`
Local URL inspected: `http://127.0.0.1:3005`

## Scope

This is a visual and interaction audit only. No product positioning rewrite or UI implementation was done.

Routes inspected with Playwright at desktop `1440x1000` and mobile `390x844`:

- `/en`
- `/en#try`
- `/en/pricing`
- `/en/docs`
- `/en/blog`
- `/en/login`
- `/dashboard` redirecting to `/en/login`

The server was started with placeholder local environment values. The console showed repeated PostHog CORS errors because `NEXT_PUBLIC_APP_URL` used `localhost` while the browser visited `127.0.0.1`; that is a local inspection artifact, not a visual product issue.

## Executive Summary

The site already has a coherent SaaS foundation: restrained layout, strong black-on-white typography, clear pricing, and a useful product demo entry point. The main professionalism gap is not content; it is interaction polish and responsive composition.

The highest-impact fix is the launch banner. It currently behaves like a bottom overlay across all marketing pages, and on mobile it covers primary tasks including the preview form, login form, pricing content, and footer navigation. After that, the mobile header, pricing comparison table, docs/blog navigation, and visual system consistency would make the site feel materially more mature without changing the core message.

## Priority Findings

### P0 - Launch banner blocks primary flows

Observed on `/en`, `/en#try`, `/en/pricing`, and `/en/login`.

Current implementation: `components/launch-banner.tsx` renders a fixed bottom overlay with `z-50`, full-width inputs, and no reserved page space. The banner is mounted globally in `app/[locale]/(marketing)/layout.tsx`.

UX impact:

- On mobile `/en#try`, the banner covers the preview card and primary "Generate preview" action.
- On mobile `/en/login`, it covers the lower half of the sign-in card and sits on top of footer links.
- On desktop pricing/login, it floats over content near the footer and creates a campaign-heavy impression for account and checkout-adjacent flows.

Recommended direction:

- Replace the default mobile behavior with a compact dismissible strip or bottom sheet collapsed to one line.
- Reserve bottom safe-area space only if the banner must remain fixed.
- Hide or downgrade the banner on `/login`, checkout, legal, and docs-heavy routes.
- Use a smaller inline newsletter/waitlist block near the CTA section instead of a global overlay after the user has reached task pages.

### P1 - Mobile header has no navigation strategy

Observed on marketing pages at `390x844`.

Current implementation: `components/site-header.tsx` hides nav links at `md`, but keeps logo, Login, and Generate preview buttons visible. This keeps the header usable but cramped and removes access to Features, How it works, Pricing, Docs, and Blog.

UX impact:

- The primary CTA competes with Login on narrow screens.
- The user has no discoverable mobile nav.
- Header height and button width consume too much of the first viewport.

Recommended direction:

- Add a compact mobile menu or "More" sheet with the same nav links as desktop.
- Keep only one primary visible action on mobile, likely "Generate preview"; move Login into the menu or make it an icon/text-light action.
- Ensure tap targets stay at least 44px high and avoid text wrapping in header buttons.

### P1 - Pricing comparison is not mobile-friendly

Observed on `/en/pricing` mobile.

Current implementation: the desktop comparison matrix is rendered as a wide table-like layout. On mobile, columns compress and text becomes hard to scan.

UX impact:

- The comparison section is one of the highest-intent buying surfaces, but it becomes visually dense and low-confidence on mobile.
- Plan names and row labels compete for width.

Recommended direction:

- Convert comparison into mobile cards grouped by feature category, or add a segmented plan selector that shows one plan column at a time.
- Keep the desktop matrix for `lg+`.
- Make pricing CTAs sticky within each mobile plan card only while that card is in view, not globally.

### P1 - Docs/blog navigation feels disconnected from the marketing site

Observed on `/en/docs` and `/en/blog`.

Current implementation: docs and blog use separate shells from the marketing header. Docs mobile shows a minimal top row with Docs/Blog and a separate Home row; the WebLingo brand disappears from the first mobile viewport. Blog desktop uses a different header rhythm and a sparse page that feels unfinished.

UX impact:

- Docs look functional, but not product-polished.
- Blog looks like a default internal index rather than a credible product content area.
- Moving between marketing, docs, and blog changes navigation patterns abruptly.

Recommended direction:

- Normalize header hierarchy across marketing, docs, and blog: brand, product nav, home/docs/blog affordances, and mobile menu should feel related.
- On docs mobile, keep brand visible and put Home inside the menu or aligned as a secondary link.
- Give blog cards richer hierarchy: date, category, excerpt, and a tighter max-width. Avoid huge empty page areas on desktop.

### P2 - Visual system leans too much on the same card treatment

Observed on home, pricing, docs, and blog.

The site uses many bordered white cards with similar radius, shadows, and spacing. This is clean, but repeated equally across stats, feature cards, FAQ, pricing, docs cards, and blog cards, it starts to feel template-like.

Recommended direction:

- Reserve cards for truly comparable items: plans, docs entries, feature groups.
- Use unframed bands, compact rows, or split content blocks for supporting sections.
- Add one stronger product-specific visual motif, such as a localization pipeline strip, language coverage map, or before/after localized-page preview.
- Keep the brand restrained; the goal is sharper hierarchy, not more decoration.

### P2 - Hero and preview form are both competing for "first action"

Observed on `/en`.

The homepage starts with the preview form in the hero, while the global banner also asks for email/site details. On mobile, this stacks into two forms very early in the page.

Recommended direction:

- Let the hero preview form be the primary first action.
- Move launch/waitlist capture lower on the page or make it contextual after preview failure/disabled states.
- If preview config is unavailable, make the hero state visually intentional rather than showing a disabled product form plus a separate launch form.

### P2 - Typography and spacing need responsive tuning

Observed especially on mobile homepage and pricing.

The current type scale is strong on desktop, but mobile headings are sometimes too large for the density of the surrounding UI. The global negative letter spacing in `styles/globals.css` also affects body text and utility labels.

Recommended direction:

- Limit negative tracking to display headings, not all body text.
- Reduce mobile hero heading size or line-height slightly, especially with the rotating outcome text.
- Increase small-label readability in pricing and comparison sections.
- Keep section spacing more consistent after the hero so users can predict the scan rhythm.

### P3 - Motion exists, but it is narrow and uneven

Current motion is mostly count-up stats, the hero rotator, timeline progress, and button hover micro-movement in `modules/landing/segment-page.module.css`.

Recommended direction:

- Keep motion discreet and functional.
- Add small reveal transitions for section headings/cards using existing reduced-motion handling.
- Consider a subtle preview-card state transition for language selection and URL submission.
- Avoid large decorative animation; the product should feel operational and trustworthy.

## Suggested Implementation Sequence

1. Fix the launch banner behavior first.
   Definition of done: it never covers login, preview, pricing CTAs, footer links, or mobile form fields.

2. Add a real mobile navigation pattern.
   Definition of done: all desktop nav destinations are reachable on mobile, with one clear primary CTA.

3. Rework mobile pricing comparison.
   Definition of done: users can compare plans without pinching, horizontal guessing, or reading compressed table cells.

4. Unify docs/blog/marketing navigation.
   Definition of done: moving from `/en` to `/en/docs` or `/en/blog` feels like the same product surface.

5. Refine the visual system.
   Definition of done: cards are used deliberately, section hierarchy is clearer, and one product-specific visual motif gives the site more ownable character.

6. Add restrained motion and responsive type polish.
   Definition of done: reduced-motion is respected, no layout shifts are introduced, and mobile text remains readable.

## Lower-Risk Polish Ideas

- Add active/selected states to header links when on pricing/docs/blog.
- Give pricing plan cards a stronger alignment grid so price, feature list, and CTA positions line up.
- Add hover/focus affordances to docs/blog cards that feel clickable as full cards, not only the small link.
- Add `scroll-margin-top` to `#try`, `#features`, and `#how-it-works` so sticky header navigation lands with better spacing.
- Consider using a more meaningful brand mark than a generic globe icon once the UI structure is stable.

## Validation Notes

Recommended validation after implementation:

- Playwright screenshots at `390x844`, `768x1024`, `1440x1000`.
- Keyboard tab pass through header, banner, preview form, pricing CTAs, and login.
- `prefers-reduced-motion` visual check.
- `corepack pnpm check`.
- `corepack pnpm test:contracts` if any preview, dashboard, env, or docs contract code is touched.
