# PostHog Analytics Contract

This website uses explicit PostHog product analytics only. Broad autocapture, automatic pageview/pageleave capture, heatmaps, console capture, performance capture, persistent browser storage, and network payload capture remain disabled.

## Environment

- `NEXT_PUBLIC_POSTHOG_CAPTURE=disabled` is the global kill switch for browser and server analytics helpers.
- `NEXT_PUBLIC_POSTHOG_BROWSER_HOST` is the browser-facing first-party proxy host.
- `NEXT_PUBLIC_POSTHOG_HOST` is the upstream PostHog ingestion host.
- `NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE=sampled` enables replay sampling only after the route allowlist accepts the page.
- `NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE` must be a decimal from `0` to `1`.

## Event Properties

Use `captureAnalyticsEvent` and `captureServerAnalyticsEvent`; do not call PostHog directly from product code. Properties must pass `sanitizeAnalyticsProperties`.

Allowed properties are explicit, low-cardinality product metadata such as internal IDs, plan/status fields, counts, booleans, route templates, locale codes, and sanitized host/path context.

Forbidden properties include raw PII, secrets, full URLs with query strings, customer content, source text, translated text, prompts, provider payloads, request bodies, and response bodies. Raw domains are treated as customer-identifying metadata: prefer status/presence fields unless a concrete analytics question requires a host value.

## Identity And Groups

Authenticated dashboard sessions call `identify` with the internal user ID and safe account metadata. They also call `group("account", account_id)`. Site-scoped dashboard routes call `group("site", site_id)` with safe site/account metadata.

PostHog feature flags are frontend UI/advisory only. Backend policy, entitlement, limits, and billing truth must continue to come from Supabase/backend contracts.

## Replay

Replay is route-allowlisted in `internal/analytics/replay.ts`. Allowed surfaces are anonymous marketing pages, pre-submit try-flow pages, checkout layout pages, and rare sanitized support screens.

Replay stays disabled on authenticated dashboard routes, preview-content pages, translation editing, runtime observation, glossary/override controls, admin routes, customer-content pages, raw lead/contact forms, API routes, and analytics proxy routes.

## PostHog MCP And AI Workflows

Default to read-only inspection for PostHog MCP/AI workflows. Do not create, edit, or launch flags, experiments, dashboards, alerts, surveys, or data exports unless the task explicitly asks for that write action and the proposed change has been reviewed for privacy and free-tier volume.
