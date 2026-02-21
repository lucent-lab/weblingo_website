import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const rateLimitFixedWindow = vi.fn();
vi.mock("@internal/core/rate-limit", () => ({ rateLimitFixedWindow }));

const fetchWithTimeout = vi.fn();
class FetchTimeoutError extends Error {
  constructor(message = "fetch timed out") {
    super(message);
    this.name = "FetchTimeoutError";
  }
}
vi.mock("@internal/core/fetch-timeout", () => ({ fetchWithTimeout, FetchTimeoutError }));
vi.mock("@internal/core/redis", () => ({ redis: {} }));

function buildRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://weblingo.app";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_123";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://app.posthog.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "15000";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://api.example.com/api";
  process.env.PUBLIC_PORTAL_MODE = "enabled";
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
  process.env.SUPABASE_SECRET_KEY = "supabase_secret_123";
  process.env.SUPABASE_AUTH_TIMEOUT_MS = "10000";
  process.env.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_WAITLIST_MAX_PER_WINDOW = "10";
  process.env.WEBSITE_WAITLIST_MAX_BODY_BYTES = "4096";
  process.env.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_CONTACT_MAX_PER_WINDOW = "10";
  process.env.UPSTASH_REDIS__KV_REST_API_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS__KV_REST_API_TOKEN = "upstash_token";
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
});

beforeEach(() => {
  rateLimitFixedWindow.mockReset();
  fetchWithTimeout.mockReset();
  rateLimitFixedWindow.mockResolvedValue({
    allowed: true,
    limit: 100,
    remaining: 99,
    resetAtMs: Date.now() + 1000,
    current: 1,
    key: "k",
  });
});

describe("Preview API contract snapshots", () => {
  it("POST /api/previews keeps required response fields", async () => {
    const { POST } = await import("../../app/api/previews/route");

    fetchWithTimeout.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          previewId: "11111111-1111-1111-1111-111111111111",
          statusToken: "token",
          status: "pending",
          stage: "fetching_page",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await POST(
      buildRequest("http://localhost/api/previews", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "1.2.3.4",
        },
        body: JSON.stringify({
          sourceUrl: "https://example.com",
          sourceLang: "en",
          targetLang: "fr",
        }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      previewId: expect.any(String),
      statusToken: expect.any(String),
      status: expect.any(String),
    });
  });

  it("GET /api/previews/:id keeps required response fields", async () => {
    const { GET } = await import("../../app/api/previews/[id]/route");

    fetchWithTimeout.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "processing",
          stage: "translating",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const id = "11111111-1111-1111-1111-111111111111";
    const response = await GET(
      buildRequest(`http://localhost/api/previews/${id}?token=t`, {
        method: "GET",
        headers: { "x-forwarded-for": "1.2.3.4" },
      }),
      { params: Promise.resolve({ id }) },
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: expect.any(String),
    });
  });

  it("GET /api/previews/:id/stream keeps text/event-stream contract", async () => {
    const { GET } = await import("../../app/api/previews/[id]/stream/route");

    fetchWithTimeout.mockResolvedValueOnce(
      new Response("event: heartbeat\n\ndata: {}\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const id = "11111111-1111-1111-1111-111111111111";
    const response = await GET(
      buildRequest(`http://localhost/api/previews/${id}/stream?token=t`, {
        method: "GET",
        headers: { "x-forwarded-for": "1.2.3.4" },
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
  });
});
