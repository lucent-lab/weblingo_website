import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSiteDashboardProjection: vi.fn(),
  getSiteDashboardCached: vi.fn(),
  fetchDeploymentHistory: vi.fn(),
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
vi.mock("@/components/dashboard/action-form", () => ({
  ActionForm: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: mocks.requireDashboardAuth,
}));
vi.mock("@internal/dashboard/data", () => ({
  getSiteDashboardCached: mocks.getSiteDashboardCached,
}));
vi.mock("@internal/dashboard/webhooks", () => ({
  fetchSiteDashboardProjection: mocks.fetchSiteDashboardProjection,
  fetchDeploymentHistory: mocks.fetchDeploymentHistory,
  WebhooksApiError: class WebhooksApiError extends Error {},
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));
vi.mock("../../../actions", () => ({
  provisionDomainAction: vi.fn(),
  refreshDomainAction: vi.fn(),
  setLocaleServingAction: vi.fn(),
  translateAndServeAction: vi.fn(),
  verifyDomainAction: vi.fn(),
}));
vi.mock("../site-header", () => ({
  SiteHeader: () => null,
}));

describe("DomainsPage", () => {
  it("uses the domains dashboard projection without legacy dashboard or history fetches", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: { view: "domains", generatedAt: "2026-05-07T00:00:00.000Z", schemaVersion: 1 },
      site: makeSite(),
      access: {
        mutationsAllowed: true,
        features: {},
        canVerifyDomain: true,
        canRefreshDomain: true,
        canProvisionDomain: true,
        canUpdateRouting: true,
        canToggleServing: true,
      },
      routing: {
        urlMode: "subdomain",
        servingMode: "strict",
        routePrefixes: [{ targetLang: "fr", prefix: "/fr" }],
      },
      languages: [
        {
          tag: "fr",
          labelKey: "languages.fr",
          enabled: true,
          serveEnabled: true,
          servingStatus: {
            value: "ready",
            rawStatus: "ready",
            titleKey: "dashboard.status.serving.ready.title",
          },
          domain: "fr.example.com",
          domainStatus: "pending",
          routePrefix: "/fr",
          alias: null,
          lastPublishedAt: null,
          lastTranslatedAt: null,
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
            rawStatus: "needs_domain",
            titleKey: "dashboard.status.serving.needs_domain.title",
          },
        },
      ],
    });

    vi.resetModules();
    const { default: DomainsPage } = await import("./page");
    const tree = await DomainsPage({ params: Promise.resolve({ id: "site-1" }) });

    expect(isValidElement(tree)).toBe(true);
    expect(mocks.fetchSiteDashboardProjection).toHaveBeenCalledWith(authToken, "site-1", "domains");
    expect(mocks.getSiteDashboardCached).not.toHaveBeenCalled();
    expect(mocks.fetchDeploymentHistory).not.toHaveBeenCalled();
  });
});

function makeAuth(authToken: { token: string; subjectAccountId: string }) {
  return {
    webhooksAuth: authToken,
    mutationsAllowed: true,
    has: vi.fn().mockReturnValue(true),
    actorAccountId: "acct-1",
    subjectAccountId: "acct-1",
    actingAsCustomer: false,
    subjectFallbackToActor: false,
  };
}

function makeSite() {
  return {
    id: "site-1",
    sourceUrl: "https://example.com",
    sourceLang: "en",
    status: "active",
  };
}
