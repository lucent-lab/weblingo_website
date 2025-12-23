# Customer Dashboard Integration Guide (WebLingo)

Purpose: single source of truth for the customer dashboard. Includes API contracts (backend), UX feature map (front-end), and integration steps. The dashboard is a separate project that uses Supabase Auth and calls the WebLingo webhooks worker APIs documented here.

## Table of Contents

- [Auth & Base URLs](#auth--base-urls)
- [Resource Shapes & Error Format](#resource-shapes--error-format)
- [API Surfaces (Backend)](#api-surfaces-backend)
- [UX Feature Map (Frontend Planning)](#ux-feature-map-frontend-planning)
- [Integration Steps](#integration-steps)
- [Service-Key-Only Surfaces](#service-key-only-surfaces)
- [Gaps / Future Work](#gaps--future-work)

## Auth & base URLs

- All HTTP APIs live in `workers/webhooks-worker` under `/api`. Example: `https://webhooks.weblingo.workers.dev/api/sites`.
- Auth is a Bearer JWT signed with `WEBHOOK_SECRET` (HMAC-SHA256). Claims: `sub`/`subject_account_id` (account UUID), `actor_id`, `actor_role`, `iat`, `nbf`, `exp`, and `entitlements` (planType/planStatus). The worker enforces signature + expiry and scopes queries by `subject_account_id`.
- Headers on JSON requests: `Authorization: Bearer <token>`, `Content-Type: application/json`.
- Multi-tenant scoping: every handler filters by `account_id === token.sub`.

### Auth bridge (Supabase Auth → webhooks-worker token)

`POST /api/auth/token`

- Headers: `Authorization: Bearer <Supabase access token>`.
- Behavior: validates the Supabase token via `/auth/v1/user`, then returns a short-lived webhooks JWT (`sub = user.id`, exp ≈ 1h).
- Response `200`: `{ token, expiresAt, entitlements: { planType, planStatus }, actorAccountId, subjectAccountId }`.
- Client flow: after Supabase login, exchange the access token here, use the JWT server-side (no client storage), refresh before expiry (5-minute buffer), and retry once on 401.

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
  - `id`, `sourceUrl`, `status` (`"active"|"inactive"`), `siteProfile` (non-empty JSON object or `null`), `locales` (`[{ sourceLang, targetLang }]`).
  - `maxLocales`: number or `null` (null = no cap).
  - `routeConfig`: `{ sourceLang, sourceOrigin, pattern, locales: [{ lang, origin, routePrefix }] }` or `null`.
  - `domains`: `[{ domain, status ("pending"|"verified"|"failed"), verificationToken, verifiedAt, lastCheckedAt }]`.
  - Account plan/feature gating is sourced from `/accounts/me` (no per-site plan field).
- **CrawlStatus**: `{ enqueued: boolean, error?: string }`.
- **Deployment**: `{ targetLang, status ("publishing"|"active"|"failed"|"unknown"), deploymentId, activatedAt, routePrefix, artifactManifest, activeDeploymentId }`.
- **GlossaryEntry**: `{ source, target, targetLangs?, matchType?, caseSensitive? }` (all strings except `caseSensitive`).
- **Slug update**: `{ pageId, lang, path, crawlStatus }`.
- Placeholders must be preserved verbatim (`⟪token⟫`) in manual overrides; counts must match the source segment.

## API surfaces (backend)

### Sites (onboarding & management)

`POST /api/sites`

- Payload (all required): `{ sourceUrl, sourceLang, targetLangs: [...], subdomainPattern, siteProfile, maxLocales? }`.
  - `subdomainPattern` must contain `{lang}`; it can be a bare host (`{lang}.example.com`) or include scheme/path (`https://www.example.com/{lang}/docs`). Hostnames derived from this pattern seed `site_domains`; path segments become `routePrefix` per locale.
  - `siteProfile` must be a non-empty object with JSON-safe scalar/array/object values (empty strings/arrays rejected).
  - `maxLocales` is a positive integer per site or `null` (no cap). `targetLangs` cannot exceed `maxLocales` when provided.
- Behavior: creates site + locales + route config, inserts domain records with verification tokens, enqueues crawl.
- Response `201`: `{ ...site, crawlStatus }`.

`GET /api/sites` → `{ sites: Site[] }` scoped to account.

`GET /api/sites/:id` → `Site`.

`PATCH /api/sites/:id`

- Payload (any subset): `{ sourceUrl?, targetLangs?, subdomainPattern?, status? ("active"|"inactive"), siteProfile? (object|null), maxLocales? }`.
- Behavior: updates site fields; upserts locales (removes absent target langs), rebuilds route config/domains from the pattern (new domains get fresh verification tokens; removed hosts are deleted), updates siteProfile (set to `null` to clear).
  - Enforces `targetLangs.length <= maxLocales` when `maxLocales` is set.
- Response `200`: updated `Site`.

`DELETE /api/sites/:id` → marks site inactive (`204`).

`POST /api/sites/:id/crawl`

- Enqueues crawl for the site’s source URL.
- Response: `202 { enqueued: true }` or `502 { enqueued: false, error }` if enqueue fails.

### Domain verification

`POST /api/sites/:id/domains/:domain/verify`

- DNS-first: performs a DNS TXT lookup (Cloudflare DoH) for the stored `verificationToken`.
- Test bypass: when the worker runs with `ENV=test` (or body includes `"env": "test"`), a matching `token` in the request body is accepted instead of DNS. Production must use DNS.
- Response `200`: `{ domain: { domain,status,verificationToken,verifiedAt,lastCheckedAt } }` or `400/404` on mismatch/missing domain.

### Deployment status

`GET /api/sites/:id/deployments`

- Returns one record per configured locale: `{ deployments: [{ targetLang, status, deploymentId, activatedAt, routePrefix, artifactManifest, activeDeploymentId }] }`.
- `activeDeploymentId` is read from KV key `dep:{site_id}:{lang}` (no service key needed on the dashboard).

### Try-now previews

`POST /api/previews`

- Headers: `x-preview-token: <TRY_NOW_TOKEN>` **or** `Authorization: Bearer <dashboard JWT>`.
- Body: `{ sourceUrl, sourceLang, targetLang }`.
- Behavior: fetches the page, translates in-process (deterministic provider unless `OPENAI_API_KEY` is set), renders HTML, stores in R2 with TTL.
- Response `202`: `{ previewId, status, previewUrl, expiresAt }`.

`GET /api/previews/:previewId`

- Response: `{ previewId, status, previewUrl|null, expiresAt, error|null }`.

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
- **Sites & locales**: List/create/update/deactivate sites; add/remove target languages; view route config and domains; trigger crawl.
- **Domains**: Show verification tokens/status; “Check now” uses `POST /verify`.
- **Translations control**: Glossary CRUD (import/export optional), manual overrides, localized slug editor, preview links (serve worker).
- **Deployments**: Per-locale status, active deployment ID, artifact manifest summary.
- **Developer tools**: Auth token retrieval (via backend/session), webhook token generation handled server-side; link to API docs.
- **Analytics/usage (future)**: Progress/usage summaries not yet implemented; see gaps.
- **Team/Billing (future)**: Roles, billing, invoices not implemented.

## Integration steps

1. After Supabase Auth login, call `POST /api/auth/token` with the Supabase access token; keep the returned JWT server-side (httpOnly/session).
2. Use that JWT for all `/api/sites/*` and other calls listed above. Refresh before expiry (5-minute buffer) and retry once on 401. Include `maxLocales` on create/patch when needed; handle 400/403 responses for locale caps and starter gates.
3. Avoid direct Supabase calls from the browser; rely on these endpoints. For the remaining gaps (usage metrics, billing/team), plan server-side services that can use the Supabase service key safely.

## Service-key-only surfaces

- `segment_targets`, `canonical_phrases`, `tm_write_reservations`, `usage_counters`, low-level `page_versions` introspection. Access via service key or server-side jobs only (never from the browser).

## Gaps / future work

- Progress/usage summaries (pages translated, queue health, `usage_counters`) — needs a read API/aggregator.
- Team management, billing, RBAC/usage analytics — not implemented.
- Webhook/event callbacks for dashboard (deployment success, errors) — not exposed yet.

## Plan & feature matrix (account-level)

- `planType` enum: `free | starter | pro | agency` (account-level; sites inherit feature gating from `/accounts/me`).
- Starter: translations only; glossary/overrides/slugs are blocked (403). `maxLocales` may be set (positive int) or `null` (no cap); if set, adding `targetLangs` over the cap returns 400.
- Pro: all features allowed; `maxLocales` can be used to cap per-site locales or left `null`.
