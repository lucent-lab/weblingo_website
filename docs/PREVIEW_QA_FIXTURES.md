# Preview QA Fixtures

The `/fixtures/preview-qa/*` routes are deterministic source pages for preview-specific WebLingo QA. They cover browser and rendered-DOM behavior that cannot be validated well from backend unit fixtures alone. They are intentionally plain route-handler HTML so deployed preview jobs can crawl stable markup without depending on the marketing site component tree.

All responses set:

- `x-weblingo-preview-qa-fixture: 1`
- `x-weblingo-preview-qa-scenario: <scenarioId>`
- `x-robots-tag: noindex, nofollow, noarchive`
- `content-type: text/html; charset=utf-8`

Unknown scenarios return `404`, `x-weblingo-preview-qa-scenario: unknown`, and the fixed body `Unknown preview QA fixture scenario.` without reflecting input.

## Scenario IDs

| Scenario ID               | Path                                           | Purpose                                                                                                                                                                                                                             | Stable selectors and markers                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `structural-placeholders` | `/fixtures/preview-qa/structural-placeholders` | Reproduces Webflow/Governors-style structural placeholder cases: SVG-only logo wrappers, ancestor/descendant structural placeholders, and short button text with sr-only duplicates.                                                | `[data-testid="svg-only-logo-wrapper"]`, `[data-testid="ancestor-placeholder-order"]`, `[data-testid="guestbook-sign-button"]`, `.u-sr-only`                                                                                                                                                                                                          |
| `domain-bound-widgets`    | `/fixtures/preview-qa/domain-bound-widgets`    | Provides static and browser-loadable markers for external capabilities that can work on a customer domain but fail on `preview.weblingo.app` due to origin, domain, referrer, site key, redirect URI, or postMessage origin checks. | `[data-weblingo-domain-bound-candidate]`, `[data-provider="recaptcha"]`, `[data-provider="turnstile"]`, `[data-provider="hcaptcha"]`, `[data-provider="google-identity"]`, `[data-provider="auth0"]`, `[data-provider="stripe"]`, `[data-provider="paypal"]`, `[data-provider="hubspot"]`, `[data-provider="typeform"]`, `[data-provider="calendly"]` |

## Browser Smoke

The website repo includes `tests/preview-qa-fixtures.spec.ts` for browser-level checks. It verifies DOM order for structural placeholders, confirms short Webflow-like buttons have no direct suffix text nodes, and intercepts external requests so passive CDN controls load while domain-bound candidates can be observed without reaching real providers.

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
