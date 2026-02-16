# Customer Dashboard Integration Guide (WebLingo)

Purpose: single source of truth for the customer dashboard. Includes API contracts (backend), UX feature map (front-end), and integration steps. The dashboard is a separate project that uses Supabase Auth and calls the WebLingo webhooks worker APIs documented here.

## Related docs

- `docs/dashboard-flow-and-use-cases.md` — UX flows tied to these endpoints.
- `docs/AGENCY_CLIENT_APP_GUIDE.md` — agency-specific plan gating guidance.

## Table of Contents

- [Auth & Base URLs](#auth--base-urls)
- [Resource Shapes & Error Format](#resource-shapes--error-format)
- [API Surfaces (Backend)](#api-surfaces-backend)
- [UX Feature Map (Frontend Planning)](#ux-feature-map-frontend-planning)
- [Integration Steps](#integration-steps)
- [Service-Key-Only Surfaces](#service-key-only-surfaces)
- [Gaps / Future Work](#gaps--future-work)

## Auth & base URLs

- All HTTP APIs live in `workers/webhooks-worker` under `/api`. Example: `https://api.weblingo.app/api/sites` (override via `NEXT_PUBLIC_WEBHOOKS_API_BASE`).
- Auth uses a Bearer JWT signed with `WEBHOOK_SECRET` (HMAC-SHA256). Treat the token as opaque; rely on `/accounts/me` or `/dashboard/bootstrap` for entitlements and feature flags.
- Headers on JSON requests: `Authorization: Bearer <token>`, `Content-Type: application/json`.
- Multi-tenant scoping: the worker scopes requests to the subject account in the token; clients should not send account IDs in request bodies.

### Auth bridge (Supabase Auth → webhooks-worker token)

`POST /api/auth/token`

- Headers: `Authorization: Bearer <Supabase access token>`.
- Behavior: validates the Supabase token via `/auth/v1/user`, then returns a short-lived webhooks JWT (`sub = user.id`, exp ≈ 1h).
- Response `200`: `{ token, expiresAt, entitlements: { planType, planStatus }, actorAccountId, subjectAccountId }`.
- Client flow: after Supabase login, exchange the access token here, use the JWT server-side (no client storage), refresh before expiry (5-minute buffer), and retry once on 401.

### Dashboard bootstrap (optional)

`POST /api/dashboard/bootstrap`

- Body: `{ subjectAccountId?, includeAgencyCustomers? }`.
- Response `200`: `{ token, expiresAt, entitlements, actorAccountId, subjectAccountId, account, agencyCustomers }`.
- Use when you need auth + entitlements + account context in a single call.

## Resource shapes & error format

- **Error responses**: JSON `{ error, details? }` with an HTTP status. Common cases:
  - Invalid payload: 400 `{ error: "targetLangs exceeds the per-site locale limit", details: null }`.
  - Starter-gated features (glossary/overrides/slugs): 403 `{ error: "Feature not available on starter plan (glossary)", details: null }`.
  - Feature-flag rejections: 403 with stable codes for frontend UX:
    - Demo read-only: `{ error: "Demo account is read-only", details: { code: "demo_read_only" } }`
    - Site creation disabled: `{ error: "Site creation is disabled for this account", details: { code: "site_create_disabled" } }`
    - Crawl trigger disabled: `{ error: "Crawl triggers are disabled for this account", details: { code: "crawl_trigger_disabled" } }`
    - Slug edits disabled: `{ error: "Slug edits are disabled for this account", details: { code: "slug_edit_disabled" } }`
- **Site**:
  - Returned by detail surfaces (`GET /api/sites/:id`, `GET /api/sites/:id/dashboard`).
  - `id`, `accountId`, `sourceUrl`, `status` (`"active"|"inactive"`).
  - `siteProfile`: object or `null`.
  - `servingMode`: `"strict" | "tolerant"`.
  - `maxLocales`: number or `null` (null = no cap).
  - `webhookUrl`, `webhookSecret`: string or `null`.
  - `routeConfig`: `RouteConfig` or `null`.
  - `locales`: `[{ sourceLang, targetLang, alias?, serveEnabled }]`.
  - `domains`: `[{ domain, status, verificationToken, verifiedAt?, lastCheckedAt?, dnsInstructions?, cloudflare? }]`.
  - `latestCrawlRun`: object or `null`.
  - Account plan/feature gating is sourced from `/accounts/me` (no per-site plan field).
- **SiteSummary**:
  - Returned by `GET /api/sites` list surface.
  - `id`, `accountId`, `sourceUrl`, `status`, `servingMode`, `maxLocales`, `siteProfile`.
  - List-level aggregates: `sourceLang`, `targetLangs`, `localeCount`, `serveEnabledLocaleCount`, `domainCount`, `verifiedDomainCount`.
  - Does **not** include sensitive/detail fields (`webhookSecret`, `verificationToken`, full route internals, domains/locales arrays).
- **PageSummary**:
  - Returned by `GET /api/sites/:id/pages` and `GET /api/sites/:id/dashboard` when `includePages=true`.
  - `id`, `sourcePath`.
  - `lastSeenAt`, `lastCrawledAt`, `lastSnapshotAt`, `nextCrawlAt`, `lastVersionAt` (ISO strings or `null`).
- **Pagination**:
  - Returned alongside `pages` on paginated page-list responses (`GET /api/sites/:id/pages` and `GET /api/sites/:id/dashboard` when `includePages=true`).
  - `{ limit, offset, total, hasMore }`.
- **RouteConfig**:
  - `sourceLang`, `sourceOrigin`, `pattern` (string or `null`).
  - `locales`: `[{ lang, origin, routePrefix }]`.
  - `clientRuntimeEnabled`: boolean.
  - `crawlCaptureMode`: `"template_plus_hydrated" | "template_only"`.
  - `translatableAttributes`: `string[] | null`.
  - `spaRefresh`: object or `null`.
- **CrawlStatus**: `{ enqueued: boolean, error?: string }`.
- **Deployment**: `{ targetLang, status, deploymentId?, activatedAt?, routePrefix?, artifactManifest?, activeDeploymentId?, domain?, domainStatus?, serveEnabled, servingStatus, translationRun? }`.
- **GlossaryEntry**: `{ source, target, targetLangs?, matchType?, caseSensitive?, scope? }`.
- **TranslationRun**: `{ id, siteId, targetLang, status, pagesTotal, pagesCompleted, pagesFailed, startedAt?, finishedAt?, createdAt?, updatedAt? }`.
- **Slug update**: `{ pageId, lang, path, crawlStatus }`.
- Placeholders must be preserved verbatim (`⟪token⟫`) in manual overrides; counts must match the source segment.

## API surfaces (backend)

### Accounts + metadata

`GET /api/accounts/me`

- Response: `{ accountId, planType, planStatus, featureFlags, dailyCrawlUsage, quotas }`.

`POST /api/accounts/claim`

- Response: `{ accountId, status }`.

`GET /api/meta/languages`

- Response: `{ languages: [{ tag, englishName, direction }] }`.

`PUT /api/digests/subscription`

- Payload: `{ email?, frequency }` (frequency: `daily | weekly | off`).
- Response: `{ subscription }`.

`POST /api/dashboard/bootstrap`

- Payload: `{ subjectAccountId?, includeAgencyCustomers? }`.
- Response: `{ token, expiresAt, entitlements, actorAccountId, subjectAccountId, account, agencyCustomers }`.

### Agency management

`GET /api/agency/customers` and `POST /api/agency/customers`

- Use for listing and inviting managed customer accounts.

### Sites (onboarding & management)

`POST /api/sites`

- Payload (required): `{ sourceUrl, sourceLang, targetLangs: [...], subdomainPattern, servingMode, maxLocales }`.
  - `subdomainPattern` must contain `{lang}`; it can be a bare host (`{lang}.example.com`) or include scheme/path (`https://www.example.com/{lang}/docs`). Hostnames derived from this pattern seed `site_domains`; path segments become `routePrefix` per locale.
  - Optional: `siteProfile` (object or `null`), `localeAliases` map of `{ [targetLang]: "alias" | null }` to override the `{lang}` token per locale (lowercase letters/numbers/hyphens only).
  - Optional: `crawlCaptureMode`, `clientRuntimeEnabled`, `translatableAttributes`, `spaRefresh`, `webhookUrl`, `webhookSecret`.
  - `maxLocales` is a positive integer per site or `null` (no cap). `targetLangs` cannot exceed `maxLocales` when provided.
- Behavior: validates `sourceUrl` (HTTP 200), reads robots/sitemaps to seed initial pages, creates site + locales + route config, inserts domain records with verification tokens, and sets the site to `inactive` until activation.
- Response `201`: `{ ...site, crawlStatus }` (typically `{ enqueued: false }` until activation).

`GET /api/sites` → `{ sites: SiteSummary[] }` scoped to account.

- **Breaking change:** list responses are summary-only and exclude detail fields such as `locales`, `domains`, `routeConfig`, `webhookSecret`, and `verificationToken`. For full details, call `GET /api/sites/:id` or `GET /api/sites/:id/dashboard`.

`GET /api/sites/:id` → `Site`.

`GET /api/sites/:id/dashboard`

- Consolidated detail payload for dashboard screens.
- Query:
  - `includePages` (optional boolean, default `false`).
  - `limit` (optional integer, default `25`, valid range `1..200`; used only when `includePages=true`).
  - `offset` (optional integer, default `0`, must be `>=0`; used only when `includePages=true`).
  - When `includePages=false`, `limit` and `offset` are ignored.
  - Invalid query values return `400` (for example: `includePages` not boolean, `limit` out of range, `offset` negative).
- Response:
  - Default: `{ site, deployments }`.
  - With `includePages=true`: `{ site, deployments, pages, pagination }`.

`PATCH /api/sites/:id`

- Payload (any subset): `{ sourceUrl?, targetLangs?, subdomainPattern?, localeAliases?, status? ("active"|"inactive"), siteProfile? (object|null), servingMode?, maxLocales?, crawlCaptureMode?, clientRuntimeEnabled?, translatableAttributes?, spaRefresh?, webhookUrl?, webhookSecret? }`.
- Behavior: updates site fields; upserts locales (removes absent target langs), rebuilds route config/domains from the pattern (new domains get fresh verification tokens; removed hosts are deleted), updates siteProfile (set to `null` to clear).
  - Enforces `targetLangs.length <= maxLocales` when `maxLocales` is set.
  - **Warning:** changing `sourceUrl` is destructive. It wipes pages/translations/deployments, resets status to `inactive`, seeds pages from robots/sitemaps, and requires reactivation before crawling. UI should require explicit confirmation.
  - Activating a site (`status: "active"`) requires at least one verified domain and triggers a crawl.
- Response `200`: updated `Site`.

`POST /api/sites/:id/crawl`

- Enqueues crawl for the site’s source URL (requires site status `active` and at least one verified domain).
- Response: `202 { enqueued: true }` or `502 { enqueued: false, error }` if enqueue fails.

`POST /api/sites/:id/pages/:pageId/crawl`

- Enqueues extract for a single page (requires site status `active` and at least one verified domain).
- Response: `202 { enqueued: true }` or `502 { enqueued: false, error }` if enqueue fails.

`POST /api/sites/:id/translate`

- Payload: `{ targetLang, intent? }` (intent: `"translate_and_serve"`).
- Response `202`: `{ run, enqueued, missingSnapshots?, crawlEnqueued? }`.

`GET /api/sites/:id/translation-runs/:runId`

- Response: `{ run }`.

`POST /api/sites/:id/translation-runs/:runId/cancel`

- Response: `{ run }`.

`POST /api/sites/:id/translation-runs/:runId/resume`

- Response: `{ run, enqueued, enqueuedTranslate, enqueuedRender }`.

`GET /api/sites/:id/pages`

- Query: `limit` (optional integer, default `25`, valid range `1..200`) and `offset` (optional integer, default `0`, must be `>=0`).
- Response: `{ pages: [{ id, sourcePath, lastSeenAt?, lastCrawledAt?, lastSnapshotAt?, nextCrawlAt?, lastVersionAt? }], pagination: { limit, offset, total, hasMore } }`.

`GET /api/sites/:id/pipeline/status/:pageVersionId`

- Response: `{ siteId, pageVersionId, statuses: [{ targetLang?, stage, status, message?, timestamp }] }`.

`GET /api/sites/:id/dlq`

- Response: `{ messages }`.

`POST /api/sites/:id/dlq/replay`

- Payload: `{ messageIds }`.
- Response: `{ replayed, failed }`.

`POST /api/sites/:id/locales/:targetLang/serve`

- Payload: `{ enabled }`.
- Response: `{ targetLang, serveEnabled, servingStatus, activeDeploymentId? }`.

### Domain verification

`POST /api/sites/:id/domains/:domain/verify`

- DNS-first: performs a DNS TXT lookup (Cloudflare DoH) for the stored `verificationToken`.
- Test bypass: only when the worker runs with `ENV=test`. In that mode, a matching `token` in the request body (optionally with `"env": "test"`) is accepted instead of DNS. In non-test envs, DNS is required and the `env` body field is ignored.
- Response `200`: `{ domain: { domain,status,verificationToken,verifiedAt,lastCheckedAt,dnsInstructions?,cloudflare? } }` or `400/404` on mismatch/missing domain.

`POST /api/sites/:id/domains/:domain/provision`

- Provisions a Cloudflare for SaaS hostname when enabled.
- Response: `{ domain }` (same shape as above).

`POST /api/sites/:id/domains/:domain/refresh`

- Refreshes Cloudflare validation status.
- Response: `{ domain }` (same shape as above).

### Deployment status

`GET /api/sites/:id/deployments`

- Returns one record per configured locale: `{ deployments: [{ targetLang, status, deploymentId?, activatedAt?, routePrefix?, artifactManifest?, activeDeploymentId?, domain?, domainStatus?, serveEnabled, servingStatus, translationRun? }] }`.
- `activeDeploymentId` is read from KV key `dep:{site_id}:{lang}` (no service key needed on the dashboard).

### Try-now previews

`POST /api/previews`

- Headers: `x-preview-token: <TRY_NOW_TOKEN>` **or** `Authorization: Bearer <dashboard JWT>`.
- Body: `{ sourceUrl, sourceLang, targetLang }`.
- Behavior: fetches the page, translates in-process (deterministic provider unless `OPENAI_API_KEY` is set), renders HTML, stores in R2 with TTL.
- Response `202`: `{ previewId, status, previewUrl, expiresAt }`.

`GET /api/previews/:previewId`

- Response: `{ previewId, status, previewUrl|null, expiresAt, error|null }`.
- Note: the OpenAPI schema does not require auth for this read; treat preview IDs as unguessable and short-lived.

### Glossary management

`GET /api/sites/:id/glossary`

- Response `200`: `{ entries: GlossaryEntry[] }` (latest `glossaries` row).

`PUT /api/sites/:id/glossary`

- Payload: `{ entries: GlossaryEntry[], retranslate?: boolean }`.
- Behavior: validates entries, upserts `glossaries`, optionally enqueues a site crawl when `retranslate` is true. Returns 403 on starter plan.
- Response `200`: `{ entries, crawlStatus? }`.

### Manual translations & slugs

`POST /api/sites/:id/overrides`

- Payload: `{ segmentId, targetLang, text, contextHashScope? }`.
- Behavior: fetches the segment source scoped to the site, validates placeholder multiset, then upserts `segment_overrides`. Returns 403 on starter plan.
- Response `200`: `{ segmentId, targetLang, contextHashScope }`.

`POST /api/sites/:id/slugs`

- Payload: `{ pageId, lang, path }` (path normalized to start with `/`).
- Behavior: wraps `set_page_translated_path` RPC (slug-collision guarded per page), then enqueues a crawl to refresh render/publish. Returns 403 on starter plan.
- Response `200`: `{ pageId, lang, path, crawlStatus }`.

### Serve routing (read-only)

The serve worker reads `site_configs`, `site_domains`, and `sites` directly. Use `/api/sites` responses for hostnames/prefixes; no public route discovery endpoint exists (and dashboards should not query Supabase directly from the browser).

## Capability matrix (Milestone 1 baseline)

Legend:

- `Scope`: `dashboard` (wired in website UI/server actions), `docs-only` (documented/API-ready but intentionally no dedicated UI control), `deferred` (explicitly postponed).
- `Status`: `live` (implemented), `partial` (available but constrained), `planned`.

### User-facing API capabilities

| Capability (operationId)               | Stability | Status | Scope     | Website surface / notes                                       |
| -------------------------------------- | --------- | ------ | --------- | ------------------------------------------------------------- |
| `accounts.claim`                       | GA        | live   | dashboard | `No account` recovery flow claims account ownership.          |
| `accounts.me`                          | GA        | live   | dashboard | Dashboard entitlements/flags bootstrap and plan gating.       |
| `agency.customers.list`                | GA        | live   | dashboard | Agency customer list and workspace switching.                 |
| `agency.customers.create`              | GA        | live   | dashboard | Agency invite/create customer workflow.                       |
| `auth.token.mint`                      | GA        | live   | dashboard | Supabase-to-webhooks JWT bridge used for all dashboard calls. |
| `dashboard.bootstrap`                  | GA        | live   | dashboard | One-call auth + entitlements + account context bootstrap.     |
| `digests.subscription.upsert`          | Beta      | live   | dashboard | Site details “Automation and notifications” card.             |
| `meta.languages.list`                  | GA        | live   | dashboard | Onboarding/admin language pickers.                            |
| `previews.create`                      | Beta      | live   | dashboard | Try-now preview form and dashboard preview flows.             |
| `previews.status`                      | Beta      | live   | dashboard | Preview polling/SSE status tracking.                          |
| `sites.list`                           | GA        | live   | dashboard | Sites index/list surfaces.                                    |
| `sites.create`                         | GA        | live   | dashboard | Onboarding create site action.                                |
| `sites.get`                            | GA        | live   | dashboard | Site detail loading and admin context.                        |
| `sites.dashboard.get`                  | GA        | live   | dashboard | Consolidated site dashboard payload for detail pages.         |
| `sites.update`                         | GA        | live   | dashboard | Site settings updates (status/locales/config/profile).        |
| `sites.crawl.trigger`                  | GA        | live   | dashboard | Crawl trigger controls on site/admin pages.                   |
| `sites.crawl_translate.trigger`        | GA        | live   | dashboard | Site details “Crawl + translate selection” control.           |
| `sites.translate`                      | Beta      | live   | dashboard | Translate-without-recrawl and “Translate & serve”.            |
| `sites.translationRuns.get`            | Beta      | live   | dashboard | Active run polling/status display.                            |
| `sites.translationRuns.cancel`         | Beta      | live   | dashboard | Cancel run controls.                                          |
| `sites.translationRuns.resume`         | Beta      | live   | dashboard | Resume/retry run controls.                                    |
| `sites.pages.list`                     | GA        | live   | dashboard | Site pages table and crawl scheduling context.                |
| `sites.pages.crawl`                    | GA        | live   | dashboard | Per-page crawl trigger actions.                               |
| `sites.deployments.list`               | GA        | live   | dashboard | Deployment/serving status tables.                             |
| `sites.domains.verify`                 | GA        | live   | dashboard | Domain verify checks (TXT/token).                             |
| `sites.domains.provision`              | GA        | live   | dashboard | Domain provisioning button in activation flow.                |
| `sites.domains.refresh`                | GA        | live   | dashboard | DNS/certificate refresh checks.                               |
| `sites.locales.serve`                  | GA        | live   | dashboard | Per-locale serve toggles and status actions.                  |
| `sites.locales.translationSummary.put` | Beta      | live   | dashboard | Site details locale summary preference form.                  |
| `sites.translationSummaries.list`      | Beta      | live   | dashboard | Site details summary history fetch control.                   |
| `sites.switcherSnippets.get`           | GA        | live   | dashboard | Site details switcher snippet fetch tool.                     |
| `sites.glossary.get`                   | GA        | live   | dashboard | Glossary editor read path.                                    |
| `sites.glossary.put`                   | GA        | live   | dashboard | Glossary save/retranslate flow.                               |
| `sites.overrides.create`               | GA        | live   | dashboard | Manual override form.                                         |
| `sites.slugs.set`                      | GA        | live   | dashboard | Localized slug form.                                          |

### User-facing serve/runtime capabilities

| Capability                                  | Stability | Status | Scope     | Website surface / notes                                                                   |
| ------------------------------------------- | --------- | ------ | --------- | ----------------------------------------------------------------------------------------- |
| `GET /{path}` localized serving             | GA        | live   | docs-only | Customer-facing runtime surface; configured via dashboard, consumed outside dashboard UI. |
| `GET /_preview/{previewId}` preview serving | Beta      | live   | docs-only | Preview rendering surface opened from preview flows.                                      |

### User-facing feature-flag capabilities

| Capability                      | Stability | Status | Scope     | Website surface / notes                                     |
| ------------------------------- | --------- | ------ | --------- | ----------------------------------------------------------- |
| `agencyActionsEnabled`          | GA        | live   | dashboard | Controls agency pages/actions visibility.                   |
| `clientRuntimeToggleEnabled`    | GA        | live   | dashboard | Gates client-runtime setting in admin form.                 |
| `crawlCaptureModeEnabled`       | GA        | live   | dashboard | Gates crawl capture mode controls.                          |
| `crawlTriggerEnabled`           | GA        | live   | dashboard | Gates crawl/crawl-translate actions.                        |
| `domainVerifyEnabled`           | GA        | live   | dashboard | Gates domain verify/provision/refresh controls.             |
| `editEnabled`                   | GA        | live   | dashboard | Root mutation capability gate.                              |
| `featurePreview`                | GA        | live   | dashboard | Drives feature-preview UI toggles where applicable.         |
| `glossaryEnabled`               | GA        | live   | dashboard | Gates glossary editor and save actions.                     |
| `localeUpdateEnabled`           | GA        | live   | dashboard | Gates locale update actions and summary preference updates. |
| `maxDailyPageRecrawls`          | GA        | live   | dashboard | Displayed quota limits in admin/site pages.                 |
| `maxDailyRecrawls`              | GA        | live   | dashboard | Displayed site crawl daily quota.                           |
| `maxGlossarySources`            | GA        | live   | dashboard | Glossary plan messaging and limits.                         |
| `maxLocales`                    | GA        | live   | dashboard | Per-site locale cap enforcement and UI constraints.         |
| `maxSites`                      | GA        | live   | dashboard | Site-slot limit messaging.                                  |
| `overridesEnabled`              | GA        | live   | dashboard | Gates manual override tooling.                              |
| `pipelineAllowed`               | GA        | live   | dashboard | Gates pipeline operations where applicable.                 |
| `publishEnabled`                | GA        | live   | dashboard | Gates publish-related controls.                             |
| `renderEnabled`                 | GA        | live   | dashboard | Gates render-related controls.                              |
| `serveAllowed`                  | GA        | live   | dashboard | Gates serve toggles/activation actions.                     |
| `siteCreateEnabled`             | GA        | live   | dashboard | Gates site onboarding create action.                        |
| `slugEditEnabled`               | GA        | live   | dashboard | Gates localized slug editing.                               |
| `tmWriteEnabled`                | GA        | live   | dashboard | Plan-level TM write behavior messaging.                     |
| `translatableAttributesEnabled` | GA        | live   | dashboard | Gates translatable-attributes admin controls.               |

### Non-API operational requirements

| Operational capability                                             | Status | Scope     | Notes                                                                                            |
| ------------------------------------------------------------------ | ------ | --------- | ------------------------------------------------------------------------------------------------ |
| DNS TXT verification flow                                          | live   | dashboard | Represented in Domains card (`verificationToken`, verify/check actions) and docs (`site-setup`). |
| CNAME + managed hostname provision                                 | live   | dashboard | Domain provision + refresh actions expose Cloudflare for SaaS flow and status.                   |
| Activation preconditions (verified domain + active locale serving) | live   | dashboard | Enforced by backend; surfaced in site/admin page status and actions.                             |
| Serve validation (`/{path}` and preview URLs)                      | live   | docs-only | Operational runtime checks documented for launch validation; not rendered as dashboard widgets.  |

## UX feature map (frontend planning)

- **Dashboard shell**: Sidebar/nav, status badges, recent activity.
- **Onboarding wizard**: Source URL, source/target languages, subdomain pattern, site profile (brand voice), domain verification instructions.
- **Sites & locales**: List/create/update/deactivate sites; add/remove target languages; view route config and domains; trigger crawl; toggle serving per locale.
- **Domains**: Show verification tokens/status and `dnsInstructions`; check/verify/provision/refresh flows.
- **Translations control**: Glossary CRUD, manual overrides, localized slug editor, translate-without-recrawl, run controls.
- **Automation and notifications**: Crawl+translate selection, digest subscription, locale summary preferences, summary history fetch, switcher snippet retrieval.
- **Deployments**: Per-locale status, serving status, active deployment ID, artifact manifest summary.
- **Developer tools**: API base/token visibility and link to API/docs surfaces.

## Integration steps

1. After Supabase Auth login, call `POST /api/auth/token` (or `POST /api/dashboard/bootstrap` if you want entitlements + account context) with the Supabase access token; keep the returned JWT server-side (httpOnly/session).
2. Use that JWT for all `/api/sites/*` and related calls. Refresh before expiry (5-minute buffer) and retry once on 401. Include `maxLocales` on create/patch when needed; handle 400/403 responses for locale caps and feature-flag gates.
3. Avoid direct Supabase calls from the browser; rely on these endpoints. Service-key-only access remains server-only.

## Service-key-only surfaces

- `segment_targets`, `canonical_phrases`, `tm_write_reservations`, `usage_counters`, low-level `page_versions` introspection. Access via service key or server-side jobs only (never from the browser).

## Ownership and maintenance loop

- **Primary owner**: Website dashboard/docs maintainers.
- **Input owner**: Backend API/docs maintainers when user-facing capabilities change.
- **Merge-time checks (required)**:
  - `WEBLINGO_REPO_PATH=/absolute/path/to/weblingo pnpm docs:sync:check`
  - `pnpm test:contracts`
- **Refresh snapshots when backend HEAD advances**:
  - `WEBLINGO_REPO_PATH=/absolute/path/to/weblingo pnpm docs:sync`
- **Drift policy**: keep checks merge-time only; add periodic drift audits only if stale snapshots repeatedly bypass PR checks.

## Maintenance checklist (OpenAPI parity)

- Last verified against synced backend artifacts from `content/docs/_generated/backend-sync-manifest.json`.
- Contract update policy: update this doc and synced artifacts in the same PR whenever user-facing capabilities change.
- Confirm every endpoint listed here exists in the synced OpenAPI snapshot.
- Verify payload required/optional fields, enums, and auth requirements match the snapshot.

## Gaps / future work

- Progress/usage summaries beyond current translation rollups (queue health, richer usage analytics) still require dedicated read APIs.
- Team management/billing/RBAC analytics remain out of scope for this dashboard.
