# Webhooks OpenAPI ↔ Docs Alignment Plan

Scope: align all docs in `weblingo_website/docs/*` and the public docs pages with the current
`workers/webhooks-worker` OpenAPI contract. This plan covers only documentation updates unless a
task explicitly calls out a backend change.

## Milestone 0 — Inventory + Gap Map

- [x] Confirm the current OpenAPI file path and version source of truth.
- [x] Enumerate all docs that reference endpoints, auth, payloads, or response shapes.
- [x] Map each doc section to the matching OpenAPI schema/endpoint (or mark as “no match”).
- [x] List all mismatches (missing endpoints, incorrect fields, optional vs required).
- [x] Decide which mismatches should be resolved by docs updates vs backend changes.

## Milestone 1 — Backend Contract Docs (Single Source of Truth)

- [x] Update `docs/backend/DASHBOARD_SPECS.md` to match OpenAPI shapes:
  - [x] `POST /sites` required fields: include `servingMode` and `maxLocales` (nullable).
  - [x] Remove `sitePlan` references and document plan gating via `/accounts/me` feature flags.
  - [x] Add `serveEnabled` in `SiteLocale`.
  - [x] Add `dnsInstructions` and `cloudflare` to `SiteDomain`.
  - [x] Expand `routeConfig` fields: `clientRuntimeEnabled`, `crawlCaptureMode`,
        `translatableAttributes`, `spaRefresh`, and allow `pattern: null`.
  - [x] Expand deployment fields: `serveEnabled`, `servingStatus`, `domain`, `domainStatus`,
        `translationRun`.
  - [x] Add `latestCrawlRun` to `Site`.
- [x] Remove endpoints not present in OpenAPI (ex: `DELETE /api/sites/:id`).
- [x] Add missing endpoints from OpenAPI:
  - [x] `/dashboard/bootstrap`
  - [x] `/digests/subscription`
  - [x] `/sites/{siteId}/translate`
  - [x] `/sites/{siteId}/translation-runs/*`
  - [x] `/sites/{siteId}/pipeline/status/{pageVersionId}`
  - [x] `/sites/{siteId}/dlq` and `/dlq/replay`
  - [x] `/sites/{siteId}/locales/{targetLang}/serve`
- [x] Add a “contract update policy” note (OpenAPI + DASHBOARD_SPECS update in the same PR).

## Milestone 2 — Agency + Dashboard UX Docs

- [x] Update `docs/AGENCY_CLIENT_APP_GUIDE.md`:
  - [x] Remove `sitePlan` from create/patch payload guidance.
  - [x] Clarify `siteProfile` is optional (`object | null`), not required.
  - [x] Align plan gating language to `/accounts/me` feature flags.
- [x] Update `docs/dashboard-flow-and-use-cases.md`:
  - [x] Replace “pause/resume translations for a site” with per-locale serving toggle.
  - [x] Add translate-without-recrawl flow (`POST /sites/{siteId}/translate`).
  - [x] Mention translation run status/cancel/resume endpoints.
- [x] Update `docs/dashboard-milestone-plan.md`:
  - [x] Remove `sitePlan` references; gate via `featureFlags`.
  - [x] Add required `servingMode` + `maxLocales` in onboarding tasks.
  - [x] Add `/locales/{targetLang}/serve` where “pause/resume” UX is described.
- [x] Update `docs/plans/dashboard-openapi-onboarding-revamp.md`:
  - [x] Replace `sitePlan` with feature flags + `/accounts/me`.
  - [x] Update create-site requirements to `servingMode` + `maxLocales`.

## Milestone 3 — Public Docs (Docs Pages + API Reference)

- [x] Ensure the public API reference page is discoverable from docs index.
- [x] Add explicit base URL + auth guidance (bearer JWT + `x-preview-token`).
- [x] Add a small “core flows” section (create site → verify domain → crawl → translate → status).
- [x] Add a “rate limits” note (429 + `Retry-After`).
- [x] Add a “translate without recrawl” note where the pipeline is described.
- [x] Add domain onboarding guidance reflecting `dnsInstructions` + `cloudflare` status.

## Milestone 4 — Environment + Dev Docs Consistency

- [x] Align `NEXT_PUBLIC_WEBHOOKS_API_BASE` examples across docs with a single canonical pattern.
- [x] Clarify that preview stream routes are Next.js proxies (not worker API endpoints).
- [x] Add links between docs that reference shared flows (dashboard -> backend specs -> API reference).

## Milestone 5 — Validation + Maintenance

- [x] Add a short checklist for reviewers to verify OpenAPI ↔ docs parity.
- [x] Add a “last verified against OpenAPI version” line to key docs (backend specs + API ref).
- [x] Spot-check all endpoints mentioned in docs against the OpenAPI file.

---

## Frontend-Only Tasks (Docs / UI Copy Only)

- [x] Update public docs content (MDX) to include translate-without-recrawl and run status notes.
- [x] Update docs index to include the API reference under a Developer section.
- [x] Add cross-links between docs pages for smoother navigation.
- [x] Normalize examples and base URLs in docs to a single canonical base.
- [x] Update dashboard flow copy to reference per-locale serving toggles.

## Backend-Modification Tasks (If Contract Changes Are Desired)

- [ ] If `GET /previews/{previewId}` should require auth, update the worker route and OpenAPI.
- [ ] If `sitePlan` is required behavior, add it to OpenAPI and server validation before documenting it.
- [ ] If a `DELETE /sites/{siteId}` endpoint is needed, implement + add to OpenAPI before documenting.
- [ ] If new endpoints are planned (pagination, usage summaries), add to OpenAPI first, then docs.
