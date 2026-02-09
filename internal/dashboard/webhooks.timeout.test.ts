import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function setClientEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_123";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://posthog.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_anon_key";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://api.weblingo.example/api";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "15000";
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  setClientEnv();
  (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("webhooks request wrapper", () => {
  it("passes an AbortSignal to fetch (timeout guard)", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(typeof input === "string" ? input : input.toString()).toContain("/sites/site-1");
      expect(init?.signal).toBeTruthy();
      expect(typeof (init?.signal as AbortSignal | undefined)?.aborted).toBe("boolean");

      const site = {
        id: "site-1",
        accountId: "acct-1",
        sourceUrl: "https://example.com",
        status: "active",
        servingMode: "strict",
        maxLocales: null,
        siteProfile: null,
        locales: [],
        domains: [],
        latestCrawlRun: null,
      };
      return new Response(JSON.stringify(site), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    vi.resetModules();
    const { fetchSite } = await import("./webhooks");
    const site = await fetchSite("token", "site-1");

    expect(site.id).toBe("site-1");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
