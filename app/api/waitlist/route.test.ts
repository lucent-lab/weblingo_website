import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const rateLimitFixedWindow = vi.fn();
vi.mock("@internal/core/rate-limit", () => ({ rateLimitFixedWindow }));
vi.mock("@internal/core/redis", () => ({ redis: {} }));

const createServiceRoleClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient }));

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setRequiredEnv() {
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

  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "upstash_token";
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

  it("returns 503 when the rate limit backend fails in production", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    try {
      rateLimitFixedWindow.mockRejectedValueOnce(new Error("fetch failed"));

      vi.resetModules();
      const { POST } = await import("./route");
      const response = await POST(makeRequest({ email: "a@example.com" }));

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.error).toBeTruthy();
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = ORIGINAL_NODE_ENV;
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
  });
});
