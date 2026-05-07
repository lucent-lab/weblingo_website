import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  getSiteDashboardCached: vi.fn(),
  fetchDeploymentHistory: vi.fn(),
  listSitesCached: vi.fn(),
  listSupportedLanguagesCached: vi.fn(),
  getSiteShowcase: vi.fn(),
  resolvePreferredLocale: vi.fn(() => "en"),
  resolveLocaleTranslator: vi.fn(async () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  })),
  SiteAdminForm: vi.fn(() => null),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("./internal-admin-policy-card", () => ({
  InternalAdminPolicyCard: () => null,
}));
vi.mock("./site-admin-form", () => ({
  SiteAdminForm: mocks.SiteAdminForm,
}));
vi.mock("./site-showcase-card", () => ({
  SiteShowcaseCard: () => null,
}));
vi.mock("@/components/dashboard/action-form", () => ({
  ActionForm: () => null,
}));
vi.mock("@/components/dashboard/error-state-card", () => ({
  ErrorStateCard: () => null,
}));
vi.mock("@/components/dashboard/deployment-completeness-badge", () => ({
  DeploymentCompletenessBadge: () => null,
}));
vi.mock("@/components/dashboard/deployment-history-table", () => ({
  DeploymentHistoryTable: () => null,
}));
vi.mock("@internal/dashboard/auth", () => ({
  hasActorInternalOps: vi.fn(() => false),
  requireDashboardAuth: mocks.requireDashboardAuth,
}));
vi.mock("@internal/dashboard/data", () => ({
  getSiteDashboardCached: mocks.getSiteDashboardCached,
  listSitesCached: mocks.listSitesCached,
  listSupportedLanguagesCached: mocks.listSupportedLanguagesCached,
}));
vi.mock("@internal/dashboard/error-state", () => ({
  resolveDashboardErrorView: vi.fn((error, fallback) => ({
    ...fallback,
    message: error instanceof Error ? error.message : fallback.message,
  })),
}));
vi.mock("@internal/dashboard/webhooks", () => ({
  fetchDeploymentHistory: mocks.fetchDeploymentHistory,
  getSiteShowcase: mocks.getSiteShowcase,
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));

describe("SiteAdminPage", () => {
  it("prefers backend routeConfig sourceLang over the first locale fallback", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      webhooksAuth: { token: "token", subjectAccountId: "acct-1" },
      mutationsAllowed: false,
      has: vi.fn().mockReturnValue(false),
      account: null,
      subjectAccount: null,
      actorAccount: null,
      actorAccountId: "acct-1",
      subjectAccountId: "acct-1",
      actingAsCustomer: false,
      subjectFallbackToActor: false,
    });
    mocks.getSiteDashboardCached.mockResolvedValue({
      site: {
        id: "site-1",
        accountId: "acct-1",
        sourceUrl: "https://example.com/",
        status: "active",
        servingMode: "strict",
        maxLocales: null,
        siteProfile: {},
        webhookEvents: ["translation.completed", "translation.failed", "translation.summary"],
        routeConfig: {
          sourceLang: "ja",
          sourceOrigin: "https://example.com/",
          locales: [],
          clientRuntimeEnabled: true,
          crawlCaptureMode: "template_plus_hydrated",
        },
        locales: [
          { sourceLang: "en", targetLang: "fr", serveEnabled: true },
          { sourceLang: "ja", targetLang: "fr", serveEnabled: true },
        ],
        domains: [],
      },
      deployments: [],
    });
    mocks.fetchDeploymentHistory.mockResolvedValue({
      history: [],
      perLocaleLimit: 5,
    });
    mocks.listSitesCached.mockResolvedValue([]);
    mocks.listSupportedLanguagesCached.mockResolvedValue([]);

    vi.resetModules();
    const { default: SiteAdminPage } = await import("./page");

    const tree = await SiteAdminPage({
      params: Promise.resolve({ id: "site-1" }),
    });

    function findElement(node: unknown): Record<string, unknown> | null {
      if (!node) return null;
      if (Array.isArray(node)) {
        for (const child of node) {
          const found = findElement(child);
          if (found) return found;
        }
        return null;
      }
      if (!isValidElement(node)) {
        return null;
      }
      if (node.type === mocks.SiteAdminForm) {
        return node.props as Record<string, unknown>;
      }
      const props = node.props as { children?: unknown };
      return findElement(props.children);
    }

    const siteAdminForm = findElement(tree);
    expect(siteAdminForm).toMatchObject({
      siteId: "site-1",
      sourceLang: "ja",
    });
    expect(mocks.fetchDeploymentHistory).not.toHaveBeenCalled();
    expect(mocks.getSiteShowcase).not.toHaveBeenCalled();
  });
});
