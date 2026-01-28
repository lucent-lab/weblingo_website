# Agency/Client Dashboard Integration Guide (plans)

Purpose: how dashboard/clients should handle site creation and plan-gated actions now that account plans and locale caps exist. This is **implementation-ready guidance** to pair with `docs/AGENCY_MULTITENANT_PLAN.md`.

## Related docs

- `docs/backend/DASHBOARD_SPECS.md` — API contract source of truth.
- `docs/dashboard-flow-and-use-cases.md` — end-to-end dashboard UX flows.

## Site creation/update (webhooks API)

- Payload requirements:
  - `servingMode` is required on create (`"strict"` or `"tolerant"`).
  - `maxLocales` is required on create (number or `null`).
  - `siteProfile` is optional (`object | null`).
- Validation on the worker:
  - Locale cap: `targetLangs.length` cannot exceed `maxLocales` (when set).
  - Feature gates: glossary/overrides/slugs are blocked (403) when the account feature flags disallow them.
  - Status must be active; account scoping still uses JWT `sub`.
- Call patterns:
  - `POST /api/sites` → include required `servingMode` + `maxLocales`; `siteProfile` is optional.
  - `PATCH /api/sites/:id` → include `maxLocales` if changing locale caps; include updated `targetLangs` in the same call to avoid partial state.

## Handling 403s (feature gates)

- Glossary (`PUT /glossary`), overrides (`POST /overrides`), and slugs (`POST /slugs`) return 403 when gated. The dashboard should:
  - Detect 403 with message like “Feature not available on starter plan”.
  - Surface an upgrade prompt (switch plan or request access) instead of retrying.

## JWT/auth expectations

- Webhooks JWT is HMAC (HS256) signed with `WEBHOOK_SECRET`; claim `sub` remains the account id. Clients must **not** send plan metadata; the worker enforces based on server-side data and `/accounts/me` feature flags.
- For future agency/customer context, expect tokens to include actor/subject once relationships land; clients should be ready to pass a “selected account” context when minting the token, but no change needed now.

## Serve/pipeline implications

- Account entitlements matter only at mutation time and optional pipeline guards; serve behavior is unchanged as long as the site is active and has deployments.
- Locale caps are enforced at webhooks; pipeline/serve continue to honor configured locales and deployments.

## Dashboard UX pointers

- On site creation, show locale count and serving mode; use `/accounts/me` plan info for any plan messaging.
- Disable glossary/override/slug UI when feature flags disallow it and show an upgrade CTA.
- When editing a site, prevent adding more locales than `maxLocales`; if cap is unset/null, present as “no cap”.
- Keep using the deterministic `targetLangs` array; the worker will reject over-cap requests.
