import { describe, expect, it } from "vitest";

import {
  getDashboardSitesLabel,
  isCustomerDashboardWorkspace,
  resolveDashboardMaxSitesLimit,
  resolveDashboardWebsiteWorkspaceState,
  resolveDashboardWorkspaceAudience,
} from "./workspace";

describe("dashboard workspace helpers", () => {
  it("resolves normal customer workspaces to the single-website site limit", () => {
    const auth = {
      actorAccount: { planType: "starter" },
      account: { featureFlags: { maxSites: null } },
    };

    expect(resolveDashboardWorkspaceAudience(auth)).toBe("customer");
    expect(isCustomerDashboardWorkspace(auth)).toBe(true);
    expect(getDashboardSitesLabel("customer")).toBe("Website");
    expect(resolveDashboardMaxSitesLimit(auth)).toBe(1);
  });

  it("keeps agency workspaces on the account-provided site limit", () => {
    const auth = {
      actorAccount: { planType: "agency" },
      account: { featureFlags: { maxSites: null } },
    };

    expect(resolveDashboardWorkspaceAudience(auth)).toBe("agency");
    expect(isCustomerDashboardWorkspace(auth)).toBe(false);
    expect(getDashboardSitesLabel("agency")).toBe("Sites");
    expect(resolveDashboardMaxSitesLimit(auth)).toBeNull();
  });

  it("resolves normal customer website cardinality once for routes and shell navigation", () => {
    const auth = {
      actorAccount: { planType: "starter" },
      account: { featureFlags: { maxSites: null } },
      mutationsAllowed: true,
      has: () => true,
    };

    expect(resolveDashboardWebsiteWorkspaceState(auth, []).kind).toBe("no_current_website");

    const single = resolveDashboardWebsiteWorkspaceState(auth, [
      makeSite("site-old", "inactive"),
      makeSite("site-current"),
    ]);
    expect(single.kind).toBe("single_current_website");
    expect(single.currentSite?.id).toBe("site-current");
    expect(single.visibleSites.map((site) => site.id)).toEqual(["site-current"]);

    const duplicate = resolveDashboardWebsiteWorkspaceState(auth, [
      makeSite("site-1"),
      makeSite("site-2"),
    ]);
    expect(duplicate.kind).toBe("duplicate_current_websites");
    expect(duplicate.currentSite).toBeNull();
    expect(duplicate.visibleSites).toEqual([]);
  });

  it("keeps agency workspace state as portfolio-oriented", () => {
    const state = resolveDashboardWebsiteWorkspaceState(
      {
        actorAccount: { planType: "agency" },
        account: { featureFlags: { maxSites: null } },
        mutationsAllowed: true,
        has: () => true,
      },
      [makeSite("site-old", "inactive"), makeSite("site-current")],
    );

    expect(state.kind).toBe("agency_portfolio");
    expect(state.currentSite).toBeNull();
    expect(state.visibleSites.map((site) => site.id)).toEqual(["site-old", "site-current"]);
  });
});

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
