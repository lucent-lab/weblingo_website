# Showcase Regression Fixtures

The `/fixtures/showcase/*` routes are deterministic source pages for WebLingo showcase regression tests. They are intentionally plain route-handler HTML so the backend crawler, renderer, publisher, and showcase serve path see stable markup.

## Fixture Paths

- `/fixtures/showcase/marketing`
  - Sales landing page.
  - Includes a `<base>` tag, canonical and hreflang tags, root-relative CSS/JS/image assets, preload/modulepreload tags, responsive images, same-page query links, query-only links, relative links, a real form action, an external link, and a source-only fallback link.
- `/fixtures/showcase/marketing/pricing`
  - Deep internal sales page.
  - Keeps query-string and fragment behavior covered.
- `/fixtures/showcase/marketing/about`
  - Relative sibling target for link rewriting checks.
- `/fixtures/showcase/marketing/multipart`
  - Browser multipart form fixture.
  - Submits `enctype="multipart/form-data"` to `/fixtures/showcase/marketing/contact-multipart`, asserts the browser sends a `multipart/form-data; boundary=...` request, and redirects to the same thank-you page with `source=multipart`.
- `/fixtures/showcase/marketing/contact/thanks`
  - Form submission target.
  - The route handler redirects valid marketing form submissions here with the source query string and final `#thanks` fragment preserved. The form action itself deliberately omits the fragment so strict `form-action 'self'` CSP remains browser-compatible.
- `/fixtures/showcase/root-base`
  - Root-base fixture with `<base href="/">`.
  - Uses base-relative links, stylesheet, script, and image assets such as `fixtures/showcase/...` so deployed showcase tests can catch trailing-slash namespace regressions on untouched browser-relative URLs.
- `/fixtures/showcase/docs/start`
  - Nested documentation page.
  - Covers section anchors, parent-relative links, deep `../..` relative links, and a source-only docs fallback.
- `/fixtures/showcase/docs`
  - Docs root page.
  - Exists so `<base href="/fixtures/showcase/docs/">` plus `href="#authentication"` follows browser URL semantics to a routable page instead of a 404. Next.js then canonicalizes the final browser URL to `/fixtures/showcase/docs#authentication`.
- `/fixtures/showcase/docs/api`
  - Nested docs sibling target.
- `/fixtures/showcase/app/dashboard`
  - Application-style page with non-eval JavaScript interactivity.
- `/fixtures/showcase/original-only`
  - Source-only fallback sentinel. Use it as an untranslated target in live showcase matrices.
- `/fixtures/showcase/pricing-original-only`, `/fixtures/showcase/docs/source-only`, and `/fixtures/showcase/app/source-only`
  - Additional source-only sentinels for sales, docs, and app-style flows.

## Backend Live Suite

The backend live suite is `corepack pnpm test:playwright:showcase:live` in the `weblingo` repo. It is the release-gate command and fails when no live showcase URLs are configured.

For local smoke runs that may skip when live credentials are absent, use `corepack pnpm test:playwright:showcase:live:optional`. `corepack pnpm test:playwright:showcase:live:required` remains as an explicit alias for the required release behavior.

Minimal single-fixture example:

```sh
PLAYWRIGHT_LIVE_SHOWCASE_URL="https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/marketing" \
PLAYWRIGHT_LIVE_SHOWCASE_SOURCE_ORIGIN="https://weblingo.app" \
PLAYWRIGHT_LIVE_SHOWCASE_EXPECTED_TEXT="Translate product pages without losing the buyer path" \
PLAYWRIGHT_LIVE_SHOWCASE_EXPECTED_INTERNAL_HREF="https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/marketing/pricing?utm=nav#buy" \
PLAYWRIGHT_LIVE_SHOWCASE_EXPECTED_SOURCE_FALLBACK_HREF="https://weblingo.app/fixtures/showcase/original-only?from=marketing#faq" \
PLAYWRIGHT_LIVE_SHOWCASE_EXPECTED_FORM_ACTION="https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/marketing/contact?source=form" \
PLAYWRIGHT_LIVE_SHOWCASE_EXPECTED_DEPLOYMENT_ID="deployment-id-from-publish" \
PLAYWRIGHT_LIVE_SHOWCASE_REQUIRED=1 \
corepack pnpm test:playwright:showcase:live
```

For multiple live showcase scenarios, set `PLAYWRIGHT_LIVE_SHOWCASE_MATRIX` to a JSON array with `pageUrl`, `sourceOrigin`, expected text, internal links, source fallback links, expected form actions, `expectedDeploymentId`, optional `allowedAssetOrigins`, optional control-plane config, and optional log-health config.

Same-origin showcase assets are expected to include the configured deployment header by default. Use `expectedAssetDeploymentHeaders: false` only when a fixture intentionally validates source-origin/live assets instead of deployment-scoped immutable snapshots.

Matrix example:

```json
[
  {
    "name": "marketing",
    "pageUrl": "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/marketing",
    "sourceOrigin": "https://weblingo.app",
    "expectedText": ["Translate product pages without losing the buyer path"],
    "expectedInternalHrefs": [
      "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/marketing/pricing?utm=nav#buy",
      "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/docs/start?from=marketing#setup"
    ],
    "expectedSourceFallbackHrefs": [
      "https://weblingo.app/fixtures/showcase/original-only?from=marketing#faq"
    ],
    "expectedFormActions": [
      "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/marketing/contact?source=form"
    ],
    "expectedAssetUrls": [
      "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/showcase.css?v=20260416",
      "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/widget.js?v=20260416"
    ],
    "expectedDeploymentId": "deployment-id-from-publish"
  },
  {
    "name": "docs",
    "pageUrl": "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/docs/start",
    "sourceOrigin": "https://weblingo.app",
    "expectedText": ["Set up translated docs without breaking references"],
    "expectedInternalHrefs": [
      "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/docs/api?topic=keys#authentication",
      "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/docs/#authentication"
    ],
    "expectedSourceFallbackHrefs": [
      "https://weblingo.app/fixtures/showcase/docs/source-only?from=docs#legacy"
    ],
    "expectedDeploymentId": "deployment-id-from-publish"
  },
  {
    "name": "root-base",
    "pageUrl": "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/root-base",
    "sourceOrigin": "https://weblingo.app",
    "expectedText": ["Root base showcase links stay in namespace"],
    "expectedInternalHrefs": [
      "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/marketing/pricing?from=root-base#buy",
      "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/docs/start?from=root-base#authentication"
    ],
    "expectedSourceFallbackHrefs": [
      "https://weblingo.app/fixtures/showcase/original-only?from=root-base#faq"
    ],
    "expectedAssetUrls": [
      "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/logo.svg?v=20260416&root-base=1"
    ],
    "expectedDeploymentId": "deployment-id-from-publish"
  },
  {
    "name": "app",
    "pageUrl": "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/app/dashboard",
    "sourceOrigin": "https://weblingo.app",
    "expectedText": ["Localized app dashboard controls"],
    "expectedInternalHrefs": [
      "https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/docs/start?from=dashboard#authentication"
    ],
    "expectedSourceFallbackHrefs": [
      "https://weblingo.app/fixtures/showcase/app/source-only?from=dashboard#settings"
    ],
    "expectedDeploymentId": "deployment-id-from-publish"
  }
]
```

## Website CI Smoke

The website repo runs the source fixture browser suite in CI:

```sh
corepack pnpm test:showcase:fixtures
```

That Playwright suite submits urlencoded and multipart marketing forms, asserts multipart requests are sent with browser-generated boundaries, clicks representative internal/source-only links, checks responsive/preloaded/root-base CSS/JS/image assets, verifies docs base-fragment and root-base behavior, asserts canonical/OG/Twitter URL metadata, checks page and static fixture asset cache headers, confirms the external reference does not prefetch and then clicks it through a local route interception, rejects malformed form bodies on both form endpoints, and fails on any unexpected browser request graph entry, including successful off-fixture requests.

For a production-server smoke of the same fixture suite, run:

```sh
corepack pnpm test:showcase:fixtures:production
```

That command builds the Next.js app and runs the fixture suite against `next start`. It complements the source fixture smoke; the backend deployed live showcase gate is still the coverage that validates translated showcase serving and immutable deployment assets.
