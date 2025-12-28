import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Site } from "@internal/dashboard/webhooks";

export function SitesList({ sites }: { sites: Site[] }) {
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
              <CardDescription>
                {site.locales
                  .map((locale) => `${locale.sourceLang}→${locale.targetLang}`)
                  .join(" · ")}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Domains: {site.domains.filter((domain) => domain.status === "verified").length} /{" "}
                {site.domains.length}
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
  );
}

function StatusBadge({ status }: { status: Site["status"] }) {
  if (status === "active") {
    return <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>;
  }

  return <Badge variant="outline">Inactive</Badge>;
}
