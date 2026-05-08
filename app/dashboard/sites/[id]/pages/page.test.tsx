import { isValidElement } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSitePages: vi.fn(),
  resolvePreferredLocale: vi.fn(() => "en"),
  resolveLocaleTranslator: vi.fn(async () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  })),
  CrawlSummaryClient: vi.fn(() => null),
  SiteHeader: vi.fn(() => null),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("@/components/dashboard/action-form", () => ({
  ActionForm: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: mocks.requireDashboardAuth,
}));
vi.mock("@internal/dashboard/data", () => ({}));
vi.mock("@internal/dashboard/error-state", () => ({
  resolveDashboardErrorView: vi.fn((error, fallback) => ({
    ...fallback,
    message: error instanceof Error ? error.message : fallback.message,
  })),
}));
vi.mock("@internal/dashboard/webhooks", () => ({
  fetchSitePages: mocks.fetchSitePages,
  WebhooksApiError: class WebhooksApiError extends Error {
    status = 500;
    details = null;
  },
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));
vi.mock("../site-header", () => ({
  SiteHeader: mocks.SiteHeader,
}));
vi.mock("./crawl-summary.client", () => ({
  CrawlSummaryClient: mocks.CrawlSummaryClient,
}));
vi.mock("../../../actions", () => ({
  triggerCrawlAction: vi.fn(),
  triggerPageCrawlAction: vi.fn(),
}));

function makeCompactStatus() {
  return {
    siteId: "site-1",
    siteStatus: "active",
    latestCrawlRun: {
      id: "crawl-1",
      rawStatus: "completed",
      customerStatus: "completed",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:01:00.000Z",
      updatedAt: "2026-01-01T00:01:00.000Z",
      pagesUpdated: 1,
      pagesPending: 0,
      customerError: null,
    },
    activeTranslationRuns: [],
    currentActivity: [],
    generatedAt: "2026-01-01T00:01:00.000Z",
  };
}

describe("SitePagesPage", () => {
  it("uses one direct pages response instead of legacy dashboard or extra status payloads", async () => {
    const webhooksAuth = {
      token: "token",
      subjectAccountId: "acct-1",
      expiresAt: "2026-01-01T00:00:00.000Z",
      refresh: async () => "token",
    };
    mocks.requireDashboardAuth.mockResolvedValue({
      webhooksAuth,
      mutationsAllowed: true,
      has: vi.fn().mockReturnValue(true),
      account: {
        dailyCrawlUsage: { pageCrawls: 0, siteCrawls: 0 },
        featureFlags: { maxDailyPageRecrawls: null, maxDailyRecrawls: null },
      },
      subjectAccount: null,
      actorAccount: null,
      actorAccountId: "acct-1",
      subjectAccountId: "acct-1",
      actingAsCustomer: false,
    });
    mocks.fetchSitePages.mockResolvedValue({
      site: {
        id: "site-1",
        sourceUrl: "https://example.com",
        status: "active",
      },
      status: makeCompactStatus(),
      pagesSummary: {
        lastCrawlStartedAt: "2026-01-01T00:00:00.000Z",
        lastCrawlFinishedAt: "2026-01-01T00:01:00.000Z",
        pagesUpdated: 1,
        pagesPending: 0,
        nextEligibleCrawlAt: null,
        eligiblePageCount: null,
        rawLatestCrawlStatus: "completed",
        customerCrawlStatus: "completed",
      },
      pages: [
        {
          id: "page-1",
          sourcePath: "/",
          lastCrawledAt: null,
          lastSnapshotAt: null,
          nextCrawlAt: null,
        },
      ],
      pagination: {
        limit: 25,
        offset: 0,
        total: 1,
        hasMore: false,
      },
    });

    vi.resetModules();
    const { default: SitePagesPage } = await import("./page");

    const tree = await SitePagesPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({ page: "1" }),
    });

    expect(isValidElement(tree)).toBe(true);
    expect(mocks.fetchSitePages).toHaveBeenCalledWith(webhooksAuth, "site-1", {
      limit: 25,
      offset: 0,
    });
  });
});
