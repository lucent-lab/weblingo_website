# CSP Fixture Scenarios

These routes are deterministic CSP/hydration fixtures used by `weblingo` M16.B opt-in live regression checks.

## Base path

- `https://weblingo.app/fixtures/csp/{scenarioId}`

## Scenario IDs

| Scenario ID              | Path                                   | CSP                               | Purpose                                                             | Stable selectors                                                                                                                                                              |
| ------------------------ | -------------------------------------- | --------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strict-eval-carousel`   | `/fixtures/csp/strict-eval-carousel`   | Strict (no `'unsafe-eval'`)       | Reproduces eval-dependent carousel breakage under strict CSP        | `[data-weblingo-scenario-id="strict-eval-carousel"]`, `#carousel-shell`, `[aria-label="Prev Slide"]`, `[aria-label="Play automatic slide show"]`, `[aria-label="Next Slide"]` |
| `compat-eval-carousel`   | `/fixtures/csp/compat-eval-carousel`   | Compat (includes `'unsafe-eval'`) | Confirms the same eval bootstrap succeeds when CSP allows eval      | `[data-weblingo-scenario-id="compat-eval-carousel"]`, `#carousel-shell`, `[data-type="carousel"]`, `[aria-label="Prev Slide"]`                                                |
| `strict-non-eval-widget` | `/fixtures/csp/strict-non-eval-widget` | Strict (no `'unsafe-eval'`)       | Proves non-eval interactive widgets still function under strict CSP | `[data-weblingo-scenario-id="strict-non-eval-widget"]`, `#widget-shell`, `#toggle`, `#panel`                                                                                  |

## Contract notes

- Every fixture response sets:
  - `x-weblingo-csp-fixture: 1`
  - `x-weblingo-csp-scenario: <scenarioId>`
  - explicit `content-security-policy` header
- Keep scenario IDs and selectors stable. If behavior changes, update this file and the corresponding live checks in `weblingo` in the same change window.
