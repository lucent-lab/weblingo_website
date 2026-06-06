// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSiteDashboardProjection: vi.fn(),
  getSiteShowcase: vi.fn(),
  listSupportedLanguagesCached: vi.fn(),
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
vi.mock("@internal/dashboard/data", () => ({
  listSupportedLanguagesCached: mocks.listSupportedLanguagesCached,
}));
vi.mock("@internal/dashboard/webhooks", () => ({
  fetchSiteDashboardProjection: mocks.fetchSiteDashboardProjection,
  getSiteShowcase: mocks.getSiteShowcase,
  listRuntimeRequestObservations: mocks.listRuntimeRequestObservations,
  WebhooksApiError: class WebhooksApiError extends Error {},
}));
vi.mock("@internal/i18n", () => ({
  normalizeLocale: mocks.normalizeLocale,
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));
vi.mock("../site-header", () => ({
  SiteHeader: () => null,
}));
vi.mock("./site-settings-form", () => ({
  SiteSettingsForm: () => <div data-testid="site-settings-form" />,
}));

describe("SettingsPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses the settings projection without loading broad dashboard side data", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    mocks.fetchSiteDashboardProjection.mockResolvedValue(makeSettingsProjection());
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
    expect(mocks.getSiteShowcase).not.toHaveBeenCalled();
    expect(mocks.listRuntimeRequestObservations).not.toHaveBeenCalled();
    expect(collectHrefs(tree).some((href) => href.endsWith("/admin"))).toBe(false);
  });

  it("labels scoped demo settings as read-only instead of a billing problem", async () => {
    const authToken = { token: "demo-token", subjectAccountId: "acct-demo" };
    mocks.requireDashboardAuth.mockResolvedValue({
      ...makeAuth(authToken),
      accessMode: "demo",
      demoSession: { siteId: "site-1" },
      mutationsAllowed: false,
    });
    mocks.fetchSiteDashboardProjection.mockResolvedValue(
      makeSettingsProjection({ access: { mutationsAllowed: false } }),
    );
    mocks.listSupportedLanguagesCached.mockResolvedValue([]);

    vi.resetModules();
    const { default: SettingsPage } = await import("./page");
    const tree = await SettingsPage({ params: Promise.resolve({ id: "site-1" }) });

    render(tree);
    expect(screen.getByText("Demo settings are read-only")).toBeTruthy();
    expect(screen.getByText("Read-only demo settings")).toBeTruthy();
    expect(screen.queryByText("Billing action required")).toBeNull();
  });

  it("keeps billing locked settings copy for non-demo billing blocks", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue({
      ...makeAuth(authToken),
      mutationsAllowed: false,
    });
    mocks.fetchSiteDashboardProjection.mockResolvedValue(
      makeSettingsProjection({ access: { mutationsAllowed: false } }),
    );
    mocks.listSupportedLanguagesCached.mockResolvedValue([]);

    vi.resetModules();
    const { default: SettingsPage } = await import("./page");
    const tree = await SettingsPage({ params: Promise.resolve({ id: "site-1" }) });

    render(tree);
    expect(screen.getByText("Billing action required")).toBeTruthy();
    expect(screen.queryByText("Read-only demo settings")).toBeNull();
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

function makeSettingsProjection(overrides: { access?: { mutationsAllowed: boolean } } = {}) {
  return {
    meta: { view: "settings", generatedAt: "2026-05-07T00:00:00.000Z", schemaVersion: 1 },
    site: { ...makeSite(), createdAt: null, updatedAt: null },
    access: {
      mutationsAllowed: overrides.access?.mutationsAllowed ?? true,
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
