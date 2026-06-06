// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => ({ value: new Headers() }));

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  normalizeLocale: vi.fn((locale: string) => (["en", "fr", "ja"].includes(locale) ? locale : "en")),
  resolvePreferredLocale: vi.fn(() => "en"),
  resolveLocaleTranslator: vi.fn(async () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => requestHeaders.value),
}));
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: mocks.requireDashboardAuth,
}));
vi.mock("@internal/i18n", () => ({
  normalizeLocale: mocks.normalizeLocale,
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));

describe("SiteDashboardLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestHeaders.value = new Headers();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the activation reminder only for demo access scoped to the current site", async () => {
    requestHeaders.value.set("x-weblingo-dashboard-demo-locale", "fr");
    mocks.requireDashboardAuth.mockResolvedValue({
      accessMode: "demo",
      demoSession: { siteId: "site-demo" },
    });

    vi.resetModules();
    const { default: SiteDashboardLayout } = await import("./layout");
    const tree = await SiteDashboardLayout({
      params: Promise.resolve({ id: "site-demo" }),
      children: <div>Site content</div>,
    });

    render(tree);
    expect(screen.getByText("Read-only demo workspace")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Activate demo" }).getAttribute("href")).toBe(
      "/dashboard/sites/site-demo?locale=fr#activate-demo",
    );
  });

  it("does not render the activation reminder for normal customer access", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      accessMode: "supabase",
      demoSession: null,
    });

    vi.resetModules();
    const { default: SiteDashboardLayout } = await import("./layout");
    const tree = await SiteDashboardLayout({
      params: Promise.resolve({ id: "site-demo" }),
      children: <div>Site content</div>,
    });

    render(tree);
    expect(screen.queryByText("Read-only demo workspace")).toBeNull();
    expect(screen.getByText("Site content")).toBeTruthy();
  });

  it("does not render the activation reminder for a different demo-scoped site", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      accessMode: "demo",
      demoSession: { siteId: "site-claimed" },
    });

    vi.resetModules();
    const { default: SiteDashboardLayout } = await import("./layout");
    const tree = await SiteDashboardLayout({
      params: Promise.resolve({ id: "site-other" }),
      children: <div>Site content</div>,
    });

    render(tree);
    expect(screen.queryByText("Read-only demo workspace")).toBeNull();
    expect(screen.getByText("Site content")).toBeTruthy();
  });
});
