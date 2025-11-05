# WebLingo Marketing Site — Implementation Plan

This plan covers the current single-site marketing build while keeping modules package-ready for future SaaS projects.

## Phase 1 — Foundations

- Scaffold Next.js App Router structure with Tailwind CSS.
- Add proto-package folders under `internal/` (start with `core`, `billing`, and `i18n`).
- Set up strict environment parsing via `internal/core/env.ts`.
- Configure TypeScript path aliases (`@internal/*`, `@modules/*`, `@components/*`).
- Seed locale dictionaries in `internal/i18n/messages/{en,fr,ja}.json` and export translators.

Acceptance: `pnpm run dev` serves the landing page with header/footer shell.

## Phase 2 — Pricing & Checkout

- Model pricing tiers in `modules/pricing/data.ts` (Launch, Growth, Enterprise).
- Build `modules/pricing/pricing-table.tsx` for the pricing page.
- Implement `internal/billing/stripe.ts` to create Checkout sessions and verify webhooks.
- Add API routes:
  - `POST /api/stripe/create-checkout-session`
  - `POST /api/stripe/webhook`

Acceptance: Clicking “Choose plan” starts Stripe Checkout; webhook logs lifecycle events.

## Phase 3 — Marketing Pages

- Home page hero + feature sections (localized copy).
- Contact form (static for now) with CTA.
- Legal pages for Terms and Privacy.
- Checkout success/cancel UX.
- Robots and sitemap routes.

Acceptance: All public routes render with cohesive theme and metadata.

## Phase 4 — Package-readiness

- Ensure each internal module exports a narrow surface via `index.ts` when needed.
- Keep imports alias-based (no deep relative paths).
- Document extraction steps in `docs/DEVELOPMENT_GUIDE.md`.

Acceptance: Moving a module into `/packages/*` should only require updating path aliases.

## Future Enhancements

- `internal/auth` once customer dashboard or portal exists.
- Customer portal endpoint for Stripe.
- Analytics abstraction under `internal/analytics`.
- Tests for pricing/billing flows (unit + contract tests).
