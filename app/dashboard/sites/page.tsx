import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listSites, type Site } from "@internal/dashboard/webhooks";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { i18nConfig } from "@internal/i18n";

export default async function SitesPage() {
  let sites: Site[] = [];
  let error: string | null = null;
  let canCreateSite = false;
  let billingBlocked = false;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;

  try {
    const auth = await requireDashboardAuth();
    sites = await listSites(auth.webhooksAuth!);
    billingBlocked = !auth.mutationsAllowed;
    canCreateSite = auth.has({ feature: "site_create" }) && !billingBlocked;
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
        <div className="grid gap-4">
          {sites.map((site) => (
            <Card key={site.id}>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-semibold">{site.sourceUrl}</CardTitle>
                    <StatusBadge status={site.status} />
                  </div>
                  <CardDescription>
                    {site.locales
                      .map((locale) => `${locale.sourceLang}→${locale.targetLang}`)
                      .join(" · ")}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    Domains: {site.domains.filter((domain) => domain.status === "verified").length}{" "}
                    / {site.domains.length}
                  </Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/sites/${site.id}`}>Manage</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-[2fr_1fr] md:items-start">
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-foreground">Domains</p>
                  <div className="flex flex-wrap gap-2">
                    {site.domains.map((domain) => (
                      <Badge
                        key={domain.domain}
                        variant={domain.status === "verified" ? "secondary" : "outline"}
                      >
                        {domain.domain} ({domain.status})
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-foreground">Route config</p>
                  <p className="text-muted-foreground">
                    {site.routeConfig?.pattern ?? "No subdomain pattern recorded"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Site["status"] }) {
  if (status === "active") {
    return <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>;
  }

  return <Badge variant="outline">Inactive</Badge>;
}
