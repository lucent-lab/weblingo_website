# Dashboard Latency Remediation Report (2026-02-14)

## Decision Summary

- Full silent prefetch of all dashboard data after login is **rejected**.
- Strategy implemented: lean critical path + consolidated detail endpoint + bounded caching + deterministic invalidation.

Reasoning:

1. Full silent prefetch scales poorly with many sites/routes.
2. It increases stale-data risk and invalidation complexity.
3. High-cardinality `Link` prefetch pressure was already a load source.

## Milestone Ledger

### M0 — Baseline/Attribution

Pain: optimization claims drift without route-level attribution and contract lock.

Implemented in this phase:

- Baseline instrumentation from M14.7 remained the reference (`x-dashboard-trace-id` correlation).
- Contract lock extended to include the new consolidated endpoint.

Reviewer checks:

- Website requests send `x-dashboard-trace-id`.
- Backend wide events preserve trace IDs for correlation.

### M1 — Remove Obvious Waste

Pain: low-value background calls consumed budget on active sessions.

Implemented:

- `GET /api/dashboard/sites/[siteId]/status` now returns `{ site }` only.
- Disabled `prefetch` on high-cardinality site links:
  - overview list manage links
  - per-site sidebar submenu links

Reviewer checks:

- Polling route no longer calls deployments.
- Site-link prefetch is disabled where cardinality is high.

### M2 — Consolidate Detail Data Path

Pain: detail routes paid duplicate backend work and multiple RTTs.

Implemented:

- Added `GET /sites/{siteId}/dashboard` in webhooks:
  - default: `{ site, deployments }`
  - optional pages: `includePages=true&limit&offset`
- Migrated dashboard route consumers:
  - `/dashboard/sites/[id]`
  - `/dashboard/sites/[id]/admin`
  - `/dashboard/sites/[id]/pages`

Reviewer checks:

- Routes above load initial data from consolidated payload path.
- Backend tests enforce new endpoint contract/validation.

### M3 — Shell-First Direction

Pain: users perceive delay before useful content.

Status in this phase:

- Kept middleware auth safety unchanged.
- Focused this pass on data-path consolidation and request-count reduction first.
- Shell-first rendering remains tracked for additional route-level streaming follow-up after new baseline capture.

Reviewer checks:

- No auth-boundary regressions introduced by this pass.

### M4 — Deterministic Cache/Invalidation

Pain: partial invalidation causes stale subviews and hidden rerender churn.

Implemented:

- Added short-TTL site dashboard cache (`30s`) in `internal/dashboard/data.ts`.
- Added indexed cache-key tracking per site to invalidate all known variants (pagination offsets included).
- Updated dashboard actions to invalidate site-dashboard cache alongside list cache when required.

Reviewer checks:

- Non-structural mutations invalidate detail cache without broad list churn.
- Structural mutations still invalidate sites list + detail cache.

### M5 — Contract/Docs Cutover

Pain: drift between backend and website contracts creates hidden regressions.

Implemented:

- Synced OpenAPI snapshot from backend into website docs-generated artifacts.
- Updated dashboard docs (`dashboard-flow-and-use-cases`, `backend/DASHBOARD_SPECS`) with:
  - consolidated endpoint usage
  - prefetch policy
  - cache/invalidation policy

Reviewer checks:

- `test:contracts` passes with synced snapshots.
- Docs and route behavior align for new endpoint/status contract.

## Cache Invalidation Matrix (Implemented Policy)

| Mutation class                                                           | Invalidate sites list | Invalidate site dashboard |
| ------------------------------------------------------------------------ | --------------------- | ------------------------- |
| Structural site mutations (create/update status/locales/domains/serving) | Yes                   | Yes                       |
| Operational mutations (crawl/translate/run controls)                     | No                    | Yes                       |
| Content mutations (glossary/override/slug)                               | No                    | Yes                       |

Notes:

- Sites list cache TTL remains long-lived.
- Site dashboard cache TTL is short (`30s`) and index-backed for deterministic invalidation.

## Validation Commands Run

- Backend: `corepack pnpm test workers/webhooks-worker/src/index.test.ts`
- Backend: `corepack pnpm openapi:generate`
- Website: `WEBLINGO_REPO_PATH=../weblingo pnpm docs:sync`
- Website: `pnpm test -- "app/api/dashboard/sites/[siteId]/status/route.test.ts" internal/dashboard/webhooks.timeout.test.ts internal/dashboard/data.test.ts app/dashboard/_components/sites-list.test.tsx app/dashboard/_components/sites-nav.test.tsx internal/dashboard/webhooks.openapi-contract.test.ts`
