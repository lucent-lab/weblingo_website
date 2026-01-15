import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { listSitesCached } from "@internal/dashboard/data";

export const metadata = {
  title: "Ops",
  robots: { index: false, follow: false },
};

export default async function OpsPage() {
  const auth = await requireDashboardAuth();
  const canAccessOps = auth.has({ feature: "internal_ops" });
  if (!canAccessOps) {
    notFound();
  }
  const authToken = auth.webhooksAuth;
  if (!authToken) {
    notFound();
  }
  const sites = await listSitesCached(authToken);
  const activeSites = sites.filter((site) => site.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Ops</h2>
        <p className="text-sm text-muted-foreground">
          Internal operations view. Use site pages to resume or retry translation runs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fleet summary</CardTitle>
          <CardDescription>Quick snapshot of sites under this account.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <InfoBlock label="Total sites" value={`${sites.length}`} />
          <InfoBlock label="Active sites" value={`${activeSites}`} />
          <InfoBlock label="Inactive sites" value={`${sites.length - activeSites}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <CardDescription>Source, status, and latest crawl info.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sites found.</p>
          ) : (
            sites.map((site) => {
              const label =
                typeof site.siteProfile?.label === "string"
                  ? (site.siteProfile.label as string)
                  : site.sourceUrl;
              const latest = site.latestCrawlRun;
              const latestLabel = latest
                ? latest.pagesDiscovered == null
                  ? `${latest.status}`
                  : `${latest.status} · ${latest.pagesDiscovered} discovered`
                : "—";
              return (
                <div key={site.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <Badge variant={site.status === "active" ? "secondary" : "outline"}>
                      {site.status}
                    </Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                    <InfoRow label="Site ID" value={site.id} />
                    <InfoRow label="Source URL" value={site.sourceUrl} />
                    <InfoRow
                      label="Locales"
                      value={`${site.locales.length} (${site.locales
                        .map((locale) => locale.targetLang)
                        .join(", ")})`}
                    />
                    <InfoRow
                      label="Latest crawl"
                      value={latestLabel}
                    />
                    <InfoRow
                      label="Last crawl update"
                      value={latest?.updatedAt ? formatTimestamp(latest.updatedAt) : "—"}
                    />
                    <InfoRow
                      label="Domains"
                      value={`${site.domains.filter((d) => d.status === "verified").length} / ${
                        site.domains.length
                      } verified`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-semibold text-foreground">{label}:</span> <span>{value}</span>
    </div>
  );
}

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString();
}
