import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountMe, AgencyCustomersResponse, DashboardBootstrapResponse } from "./webhooks";

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
  fetchAccountMe: vi.fn(),
  fetchDashboardBootstrap: vi.fn(),
  WebhooksApiError: class extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

function makeActorBootstrap(): DashboardBootstrapResponse {
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

function makeDemoAccount(): AccountMe {
  const base = makeActorBootstrap().account;
  return {
    ...base,
    accountId: "acct-demo",
    planType: "starter",
    featureFlags: {
      ...base.featureFlags,
      siteCreateEnabled: false,
      agencyActionsEnabled: false,
      internalOpsEnabled: false,
      demoMode: true,
      maxSites: 1,
    },
    quotaLimits: {
      ...base.quotaLimits,
      maxSites: 1,
    },
    quotas: {
      ...base.quotas,
      maxSites: 1,
    },
  };
}

function makeStoredDemoSession(options?: { expiresAt?: string }) {
  return {
    token: "dashboard-demo-token",
    expiresAt: options?.expiresAt ?? "2030-01-01T00:00:00.000Z",
    entitlements: { planType: "starter", planStatus: "active" },
    actorAccountId: "acct-demo",
    subjectAccountId: "acct-demo",
    prospectShowcaseId: "ps-id",
    prospectShowcaseRef: "ps-demo-ref",
    siteId: "site-demo",
    demo: true,
    conversionToken: "conversion-token",
    createdAt: "2026-06-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  redisMock.del.mockReset();
  redisMock.get.mockReset();
  redisMock.set.mockReset();
  cookiesStore.get.mockReset();
  cookiesStore.delete.mockReset();

  cookiesStore.get.mockReturnValue(undefined);
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
  it("builds demo scoped dashboard auth without a Supabase session", async () => {
    const createClient = (await import("@/lib/supabase/server")).createClient as ReturnType<
      typeof vi.fn
    >;
    const webhooks = await import("./webhooks");
    const fetchAccountMe = webhooks.fetchAccountMe as ReturnType<typeof vi.fn>;
    const fetchDashboardBootstrap = webhooks.fetchDashboardBootstrap as ReturnType<typeof vi.fn>;

    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    cookiesStore.get.mockImplementation((name: string) =>
      name === "weblingo_dashboard_demo" ? { value: "opaque-demo-session" } : undefined,
    );
    redisMock.get.mockResolvedValue(makeStoredDemoSession());
    fetchAccountMe.mockResolvedValue(makeDemoAccount());

    vi.resetModules();
    const { getDashboardAuth } = await import("./auth");
    const auth = await getDashboardAuth();

    expect(auth.accessMode).toBe("demo");
    expect(auth.user?.id).toBe("prospect-demo:ps-demo-ref");
    expect(auth.session?.access_token).toBe("prospect-demo:ps-demo-ref");
    expect(auth.webhooksAuth?.token).toBe("dashboard-demo-token");
    expect(auth.subjectAccountId).toBe("acct-demo");
    expect(auth.actorAccountId).toBe("acct-demo");
    expect(auth.agencyCustomers).toBeNull();
    expect(auth.mutationsAllowed).toBe(false);
    expect(auth.account?.featureFlags.siteCreateEnabled).toBe(false);
    expect(fetchAccountMe).toHaveBeenCalledWith({ token: "dashboard-demo-token" });
    expect(fetchDashboardBootstrap).not.toHaveBeenCalled();
  });

  it("prefers demo scoped auth over an existing Supabase session after claim", async () => {
    const createClient = (await import("@/lib/supabase/server")).createClient as ReturnType<
      typeof vi.fn
    >;
    const webhooks = await import("./webhooks");
    const fetchAccountMe = webhooks.fetchAccountMe as ReturnType<typeof vi.fn>;
    const fetchDashboardBootstrap = webhooks.fetchDashboardBootstrap as ReturnType<typeof vi.fn>;
    const actorBootstrap = makeActorBootstrap();

    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: session.user } }),
      },
    });
    cookiesStore.get.mockImplementation((name: string) =>
      name === "weblingo_dashboard_demo" ? { value: "opaque-demo-session" } : undefined,
    );
    redisMock.get.mockResolvedValue(makeStoredDemoSession());
    fetchAccountMe.mockResolvedValue(makeDemoAccount());
    fetchDashboardBootstrap.mockResolvedValue(actorBootstrap);

    vi.resetModules();
    const { getDashboardAuth } = await import("./auth");
    const auth = await getDashboardAuth();

    expect(auth.accessMode).toBe("demo");
    expect(auth.webhooksAuth?.token).toBe("dashboard-demo-token");
    expect(auth.subjectAccountId).toBe("acct-demo");
    expect(fetchAccountMe).toHaveBeenCalledWith({ token: "dashboard-demo-token" });
    expect(fetchDashboardBootstrap).not.toHaveBeenCalled();
  });

  it("uses the Supabase session when a demo cookie does not resolve to valid demo auth", async () => {
    const createClient = (await import("@/lib/supabase/server")).createClient as ReturnType<
      typeof vi.fn
    >;
    const webhooks = await import("./webhooks");
    const fetchAccountMe = webhooks.fetchAccountMe as ReturnType<typeof vi.fn>;
    const fetchDashboardBootstrap = webhooks.fetchDashboardBootstrap as ReturnType<typeof vi.fn>;
    const actorBootstrap = makeActorBootstrap();

    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: session.user } }),
      },
    });
    cookiesStore.get.mockImplementation((name: string) =>
      name === "weblingo_dashboard_demo" ? { value: "opaque-demo-session" } : undefined,
    );
    redisMock.get.mockResolvedValue(null);
    fetchDashboardBootstrap.mockResolvedValue(actorBootstrap);

    vi.resetModules();
    const { getDashboardAuth } = await import("./auth");
    const auth = await getDashboardAuth();

    expect(auth.accessMode).toBe("supabase");
    expect(auth.webhooksAuth?.token).toBe("actor-token");
    expect(auth.subjectAccountId).toBe("acct-agency");
    expect(fetchAccountMe).not.toHaveBeenCalled();
    expect(fetchDashboardBootstrap).toHaveBeenCalledWith("session-token", {
      includeAgencyCustomers: true,
    });
  });

  it("does not create demo dashboard auth from an expired stored session", async () => {
    const createClient = (await import("@/lib/supabase/server")).createClient as ReturnType<
      typeof vi.fn
    >;
    const webhooks = await import("./webhooks");
    const fetchAccountMe = webhooks.fetchAccountMe as ReturnType<typeof vi.fn>;

    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    cookiesStore.get.mockReturnValue({ value: "opaque-demo-session" });
    redisMock.get.mockResolvedValue(
      makeStoredDemoSession({ expiresAt: "2026-01-01T00:00:00.000Z" }),
    );

    vi.resetModules();
    const { getDashboardAuth } = await import("./auth");
    const auth = await getDashboardAuth();

    expect(auth.accessMode).toBe("anonymous");
    expect(auth.user).toBeNull();
    expect(auth.webhooksAuth).toBeNull();
    expect(fetchAccountMe).not.toHaveBeenCalled();
  });

  it("uses the actor workspace when no subject workspace is requested", async () => {
    const createClient = (await import("@/lib/supabase/server")).createClient as ReturnType<
      typeof vi.fn
    >;
    const fetchDashboardBootstrap = (await import("./webhooks"))
      .fetchDashboardBootstrap as ReturnType<typeof vi.fn>;

    const actorBootstrap = makeActorBootstrap();
    const agencyCustomers: AgencyCustomersResponse = {
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
    actorBootstrap.agencyCustomers = agencyCustomers;

    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: session.user } }),
      },
    });
    fetchDashboardBootstrap.mockResolvedValue(actorBootstrap);

    vi.resetModules();
    const { getDashboardAuth } = await import("./auth");
    const auth = await getDashboardAuth();
    expect(auth.actingAsCustomer).toBe(false);
    expect(auth.subjectAccountId).toBe("acct-agency");
    expect(auth.account?.accountId).toBe("acct-agency");
    expect(cookiesStore.delete).not.toHaveBeenCalled();
    expect(fetchDashboardBootstrap).toHaveBeenCalledTimes(1);
  });

  it("threads stripe billing runtime from dashboard metadata", async () => {
    const createClient = (await import("@/lib/supabase/server")).createClient as ReturnType<
      typeof vi.fn
    >;
    const fetchDashboardBootstrap = (await import("./webhooks"))
      .fetchDashboardBootstrap as ReturnType<typeof vi.fn>;

    const actorBootstrap = makeActorBootstrap();
    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              ...session.user,
              user_metadata: {
                stripeCustomerId: "cus_123",
                lastStripeSubscriptionId: "sub_123",
                stripeSubscriptionStatus: "past_due",
                stripeSubscriptionPriceId: "price_123",
                stripeSubscriptionCurrentPeriodEnd: "2026-04-10T00:00:00.000Z",
                stripeSubscriptionCancelAtPeriodEnd: true,
              },
            },
          },
        }),
      },
    });
    fetchDashboardBootstrap.mockResolvedValue(actorBootstrap);

    vi.resetModules();
    const { getDashboardAuth } = await import("./auth");
    const auth = await getDashboardAuth();

    expect(auth.stripeBillingRuntime).toEqual({
      customerId: "cus_123",
      subscriptionId: "sub_123",
      status: "past_due",
      priceId: "price_123",
      currentPeriodEnd: "2026-04-10T00:00:00.000Z",
      cancelAtPeriodEnd: true,
    });
  });

  it("fails fast when an allowed subject bootstrap fails", async () => {
    const createClient = (await import("@/lib/supabase/server")).createClient as ReturnType<
      typeof vi.fn
    >;
    const fetchDashboardBootstrap = (await import("./webhooks"))
      .fetchDashboardBootstrap as ReturnType<typeof vi.fn>;

    const actorBootstrap = makeActorBootstrap();
    const agencyCustomers: AgencyCustomersResponse = {
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
    actorBootstrap.agencyCustomers = agencyCustomers;

    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: session.user } }),
      },
    });
    fetchDashboardBootstrap
      .mockResolvedValueOnce(actorBootstrap)
      .mockRejectedValueOnce(new Error("subject bootstrap unavailable"));
    cookiesStore.get.mockReturnValue({ value: "acct-customer" });

    vi.resetModules();
    const { getDashboardAuth } = await import("./auth");
    await expect(getDashboardAuth()).rejects.toThrow("subject bootstrap unavailable");
    expect(cookiesStore.delete).not.toHaveBeenCalled();
    expect(
      fetchDashboardBootstrap.mock.calls.filter(
        ([, options]) => options?.subjectAccountId === "acct-customer",
      ),
    ).toHaveLength(1);
  });

  it("fails fast when the requested subject is not available to the actor", async () => {
    const createClient = (await import("@/lib/supabase/server")).createClient as ReturnType<
      typeof vi.fn
    >;
    const fetchDashboardBootstrap = (await import("./webhooks"))
      .fetchDashboardBootstrap as ReturnType<typeof vi.fn>;

    createClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: session.user } }),
      },
    });
    fetchDashboardBootstrap.mockResolvedValue(makeActorBootstrap());
    cookiesStore.get.mockReturnValue({ value: "acct-not-allowed" });

    vi.resetModules();
    const { getDashboardAuth } = await import("./auth");
    await expect(getDashboardAuth()).rejects.toThrow(
      "Requested dashboard workspace is not available for this account.",
    );
  });
});
