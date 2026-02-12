import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

const rateLimitFixedWindow = vi.fn();
vi.mock("@internal/core/rate-limit", () => ({ rateLimitFixedWindow }));
vi.mock("@internal/core/redis", () => ({ redis: {} }));

function setRequiredEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://example.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://client.example.com/api";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "15000";

  process.env.PUBLIC_PORTAL_MODE = "enabled";
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.SUPABASE_SECRET_KEY = "sb_secret";
  process.env.SUPABASE_AUTH_TIMEOUT_MS = "15000";

  process.env.UPSTASH_REDIS__KV_REST_API_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS__KV_REST_API_TOKEN = "upstash_token";

  process.env.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_WAITLIST_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_WAITLIST_MAX_BODY_BYTES = "4096";
  process.env.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_CONTACT_MAX_PER_WINDOW = "10";

  // Only required when TRY_NOW_TOKEN is set; set here to keep route imports stable.
  process.env.WEBSITE_PREVIEW_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_PREVIEW_CREATE_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_PREVIEW_CREATE_MAX_PER_SOURCE_HOST_PER_WINDOW = "10";
  process.env.WEBSITE_PREVIEW_STATUS_MAX_PER_WINDOW = "60";
  process.env.WEBSITE_PREVIEW_STREAM_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_PREVIEW_MAX_BODY_BYTES = "200";
  process.env.WEBSITE_PREVIEW_UPSTREAM_CREATE_TIMEOUT_MS = "15000";
  process.env.WEBSITE_PREVIEW_UPSTREAM_STATUS_TIMEOUT_MS = "15000";
  process.env.WEBSITE_PREVIEW_UPSTREAM_STREAM_CONNECT_TIMEOUT_MS = "15000";
}

function makeRequest(payload: unknown, accept = "application/json") {
  return new Request("http://localhost/api/previews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: accept,
    },
    body: JSON.stringify(payload),
  }) as unknown as NextRequest;
}

async function loadRoute() {
  vi.resetModules();
  return await import("../../app/api/previews/route");
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  setRequiredEnv();
  (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
  rateLimitFixedWindow.mockReset();
  rateLimitFixedWindow.mockResolvedValue({
    allowed: true,
    limit: 100,
    remaining: 99,
    resetAtMs: Date.now() + 1000,
    current: 1,
    key: "k",
  });
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("preview api env", () => {
  it("returns 500 when preview env is missing", async () => {
    delete process.env.TRY_NOW_TOKEN;

    const { POST } = await loadRoute();
    const response = await POST(makeRequest({ sourceUrl: "https://example.com" }));

    expect(response.status).toBe(500);
  });

  it("uses public preview base with the server-only token", async () => {
    process.env.TRY_NOW_TOKEN = "server-preview-token";
    process.env.NEXT_PUBLIC_TRY_NOW_TOKEN = "client-preview-token";

    const fetchSpy = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    const { POST } = await loadRoute();
    const response = await POST(makeRequest({ sourceUrl: "https://example.com" }));

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const call = fetchSpy.mock.calls.at(0);
    if (!call) {
      throw new Error("Expected preview fetch to be called.");
    }
    const [url, init] = call;
    expect(url).toBe("https://client.example.com/api/previews");
    const headers = (init as RequestInit | undefined)?.headers as Record<string, string>;
    expect(headers["x-preview-token"]).toBe("server-preview-token");
  });
});
