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

QA validation runs may tag explicit analytics events with safe metadata so test traffic can be filtered in PostHog. Browser validation starts from any website route with `?qa_marker=<marker>`. Direct API/backend validation sends `x-validation-marker: <marker>`. Valid markers use only ASCII letters, digits, `.`, `_`, `:`, and `-`, with a maximum length of 80 characters. When valid, events may include `traffic_source: "qa"` and `validation_marker: "<marker>"`; invalid markers are ignored. QA markers must not change replay policy, autocapture settings, backend policy, entitlements, serving, queueing, translation behavior, or authorization.

## Event State Semantics

Domain setup distinguishes submitted, pending, completed, and failed outcomes. `domain_verification_started` and `domain_provision_requested` are submit/request events. `domain_verification_pending` and `domain_provision_pending` mean the backend accepted the action but DNS or managed-hostname work is still pending. `domain_verified` and `domain_provisioned` are reserved for completed verified/provisioned states. `domain_route_refresh_failed` is reserved for backend route refresh rollback failures with the matching stable error code.

Pipeline intent distinguishes full-site crawl, per-page crawl, enqueue failure, translation-run creation, and terminal translation failures. Use `crawl_triggered` for full-site crawl intent, `page_crawl_triggered` for per-page crawl intent, `crawl_trigger_failed` only when the backend exposes the stable `crawl_enqueue_failed` code, `translation_run_started` only when the backend returns a created translation run, and `translation_run_terminal_failed` for stable terminal run failures.

Authentication distinguishes client submit intent, confirmation-required acceptance, and completed sessions. Use `auth_submitted` for browser submit intent, `auth_confirmation_required` when signup is accepted but no session exists yet, and `auth_succeeded` only when the auth provider returns an active session.

## Identity And Groups

Authenticated dashboard sessions call `identify` with the internal user ID and safe account metadata. They also call `group("account", account_id)`. Site-scoped dashboard routes call `group("site", site_id)` with safe site/account metadata.

PostHog feature flags are frontend UI/advisory only. Backend policy, entitlement, limits, and billing truth must continue to come from Supabase/backend contracts.

## Backend-Produced Events

The backend may send request-bound product events from `webhooks-worker` only. Event names still live in this website catalog so the vocabulary does not drift between repos.

The canonical backend-produced event list is `BACKEND_PRODUCED_ANALYTICS_EVENTS` in `internal/analytics/events.ts`. Do not restate that list in prose.

Backend-produced events use explicit low-cardinality properties such as `request_id`, `route_id`, `status_code`, account/site IDs, plan/status enums, counts, booleans, and stable `error_code` values. They must not include Cloudflare request metadata, raw domains, raw URLs, query strings, emails, invite links, verification tokens, source/translated text, prompts, provider payloads, request bodies, or response bodies.

Stable-code failures on curated backend routes that do not have a more specific failure event may emit `product_action_failed`. Ordinary validation rejections without stable error codes remain uncaptured.

For `sites.translate`, crawl-only accepted outcomes emit `crawl_triggered`; `translation_run_started` is reserved for responses that actually create a translation run.

`preview_feedback_submitted` may include `preview_id`, `preview_status`, and `preview_feedback_channel`; it must not include free-text feedback, ratings comments, contact details, request bodies, or preview URLs.

Dashboard translation controls must follow the same distinction: retry/resume actions use `translation_run_retried` or `translation_run_resumed`, and translate-and-serve actions use settled metadata to emit `translation_run_started` only when the backend returns a run.

`serve-worker` and translated serving hot paths must not call PostHog.

## Website Server Events

`analytics_proxy_failed` is emitted only for first-party PostHog proxy upstream failures. It may include `route_template`, `route_area`, `request_method`, `target_kind`, `status_code`, `status`, `source`, and `failure_kind`; it must not include raw proxy paths, query strings, request bodies, response bodies, cookies, or PostHog payloads.

## Flags, Experiments, Surveys, And Annotations

Feature flags and experiments are limited to frontend presentation choices such as onboarding copy/order, DNS helper copy, pricing CTA copy, preview status layout, and dashboard beta controls. They are advisory UI inputs only and must not decide backend policy, entitlements, quotas, serving, queueing, publishing, or translation behavior.

Surveys should be constrained-choice by default after preview failure, DNS failure, first publish, checkout cancel, or quota-limit moments. Free-text survey responses are PII-bearing and require a separate sanitizer and retention decision before use.

Product annotations are manual or reviewed operator actions for deploys, major dashboard refactors, feature-flag launches, experiment launches, and pricing changes. Runtime code should not create annotations automatically.

## Replay

Replay is route-allowlisted in `internal/analytics/replay.ts`. Allowed surfaces are anonymous marketing pages, pre-submit try-flow pages, checkout layout pages, and rare sanitized support screens.

Replay stays disabled on authenticated dashboard routes, preview-content pages, translation editing, runtime observation, glossary/override controls, admin routes, customer-content pages, raw lead/contact forms, query-bearing URLs, API routes, and analytics proxy routes.

## PostHog MCP And AI Workflows

Default to read-only inspection for PostHog MCP/AI workflows. Do not create, edit, or launch flags, experiments, dashboards, alerts, surveys, or data exports unless the task explicitly asks for that write action and the proposed change has been reviewed for privacy and free-tier volume.

## Closeout Evidence

The 2026-06-08 production closeout evidence for first-party proxy headers,
browser routing, and initial dashboard inventory lives in
[`docs/reports/posthog-csp-dashboard-closeout-evidence-2026-06-08.md`](reports/posthog-csp-dashboard-closeout-evidence-2026-06-08.md).

That evidence verifies that the deployed public pages and PostHog proxy routes
currently send no CSP header, so there is no deployed CSP directive blocking
PostHog config, static asset, decide/config, or ingestion routes. Browser
network checks observed PostHog config/static traffic through
`metrics.weblingo.app` and no direct browser requests to PostHog ingestion
hosts. Human-reviewed PostHog MCP writes added the M6.5.21 closeout tiles to
dashboard `704493`; the evidence report records the dashboard URL, insight
IDs, and privacy guardrails.
