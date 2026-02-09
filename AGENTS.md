# AGENTS.md — WebLingo Marketing Site

This document guides contributors working inside the WebLingo marketing + dashboard site. The goal is to run a single SaaS website today, but structure code so modules can later move into shared packages when new products launch.

## Project Scope

- Marketing site (home, pricing, legal, contact, checkout flows).
- Lightweight dashboard surfaces for site onboarding/configuration (Supabase auth + Webhooks worker API).
- Try-Now previews: create a preview, stream status via SSE, and open the rendered preview URL once ready.
- Stripe Checkout for subscriptions; webhook to capture lifecycle events.

## Directory Layout

- `app/` — Next.js App Router entry points and API routes.
- `components/` — UI components that stay within this app.
- `content/` — MDX content (docs + blog) and indexes.
- `internal/` — Proto-packages (core env parsing, billing, i18n, future auth/db/etc.).
- `modules/` — Feature modules (pricing tiers, future account/dashboard logic).
- `styles/` — Tailwind globals.
- `docs/` — Updated guidance and runbooks.
- `tests/` — Vitest + Playwright coverage.

## Environment Variables

Define these in `.env.local` (source of truth: `internal/core/env.ts`).

Client (`NEXT_PUBLIC_*`):

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_WEBHOOKS_API_BASE` (Webhooks worker base including `/api`, e.g. `https://api.weblingo.app/api`)

Server only:

- `HOME_PAGE_VARIANT` (`classic` | `expansion`, defaults to `expansion`)
- `PUBLIC_PORTAL_MODE` (`enabled` | `disabled`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICING_TABLE_ID` (optional)
- `STRIPE_PRICING_TABLE_ID_EN` (optional)
- `STRIPE_PRICING_TABLE_ID_FR` (optional)
- `STRIPE_PRICING_TABLE_ID_JA` (optional)
- `SUPABASE_SECRET_KEY`
- `TRY_NOW_TOKEN` (optional; required to enable server-side preview proxy routes under `app/api/previews/*`)
- Redis (required; pick one provider):
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or
- `KV_REST_API_URL` + `KV_REST_API_TOKEN`

## Development Principles

- YAGNI: ship the minimal scope for the current milestone.
- DRY: centralize shared utilities/config; avoid duplication.
- SOLID: maintain cohesive modules and clear interfaces that are easy to test and evolve.
- Offensive programming with defensive boundaries: assert invariants internally and fail fast; validate inputs at boundaries and surface clear, friendly errors.
- Cohesion & readability: small modules with clear responsibilities; prefer early returns.
- Tests with code changes where practical; keep fixtures tiny.
- Logging is part of the acceptance criteria: produce exactly one wide event per request/job with correlation IDs, business context, outcome, duration, and a structured error object on failure. Avoid step-by-step log spam. See `docs/LOGGING_POLICY.md`.

### Abstraction Policy (no premature abstractions)

- Add an abstraction only when it delivers a clear, immediate, and objective benefit (e.g., removes duplication that already hurts, enables a necessary variation point, or fixes a documented pain).
- If the benefit is not obvious right now, do not add the abstraction; keep the code simple.
- Remove/avoid speculative layers, unused helpers, or indirection without current value.

## Coding Conventions

- TypeScript strict mode.
- Server components by default; client components when required (`"use client"`).
- Keep files small and focused; avoid one-letter variables.
- Update docs when behavior, APIs, or env vars change.
- Use path aliases (`@internal/*`, `@modules/*`, `@components/*`).
- Localize UI copy via `@internal/i18n` helpers; never hardcode strings in pages/components.

## Stripe Integration Contract

- `POST /api/stripe/create-checkout-session` creates a subscription Checkout session for a pricing tier. Metadata includes `siteId` so multiple SaaS projects can share one Stripe account.
- `POST /api/stripe/webhook` verifies signature, logs checkout and subscription lifecycle events.

## Preview Integration Contract

- Website server routes proxy to the Webhooks worker using `TRY_NOW_TOKEN`:
- `POST /api/previews` → `POST {NEXT_PUBLIC_WEBHOOKS_API_BASE}/previews` (adds `x-preview-token`)
- `GET /api/previews/:id` → `GET {NEXT_PUBLIC_WEBHOOKS_API_BASE}/previews/:id`
- `GET /api/previews/:id/stream` → `GET {NEXT_PUBLIC_WEBHOOKS_API_BASE}/previews/:id/stream` (SSE)
- Preview `errorCode` and `stage` enums must stay consistent with the backend `webhooks-worker` preview endpoints.

## Extraction Path (When New Sites Arrive)

1. Move `internal/*` folders into `/packages/<name>` with `tsup` or similar build step.
2. Promote `modules/*` to feature packages as needed.
3. Switch imports from `@internal/*` to package-scoped aliases (e.g., `@acme/core`).
4. Use Next.js `transpilePackages` to share code across sites.
