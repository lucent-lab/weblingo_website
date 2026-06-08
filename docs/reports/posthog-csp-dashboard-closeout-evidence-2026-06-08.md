# PostHog CSP And Dashboard Closeout Evidence

Date: 2026-06-08

Scope:

- Production website target: `https://weblingo.app` redirecting to `https://www.weblingo.app`.
- First-party PostHog proxy target: `https://metrics.weblingo.app`.
- Website fallback proxy routes: `/_analytics/posthog/*` and `/api/analytics/posthog/*`.
- Safe QA marker used in browser checks: `m6521-csp-20260608`.

No cookies, tokens, raw customer URLs, request bodies, response bodies, or PostHog payload bodies
were recorded in this note.

## CSP And Header Evidence

| URL                                                        | Result                                                                                                                                                           | Key headers                                                                                                                | Pass/fail     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `https://weblingo.app/`                                    | `307` to `https://www.weblingo.app/`, then `307` to `/en`, then `200`                                                                                            | `content-type: text/html; charset=utf-8`, `cache-control: public, max-age=0, must-revalidate`, no CSP header on final page | Pass          |
| `https://weblingo.app/en?qa_marker=m6521-csp-20260608`     | `307` to `https://www.weblingo.app/en?...`, then `200`                                                                                                           | `content-type: text/html; charset=utf-8`, `cache-control: public, max-age=0, must-revalidate`, no CSP header on final page | Pass          |
| `https://weblingo.app/en/try?qa_marker=m6521-csp-20260608` | `307` to `https://www.weblingo.app/en/try?...`, then `200`                                                                                                       | `content-type: text/html; charset=utf-8`, `cache-control: public, max-age=0, must-revalidate`, no CSP header on final page | Pass          |
| `https://weblingo.app/dashboard`                           | `307` to `https://www.weblingo.app/dashboard`, then `307` to `/auth/login?next=%2Fdashboard`, then `404` because public portal login is not exposed at that path | Dashboard auth redirect occurs only on dashboard path, not analytics proxy paths                                           | Informational |
| `https://weblingo.app/_analytics/posthog/decide/?v=3`      | `307` to `https://www.weblingo.app/...`, `308` to normalized query path, then `200`                                                                              | `content-type: application/json`, `cache-control: public, max-age=0, must-revalidate`, no CSP header                       | Pass          |
| `https://weblingo.app/api/analytics/posthog/decide/?v=3`   | `307` to `https://www.weblingo.app/...`, `308` to normalized query path, then `200`                                                                              | `content-type: application/json`, `cache-control: public, max-age=0, must-revalidate`, no CSP header                       | Pass          |
| `https://metrics.weblingo.app/`                            | `404`                                                                                                                                                            | `content-type: text/plain`; no dashboard/login redirect                                                                    | Pass          |
| `https://metrics.weblingo.app/decide/?v=3`                 | `200`                                                                                                                                                            | `content-type: application/json`, no CSP header                                                                            | Pass          |
| `https://metrics.weblingo.app/static/array.js`             | `200`                                                                                                                                                            | `content-type: application/javascript`, `access-control-allow-origin: *`, `cache-control: public, max-age=14400`           | Pass          |

The deployed website and proxy responses above do not send a `Content-Security-Policy` or
`Content-Security-Policy-Report-Only` header. That means this closeout verifies absence of deployed
CSP blockers rather than a CSP allowlist. Future deployments that add CSP must explicitly allow the
first-party browser proxy host for PostHog config, static assets, decide/config calls, and ingestion.

## CORS And Proxy Routing Evidence

With `Origin: https://www.weblingo.app`:

| URL                                                         | Method    | Result | Key headers                                                                                                                     | Pass/fail |
| ----------------------------------------------------------- | --------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `https://metrics.weblingo.app/decide/?v=3`                  | `OPTIONS` | `200`  | `access-control-allow-origin: https://www.weblingo.app`, `access-control-allow-methods: GET,POST,OPTIONS,HEAD`                  | Pass      |
| `https://metrics.weblingo.app/e/`                           | `OPTIONS` | `200`  | `access-control-allow-origin: https://www.weblingo.app`, `access-control-allow-methods: GET,POST,OPTIONS`                       | Pass      |
| `https://www.weblingo.app/_analytics/posthog/decide?v=3`    | `OPTIONS` | `200`  | `access-control-allow-origin: https://www.weblingo.app`, `access-control-allow-methods: GET,POST,OPTIONS,HEAD`                  | Pass      |
| `https://www.weblingo.app/api/analytics/posthog/decide?v=3` | `OPTIONS` | `200`  | `access-control-allow-origin: https://www.weblingo.app`, `access-control-allow-methods: GET,POST,OPTIONS,HEAD`                  | Pass      |
| `https://metrics.weblingo.app/decide/?v=3`                  | `GET`     | `200`  | `content-type: application/json`, `access-control-allow-origin: https://www.weblingo.app`                                       | Pass      |
| `https://metrics.weblingo.app/e/`                           | `GET`     | `400`  | `content-type: text/plain; charset=utf-8`, `access-control-allow-origin: https://www.weblingo.app`; no dashboard/login redirect | Pass      |
| `https://www.weblingo.app/_analytics/posthog/decide?v=3`    | `GET`     | `200`  | `content-type: application/json`, `access-control-allow-origin: https://www.weblingo.app`                                       | Pass      |
| `https://www.weblingo.app/api/analytics/posthog/decide?v=3` | `GET`     | `200`  | `content-type: application/json`, `access-control-allow-origin: https://www.weblingo.app`                                       | Pass      |

The website middleware matcher covers dashboard routes and `/api/dashboard/*`; it does not match
`/_analytics/posthog/*`, `/api/analytics/posthog/*`, or `metrics.weblingo.app`. The live checks above
also show analytics routes avoid dashboard/auth redirects.

## Browser Evidence

Chrome/Playwright browser checks against:

- `https://www.weblingo.app/en?qa_marker=m6521-csp-20260608`
- `https://www.weblingo.app/en/try?qa_marker=m6521-csp-20260608`

Observed sanitized PostHog-related browser network requests:

| Host                   | Sanitized path                   | Status | Notes                                           |
| ---------------------- | -------------------------------- | ------ | ----------------------------------------------- |
| `metrics.weblingo.app` | `/array/<project_key>/config.js` | `200`  | First-party managed proxy; project key redacted |
| `metrics.weblingo.app` | `/static/surveys.js`             | `200`  | First-party managed proxy                       |

Direct browser requests to `eu.i.posthog.com`, `us.i.posthog.com`, or `i.posthog.com`: `0`.

Console and page-error signals matching `Content Security Policy`, `PostHog`, `analytics`, or
`blocked`: none observed.

A redacted deployed HTML string check found `metrics.weblingo.app` and did not find
`eu.i.posthog.com`, `us.i.posthog.com`, or `i.posthog.com` in the page HTML for the checked route.

## PostHog Dashboard Inventory

Initial PostHog MCP inspection found project `99802` and pinned dashboard:

- Dashboard `704493`: `WebLingo Product Analytics`
- URL: `https://eu.posthog.com/project/99802/dashboard/704493`
- Existing tiles:
  - `Weekly visitor retention` (`4317280`, `ZDVuoP8a`)
  - `Preview reliability trend` (`4317279`, `Ux1Ipy5b`)
  - `Try Now conversion funnel` (`4317278`, `D8gMIPCu`)
  - `Try Now activation volume` (`4317277`, `mjvqsfFm`)

Thirty-day aggregate event review found production data for acquisition, Try Now, preview, checkout
CTA, and dashboard basics. It did not find observed taxonomy/rows for checkout session result,
account claim, site creation/activation, DNS/domain setup, quota pressure, `analytics_proxy_failed`,
`$exception`, or `product_action_failed` at the time of review.

Recent data included backend-produced preview events with `repo=backend` and
`app_surface=webhooks_worker`, so the target PostHog project has received at least some backend
capture traffic. The remaining backend event families above were not observed during the review
window.

## Created Dashboard Writes

After human approval in the closeout thread, PostHog MCP writes added ten
saved insights to dashboard `704493` on 2026-06-08:

| Tile                                   | Insight type | Events                                                                                                                                                                                                                   | Insight ID / short ID  |
| -------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `Acquisition and pricing trend`        | Trends       | `marketing_page_view`, `marketing_cta_clicked`, `pricing_page_view`, `pricing_cta_clicked`, `checkout_cta_clicked`                                                                                                       | `4475449` / `5SrEG6tX` |
| `Checkout conversion funnel`           | Funnel       | `pricing_cta_clicked` -> `checkout_cta_clicked` -> `checkout_session_create_succeeded` -> `checkout_success_view`                                                                                                        | `4475453` / `bluCHgwB` |
| `Checkout cancel and failure trend`    | Trends       | `checkout_cancel_view`, `checkout_session_create_failed`                                                                                                                                                                 | `4475455` / `O6xVMx0c` |
| `Account claim to dashboard bootstrap` | Funnel       | `account_claim_succeeded` -> `dashboard_bootstrapped`                                                                                                                                                                    | `4475462` / `ZnNxd4mk` |
| `First-site activation funnel`         | Funnel       | `dashboard_bootstrapped` -> `site_created` -> `site_activated`                                                                                                                                                           | `4475475` / `1Aj1YYYt` |
| `DNS setup outcomes trend`             | Trends       | `domain_verification_started`, `domain_verified`, `domain_provision_requested`, `domain_provisioned`                                                                                                                     | `4475489` / `mQZKtxBk` |
| `DNS friction trend`                   | Trends       | `domain_verification_pending`, `domain_verification_failed`, `domain_provision_pending`, `domain_provision_failed`, `domain_route_refresh_failed`, `domain_refresh_failed`                                               | `4475496` / `s9gq58vt` |
| `Quota and upgrade pressure trend`     | Trends       | `quota_limit_hit`, `upgrade_cta_clicked`                                                                                                                                                                                 | `4475497` / `vRGlfpX7` |
| `Dashboard feature adoption trend`     | Trends       | `dashboard_bootstrapped`, `site_dashboard_viewed`, `glossary_updated`, `override_created`, `slug_policy_updated`, `source_selection_saved`, `locale_serving_toggled`, `site_setting_saved`                               | `4475499` / `kcC2mcCo` |
| `Product and proxy errors trend`       | Trends       | `$exception`, `app_error_viewed`, `analytics_proxy_failed`, `product_action_failed`, `preview_create_failed`, `preview_failed`, `crawl_trigger_failed`, `translation_run_terminal_failed`, `domain_route_refresh_failed` | `4475515` / `CRl69RZR` |

Dashboard read-back on 2026-06-08 verified 14 total tiles: the four pre-existing
tiles plus the ten closeout insights above. The created insight URLs are:

- `https://eu.posthog.com/project/99802/insights/5SrEG6tX`
- `https://eu.posthog.com/project/99802/insights/bluCHgwB`
- `https://eu.posthog.com/project/99802/insights/O6xVMx0c`
- `https://eu.posthog.com/project/99802/insights/ZnNxd4mk`
- `https://eu.posthog.com/project/99802/insights/1Aj1YYYt`
- `https://eu.posthog.com/project/99802/insights/mQZKtxBk`
- `https://eu.posthog.com/project/99802/insights/s9gq58vt`
- `https://eu.posthog.com/project/99802/insights/vRGlfpX7`
- `https://eu.posthog.com/project/99802/insights/kcC2mcCo`
- `https://eu.posthog.com/project/99802/insights/CRl69RZR`

The created tiles use stable event names from `internal/analytics/events.ts` and
backend-produced events, filtered by low-cardinality event properties such as
`environment`, `repo`, `app_surface`, and `deployment_channel`. No tile uses
person properties, account/site IDs, raw domains, raw URLs, query strings, or
customer-content fields as query dimensions. `workspace_switched` is excluded
from the primary adoption tile because it is an agency/navigation signal rather
than a core dashboard feature-adoption signal.

Do not use raw URLs, domains, query strings, email, source/translated text,
prompts, provider payloads, request bodies, response bodies, person properties,
warehouse tables, logs, session replay, broad autocapture, or feature-flag
assignment data in these closeout tiles.

No flag, experiment, survey, workflow, destination, alert, assignment, log
export, warehouse object, session-replay setting, or broad autocapture setting
was mutated during this closeout. The only PostHog writes were the saved
dashboard insights listed above.
