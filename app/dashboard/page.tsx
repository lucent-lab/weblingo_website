import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalyticsTrackedLink } from "@/components/analytics-tracked-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { DashboardRetryButton } from "@/components/dashboard/retry-button";
import { ANALYTICS_EVENTS } from "@internal/analytics/events";
import { SitesList } from "./_components/sites-list";
import { requireDashboardAuth, type DashboardAuth } from "@internal/dashboard/auth";
import { listSitesFresh } from "@internal/dashboard/data";
import { getDashboardDemoSiteId } from "@internal/dashboard/demo-scope";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import { withDashboardLocale } from "@internal/dashboard/locale-url";
import { resolveDashboardOnboardingState } from "@internal/dashboard/onboarding-state";
import {
  isCustomerDashboardWorkspace,
  resolveDashboardWebsiteWorkspaceState,
} from "@internal/dashboard/workspace";
import { normalizeLocale, resolveLocaleTranslator, resolvePreferredLocale } from "@internal/i18n";

const getOverviewData = cache(async (auth: DashboardAuth) => {
  if (!auth.webhooksAuth) {
    throw new Error("Webhooks authentication is unavailable.");
  }
  const sites = await listSitesFresh(auth.webhooksAuth);
  const workspace = resolveDashboardWebsiteWorkspaceState(auth, sites);
  return {
    sites,
    workspace,
  };
});

type OverviewData = Awaited<ReturnType<typeof getOverviewData>>;

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps = {}) {
  const auth = await requireDashboardAuth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedDashboardLocale = getSingleSearchParam(resolvedSearchParams?.locale);
  const dashboardLocale = requestedDashboardLocale
    ? normalizeLocale(requestedDashboardLocale)
    : null;
  if (auth.accessMode === "demo") {
    const demoSiteId = getDashboardDemoSiteId(auth);
    if (!demoSiteId) {
      throw new Error("Demo dashboard session is missing site scope.");
    }
    redirect(withDashboardLocale(`/dashboard/sites/${demoSiteId}`, dashboardLocale));
  }
  const locale =
    dashboardLocale ?? resolvePreferredLocale((await headers()).get("accept-language"));
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

  if (
    normalCustomerDashboard &&
    overviewData?.workspace.kind === "single_current_website" &&
    overviewData.workspace.currentSite
  ) {
    redirect(
      withDashboardLocale(
        `/dashboard/sites/${overviewData.workspace.currentSite.id}`,
        dashboardLocale,
      ),
    );
  }
  const showClaimedFreeOnboarding =
    onboardingState.stage === "claimed_free_account" &&
    overviewData !== null &&
    !(normalCustomerDashboard && overviewData.workspace.activeSites.length > 0);

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
          dashboardLocale={dashboardLocale}
        />
      </div>

      {showClaimedFreeOnboarding ? (
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
              <Link href={withDashboardLocale("/dashboard/sites/new", dashboardLocale)}>
                Create website
              </Link>
            </Button>
            <Button asChild variant="outline">
              <DashboardUpgradeLink
                ctaId="dashboard_claimed_free_review_pricing"
                href={pricingPath}
              >
                Review pricing
              </DashboardUpgradeLink>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {overviewData ? (
        <OverviewSites
          data={overviewData}
          pricingPath={pricingPath}
          normalCustomerDashboard={normalCustomerDashboard}
          dashboardLocale={dashboardLocale}
        />
      ) : (
        <OverviewSitesError error={overviewError} />
      )}
    </div>
  );
}

function getSingleSearchParam(value: string | string[] | undefined): string | null {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved?.trim() || null;
}

function OverviewActions({
  data,
  pricingPath,
  normalCustomerDashboard,
  dashboardLocale,
}: {
  data: OverviewData | null;
  pricingPath: string;
  normalCustomerDashboard: boolean;
  dashboardLocale: string | null;
}) {
  const newSitePath = withDashboardLocale("/dashboard/sites/new", dashboardLocale);
  if (!data) {
    return (
      <Button disabled variant="outline">
        {normalCustomerDashboard ? "Create website" : "Add a site"}
      </Button>
    );
  }

  if (normalCustomerDashboard) {
    if (data.workspace.kind === "duplicate_current_websites") {
      return (
        <Button asChild variant="secondary">
          <a href="mailto:contact@weblingo.app?subject=Dashboard%20website%20workspace%20review">
            Contact support
          </a>
        </Button>
      );
    }
    if (data.workspace.kind === "no_current_website" && data.workspace.canCreateSite) {
      return (
        <Button asChild>
          <Link href={newSitePath}>Create website</Link>
        </Button>
      );
    }
    if (data.workspace.billingBlocked) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled variant="outline">
            Create website
          </Button>
          <Button asChild variant="secondary">
            <DashboardUpgradeLink ctaId="dashboard_create_site_update_billing" href={pricingPath}>
              Update billing
            </DashboardUpgradeLink>
          </Button>
        </div>
      );
    }
    if (data.workspace.kind === "single_current_website" && data.workspace.currentSite) {
      return (
        <Button asChild variant="secondary">
          <Link
            href={withDashboardLocale(
              `/dashboard/sites/${data.workspace.currentSite.id}`,
              dashboardLocale,
            )}
          >
            Open website
          </Link>
        </Button>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled variant="outline">
          Create website
        </Button>
        <Button asChild variant="secondary">
          <DashboardUpgradeLink ctaId="dashboard_create_site_review_plan" href={pricingPath}>
            Review plan
          </DashboardUpgradeLink>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {data.workspace.canCreateSite ? (
        <Button asChild>
          <Link href={newSitePath}>Add a site</Link>
        </Button>
      ) : data.workspace.billingBlocked ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled variant="outline">
            Add a site
          </Button>
          <Button asChild variant="secondary">
            <DashboardUpgradeLink ctaId="dashboard_add_site_update_billing" href={pricingPath}>
              Update billing
            </DashboardUpgradeLink>
          </Button>
        </div>
      ) : data.workspace.atSiteLimit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled variant="outline">
            Add a site
          </Button>
          <Button asChild variant="secondary">
            <DashboardUpgradeLink ctaId="dashboard_site_limit_upgrade" href={pricingPath}>
              Upgrade for more sites
            </DashboardUpgradeLink>
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled variant="outline">
            Add a site
          </Button>
          <Button asChild variant="secondary">
            <DashboardUpgradeLink ctaId="dashboard_add_site_upgrade_unlock" href={pricingPath}>
              Upgrade to unlock
            </DashboardUpgradeLink>
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
  dashboardLocale,
}: {
  data: OverviewData;
  pricingPath: string;
  normalCustomerDashboard: boolean;
  dashboardLocale: string | null;
}) {
  const { sites, workspace } = data;
  const currentSites = normalCustomerDashboard ? workspace.activeSites : sites;

  if (currentSites.length === 0) {
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
          {workspace.canCreateSite ? (
            <Button asChild>
              <Link href={withDashboardLocale("/dashboard/sites/new", dashboardLocale)}>
                {normalCustomerDashboard ? "Create website" : "Start onboarding"}
              </Link>
            </Button>
          ) : workspace.billingBlocked ? (
            <Button asChild variant="secondary">
              <DashboardUpgradeLink ctaId="dashboard_empty_update_billing" href={pricingPath}>
                Update billing
              </DashboardUpgradeLink>
            </Button>
          ) : (
            <Button asChild variant="secondary">
              <DashboardUpgradeLink ctaId="dashboard_empty_upgrade_onboarding" href={pricingPath}>
                Upgrade to start onboarding
              </DashboardUpgradeLink>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={withDashboardLocale("/dashboard/developer-tools", dashboardLocale)}>
              View API docs
            </Link>
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
            This account has more than one active website record. Contact support so we can
            reconcile the account before routing to a workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
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

function DashboardUpgradeLink({
  children,
  ctaId,
  href,
}: {
  children: string;
  ctaId: string;
  href: string;
}) {
  return (
    <AnalyticsTrackedLink
      analyticsProperties={{
        cta_id: ctaId,
        route_template: "/dashboard",
        page_type: "dashboard",
        feature: "quota_upgrade",
        outcome: "clicked",
        app_surface: "dashboard",
      }}
      event={ANALYTICS_EVENTS.upgradeCtaClicked}
      href={href}
    >
      {children}
    </AnalyticsTrackedLink>
  );
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
