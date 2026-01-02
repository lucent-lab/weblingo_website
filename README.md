# WebLingo Marketing Site

Single-tenant marketing site for WebLingo, a SaaS localization product. Built with Next.js (App Router), Tailwind CSS, and Stripe Checkout. The codebase follows a “proto-package” layout so internal modules can be promoted to standalone packages when new SaaS sites spin up. The Supabase-authenticated customer dashboard lives alongside the marketing site and communicates with the Cloudflare worker (`webhooks` API) for site management.

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

Create `.env.local` (or configure host env) with:

```
# App + dashboard
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WEBHOOKS_API_BASE=https://api.weblingo.app/api

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICING_TABLE_ID=prctbl_default
STRIPE_PRICING_TABLE_ID_EN=prctbl_for_en
STRIPE_PRICING_TABLE_ID_FR=prctbl_for_fr
STRIPE_PRICING_TABLE_ID_JA=prctbl_for_ja

# Supabase (auth + logging)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=public-anon-key
SUPABASE_SECRET_KEY=service-role-key

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

## Running Locally

1. Install dependencies: `pnpm install`
2. Fill `.env.local` with the values above (set `NEXT_PUBLIC_WEBHOOKS_API_BASE` to your worker preview URL).
3. Start dev server: `pnpm run dev` (opens `http://localhost:3000`).
4. Dashboard access: visit `/dashboard`, sign in via Supabase auth, then create/manage sites (calls `NEXT_PUBLIC_WEBHOOKS_API_BASE`).
5. Validation: optional `pnpm run lint`, `pnpm run typecheck`, `pnpm run format` before committing.

## Stripe Setup

1. Create three recurring prices for the Launch, Growth, and Enterprise plans. Name the price IDs so they include the site identifier, e.g. `price_weblingo_growth_monthly`.
2. Populate the matching IDs in `modules/pricing/data.ts`.
3. Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` for local development and set the `STRIPE_WEBHOOK_SECRET`.
4. Configure Stripe Pricing Tables for each locale (or reuse one) and copy the IDs into `STRIPE_PRICING_TABLE_ID` (fallback) and the locale-specific envs (`STRIPE_PRICING_TABLE_ID_EN`, `FR`, `JA`). The embed renders on `/[locale]/pricing`, with the in-app comparison table acting as a fallback.

## Deployment

- **Build**: `pnpm run build` (Next.js static + server output).
- **Hosting**: Deploy to Vercel/Netlify/Fly/etc. with Node 20.9+ and set all env vars above. Ensure the hosting URL matches `NEXT_PUBLIC_APP_URL`.
- **Supabase**: Configure the site URL and redirect URLs in Supabase Auth settings. Provide `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY` to the host.
- **Worker API**: Point `NEXT_PUBLIC_WEBHOOKS_API_BASE` to the live `webhooks` worker; enable CORS for the dashboard origin.
- **Stripe**: Add webhook endpoint pointing to `/api/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET` on the host.
- **Dashboard**: `/dashboard` uses Supabase session cookies; ensure the domain matches your Supabase config so auth cookies persist.
- **Smoke checks**: After deploy, verify `/[locale]` pages load, Stripe Pricing Table renders, and dashboard can list/create sites via the worker API.

## Roadmap For Additional Sites

- Extract modules from `internal/*` into `/packages/*` when a second SaaS app appears.
- Add authentication module (e.g., Supabase) under `internal/auth` once customer portals launch.
- Extend billing module with customer portal API when needed.
