import { OnboardingForm } from "./onboarding-form";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { listSites, listSupportedLanguages } from "@internal/dashboard/webhooks";
import { headers } from "next/headers";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { i18nConfig } from "@internal/i18n";

export const metadata = {
  title: "New site",
  robots: { index: false, follow: false },
};

export default async function NewSitePage() {
  const auth = await requireDashboardAuth();
  const billingBlocked = !auth.mutationsAllowed;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;
  const maxSites = auth.account?.featureFlags.maxSites ?? null;
  let activeSites = 0;
  if (auth.webhooksAuth) {
    try {
      const sites = await listSites(auth.webhooksAuth);
      activeSites = sites.filter((site) => site.status === "active").length;
    } catch (error) {
      console.warn("[dashboard] listSites failed while checking slots:", error);
    }
  }
  const hasAvailableSlot = maxSites === null || activeSites < maxSites;
  const atSiteLimit = maxSites !== null && activeSites >= maxSites;
  const canCreateSite =
    auth.has({ feature: "site_create" }) && !billingBlocked && hasAvailableSlot;
  if (!canCreateSite) {
    const title = billingBlocked
      ? "Billing action required"
      : atSiteLimit
        ? "Site limit reached"
        : "Site creation is locked";
    const description = billingBlocked
      ? "Update billing to resume onboarding new sites."
      : atSiteLimit
        ? `Your plan allows ${maxSites} active site(s). Upgrade to add more.`
        : "Upgrade your plan to onboard new sites and start translating.";
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href={pricingPath}>
              {billingBlocked ? "Update billing" : "Upgrade plan"}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/sites">Back to sites</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  const maxLocales = auth.account!.featureFlags.maxLocales;
  const supportedLanguages = await listSupportedLanguages();
  const displayLocale = pickPreferredLocale((await headers()).get("accept-language") ?? "");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-balance text-2xl font-semibold">Add a new site</h2>
        <p className="text-sm text-muted-foreground">
          Set up your source URL, languages, and routing pattern.
        </p>
      </div>
      <OnboardingForm
        maxLocales={maxLocales}
        supportedLanguages={supportedLanguages}
        displayLocale={displayLocale}
      />
    </div>
  );
}

function pickPreferredLocale(acceptLanguageHeader: string): string {
  const first = acceptLanguageHeader.split(",")[0]?.split(";")[0]?.trim();
  return first && first.length ? first : "en";
}
