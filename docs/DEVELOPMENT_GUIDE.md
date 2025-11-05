# Development Guide — WebLingo Marketing Site

This guide covers local development, Stripe setup, and the proto-package layout used in the marketing site. The code is structured so internal modules can later be extracted into shared packages when new SaaS products launch.

## Prerequisites

- Node.js 18+
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
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICING_TABLE_ID=prctbl_default
STRIPE_PRICING_TABLE_ID_EN=prctbl_for_en
STRIPE_PRICING_TABLE_ID_FR=prctbl_for_fr
STRIPE_PRICING_TABLE_ID_JA=prctbl_for_ja
```

Use descriptive Stripe price IDs that include the site identifier, e.g. `price_web_mirror_growth_monthly`.

## Internationalization

- Supported locales: English (`en`), French (`fr`), and Japanese (`ja`).
- Routes are nested under `/[locale]` (e.g., `/fr/pricing`).
- Translations live in `internal/i18n/messages/<locale>.json` using flat keys.
- Server components call `createTranslator(await getMessages(locale))`; client components receive `messages` and use `createClientTranslator(messages)`.
- When adding new copy, add keys to every locale file and consume them via the translator—never hardcode strings in UI components.

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
