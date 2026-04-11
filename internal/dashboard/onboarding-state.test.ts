import { describe, expect, it } from "vitest";

import type { Translator } from "@internal/i18n";
import { buildNoAccountOnboardingState, resolveDashboardOnboardingState } from "./onboarding-state";

const t: Translator = (key, fallback) => {
  const messages: Record<string, string> = {
    "dashboard.onboarding.noAccount.badge": "Status: claim required",
    "dashboard.onboarding.noAccount.title": "Claim free dashboard access",
    "dashboard.onboarding.noAccount.description":
      "Claiming creates the dashboard account now. Pricing and billing stay separate until you choose a plan.",
    "dashboard.onboarding.pendingBilling.badge": "Status: billing update needed",
    "dashboard.onboarding.pendingBilling.title": "Update billing to continue",
    "dashboard.onboarding.pendingBilling.description":
      "Your account exists, but billing must be updated before more site changes can continue.",
    "dashboard.onboarding.claimedFree.badge": "Status: free account linked",
    "dashboard.onboarding.claimedFree.title": "Free account linked",
    "dashboard.onboarding.claimedFree.description":
      "Your dashboard account is active. Start onboarding a site, then update billing when you are ready to upgrade.",
    "dashboard.onboarding.ready.badge": "Status: ready",
    "dashboard.onboarding.ready.title": "Dashboard ready",
    "dashboard.onboarding.ready.description": "Your account is active and ready for onboarding.",
  };

  return messages[key] ?? fallback ?? key;
};

describe("dashboard onboarding state", () => {
  it("describes the no-account handoff explicitly", () => {
    expect(buildNoAccountOnboardingState(t)).toEqual({
      stage: "no_account",
      badge: "Status: claim required",
      title: "Claim free dashboard access",
      description:
        "Claiming creates the dashboard account now. Pricing and billing stay separate until you choose a plan.",
    });
  });

  it("marks a newly claimed free account as its own state", () => {
    const state = resolveDashboardOnboardingState(
      {
        account: {
          planType: "free",
          planStatus: "active",
        } as never,
        billingIssue: null,
        mutationsAllowed: true,
      },
      t,
    );

    expect(state).toEqual({
      stage: "claimed_free_account",
      badge: "Status: free account linked",
      title: "Free account linked",
      description:
        "Your dashboard account is active. Start onboarding a site, then update billing when you are ready to upgrade.",
    });
  });

  it("marks inactive billing as a separate onboarding state", () => {
    const state = resolveDashboardOnboardingState(
      {
        account: {
          planType: "starter",
          planStatus: "past_due",
        } as never,
        billingIssue: { scope: "actor", status: "past_due" },
        mutationsAllowed: false,
      },
      t,
    );

    expect(state).toEqual({
      stage: "pending_billing",
      badge: "Status: billing update needed",
      title: "Update billing to continue",
      description:
        "Your account exists, but billing must be updated before more site changes can continue.",
    });
  });

  it("marks active paid accounts as ready", () => {
    const state = resolveDashboardOnboardingState(
      {
        account: {
          planType: "starter",
          planStatus: "active",
        } as never,
        billingIssue: null,
        mutationsAllowed: true,
      },
      t,
    );

    expect(state).toEqual({
      stage: "ready",
      badge: "Status: ready",
      title: "Dashboard ready",
      description: "Your account is active and ready for onboarding.",
    });
  });
});
