import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSiteDashboardProjection: vi.fn(),
  fetchCustomerDeploymentHistory: vi.fn(),
  fetchCustomerTranslationRuns: vi.fn(),
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
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: mocks.requireDashboardAuth,
}));
vi.mock("@internal/dashboard/webhooks", () => ({
  fetchSiteDashboardProjection: mocks.fetchSiteDashboardProjection,
  fetchCustomerDeploymentHistory: mocks.fetchCustomerDeploymentHistory,
  fetchCustomerTranslationRuns: mocks.fetchCustomerTranslationRuns,
  fetchDeploymentHistory: mocks.fetchDeploymentHistory,
  WebhooksApiError: class WebhooksApiError extends Error {},
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));
vi.mock("../site-header", () => ({
  SiteHeader: () => null,
}));

describe("HistoryPage", () => {
  it("loads one locale of customer-safe runs and deployment history on demand", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: { view: "languages", generatedAt: "2026-05-07T00:00:00.000Z", schemaVersion: 1 },
      site: makeSite(),
      access: {
        mutationsAllowed: true,
        features: {},
        canAddLanguage: true,
        canRemoveLanguage: true,
        canUpdateLanguageAliases: true,
        canToggleServing: true,
      },
      sourceLanguage: { tag: "en" },
      targetLanguages: [
        {
          tag: "fr",
          enabled: true,
          serveEnabled: true,
          servingStatus: { value: "live", rawStatus: "serving", titleKey: "live" },
          canRemove: true,
        },
        {
          tag: "ja",
          enabled: true,
          serveEnabled: true,
          servingStatus: { value: "needs_domain", rawStatus: "needs_domain", titleKey: "needs" },
          canRemove: true,
        },
      ],
      localeQuota: { used: 2, limit: 5, remaining: 3 },
    });
    mocks.fetchCustomerTranslationRuns.mockResolvedValue({
      runs: [],
      pagination: { limit: 10, offset: 0, nextOffset: null },
      generatedAt: "2026-05-07T00:00:00.000Z",
    });
    mocks.fetchCustomerDeploymentHistory.mockResolvedValue({
      targetLang: "fr",
      entries: [],
      pagination: { limit: 10, offset: 0, nextOffset: null },
      generatedAt: "2026-05-07T00:00:00.000Z",
    });

    vi.resetModules();
    const { default: HistoryPage } = await import("./page");
    const tree = await HistoryPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({ targetLang: "fr" }),
    });

    expect(isValidElement(tree)).toBe(true);
    expect(mocks.fetchSiteDashboardProjection).toHaveBeenCalledWith(
      authToken,
      "site-1",
      "languages",
    );
    expect(mocks.fetchCustomerTranslationRuns).toHaveBeenCalledWith(authToken, "site-1", {
      targetLang: "fr",
      limit: 10,
      offset: 0,
    });
    expect(mocks.fetchCustomerDeploymentHistory).toHaveBeenCalledWith(authToken, "site-1", {
      targetLang: "fr",
      limit: 10,
      offset: 0,
    });
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
