import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listSites, type Site } from "@internal/dashboard/webhooks";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { i18nConfig } from "@internal/i18n";
import { SitesList } from "../_components/sites-list";

export default async function SitesPage() {
  let sites: Site[] = [];
  let error: string | null = null;
  let canCreateSite = false;
  let billingBlocked = false;
  let atSiteLimit = false;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;

  try {
    const auth = await requireDashboardAuth();
    sites = await listSites(auth.webhooksAuth!);
    billingBlocked = !auth.mutationsAllowed;
    const maxSites = auth.account?.featureFlags.maxSites ?? null;
    const activeSites = sites.filter((site) => site.status === "active").length;
    const hasAvailableSlot = maxSites === null || activeSites < maxSites;
    atSiteLimit = maxSites !== null && activeSites >= maxSites;
    canCreateSite = auth.has({ feature: "site_create" }) && !billingBlocked && hasAvailableSlot;
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load sites.";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Sites</h2>
          <p className="text-sm text-muted-foreground">
            Review onboarding status, domains, and languages for every property.
          </p>
        </div>
        {canCreateSite ? (
          <Button asChild>
            <Link href="/dashboard/sites/new">Add a site</Link>
          </Button>
        ) : billingBlocked ? (
          <Button asChild variant="secondary">
            <Link href={pricingPath}>Update billing</Link>
          </Button>
        ) : atSiteLimit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled>Add a site</Button>
            <Button asChild variant="secondary">
              <Link href={pricingPath}>Upgrade for more sites</Link>
            </Button>
          </div>
        ) : (
          <Button asChild variant="secondary">
            <Link href={pricingPath}>Upgrade to add a site</Link>
          </Button>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Could not load sites</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : sites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sites yet</CardTitle>
            <CardDescription>
              Start with the onboarding wizard to set up your first site.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canCreateSite ? (
              <Button asChild>
                <Link href="/dashboard/sites/new">Start onboarding</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <SitesList sites={sites} />
      )}
    </div>
  );
}
