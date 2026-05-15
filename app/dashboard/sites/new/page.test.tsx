// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  listSitesFresh: vi.fn(),
  listSupportedLanguagesCached: vi.fn(async () => []),
  redirect: vi.fn((href: string) => {
    const error = new Error(`NEXT_REDIRECT:${href}`);
    (error as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${href}`;
    throw error;
  }),
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
  listSupportedLanguagesCached: mocks.listSupportedLanguagesCached,
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: vi.fn(() => "en"),
}));
vi.mock("./onboarding-form", () => ({
  OnboardingForm: () => <div>Onboarding form</div>,
}));

describe("NewSitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listSupportedLanguagesCached.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders normal-customer onboarding when no website exists", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([]);

    vi.resetModules();
    const { default: NewSitePage } = await import("./page");
    const tree = await NewSitePage();

    render(tree);
    expect(screen.getByText("Create your website workspace")).toBeTruthy();
    expect(screen.getByText(/One account and subscription are tied to one website/)).toBeTruthy();
    expect(screen.getByText("Onboarding form")).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects a normal customer away from create-another-site when a website exists", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([makeSite("site-1")]);

    vi.resetModules();
    const { default: NewSitePage } = await import("./page");

    await expect(NewSitePage()).rejects.toThrow("NEXT_REDIRECT:/dashboard/sites/site-1");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/sites/site-1");
  });

  it("renders normal-customer onboarding when only inactive website records exist", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([makeSite("site-old", "inactive")]);

    vi.resetModules();
    const { default: NewSitePage } = await import("./page");
    const tree = await NewSitePage();

    render(tree);
    expect(screen.getByText("Create your website workspace")).toBeTruthy();
    expect(screen.getByText("Onboarding form")).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects a normal customer to the active website when inactive records exist", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([
      makeSite("site-old", "inactive"),
      makeSite("site-current"),
    ]);

    vi.resetModules();
    const { default: NewSitePage } = await import("./page");

    await expect(NewSitePage()).rejects.toThrow("NEXT_REDIRECT:/dashboard/sites/site-current");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/sites/site-current");
  });

  it("shows a review state instead of choosing from duplicate active websites", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([makeSite("site-1"), makeSite("site-2")]);

    vi.resetModules();
    const { default: NewSitePage } = await import("./page");
    const tree = await NewSitePage();

    render(tree);
    expect(screen.getByText("Website workspace needs review")).toBeTruthy();
    expect(screen.getByText(/more than one active website record/)).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps agency add-site onboarding available", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth({ actorPlan: "agency", maxSites: null }));
    mocks.listSitesFresh.mockResolvedValue([makeSite("site-client")]);

    vi.resetModules();
    const { default: NewSitePage } = await import("./page");
    const tree = await NewSitePage();

    render(tree);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(screen.getByText("Add a new site")).toBeTruthy();
    expect(screen.getByText("Onboarding form")).toBeTruthy();
  });
});

function makeAuth(options: { actorPlan?: string; maxSites?: number | null } = {}) {
  const account = {
    accountId: "acct-1",
    planType: "starter",
    planStatus: "active",
    featureFlags: {
      maxSites: options.maxSites === undefined ? 1 : options.maxSites,
      maxLocales: null,
    },
  };
  return {
    account,
    actorAccount: { ...account, planType: options.actorPlan ?? account.planType },
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
