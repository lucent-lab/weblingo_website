// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  listSitesFresh: vi.fn(),
  redirect: vi.fn((href: string) => {
    const error = new Error(`NEXT_REDIRECT:${href}`);
    (error as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${href}`;
    throw error;
  }),
  sitesList: vi.fn(() => <div>Site portfolio</div>),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: mocks.requireDashboardAuth,
}));
vi.mock("@internal/dashboard/data", () => ({
  listSitesFresh: mocks.listSitesFresh,
}));
vi.mock("@internal/dashboard/error-state", () => ({
  resolveDashboardErrorView: vi.fn((error, fallback) => ({
    ...fallback,
    message: error instanceof Error ? error.message : fallback.message,
  })),
}));
vi.mock("@internal/dashboard/onboarding-state", () => ({
  resolveDashboardOnboardingState: vi.fn(() => ({ stage: "none" })),
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: vi.fn(() => "en"),
  resolveLocaleTranslator: vi.fn(async () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  })),
}));
vi.mock("./_components/sites-list", () => ({
  SitesList: mocks.sitesList,
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows onboarding without the site portfolio when a normal customer has no website", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([]);

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");
    const tree = await DashboardPage();

    render(tree);
    expect(screen.getByText("Create your website workspace")).toBeTruthy();
    expect(screen.getAllByText("Create website").length).toBeGreaterThan(0);
    expect(screen.queryByText("Site portfolio")).toBeNull();
    expect(mocks.sitesList).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("routes a normal customer with one website directly to the workspace", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([makeSite("site-1")]);

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");

    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard/sites/site-1");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/sites/site-1");
    expect(mocks.sitesList).not.toHaveBeenCalled();
  });

  it("shows onboarding when a normal customer only has inactive website records", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([makeSite("site-old", "inactive")]);

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");
    const tree = await DashboardPage();

    render(tree);
    expect(screen.getByText("Create your website workspace")).toBeTruthy();
    expect(screen.queryByText("Site portfolio")).toBeNull();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("routes a normal customer to the active website when inactive records exist", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([
      makeSite("site-old", "inactive"),
      makeSite("site-current"),
    ]);

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");

    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard/sites/site-current");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/sites/site-current");
    expect(mocks.sitesList).not.toHaveBeenCalled();
  });

  it("does not render a normal-customer portfolio even if stale data contains multiple sites", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([makeSite("site-1"), makeSite("site-2")]);

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");
    const tree = await DashboardPage();

    render(tree);
    expect(screen.getByText("Website workspace needs review")).toBeTruthy();
    expect(screen.getByText(/more than one active website record/)).toBeTruthy();
    expect(screen.queryByText("Open website")).toBeNull();
    expect(screen.queryByText("Site portfolio")).toBeNull();
    expect(mocks.sitesList).not.toHaveBeenCalled();
  });

  it("keeps agency portfolio behavior unchanged", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(
      makeAuth({
        actorPlan: "agency",
        accountPlan: "agency",
        maxSites: null,
      }),
    );
    mocks.listSitesFresh.mockResolvedValue([makeSite("site-agency")]);

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");
    const tree = await DashboardPage();

    render(tree);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.sitesList).toHaveBeenCalled();
    expect(screen.getByText("Site portfolio")).toBeTruthy();
    expect(screen.getByText("Add a site")).toBeTruthy();
  });
});

function makeAuth(
  options: { actorPlan?: string; accountPlan?: string; maxSites?: number | null } = {},
) {
  const planType = options.accountPlan ?? "starter";
  const account = {
    accountId: "acct-1",
    planType,
    planStatus: "active",
    featureFlags: { maxSites: options.maxSites === undefined ? 1 : options.maxSites },
  };
  return {
    account,
    actorAccount: {
      ...account,
      planType: options.actorPlan ?? planType,
    },
    webhooksAuth: { token: "token", subjectAccountId: "acct-1" },
    mutationsAllowed: true,
    has: vi.fn(() => true),
  };
}

function makeSite(id: string, status: "active" | "inactive" = "active") {
  return {
    id,
    accountId: "acct-1",
    sourceUrl: `https://${id}.example.com`,
    status,
    servingMode: "strict",
    maxLocales: null,
    siteProfile: null,
    sourceLang: "en",
    targetLangs: ["fr"],
    localeCount: 1,
    serveEnabledLocaleCount: 0,
    domainCount: 1,
    verifiedDomainCount: 0,
  };
}
