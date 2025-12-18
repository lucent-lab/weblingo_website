import { OnboardingForm } from "./onboarding-form";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { resolveSitePlanForAccount } from "@internal/dashboard/entitlements";
import { redirect } from "next/navigation";

export const metadata = {
  title: "New site",
  robots: { index: false, follow: false },
};

export default async function NewSitePage() {
  const auth = await requireDashboardAuth();
  if (!auth.has({ feature: "site_create" })) {
    redirect("/dashboard/sites");
  }
  const sitePlan = resolveSitePlanForAccount(auth.account!.planType);
  const maxLocales = auth.account!.featureFlags.maxLocales;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Add a new site</h2>
        <p className="text-sm text-muted-foreground">
          Guided setup to capture your source URL, languages, and domain pattern.
        </p>
      </div>
      <OnboardingForm maxLocales={maxLocales} sitePlan={sitePlan} />
    </div>
  );
}
