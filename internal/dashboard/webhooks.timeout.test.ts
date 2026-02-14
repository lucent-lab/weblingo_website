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

  it("applies endpoint timeout profiles for list/detail/auth requests", async () => {
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer token");
        expect(typeof headers.get("x-dashboard-trace-id")).toBe("string");
        return new Response(
          JSON.stringify({
            sites: [
              {
                id: "site-1",
                accountId: "acct-1",
                sourceUrl: "https://example.com",
                status: "active",
                servingMode: "strict",
                maxLocales: null,
                siteProfile: null,
                sourceLang: "en",
                targetLangs: ["fr"],
                localeCount: 1,
                serveEnabledLocaleCount: 1,
                domainCount: 1,
                verifiedDomainCount: 1,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      })
      .mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            id: "site-1",
            accountId: "acct-1",
            sourceUrl: "https://example.com",
            status: "active",
            servingMode: "strict",
            maxLocales: null,
            siteProfile: null,
            locales: [
              {
                sourceLang: "en",
                targetLang: "fr",
                alias: "fr",
                serveEnabled: true,
              },
            ],
            domains: [],
            latestCrawlRun: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      })
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer sb-token");
        return new Response(
          JSON.stringify({
            token: "wb-token",
            expiresAt: tokenExpiresAt,
            entitlements: { planType: "pro", planStatus: "active" },
            actorAccountId: "acct-1",
            subjectAccountId: "acct-1",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    vi.resetModules();
    const { exchangeWebhooksToken, fetchSite, listSites } = await import("./webhooks");

    await listSites("token");
    await fetchSite("token", "site-1");
    await exchangeWebhooksToken("sb-token");

    const timeoutValues = timeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((value): value is number => typeof value === "number");
    expect(timeoutValues).toContain(7_500);
    expect(timeoutValues).toContain(10_000);
    expect(timeoutValues).toContain(6_000);
  });

  it("requests consolidated site dashboard payload with query params", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toContain("/sites/site-1/dashboard");
      expect(url).toContain("includePages=true");
      expect(url).toContain("limit=10");
      expect(url).toContain("offset=20");

      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer token");
      expect(typeof headers.get("x-dashboard-trace-id")).toBe("string");

      return new Response(
        JSON.stringify({
          site: {
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
          },
          deployments: [],
          pages: [
            {
              id: "page-1",
              sourcePath: "/",
              lastSeenAt: null,
              lastCrawledAt: null,
              lastSnapshotAt: null,
              nextCrawlAt: null,
              lastVersionAt: null,
            },
          ],
          pagination: {
            limit: 10,
            offset: 20,
            total: 21,
            hasMore: false,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    vi.resetModules();
    const { fetchSiteDashboard } = await import("./webhooks");
    const payload = await fetchSiteDashboard("token", "site-1", {
      includePages: true,
      limit: 10,
      offset: 20,
    });

    expect(payload.site.id).toBe("site-1");
    expect(payload.pages).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const timeoutValues = timeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((value): value is number => typeof value === "number");
    expect(timeoutValues).toContain(10_000);
  });
});
