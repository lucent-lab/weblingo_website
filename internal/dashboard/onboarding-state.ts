import type { DashboardAuth } from "./auth";
import type { Translator } from "@internal/i18n";

export type DashboardOnboardingStage =
  | "no_account"
  | "claimed_free_account"
  | "pending_billing"
  | "ready";

export type DashboardOnboardingState = {
  stage: DashboardOnboardingStage;
  badge: string;
  title: string;
  description: string;
};

function buildState(
  stage: DashboardOnboardingStage,
  t: Translator,
  copy: {
    badgeKey: string;
    badgeFallback: string;
    titleKey: string;
    titleFallback: string;
    descriptionKey: string;
    descriptionFallback: string;
  },
): DashboardOnboardingState {
  return {
    stage,
    badge: t(copy.badgeKey, copy.badgeFallback),
    title: t(copy.titleKey, copy.titleFallback),
    description: t(copy.descriptionKey, copy.descriptionFallback),
  };
}

export function buildNoAccountOnboardingState(t: Translator): DashboardOnboardingState {
  return buildState("no_account", t, {
    badgeKey: "dashboard.onboarding.noAccount.badge",
    badgeFallback: "Status: claim required",
    titleKey: "dashboard.onboarding.noAccount.title",
    titleFallback: "Claim free dashboard access",
    descriptionKey: "dashboard.onboarding.noAccount.description",
    descriptionFallback:
      "Claiming creates the dashboard account now. Pricing and billing stay separate until you choose a plan.",
  });
}

export function resolveDashboardOnboardingState(
  auth: Pick<DashboardAuth, "account" | "billingIssue" | "mutationsAllowed">,
  t: Translator,
): DashboardOnboardingState {
  if (!auth.account) {
    return buildNoAccountOnboardingState(t);
  }

  if (auth.billingIssue || !auth.mutationsAllowed) {
    return buildState("pending_billing", t, {
      badgeKey: "dashboard.onboarding.pendingBilling.badge",
      badgeFallback: "Status: billing update needed",
      titleKey: "dashboard.onboarding.pendingBilling.title",
      titleFallback: "Update billing to continue",
      descriptionKey: "dashboard.onboarding.pendingBilling.description",
      descriptionFallback:
        "Your account exists, but billing must be updated before more site changes can continue.",
    });
  }

  if (auth.account.planType === "free") {
    return buildState("claimed_free_account", t, {
      badgeKey: "dashboard.onboarding.claimedFree.badge",
      badgeFallback: "Status: free account linked",
      titleKey: "dashboard.onboarding.claimedFree.title",
      titleFallback: "Free account linked",
      descriptionKey: "dashboard.onboarding.claimedFree.description",
      descriptionFallback:
        "Your dashboard account is active. Start onboarding a site, then update billing when you are ready to upgrade.",
    });
  }

  return buildState("ready", t, {
    badgeKey: "dashboard.onboarding.ready.badge",
    badgeFallback: "Status: ready",
    titleKey: "dashboard.onboarding.ready.title",
    titleFallback: "Dashboard ready",
    descriptionKey: "dashboard.onboarding.ready.description",
    descriptionFallback: "Your account is active and ready for onboarding.",
  });
}
