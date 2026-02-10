import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

class RedirectError extends Error {
  public readonly url: string;

  constructor(url: string) {
    super("redirect");
    this.name = "RedirectError";
    this.url = url;
  }
}

const redirect = vi.fn((url: string) => {
  throw new RedirectError(url);
});
vi.mock("next/navigation", () => ({ redirect }));

const headers = vi.fn(async () => new Headers({ "x-forwarded-for": "1.2.3.4" }));
vi.mock("next/headers", () => ({ headers }));

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

  delete process.env.TRY_NOW_TOKEN;

  process.env.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_WAITLIST_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_WAITLIST_MAX_BODY_BYTES = "4096";
  process.env.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_CONTACT_MAX_PER_WINDOW = "10";

  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "upstash_token";
}

beforeAll(() => {
  process.env = { ...ORIGINAL_ENV };
  setRequiredEnv();
});

beforeEach(() => {
  rateLimitFixedWindow.mockReset();
  createServiceRoleClient.mockReset();
  redirect.mockClear();
  headers.mockClear();
});

describe("submitContactMessage", () => {
  it("redirects with rate_limited when per-ip limit is exceeded", async () => {
    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: false,
      limit: 1,
      remaining: 0,
      resetAtMs: Date.now() + 1000,
      current: 2,
      key: "k",
    });

    vi.resetModules();
    const { submitContactMessage } = await import("./actions");

    const formData = new FormData();
    formData.set("fullName", "A");
    formData.set("workEmail", "a@example.com");

    await expect(submitContactMessage("en", formData)).rejects.toMatchObject({
      url: "/en/contact?error=rate_limited",
    });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("redirects with server when the rate limit backend fails in production", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    try {
      rateLimitFixedWindow.mockRejectedValueOnce(new Error("fetch failed"));

      vi.resetModules();
      const { submitContactMessage } = await import("./actions");

      const formData = new FormData();
      formData.set("fullName", "A");
      formData.set("workEmail", "a@example.com");

      await expect(submitContactMessage("en", formData)).rejects.toMatchObject({
        url: "/en/contact?error=server",
      });
      expect(createServiceRoleClient).not.toHaveBeenCalled();
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = ORIGINAL_NODE_ENV;
    }
  });

  it("redirects with submitted=1 when insert succeeds", async () => {
    rateLimitFixedWindow.mockResolvedValueOnce({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAtMs: Date.now() + 1000,
      current: 1,
      key: "k",
    });

    const insert = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ insert }));
    createServiceRoleClient.mockReturnValue({ from });

    vi.resetModules();
    const { submitContactMessage } = await import("./actions");

    const formData = new FormData();
    formData.set("fullName", "A");
    formData.set("workEmail", "a@example.com");
    formData.set("domain", "https://example.com");

    await expect(submitContactMessage("en", formData)).rejects.toMatchObject({
      url: "/en/contact?submitted=1",
    });
    expect(createServiceRoleClient).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledOnce();
  });
});
