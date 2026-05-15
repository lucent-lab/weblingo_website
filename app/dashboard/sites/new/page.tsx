import { OnboardingForm } from "./onboarding-form";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { listSitesCached, listSupportedLanguagesCached } from "@internal/dashboard/data";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isCustomerDashboardWorkspace } from "@internal/dashboard/workspace";
import { resolvePreferredLocale } from "@internal/i18n";
import type { SiteSummary } from "@internal/dashboard/webhooks";

export const metadata = {
  title: "New site",
  robots: { index: false, follow: false },
};

export default async function NewSitePage() {
  const auth = await requireDashboardAuth();
  const billingBlocked = !auth.mutationsAllowed;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const pricingPath = `/${locale}/pricing`;
  const maxSites = auth.account?.featureFlags.maxSites ?? null;
  const isNormalCustomer = isCustomerDashboardWorkspace(auth);
  let sites: SiteSummary[] = [];
  if (auth.webhooksAuth) {
    sites = await listSitesCached(auth.webhooksAuth);
  }
  const activeSites = sites.filter((site) => site.status === "active");
  if (isNormalCustomer && activeSites.length === 1) {
    redirect(`/dashboard/sites/${activeSites[0]!.id}`);
  }
  const hasAvailableSlot = maxSites === null || activeSites.length < maxSites;
  const atSiteLimit = maxSites !== null && activeSites.length >= maxSites;
  const canCreateSite = auth.has({ feature: "site_create" }) && !billingBlocked && hasAvailableSlot;
  if (isNormalCustomer && activeSites.length > 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Website workspace needs review</CardTitle>
          <CardDescription>
            This account has more than one active website record. Open the dashboard or contact
            support so we can reconcile the account before another website is created.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <a href="mailto:contact@weblingo.app?subject=Dashboard%20website%20workspace%20review">
              Contact support
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!canCreateSite) {
    const title = billingBlocked
      ? "Billing action required"
      : atSiteLimit
        ? "Site limit reached"
        : isNormalCustomer
          ? "Website creation is locked"
          : "Site creation is locked";
    const description = billingBlocked
      ? isNormalCustomer
        ? "Update billing to create your website workspace."
        : "Update billing to resume onboarding new sites."
      : atSiteLimit
        ? isNormalCustomer
          ? "This account already has a website. Open the existing workspace and use settings to change the source URL."
          : `Your plan allows ${maxSites} active site(s). Upgrade to add more.`
        : isNormalCustomer
          ? "Review your plan before creating a website workspace."
          : "Upgrade your plan to onboard new sites and start translating.";
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href={pricingPath}>{billingBlocked ? "Update billing" : "Upgrade plan"}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  const maxLocales = auth.account!.featureFlags.maxLocales;
  const supportedLanguages = await listSupportedLanguagesCached();
  const displayLocale = locale;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-balance text-2xl font-semibold">
          {isNormalCustomer ? "Create your website workspace" : "Add a new site"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isNormalCustomer
            ? "One account and subscription are tied to one website. You can update the source URL later from settings."
            : "Set up your source URL, languages, and routing pattern."}
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
