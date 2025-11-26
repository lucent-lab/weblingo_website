import Link from "next/link";

import { getWebhooksToken } from "./_lib/webhooks-token";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listSites, type Site } from "@internal/dashboard/webhooks";

export default async function DashboardPage() {
  let sites: Site[] = [];
  let loadError: string | null = null;

  try {
    const { token } = await getWebhooksToken();
    sites = await listSites(token);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Unable to load sites from the webhooks worker.";
  }

  const activeSites = sites.filter((site) => site.status === "active").length;
  const unverifiedDomains = sites.reduce(
    (total, site) => total + site.domains.filter((domain) => domain.status !== "verified").length,
    0,
  );
  const totalLocales = sites.reduce((total, site) => total + site.locales.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
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
          <Button asChild>
            <Link href="/dashboard/sites/new">Add a site</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/sites">All sites</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Active sites" value={activeSites} helper="Ready for traffic" />
        <SummaryCard title="Unverified domains" value={unverifiedDomains} helper="Check DNS tokens" />
        <SummaryCard title="Configured locales" value={totalLocales} helper="Source + targets" />
      </div>

      {loadError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Could not load sites</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Check that <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_WEBHOOKS_API_BASE</code>{" "}
              is reachable and that your Supabase session is valid.
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
            <Button asChild>
              <Link href="/dashboard/sites/new">Start onboarding</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/developer-tools">View API docs</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your sites</CardTitle>
            <CardDescription>Quick view of active and in-progress properties.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sites.slice(0, 5).map((site) => (
              <div
                key={site.id}
                className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{site.sourceUrl}</p>
                    <StatusBadge status={site.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {site.locales.map((locale) => `${locale.sourceLang}→${locale.targetLang}`).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {site.domains.filter((d) => d.status === "verified").length} / {site.domains.length} domains
                  </Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/sites/${site.id}`}>Manage</Link>
                  </Button>
                </div>
              </div>
            ))}
            {sites.length > 5 ? (
              <div className="text-right">
                <Button asChild variant="link">
                  <Link href="/dashboard/sites">View all</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard(props: { title: string; value: number; helper: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{props.title}</CardDescription>
        <CardTitle className="text-3xl font-semibold">{props.value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{props.helper}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Site["status"] }) {
  if (status === "active") {
    return <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>;
  }

  return <Badge variant="outline">Inactive</Badge>;
}
