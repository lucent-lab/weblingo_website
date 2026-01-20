# Dashboard + Onboarding Revamp (OpenAPI-aligned, Plan-gated)

Last updated: 2025-12-18

## Goal

Make the `weblingo_website` customer dashboard a **professional, plan-aware** experience that stays in sync with the **latest `webhooks-worker` OpenAPI** and the **Cloudflare for SaaS CNAME-only onboarding** used by WebLingo v1.

Primary outcomes:

- Dashboard uses **OpenAPI-shaped data** (domains include `dnsInstructions` + `cloudflare` state).
- Domain onboarding is **subdomain-per-locale + CNAME-only**:
  - customer adds `fr.customer.com CNAME <siteId>.t.weblingo.app` (DNS-only if customer uses Cloudflare DNS),
  - WebLingo provisions via `/provision` and can `/refresh` when validation is stuck.
- UI is **gated by plan features** (no “click then get a 403” UX).
- Introduce a Clerk-like `has(...)` API for the website so UI can be declarative:
  - `Has({ feature: "glossary" })`, `Has({ quotaWithin: ... })`, `SignedIn`, `SignedOut`, etc.
- Use `shadcn/ui` components consistently.

## Non-goals (v1)

- Billing flows / upgrades (Stripe/LemonSqueezy lifecycle) beyond showing “upgrade” CTA placeholders.
- Complex page management UIs that need new backend endpoints (ex: listing overrides/slugs/pages). Keep “advanced” inputs for now.
- Full localization of dashboard copy; however, **no UI copy should be hardcoded** in components — it must come from `@internal/i18n` messages.

## Constraints

- The website project (`weblingo_website`) currently has no test runner; validations rely on:
  - `pnpm run check` (eslint + prettier + tsc)
  - manual browser checks.
- Keep changes KISS/YAGNI: avoid heavy client-side state managers or speculative abstractions.

## Milestones & Atomic Tasks

### M1 — OpenAPI parity for the website API client

- [ ] Update `internal/dashboard/webhooks.ts` schemas to match webhooks-worker OpenAPI:
  - `SiteDomain` includes `dnsInstructions` and `cloudflare`.
  - `routeConfig.pattern` can be `null`.
  - `AuthTokenResponse` and `AccountMeResponse` supported.
- [ ] Add missing API calls:
  - `GET /accounts/me`
  - `POST /sites/:siteId/domains/:domain/provision`
  - `POST /sites/:siteId/domains/:domain/refresh`
- [ ] Fix `createSite(...)` payload requirements (worker requires `sitePlan` + `maxLocales`).
- [ ] Validation: `pnpm run check`.

### M2 — Dashboard auth + entitlements (“Clerk-like has”)

- [ ] Add server-side `getDashboardAuth()` that returns:
  - Supabase user/session
  - webhooks JWT (`/auth/token`)
  - `accounts/me` feature flags + quotas
  - `has(...)` helper
- [ ] Add UI helpers:
  - `SignedIn`, `SignedOut` (server components)
  - `Has` / `HasClient` (declarative gating)
- [ ] Introduce a small dashboard i18n pattern:
  - dashboard copy lives in `internal/i18n/messages/*.json`
  - client components receive `messages` and use `createClientTranslator(...)`
- [ ] Validation: `pnpm run check` + manual “can log in and load /dashboard”.

### M3 — Domains onboarding UX (Cloudflare SaaS / CNAME-only)

- [ ] Replace TXT-centric UI with Cloudflare SaaS flow when `dnsInstructions` exist:
  - show the exact CNAME record to add
  - explain “DNS-only (grey cloud) if using Cloudflare DNS”
  - provide buttons: **Provision** and **Refresh**
  - display Cloudflare status and last errors (CAA, validation errors)
- [ ] Keep TXT `/verify` UI only for local/dev when `dnsInstructions` is absent.
- [ ] Validation: manual flow on a test site + `pnpm run check`.

### M4 — Site onboarding wizard (create → connect domains → crawl)

- [ ] Add `sitePlan` + `maxLocales` inputs:
  - default/max based on `accounts/me` flags/quotas
  - prevent “free user sends maxLocales=null and bypasses limits” (UI must enforce)
  - server-side enforcement: webhooks worker validates plan limits and rejects mismatches (UI gating is not sufficient)
- [ ] Improve post-create UX:
  - redirect to the site page after creation
  - show “Next steps” banner: add CNAME(s) → provision → trigger crawl
- [ ] Validation: manual flow in browser.

### M5 — Plan-gated dashboard IA (professional UX)

- [ ] Restructure site detail view into clear sections/tabs:
  - Overview, Domains, Deployments, Glossary (if enabled), Overrides (if enabled), Slugs (if enabled), Settings
- [ ] Hide/disable nav items and actions when not allowed by plan (`featureFlags`) or site plan (`site.sitePlan`).
- [ ] Remove or redirect the legacy debug dashboard at `/:locale/dashboard` to avoid confusion.
- [ ] Validation: manual browse + `pnpm run check`.

### M6 — Docs / env alignment

- [ ] Update `weblingo_website/README.md` / `docs/DEVELOPMENT_GUIDE.md` to reflect:
  - `NEXT_PUBLIC_WEBHOOKS_API_BASE=https://api.weblingo.app/api`
  - domain onboarding steps (CNAME + provision/refresh)
- [ ] Validation: `pnpm run check`.

## Implementation Notes

- The worker disables TXT `/verify` when Cloudflare SaaS is enabled. The dashboard must treat `/verify` as local/dev only.
- For Cloudflare DNS customers: proxied (orange-cloud) records can hide the CNAME; instruct DNS-only for the routing CNAME.
