import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardAuth } from "@internal/dashboard/auth";
import type { SiteCompactStatusResponse } from "@internal/dashboard/webhooks";

import { GET } from "./route";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { fetchSiteCompactStatus } from "@internal/dashboard/webhooks";

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
    fetchSiteCompactStatus: vi.fn(),
    WebhooksApiError,
  };
});

const mockedRequireDashboardAuth = vi.mocked(requireDashboardAuth);
const mockedFetchSiteCompactStatus = vi.mocked(fetchSiteCompactStatus);

const makeAuth = (subjectAccountId: string): DashboardAuth => ({
  accessMode: "supabase",
  user: null,
  session: null,
  demoSession: null,
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
  actorPlanActive: true,
  subjectPlanActive: true,
  mutationsAllowed: true,
  billingIssue: null,
  stripeBillingRuntime: null,
  has: () => true,
});

const makeStatus = (): SiteCompactStatusResponse => ({
  siteId: "site-1",
  siteStatus: "active",
  latestCrawlRun: null,
  activeTranslationRuns: [],
  currentActivity: [],
  generatedAt: "2026-05-07T00:00:00.000Z",
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/dashboard/sites/[siteId]/status", () => {
  it("returns compact status without fetching full site details", async () => {
    mockedRequireDashboardAuth.mockResolvedValue(makeAuth("acct-owner"));
    mockedFetchSiteCompactStatus.mockResolvedValue(makeStatus());

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      siteId: "site-1",
      siteStatus: "active",
      generatedAt: "2026-05-07T00:00:00.000Z",
    });
    expect(body).not.toHaveProperty("site");
    expect(body).not.toHaveProperty("deployments");
    expect(mockedFetchSiteCompactStatus).toHaveBeenCalledWith(
      expect.objectContaining({ token: "token", subjectAccountId: "acct-owner" }),
      "site-1",
    );
  });

  it("returns 404 when backend status endpoint cannot find the site", async () => {
    mockedRequireDashboardAuth.mockResolvedValue(makeAuth("acct-owner"));
    const { WebhooksApiError } = await import("@internal/dashboard/webhooks");
    mockedFetchSiteCompactStatus.mockRejectedValue(new WebhooksApiError("Site not found", 404));

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-1" }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 404 for demo auth outside the claimed site before backend fetch", async () => {
    mockedRequireDashboardAuth.mockResolvedValue({
      ...makeAuth("acct-demo"),
      accessMode: "demo",
      demoSession: { siteId: "site-claimed" } as DashboardAuth["demoSession"],
      mutationsAllowed: false,
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ siteId: "site-other" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(mockedFetchSiteCompactStatus).not.toHaveBeenCalled();
  });
});
