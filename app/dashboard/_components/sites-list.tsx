import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SiteSummary } from "@internal/dashboard/webhooks";

export function SitesList({ sites }: { sites: SiteSummary[] }) {
  return (
    <div className="grid gap-4">
      {sites.map((site) => (
        <Card key={site.id}>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold">{site.sourceUrl}</CardTitle>
                <StatusBadge status={site.status} />
              </div>
              <CardDescription>{renderLanguageDescription(site)}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Domains: {site.verifiedDomainCount} / {site.domainCount}
              </Badge>
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/sites/${site.id}`} prefetch={false} title="Manage">
                  Manage
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 md:items-start">
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">Languages</p>
              <p className="text-muted-foreground">
                {site.localeCount} locale(s), {site.serveEnabledLocaleCount} serving enabled
              </p>
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">Serving mode</p>
              <p className="text-muted-foreground">{site.servingMode}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: SiteSummary["status"] }) {
  if (status === "active") {
    return <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>;
  }

  return <Badge variant="outline">Inactive</Badge>;
}

function renderLanguageDescription(site: SiteSummary): string {
  if (site.targetLangs.length > 0) {
    return site.sourceLang
      ? `${site.sourceLang}→${site.targetLangs.join(" · ")}`
      : site.targetLangs.join(" · ");
  }

  return site.sourceLang ?? "No target languages";
}
