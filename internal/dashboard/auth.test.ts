import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/internal/core/redis", () => ({
  redis: {
    del: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("./webhooks", () => ({
  exchangeWebhooksToken: vi.fn(),
  fetchDashboardBootstrap: vi.fn(),
  WebhooksApiError: class extends Error {},
}));

let getActiveAgencyCustomers: typeof import("./auth").getActiveAgencyCustomers;

beforeAll(async () => {
  ({ getActiveAgencyCustomers } = await import("./auth"));
});

describe("getActiveAgencyCustomers", () => {
  it("returns only active agency customers", () => {
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
