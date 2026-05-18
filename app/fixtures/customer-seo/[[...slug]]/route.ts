type CustomerSeoFixturePage = {
  pageId: string;
  classification: "customer" | "internal";
  title: string;
  description: string;
  canonicalPath: string;
  heading: string;
  bodyHtml: string;
  socialImagePath?: string;
  robots?: "index" | "noindex";
};

const SOURCE_ORIGIN = "https://weblingo.app";
const ASSET_VERSION = "20260416";
const STRICT_CSP =
  "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'self'; object-src 'none'; form-action 'none';";

const PAGES: Record<string, CustomerSeoFixturePage> = {
  product: {
    pageId: "product",
    classification: "customer",
    title: "Customer SEO Fixture: product",
    description: "A customer page fixture with canonical, social URLs, and image metadata.",
    canonicalPath: "/fixtures/customer-seo/product",
    socialImagePath: "/fixtures/showcase/logo.svg?v=20260416&customer-seo=product",
    heading: "Customer SEO product page",
    bodyHtml: `
      <section data-fixture-section="product">
        <p>This page is intended to be included in customer SEO output.</p>
        <a data-check="customer-internal-link" href="/fixtures/customer-seo/product/pricing?plan=pro#plans">Pricing</a>
        <a data-check="customer-docs-link" href="/fixtures/customer-seo/docs#setup">Docs</a>
        <img
          data-check="customer-social-image"
          src="/fixtures/showcase/logo.svg?v=${ASSET_VERSION}&customer-seo=product"
          width="96"
          height="96"
          alt="WebLingo customer SEO fixture logo"
        />
      </section>
    `,
  },
  "product/pricing": {
    pageId: "product-pricing",
    classification: "customer",
    title: "Customer SEO Fixture: pricing",
    description: "A deep customer page fixture for sitemap and hreflang path checks.",
    canonicalPath: "/fixtures/customer-seo/product/pricing",
    heading: "Customer SEO pricing page",
    bodyHtml: `
      <section data-fixture-section="pricing" id="plans">
        <p>This deep page should behave like a normal customer SEO page.</p>
        <a data-check="pricing-product-link" href="/fixtures/customer-seo/product?from=pricing">Product</a>
      </section>
    `,
  },
  docs: {
    pageId: "docs",
    classification: "customer",
    title: "Customer SEO Fixture: docs",
    description: "A customer page fixture without social image metadata.",
    canonicalPath: "/fixtures/customer-seo/docs",
    heading: "Customer SEO docs page",
    bodyHtml: `
      <section data-fixture-section="docs" id="setup">
        <p>This page intentionally has no source social image, so fallback behavior can be tested.</p>
        <a data-check="docs-product-link" href="/fixtures/customer-seo/product#top">Product</a>
      </section>
    `,
  },
  "internal/qa-only": {
    pageId: "internal-qa-only",
    classification: "internal",
    title: "Customer SEO Fixture: internal QA only",
    description: "An internal fixture page that should be excluded from customer sitemaps.",
    canonicalPath: "/fixtures/customer-seo/internal/qa-only",
    heading: "Internal customer SEO QA page",
    robots: "noindex",
    bodyHtml: `
      <section data-fixture-section="internal">
        <p>This page is explicit QA/internal content and must not appear in customer sitemaps.</p>
        <a data-check="internal-product-link" href="/fixtures/customer-seo/product">Product</a>
      </section>
    `,
  },
};

const RESPONSE_HEADERS = {
  "cache-control": "public, max-age=60",
  "x-weblingo-customer-seo-fixture": "1",
};

function normalizeSlug(slug: string[] | undefined): string {
  if (!slug || slug.length === 0) {
    return "product";
  }

  return slug
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "")
    .toLowerCase();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildSocialImageTags(page: CustomerSeoFixturePage): string {
  if (!page.socialImagePath) {
    return "";
  }

  const socialImageUrl = `${SOURCE_ORIGIN}${page.socialImagePath}`;
  return `
    <meta property="og:image" content="${escapeHtml(socialImageUrl)}" />
    <meta property="og:image:width" content="96" />
    <meta property="og:image:height" content="96" />
    <meta name="twitter:image" content="${escapeHtml(socialImageUrl)}" />`;
}

function buildFixtureHtml(page: CustomerSeoFixturePage): string {
  const canonicalUrl = `${SOURCE_ORIGIN}${page.canonicalPath}`;
  const robots = page.robots === "noindex" ? "noindex,nofollow" : "index,follow";

  return `<!doctype html>
<html lang="en" dir="ltr" data-weblingo-customer-seo-fixture="${page.classification}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)}</title>
    <link rel="icon" href="data:," />
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <link rel="alternate" hreflang="en" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="${page.socialImagePath ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />${buildSocialImageTags(page)}
    <link rel="stylesheet" href="/fixtures/showcase/showcase.css?v=${ASSET_VERSION}" />
  </head>
  <body data-fixture-page="${page.pageId}">
    <main id="top">
      <h1>${escapeHtml(page.heading)}</h1>
      ${page.bodyHtml}
    </main>
  </body>
</html>`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug?: string[] }> },
): Promise<Response> {
  const { slug } = await context.params;
  const normalized = normalizeSlug(slug);
  const page = PAGES[normalized];

  if (!page) {
    return new Response("Unknown customer SEO fixture page.", {
      status: 404,
      headers: {
        ...RESPONSE_HEADERS,
        "content-type": "text/plain; charset=utf-8",
        "content-security-policy": "default-src 'none'; base-uri 'none';",
        "x-weblingo-customer-seo-page": "unknown",
      },
    });
  }

  return new Response(buildFixtureHtml(page), {
    status: 200,
    headers: {
      ...RESPONSE_HEADERS,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": STRICT_CSP,
      "x-weblingo-customer-seo-page": page.pageId,
      "x-weblingo-customer-seo-classification": page.classification,
      ...(page.robots === "noindex" ? { "x-robots-tag": "noindex, nofollow" } : {}),
    },
  });
}
