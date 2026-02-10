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
  process.env.WEBSITE_PREVIEW_MAX_BODY_BYTES = "200";
  process.env.WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS = "15000";
  process.env.WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS = "15000";
  process.env.WEBSITE_PREVIEW_UPSTREAM_STREAM_CONNECT_TIMEOUT_MS = "15000";

  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "upstash_token";
});

beforeEach(() => {
  rateLimitFixedWindow.mockReset();
  fetchWithTimeout.mockReset();
});

function buildNextRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

describe("/api/previews proxy routes", () => {
  test("POST /api/previews returns 429 when rate-limited", async () => {
    const { POST } = await import("./route");

    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: false,
      limit: 1,
      remaining: 0,
      resetAtMs: Date.now() + 1000,
      current: 2,
      key: "k",
    });

    const request = buildNextRequest("http://localhost/api/previews", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({ sourceUrl: "https://example.com" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
  });

  test("POST /api/previews returns 413 when payload exceeds max bytes", async () => {
    const { POST } = await import("./route");

    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAtMs: Date.now() + 1000,
      current: 1,
      key: "k",
    });

    const request = buildNextRequest("http://localhost/api/previews", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({ sourceUrl: "https://example.com", big: "x".repeat(500) }),
    });

    const response = await POST(request);
    expect(response.status).toBe(413);
  });

  test("POST /api/previews returns 504 when upstream times out", async () => {
    const { POST } = await import("./route");

    rateLimitFixedWindow
      .mockResolvedValueOnce({
        allowed: true,
        limit: 100,
        remaining: 99,
        resetAtMs: Date.now() + 1000,
        current: 1,
        key: "k",
      })
      .mockResolvedValueOnce({
        allowed: true,
        limit: 100,
        remaining: 99,
        resetAtMs: Date.now() + 1000,
        current: 1,
        key: "k",
      });

    fetchWithTimeout.mockRejectedValueOnce(new FetchTimeoutError());

    const request = buildNextRequest("http://localhost/api/previews", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
      },
      body: JSON.stringify({ sourceUrl: "https://example.com" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(504);
  });

  test("GET /api/previews/:id returns 400 for invalid id", async () => {
    const { GET } = await import("./[id]/route");

    const request = buildNextRequest("http://localhost/api/previews/not-a-uuid?token=t", {
      method: "GET",
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    const response = await GET(request, { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(response.status).toBe(400);
  });

  test("GET /api/previews/:id returns 429 when rate-limited", async () => {
    const { GET } = await import("./[id]/route");

    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: false,
      limit: 1,
      remaining: 0,
      resetAtMs: Date.now() + 1000,
      current: 2,
      key: "k",
    });

    const id = "11111111-1111-1111-1111-111111111111";
    const request = buildNextRequest(`http://localhost/api/previews/${id}?token=t`, {
      method: "GET",
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    const response = await GET(request, { params: Promise.resolve({ id }) });
    expect(response.status).toBe(429);
  });

  test("GET /api/previews/:id/stream returns 504 when upstream connect times out", async () => {
    const { GET } = await import("./[id]/stream/route");

    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAtMs: Date.now() + 1000,
      current: 1,
      key: "k",
    });

    fetchWithTimeout.mockRejectedValueOnce(new FetchTimeoutError());

    const id = "11111111-1111-1111-1111-111111111111";
    const request = buildNextRequest(`http://localhost/api/previews/${id}/stream?token=t`, {
      method: "GET",
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    const response = await GET(request, { params: Promise.resolve({ id }) });
    expect(response.status).toBe(504);
  });

  test("GET /api/previews/:id/stream rejects non-event-stream upstream", async () => {
    const { GET } = await import("./[id]/stream/route");

    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAtMs: Date.now() + 1000,
      current: 1,
      key: "k",
    });

    fetchWithTimeout.mockResolvedValueOnce(
      new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
    );

    const id = "11111111-1111-1111-1111-111111111111";
    const request = buildNextRequest(`http://localhost/api/previews/${id}/stream?token=t`, {
      method: "GET",
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    const response = await GET(request, { params: Promise.resolve({ id }) });
    expect(response.status).toBe(502);
  });
});
