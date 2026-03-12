# Plan

This plan adapts the backend repo's hardened testing strategy to the website repo where it fits: explicit test layers, clearer CI and validation contracts, stronger contract checks, and targeted invariant or state-machine coverage for preview and dashboard flows. It does not copy the backend's worker and Supabase-heavy gates wholesale; the website version should stay centered on Next.js route contracts, preview lifecycle correctness, browser smoke, and backend sync drift.

## Scope
- In: audit the current website test commands, CI jobs, and docs; define a layered testing contract; align developer and CI validation guidance; add targeted invariant or model-based coverage where preview, polling, SSE, cache, or capability-state logic behaves like a real state machine; document rollout rules and validation.
- Out: backend-only pipeline fixtures, worker health gates, production migration checks, broad whole-app random API exploration, and hard coverage thresholds before the website repo has a cleaned baseline and clear exclusions.

## Action items
[ ] Inventory the current website test surface across `package.json`, `vitest.config.ts`, `.github/workflows/ci.yml`, `README.md`, `AGENTS.md`, and `docs/TESTING_POLICY.md`, and capture the command, layer, and CI-contract gaps against the backend repo's documented strategy.
[ ] Add a website-specific testing strategy document that defines the canonical layers: default Vitest gate, contracts and docs-sync gate, Playwright smoke gate, and any opt-in heavier browser regression layer, including when each one should run locally and in CI.
[ ] Split or clarify test commands in `package.json` so the website has an explicit fast default gate and clearly named contract and browser layers, without implying that `check` alone covers the repo's testing baseline.
[ ] Align CI in `.github/workflows/ci.yml` with the documented command contract by making the default Vitest gate, browser smoke gate, and backend docs/contract gate explicit, and document any gate that remains conditional on cross-repo token availability.
[ ] Update `README.md`, `AGENTS.md`, and any developer-facing validation docs so local guidance matches CI and the new layered strategy exactly, including the minimum merge-time command set.
[ ] Identify the high-ROI invariant and state-machine targets in the website repo, starting with preview job reduction, preview status runtime ownership, SSE reconnection and terminal-state behavior, dashboard polling transitions, capability gating, and timeout or fallback contracts.
[ ] Implement generated or model-based tests only for those narrow stateful domains where the oracle is clear and failures stay diagnosable, and keep broad UI and browser coverage example-driven rather than random-sequence driven.
[ ] Decide whether coverage should remain informational or become a gated contract only after the command split, exclusions, and baseline cleanup are complete, and record that decision with explicit acceptance criteria.
[ ] Verify the final strategy with `corepack pnpm test`, `corepack pnpm test:contracts`, `corepack pnpm test:e2e:smoke`, `corepack pnpm check`, and the backend docs-sync check path, then update milestone tracking with the chosen rollout order and any deferred work.

## Open questions
- Should the cross-repo docs and contract gate remain conditional on `CROSS_REPO_CHECKOUT_TOKEN`, or should the website CI grow a no-secret fallback contract layer that still catches backend drift on fork PRs?
- Does the website repo want a dedicated `test:unit` command, or is a documented repo-wide `test` gate plus narrower named contract and browser commands sufficient?
- Is there enough signal in website coverage to justify a hard threshold later, or should the repo stop at explicit layers plus targeted invariant and model-based suites?
