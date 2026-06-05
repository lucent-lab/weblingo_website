import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSiteDashboardProjection: vi.fn(),
  fetchSwitcherSnippets: vi.fn(),
  listRuntimeRequestObservations: vi.fn(),
  normalizeLocale: vi.fn((locale: string) => locale),
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
vi.mock("@internal/dashboard/webhooks", () => ({
  fetchSiteDashboardProjection: mocks.fetchSiteDashboardProjection,
  fetchSwitcherSnippets: mocks.fetchSwitcherSnippets,
  listRuntimeRequestObservations: mocks.listRuntimeRequestObservations,
  WebhooksApiError: class WebhooksApiError extends Error {},
}));
vi.mock("@internal/i18n", () => ({
  normalizeLocale: mocks.normalizeLocale,
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));
vi.mock("../../../actions", () => ({
  fetchSwitcherSnippetsAction: vi.fn(),
}));
vi.mock("../site-header", () => ({
  SiteHeader: () => null,
}));

describe("DeveloperToolsPage", () => {
  it("uses the developer_tools projection without eager snippets or observations", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: {
        view: "developer_tools",
        generatedAt: "2026-05-07T00:00:00.000Z",
        schemaVersion: 1,
      },
      site: makeSite(),
      access: {
        mutationsAllowed: true,
        features: {},
        canEditRuntime: true,
        canEditWebhooks: true,
        canViewRuntimeRequests: true,
      },
      runtime: {
        clientRuntimeEnabled: true,
        switcherEnabled: true,
        spaRefreshEnabled: false,
        translatableAttributes: [],
      },
      webhooks: { url: null, events: [], hasSecret: false },
      snippets: { available: true, fetchHref: "/api/sites/site-1/switcher-snippets" },
      runtimeRequests: {
        available: true,
        policy: { schemaVersion: 1, mode: "standard", enabled: true, rules: [] },
        policySummary: {
          rulesCount: 0,
          fingerprint: "fingerprint",
          version: "site-config:2026-05-07T00:00:00.000Z",
          lastUpdatedAt: "2026-05-07T00:00:00.000Z",
        },
      },
    });

    vi.resetModules();
    const { default: DeveloperToolsPage } = await import("./page");
    const tree = await DeveloperToolsPage({ params: Promise.resolve({ id: "site-1" }) });

    expect(isValidElement(tree)).toBe(true);
    expect(mocks.fetchSiteDashboardProjection).toHaveBeenCalledWith(
      authToken,
      "site-1",
      "developer_tools",
    );
    expect(mocks.fetchSwitcherSnippets).not.toHaveBeenCalled();
    expect(mocks.listRuntimeRequestObservations).not.toHaveBeenCalled();
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
