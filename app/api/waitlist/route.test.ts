import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const rateLimitFixedWindow = vi.fn();
vi.mock("@internal/core/rate-limit", () => ({ rateLimitFixedWindow }));
vi.mock("@internal/core/redis", () => ({ redis: {} }));

const createServiceRoleClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));

const analyticsMocks = vi.hoisted(() => ({
  captureServerAnalyticsEvent: vi.fn(),
  captureServerException: vi.fn(),
  hashAnalyticsIdentifier: vi.fn((namespace: string, value: string | null | undefined) =>
    value ? `${namespace}:hashed` : null,
  ),
}));
vi.mock("@internal/analytics/server", () => analyticsMocks);

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

  process.env.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_WAITLIST_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_WAITLIST_MAX_BODY_BYTES = "4096";
  process.env.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_CONTACT_MAX_PER_WINDOW = "10";

  process.env.UPSTASH_REDIS__KV_REST_API_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS__KV_REST_API_TOKEN = "upstash_token";
}

function makeRequest(payload: unknown): NextRequest {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "1.2.3.4",
    },
    body: JSON.stringify(payload),
  }) as unknown as NextRequest;
}

beforeAll(() => {
  process.env = { ...ORIGINAL_ENV };
  setRequiredEnv();
});

beforeEach(() => {
  rateLimitFixedWindow.mockReset();
  createServiceRoleClient.mockReset();
  analyticsMocks.captureServerAnalyticsEvent.mockReset();
  analyticsMocks.captureServerException.mockReset();
  analyticsMocks.hashAnalyticsIdentifier.mockClear();
});

describe("POST /api/waitlist", () => {
  it("returns 429 when rate-limited", async () => {
    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: false,
      limit: 1,
      remaining: 0,
      resetAtMs: Date.now() + 1000,
      current: 2,
      key: "k",
    });

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest({ email: "a@example.com" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
  });

  it("returns 503 and logs cause details when the rate limit backend fails", async () => {
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const error = new Error("fetch failed");
      (error as Error & { cause?: unknown }).cause = {
        message: "getaddrinfo ENOTFOUND example.upstash.io",
        code: "ENOTFOUND",
        syscall: "getaddrinfo",
        hostname: "example.upstash.io",
      };
      rateLimitFixedWindow.mockRejectedValueOnce(error);

      vi.resetModules();
      const { POST } = await import("./route");
      const response = await POST(makeRequest({ email: "a@example.com" }));

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.error).toBeTruthy();
      expect(logSpy).toHaveBeenCalledOnce();
      const logPayload = JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "{}"));
      expect(logPayload).toMatchObject({
        level: "error",
        message: "Rate limit backend failed (waitlist create ip)",
        error: "fetch failed",
        error_cause: "getaddrinfo ENOTFOUND example.upstash.io",
        error_cause_code: "ENOTFOUND",
        error_cause_syscall: "getaddrinfo",
        error_cause_hostname: "example.upstash.io",
      });
      expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          route_area: "api",
          route_template: "/api/waitlist",
          source: "waitlist_rate_limit",
        }),
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("returns 413 when payload exceeds max bytes", async () => {
    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAtMs: Date.now() + 1000,
      current: 1,
      key: "k",
    });

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest({ email: "a@example.com", big: "x".repeat(10_000) }));

    expect(response.status).toBe(413);
  });

  it("returns 200 when upsert succeeds", async () => {
    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAtMs: Date.now() + 1000,
      current: 1,
      key: "k",
    });

    const single = vi.fn(async () => ({
      data: { id: "waitlist-1", created_at: "2026-02-10T00:00:00.000Z" },
      error: null,
    }));
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ upsert }));
    createServiceRoleClient.mockReturnValue({ from });

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest({ email: "a@example.com" }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      signupId: "waitlist-1",
      createdAt: "2026-02-10T00:00:00.000Z",
    });
    expect(from).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledOnce();
    expect(analyticsMocks.captureServerAnalyticsEvent).toHaveBeenCalledWith(
      "waitlist_signup_saved",
      expect.objectContaining({
        site_url_present: false,
      }),
      expect.objectContaining({ distinctId: "waitlist_signup:hashed" }),
    );
  });

  it("captures API route metadata when waitlist upsert fails", async () => {
    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAtMs: Date.now() + 1000,
      current: 1,
      key: "k",
    });

    const error = { message: "database unavailable" };
    const single = vi.fn(async () => ({
      data: null,
      error,
    }));
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ upsert }));
    createServiceRoleClient.mockReturnValue({ from });

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest({ email: "a@example.com" }));

    expect(response.status).toBe(500);
    expect(analyticsMocks.captureServerException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        route_area: "api",
        route_template: "/api/waitlist",
        source: "waitlist_upsert",
      }),
    );
  });
});

describe("POST /api/waitlist with Turnstile enabled", () => {
  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = "0xSECRET";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0xSITE";
  });

  afterEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    vi.unstubAllGlobals();
  });

  it("blocks with 403 when the Turnstile token is rejected", async () => {
    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAtMs: Date.now() + 1000,
      current: 1,
      key: "k",
    });
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
    const response = await POST(makeRequest({ email: "a@example.com", turnstileToken: "bad" }));

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("fails open (200) when Cloudflare verification is unavailable", async () => {
    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAtMs: Date.now() + 1000,
      current: 1,
      key: "k",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("cloudflare down");
      }),
    );

    const single = vi.fn(async () => ({
      data: { id: "waitlist-2", created_at: "2026-02-10T00:00:00.000Z" },
      error: null,
    }));
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ upsert }));
    createServiceRoleClient.mockReturnValue({ from });

    vi.resetModules();
    const { POST } = await import("./route");
    const response = await POST(makeRequest({ email: "a@example.com", turnstileToken: "tok" }));

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledOnce();
  });
});
