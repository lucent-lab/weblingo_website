import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SitesList } from "./_components/sites-list";
import { listSites, type Site } from "@internal/dashboard/webhooks";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { i18nConfig } from "@internal/i18n";

export default async function DashboardPage() {
  let sites: Site[] = [];
  let loadError: string | null = null;
  let canCreateSite = false;
  let billingBlocked = false;
  let atSiteLimit = false;
  let maxSites: number | null = null;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;

  try {
    const auth = await requireDashboardAuth();
    sites = await listSites(auth.webhooksAuth!);
    billingBlocked = !auth.mutationsAllowed;
    maxSites = auth.account?.featureFlags.maxSites ?? null;
    const activeSites = sites.filter((site) => site.status === "active").length;
    const hasAvailableSlot = maxSites === null || activeSites < maxSites;
    atSiteLimit = maxSites !== null && activeSites >= maxSites;
    canCreateSite = auth.has({ feature: "site_create" }) && !billingBlocked && hasAvailableSlot;
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Unable to load sites from the webhooks worker.";
  }

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
        <div className="flex flex-wrap gap-3">
          {canCreateSite ? (
            <Button asChild>
              <Link href="/dashboard/sites/new">Add a site</Link>
            </Button>
          ) : billingBlocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled variant="outline">
                Add a site
              </Button>
              <Button asChild variant="secondary">
                <Link href={pricingPath}>Update billing</Link>
              </Button>
            </div>
          ) : atSiteLimit ? (
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
      </div>

      {loadError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Could not load sites</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Check that{" "}
              <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_WEBHOOKS_API_BASE</code> is
              reachable and that your Supabase session is valid.
            </p>
          </CardContent>
        </Card>
      ) : sites.length === 0 ? (
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
      ) : (
        <SitesList sites={sites} />
      )}
    </div>
  );
}
