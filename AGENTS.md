# AGENTS.md — WebLingo Marketing Site

This document guides contributors working inside the `web` marketing site for WebLingo. The goal is to run a single SaaS website today, but structure code so modules can later move into shared packages when new products launch.

## Project Scope

- Single marketing site for WebLingo (home, pricing, legal, contact, checkout flows).
- Stripe Checkout for subscriptions; webhook to capture lifecycle events.
- No multi-tenant routing, dashboards, or authenticated app surfaces.

## Directory Layout

- `app/` — Next.js App Router entry points and API routes.
- `components/` — UI components that stay within this app.
- `internal/` — Proto-packages (core env parsing, billing, i18n, future auth/db/etc.).
- `modules/` — Feature modules (pricing tiers, future account/dashboard logic).
- `styles/` — Tailwind globals.
- `docs/` — Updated guidance and runbooks.

## Environment Variables

Define these in `.env.local`:

- `NEXT_PUBLIC_APP_URL`
- `HOME_PAGE_VARIANT` (`classic` | `expansion`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICING_TABLE_ID`
- `STRIPE_PRICING_TABLE_ID_EN`
- `STRIPE_PRICING_TABLE_ID_FR`
- `STRIPE_PRICING_TABLE_ID_JA`

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

## Extraction Path (When New Sites Arrive)

1. Move `internal/*` folders into `/packages/<name>` with `tsup` or similar build step.
2. Promote `modules/*` to feature packages as needed.
3. Switch imports from `@internal/*` to package-scoped aliases (e.g., `@acme/core`).
4. Use Next.js `transpilePackages` to share code across sites.
