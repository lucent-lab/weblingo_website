# Showcase Regression Fixtures

The `/fixtures/showcase/*` routes are deterministic source pages for WebLingo showcase regression tests. They are intentionally plain route-handler HTML so the backend crawler, renderer, publisher, and showcase serve path see stable markup.

## Fixture Paths

- `/fixtures/showcase/marketing`
  - Sales landing page.
  - Includes a `<base>` tag, canonical and hreflang tags, root-relative CSS/JS/image assets, same-page query links, relative links, a form action, an external link, and a source-only fallback link.
- `/fixtures/showcase/marketing/pricing`
  - Deep internal sales page.
  - Keeps query-string and fragment behavior covered.
- `/fixtures/showcase/marketing/about`
  - Relative sibling target for link rewriting checks.
- `/fixtures/showcase/docs/start`
  - Nested documentation page.
  - Covers section anchors, parent-relative links, and a source-only docs fallback.
- `/fixtures/showcase/docs/api`
  - Nested docs sibling target.
- `/fixtures/showcase/app/dashboard`
  - Application-style page with non-eval JavaScript interactivity.
- `/fixtures/showcase/original-only`
  - Source-only fallback sentinel. Use it as an untranslated target in live showcase matrices.
- `/fixtures/showcase/pricing-original-only`, `/fixtures/showcase/docs/source-only`, and `/fixtures/showcase/app/source-only`
  - Additional source-only sentinels for sales, docs, and app-style flows.

## Backend Live Suite

The backend live suite is `corepack pnpm test:playwright:showcase:live` in the `weblingo` repo. It runs only when configured with live showcase URLs.

Minimal single-fixture example:

```sh
PLAYWRIGHT_LIVE_SHOWCASE_URL="https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/marketing" \
PLAYWRIGHT_LIVE_SHOWCASE_SOURCE_ORIGIN="https://weblingo.app" \
PLAYWRIGHT_LIVE_SHOWCASE_EXPECTED_TEXT="Translate product pages without losing the buyer path" \
PLAYWRIGHT_LIVE_SHOWCASE_EXPECTED_INTERNAL_HREF="https://t2.weblingo.app/weblingo.app/en/fixtures/showcase/marketing/pricing?utm=nav#buy" \
PLAYWRIGHT_LIVE_SHOWCASE_EXPECTED_SOURCE_FALLBACK_HREF="https://weblingo.app/fixtures/showcase/original-only?from=marketing#faq" \
PLAYWRIGHT_LIVE_SHOWCASE_EXPECTED_DEPLOYMENT_ID="deployment-id-from-publish" \
corepack pnpm test:playwright:showcase:live
```

For multiple live showcase scenarios, set `PLAYWRIGHT_LIVE_SHOWCASE_MATRIX` to a JSON array with `pageUrl`, `sourceOrigin`, expected text, internal links, source fallback links, optional `expectedDeploymentId`, optional `allowedAssetOrigins`, optional control-plane config, and optional log-health config.
