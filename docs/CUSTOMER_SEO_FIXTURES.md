# Customer SEO Fixtures

The `/fixtures/customer-seo/*` routes are deterministic source pages for backend customer-domain SEO
QA. They are separate from `/fixtures/showcase/*`: showcase fixtures primarily test translated
namespace rewriting and asset materialization, while customer SEO fixtures focus on canonical URLs,
hreflang inputs, social metadata, sitemap inclusion/exclusion, and indexability behavior.

These pages are source-site fixtures. WebLingo backend QA should crawl or publish them through a
customer-domain or staging-equivalent configuration before asserting translated customer-domain SEO.
WebLingo cannot modify a customer's original sitemap, robots file, CMS data, or source-site files,
so customer sitemap discovery must be validated only on the URLs that WebLingo serves.

## Fixture Paths

- `/fixtures/customer-seo/product`
  - Normal customer SEO page.
  - Includes canonical, description, `og:url`, `twitter:url`, `og:locale`, source social image
    metadata, `html lang`, `html dir`, and links to another customer SEO page.
- `/fixtures/customer-seo/product/pricing`
  - Deep customer SEO page for sitemap path and hreflang path coverage.
- `/fixtures/customer-seo/docs`
  - Normal customer SEO page without source social image metadata.
  - Use it to prove the backend preserves source-only fallback behavior and does not invent
    `og:image` or `twitter:image`.
- `/fixtures/customer-seo/internal/qa-only`
  - Explicit QA/internal page.
  - Emits `noindex,nofollow` and `x-weblingo-customer-seo-classification: internal`.
  - Backend customer sitemaps should exclude this page while fixture QA indexes can expose it.

The fixture set intentionally does not emit `x-default`. Backend SEO QA should assert no
`x-default` appears unless the tested site configuration explicitly provides a valid default landing
URL.

## Expected Backend QA Coverage

Backend live/manual customer-domain SEO QA should use these pages to assert:

- root sitemap discovery and sitemap-index behavior for the selected routing mode;
- sitemap inclusion for customer pages and exclusion for internal/fixture pages;
- explicit fixture QA index visibility for excluded fixture/internal pages;
- raw HTML canonical and hreflang parity with sitemap alternates;
- `og:url`, `twitter:url`, `og:locale`, localized social text from existing metadata, and image
  fallback behavior;
- `html lang` and `html dir` from locale metadata;
- `X-Robots-Tag` and robots behavior for `noindex` vs explicitly indexable customer sites;
- no `x-default` unless the site has an explicit, validated default landing URL.

Keep this fixture set deterministic and small. If a future QA case needs source-page behavior that
is not listed here, add the route and update this document in the same change.
