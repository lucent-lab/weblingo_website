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

`GET /api/sites` → `{ sites: Site[] }` scoped to account.

`GET /api/sites/:id` → `Site`.

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

- Response: `{ pages: [{ id, sourcePath, lastSeenAt?, lastCrawledAt?, lastSnapshotAt?, nextCrawlAt?, lastVersionAt? }] }`.

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

## UX feature map (frontend planning)

- **Dashboard shell**: Sidebar/nav, status badges, recent activity.
- **Onboarding wizard**: Source URL, source/target languages, subdomain pattern, site profile (brand voice), domain verification instructions.
- **Sites & locales**: List/create/update/deactivate sites; add/remove target languages; view route config and domains; trigger crawl; toggle serving per locale.
- **Domains**: Show verification tokens/status and `dnsInstructions`; “Check now” uses `POST /verify`, plus provision/refresh when Cloudflare SaaS is enabled.
- **Translations control**: Glossary CRUD (import/export optional), manual overrides, localized slug editor, preview links (serve worker), and translate-without-recrawl.
- **Deployments**: Per-locale status, serving status, active deployment ID, artifact manifest summary.
- **Developer tools**: Auth token retrieval (via backend/session), webhook token generation handled server-side; link to API docs.
- **Analytics/usage (future)**: Progress/usage summaries not yet implemented; see gaps.
- **Team/Billing (future)**: Roles, billing, invoices not implemented.

## Integration steps

1. After Supabase Auth login, call `POST /api/auth/token` (or `POST /api/dashboard/bootstrap` if you want entitlements + account context) with the Supabase access token; keep the returned JWT server-side (httpOnly/session).
2. Use that JWT for all `/api/sites/*` and other calls listed above. Refresh before expiry (5-minute buffer) and retry once on 401. Include `maxLocales` on create/patch when needed; handle 400/403 responses for locale caps and feature-flag gates.
3. Avoid direct Supabase calls from the browser; rely on these endpoints. For the remaining gaps (usage metrics, billing/team), plan server-side services that can use the Supabase service key safely.

## Service-key-only surfaces

- `segment_targets`, `canonical_phrases`, `tm_write_reservations`, `usage_counters`, low-level `page_versions` introspection. Access via service key or server-side jobs only (never from the browser).

## Maintenance checklist (OpenAPI parity)

- Last verified against OpenAPI version `0.1.0` on 2026-01-27.
- Contract update policy: update this doc and the OpenAPI schema in the same PR.
- Confirm every endpoint listed here exists in the OpenAPI file.
- Verify payload required/optional fields match the schema.
- Verify response fields and enums match the schema.
- Confirm auth requirements and rate-limit behavior match OpenAPI.

## Gaps / future work

- Progress/usage summaries (pages translated, queue health, `usage_counters`) — needs a read API/aggregator.
- Team management, billing, RBAC/usage analytics — not implemented.
- Webhook/event callbacks for dashboard (deployment success, errors) — not exposed yet.

## Plan & feature matrix (account-level)

- `planType` enum: `free | starter | pro | agency` (account-level; sites inherit feature gating from `/accounts/me`).
- Starter: translations only; glossary/overrides/slugs are blocked (403). `maxLocales` may be set (positive int) or `null` (no cap); if set, adding `targetLangs` over the cap returns 400.
- Pro: all features allowed; `maxLocales` can be used to cap per-site locales or left `null`.
