# Slow Dashboard Performance Report (2026-01-02)

## Executive Summary
The customer dashboard is slow because each navigation triggers multiple remote round-trips to Supabase and the Cloudflare "webhooks" worker before any page data renders. Public marketing pages remain fast because they are mostly static and do not depend on these upstream calls. The highest fixed cost per request is the auth bootstrap flow, which calls `/auth/token` and `/accounts/me` on every request. When the database has little data, this fixed per-navigation overhead dominates; pagination and large query volume remain important for scale but are not the primary explanation for current 5-6 second loads.

This report consolidates initial measurements, code-level findings, and two independent review notes. It verifies which findings are accurate in the current codebase and proposes a Vercel-only mitigation plan that does not require direct Cloudflare access. The recommended fix is **Option B + C**: a short-lived server cache for a combined "bootstrap" call that returns both the webhooks JWT and the `AccountMe` snapshot.

## Audience and Scope
This is a standalone report for readers unfamiliar with the codebase. It explains the architecture, where latency originates, and a step-by-step mitigation plan that can be implemented in the Next.js frontend on Vercel.

## Architecture Overview
- Frontend: Next.js (App Router) deployed on Vercel.
- Auth: Supabase (session cookies).
- API: Cloudflare Workers, specifically the `weblingo-webhooks` worker.
- Dashboard route structure: `/dashboard/**` uses a shared layout that runs on every navigation.

High-level request flow:
```
Browser -> Next.js (Vercel) -> Supabase (session) -> webhooks worker -> Supabase
```

## Dashboard Request Flow (Simplified)
Every request to `/dashboard/**` currently executes:
1) Supabase session lookup in Next.js server components.
2) Webhooks token exchange: `/auth/token`.
3) Account snapshot: `/accounts/me`.
4) Page-specific API calls: `/sites/:id`, `/pages`, `/deployments`, etc.

Even when page calls are parallelized, the total render time is dominated by the slowest upstream call plus the auth bootstrap overhead.

## Observed Symptoms
Public pages are fast; dashboard pages take several seconds. Example timing logs:
- `/auth/token` ~1948 ms
- `/accounts/me` ~1085 ms
- `/sites/:id` ~1844 ms
- `/sites/:id/pages` ~1844 ms
- `/sites/:id/deployments` ~2441 ms
- Total server render ~6.5 s (render 5.8 s, middleware 0.56 s)

### Post-Milestone 1 Update (Bootstrap Cache Enabled)
After enabling the bootstrap cache, `/auth/token` and `/accounts/me` no longer appear on cache-hit navigations. Render times drop to ~1.8-2.1 s, with remaining time dominated by `/sites`, `/deployments`, and `/pages` calls (~1.2-1.4 s each). This confirms the auth bootstrap tax is removed and the remaining latency is in site data endpoints.

### Post-Milestone 2 Update (Layout Fetch Reduction)
The dashboard now defers the sites sidebar/usage behind Suspense, and `listSites` + `listSupportedLanguages` are cached with short TTLs. Site mutations invalidate the sites cache, keeping navigation data fresh without blocking first paint.

## Measurements and Interpretation
Two independent signals are important:
1) **Webhooks timing logs in Next.js** show 1-2.5 second response times per endpoint.
2) **Cloudflare Worker analytics** for the last 15 minutes show low compute time:
   - 10 requests, total duration ~1.46 (avg ~0.146 per request).

Interpretation: the worker is not CPU-bound. Most of the latency is waiting on upstream calls (Supabase, network, or large query results). Worker compute time excludes time spent waiting on subrequests, so low compute is consistent with I/O-bound latency. If the dataset is small, the most likely cause is fixed overhead from multiple round-trips rather than data volume.

## Verified Root Causes (With Code Evidence)

### 1) Auth bootstrap runs on every request
The dashboard layout runs `requireDashboardAuth()` for every `/dashboard/**` navigation.
- File: `weblingo_website/app/dashboard/layout.tsx`
- Auth logic: `weblingo_website/internal/dashboard/auth.ts`

That function:
- Exchanges the Supabase access token for a webhooks JWT (`/auth/token`).
- Fetches account entitlements (`/accounts/me`).
- Sometimes fetches agency customers.
- Sometimes repeats the exchange for a subject account (agency switching).

This adds 2-3 seconds before page-specific data is requested.

### 2) N+1 style queries in the webhooks worker
The independent review correctly identified a query amplification pattern in `/sites/:id/deployments`. In the current code:
- File: `weblingo/workers/webhooks-worker/src/handlers/sites.ts` (`listDeployments`)
- Behavior: for each locale, call `repos.translationRuns.findActiveRun(...)`
- Implementation uses `Promise.all`, so the calls are parallel, not sequential, but **it is still N queries per request**, which magnifies upstream latency.

Proposed fix: add a batch query like `findActiveRunsBySite(siteId)` to fetch all active runs in one call.

### 3) Unbounded pages list + large IN clause
The independent review's diagnosis of `/sites/:id/pages` is accurate:
- File: `weblingo/workers/webhooks-worker/src/handlers/sites.ts` (`listPages`)
- Behavior: fetches **all** pages for a site (no pagination), then queries `page_versions` with `in.(id1,id2,...idN)` to find the latest version.
- This is not an N+1 query, but it is **an unbounded query plus a large IN clause**, which degrades as page count grows and can stress the Supabase REST API.

Proposed fix: add pagination (default 50-100) and use a SQL JOIN or `DISTINCT ON` to fetch latest version per page in one query.

### 4) Requests are intentionally uncached
The webhooks client uses `cache: "no-store"` for all requests.
- File: `weblingo_website/internal/dashboard/webhooks.ts`
- This is correct for freshness but prevents reuse across navigations.

### 5) Middleware adds fixed cost
Supabase session refresh middleware adds about 0.5 seconds in observed logs.
- File: `weblingo_website/lib/supabase/middleware.ts`

### 6) Regional latency
Vercel region, Cloudflare worker location, and Supabase region may not be aligned. This adds network latency. It does not explain the full delay, but it amplifies query-heavy endpoints.

## Additional Contributors to Validate (Small-Data Cases)
These are likely contributors when tables are small but page loads are still multi-second:

### A) Immediate re-issue of `/auth/token`
The token mint flow re-issues a new token if the returned `expiresAt` is "expiring soon" (within 5 minutes) or fails to parse:
- File: `weblingo_website/internal/dashboard/auth.ts`
- Logic: `mintWebhooksAuth()` calls `/auth/token` and then re-issues if `isExpiringSoon(expiresAt)` returns true.

If the worker returns a short TTL (<= 5 minutes) or an unparseable timestamp, each navigation can call `/auth/token` twice. This is independent of database size and can add ~1-2 seconds on its own.

Suggested validation: log `expiresAt`, `Date.parse(expiresAt)`, and `(expiresAt - now)` for a few requests to confirm whether the immediate re-issue path is firing.

### B) Fixed per-request work in the layout
The dashboard layout fetches session + user plus the webhooks bootstrap on every `/dashboard/**` request. Even if each query returns a single row, repeated cross-region calls stack up.

### C) RLS or external API latency inside worker handlers (if any)
If worker handlers call external services (e.g., billing) or rely on heavy RLS policies, each statement can incur extra latency even when tables are small. This is not confirmed in the current logs, but it is a common source of "slow with tiny data" behavior and should be verified with query timing inside the worker.

## Review Notes From External Assessments (Validated)
Two external notes were reviewed and partially validated against the codebase:
- **Confirmed:** auth bootstrap on every request, request-scoped caching only, `cache: "no-store"` usage.
- **Confirmed:** `/sites/:id/deployments` issues multiple DB calls per locale (parallel but still N calls).
- **Confirmed:** `/sites/:id/pages` fetches all pages without pagination and uses a large IN clause for versions.
- **Adjusted:** the external review described deployments queries as sequential; the code uses `Promise.all`, so they are parallel, but still multiple DB queries.

## Counter-Analysis Clarifications (Added)
An additional review emphasized that with small datasets the main culprit is fixed per-navigation overhead, not pagination. That is consistent with the logs and matches the primary diagnosis here. The counter-analysis also recommends tightening implementation details for caching and bootstrap to avoid wasted work; those improvements are captured below in the "Implementation Hardening" section and in the milestones.

## Potential Fixes (Pros and Cons)

### Option A: httpOnly cookie cache (token + account)
**What:** Store `{webhooksToken, accountMe, expiresAt, subjectAccountId}` in an httpOnly cookie.
- Pros: Fast to implement, large latency win.
- Cons: Cookie size limits, staleness risk, more complex logout/expiry handling.
- Agency switch: include `subjectAccountId` in the cookie and overwrite on switch.

### Option B: Server-side TTL cache (recommended)
**What:** Cache `{webhooksToken, accountMe}` in a short TTL store keyed by session access token and subject account.
- Pros: Industry standard, secure (no large cookies), easy TTL tuning.
- Cons: Requires a shared cache (KV/Redis).
- Agency switch: include `subjectAccountId` in the cache key for isolation.

### Option C: Combined bootstrap payload (single function)
**What:** A single bootstrap function returns token + account snapshot in one combined response.
- Pros: Reduces call-site complexity; removes a worker round-trip only if implemented in the worker (or if `/auth/token` returns AccountMe).
- Cons: Still called every request unless paired with caching.
- Agency switch: pass `subjectAccountId` and return subject-scoped data.

### Option D: Cloudflare bootstrap endpoint + worker cache
**What:** Implement a single `/dashboard/bootstrap` endpoint in the Cloudflare worker and cache the combined payload in Cloudflare (KV/DO/Cache API).
- Pros: Removes multiple network hops, keeps caching closest to the expensive upstream work, avoids Vercel KV read limits.
- Cons: Requires backend changes (worker + possibly shared cache binding), additional deployment step.
- Agency switch: cache key must include `subjectAccountId` to prevent leakage.

## Recommended Solution: Option B + C (Vercel-only)
This solution requires no direct Cloudflare access. It runs entirely within the Next.js app on Vercel. In this path, Option C combines the payload in-process; it does not remove worker round-trips on a cache miss, but it makes caching straightforward and consistent.

### Step 1: Add a server-only bootstrap function
Prefer a server-only function (not an internal HTTP call) that:
- Reads Supabase session (server-side).
- Calls `/auth/token` (with optional `subjectAccountId`).
- Calls `/accounts/me` using the new webhooks token.
- Returns a combined payload: `{ webhooksToken, expiresAt, entitlements, actorAccountId, subjectAccountId, account }`.

Optionally expose an API route for debugging only, but keep the dashboard render path in-process to avoid extra hops and header forwarding complexity.

### Step 2: Add a short TTL server cache
Use Vercel KV (Upstash) or Redis:
- Cache key: `envPrefix + ":" + sha256(session.access_token + ":" + subjectAccountIdNormalized)`.
- TTL: short and bounded by token expiry (e.g., `min(300s, expiresAt - now - 60s)`), clamp to a minimum (e.g., 30s) and skip caching if expiry is too close.
- Return cached data when fresh; otherwise re-bootstrap and cache.
- Add stampede protection (single-flight) to avoid multiple concurrent misses re-issuing tokens.

**Vercel KV free tier:** 30,000 reads per month (approx 3,000/day). This can be exceeded with frequent dashboard usage; monitor read count.

### Step 3: Use cached bootstrap in `requireDashboardAuth()`
Replace direct calls to `/auth/token` and `/accounts/me` with the cache-backed `getBootstrap()` result, preserving current entitlement logic.

### Step 4: Be explicit about cold start behavior
The first navigation after login or cache expiry still pays the full bootstrap cost. Subsequent navigations within TTL are fast. Optionally pre-warm the cache immediately after login to hide the first miss.

## Implementation Hardening (Ship-Ready Details)
- Keep bootstrap in-process (server-only) to avoid an internal HTTP hop and header forwarding complexity.
- Add stampede protection so parallel requests do not re-issue tokens on cache miss.
- Prefix cache keys with environment and normalize empty subject IDs to avoid accidental duplicates.
- Bound TTL by token expiry with a small safety buffer (e.g., 60 seconds).
- Never log Supabase access tokens or minted worker JWTs.
- Avoid immediate re-issue after a fresh mint; only refresh when using a cached token that is near expiry.
- In agency mode, consider returning both actor + subject data in one payload.
- Add trace IDs and cache hit/miss logs so Phase 2 optimizations are data-driven.

## Alternative Recommended Solution: Option D (Frontend + Backend)
If backend changes are allowed, a Cloudflare-side bootstrap endpoint with worker-local caching is the fastest path to reducing fixed overhead and avoids Vercel KV limits. Vercel still performs server-side fetching, but the worker does the heavy lifting once per TTL window. Treat this as the preferred upgrade path if KV read volume is high or cold-load latency remains unacceptable.

## Agency Switch Handling
When an agency acts on behalf of a customer:
- Cache key must include `subjectAccountId` so one customer's entitlements never leak to another.
- Maintain separate cache entries for actor and each subject.
- On switch:
  - Mint subject token and cache it under the subject key.
  - Optional: delete previous subject key, but short TTL is generally sufficient.
  - Consider returning both actor + subject payloads from bootstrap when agency mode is active to avoid reintroducing multiple round-trips.

## Additional Backend Optimizations (Worker + Supabase)
These are not Vercel-only changes but are likely required for sub-second dashboards.

### A) Fix deployments N+1 queries
- Add a repository method to fetch active translation runs by site in one query.
- Replace the per-locale `findActiveRun` calls with a single query + map.

### B) Add pagination and a join for pages
- Default page size: 50-100.
- Join pages with their latest version in SQL or use `DISTINCT ON`.
- Avoid large `in.(...)` filters in REST calls.

### C) Index review
Potential indexes to consider (verify with query plans):
- `page_versions(crawl_run_id)` (currently missing; see `page_versions` schema in `infra/supabase/migrations/0001_init.sql`)
- `translation_runs(site_id, status, created_at desc)` if batch lookup by site and status becomes common

## Expected Impact
With the short TTL cache:
- `/auth/token` and `/accounts/me` should drop to near zero on most navigations.
- Total server render should drop by ~2-3 seconds in the current environment.

With worker query optimization:
- `/deployments` and `/pages` should drop by ~1-2 seconds for medium-to-large sites.

Combined, the dashboard should feel near-instant after the first navigation.

## Metrics to Track
- Count and latency of `/auth/token` and `/accounts/me` per navigation.
- P95 duration of `/deployments` and `/pages`.
- Overall server render time for key dashboard routes.
- Vercel KV read volume and cache hit rate.
- Bootstrap cache hit/miss ratio and bootstrap duration.
- Worker trace ID correlation (Next.js -> worker) for end-to-end latency attribution.

## Milestones and Task Checklist
Milestones are ordered from low-risk to higher-impact changes. Each milestone includes atomic tasks with checkboxes and indicates whether it is frontend-only or frontend + backend.

### Milestone 1: Bootstrap Cache on Vercel (Frontend-only)
Goal: Remove repeated auth bootstrap cost without touching the Cloudflare worker.
- [x] Implement a server-only `getBootstrap()` function returning `{ token, expiresAt, account, entitlements, actorAccountId, subjectAccountId, agencyCustomers }`.
- [x] Create a server cache wrapper (Vercel KV/Upstash) with TTL <= token expiry.
- [x] Define the cache key format: `envPrefix + ":" + sha256(session.access_token + ":" + subjectAccountIdNormalized)`.
- [x] Add stampede protection (single-flight or lock) for cache misses.
- [x] Update `requireDashboardAuth()` (and helpers) to call `getBootstrap()` instead of `/auth/token` + `/accounts/me` directly.
- [x] Ensure agency switching uses a separate cache key per subject account.
- [x] Add a simple cache hit/miss log (or metric) for visibility.
- [x] Update `.env.example` and documentation to include any new KV variables.
- [ ] (Optional) Add a debug API route to expose the bootstrap response for diagnostics.

### Milestone 2: Layout Fetch Reduction (Frontend-only)
Goal: Remove extra fixed calls that block rendering even after auth is cached.
- [x] Cache `listSites()` and `listSupportedLanguages()` with a short TTL or move them into the bootstrap response (minimal fields only).
- [x] Ensure the dashboard layout does not block on sidebar data (use Suspense or defer, render the shell immediately).
- [x] Add Next.js cache tags or revalidation hooks for mutations that change site lists.

### Milestone 3: Cloudflare Bootstrap Endpoint + Worker Cache (Frontend + Backend)
Goal: Reduce network hops further and avoid Vercel KV limits.
- [x] Add `POST /dashboard/bootstrap` in the webhooks worker to return the combined payload in one response.
- [x] Cache the bootstrap response in Cloudflare (KV/DO/Cache API) with TTL bound by token expiry.
- [x] Update the Vercel bootstrap route to call the worker endpoint (single call).
- [x] Add logs/metrics for cache hit rate and total bootstrap latency.

### Milestone 4: Worker Query Optimization + DB Indexes (Backend)
Goal: Reduce slow `/deployments` and `/pages` endpoints at scale.
- [ ] Add `findActiveRunsBySite(siteId)` to `packages/db/src/translation-runs.ts`.
- [ ] Update `listDeployments` to use the batch query instead of per-locale calls.
- [ ] Add pagination to `listPages` with a default limit (50-100).
- [ ] Replace the large IN clause with a SQL join or `DISTINCT ON` for latest page version.
- [ ] Add a new Supabase migration for missing indexes (e.g., `page_versions(crawl_run_id)`).
- [ ] Add tests or a targeted benchmark for `/deployments` and `/pages`.

### Milestone 5: Instrumentation and Traceability (Frontend + Backend)
Goal: Make performance regressions measurable and keep Phase 2 targeted.
- [ ] Add a `traceId` header from Next.js to the webhooks worker requests.
- [ ] Log per-request query counts and DB time inside the worker for key endpoints.
- [ ] Log bootstrap cache hit/miss and total bootstrap duration in Next.js.

## Appendix: Sample Log Snippet
```
[webhooks] timing { path: '/auth/token', method: 'POST', status: 200, ok: true, retry: false, durationMs: 1948 }
[webhooks] timing { path: '/accounts/me', method: 'GET', status: 200, ok: true, retry: false, durationMs: 1085 }
[webhooks] timing { path: '/sites/<id>', method: 'GET', status: 200, ok: true, retry: false, durationMs: 1844 }
[webhooks] timing { path: '/sites/<id>/pages', method: 'GET', status: 200, ok: true, retry: false, durationMs: 1844 }
[webhooks] timing { path: '/sites/<id>/deployments', method: 'GET', status: 200, ok: true, retry: false, durationMs: 2441 }
GET /dashboard/sites/<id>/pages 200 in 6.5s (compile: 147ms, proxy.ts: 563ms, render: 5.8s)
```
