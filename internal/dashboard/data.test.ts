import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WebhooksAuthContext } from "./auth";
import type { SiteCustomerOverviewResponse } from "./webhooks";

const redisMock = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  sadd: vi.fn(),
  smembers: vi.fn(),
  expire: vi.fn(),
};

vi.mock("@/internal/core/redis", () => ({
  redis: redisMock,
}));

vi.mock("./webhooks", () => ({
  fetchSiteDashboardProjection: vi.fn(),
  fetchSiteCustomerOverview: vi.fn(),
  listSites: vi.fn(),
  listSupportedLanguages: vi.fn(),
}));

function makeAuth(subjectAccountId = "acct-1"): WebhooksAuthContext {
  return {
    token: "token",
    expiresAt: "2026-01-01T00:00:00.000Z",
    subjectAccountId,
    refresh: async () => "token",
  };
}

function makeCustomerOverviewPayload(): SiteCustomerOverviewResponse {
  return {
    meta: {
      view: "overview",
      generatedAt: "2026-01-01T00:00:00.000Z",
      schemaVersion: 1,
    },
    site: {
      id: "site-1",
      sourceUrl: "https://example.com",
      sourceLang: "en",
      status: "active",
      profile: null,
      servingMode: "strict",
    },
    account: {
      accountId: "acct-1",
      planType: "starter",
      planStatus: "active",
      mutationsAllowed: true,
    },
    health: {
      status: "healthy",
      titleKey: "dashboard.health.healthy.title",
      descriptionKey: "dashboard.health.healthy.description",
      lastImportantChangeAt: null,
    },
    nextAction: {
      kind: "none",
      priority: 0,
      severity: "none",
      titleKey: "dashboard.nextAction.none.title",
      descriptionKey: "dashboard.nextAction.none.description",
      cta: null,
    },
    blockers: [],
    languages: [],
    domains: [],
    pagesSummary: {
      totalKnownPages: 0,
      includedPages: 0,
      excludedPages: 0,
      translatedPages: 0,
      pendingPages: 0,
      failedPages: 0,
      nextEligibleCrawlAt: null,
      eligiblePageCount: 0,
      inventoryMayBeIncomplete: false,
      rawLatestCrawlStatus: null,
      customerCrawlStatus: "not_started",
    },
    currentActivity: [],
    errors: [],
    quotas: [],
  };
}

beforeEach(() => {
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  delete process.env.VERCEL_ENV;
  delete process.env.DASHBOARD_E2E_MOCK;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("dashboard data caches", () => {
  it("bypasses cache I/O for customer overview when dashboard e2e mock mode is enabled", async () => {
    process.env.DASHBOARD_E2E_MOCK = "1";
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue("OK");
    redisMock.sadd.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);

    const payload = makeCustomerOverviewPayload();
    const { fetchSiteCustomerOverview } = await import("./webhooks");
    const mockedFetchSiteCustomerOverview = vi.mocked(fetchSiteCustomerOverview);
    mockedFetchSiteCustomerOverview.mockResolvedValue(payload);
    const auth = makeAuth();

    const { getSiteCustomerOverviewCached } = await import("./data");
    const result = await getSiteCustomerOverviewCached(auth, "site-1");

    expect(result).toEqual(payload);
    expect(mockedFetchSiteCustomerOverview).toHaveBeenCalledWith(auth, "site-1");
    expect(redisMock.get).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
    expect(redisMock.sadd).not.toHaveBeenCalled();
    expect(redisMock.expire).not.toHaveBeenCalled();
  });

  it("fetches customer overview projection", async () => {
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue("OK");
    redisMock.sadd.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);

    const payload = makeCustomerOverviewPayload();
    const { fetchSiteCustomerOverview } = await import("./webhooks");
    const mockedFetchSiteCustomerOverview = vi.mocked(fetchSiteCustomerOverview);
    mockedFetchSiteCustomerOverview.mockResolvedValue(payload);

    const { getSiteCustomerOverviewCached } = await import("./data");
    const auth = makeAuth();
    const result = await getSiteCustomerOverviewCached(auth, "site-1");

    expect(result).toEqual(payload);
    expect(mockedFetchSiteCustomerOverview).toHaveBeenCalledWith(auth, "site-1");
    expect(redisMock.set).toHaveBeenCalledWith(expect.any(String), payload, { ex: 30 });
    const cacheKey = redisMock.set.mock.calls[0][0];
    expect(cacheKey.startsWith("dashboard:site-dashboard-projection:")).toBe(true);
    expect(redisMock.sadd).toHaveBeenCalledWith(
      expect.stringContaining("dashboard:site-dashboard:index:"),
      cacheKey,
    );
  });

  it("resolves target locales from the focused languages projection", async () => {
    const { fetchSiteDashboardProjection, listSites } = await import("./webhooks");
    const mockedProjection = vi.mocked(fetchSiteDashboardProjection);
    const mockedListSites = vi.mocked(listSites);
    const auth = makeAuth();
    mockedProjection.mockResolvedValue({
      meta: {
        view: "languages",
        generatedAt: "2026-01-01T00:00:00.000Z",
        schemaVersion: 1,
      },
      site: {
        id: "site-1",
        sourceUrl: "https://example.com",
        sourceLang: "en",
        status: "active",
        profile: null,
        servingMode: "strict",
      },
      access: {
        mutationsAllowed: true,
        features: {},
        canUseGlossary: true,
        canUseOverrides: true,
        canEditSlugs: true,
        canUseConsistencyGovernance: true,
        canAddLanguage: true,
        canRemoveLanguage: true,
        canUpdateLanguageAliases: true,
        canToggleServing: true,
      },
      sourceLanguage: { tag: "en" },
      targetLanguages: [
        {
          tag: "ja",
          labelKey: "languages.ja",
          servingStatus: { value: "not_live", rawStatus: null },
          deployment: null,
          canRemove: true,
        },
        {
          tag: "fr",
          labelKey: "languages.fr",
          servingStatus: { value: "not_live", rawStatus: null },
          deployment: null,
          canRemove: true,
        },
        {
          tag: "fr",
          labelKey: "languages.fr",
          servingStatus: { value: "not_live", rawStatus: null },
          deployment: null,
          canRemove: true,
        },
      ],
      localeQuota: {
        used: 3,
        limit: null,
        remaining: null,
      },
    } as never);
    mockedListSites.mockResolvedValue([
      {
        id: "site-1",
        accountId: "acct-1",
        sourceUrl: "https://example.com",
        status: "active",
        servingMode: "strict",
        maxLocales: null,
        siteProfile: null,
        sourceLang: "en",
        targetLangs: ["ja", "fr", "fr", ""],
        localeCount: 4,
        serveEnabledLocaleCount: 2,
        domainCount: 0,
        verifiedDomainCount: 0,
      },
    ]);

    const { getSiteTargetLangsCached } = await import("./data");
    const targetLangs = await getSiteTargetLangsCached(auth, "site-1");

    expect(targetLangs).toEqual(["fr", "ja"]);
    expect(mockedProjection).toHaveBeenCalledWith(auth, "site-1", "languages");
    expect(mockedListSites).not.toHaveBeenCalled();
  });

  it("keeps customer overview projection cache scoped by subject account", async () => {
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue("OK");
    redisMock.sadd.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);

    const payload = makeCustomerOverviewPayload();
    const { fetchSiteCustomerOverview } = await import("./webhooks");
    vi.mocked(fetchSiteCustomerOverview).mockResolvedValue(payload);

    const { getSiteCustomerOverviewCached } = await import("./data");

    await getSiteCustomerOverviewCached(makeAuth("acct-1"), "site-1");
    await getSiteCustomerOverviewCached(makeAuth("acct-2"), "site-1");

    expect(redisMock.set).toHaveBeenCalledTimes(2);
    const firstCacheKey = redisMock.set.mock.calls[0]?.[0];
    const secondCacheKey = redisMock.set.mock.calls[1]?.[0];
    expect(typeof firstCacheKey).toBe("string");
    expect(typeof secondCacheKey).toBe("string");
    expect(firstCacheKey).not.toBe(secondCacheKey);
  });

  it("invalidates indexed site dashboard projection cache variants", async () => {
    redisMock.smembers.mockResolvedValue([
      "dashboard:site-dashboard:test:1",
      "dashboard:site-dashboard:test:2",
    ]);
    redisMock.del.mockResolvedValue(4);

    const { invalidateSiteDashboardCache } = await import("./data");
    await invalidateSiteDashboardCache(makeAuth("acct-1"), "site-1");

    expect(redisMock.smembers).toHaveBeenCalledWith(
      expect.stringContaining("dashboard:site-dashboard:index:"),
    );
    expect(redisMock.del).toHaveBeenCalledOnce();
    const deletedKeys = redisMock.del.mock.calls[0] as string[];
    expect(deletedKeys).toEqual(
      expect.arrayContaining([
        "dashboard:site-dashboard:test:1",
        "dashboard:site-dashboard:test:2",
      ]),
    );
    expect(deletedKeys.some((key) => key.startsWith("dashboard:site-dashboard-projection:"))).toBe(
      true,
    );
    expect(deletedKeys.some((key) => key.startsWith("dashboard:site-dashboard:index:"))).toBe(true);
  });
});
