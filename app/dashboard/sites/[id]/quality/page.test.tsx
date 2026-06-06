// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSiteDashboardProjection: vi.fn(),
  fetchGlossary: vi.fn(),
  fetchConsistencyCpm: vi.fn(),
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
  fetchGlossary: mocks.fetchGlossary,
  fetchConsistencyCpm: mocks.fetchConsistencyCpm,
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

describe("QualityPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses the quality projection without eager quality detail fetches", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: { view: "quality", generatedAt: "2026-05-07T00:00:00.000Z", schemaVersion: 1 },
      site: makeSite(),
      access: {
        mutationsAllowed: true,
        features: {},
        canUseGlossary: true,
        canUseOverrides: true,
        canEditSlugs: true,
        canUseConsistencyGovernance: false,
      },
    });

    vi.resetModules();
    const { default: QualityPage } = await import("./page");
    const tree = await QualityPage({ params: Promise.resolve({ id: "site-1" }) });

    expect(isValidElement(tree)).toBe(true);
    expect(mocks.fetchSiteDashboardProjection).toHaveBeenCalledWith(authToken, "site-1", "quality");
    expect(mocks.fetchGlossary).not.toHaveBeenCalled();
    expect(mocks.fetchConsistencyCpm).not.toHaveBeenCalled();
  });

  it("renders demo quality as a translation-control narrative hub", async () => {
    const authToken = { token: "demo-token", subjectAccountId: "acct-demo" };
    mocks.requireDashboardAuth.mockResolvedValue({
      ...makeAuth(authToken),
      accessMode: "demo",
      demoSession: { siteId: "site-1" },
      mutationsAllowed: false,
    });
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: { view: "quality", generatedAt: "2026-05-07T00:00:00.000Z", schemaVersion: 1 },
      site: makeSite(),
      access: {
        mutationsAllowed: false,
        features: {},
        canUseGlossary: true,
        canUseOverrides: true,
        canEditSlugs: true,
        canUseConsistencyGovernance: true,
      },
      glossarySummary: { entriesCount: 0 },
      overrideSummary: { entriesCount: 0 },
      slugSummary: { localizedSlugCount: 0, conflicts: 0 },
    });

    vi.resetModules();
    const { default: QualityPage } = await import("./page");
    const tree = await QualityPage({ params: Promise.resolve({ id: "site-1" }) });

    render(tree);
    expect(screen.getByText("Translation control proof")).toBeTruthy();
    expect(
      screen.getByText(
        "Real saved controls appear first. When a control has no saved entries yet, the demo stays read-only and labels any examples before showing them.",
      ),
    ).toBeTruthy();
    expect(screen.getAllByText("Glossary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual overrides").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Localized slugs").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Consistency").length).toBeGreaterThan(0);
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
