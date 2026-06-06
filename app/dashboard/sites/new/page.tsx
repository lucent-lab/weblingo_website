import { OnboardingForm } from "./onboarding-form";

import { requireDashboardAuth } from "@internal/dashboard/auth";
import { listSitesFresh, listSupportedLanguagesCached } from "@internal/dashboard/data";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  isCustomerDashboardWorkspace,
  resolveDashboardWebsiteWorkspaceState,
} from "@internal/dashboard/workspace";
import { withDashboardLocale } from "@internal/dashboard/locale-url";
import { normalizeLocale, resolvePreferredLocale } from "@internal/i18n";
import type { SiteSummary } from "@internal/dashboard/webhooks";

export const metadata = {
  title: "New site",
  robots: { index: false, follow: false },
};

type NewSitePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewSitePage({ searchParams }: NewSitePageProps = {}) {
  const auth = await requireDashboardAuth();
  const billingBlocked = !auth.mutationsAllowed;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedDashboardLocale = getSingleSearchParam(resolvedSearchParams?.locale);
  const dashboardLocale = requestedDashboardLocale
    ? normalizeLocale(requestedDashboardLocale)
    : null;
  const locale =
    dashboardLocale ?? resolvePreferredLocale((await headers()).get("accept-language"));
  const pricingPath = `/${locale}/pricing`;
  const isNormalCustomer = isCustomerDashboardWorkspace(auth);
  let sites: SiteSummary[] = [];
  if (auth.webhooksAuth) {
    sites = await listSitesFresh(auth.webhooksAuth);
  }
  const workspace = resolveDashboardWebsiteWorkspaceState(auth, sites);
  if (isNormalCustomer && workspace.kind === "single_current_website" && workspace.currentSite) {
    redirect(withDashboardLocale(`/dashboard/sites/${workspace.currentSite.id}`, dashboardLocale));
  }
  if (isNormalCustomer && workspace.kind === "duplicate_current_websites") {
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
            <Link href={withDashboardLocale("/dashboard", dashboardLocale)}>Back to dashboard</Link>
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
  if (!workspace.canCreateSite) {
    const title = billingBlocked
      ? "Billing action required"
      : workspace.atSiteLimit
        ? "Site limit reached"
        : isNormalCustomer
          ? "Website creation is locked"
          : "Site creation is locked";
    const description = billingBlocked
      ? isNormalCustomer
        ? "Update billing to create your website workspace."
        : "Update billing to resume onboarding new sites."
      : workspace.atSiteLimit
        ? isNormalCustomer
          ? "This account already has a website. Open the existing workspace and use settings to change the source URL."
          : `Your plan allows ${workspace.maxSites} active site(s). Upgrade to add more.`
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
            <Link href={withDashboardLocale("/dashboard", dashboardLocale)}>Back to dashboard</Link>
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
        dashboardLocale={dashboardLocale}
      />
    </div>
  );
}

function getSingleSearchParam(value: string | string[] | undefined): string | null {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved?.trim() || null;
}
