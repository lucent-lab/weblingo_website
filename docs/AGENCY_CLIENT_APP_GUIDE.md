# Agency/Client Dashboard Integration Guide (plans)

Purpose: how dashboard/clients should handle site creation and plan-gated actions now that site plans and locale caps exist. This is **implementation-ready guidance** to pair with `docs/AGENCY_MULTITENANT_PLAN.md`.

## Site creation/update (webhooks API)

- Payload additions:
  - `sitePlan`: `"starter"` or `"pro"` (default `"pro"` if omitted).
  - `maxLocales`: positive integer per site, or `null` for no cap (if plan permits); enforced at create/patch when changing `targetLangs`.
- Validation on the worker:
  - Locale cap: `targetLangs.length` cannot exceed `maxLocales` (when set).
  - Starter feature gates: glossary/overrides/slugs are blocked (403) on starter sites.
  - Status must be active; account scoping still uses JWT `sub`.
- Call patterns:
  - `POST /api/sites` → include `sitePlan`/`maxLocales` as needed and a required `siteProfile` object.
  - `PATCH /api/sites/:id` → include `sitePlan`/`maxLocales` if changing plan or locale caps; include updated `targetLangs` in the same call to avoid partial state.

## Handling 403s (starter feature gates)

- Glossary (`PUT /glossary`), overrides (`POST /overrides`), and slugs (`POST /slugs`) return 403 on starter sites. The dashboard should:
  - Detect 403 with message like “Feature not available on starter plan”.
  - Surface an upgrade prompt (switch to pro for that site) instead of retrying.

## JWT/auth expectations

- Webhooks JWT is still HMAC (HS256) signed with `WEBHOOK_SECRET`; claim `sub` remains the account id. Plan claims are not yet in the token—clients must **not** send plan metadata; the worker enforces based on server-side data.
- For future agency/customer context, expect tokens to include actor/subject once relationships land; clients should be ready to pass a “selected account” context when minting the token, but no change needed now.

## Serve/pipeline implications

- Starter vs pro matters only at mutation time and optional pipeline guards; serve behavior is unchanged as long as the site is active and has deployments.
- Locale caps are enforced at webhooks; pipeline/serve continue to honor configured locales and deployments.

## Dashboard UX pointers

- On site creation, show plan selector (starter/pro) and locale count; disable glossary/override/slug UI for starter sites and show upgrade CTA.
- When editing a site, prevent adding more locales than `maxLocales`; if cap is unset/null, present as “no cap”.
- Keep using the deterministic `targetLangs` array; the worker will reject over-cap requests.
