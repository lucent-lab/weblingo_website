# Development Guide — WebLingo Marketing Site

This guide covers local development, Stripe setup, and the proto-package layout used in the marketing site. The code is structured so internal modules can later be extracted into shared packages when new SaaS products launch.

## Prerequisites

- Node.js 20.9+
- pnpm 9+
- Stripe CLI (for webhook forwarding)

## Project Layout

- `app/` — Next.js routes (App Router) and API handlers.
- `components/` — Reusable UI for the marketing site (includes shadcn/ui wrappers under `components/ui`).
- `internal/` — Proto-packages (`core`, `billing`, `i18n`, etc.).
- `modules/` — Feature modules (pricing, future account/dashboard features).
- `styles/` — Tailwind CSS configuration and globals.

Each folder exposes a minimal public surface through `index.ts` (when present) to ease extraction into real packages later.

## Environment Variables

Create `.env.local` with:

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
HOME_PAGE_VARIANT=expansion # optional: classic | expansion (default expansion)
PUBLIC_PORTAL_MODE=enabled # required: enabled | disabled
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICING_TABLE_ID=prctbl_default
STRIPE_PRICING_TABLE_ID_EN=prctbl_for_en
STRIPE_PRICING_TABLE_ID_FR=prctbl_for_fr
STRIPE_PRICING_TABLE_ID_JA=prctbl_for_ja
NEXT_PUBLIC_WEBHOOKS_API_BASE=https://api.weblingo.app/api
NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS=15000 # required; dashboard -> webhooks API timeout in ms (integer >=1); fail-fast if missing/invalid
SUPABASE_AUTH_TIMEOUT_MS=15000 # required; server-side Supabase Auth/Admin timeout in ms (integer >=1); fail-fast if missing/invalid
```

`15000` is the recommended default for both values to balance normal cross-region latency and transient network jitter without masking upstream outages for too long.

Set `PUBLIC_PORTAL_MODE=disabled` to hide login/signup UI, block auth actions, and disable checkout flows on deployed environments.

Use descriptive Stripe price IDs that include the site identifier, e.g. `price_web_mirror_growth_monthly`.

## Internationalization

- Supported locales: English (`en`), French (`fr`), and Japanese (`ja`).
- Routes are nested under `/[locale]` (e.g., `/fr/pricing`).
- Translations live in `internal/i18n/messages/<locale>.json` using flat keys.
- Server components call `createTranslator(await getMessages(locale))`; client components receive `messages` and use `createClientTranslator(messages)`.
- When adding new copy, add keys to every locale file and consume them via the translator—never hardcode strings in UI components.
- Log messages **must** remain in English (even for localized pages) so diagnostics stay consistent across regions.

## Coding Standards

- Prefer helpers under `lib/` to avoid repeating the same `getMessages` or metadata logic across pages.
- Keep console/error logging in English and structured (objects instead of string concatenation) for easier log aggregation.

## Installing & Running

```
pnpm install
pnpm run dev
```

Other scripts:

- `pnpm run lint` — ESLint (`eslint.config.mjs`).
- `pnpm run typecheck` — TypeScript project check.
- `pnpm run format` — Prettier check.
- `pnpm run format:write` — Prettier format.

## Stripe Checklist

1. Create three products/prices (Launch, Growth, Enterprise) with IDs that include the site ID (`web_mirror`).
2. Update `modules/pricing/data.ts` with the Stripe price IDs.
3. Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` in development.
4. Copy the webhook signing secret into `.env.local`.
5. Create Stripe Pricing Tables per locale (or reuse a default) and copy the IDs into `STRIPE_PRICING_TABLE_ID` (fallback) and `STRIPE_PRICING_TABLE_ID_EN/FR/JA` so the embedded widget renders on `/[locale]/pricing` with locale-appropriate content.
6. Metadata sent with checkout sessions includes `siteId` so events remain distinguishable when sharing the Stripe account.

## Waitlist Capture

- The `/api/waitlist` endpoint writes to a Supabase table named `launch_waitlist_signups`.
- Minimum schema:

  ```sql
  create table public.launch_waitlist_signups (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    site_url text,
    user_agent text,
    referer text,
    created_at timestamptz not null default now()
  );
  ```

- Keep the unique constraint on `email` so the API can `upsert` without duplicates.
- The handler currently uses the service key. Once the schema stabilizes, generate Supabase types and replace the temporary table typings in `app/api/waitlist/route.ts`.
- Run `pnpm supabase:types` whenever the schema changes. This command requires the Supabase CLI and `SUPABASE_PROJECT_ID` env var (found in the Supabase dashboard) and regenerates `types/database.ts` with strongly typed tables used by the server/client helpers.

### Contact Form Logging

- Contact logging currently depends on the Supabase service role key via server actions. Once we add an email provider/webhook, replace this with a scoped RPC or queue so the service role key isn’t used per request.

- The contact page currently logs submissions to a `contact_messages` table.
- Suggested schema:

  ```sql
  create table public.contact_messages (
    id uuid primary key default gen_random_uuid(),
    locale text not null,
    full_name text not null,
    work_email text not null,
    domain text,
    locales text,
    message text,
    created_at timestamptz not null default now()
  );
  ```

- Submissions are inserted via Supabase service role credentials and the form redirects to `/[locale]/contact?submitted=1` on success. Once an email provider is in place, replace this logging step with the real notification flow and update the docs accordingly.

## Adding New Internal Modules

When you need new capabilities (auth, database, analytics):

1. Create a folder under `internal/<module>`.
2. Export the public surface via `internal/<module>/index.ts` (if needed).
3. Add a path alias in `tsconfig.json` (e.g., `@internal/auth`).
4. Keep implementation cohesive — avoid leaking behavior between modules.

## Preparing for Package Extraction

- Keep imports using aliases (`@internal/*`, `@modules/*`).
- Avoid circular dependencies between internal modules.
- Ensure env parsing lives in `internal/core/env.ts` and is the only place reading `process.env`.
- When ready, move modules into `/packages/*`, add `package.json` per package, and update aliases to package names.

## SEO follow-ups

- Add social share images and switch Twitter card to `summary_large_image` once assets exist.
  - Create `/public/og.png` at 1200x630 (or multiple sizes) and reference via `openGraph.images` and `twitter.images` in `app/layout.tsx`.
  - Update `twitter.card` from `summary` to `summary_large_image` after the image is available.
  - Consider locale-specific OG images if you want translated previews.

## Pending follow-ups

- Dashboard: join against future billing/subscription tables so authenticated users can see their plan, status, and renewal info instead of the current basic profile view.
