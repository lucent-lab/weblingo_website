import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

const BASE_URL = "https://weblingo.app";

function requestFor(path: string, init: RequestInit = { method: "GET" }): Request {
  return new Request(`${BASE_URL}${path}`, init);
}

function routeContext(slug?: string[]) {
  return { params: Promise.resolve({ slug }) };
}

describe("showcase fixture pages", () => {
  it("serves the marketing fixture with link and asset sentinels", async () => {
    const response = await GET(
      requestFor("/fixtures/showcase/marketing"),
      routeContext(["marketing"]),
    );

    const html = await response.text();
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-showcase-fixture")).toBe("1");
    expect(response.headers.get("x-weblingo-showcase-scenario")).toBe("marketing");
    expect(response.headers.get("x-weblingo-showcase-page")).toBe("marketing-root");
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(html).toContain('data-fixture-page="marketing-root"');
    expect(html).toContain('<base href="/fixtures/showcase/marketing/"');
    expect(html).toContain(
      'rel="canonical" href="https://weblingo.app/fixtures/showcase/marketing"',
    );
    expect(html).toContain(
      'property="og:url" content="https://weblingo.app/fixtures/showcase/marketing"',
    );
    expect(html).toContain(
      'name="twitter:url" content="https://weblingo.app/fixtures/showcase/marketing"',
    );
    expect(html).toContain('hreflang="fr"');
    expect(html).toContain('href="./about?tab=story#team"');
    expect(html).toContain('href="/fixtures/showcase/original-only?from=marketing#faq"');
    expect(html).toContain('rel="preload" as="image"');
    expect(html).toContain('rel="modulepreload"');
    expect(html).toContain('data-check="responsive-image"');
    expect(html).toContain('href="/fixtures/showcase/showcase.css?v=20260416"');
    expect(html).toContain('src="/fixtures/showcase/widget.js?v=20260416"');
    expect(html).toContain('action="/fixtures/showcase/marketing/contact?source=form"');
  });

  it("serves nested docs fixture pages with base-url and source-only sentinels", async () => {
    const response = await GET(
      requestFor("/fixtures/showcase/docs/start"),
      routeContext(["docs", "start"]),
    );

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-showcase-scenario")).toBe("docs");
    expect(response.headers.get("x-weblingo-showcase-page")).toBe("docs-start");
    expect(html).toContain('<base href="/fixtures/showcase/docs/"');
    expect(html).toContain('href="./api?topic=keys#authentication"');
    expect(html).toContain('href="../marketing?from=docs"');
    expect(html).toContain('href="../../showcase/marketing/pricing?from=docs#buy"');
    expect(html).toContain('href="/fixtures/showcase/docs/source-only?from=docs#legacy"');
    expect(html).toContain('href="#authentication"');
  });

  it("serves the docs root used by base-fragment browser navigation", async () => {
    const response = await GET(requestFor("/fixtures/showcase/docs"), routeContext(["docs"]));

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-showcase-scenario")).toBe("docs");
    expect(response.headers.get("x-weblingo-showcase-page")).toBe("docs-root");
    expect(html).toContain("Docs fixture root with anchor target");
    expect(html).toContain('id="authentication"');
  });

  it("serves an app-style fixture with interactive controls", async () => {
    const response = await GET(
      requestFor("/fixtures/showcase/app/dashboard"),
      routeContext(["app", "dashboard"]),
    );

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-showcase-scenario")).toBe("app");
    expect(response.headers.get("x-weblingo-showcase-page")).toBe("app-dashboard");
    expect(html).toContain("data-fixture-widget");
    expect(html).toContain("data-fixture-toggle");
    expect(html).toContain('href="/fixtures/showcase/docs/start?from=dashboard#authentication"');
    expect(html).toContain('href="/fixtures/showcase/app/source-only?from=dashboard#settings"');
  });

  it("uses the marketing fixture as the default optional catch-all page", async () => {
    const response = await GET(requestFor("/fixtures/showcase"), routeContext());

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-showcase-page")).toBe("marketing-root");
    expect(html).toContain("Translate product pages without losing the buyer path");
  });

  it("redirects valid marketing form submissions to a stable thank-you fixture", async () => {
    const response = await POST(
      requestFor("/fixtures/showcase/marketing/contact?source=form", {
        method: "POST",
        body: new URLSearchParams({ email: "buyer@example.com" }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
      routeContext(["marketing", "contact"]),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toBe(
      "/fixtures/showcase/marketing/contact/thanks?source=form#thanks",
    );
  });

  it("rejects invalid marketing form submissions without rendering user input", async () => {
    const payload = "<script>alert(1)</script>";
    const response = await POST(
      requestFor("/fixtures/showcase/marketing/contact", {
        method: "POST",
        body: new URLSearchParams({ email: payload }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
      routeContext(["marketing", "contact"]),
    );

    const body = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(body).toBe("A valid work email is required.");
    expect(body).not.toContain(payload);
  });

  it("rejects malformed marketing form bodies without throwing", async () => {
    const response = await POST(
      requestFor("/fixtures/showcase/marketing/contact", {
        method: "POST",
        body: JSON.stringify({ email: "buyer@example.com" }),
        headers: { "content-type": "application/json" },
      }),
      routeContext(["marketing", "contact"]),
    );

    const body = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; base-uri 'none';",
    );
    expect(body).toBe("Malformed showcase fixture form.");
  });

  it("returns a sanitized 404 for unknown fixture pages", async () => {
    const payload = "<img src=x onerror=alert(1)>";
    const response = await GET(requestFor("/fixtures/showcase/unknown"), routeContext([payload]));

    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("x-weblingo-showcase-fixture")).toBe("1");
    expect(response.headers.get("x-weblingo-showcase-scenario")).toBe("unknown");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; base-uri 'none';",
    );
    expect(body).toBe("Unknown showcase fixture page.");
    expect(body).not.toContain(payload);
    expect(body).not.toContain("<img");
  });
});
