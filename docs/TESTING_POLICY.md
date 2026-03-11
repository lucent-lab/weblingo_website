# Testing Policy

This document is normative for test quality in the website repo. It defines what a test must protect and what kinds of tests are too coupled to implementation details to keep paying for.

## Goal

- Write tests that protect against real regressions.
- A good test should fail because user-visible behavior, a route contract, or a state transition broke, not because the component tree or helper structure changed.
- Optimize for signal, determinism, and maintainability over raw test count.

## What Good Tests Verify

Prefer tests that verify:

- observable behavior
- rendered UI and accessible output
- returned values, route responses, and server-action results
- state transitions in stores, reducers, and client runtime state machines
- structured errors, validation failures, and fallback behavior
- contract boundaries with the backend repo, Stripe, and other external services
- real edge cases such as auth, timeout, SSE, cache, and invalid-input paths

In this repo that usually means assertions around:

- route status, payload shape, and error mapping
- dashboard and preview state transitions
- auth and capability gating
- cache hits, misses, and invalidation behavior
- redirect, revalidation, and backend request contracts when those are the externally meaningful effects
- user-visible loading, timeout, empty, and failure states

## What To Avoid

- Do not add tests whose only claim is "component X calls helper Y".
- Do not mirror hook or component internals step-by-step.
- Do not assert framework plumbing that users cannot observe unless that plumbing is the contract.
- Do not invent softened fixtures that bypass the real API, Zod schema, or backend contract.
- Do not keep several low-value interaction tests when one higher-value route, state-machine, or UI behavior test would cover the risk.

## Mocks, Fakes, And Spies

Prefer the highest-fidelity option that keeps the test fast and deterministic:

1. real pure code
2. real rendering with minimal valid props and fixtures
3. shared fakes or narrow mocks at true external boundaries

Use mocks when they help isolate a boundary or force a hard-to-reach failure mode. When mocking:

- assert the business effect or boundary contract, not just the interaction
- keep mocks aligned with real interfaces, schemas, and payload shapes
- prefer the same backend contract shapes the app uses in production

Interaction assertions are valid when the interaction itself is the externally meaningful behavior. In this repo that includes cases such as:

- `redirect(...)` and `revalidatePath(...)`
- outbound request shape to backend or Stripe boundaries
- cache invalidation and persistence calls
- emitted logging or telemetry contracts when the emission is part of the requirement

## UI And Route Test Rules

- Prefer queries by role, label, text, and other accessible surfaces before reaching for test IDs.
- Use `data-testid` only when there is no stable accessible surface and the element still matters to the behavior.
- Assert what the user or caller can observe: visible text, enabled or disabled state, returned payload, redirect target, streamed update, or state transition.
- Prefer route or store tests over full-browser tests when the same contract can be proved without browser-only setup.
- Reserve Playwright for browser-only behavior such as navigation, SSE wiring, checkout handoff, or rendering differences that unit and route tests cannot prove.

## Test Design Rules

- Start from the scenario and expected outcome, not the function list.
- Prefer one behavior or risk per test.
- Use small fixtures, but keep them contract-valid.
- Use real type and schema shapes where practical.
- Control time, randomness, and async boundaries explicitly. Avoid sleeps unless time itself is the behavior under test.
- Prefer the smallest test layer that can prove the behavior with confidence.

## Before Adding A Test

Ask:

- What real bug would this catch?
- Would this still be valuable if the internals were reorganized?
- Is this the smallest layer that can prove the behavior with confidence?
- Will the failure explain what broke without reading component internals first?

If the honest answer is only "it would fail if implementation details changed", do not add that test.

## Examples

Bad test patterns:

- "form action calls helper Z"
- "component sets state three times in this order"
- "hook calls fetcher once per render" when the contract is really the resulting UI or state

Good test patterns:

- "given invalid input, the route rejects it with the expected structured failure"
- "given backend response Z, the dashboard state and rendered summary are correct"
- "given preview session state A, the store transitions to B and the UI exposes the expected status"
- "given timeout or auth failure, the page shows the documented fallback state and preserves the contract response"

## Further Reading

- Testing Library guiding principles: https://testing-library.com/docs/guiding-principles
- Testing Library query priority: https://testing-library.com/docs/queries/about/#priority
- Google Testing Blog, "What Makes a Good Test?": https://testing.googleblog.com/2020/12/test-sizes-part-1.html
- Google Testing Blog, "Test Behaviors, Not Methods": https://testing.googleblog.com/2013/07/testing-on-toilet-test-behaviors-not.html
- Software Engineering at Google, "Writing Clear Tests": https://abseil.io/resources/swe-book/html/ch13.html
