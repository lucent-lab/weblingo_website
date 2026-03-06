# AGENTS.md — WebLingo Website

Use this file as the entrypoint for the marketing site and dashboard repo. Keep it focused on task routing, constraints, and validation. Read deeper docs only when the task requires them.

## Start Here

Primary lookup points:

1. `README.md` and `docs/README.md` for local setup and doc map.
2. `internal/core/env.ts` and `internal/core/env-server.ts` for env contracts.
3. `docs/backend/DASHBOARD_SPECS.md` for the canonical dashboard capability matrix.
4. `docs/DEVELOPMENT_GUIDE.md` and `docs/ARCHITECTURE.md` for app structure and architecture.
5. `content/docs/_generated/*` plus backend bridge docs when working on backend↔website alignment.

Cross-repo docs sync commands:

- `WEBLINGO_REPO_PATH=/absolute/path/to/weblingo corepack pnpm docs:sync`
- `WEBLINGO_REPO_PATH=/absolute/path/to/weblingo corepack pnpm docs:sync:check && corepack pnpm test:contracts`

Minimal validation:

- `corepack pnpm test:contracts`
- `corepack pnpm check`

## Project Scope

- Marketing pages, pricing, legal, contact, and checkout flows.
- Lightweight dashboard surfaces for onboarding and configuration.
- Try-Now previews, including create, status, SSE stream, and rendered preview handoff.
- Stripe Checkout and Stripe webhook lifecycle handling.

## Hard Invariants

- Keep client and server env handling centralized in `internal/core/env.ts` and `internal/core/env-server.ts`.
- Localize UI copy via `@internal/i18n`; do not hardcode page or component strings.
- Preview proxy routes must stay aligned with backend preview contracts:
  - `POST /api/previews`
  - `GET /api/previews/:id`
  - `GET /api/previews/:id/stream`
- Preview `errorCode` and `stage` enums must stay consistent with backend `webhooks-worker` responses.
- Stripe routes must verify signatures and preserve metadata needed to associate subscriptions with sites.
- Logging follows the one-wide-event rule from `docs/LOGGING_POLICY.md`.
- Do not introduce silent env fallbacks or legacy alias names.
- Use `https://weblingo.app` for public product links.

## Development Rules

- TypeScript strict mode.
- Prefer server components; use client components only when required.
- Keep files small and focused. Prefer descriptive names and early returns.
- Use path aliases: `@internal/*`, `@modules/*`, `@components/*`.
- Add abstractions only when they provide immediate value and remove current pain.
- Update docs when contracts, API behavior, env surfaces, or dashboard capabilities change.
- Keep tests close to the changed behavior with small fixtures.

## Common Commands

- `corepack pnpm test:contracts`
- `corepack pnpm check`
- `corepack pnpm test`
- `corepack pnpm lint`

## Where To Look

- Env contracts: `internal/core/env.ts`, `internal/core/env-server.ts`
- Website architecture: `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT_GUIDE.md`
- Dashboard capability matrix: `docs/backend/DASHBOARD_SPECS.md`
- Backend bridge pointer and sync context in the backend repo:
  - `weblingo/docs/backend/DASHBOARD_SPECS.md`
  - `weblingo/docs/reports/backend-dashboard-doc-sync-plan-2026-02-16.md`
- Generated backend snapshots used by docs and contracts: `content/docs/_generated/*`
- Preview runtime and state machine: `internal/previews/*`
- Dashboard API integration: `internal/dashboard/*`

## Editing Notes

- Keep `internal/*` as proto-packages until there is a concrete extraction need.
- Preserve dashboard and preview contracts when changing website UI flows.
- If a task is primarily backend behavior, change the backend repo first and sync docs or contracts back into this repo afterward.
