import { describe, expect, it } from "vitest";
import { GET } from "./route";

const BASE_URL = "https://weblingo.app";

function requestFor(path: string): Request {
  return new Request(`${BASE_URL}${path}`, { method: "GET" });
}

function routeContext(scenario: string): { params: Promise<{ scenario: string }> } {
  return { params: Promise.resolve({ scenario }) };
}

describe("preview QA fixture scenarios", () => {
  it("serves the structural placeholder regression fixture", async () => {
    const response = await GET(
      requestFor("/fixtures/preview-qa/structural-placeholders"),
      routeContext("structural-placeholders"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-preview-qa-fixture")).toBe("1");
    expect(response.headers.get("x-weblingo-preview-qa-scenario")).toBe("structural-placeholders");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("content-security-policy")).toContain("form-action 'self'");
    expect(html).toContain('data-fixture-scenario="structural-placeholders"');
    expect(html).toContain('data-testid="svg-only-logo-wrapper"');
    expect(html).toContain('<svg class="nav_logo_svg"');
    expect(html).toContain('<path fill="#476F55"');
    expect(html).toContain('data-testid="placeholder-only-ancestor"');
    expect(html).toContain('data-testid="placeholder-only-first-descendant"');
    expect(html).toContain('data-testid="placeholder-only-second-descendant"');
    expect(html).toContain('data-testid="placeholder-only-template"');
    expect(html).toContain('data-expected-no-external-affix="true"');
    expect(html).toContain('data-testid="guestbook-sign-visible">Sign</span>');
    expect(html).toContain('data-testid="guestbook-sign-sr-label">Sign guestbook</span>');
    expect(html).toContain('data-testid="ancestor-descendant-text-chain"');
    expect(html).toContain('data-testid="chain-icon"');
    expect(html).toContain('data-testid="chain-label">Open archive</span>');
  });

  it("serves the domain-bound external capability fixture with passive controls", async () => {
    const response = await GET(
      requestFor("/fixtures/preview-qa/domain-bound-widgets"),
      routeContext("domain-bound-widgets"),
    );
    const html = await response.text();
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-preview-qa-fixture")).toBe("1");
    expect(response.headers.get("x-weblingo-preview-qa-scenario")).toBe("domain-bound-widgets");
    expect(csp).toContain("https://www.google.com/recaptcha/");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).toContain("https://cdn.prod.website-files.com");
    expect(csp).toContain("frame-src");
    expect(html).toContain('data-fixture-scenario="domain-bound-widgets"');
    expect(html).toContain('class="g-recaptcha"');
    expect(html).toContain('class="cf-turnstile"');
    expect(html).toContain('class="h-captcha"');
    expect(html).toContain('id="g_id_onload"');
    expect(html).toContain('data-testid="stripe-sdk"');
    expect(html).toContain('data-testid="paypal-sdk"');
    expect(html).toContain('data-testid="hubspot-forms-api"');
    expect(html).toContain("https://form.typeform.com/to/customerDomainBound");
    expect(html).toContain("https://calendly.com/weblingo/domain-bound-preview");
    expect(html.match(/data-weblingo-domain-bound-candidate=/g)).toHaveLength(10);
    expect(html).toContain(
      'passiveControls: ["font-preconnect", "font-css", "webflow-cdn-script", "webflow-cdn-image"]',
    );

    expect(html).toContain('data-provider="auth0"');
    expect(html).toContain('data-provider="stripe"');
    expect(html).toContain('data-provider="calendly"');
    expect(html.match(/data-weblingo-passive-external=/g)).toHaveLength(5);
    expect(html).toContain('data-weblingo-passive-external="webflow-cdn-script"');
    expect(html).toContain('data-weblingo-passive-external="webflow-cdn-image"');
  });

  it("serves the inline composite boundary fixture with hydration sentinels", async () => {
    const response = await GET(
      requestFor("/fixtures/preview-qa/inline-composite-boundaries"),
      routeContext("inline-composite-boundaries"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-preview-qa-fixture")).toBe("1");
    expect(response.headers.get("x-weblingo-preview-qa-scenario")).toBe(
      "inline-composite-boundaries",
    );
    expect(response.headers.get("content-security-policy")).toContain("'unsafe-inline'");
    expect(html).toContain('data-fixture-scenario="inline-composite-boundaries"');
    expect(html).toContain('data-testid="mission-critical-heading"');
    expect(html).toContain(
      'Systems Engineering for <span id="gradient-word" class="gradient-word" data-testid="mission-critical-word">Mission-Critical</span>',
    );
    expect(html).toContain('data-testid="inline-empty-spacer"><strong> </strong>');
    expect(html).toContain('data-testid="foundations-word">Foundations.</span>');
    expect(html).toContain("data-inline-composite-hydrated");
    expect(html).toContain("__WEBLINGO_PREVIEW_QA_INLINE_COMPOSITE__");
  });

  it("serves the source repair context fixture with repeated hydration restores", async () => {
    const response = await GET(
      requestFor("/fixtures/preview-qa/source-repair-context"),
      routeContext("source-repair-context"),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-weblingo-preview-qa-fixture")).toBe("1");
    expect(response.headers.get("x-weblingo-preview-qa-scenario")).toBe("source-repair-context");
    expect(html).toContain('data-fixture-scenario="source-repair-context"');
    expect(html).toContain('data-testid="source-repair-hero">Automated accounting</h1>');
    expect(html).toContain('data-testid="source-repair-card-heading">Automated accounting</h2>');
    expect(html).toContain('data-testid="source-repair-second-heading">Automated accounting</h2>');
    expect(html).toContain('data-testid="source-repair-card-copy">Accounting automation</p>');
    expect(html).toContain('data-testid="source-repair-button">Accounting automation</button>');
    expect(html).toContain("data-source-repair-hydrated");
    expect(html).toContain("__WEBLINGO_PREVIEW_QA_SOURCE_REPAIR__");
  });

  it("returns a fixed 404 for unknown preview QA scenarios", async () => {
    const payload = "<script>alert(1)</script>";
    const response = await GET(requestFor("/fixtures/preview-qa/unknown"), routeContext(payload));
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("x-weblingo-preview-qa-fixture")).toBe("1");
    expect(response.headers.get("x-weblingo-preview-qa-scenario")).toBe("unknown");
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; base-uri 'none';",
    );
    expect(body).toBe("Unknown preview QA fixture scenario.");
    expect(body).not.toContain(payload);
  });

  it("does not accept prototype property names as preview QA scenarios", async () => {
    const response = await GET(
      requestFor("/fixtures/preview-qa/__proto__"),
      routeContext("__proto__"),
    );
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("x-weblingo-preview-qa-scenario")).toBe("unknown");
    expect(body).toBe("Unknown preview QA fixture scenario.");
  });
});
