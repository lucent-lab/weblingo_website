import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSiteDashboardProjection: vi.fn(),
  getSiteDashboardCached: vi.fn(),
  getSiteShowcase: vi.fn(),
  listSupportedLanguagesCached: vi.fn(),
  listRuntimeRequestObservations: vi.fn(),
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
  getSiteDashboardCached: mocks.getSiteDashboardCached,
  listSupportedLanguagesCached: mocks.listSupportedLanguagesCached,
}));
vi.mock("@internal/dashboard/webhooks", () => ({
  fetchSiteDashboardProjection: mocks.fetchSiteDashboardProjection,
  getSiteShowcase: mocks.getSiteShowcase,
  listRuntimeRequestObservations: mocks.listRuntimeRequestObservations,
  WebhooksApiError: class WebhooksApiError extends Error {},
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));
vi.mock("../site-header", () => ({
  SiteHeader: () => null,
}));

describe("SettingsPage", () => {
  it("uses the settings projection without loading broad dashboard side data", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: { view: "settings", generatedAt: "2026-05-07T00:00:00.000Z", schemaVersion: 1 },
      site: { ...makeSite(), createdAt: null, updatedAt: null },
      access: {
        mutationsAllowed: true,
        features: {},
        canEditBasic: true,
        canChangeSourceUrl: true,
        canEditLocales: true,
        canEditRouting: true,
        canEditRuntime: true,
        canEditWebhooks: true,
        canDeactivateSite: true,
        canDeleteSite: true,
      },
      basic: { sourceUrl: "https://example.com", profile: null, servingMode: "strict" },
      routing: { urlMode: "subdomain", routePrefixes: [], localizedPathTemplates: [] },
      crawl: { captureMode: "template_plus_hydrated", maxDepth: 2, crawlMaxPages: null },
      runtime: {
        clientRuntimeEnabled: true,
        spaRefreshEnabled: false,
        translatableAttributes: [],
        footerRequired: false,
        cspMode: "strict",
      },
      webhooks: { url: null, events: [], hasSecret: false },
      settings: {
        sourceLang: "en",
        targetLangs: ["fr"],
        aliases: { fr: null },
        pattern: "https://{lang}.example.com",
        maxLocales: null,
        servingMode: "strict",
        crawlCaptureMode: "template_plus_hydrated",
        clientRuntimeEnabled: true,
        spaRefresh: null,
        translatableAttributes: [],
        webhookUrl: null,
        webhookEvents: [],
        siteProfile: {},
      },
    });
    mocks.listSupportedLanguagesCached.mockResolvedValue([]);

    vi.resetModules();
    const { default: SettingsPage } = await import("./page");
    const tree = await SettingsPage({ params: Promise.resolve({ id: "site-1" }) });

    expect(isValidElement(tree)).toBe(true);
    expect(mocks.fetchSiteDashboardProjection).toHaveBeenCalledWith(
      authToken,
      "site-1",
      "settings",
    );
    expect(mocks.getSiteDashboardCached).not.toHaveBeenCalled();
    expect(mocks.getSiteShowcase).not.toHaveBeenCalled();
    expect(mocks.listRuntimeRequestObservations).not.toHaveBeenCalled();
    expect(collectHrefs(tree)).not.toContain("/dashboard/sites/site-1/admin");
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

function collectHrefs(node: unknown): string[] {
  if (node == null || typeof node === "boolean") {
    return [];
  }
  if (Array.isArray(node)) {
    return node.flatMap(collectHrefs);
  }
  if (!isValidElement(node)) {
    return [];
  }
  const props = node.props as { href?: unknown; children?: unknown };
  const own = typeof props.href === "string" ? [props.href] : [];
  return [...own, ...collectHrefs(props.children)];
}
