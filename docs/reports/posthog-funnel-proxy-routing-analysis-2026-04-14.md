# PostHog Funnel Instrumentation + Proxy Routing Analysis (2026-04-14)

## Scope

Tracked by backend milestone `M6.5` as a release-blocking website/control-plane task:

- Add conversion-funnel instrumentation across landing, try-form, preview lifecycle, pricing, and checkout.
- Route PostHog ingestion through a first-party WebLingo host to reduce event loss from ad blockers.

## Current State

- `posthog-js` is already installed in `weblingo_website`.
- Client initialization already exists in `instrumentation-client.ts`.
- No custom `posthog.capture(...)` calls currently exist, so the product funnel is effectively uninstrumented.
- The highest-value existing client surfaces are:
  - marketing home / landing pages
  - pricing page
  - try-form
  - preview status center
  - checkout success / cancel pages

## Constraints

- Keep env handling centralized in `internal/core/env.ts` and `internal/core/env-server.ts`.
- Avoid leaking raw emails or full source URLs into analytics properties.
- Keep analytics client-only and no-op safely when PostHog config is absent or disabled.
- Avoid ad hoc event names scattered across components.
- Keep proxy routing isolated from product routes and dashboard auth middleware.

## Recommended Implementation

### Milestone 1: Analytics Layer + Try/Preview Funnel

Create a small typed analytics layer in `internal/analytics/*`:

- event name constants
- narrow event-property types
- thin `captureAnalyticsEvent(...)` helper
- page/CTA helper(s) only where they delete real duplication

Instrument the try/preview funnel first:

- `try_form_started`
- `try_form_submitted`
- `preview_create_succeeded`
- `preview_create_failed`
- `preview_status_transition`
- `preview_ready`
- `preview_failed`
- `preview_open_clicked`
- `preview_copy_clicked`
- `preview_email_saved`
- `preview_status_center_open_clicked`
- `preview_status_center_dismissed`

De-duplication rules:

- `try_form_started` should fire once per page view / component lifecycle.
- `preview_status_transition` should only fire on meaningful `(status, stage, errorCode)` changes, not heartbeats.
- `preview_ready` / `preview_failed` should fire once per preview id.

### Milestone 2: Landing, Pricing, and Checkout Funnel

Instrument acquisition and commercial actions:

- `marketing_page_view`
- `marketing_cta_clicked`
- `pricing_page_view`
- `pricing_cta_clicked`
- `checkout_success_view`
- `checkout_cancel_view`

Recommended CTA properties:

- `page_name`
- `cta_id`
- `cta_label`
- `locale`
- `segment` or `variant` where relevant
- `destination_kind` (`try`, `pricing`, `login`, `contact`, `checkout`)

This milestone should prefer client wrappers around the specific CTA surfaces instead of generic DOM click delegation.

### Milestone 3: First-Party PostHog Proxy Host

Move ingestion from direct PostHog browser calls to a first-party WebLingo route.

Recommended approach:

- introduce a dedicated public env for the first-party analytics host
- keep `NEXT_PUBLIC_POSTHOG_HOST` pointed at the upstream PostHog ingestion host
- proxy analytics traffic through a first-party `/api/analytics/posthog` route in the website deployment
- keep the dashboard auth proxy behavior intact
- document the required domain + deployment configuration in `README.md`

Routing recommendation:

- Prefer a dedicated analytics subdomain such as `metrics.weblingo.app`.
- Route that host through the website deployment and proxy upstream requests in `proxy.ts`.
- Bypass normal dashboard/session middleware for analytics-host traffic.

Required upstream safety:

- only allow the dedicated analytics host to proxy
- restrict upstream targets to the approved PostHog host(s)
- pass through method, body, and headers conservatively
- preserve status codes and content types

## Event Contract

### Shared Properties

- `locale`
- `page_name`
- `path`
- `cta_id` when relevant
- `source_lang` / `target_lang` for preview flows
- `source_host` for preview flows
- `preview_id` only after the backend returns it

### Privacy Rules

- do not send full email addresses
- do not send full source URLs
- prefer `source_host` and optionally a trimmed pathname without query strings
- do not send raw backend error payloads; normalize to `error_code`, `error_stage`, `error_status`

## Validation

Minimum validation for this work:

- unit tests for analytics helper behavior and proxy routing
- component tests for milestone-1 event emission on try/preview interactions
- targeted page/component tests for CTA instrumentation
- `coderabbit review --prompt-only` between milestones
- a `gpt-5.4-mini` sub-agent review between milestones

## Delivery Order

1. Milestone 1: analytics layer + try/preview instrumentation
2. Milestone 2: landing/pricing/checkout instrumentation
3. Milestone 3: first-party PostHog proxy routing + env/docs

## Not In Scope

- backend product analytics APIs
- user/account identification policy beyond current anonymous funnel capture
- PostHog dashboard configuration itself
- experiment rollout logic driven by analytics results
