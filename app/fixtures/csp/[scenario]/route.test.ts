import { describe, expect, it } from "vitest";
import { GET } from "./route";

const BASE_URL = "https://weblingo.app";

function requestFor(path: string): Request {
  return new Request(`${BASE_URL}${path}`, { method: "GET" });
}

describe("CSP fixture scenarios", () => {
  it("serves strict eval fixture without unsafe-eval", async () => {
    const response = await GET(requestFor("/fixtures/csp/strict-eval-carousel"), {
      params: Promise.resolve({ scenario: "strict-eval-carousel" }),
    });

    const html = await response.text();
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-csp-fixture")).toBe("1");
    expect(response.headers.get("x-weblingo-csp-scenario")).toBe("strict-eval-carousel");
    expect(csp).toContain("script-src");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(html).toContain('data-weblingo-scenario-id="strict-eval-carousel"');
    expect(html).toContain("new Function");
  });

  it("serves compat eval fixture with unsafe-eval", async () => {
    const response = await GET(requestFor("/fixtures/csp/compat-eval-carousel"), {
      params: Promise.resolve({ scenario: "compat-eval-carousel" }),
    });

    const html = await response.text();
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-csp-scenario")).toBe("compat-eval-carousel");
    expect(csp).toContain("script-src");
    expect(csp).toContain("'unsafe-eval'");
    expect(html).toContain('data-weblingo-scenario-id="compat-eval-carousel"');
    expect(html).toContain('id="carousel-shell"');
  });

  it("serves strict non-eval widget fixture", async () => {
    const response = await GET(requestFor("/fixtures/csp/strict-non-eval-widget"), {
      params: Promise.resolve({ scenario: "strict-non-eval-widget" }),
    });

    const html = await response.text();
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-csp-scenario")).toBe("strict-non-eval-widget");
    expect(csp).toContain("script-src");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(html).toContain('data-weblingo-scenario-id="strict-non-eval-widget"');
    expect(html).toContain('id="widget-shell"');
    expect(html).toContain('id="toggle"');
  });

  it("returns 404 for unknown fixture scenario", async () => {
    const response = await GET(requestFor("/fixtures/csp/unknown"), {
      params: Promise.resolve({ scenario: "unknown" }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("x-weblingo-csp-fixture")).toBe("1");
    expect(await response.text()).toContain("Unknown CSP fixture scenario");
  });
});
