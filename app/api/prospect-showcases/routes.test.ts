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

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));
vi.mock("@internal/core/redis", () => ({ redis: redisMock }));

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
  redisMock.get.mockReset();
  redisMock.set.mockReset();
  redisMock.del.mockReset();
  redisMock.get.mockResolvedValue(null);
  redisMock.set.mockResolvedValue("OK");
  redisMock.del.mockResolvedValue(1);
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

function demoClaimPayload(options?: {
  expiresAt?: string;
  actorAccountId?: string;
  subjectAccountId?: string;
  siteId?: string;
}) {
  const siteId = options?.siteId ?? "site-demo";
  return {
    token: "dashboard-token",
    expiresAt: options?.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    entitlements: { planType: "starter", planStatus: "active" },
    actorAccountId: options?.actorAccountId ?? "acct-demo",
    subjectAccountId: options?.subjectAccountId ?? "acct-demo",
    prospectShowcaseId: "ps-id",
    prospectShowcaseRef: "ps-test-ref",
    siteId,
    demo: true,
    conversionToken: "conversion-token",
  };
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
      new Response(JSON.stringify(demoClaimPayload()), {
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
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      demo: true,
      expiresAt: expect.any(String),
      prospectShowcaseRef: "ps-test-ref",
      siteId: "site-demo",
      redirectUrl: "/dashboard/sites/site-demo",
    });
    expect(payload.token).toBeUndefined();
    expect(payload.conversionToken).toBeUndefined();
    expect(response.headers.get("set-cookie")).toContain("weblingo_dashboard_demo=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(redisMock.set).toHaveBeenCalledWith(
      expect.stringMatching(/^dashboard:demo-session:v1:[a-f0-9]{64}$/),
      expect.objectContaining({
        token: "dashboard-token",
        conversionToken: "conversion-token",
        actorAccountId: "acct-demo",
        subjectAccountId: "acct-demo",
        siteId: "site-demo",
        demo: true,
      }),
      expect.objectContaining({ ex: expect.any(Number) }),
    );
    expect(rateLimitFixedWindow).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        key: "rl:v1:preview:prospect-claim:ip:1.2.3.4",
        limit: 20,
        windowMs: 60000,
      }),
    );
    expect(request.nextUrl.search).toBe("");
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      "https://api.example.com/api/prospect-showcases/claim",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ token: "dashboard-token" }),
      }),
      expect.objectContaining({ timeoutMs: 15000, signal: request.signal }),
    );
  });

  test("POST /api/prospect-showcases/claim rejects invalid upstream dashboard claims", async () => {
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

    expect(response.status).toBe(502);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  test("POST /api/prospect-showcases/claim rejects expired upstream dashboard claims", async () => {
    const { POST } = await import("./claim/route");
    allowRateLimit();
    fetchWithTimeout.mockResolvedValueOnce(
      new Response(JSON.stringify(demoClaimPayload({ expiresAt: "2026-01-01T00:00:00.000Z" })), {
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

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  test("POST /api/prospect-showcases/claim uses the create timeout budget", async () => {
    const originalCreateTimeout = process.env.WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS;
    const originalStatusTimeout = process.env.WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS;
    vi.resetModules();
    process.env.WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS = "23000";
    process.env.WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS = "7000";
    try {
      const { POST } = await import("./claim/route");
      allowRateLimit();
      fetchWithTimeout.mockResolvedValueOnce(
        new Response(JSON.stringify(demoClaimPayload()), {
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
      expect(fetchWithTimeout).toHaveBeenCalledWith(
        "https://api.example.com/api/prospect-showcases/claim",
        expect.anything(),
        expect.objectContaining({ timeoutMs: 23000, signal: request.signal }),
      );
    } finally {
      process.env.WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS = originalCreateTimeout;
      process.env.WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS = originalStatusTimeout;
      vi.resetModules();
    }
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

  test("POST /api/prospect-showcases/:ref/convert forwards demo bearer auth upstream", async () => {
    const { POST } = await import("./[ref]/convert/route");
    allowRateLimit();
    fetchWithTimeout.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          prospectShowcaseRef: "ps-convert-ref",
          status: "checkout_pending",
          activationStatus: "activation_pending",
          locked: true,
          lockedReason: "payment_required",
          accountId: "acct-demo",
          siteId: "site-demo",
          nextAction: "complete_payment",
          inviteLink: "https://supabase.example.test/invite/demo",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const ref = "ps-convert-ref";
    const request = buildNextRequest(`http://localhost/api/prospect-showcases/${ref}/convert`, {
      method: "POST",
      headers: {
        Authorization: "Bearer dashboard-demo-token",
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({
        email: "Owner@Example.com",
        conversionToken: "conversion-token",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ ref }) });

    expect(response.status).toBe(200);
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      `https://api.example.com/api/prospect-showcases/${encodeURIComponent(ref)}/convert`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer dashboard-demo-token",
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify({
          email: "Owner@Example.com",
          conversionToken: "conversion-token",
        }),
      }),
      expect.objectContaining({ timeoutMs: 15000, signal: request.signal }),
    );
  });

  test("POST /api/prospect-showcases/:ref/convert preserves body dashboardToken compatibility", async () => {
    const { POST } = await import("./[ref]/convert/route");
    allowRateLimit();
    fetchWithTimeout.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "checkout_pending" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const ref = "ps-convert-ref";
    const request = buildNextRequest(`http://localhost/api/prospect-showcases/${ref}/convert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({
        dashboardToken: "dashboard-demo-token",
        email: "Owner@Example.com",
        conversionToken: "conversion-token",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ ref }) });

    expect(response.status).toBe(200);
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      `https://api.example.com/api/prospect-showcases/${encodeURIComponent(ref)}/convert`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer dashboard-demo-token",
        }),
        body: JSON.stringify({
          email: "Owner@Example.com",
          conversionToken: "conversion-token",
        }),
      }),
      expect.objectContaining({ timeoutMs: 15000, signal: request.signal }),
    );
  });

  test("POST /api/prospect-showcases/:ref/convert requires demo bearer auth", async () => {
    const { POST } = await import("./[ref]/convert/route");

    const request = buildNextRequest(
      "http://localhost/api/prospect-showcases/ps-convert-ref/convert",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "1.2.3.4",
        },
        body: JSON.stringify({
          email: "Owner@Example.com",
          conversionToken: "conversion-token",
        }),
      },
    );

    const response = await POST(request, { params: Promise.resolve({ ref: "ps-convert-ref" }) });

    expect(response.status).toBe(401);
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  test("POST /api/prospect-showcases/access-link/resend forwards original email upstream", async () => {
    const { POST } = await import("./access-link/resend/route");
    allowRateLimit();
    fetchWithTimeout.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const request = buildNextRequest("http://localhost/api/prospect-showcases/access-link/resend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({ email: "Owner@Example.com" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(fetchWithTimeout).toHaveBeenCalledWith(
      "https://api.example.com/api/prospect-showcases/access-link/resend",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-preview-token": "preview_token",
          Accept: "application/json",
        }),
        body: JSON.stringify({ email: "Owner@Example.com" }),
      }),
      expect.objectContaining({ timeoutMs: 15000, signal: request.signal }),
    );
  });

  test("POST /api/prospect-showcases/access-link/resend rejects malformed emails locally", async () => {
    const { POST } = await import("./access-link/resend/route");

    const request = buildNextRequest("http://localhost/api/prospect-showcases/access-link/resend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid email" });
    expect(fetchWithTimeout).not.toHaveBeenCalled();
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
