# Customer Dashboard Milestone Plan

Working plan to implement the customer-facing dashboard described in `docs/DASHBOARD_SPECS.md`. The dashboard must remain friendly to non-technical users, prioritizing guided flows, concise language, and clear status indicators. It should live alongside (not inside) the marketing site so the public surface stays anonymous and unauthenticated.

## Goals & Scope

- Deliver a Supabase-authenticated dashboard that talks to the `workers/webhooks-worker` API using the documented JWT bridge.
- Cover onboarding, site management, domain verification, translation controls (glossary, overrides, slugs), deployments view, and developer tools for tokens/docs links.
- Keep UI copy plain and directive; expose errors inline with remediation steps.
- Reuse existing Tailwind/shadcn styling tokens where possible; avoid new dependencies unless narrowly justified.

## Approach & Key Decisions

- **App placement**: Add a dedicated `apps/dashboard` (Next.js App Router) so the marketing site remains clean; share Tailwind config and internal helpers via path aliases (`@internal/*`, `@components/*`) where sensible.
- **Auth**: Use Supabase Auth on the client; after login, exchange the Supabase access token via `POST /api/auth/token` and cache the returned webhooks JWT until `expiresAt`, auto-refreshing via a background task tied to the Supabase session.
- **API client**: Central `apiClient` wrapper that injects the webhooks JWT, normalizes errors to `{ error, details? }`, and scopes calls by `siteId` when applicable. Prefer `fetch` + thin helpers; avoid new data-fetching libraries unless needed for cache/invalidation.
- **State & UX**: Server components for shells where possible; client components for authenticated, interactive views. Include optimistic UI only when it simplifies recovery (e.g., glossary edits). Provide loading/empty/error patterns shared across views.
- **Form UX**: Progressive disclosure with a stepper for onboarding and guardrails for destructive changes. Validate placeholders for overrides and reject empty `siteProfile` objects per the spec.
- **Environment**: Add dashboard-specific env keys (planned) such as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WEBHOOKS_API_BASE` for the worker endpoint.

## Feature Breakdown (Implementation Shape)

- **Dashboard shell**: Left nav, top bar with account/email, status badges for active site(s), recent activity list driven by latest crawl/deployment events returned by the APIs.
- **Onboarding wizard**: Steps → (1) Source URL + language selection, (2) Subdomain pattern preview, (3) Site profile/brand voice, (4) Review + create. Provide live preview of derived domains and route prefixes; on submit call `POST /api/sites` and show crawl enqueue state.
- **Sites & locales**: Table + detail view to read/update sites via `GET/PATCH /api/sites/:id`; include target language add/remove, status toggle, route config preview, and a “Trigger crawl” action (`POST /api/sites/:id/crawl`).
- **Domains**: Per-site domain list showing verification tokens and status; include “Copy token” and “Check now” (`POST /api/sites/:id/domains/:domain/verify`). Show DNS guidance for non-technical users.
- **Glossary**: List + inline edit/create rows for `GlossaryEntry`; bulk replace via `PUT /api/sites/:id/glossary` with optional `retranslate`. Add CSV/JSON import later if needed.
- **Manual overrides & slugs**: Form to submit segment overrides (`POST /api/sites/:id/overrides`) with placeholder validation helper; slug editor (`POST /api/sites/:id/slugs`) that normalizes leading `/` and surfaces crawl enqueue result.
- **Deployments**: Per-locale status cards from `GET /api/sites/:id/deployments`, showing `deploymentId`, `activeDeploymentId`, `routePrefix`, and manifest summary. Include refresh control.
- **Developer tools**: Token panel showing expiry countdown for the webhooks JWT (never expose Supabase tokens), base URL display, and quick links to `DASHBOARD_SPECS`/API docs.

## Milestone Tasks (Atomic)

1. **Dashboard skeleton** — Scaffold `apps/dashboard` with shared Tailwind config, layout shell, protected route grouping, and navigation placeholders.
2. **Supabase auth bridge** — Wire Supabase client, session persistence, login/logout UI, and token exchange via `/api/auth/token` with refresh handling.
3. **API client + env parsing** — Add typed fetch helpers for all documented endpoints; centralize env parsing for base URLs and token storage; unify error normalization.
4. **Shell & home view** — Implement sidebar/topbar, account menu, and home overview cards (active sites, recent activity, deployment highlights).
5. **Onboarding wizard** — Multi-step form with validation and live previews; submit to `POST /api/sites`; show crawl enqueue status and success handoff to site detail.
6. **Sites list & detail** — Read/list sites, filter by status; detail view with editable fields (`PATCH`), language add/remove, route config preview, and “Trigger crawl”.
7. **Domain verification flow** — Domain table with copy-to-clipboard, DNS instructions, and “Check now” action using `POST /verify`; clear feedback for pending/failed states.
8. **Glossary management** — Editable table for glossary entries, bulk save via `PUT`; optional `retranslate` toggle; validation for required fields and placeholder preservation.
9. **Overrides & slugs** — Forms for manual overrides and slug updates; placeholder validation warnings; surface crawl enqueue response.
10. **Deployments view** — Per-locale deployment cards with status badges, active deployment ID, manifest excerpt, and manual refresh.
11. **Developer tools page** — Display current webhooks JWT + expiry, API base URL, and links to docs; provide token copy button with warnings.
12. **Error/empty/loading states** — Shared components for toasts/inline errors, skeletons, empty prompts with next steps; ensure accessible focus behavior.
13. **Testing & QA** — Unit tests for validation helpers and API client, smoke tests for onboarding and site edit flows, and doc updates for new env vars/runbook.

- **Plan/locale caps (new)** — Add sitePlan (starter/pro) selector and maxLocales field to create/edit flows; reflect `sitePlan`/`maxLocales` from GET responses; proactively block add-target UI when at cap; gate glossary/override/slug UI on starter with upgrade prompt; handle 400 cap errors and 403 starter feature gates with user-friendly copy.

## Non-Goals / Future Tracks

- Usage analytics, billing, and team/RBAC are out-of-scope for this milestone; rely on the existing API gaps section for follow-ups.
- Import/export flows for glossary and override bulk ops may come later; design UI affordances but keep them disabled until APIs exist.

## Immediate Next Steps

- Set `NEXT_PUBLIC_WEBHOOKS_API_BASE` in `.env.local` and in deployed envs so the dashboard can reach the worker API.
- Verify worker endpoints from the new dashboard pages (list/create site, domain verify, glossary/override/slug) against a live worker deployment; adjust CORS if needed.
- Exercise glossary and manual override flows end-to-end against production-like data to confirm placeholder validation and crawl enqueue behavior.
- Seed a non-billing admin/test account in Supabase (e.g., role metadata) to access the dashboard without Stripe payment.
- Confirm plan/locale-cap UX against the live worker: starter plan returns 403 for glossary/overrides/slugs; over-cap locales return 400; ensure UI shows plan and remaining locale slots.
