import { beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardAuth = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});

vi.mock("next/navigation", () => ({ redirect }));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@internal/dashboard/auth", () => ({
  getDashboardAuth,
  getActiveAgencyCustomers: vi.fn(() => []),
  hasActorInternalOps: vi.fn(() => false),
}));

vi.mock("@internal/dashboard/data", () => ({
  listSitesCached: vi.fn(),
  listSitesFresh: vi.fn(),
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    getDashboardAuth.mockReset();
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
});

function makeAuth(planType = "starter") {
  return {
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
