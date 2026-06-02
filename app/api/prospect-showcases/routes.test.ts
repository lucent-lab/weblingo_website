import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const rateLimitFixedWindow = vi.fn();
vi.mock("@internal/core/rate-limit", () => ({ rateLimitFixedWindow }));

class FetchTimeoutError extends Error {
  constructor(message = "fetch timed out") {
    super(message);
    this.name = "FetchTimeoutError";
  }
}
const fetchWithTimeout = vi.fn();
vi.mock("@internal/core/fetch-timeout", () => ({ fetchWithTimeout, FetchTimeoutError }));

vi.mock("@internal/core/redis", () => ({ redis: {} }));

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://example.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://api.example.com/api";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "15000";

  process.env.PUBLIC_PORTAL_MODE = "enabled";
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.SUPABASE_SECRET_KEY = "sb_secret";
  process.env.SUPABASE_AUTH_TIMEOUT_MS = "15000";

  process.env.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_WAITLIST_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_WAITLIST_MAX_BODY_BYTES = "4096";
  process.env.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_CONTACT_MAX_PER_WINDOW = "10";

  process.env.TRY_NOW_TOKEN = "preview_token";
  process.env.WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_PREVIEW_CREATE_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_PREVIEW_CREATE_MAX_PER_SOURCE_HOST_PER_WINDOW = "10";
  process.env.WEBSITE_PREVIEW_STATUS_MAX_PER_WINDOW = "60";
  process.env.WEBSITE_PREVIEW_STREAM_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_PREVIEW_MAX_BODY_BYTES = "4096";
  process.env.WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS = "15000";
  process.env.WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS = "15000";
  process.env.WEBSITE_PREVIEW_UPSTREAM_STREAM_CONNECT_TIMEOUT_MS = "15000";

  process.env.UPSTASH_REDIS__KV_REST_API_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS__KV_REST_API_TOKEN = "upstash_token";
});

beforeEach(() => {
  rateLimitFixedWindow.mockReset();
  fetchWithTimeout.mockReset();
});

function buildNextRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

function allowRateLimit() {
  rateLimitFixedWindow.mockResolvedValue({
    allowed: true,
    limit: 100,
    remaining: 99,
    resetAtMs: Date.now() + 1000,
    current: 1,
    key: "k",
  });
}

describe("/api/prospect-showcases proxy routes", () => {
  test("POST /api/prospect-showcases forwards create requests upstream", async () => {
    const { POST } = await import("./route");
    allowRateLimit();
    fetchWithTimeout.mockResolvedValueOnce(
      new Response(JSON.stringify({ prospectShowcaseRef: "ps-test-ref", status: "pending" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const body = {
      sourceUrl: "https://example.com/pricing",
      sourceLang: "en",
      targetLang: "fr",
      email: "owner@example.com",
    };
    const request = buildNextRequest("http://localhost/api/prospect-showcases", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify(body),
    });

    const response = await POST(request);

    expect(response.status).toBe(202);
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      "https://api.example.com/api/prospect-showcases",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-preview-token": "preview_token",
          Accept: "application/json",
        }),
        body: JSON.stringify(body),
      }),
      expect.objectContaining({ timeoutMs: 15000, signal: request.signal }),
    );
  });

  test("GET /api/prospect-showcases/:ref/status forwards status token upstream", async () => {
    const { GET } = await import("./[ref]/status/route");
    allowRateLimit();
    fetchWithTimeout.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ready", showcaseUrl: "https://t2.weblingo.app/fr" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const ref = "ps-abc123def456";
    const request = buildNextRequest(
      `http://localhost/api/prospect-showcases/${ref}/status?token=t`,
      {
        method: "GET",
        headers: { "x-forwarded-for": "1.2.3.4" },
      },
    );

    const response = await GET(request, { params: Promise.resolve({ ref }) });

    expect(response.status).toBe(200);
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      `https://api.example.com/api/prospect-showcases/${encodeURIComponent(ref)}/status`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-preview-token": "preview_token",
          "x-preview-status-token": "t",
        }),
      }),
      expect.objectContaining({ timeoutMs: 15000, signal: request.signal }),
    );
  });

  test("GET /api/prospect-showcases/:ref/stream preserves SSE responses", async () => {
    const { GET } = await import("./[ref]/stream/route");
    allowRateLimit();
    fetchWithTimeout.mockResolvedValueOnce(
      new Response("event: heartbeat\n\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const ref = "ps-stream-ref";
    const request = buildNextRequest(
      `http://localhost/api/prospect-showcases/${ref}/stream?token=status-token`,
      {
        method: "GET",
        headers: { "x-forwarded-for": "1.2.3.4" },
      },
    );

    const response = await GET(request, { params: Promise.resolve({ ref }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      `https://api.example.com/api/prospect-showcases/${encodeURIComponent(ref)}/stream`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "text/event-stream",
          "x-preview-token": "preview_token",
          "x-preview-status-token": "status-token",
        }),
      }),
      expect.objectContaining({ timeoutMs: 15000, signal: request.signal }),
    );
  });

  test("POST /api/prospect-showcases/claim forwards a body token upstream", async () => {
    const { POST } = await import("./claim/route");
    allowRateLimit();
    fetchWithTimeout.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "dashboard-token", demo: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const request = buildNextRequest("http://localhost/api/prospect-showcases/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({ token: "dashboard-token" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(request.nextUrl.search).toBe("");
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      "https://api.example.com/api/prospect-showcases/claim?token=dashboard-token",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Accept: "application/json" }),
      }),
      expect.objectContaining({ timeoutMs: 15000, signal: request.signal }),
    );
  });

  test("POST /api/prospect-showcases/claim preserves upstream retry guidance", async () => {
    const { POST } = await import("./claim/route");
    allowRateLimit();
    fetchWithTimeout.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
          "Retry-After": "17",
        },
      }),
    );

    const request = buildNextRequest("http://localhost/api/prospect-showcases/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({ token: "dashboard-token" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  test("POST /api/prospect-showcases/:ref/convert sends dashboard token as bearer auth", async () => {
    const { POST } = await import("./[ref]/convert/route");
    allowRateLimit();
    fetchWithTimeout.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "activation_pending" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const ref = "ps-convert-ref";
    const request = buildNextRequest(`http://localhost/api/prospect-showcases/${ref}/convert`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({
        email: "owner@example.com",
        conversionToken: "conversion-token",
        dashboardToken: "dashboard-token",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ ref }) });

    expect(response.status).toBe(200);
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      `https://api.example.com/api/prospect-showcases/${encodeURIComponent(ref)}/convert`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer dashboard-token",
          Accept: "application/json",
        }),
        body: JSON.stringify({
          email: "owner@example.com",
          conversionToken: "conversion-token",
        }),
      }),
      expect.objectContaining({ timeoutMs: 15000, signal: request.signal }),
    );
  });

  test("prospect ref routes reject invalid references before upstream calls", async () => {
    const { GET } = await import("./[ref]/status/route");
    const request = buildNextRequest(
      "http://localhost/api/prospect-showcases/not-valid!/status?token=t",
      {
        method: "GET",
        headers: { "x-forwarded-for": "1.2.3.4" },
      },
    );

    const response = await GET(request, { params: Promise.resolve({ ref: "not-valid!" }) });

    expect(response.status).toBe(400);
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });
});
