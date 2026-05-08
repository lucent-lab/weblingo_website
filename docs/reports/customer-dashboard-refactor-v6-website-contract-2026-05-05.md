# Customer Dashboard Refactor v6 Website Contract

Date: 2026-05-05
Status: Implementation contract for the website workstream

This report mirrors the corrected v6 dashboard refactor contract inside the website
repository so dashboard route, client, schema, and smoke-test work can proceed without
depending on out-of-repo planning files.

The backend repository remains the release checklist owner for M6.5.2. This website
document owns the frontend implementation surface: dashboard IA, request budgets, typed
client schemas, route tests, i18n copy, and Playwright smoke coverage.

## Source Of Truth Rules

- Use one customer dashboard IA for Free, Starter, Pro, agency-managed customer
  workspaces, and future plans.
- Express plan differences through feature gates, quota meters, disabled actions,
  upgrade/contact-sales prompts, billing banners, and mutation locks.
- Preserve actor/subject account boundaries and subject-account-scoped cache keys.
- Do not expose raw internals in customer UI: artifact manifests, R2/KV keys,
  pointer IDs, raw provider responses, queue payload IDs, plaintext webhook secrets,
  runtime request bodies/headers/secrets, dashboard JWTs, DLQ/replay data, or
  operator-only identifiers.
- Preserve the backend error envelope:

```ts
{ error: string; details?: unknown; request_id?: string }
```

Stable machine-readable error codes belong under `details.code`.

## Dashboard Route Contract

`GET /api/sites/:siteId/dashboard` has two modes:

- Omitted `view`: preserve the current legacy `SiteDashboardResponse`.
- Recognized `view`: return a customer-safe projection response.

Recognized views:

```ts
type DashboardProjectionView =
  | "overview"
  | "languages"
  | "domains"
  | "settings"
  | "developer_tools"
  | "source_selection"
  | "quality";
```

Unknown views return `400` with:

```ts
details.code = "unsupported_dashboard_view";
```

Any recognized `view` combined with broad legacy knobs is invalid:

- `includePages`
- `includeOperationalSummary`
- `limit`
- `offset`

These mixed query modes return `400` with:

```ts
details.code = "dashboard_view_param_conflict";
```

Examples:

- `view=overview&includePages=true`
- `view=settings&includeOperationalSummary=false`
- `view=domains&limit=25`

The generated backend docs must expose `SiteDashboardRouteResponse`, a union that includes
legacy `SiteDashboardResponse` plus all projection responses. Website schemas must model
the union explicitly instead of weakening schema strictness.

## Shared Customer Primitives

Use shared customer-safe primitives across backend schemas, website Zod schemas, and UI
components. Do not create endpoint-local copies with different values.

Required status and severity values:

- Customer error severity: `"info" | "warning" | "danger"`.
- Customer serving status uses `live`, not raw `serving`.
- Customer domain status includes `pending`.
- Customer crawl status uses `CustomerCrawlStatusValue` and includes `queued`.
- Runtime request lifecycle values remain `open | reviewed | dismissed | ignored`.
- Runtime request `policySummary.version` is a string token mirroring backend
  `runtimeRequestPolicyVersion`.

Canonical standalone error summary:

```ts
export interface CustomerErrorSummaryResponse {
  errors: CustomerErrorSummaryItem[];
  pagination: OffsetPagination;
  generatedAt: string;
}
```

Overview may embed a capped `errors: CustomerErrorSummaryItem[]` summary without a
pagination object.

## Pagination Rules

Every list-like customer surface must be server-paginated from the first shipped
implementation or explicitly documented as a capped summary.

- Pages use offset pagination. Reject `cursor` with
  `details.code = "unsupported_pages_cursor"`.
- Deployment history is single-locale and offset-paginated:

```http
GET /api/sites/:siteId/deployments/history?view=customer&targetLang=fr&limit=10&offset=0
```

`targetLang` is required. Reject `cursor` with:

```ts
details.code = "unsupported_deployment_history_cursor";
```

- Error summary uses offset pagination. Reject `cursor` with:

```ts
details.code = "unsupported_error_summary_cursor";
```

## First-Load Request Budgets

Route tests must assert route-specific worker calls after normal dashboard auth/layout.

| Route                                    | First-load budget                                                                        | Must not call on first paint                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `/dashboard`                             | `listSites` max once after dedupe                                                        | site detail, site dashboard aggregate, pages, history                              |
| `/dashboard/sites/[id]`                  | one overview projection or fallback `includePages=false&includeOperationalSummary=false` | `includePages=true`, pages, deployment history, showcase, source preview, snippets |
| `/dashboard/sites/[id]/pages`            | one direct pages call                                                                    | full site detail polling, dashboard aggregate once direct endpoint exists          |
| `/dashboard/sites/[id]/source-selection` | one source-selection projection                                                          | SSR preview, mount-time preview, read-only preview                                 |
| `/dashboard/sites/[id]/quality`          | one quality projection                                                                   | consistency scans unless expanded and enabled                                      |
| `/dashboard/sites/[id]/domains`          | one domains projection                                                                   | deployment history, pages, source preview                                          |
| `/dashboard/sites/[id]/settings`         | one settings projection                                                                  | deployment history, showcase, duplicate site-list slot count                       |
| `/dashboard/sites/[id]/developer-tools`  | one developer-tools projection                                                           | dashboard JWT, snippets before explicit action                                     |
| `/dashboard/sites/[id]/runtime-requests` | one redacted observations/list call on route visit                                       | overview/settings preload                                                          |
| `/dashboard/sites/[id]/history`          | one selected history endpoint                                                            | overview/page fetches beyond nav/layout                                            |

## Polling Rules

Compact status polling starts only when initial server state indicates live work:

```ts
latestCrawlRun?.customerStatus === "queued" ||
  latestCrawlRun?.customerStatus === "in_progress" ||
  activeTranslationRuns.some(
    (run) => run.customerStatus === "queued" || run.customerStatus === "in_progress",
  );
```

Completed, failed, absent, or terminal initial states must produce zero immediate client
status fetches.

## Website Implementation Surface

Required website work:

- Centralized customer status/copy helpers using website i18n keys.
- `StatusBadge`, `FeatureGate`, `LockedFeatureCard`, `QuotaMeter`,
  `MutationLockBanner`, and `NextActionCard` primitives.
- `deriveCustomerNextAction()` fallback adapter until backend `nextAction` is available.
- Projection-aware Zod schemas and typed client functions.
- Contract tests that compare website schemas against backend OpenAPI/docs snapshots.
- E2E mocks that fail when required backend projection fields are missing.
- Request-budget route tests that prevent broad dashboard overfetch regressions.

## Guardrails For Older Dashboard Tasks

Older dashboard-related tasks must not bypass this v6 IA, request budgets, or
customer-safe projection rules. Post-M6.5.2 triage is tracked by the backend milestone
ledger and should classify older work as Keep, Supersede, Drop, or Coordinate before it
is pulled back into dashboard implementation.
