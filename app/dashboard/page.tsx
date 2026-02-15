import Link from "next/link";
import { Suspense, cache } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SitesList } from "./_components/sites-list";
import { requireDashboardAuth, type DashboardAuth } from "@internal/dashboard/auth";
import { listSitesCached } from "@internal/dashboard/data";
import { i18nConfig } from "@internal/i18n";
import type { SiteSummary } from "@internal/dashboard/webhooks";

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

export default async function DashboardPage() {
  const auth = await requireDashboardAuth();
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Welcome back. Set up a new site or check deployment health.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Supabase auth</Badge>
            <Badge variant="outline">Worker API</Badge>
            <Badge variant="outline">Human-friendly UX</Badge>
          </div>
        </div>
        <Suspense fallback={<OverviewActionsSkeleton />}>
          <OverviewActions auth={auth} pricingPath={pricingPath} />
        </Suspense>
      </div>

      <Suspense fallback={<OverviewSitesSkeleton />}>
        <OverviewSites auth={auth} pricingPath={pricingPath} />
      </Suspense>
    </div>
  );
}

async function OverviewActions({
  auth,
  pricingPath,
}: {
  auth: DashboardAuth;
  pricingPath: string;
}) {
  const data = await getOverviewData(auth).catch((error) => {
    console.warn("[dashboard] overview actions failed:", error);
    return null;
  });

  if (!data) {
    return (
      <div className="flex flex-wrap gap-3">
        <Button disabled variant="outline">
          Add a site
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/sites">All sites</Link>
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
      <Button asChild variant="outline">
        <Link href="/dashboard/sites">All sites</Link>
      </Button>
    </div>
  );
}

async function OverviewSites({ auth, pricingPath }: { auth: DashboardAuth; pricingPath: string }) {
  let sites: SiteSummary[] = [];
  let canCreateSite = false;
  let billingBlocked = false;

  try {
    const data = await getOverviewData(auth);
    sites = data.sites;
    canCreateSite = data.canCreateSite;
    billingBlocked = data.billingBlocked;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load sites from the webhooks worker.";
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Could not load sites</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Check that{" "}
            <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_WEBHOOKS_API_BASE</code> is
            reachable and that your Supabase session is valid.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (sites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Get set up in minutes</CardTitle>
          <CardDescription>
            Connect your source site, choose target languages, and verify your domains.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {canCreateSite ? (
            <Button asChild>
              <Link href="/dashboard/sites/new">Start onboarding</Link>
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

  return <SitesList sites={sites} />;
}

function OverviewActionsSkeleton() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button disabled variant="outline">
        Add a site
      </Button>
      <Button disabled variant="outline">
        All sites
      </Button>
    </div>
  );
}

function OverviewSitesSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="h-28 animate-pulse rounded-lg border border-border/60 bg-muted/40" />
      <div className="h-28 animate-pulse rounded-lg border border-border/60 bg-muted/40" />
    </div>
  );
}
