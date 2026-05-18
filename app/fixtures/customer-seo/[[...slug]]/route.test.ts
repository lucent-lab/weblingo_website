import { describe, expect, it } from "vitest";
import { GET } from "./route";

const BASE_URL = "https://weblingo.app";

function requestFor(path: string): Request {
  return new Request(`${BASE_URL}${path}`);
}

function routeContext(slug?: string[]) {
  return { params: Promise.resolve({ slug }) };
}

function expectPublicFixtureCache(response: Response): void {
  expect(response.headers.get("cache-control")).toBe("public, max-age=60");
}

describe("customer SEO fixture pages", () => {
  it("serves a customer page with canonical, social URL, image, lang, and dir sentinels", async () => {
    const response = await GET(
      requestFor("/fixtures/customer-seo/product"),
      routeContext(["product"]),
    );

    const html = await response.text();

    expect(response.status).toBe(200);
    expectPublicFixtureCache(response);
    expect(response.headers.get("x-weblingo-customer-seo-fixture")).toBe("1");
    expect(response.headers.get("x-weblingo-customer-seo-page")).toBe("product");
    expect(response.headers.get("x-weblingo-customer-seo-classification")).toBe("customer");
    expect(html).toContain('<html lang="en" dir="ltr"');
    expect(html).toContain(
      'rel="canonical" href="https://weblingo.app/fixtures/customer-seo/product"',
    );
    expect(html).toContain(
      'property="og:url" content="https://weblingo.app/fixtures/customer-seo/product"',
    );
    expect(html).toContain(
      'name="twitter:url" content="https://weblingo.app/fixtures/customer-seo/product"',
    );
    expect(html).toContain('property="og:locale" content="en_US"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:image"');
    expect(html).not.toContain('hreflang="x-default"');
    expect(html).toContain('href="/fixtures/customer-seo/product/pricing?plan=pro#plans"');
  });

  it("serves a customer page without source social image metadata", async () => {
    const response = await GET(requestFor("/fixtures/customer-seo/docs"), routeContext(["docs"]));

    const html = await response.text();

    expect(response.status).toBe(200);
    expectPublicFixtureCache(response);
    expect(response.headers.get("x-weblingo-customer-seo-page")).toBe("docs");
    expect(response.headers.get("x-weblingo-customer-seo-classification")).toBe("customer");
    expect(html).toContain('name="twitter:card" content="summary"');
    expect(html).toContain(
      'name="description" content="A customer page fixture without social image metadata."',
    );
    expect(html).not.toContain('property="og:image"');
    expect(html).not.toContain('name="twitter:image"');
  });

  it("serves a deep customer page for sitemap path coverage", async () => {
    const response = await GET(
      requestFor("/fixtures/customer-seo/product/pricing"),
      routeContext(["product", "pricing"]),
    );

    const html = await response.text();

    expect(response.status).toBe(200);
    expectPublicFixtureCache(response);
    expect(response.headers.get("x-weblingo-customer-seo-page")).toBe("product-pricing");
    expect(html).toContain(
      'rel="canonical" href="https://weblingo.app/fixtures/customer-seo/product/pricing"',
    );
    expect(html).toContain('href="/fixtures/customer-seo/product?from=pricing"');
  });

  it("marks internal QA-only pages as noindex and classifies them separately", async () => {
    const response = await GET(
      requestFor("/fixtures/customer-seo/internal/qa-only"),
      routeContext(["internal", "qa-only"]),
    );

    const html = await response.text();

    expect(response.status).toBe(200);
    expectPublicFixtureCache(response);
    expect(response.headers.get("x-weblingo-customer-seo-page")).toBe("internal-qa-only");
    expect(response.headers.get("x-weblingo-customer-seo-classification")).toBe("internal");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(html).toContain('meta name="robots" content="noindex,nofollow"');
    expect(html).toContain('data-weblingo-customer-seo-fixture="internal"');
  });

  it("uses the product page as the default optional catch-all page", async () => {
    const response = await GET(requestFor("/fixtures/customer-seo"), routeContext());

    const html = await response.text();

    expect(response.status).toBe(200);
    expectPublicFixtureCache(response);
    expect(response.headers.get("x-weblingo-customer-seo-page")).toBe("product");
    expect(html).toContain("Customer SEO product page");
  });

  it("returns a sanitized 404 for unknown fixture pages", async () => {
    const payload = "<img src=x onerror=alert(1)>";
    const response = await GET(
      requestFor("/fixtures/customer-seo/unknown"),
      routeContext([payload]),
    );

    const body = await response.text();

    expect(response.status).toBe(404);
    expectPublicFixtureCache(response);
    expect(response.headers.get("x-weblingo-customer-seo-fixture")).toBe("1");
    expect(response.headers.get("x-weblingo-customer-seo-page")).toBe("unknown");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; base-uri 'none';",
    );
    expect(body).toBe("Unknown customer SEO fixture page.");
    expect(body).not.toContain(payload);
    expect(body).not.toContain("<img");
  });
});
