# Lemon Squeezy Migration Plan

Plan to replace Stripe billing (checkout, webhook, pricing table) with Lemon Squeezy while keeping Supabase auth provisioning and existing pricing tiers.

## 1) Align products, pricing, and env contract

- Create Lemon Squeezy products/variants for each tier/cadence; capture IDs (product + variant) and test vs live URLs.
- Define required env vars (e.g., `NEXT_PUBLIC_LS_STORE_ID`, `NEXT_PUBLIC_LS_API_KEY`, `LS_WEBHOOK_SECRET`, variant IDs per tier/cadence, optional embed domain) and add to `internal/core/env.ts`, `.env.example`, README.
- Map `modules/pricing/data.ts` to include LS variant IDs per tier/cadence (keep price display strings intact).

## 2) Replace checkout creation API

- Add `internal/billing/lemonsqueezy.ts` helper to create checkout URLs/sessions with metadata (`siteId`, `planId`, `cadence`) and handle test mode.
- Introduce `/api/billing/create-checkout` (or rename existing route) to validate payload, call LS helper, and return the checkout URL.
- Remove Stripe client dependency from the route and update error handling to LS responses.

## 3) Swap marketing checkout UX

- Replace Stripe Pricing Table embed in `components/pricing-teaser.tsx` with LS buy button/checkout link handling (inline button or modal).
- Update CTA links in pricing cards to hit the new API route and redirect to LS checkout; keep locale-aware URLs.
- Remove `types/stripe-pricing-table.d.ts` and any Stripe script includes.

## 4) Rewrite webhook handling

- Add LS webhook verifier (raw body + `x-signature` header) and event parser; document required header names.
- Replace `app/api/stripe/webhook/route.ts` with `/api/lemonsqueezy/webhook` (or repoint) to handle subscription lifecycle events. Map LS payload fields to internal shapes (customer email/ID, subscription ID, status, plan/variant metadata).
- Re-implement Supabase provisioning/upsert logic using LS event data; rename metadata keys (`lemonsqueezyCustomerId`, etc.).

## 5) Update shared pricing/config utilities

- Replace `internal/billing/index.ts` exports to point to LS helpers (checkout, webhook verify, pricing table resolver equivalent if needed).
- Remove Stripe-specific helpers (`pricing-table.ts`, `createCheckoutSession`, `verifyStripeSignature`) once LS equivalents exist.

## 6) Dependency and config cleanup

- Remove `stripe` package and related types; add LS SDK if using it (or fetch wrapper).
- Update `AGENTS.md`, README, and any docs referencing Stripe setup, CLI commands, or price/table IDs.
- Prune unused env vars from `.env.example` and local `.env`.

## 7) Data/backfill considerations

- Decide on handling existing Stripe customers/subscriptions (freeze, manual migration, or dual-wiring). If dual-wiring, add feature flag to choose provider per site/tenant.
- Migrate stored metadata keys in Supabase (customer/subscription IDs) if persisted elsewhere.

## 8) Testing and QA

- Add unit tests for LS helper (URL construction, metadata), webhook verifier, and API route validation.
- Create mocked webhook payload fixtures for lifecycle events (checkout completed, subscription updated/canceled) and assert Supabase interactions.
- Run end-to-end smoke: pricing page CTA → LS checkout (test) → webhook → Supabase user creation → dashboard access.

## 9) Rollout plan

- Behind a feature flag or environment toggle, deploy to staging with LS test mode.
- Validate webhooks and Supabase provisioning in staging; switch production env vars when ready.
- Monitor logs for webhook failures and Supabase errors; add alerting on non-2xx webhook responses.
