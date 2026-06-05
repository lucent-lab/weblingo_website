// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SiteCustomerOverviewResponse } from "@internal/dashboard/webhooks";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  getSiteCustomerOverviewCached: vi.fn(),
  resolvePreferredLocale: vi.fn(() => "en"),
  resolveLocaleTranslator: vi.fn(async () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: mocks.requireDashboardAuth,
}));
vi.mock("@internal/dashboard/data", () => ({
  getSiteCustomerOverviewCached: mocks.getSiteCustomerOverviewCached,
}));
vi.mock("@internal/dashboard/error-state", () => ({
  resolveDashboardErrorView: vi.fn((error, fallback) => ({
    ...fallback,
    message: error instanceof Error ? error.message : fallback.message,
  })),
}));
vi.mock("@internal/dashboard/webhooks", () => ({
  WebhooksApiError: class WebhooksApiError extends Error {
    status = 500;
    details = null;
  },
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));
vi.mock("./prospect-demo-conversion-card", () => ({
  ProspectDemoConversionCard: ({ siteId }: { siteId: string }) => (
    <div data-testid="prospect-demo-card">Activate {siteId}</div>
  ),
}));

function makeOverview(): SiteCustomerOverviewResponse {
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
      status: "needs_setup",
      titleKey: "dashboard.health.needsSetup.title",
      descriptionKey: "dashboard.health.needsSetup.description",
      lastImportantChangeAt: null,
    },
    nextAction: {
      kind: "verify_domain",
      priority: 20,
      severity: "warning",
      titleKey: "dashboard.nextAction.verifyDomain.title",
      descriptionKey: "dashboard.nextAction.verifyDomain.description",
      cta: {
        labelKey: "dashboard.cta.verifyDomain",
        actionId: "verify_domain",
        method: "server_action",
        params: { domain: "fr.example.com" },
      },
      blockedBy: ["domain_not_verified"],
    },
    blockers: [
      {
        code: "domain_not_verified",
        area: "domain",
        severity: "warning",
        titleKey: "dashboard.blockers.domainNotVerified.title",
        affectedDomains: ["fr.example.com"],
      },
    ],
    languages: [
      {
        tag: "fr",
        labelKey: "languages.fr",
        enabled: true,
        serveEnabled: true,
        indexing: {
          mode: "noindex",
          effectiveMode: "noindex",
          optedIn: false,
          canIndex: false,
          blockers: ["indexing_not_opted_in", "domain_unverified"],
        },
        servingStatus: {
          value: "needs_domain",
          rawStatus: "pending",
          titleKey: "dashboard.status.serving.needs_domain.title",
        },
        domain: "fr.example.com",
        domainStatus: "pending",
        routePrefix: "/fr",
        alias: null,
        lastPublishedAt: null,
        lastTranslatedAt: null,
        canServe: false,
        lockedReasonCode: null,
      },
    ],
    domains: [
      {
        domain: "fr.example.com",
        targetLang: "fr",
        status: "pending",
        rawStatus: "pending",
        lastCheckedAt: null,
        servingStatus: {
          value: "needs_domain",
          rawStatus: "pending",
          titleKey: "dashboard.status.serving.needs_domain.title",
        },
      },
    ],
    pagesSummary: {
      totalKnownPages: 12,
      includedPages: 12,
      excludedPages: 0,
      translatedPages: 8,
      pendingPages: 4,
      failedPages: 0,
      nextEligibleCrawlAt: null,
      eligiblePageCount: 3,
      inventoryMayBeIncomplete: false,
      rawLatestCrawlStatus: "completed",
      customerCrawlStatus: "completed",
    },
    currentActivity: [],
    errors: [],
    quotas: [
      {
        key: "locales",
        labelKey: "dashboard.quotas.locales",
        used: 1,
        limit: 3,
        remaining: 2,
        status: "ok",
      },
    ],
  };
}

describe("SitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("loads the customer overview projection without the legacy broad dashboard request", async () => {
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
      account: null,
      subjectAccount: null,
      actorAccount: null,
      actorAccountId: "acct-1",
      subjectAccountId: "acct-1",
      actingAsCustomer: false,
    });
    mocks.getSiteCustomerOverviewCached.mockResolvedValue(makeOverview());

    vi.resetModules();
    const { default: SitePage } = await import("./page");

    const tree = await SitePage({
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(isValidElement(tree)).toBe(true);
    render(tree);
    expect(screen.getByRole("link", { name: /verify domain/i }).getAttribute("href")).toBe(
      "/dashboard/sites/site-1/domains#domain-fr-example-com",
    );
    expect(mocks.getSiteCustomerOverviewCached).toHaveBeenCalledWith(webhooksAuth, "site-1");
  });

  it("renders demo scoped auth on the real site page", async () => {
    const webhooksAuth = {
      token: "demo-token",
      subjectAccountId: "acct-demo",
      expiresAt: "2030-01-01T00:00:00.000Z",
      refresh: async () => "demo-token",
    };
    mocks.requireDashboardAuth.mockResolvedValue({
      accessMode: "demo",
      demoSession: { siteId: "site-1" },
      webhooksAuth,
      mutationsAllowed: false,
      has: vi.fn().mockReturnValue(false),
      account: { accountId: "acct-demo" },
      subjectAccount: { accountId: "acct-demo" },
      actorAccount: { accountId: "acct-demo" },
      actorAccountId: "acct-demo",
      subjectAccountId: "acct-demo",
      actingAsCustomer: false,
    });
    mocks.getSiteCustomerOverviewCached.mockResolvedValue(makeOverview());

    vi.resetModules();
    const { default: SitePage } = await import("./page");

    const tree = await SitePage({
      params: Promise.resolve({ id: "site-1" }),
    });
    render(tree);

    expect(screen.getByTestId("prospect-demo-card").textContent).toContain("site-1");
    expect(screen.getByText("Scoped demo access")).toBeTruthy();
    expect(mocks.getSiteCustomerOverviewCached).toHaveBeenCalledWith(webhooksAuth, "site-1");
  });

  it("404s demo scoped auth before fetching a different site", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      accessMode: "demo",
      demoSession: { siteId: "site-claimed" },
      webhooksAuth: {
        token: "demo-token",
        subjectAccountId: "acct-demo",
        expiresAt: "2030-01-01T00:00:00.000Z",
        refresh: async () => "demo-token",
      },
      mutationsAllowed: false,
      has: vi.fn().mockReturnValue(false),
      account: { accountId: "acct-demo" },
      subjectAccount: { accountId: "acct-demo" },
      actorAccount: { accountId: "acct-demo" },
      actorAccountId: "acct-demo",
      subjectAccountId: "acct-demo",
      actingAsCustomer: false,
    });

    vi.resetModules();
    const { default: SitePage } = await import("./page");

    await expect(
      SitePage({
        params: Promise.resolve({ id: "site-other" }),
      }),
    ).rejects.toThrow("notFound");
    expect(mocks.getSiteCustomerOverviewCached).not.toHaveBeenCalled();
  });

  it("renders repeated blocker codes without duplicate React keys", async () => {
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
      account: null,
      subjectAccount: null,
      actorAccount: null,
      actorAccountId: "acct-1",
      subjectAccountId: "acct-1",
      actingAsCustomer: false,
    });
    const overview = makeOverview();
    overview.blockers = [
      {
        code: "domain_not_verified",
        area: "domain",
        severity: "warning",
        titleKey: "dashboard.blockers.domainNotVerified.title",
        affectedDomains: ["fr.example.com"],
      },
      {
        code: "domain_not_verified",
        area: "domain",
        severity: "warning",
        titleKey: "dashboard.blockers.domainNotVerified.title",
        affectedDomains: ["de.example.com"],
      },
    ];
    mocks.getSiteCustomerOverviewCached.mockResolvedValue(overview);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      vi.resetModules();
      const { default: SitePage } = await import("./page");

      const tree = await SitePage({
        params: Promise.resolve({ id: "site-1" }),
      });
      render(tree);

      expect(screen.getAllByText("Domain not verified")).toHaveLength(2);
      const duplicateKeyErrors = consoleError.mock.calls.filter((call) =>
        call.map(String).join(" ").includes("Encountered two children with the same key"),
      );
      expect(duplicateKeyErrors).toHaveLength(0);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("does not route unknown next-action CTAs to a legacy fallback surface", async () => {
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
      account: null,
      subjectAccount: null,
      actorAccount: null,
      actorAccountId: "acct-1",
      subjectAccountId: "acct-1",
      actingAsCustomer: false,
    });
    const overview = makeOverview();
    overview.nextAction.cta = {
      labelKey: "dashboard.cta.reviewUnknown",
      actionId: "unknown_backend_action",
      method: "link",
    } as never;
    mocks.getSiteCustomerOverviewCached.mockResolvedValue(overview);

    vi.resetModules();
    const { default: SitePage } = await import("./page");

    const tree = await SitePage({
      params: Promise.resolve({ id: "site-1" }),
    });

    render(tree);
    expect(screen.queryByRole("link", { name: /unknown backend action/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /review unknown/i })).toBeNull();
  });
});
