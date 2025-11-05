# Architecture — WebLingo Marketing Site

## Overview

Single Next.js App Router project that serves the public marketing site for WebLingo. Internal directories are organized as proto-packages so they can be extracted when additional SaaS websites launch.

```
app/                 # Localised routes (`/[locale]/...`) and API handlers
components/          # App-specific UI pieces + shadcn/ui wrappers
internal/core/       # Environment parsing, future shared utilities
internal/billing/    # Stripe client + helpers
internal/i18n/       # Locale config, message loaders, translation helpers
modules/pricing/     # Pricing data + UI
styles/              # Tailwind globals
```

## Request Flow

1. Request hits a localized route in `app/[locale]/…` (e.g., `/fr/pricing`).
2. The page loads locale messages via `internal/i18n` and creates a translator.
3. Components import data (e.g., pricing tiers) from `modules/pricing` and render localized copy.
4. API routes under `app/api/stripe/*` delegate to `internal/billing/stripe.ts` and always attach `siteId` metadata so multiple sites can share a Stripe account.

## Internal Modules

### `internal/core/env`

- Uses `zod` to parse and validate environment variables once.
- Exports a typed `env` object; other modules never read from `process.env` directly.

### `internal/billing/stripe`

- Provides `createCheckoutSession`, `verifyStripeSignature`, and `getStripeClient` helpers.
- Resolves pricing metadata via `modules/pricing/data.ts` and includes `SITE_ID` in Stripe metadata.

### `internal/i18n`

- Defines supported locales (`en`, `fr`, `ja`) and the default locale.
- Loads JSON message dictionaries (`internal/i18n/messages/<locale>.json`).
- Exposes `createTranslator` for server components and `createClientTranslator` for client components to access localized strings.

### Modules

- `modules/pricing/data.ts` — Three-tier pricing catalog (Launch, Growth, Enterprise) with Stripe price IDs.
- `modules/pricing/pricing-table.tsx` — Fallback comparison table using the catalog data and translator.
- `components/pricing-teaser.tsx` — Home page teaser built with shadcn/ui cards over the pricing catalog.
- `components/ui/*` — Locally vendored shadcn/ui primitives (button, card, badge, input).

The public pricing experience embeds Stripe’s Pricing Table on `/[locale]/pricing` using `STRIPE_PUBLIC_KEY` and `STRIPE_PRICING_TABLE_ID`. The fallback table ensures we retain plan metadata for the Checkout API and non-embed contexts.

## Stripe Integration

- `POST /api/stripe/create-checkout-session`
  - Validates payload with zod.
  - Creates a subscription Checkout session for the requested plan/cadence.
  - Includes `siteId` + `planId` metadata in the Session and Subscription objects.

- `POST /api/stripe/webhook`
  - Verifies webhook signature using the shared secret.
  - Logs key lifecycle events (checkout completion, subscription updates/deletions).

## Styling & UI

- Tailwind CSS v4 (preview) powers styling via `styles/globals.css` and `tailwind.config.ts`.
- Components live in `components/` and should remain focused and stateless when possible.

## Future Extraction Path

- Promote folders under `internal/*` into `/packages/*` once another site needs them.
- Keep imports using aliases so moving code only requires updating `tsconfig.json`.
- Add additional modules (`internal/auth`, `internal/analytics`, etc.) as features expand, following the same pattern.
