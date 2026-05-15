import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { DashboardRetryButton } from "@/components/dashboard/retry-button";
import { SitesList } from "./_components/sites-list";
import { requireDashboardAuth, type DashboardAuth } from "@internal/dashboard/auth";
import { listSitesCached } from "@internal/dashboard/data";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import { resolveDashboardOnboardingState } from "@internal/dashboard/onboarding-state";
import { isCustomerDashboardWorkspace } from "@internal/dashboard/workspace";
import { resolveLocaleTranslator, resolvePreferredLocale } from "@internal/i18n";

const getOverviewData = cache(async (auth: DashboardAuth) => {
  if (!auth.webhooksAuth) {
    throw new Error("Webhooks authentication is unavailable.");
  }
  const sites = await listSitesCached(auth.webhooksAuth);
  const billingBlocked = !auth.mutationsAllowed;
  const maxSites = auth.account?.featureFlags.maxSites ?? null;
  const activeSites = sites.filter((site) => site.status === "active").length;
  const hasAvailableSlot = maxSites === null || activeSites < maxSites;
  const atSiteLimit = maxSites !== null && activeSites >= maxSites;
  const canCreateSite = auth.has({ feature: "site_create" }) && !billingBlocked && hasAvailableSlot;
  return {
    sites,
    billingBlocked,
    maxSites,
    atSiteLimit,
    canCreateSite,
  };
});

type OverviewData = Awaited<ReturnType<typeof getOverviewData>>;

export default async function DashboardPage() {
  const auth = await requireDashboardAuth();
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const onboardingState = resolveDashboardOnboardingState(auth, t);
  const pricingPath = `/${locale}/pricing`;
  const normalCustomerDashboard = isCustomerDashboardWorkspace(auth);
  let overviewData: OverviewData | null = null;
  let overviewError: unknown = null;

  try {
    overviewData = await getOverviewData(auth);
  } catch (error) {
    overviewError = error;
  }

  if (normalCustomerDashboard && overviewData?.sites.length === 1) {
    redirect(`/dashboard/sites/${overviewData.sites[0]!.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {normalCustomerDashboard
              ? "Manage your WebLingo website workspace."
              : "Welcome back. Set up a new site or check deployment health."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Supabase auth</Badge>
            <Badge variant="outline">Worker API</Badge>
            <Badge variant="outline">Human-friendly UX</Badge>
          </div>
        </div>
        <OverviewActions
          data={overviewData}
          pricingPath={pricingPath}
          normalCustomerDashboard={normalCustomerDashboard}
        />
      </div>

      {onboardingState.stage === "claimed_free_account" ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{onboardingState.title}</CardTitle>
              <CardDescription>{onboardingState.description}</CardDescription>
            </div>
            <Badge variant="outline">{onboardingState.badge}</Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard/sites/new">Create website</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={pricingPath}>Review pricing</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {overviewData ? (
        <OverviewSites
          data={overviewData}
          pricingPath={pricingPath}
          normalCustomerDashboard={normalCustomerDashboard}
        />
      ) : (
        <OverviewSitesError error={overviewError} />
      )}
    </div>
  );
}

function OverviewActions({
  data,
  pricingPath,
  normalCustomerDashboard,
}: {
  data: OverviewData | null;
  pricingPath: string;
  normalCustomerDashboard: boolean;
}) {
  if (!data) {
    return (
      <Button disabled variant="outline">
        {normalCustomerDashboard ? "Create website" : "Add a site"}
      </Button>
    );
  }

  if (normalCustomerDashboard) {
    if (data.sites.length === 0 && data.canCreateSite) {
      return (
        <Button asChild>
          <Link href="/dashboard/sites/new">Create website</Link>
        </Button>
      );
    }
    if (data.billingBlocked) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled variant="outline">
            Create website
          </Button>
          <Button asChild variant="secondary">
            <Link href={pricingPath}>Update billing</Link>
          </Button>
        </div>
      );
    }
    if (data.sites.length > 0) {
      return (
        <Button asChild variant="secondary">
          <Link href={`/dashboard/sites/${data.sites[0]!.id}`}>Open website</Link>
        </Button>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled variant="outline">
          Create website
        </Button>
        <Button asChild variant="secondary">
          <Link href={pricingPath}>Review plan</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {data.canCreateSite ? (
        <Button asChild>
          <Link href="/dashboard/sites/new">Add a site</Link>
        </Button>
      ) : data.billingBlocked ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled variant="outline">
            Add a site
          </Button>
          <Button asChild variant="secondary">
            <Link href={pricingPath}>Update billing</Link>
          </Button>
        </div>
      ) : data.atSiteLimit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled variant="outline">
            Add a site
          </Button>
          <Button asChild variant="secondary">
            <Link href={pricingPath}>Upgrade for more sites</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled variant="outline">
            Add a site
          </Button>
          <Button asChild variant="secondary">
            <Link href={pricingPath}>Upgrade to unlock</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function OverviewSites({
  data,
  pricingPath,
  normalCustomerDashboard,
}: {
  data: OverviewData;
  pricingPath: string;
  normalCustomerDashboard: boolean;
}) {
  const { sites, canCreateSite, billingBlocked } = data;

  if (sites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {normalCustomerDashboard ? "Create your website workspace" : "Get set up in minutes"}
          </CardTitle>
          <CardDescription>
            {normalCustomerDashboard
              ? "One WebLingo account and subscription are tied to one website. Use settings later if the source URL changes."
              : "Connect your source site, choose target languages, and verify your domains."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {canCreateSite ? (
            <Button asChild>
              <Link href="/dashboard/sites/new">
                {normalCustomerDashboard ? "Create website" : "Start onboarding"}
              </Link>
            </Button>
          ) : billingBlocked ? (
            <Button asChild variant="secondary">
              <Link href={pricingPath}>Update billing</Link>
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <Link href={pricingPath}>Upgrade to start onboarding</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/dashboard/developer-tools">View API docs</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (normalCustomerDashboard) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Website workspace needs review</CardTitle>
          <CardDescription>
            This account has more than one website record. Open the current workspace or contact
            support so we can reconcile the account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/dashboard/sites/${sites[0]!.id}`}>Open website</Link>
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

  return <SitesList sites={sites} />;
}

function OverviewSitesError({ error }: { error: unknown }) {
  const errorView = resolveDashboardErrorView(error, {
    title: "Could not load sites",
    description:
      "We could not load your site list. Existing sites and translations are not changed.",
    message: "Unable to load your dashboard sites.",
  });
  return (
    <ErrorStateCard
      title={errorView.title}
      description={errorView.description}
      message={errorView.message}
      nextSteps={errorView.nextSteps}
      referenceCode={errorView.referenceCode}
      technicalDetails={errorView.technicalDetails}
      actions={
        <>
          <DashboardRetryButton href="/dashboard" label="Retry dashboard" />
          <Button asChild variant="outline">
            <a href="mailto:contact@weblingo.app?subject=Dashboard%20sites%20unavailable">
              Contact support
            </a>
          </Button>
        </>
      }
    />
  );
}
