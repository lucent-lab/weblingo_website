# Preview QA Fixtures

The `/fixtures/preview-qa/*` routes are deterministic source pages for preview-specific WebLingo QA. They cover browser and rendered-DOM behavior that cannot be validated well from backend unit fixtures alone. They are intentionally plain route-handler HTML so deployed preview jobs can crawl stable markup without depending on the marketing site component tree.

All responses set:

- `x-weblingo-preview-qa-fixture: 1`
- `x-weblingo-preview-qa-scenario: <scenarioId>`
- `x-robots-tag: noindex, nofollow, noarchive`
- `content-type: text/html; charset=utf-8`

Unknown scenarios return `404`, `x-weblingo-preview-qa-scenario: unknown`, and the fixed body `Unknown preview QA fixture scenario.` without reflecting input.

## Scenario IDs

| Scenario ID                   | Path                                               | Purpose                                                                                                                                                                                                                             | Stable selectors and markers                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `structural-placeholders`     | `/fixtures/preview-qa/structural-placeholders`     | Reproduces Webflow/Governors-style structural placeholder cases: SVG-only logo wrappers, ancestor/descendant structural placeholders, and short button text with sr-only duplicates.                                                | `[data-testid="svg-only-logo-wrapper"]`, `[data-testid="ancestor-placeholder-order"]`, `[data-testid="guestbook-sign-button"]`, `.u-sr-only`                                                                                                                                                                                                          |
| `inline-composite-boundaries` | `/fixtures/preview-qa/inline-composite-boundaries` | Reproduces MissingNo-style inline headings where a text node with trailing boundary whitespace is followed by styled spans and an empty spacer span, then hydration restores the source heading.                                    | `[data-testid="mission-critical-heading"]`, `[data-testid="mission-critical-word"]`, `[data-testid="inline-empty-spacer"]`, `[data-testid="foundations-word"]`, `data-inline-composite-hydrated`                                                                                                                                                      |
| `source-repair-context`       | `/fixtures/preview-qa/source-repair-context`       | Repeats short source phrases across different selectors and tags, then hydration restores source text so translated previews can prove source-repair mappings remain selector-aware and do not leave source text visible.           | `[data-testid="source-repair-hero"]`, `[data-testid="source-repair-card-heading"]`, `[data-testid="source-repair-second-heading"]`, `[data-testid="source-repair-card-copy"]`, `[data-testid="source-repair-button"]`, `data-source-repair-hydrated`                                                                                                  |
| `domain-bound-widgets`        | `/fixtures/preview-qa/domain-bound-widgets`        | Provides static and browser-loadable markers for external capabilities that can work on a customer domain but fail on `preview.weblingo.app` due to origin, domain, referrer, site key, redirect URI, or postMessage origin checks. | `[data-weblingo-domain-bound-candidate]`, `[data-provider="recaptcha"]`, `[data-provider="turnstile"]`, `[data-provider="hcaptcha"]`, `[data-provider="google-identity"]`, `[data-provider="auth0"]`, `[data-provider="stripe"]`, `[data-provider="paypal"]`, `[data-provider="hubspot"]`, `[data-provider="typeform"]`, `[data-provider="calendly"]` |

## Scenario Expectations

### `inline-composite-boundaries`

This scenario models a heading where one visible phrase is split across a leading text node, styled inline spans, and an empty spacer span:

```html
Systems Engineering for <span>Mission-Critical</span><span><strong> </strong></span
><span>Foundations.</span>
```

The fixture intentionally hydrates the heading back to the source HTML after a short delay and sets `data-inline-composite-hydrated="1"` on `<html>`. A translated preview should repair the hydrated source text without deriving boundary spacing from the source text node alone.

Use this scenario to catch regressions where translated text is applied piece by piece and loses or invents inline boundaries, such as a missing separator between translated leading text and the first styled inline phrase. The expected assertion is not "always force an ASCII space"; the assertion is that the translated preview preserves the target-language phrase boundaries and direct child order chosen by the manifest/runtime for that locale.

Stable source-shape checks:

- `[data-testid="mission-critical-heading"]` has direct child test IDs `mission-critical-word`, `inline-empty-spacer`, `foundations-word`.
- The source fixture's first text node is `Systems Engineering for ` after hydration.
- The spacer span text is a single source space after hydration.

Useful translated-preview checks:

- Source strings `Systems Engineering for`, `Mission-Critical`, and `Foundations.` should not remain visible after runtime repair.
- The direct child order should remain stable unless a scenario intentionally tests locale-specific reordering.
- A locale-specific `firstChildTextEquals`, `firstChildTextEndsWith`, or `textIncludes` assertion can be added in the live probe only when that generated preview has a stable expected translation.

### `source-repair-context`

This scenario repeats two short phrases in different semantic contexts:

- `Automated accounting` appears in the hero heading and two card headings.
- `Accounting automation` appears in body copy and a button.

The fixture hydrates each target back to its source text and sets `data-source-repair-hydrated="1"` on `<html>`. A translated preview should use selector, tag, and source context to repair each hydrated node with the correct translated text, rather than relying only on a plain source-string lookup.

Use this scenario to catch regressions where a phrase remains in the source language after hydration, or where one repeated phrase mapping is incorrectly reused across different tags or selectors.

Stable source-shape checks:

- `[data-testid="source-repair-hero"]`, `[data-testid="source-repair-card-heading"]`, and `[data-testid="source-repair-second-heading"]` hydrate to `Automated accounting`.
- `[data-testid="source-repair-card-copy"]` and `[data-testid="source-repair-button"]` hydrate to `Accounting automation`.

Useful translated-preview checks:

- Source strings `Automated accounting` and `Accounting automation` should not remain visible after runtime repair.
- Selector-specific `textIncludes` assertions should be used when the generated translation is stable enough to assert exact target copy.
- Repeated headings and button/body copy should be asserted separately so a failure identifies the lost context.

## Browser Smoke

The website repo includes `tests/preview-qa-fixtures.spec.ts` for browser-level checks. It verifies DOM order for structural placeholders, confirms short Webflow-like buttons have no direct suffix text nodes, checks inline composite child order and text-node boundary spacing after fixture hydration, checks source-repair hydration sentinels, and intercepts external requests so passive CDN controls load while domain-bound candidates can be observed without reaching real providers.

Run the focused source-fixture smoke with:

```sh
corepack pnpm playwright test tests/preview-qa-fixtures.spec.ts
```

## Domain-Bound Classification Controls

The `domain-bound-widgets` scenario deliberately includes high-risk external capability widgets:

- verification: reCAPTCHA, Turnstile, hCaptcha
- identity/OAuth: Google Identity and an Auth0-style hosted authorization URL
- payments: Stripe and PayPal SDK markers
- embedded forms/scheduling: HubSpot, Typeform, Calendly

It also includes passive external controls that should not be classified as domain-bound capability failures by static classification alone:

- Google Fonts stylesheet/preconnect
- Webflow CDN image and script

Backend preview diagnostics should use this fixture to prove that verification widgets can be replaced with a clear non-interactive preview placeholder, while broader domain-bound diagnostics remain evidence-driven and avoid flagging passive CDN images, fonts, or scripts that do not perform origin-bound capability checks.

## Live Translated Preview Probes

The opt-in `tests/preview-live/translated-preview-runtime.spec.ts` probe accepts a `dom` array in each `PREVIEW_UX_CASES_JSON` entry. Use it for preview URLs generated from these fixtures when text presence alone is too weak.

Example for `inline-composite-boundaries` after generating a French preview:

```json
[
  {
    "name": "Preview QA inline composite boundary spacing",
    "url": "https://preview.weblingo.app/_preview/<preview-id>",
    "requiredText": ["<stable translated phrase>"],
    "forbiddenText": ["Systems Engineering for", "Mission-Critical", "Foundations."],
    "dom": [
      {
        "selector": "[data-testid=\"mission-critical-heading\"]",
        "firstChildTextEndsWith": " ",
        "textExcludes": ["Systems Engineering for"],
        "childTestIds": ["mission-critical-word", "inline-empty-spacer", "foundations-word"]
      }
    ]
  }
]
```

Example for `source-repair-context`:

```json
[
  {
    "name": "Preview QA source repair context",
    "url": "https://preview.weblingo.app/_preview/<preview-id>",
    "forbiddenText": ["Automated accounting", "Accounting automation"],
    "dom": [
      {
        "selector": "[data-testid=\"source-repair-hero\"]",
        "textExcludes": ["Automated accounting"]
      },
      {
        "selector": "[data-testid=\"source-repair-button\"]",
        "textExcludes": ["Accounting automation"]
      }
    ]
  }
]
```

Use locale-specific `requiredText`, `textIncludes`, or `firstChildTextEquals` when the current generated preview has a stable expected translation. The fixture should not hardcode translated copy; live probes own those target-language expectations.
