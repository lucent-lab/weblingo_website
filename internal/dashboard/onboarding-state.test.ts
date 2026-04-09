import { describe, expect, it } from "vitest";

import { buildNoAccountOnboardingState, resolveDashboardOnboardingState } from "./onboarding-state";

describe("dashboard onboarding state", () => {
  it("describes the no-account handoff explicitly", () => {
    expect(buildNoAccountOnboardingState()).toEqual({
      stage: "no_account",
      badge: "Status: claim required",
      title: "Claim free dashboard access",
      description:
        "Claiming creates the dashboard account now. Pricing and billing stay separate until you choose a plan.",
    });
  });

  it("marks a newly claimed free account as its own state", () => {
    const state = resolveDashboardOnboardingState({
      account: {
        planType: "free",
        planStatus: "active",
      } as never,
      billingIssue: null,
      mutationsAllowed: true,
    });

    expect(state).toEqual({
      stage: "claimed_free_account",
      badge: "Status: free account linked",
      title: "Free account linked",
      description:
        "Your dashboard account is active. Start onboarding a site, then update billing when you are ready to upgrade.",
    });
  });

  it("marks inactive billing as a separate onboarding state", () => {
    const state = resolveDashboardOnboardingState({
      account: {
        planType: "starter",
        planStatus: "past_due",
      } as never,
      billingIssue: { scope: "actor", status: "past_due" },
      mutationsAllowed: false,
    });

    expect(state).toEqual({
      stage: "pending_billing",
      badge: "Status: billing update needed",
      title: "Update billing to continue",
      description:
        "Your account exists, but billing must be updated before more site changes can continue.",
    });
  });

  it("marks active paid accounts as ready", () => {
    const state = resolveDashboardOnboardingState({
      account: {
        planType: "starter",
        planStatus: "active",
      } as never,
      billingIssue: null,
      mutationsAllowed: true,
    });

    expect(state).toEqual({
      stage: "ready",
      badge: "Status: ready",
      title: "Dashboard ready",
      description: "Your account is active and ready for onboarding.",
    });
  });
});
