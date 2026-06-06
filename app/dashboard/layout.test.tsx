import { beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardAuth = vi.fn();
const shouldRecoverDashboardDemoSession = vi.fn();
const requestHeaders = vi.hoisted(() => ({ value: new Headers() }));
const redirect = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});

vi.mock("next/navigation", () => ({ redirect }));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => requestHeaders.value),
}));

vi.mock("@internal/dashboard/auth", () => ({
  getDashboardAuth,
  getActiveAgencyCustomers: vi.fn(() => []),
  hasActorInternalOps: vi.fn(() => false),
  shouldRecoverDashboardDemoSession,
}));

vi.mock("@internal/dashboard/data", () => ({
  listSitesCached: vi.fn(),
  listSitesFresh: vi.fn(),
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    getDashboardAuth.mockReset();
    shouldRecoverDashboardDemoSession.mockReset();
    shouldRecoverDashboardDemoSession.mockResolvedValue(false);
    requestHeaders.value = new Headers();
    redirect.mockClear();
  });

  it("renders no-account children without re-entering the dashboard account redirect", async () => {
    const { default: DashboardLayout } = await import("./layout");
    const children = <div data-testid="no-account-child" />;

    getDashboardAuth.mockResolvedValueOnce({
      user: { id: "user-1", email: "user@example.com" },
      session: { access_token: "token" },
      webhooksAuth: null,
      account: null,
    });

    await expect(DashboardLayout({ children })).resolves.toBe(children);
    expect(redirect).not.toHaveBeenCalledWith("/dashboard/no-account");
  });

  it("still redirects anonymous users to login from the parent dashboard layout", async () => {
    const { default: DashboardLayout } = await import("./layout");

    getDashboardAuth.mockResolvedValueOnce({
      user: null,
      session: null,
      webhooksAuth: null,
      account: null,
    });

    await expect(DashboardLayout({ children: <div /> })).rejects.toThrow("redirect:/auth/login");
  });

  it("routes stale demo-scoped anonymous sessions back to demo recovery", async () => {
    const { default: DashboardLayout } = await import("./layout");
    const auth = {
      accessMode: "anonymous",
      user: null,
      session: null,
      webhooksAuth: null,
      account: null,
    };
    getDashboardAuth.mockResolvedValueOnce(auth);
    shouldRecoverDashboardDemoSession.mockResolvedValueOnce(true);
    requestHeaders.value.set("x-weblingo-dashboard-demo-locale", "fr");

    await expect(DashboardLayout({ children: <div /> })).rejects.toThrow(
      "redirect:/dashboard/demo?locale=fr",
    );
    expect(shouldRecoverDashboardDemoSession).toHaveBeenCalledWith(auth);
  });

  it("prefers the demo locale header for dashboard shell locale resolution", async () => {
    const { resolveDashboardShellLocale } = await import("./layout");
    const headers = new Headers({
      "accept-language": "ja",
      "x-weblingo-dashboard-demo-locale": "fr",
    });

    expect(resolveDashboardShellLocale(headers)).toBe("fr");
  });

  it("uses fresh site reads for customer shell site navigation and counts", async () => {
    const data = await import("@internal/dashboard/data");
    const { resolveLayoutSitesReader } = await import("./layout");

    expect(resolveLayoutSitesReader(false)).toBe(data.listSitesFresh);
  });

  it("keeps agency shell site navigation and counts on the shared cached reader", async () => {
    const data = await import("@internal/dashboard/data");
    const { resolveLayoutSitesReader } = await import("./layout");

    expect(resolveLayoutSitesReader(true)).toBe(data.listSitesCached);
  });

  it("limits demo shell navigation to the claimed site dashboard", async () => {
    const { resolveDashboardNavItems } = await import("./layout");

    const navItems = resolveDashboardNavItems({
      isAgency: false,
      canAccessInternalOps: false,
      demoSiteId: "site-demo",
    });

    expect(navItems.map((item) => ({ href: item.href, label: item.label }))).toEqual([
      { href: "/dashboard/sites/site-demo", label: "Dashboard" },
    ]);
  });

  it("keeps global developer tools in normal authenticated navigation", async () => {
    const { resolveDashboardNavItems } = await import("./layout");

    const navItems = resolveDashboardNavItems({
      isAgency: false,
      canAccessInternalOps: false,
      demoSiteId: null,
    });

    expect(navItems.map((item) => item.href)).toContain("/dashboard/developer-tools");
  });

  it("shows only the single active current website in normal-customer shell navigation", async () => {
    const { resolveLayoutSiteNavEntries } = await import("./layout");

    expect(
      resolveLayoutSiteNavEntries({
        auth: makeAuth(),
        sites: [makeSite("site-old", "inactive"), makeSite("site-current")],
      }),
    ).toEqual([
      {
        id: "site-current",
        label: "site-current.example.com",
        status: "active",
      },
    ]);
  });

  it("hides normal-customer shell site navigation in duplicate-active review state", async () => {
    const { resolveLayoutSiteNavEntries, resolveLayoutSiteNavEmptyLabel } =
      await import("./layout");
    const duplicateSites = [makeSite("site-1"), makeSite("site-2")];

    expect(
      resolveLayoutSiteNavEntries({
        auth: makeAuth(),
        sites: duplicateSites,
      }),
    ).toEqual([]);
    expect(
      resolveLayoutSiteNavEmptyLabel({
        auth: makeAuth(),
        sites: duplicateSites,
        emptyLabel: "No website yet.",
      }),
    ).toBe("Website records need review.");
  });

  it("keeps agency shell site navigation portfolio-style", async () => {
    const { resolveLayoutSiteNavEntries } = await import("./layout");

    expect(
      resolveLayoutSiteNavEntries({
        auth: makeAuth("agency"),
        sites: [makeSite("site-old", "inactive"), makeSite("site-current")],
      }),
    ).toEqual([
      {
        id: "site-old",
        label: "site-old.example.com",
        status: "inactive",
      },
      {
        id: "site-current",
        label: "site-current.example.com",
        status: "active",
      },
    ]);
  });

  it("limits demo shell site navigation to the claimed site", async () => {
    const { filterLayoutSitesForAuth, resolveLayoutSiteNavEntries } = await import("./layout");
    const auth = makeAuth("starter", { accessMode: "demo", demoSiteId: "site-claimed" });
    const sites = [makeSite("site-other"), makeSite("site-claimed")];

    expect(filterLayoutSitesForAuth(auth, sites).map((site) => site.id)).toEqual(["site-claimed"]);
    expect(
      resolveLayoutSiteNavEntries({
        auth,
        sites,
      }),
    ).toEqual([
      {
        id: "site-claimed",
        label: "site-claimed.example.com",
        status: "active",
      },
    ]);
  });
});

function makeAuth(
  planType = "starter",
  options: { accessMode?: "supabase" | "demo"; demoSiteId?: string } = {},
) {
  return {
    accessMode: options.accessMode ?? "supabase",
    demoSession: options.demoSiteId ? { siteId: options.demoSiteId } : null,
    actorAccount: { planType },
    account: { featureFlags: { maxSites: planType === "agency" ? null : 1 } },
    mutationsAllowed: true,
    has: () => true,
  };
}

function makeSite(id: string, status: "active" | "inactive" = "active") {
  return {
    id,
    accountId: "acct-1",
    sourceUrl: `https://${id}.example.com`,
    status,
    servingMode: "strict" as const,
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
