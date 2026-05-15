import { describe, expect, it } from "vitest";

import {
  getDashboardSitesLabel,
  isCustomerDashboardWorkspace,
  resolveDashboardMaxSitesLimit,
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
});
