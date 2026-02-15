import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardAuth } from "@internal/dashboard/auth";
import type { Site } from "@internal/dashboard/webhooks";

import { GET } from "./route";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { fetchSite } from "@internal/dashboard/webhooks";

vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: vi.fn(),
}));

vi.mock("@internal/dashboard/webhooks", () => {
  class WebhooksApiError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }
  return {
    fetchSite: vi.fn(),
    WebhooksApiError,
  };
});

const mockedRequireDashboardAuth = vi.mocked(requireDashboardAuth);
const mockedFetchSite = vi.mocked(fetchSite);

const makeAuth = (subjectAccountId: string): DashboardAuth => ({
  user: null,
  session: null,
  webhooksAuth: {
    token: "token",
    expiresAt: "2025-01-01T00:00:00Z",
    subjectAccountId,
    refresh: async () => "token",
  },
  account: null,
  actorAccount: null,
  subjectAccount: null,
  actorWebhooksAuth: null,
  agencyCustomers: null,
  actorAccountId: null,
  subjectAccountId,
  actingAsCustomer: false,
  subjectFallbackToActor: false,
  actorPlanActive: true,
  subjectPlanActive: true,
  mutationsAllowed: true,
  billingIssue: null,
  has: () => true,
});

const makeSite = (accountId: string): Site => ({
  id: "site-1",
  accountId,
  sourceUrl: "https://example.com",
  status: "active",
  servingMode: "strict",
  maxLocales: null,
  siteProfile: null,
  locales: [],
  domains: [],
  latestCrawlRun: null,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/dashboard/sites/[siteId]/status", () => {
  it("returns 403 when site account does not match", async () => {
    mockedRequireDashboardAuth.mockResolvedValue(makeAuth("acct-owner"));
    mockedFetchSite.mockResolvedValue(makeSite("acct-other"));

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it("returns site when account matches", async () => {
    mockedRequireDashboardAuth.mockResolvedValue(makeAuth("acct-owner"));
    mockedFetchSite.mockResolvedValue(makeSite("acct-owner"));

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.site.accountId).toBe("acct-owner");
    expect(body).not.toHaveProperty("deployments");
  });
});
