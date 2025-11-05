# WebLingo Marketing Site

Single-tenant marketing site for WebLingo, a SaaS localization product. Built with Next.js (App Router), Tailwind CSS, and Stripe Checkout. The codebase follows a “proto-package” layout so internal modules can be promoted to standalone packages when new SaaS sites spin up.

## Directory Layout

```
app/                 # Next.js routes (localized under /[locale]) and API handlers
components/          # Reusable UI components for the site
internal/            # Proto-packages (env, billing, etc.)
  core/
  billing/
  i18n/
modules/             # Feature modules (e.g., pricing)
styles/              # Global styles (Tailwind)
```

Key modules today:

- `internal/core/env.ts` — strict environment variable parsing
- `internal/billing/stripe.ts` — Stripe client + helpers
- `internal/i18n/` — Locale config, message loaders, translation helpers
- `modules/pricing/` — Pricing tier definitions and UI
- `components/ui/` — Locally vendored shadcn/ui primitives (button, card, input, badge)
- `components/pricing-teaser.tsx` — Home page pricing teaser built on shadcn/ui cards

Internationalization is handled via the `/[locale]` segment with English, French, and Japanese dictionaries stored under `internal/i18n/messages/*`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in live values.

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICING_TABLE_ID=prctbl_default
STRIPE_PRICING_TABLE_ID_EN=prctbl_for_en
STRIPE_PRICING_TABLE_ID_FR=prctbl_for_fr
STRIPE_PRICING_TABLE_ID_JA=prctbl_for_ja
```

## Scripts

```
pnpm install
pnpm run dev          # Start Next.js
pnpm run lint         # ESLint
pnpm run typecheck    # TypeScript project check
pnpm run format       # Prettier verify
pnpm run format:write # Prettier write
```

## Stripe Setup

1. Create three recurring prices for the Launch, Growth, and Enterprise plans. Name the price IDs so they include the site identifier, e.g. `price_weblingo_growth_monthly`.
2. Populate the matching IDs in `modules/pricing/data.ts`.
3. Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` for local development and set the `STRIPE_WEBHOOK_SECRET`.
4. Configure Stripe Pricing Tables for each locale (or reuse one) and copy the IDs into `STRIPE_PRICING_TABLE_ID` (fallback) and the locale-specific envs (`STRIPE_PRICING_TABLE_ID_EN`, `FR`, `JA`). The embed renders on `/[locale]/pricing`, with the in-app comparison table acting as a fallback.

## Roadmap For Additional Sites

- Extract modules from `internal/*` into `/packages/*` when a second SaaS app appears.
- Add authentication module (e.g., Supabase) under `internal/auth` once customer portals launch.
- Extend billing module with customer portal API when needed.
