// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  listSitesFresh: vi.fn(),
  resolveDashboardOnboardingState: vi.fn(
    (): { stage: string; title?: string; description?: string; badge?: string } => ({
      stage: "none",
    }),
  ),
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
  resolveDashboardOnboardingState: mocks.resolveDashboardOnboardingState,
}));
vi.mock("@internal/i18n", () => ({
  normalizeLocale: vi.fn((locale: string) => (["en", "fr", "ja"].includes(locale) ? locale : "en")),
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
    mocks.resolveDashboardOnboardingState.mockReturnValue({ stage: "none" });
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

  it("uses the single-website contract when a normal customer bootstrap has stale maxSites", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth({ maxSites: 0 }));
    mocks.listSitesFresh.mockResolvedValue([]);

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");
    const tree = await DashboardPage();

    render(tree);
    expect(screen.getByText("Create your website workspace")).toBeTruthy();
    expect(screen.getAllByText("Create website").length).toBeGreaterThan(0);
    expect(screen.queryByText("Website creation is locked")).toBeNull();
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

  it("preserves an explicit locale when routing a normal customer to one website", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([makeSite("site-1")]);

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");

    await expect(
      DashboardPage({ searchParams: Promise.resolve({ locale: "fr" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard/sites/site-1?locale=fr");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/sites/site-1?locale=fr");
    expect(mocks.sitesList).not.toHaveBeenCalled();
  });

  it("routes a demo dashboard session directly to the claimed site without listing sites", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      ...makeAuth(),
      accessMode: "demo",
      demoSession: { siteId: "site-demo" },
      mutationsAllowed: false,
    });

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");

    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard/sites/site-demo");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/sites/site-demo");
    expect(mocks.listSitesFresh).not.toHaveBeenCalled();
    expect(mocks.sitesList).not.toHaveBeenCalled();
  });

  it("preserves an explicit locale when routing a demo dashboard session to the claimed site", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      ...makeAuth(),
      accessMode: "demo",
      demoSession: { siteId: "site-demo" },
      mutationsAllowed: false,
    });

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");

    await expect(
      DashboardPage({ searchParams: Promise.resolve({ locale: "fr" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard/sites/site-demo?locale=fr");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/sites/site-demo?locale=fr");
    expect(mocks.listSitesFresh).not.toHaveBeenCalled();
    expect(mocks.sitesList).not.toHaveBeenCalled();
  });

  it("uses an explicit dashboard locale for dashboard home copy", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth());
    mocks.listSitesFresh.mockResolvedValue([]);

    vi.resetModules();
    const i18n = await import("@internal/i18n");
    const { default: DashboardPage } = await import("./page");
    const tree = await DashboardPage({ searchParams: Promise.resolve({ locale: "fr" }) });

    const { container } = render(tree);
    const translatorCalls = vi.mocked(i18n.resolveLocaleTranslator).mock.calls as unknown as Array<
      [Promise<{ locale: string }>]
    >;
    await expect(translatorCalls[0]?.[0]).resolves.toEqual({ locale: "fr" });
    expect(i18n.resolvePreferredLocale).not.toHaveBeenCalled();
    expect(container.querySelector('a[href="/dashboard/sites/new?locale=fr"]')).toBeTruthy();
    expect(container.querySelector('a[href="/dashboard/developer-tools?locale=fr"]')).toBeTruthy();
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

  it("does not render free onboarding create links in duplicate-active review state", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth({ accountPlan: "free" }));
    mocks.resolveDashboardOnboardingState.mockReturnValue({
      stage: "claimed_free_account",
      title: "Free account ready",
      description: "Create your first website.",
      badge: "Free",
    });
    mocks.listSitesFresh.mockResolvedValue([makeSite("site-1"), makeSite("site-2")]);

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");
    const tree = await DashboardPage();

    const { container } = render(tree);
    expect(screen.getByText("Website workspace needs review")).toBeTruthy();
    expect(screen.getByText(/more than one active website record/)).toBeTruthy();
    expect(screen.queryByText("Free account ready")).toBeNull();
    expect(screen.queryByText("Open website")).toBeNull();
    expect(screen.queryByText("Review plan")).toBeNull();
    expect(screen.getAllByText("Contact support").length).toBeGreaterThan(0);
    expect(screen.queryByText("Site portfolio")).toBeNull();
    expect(container.querySelector('a[href="/dashboard/sites/new"]')).toBeNull();
    expect(mocks.sitesList).not.toHaveBeenCalled();
  });

  it("does not render free onboarding create links when the website state cannot load", async () => {
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth({ accountPlan: "free" }));
    mocks.resolveDashboardOnboardingState.mockReturnValue({
      stage: "claimed_free_account",
      title: "Free account ready",
      description: "Create your first website.",
      badge: "Free",
    });
    mocks.listSitesFresh.mockRejectedValue(new Error("site list failed"));

    vi.resetModules();
    const { default: DashboardPage } = await import("./page");
    const tree = await DashboardPage();

    const { container } = render(tree);
    expect(screen.getByText("Could not load sites")).toBeTruthy();
    expect(screen.getByText("site list failed")).toBeTruthy();
    expect(screen.queryByText("Free account ready")).toBeNull();
    expect(container.querySelector('a[href="/dashboard/sites/new"]')).toBeNull();
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
