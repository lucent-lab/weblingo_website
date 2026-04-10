import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = {
  del: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock("@/internal/core/redis", () => ({
  redis: redisMock,
}));

const session = {
  access_token: "session-token",
  refresh_token: "refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: { id: "user-1", email: "owner@example.com" },
} as const;

const cookiesStore = {
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookiesStore),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("./webhooks", () => ({
  exchangeWebhooksToken: vi.fn(),
  fetchDashboardBootstrap: vi.fn(),
  WebhooksApiError: class extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

function makeActorBootstrap() {
  return {
    token: "actor-token",
    expiresAt: "2026-01-01T00:00:00.000Z",
    entitlements: { planType: "agency", planStatus: "active" },
    actorAccountId: "acct-agency",
    subjectAccountId: "acct-agency",
    account: {
      accountId: "acct-agency",
      planType: "agency",
      planStatus: "active",
      featureFlags: {
        editEnabled: true,
        slugEditEnabled: true,
        glossaryEnabled: true,
        overridesEnabled: true,
        tmWriteEnabled: true,
        publishEnabled: true,
        pipelineAllowed: true,
        serveAllowed: true,
        siteCreateEnabled: true,
        localeUpdateEnabled: true,
        domainVerifyEnabled: true,
        crawlTriggerEnabled: true,
        crawlCaptureModeEnabled: true,
        clientRuntimeToggleEnabled: true,
        translatableAttributesEnabled: true,
        renderEnabled: true,
        agencyActionsEnabled: true,
        internalOpsEnabled: true,
        demoMode: false,
        maxSites: 10,
        maxLocales: 10,
        maxDailyRecrawls: 10,
        maxDailyPageRecrawls: 100,
        maxGlossarySources: 20,
        featurePreview: [],
      },
      dailyCrawlUsage: {
        date: "2026-01-01",
        siteCrawls: 0,
        pageCrawls: 0,
      },
      usageCounters: {
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        pagesPublished: 0,
        charsTranslated: 0,
        rebuildsTriggered: 0,
        dailySiteCrawls: 0,
        dailyPageCrawls: 0,
      },
      quotaLimits: {
        maxSites: 10,
        translationChars: 1000,
        dailySiteCrawls: 10,
        dailyPageCrawls: 100,
        previewRequests: null,
      },
      quotas: {
        maxSites: 10,
        freeQuota: 1,
        starterQuota: 10,
        proQuota: 20,
      },
    },
    agencyCustomers: {
      summary: { totalActiveSites: 0, maxSites: 10 },
      customers: [],
    },
  };
}

beforeEach(() => {
  redisMock.del.mockReset();
  redisMock.get.mockReset();
  redisMock.set.mockReset();
  cookiesStore.get.mockReset();
  cookiesStore.delete.mockReset();

  cookiesStore.get.mockReturnValue({ value: "acct-stale" });
  redisMock.get.mockResolvedValue(null);
  redisMock.set.mockResolvedValue("OK");
  redisMock.del.mockResolvedValue(1);
});

describe("getActiveAgencyCustomers", () => {
  it("returns only active agency customers", async () => {
    const { getActiveAgencyCustomers } = await import("./auth");
    const customers = getActiveAgencyCustomers({
      summary: { totalActiveSites: 0, maxSites: null },
      customers: [
        {
          agencyAccountId: "acct-agency",
          customerAccountId: "acct-active",
          customerEmail: "active@example.com",
          customerPlan: "starter",
          planStatus: "active",
          status: "active",
          activeSiteCount: 1,
        },
        {
          agencyAccountId: "acct-agency",
          customerAccountId: "acct-suspended",
          customerEmail: "suspended@example.com",
          customerPlan: "pro",
          planStatus: "active",
          status: "suspended",
          activeSiteCount: 0,
        },
      ],
    });

    expect(customers).toHaveLength(1);
    expect(customers[0]?.customerAccountId).toBe("acct-active");
  });
});

describe("getDashboardAuth", () => {
  it("clears stale workspace cookies and falls back to the actor workspace", async () => {
    const createClient = (await import("@/lib/supabase/server")).createClient as ReturnType<
      typeof vi.fn
    >;
    const fetchDashboardBootstrap = (await import("./webhooks")).fetchDashboardBootstrap as ReturnType<
      typeof vi.fn
    >;
    const exchangeWebhooksToken = (await import("./webhooks")).exchangeWebhooksToken as ReturnType<
      typeof vi.fn
    >;

    const actorBootstrap = makeActorBootstrap();
    actorBootstrap.agencyCustomers = {
      summary: { totalActiveSites: 1, maxSites: 10 },
      customers: [
        {
          agencyAccountId: "acct-agency",
          customerAccountId: "acct-customer",
          customerEmail: "customer@example.com",
          customerPlan: "starter",
          planStatus: "active",
          status: "active",
          activeSiteCount: 1,
        },
      ],
    };

    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: session.user } }),
      },
    });
    fetchDashboardBootstrap.mockResolvedValue(actorBootstrap);
    exchangeWebhooksToken.mockResolvedValue({
      token: "actor-token",
      expiresAt: "2026-01-01T00:00:00.000Z",
      entitlements: { planType: "agency", planStatus: "active" },
      actorAccountId: "acct-agency",
      subjectAccountId: "acct-agency",
    });

    vi.resetModules();
    const { getDashboardAuth } = await import("./auth");
    const auth = await getDashboardAuth();

    expect(auth.subjectFallbackToActor).toBe(true);
    expect(auth.actingAsCustomer).toBe(false);
    expect(auth.subjectAccountId).toBe("acct-agency");
    expect(auth.account?.accountId).toBe("acct-agency");
    expect(cookiesStore.delete).not.toHaveBeenCalled();
    expect(fetchDashboardBootstrap).toHaveBeenCalledTimes(1);
    expect(exchangeWebhooksToken).not.toHaveBeenCalled();
  });

  it("falls back to the actor when an allowed subject bootstrap fails", async () => {
    const createClient = (await import("@/lib/supabase/server")).createClient as ReturnType<
      typeof vi.fn
    >;
    const fetchDashboardBootstrap = (await import("./webhooks")).fetchDashboardBootstrap as ReturnType<
      typeof vi.fn
    >;
    const exchangeWebhooksToken = (await import("./webhooks")).exchangeWebhooksToken as ReturnType<
      typeof vi.fn
    >;

    const actorBootstrap = makeActorBootstrap();
    actorBootstrap.agencyCustomers = {
      summary: { totalActiveSites: 1, maxSites: 10 },
      customers: [
        {
          agencyAccountId: "acct-agency",
          customerAccountId: "acct-customer",
          customerEmail: "customer@example.com",
          customerPlan: "starter",
          planStatus: "active",
          status: "active",
          activeSiteCount: 1,
        },
      ],
    };

    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: session.user } }),
      },
    });
    fetchDashboardBootstrap
      .mockResolvedValueOnce(actorBootstrap)
      .mockRejectedValueOnce(new Error("subject bootstrap unavailable"));
    exchangeWebhooksToken.mockResolvedValue({
      token: "actor-token",
      expiresAt: "2026-01-01T00:00:00.000Z",
      entitlements: { planType: "agency", planStatus: "active" },
      actorAccountId: "acct-agency",
      subjectAccountId: "acct-agency",
    });
    cookiesStore.get.mockReturnValue({ value: "acct-customer" });

    vi.resetModules();
    const { getDashboardAuth } = await import("./auth");
    const auth = await getDashboardAuth();

    expect(auth.subjectFallbackToActor).toBe(true);
    expect(auth.actingAsCustomer).toBe(false);
    expect(auth.subjectAccountId).toBe("acct-agency");
    expect(auth.account?.accountId).toBe("acct-agency");
    expect(cookiesStore.delete).not.toHaveBeenCalled();
    expect(
      fetchDashboardBootstrap.mock.calls.filter(([, options]) => options?.subjectAccountId === "acct-customer"),
    ).toHaveLength(1);
    expect(exchangeWebhooksToken).not.toHaveBeenCalled();
  });
});
