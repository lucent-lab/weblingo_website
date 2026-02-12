import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function setRequiredEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_123";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://posthog.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_anon_key";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://api.weblingo.example/api";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "15000";

  process.env.PUBLIC_PORTAL_MODE = "enabled";
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.SUPABASE_SECRET_KEY = "sb_service_role";
  process.env.SUPABASE_AUTH_TIMEOUT_MS = "15000";

  process.env.WEBSITE_WAITLIST_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_WAITLIST_MAX_PER_WINDOW = "20";
  process.env.WEBSITE_WAITLIST_MAX_BODY_BYTES = "4096";
  process.env.WEBSITE_CONTACT_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.WEBSITE_CONTACT_MAX_PER_WINDOW = "10";

  // envServer requires either Upstash or KV REST credentials.
  process.env.UPSTASH_REDIS__KV_REST_API_URL = "https://redis.example.com";
  process.env.UPSTASH_REDIS__KV_REST_API_TOKEN = "redis_token";
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  setRequiredEnv();
  (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("fetchUserByEmail", () => {
  it("passes an AbortSignal to fetch (timeout guard)", async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeTruthy();
      expect(typeof (init?.signal as AbortSignal | undefined)?.aborted).toBe("boolean");
      return new Response(JSON.stringify({ users: [{ id: "user-1" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    vi.resetModules();
    const { fetchUserByEmail } = await import("./admin");
    const user = await fetchUserByEmail("a@example.com");

    expect(user?.id).toBe("user-1");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
