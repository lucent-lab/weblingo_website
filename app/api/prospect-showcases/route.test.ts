import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Mock the proxy helper so the route's config/rate-limit/body concerns are
// neutralized and the test focuses on Turnstile bot gating (M12.3).
vi.mock("@internal/api/prospect-showcases-proxy", async () => {
  const { NextResponse } = await import("next/server");
  const config = {
    apiBase: "https://api.example.com",
    tryNowToken: "preview-token",
    rateLimitWindowMs: 60_000,
    createMaxPerWindow: 10,
    createMaxPerSourceHostPerWindow: 5,
    statusMaxPerWindow: 100,
    streamMaxPerWindow: 30,
    maxBodyBytes: 8_192,
    upstreamCreateTimeoutMs: 10_000,
    upstreamStatusTimeoutMs: 10_000,
    upstreamStreamConnectTimeoutMs: 10_000,
  };
  return {
    getProspectShowcaseProxyConfig: () => ({ ok: true, config }),
    buildProspectShowcaseIpRateLimitKey: () => "ip-key",
    buildProspectShowcaseHostRateLimitKey: () => "host-key",
    enforceProspectShowcaseRateLimit: async () => null,
    readProspectShowcaseJsonBodyLimited: async (request: Request) => ({
      ok: true,
      payload: await request.json(),
    }),
    createProspectShowcaseProxyResponse: (_kind: string, message: string, status: number) =>
      NextResponse.json({ error: message }, { status }),
    createProspectShowcaseFetchErrorResponse: () =>
      NextResponse.json({ error: "upstream" }, { status: 502 }),
    buildProspectShowcaseUpstreamResponseHeaders: () => ({ "content-type": "application/json" }),
  };
});

const ORIGINAL_ENV = { ...process.env };

function setRequiredEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_BROWSER_HOST = "http://localhost:3000/_analytics/posthog";
  process.env.NEXT_PUBLIC_POSTHOG_CAPTURE = "enabled";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://example.com";
  process.env.NEXT_PUBLIC_POSTHOG_REPLAY_CAPTURE = "disabled";
  process.env.NEXT_PUBLIC_POSTHOG_REPLAY_SAMPLE_RATE = "0";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://api.example.com/api";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "15000";

  process.env.PUBLIC_PORTAL_MODE = "enabled";
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.SUPABASE_SECRET_KEY = "sb_secret";
  process.env.SUPABASE_AUTH_TIMEOUT_MS = "15000";

  delete process.env.TRY_NOW_TOKEN;

  process.env.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_WAITLIST_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_WAITLIST_MAX_BODY_BYTES = "4096";
  process.env.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_CONTACT_MAX_PER_WINDOW = "10";

  process.env.UPSTASH_REDIS__KV_REST_API_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS__KV_REST_API_TOKEN = "upstash_token";

  // Enable Turnstile gating for these tests.
  process.env.TURNSTILE_SECRET_KEY = "0xSECRET";
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0xSITE";
}

function makeRequest(payload: unknown): NextRequest {
  return new Request("http://localhost/api/prospect-showcases", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "1.2.3.4",
    },
    body: JSON.stringify(payload),
  }) as unknown as NextRequest;
}

const SITEVERIFY = "challenges.cloudflare.com";

beforeAll(() => {
  process.env = { ...ORIGINAL_ENV };
  setRequiredEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/prospect-showcases bot gating", () => {
  it("fails closed (503) when Cloudflare verification is unavailable", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("cloudflare down");
    });
    vi.stubGlobal("fetch", fetchMock);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(
      makeRequest({
        sourceUrl: "https://example.com/page",
        sourceLang: "en",
        targetLang: "fr",
        email: "a@example.com",
        turnstileToken: "tok",
      }),
    );

    expect(response.status).toBe(503);
    // Only siteverify was attempted; the upstream create was never reached.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blocks with 403 when the Turnstile token is rejected", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(
      makeRequest({
        sourceUrl: "https://example.com/page",
        sourceLang: "en",
        targetLang: "fr",
        email: "a@example.com",
        turnstileToken: "bad",
      }),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("forwards to upstream without the Turnstile token when verification passes", async () => {
    const upstreamBodies: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes(SITEVERIFY)) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      upstreamBodies.push(String(init?.body ?? ""));
      return new Response(JSON.stringify({ ref: "demo-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(
      makeRequest({
        sourceUrl: "https://example.com/page",
        sourceLang: "en",
        targetLang: "fr",
        email: "a@example.com",
        turnstileToken: "good",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(upstreamBodies).toHaveLength(1);

    const forwarded = JSON.parse(upstreamBodies[0]!) as Record<string, unknown>;
    expect(forwarded.turnstileToken).toBeUndefined();
    expect(forwarded.sourceUrl).toBe("https://example.com/page");
    expect(forwarded.email).toBe("a@example.com");
  });
});
