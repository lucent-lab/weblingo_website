import type { DashboardAuth } from "./auth";

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
  badge: string,
  title: string,
  description: string,
): DashboardOnboardingState {
  return {
    stage,
    badge,
    title,
    description,
  };
}

export function buildNoAccountOnboardingState(): DashboardOnboardingState {
  return buildState(
    "no_account",
    "Status: claim required",
    "Claim free dashboard access",
    "Claiming creates the dashboard account now. Pricing and billing stay separate until you choose a plan.",
  );
}

export function resolveDashboardOnboardingState(
  auth: Pick<DashboardAuth, "account" | "billingIssue" | "mutationsAllowed">,
): DashboardOnboardingState {
  if (!auth.account) {
    return buildNoAccountOnboardingState();
  }

  if (auth.billingIssue || !auth.mutationsAllowed) {
    return buildState(
      "pending_billing",
      "Status: billing update needed",
      "Update billing to continue",
      "Your account exists, but billing must be updated before more site changes can continue.",
    );
  }

  if (auth.account.planType === "free") {
    return buildState(
      "claimed_free_account",
      "Status: free account linked",
      "Free account linked",
      "Your dashboard account is active. Start onboarding a site, then update billing when you are ready to upgrade.",
    );
  }

  return buildState(
    "ready",
    "Status: ready",
    "Dashboard ready",
    "Your account is active and ready for onboarding.",
  );
}
