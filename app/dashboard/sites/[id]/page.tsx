import Link from "next/link";
import { notFound } from "next/navigation";

import {
  provisionDomainAction,
  refreshDomainAction,
  triggerCrawlAction,
  updateSiteStatusAction,
  verifyDomainAction,
} from "../../actions";
import { GlossaryEditor } from "./glossary-editor";
import { OverrideForm, SlugForm } from "./translation-forms";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchDeployments,
  fetchGlossary,
  fetchSite,
  type GlossaryEntry,
  type Deployment,
  type Site,
} from "@internal/dashboard/webhooks";
import { requireDashboardAuth } from "@internal/dashboard/auth";

type SitePageProps = {
  params: { id: string };
  searchParams?: {
    toast?: string | string[];
    error?: string | string[];
  };
};

export default async function SitePage({ params, searchParams }: SitePageProps) {
  const { id } = params;
  const toastMessage = decodeSearchParam(searchParams?.toast);
  const actionErrorMessage = decodeSearchParam(searchParams?.error);
  const auth = await requireDashboardAuth();
  const token = auth.webhooksToken!;

  let site: Site | null = null;
  let deployments: Deployment[] = [];
  let glossary: GlossaryEntry[] = [];
  let error: string | null = null;

  try {
    site = await fetchSite(token, id);
    deployments = await fetchDeployments(token, id);
    if (auth.has({ allFeatures: ["edit", "glossary"] })) {
      glossary = await fetchGlossary(token, id);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load site.";
  }

  if (!site) {
    if (error) {
      return (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load site</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-primary underline" href="/dashboard/sites">
              Back to sites
            </Link>
          </CardContent>
        </Card>
      );
    }
    notFound();
  }

  return (
    <div className="space-y-8">
      {actionErrorMessage ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionErrorMessage}{" "}
          <Link className="font-medium underline" href={`/dashboard/sites/${id}`}>
            Dismiss
          </Link>
        </div>
      ) : toastMessage ? (
        <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground">
          {toastMessage}{" "}
          <Link className="font-medium underline" href={`/dashboard/sites/${id}`}>
            Dismiss
          </Link>
        </div>
      ) : null}
      <Header site={site} canEdit={auth.has({ feature: "edit" })} />

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Source, languages, and route pattern captured from onboarding.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <InfoBlock label="Source URL" value={site.sourceUrl} />
          <InfoBlock
            label="Languages"
            value={site.locales
              .map((locale) => `${locale.sourceLang}→${locale.targetLang}`)
              .join(", ")}
          />
          <InfoBlock label="Route pattern" value={site.routeConfig?.pattern ?? "—"} />
          <InfoBlock
            label="Domains"
            value={`${site.domains.filter((d) => d.status === "verified").length} / ${
              site.domains.length
            } verified`}
          />
          <InfoBlock label="Profile" value={site.siteProfile ? "Provided" : "Not set"} />
        </CardContent>
      </Card>

      <DomainSection
        canManageDomains={auth.has({ allFeatures: ["edit", "domain_verify"] })}
        domains={site.domains}
        siteId={site.id}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {auth.has({ allFeatures: ["edit", "crawl_trigger"] }) ? (
          <Card>
            <CardHeader>
              <CardTitle>Trigger crawl</CardTitle>
              <CardDescription>Refresh translations from the source site.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <form action={triggerCrawlAction}>
                <input name="siteId" type="hidden" value={site.id} />
                <Button type="submit">Enqueue crawl</Button>
              </form>
              <p className="text-sm text-muted-foreground">
                Crawls use the latest route config and glossary. You will see deployment updates
                below after processing.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <DeploymentsCard deployments={deployments} />
      </div>

      {auth.has({ allFeatures: ["edit", "glossary"] }) ? (
        <Card>
          <CardHeader>
            <CardTitle>Glossary</CardTitle>
            <CardDescription>
              Maintain terminology control and optional retranslate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GlossaryEditor initialEntries={glossary} siteId={site.id} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {auth.has({ allFeatures: ["edit", "overrides"] }) ? (
          <OverrideForm siteId={site.id} />
        ) : null}
        {auth.has({ allFeatures: ["edit", "slug_edit"] }) ? <SlugForm siteId={site.id} /> : null}
      </div>
    </div>
  );
}

function decodeSearchParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function Header({ site, canEdit }: { site: Site; canEdit: boolean }) {
  const verifiedDomains = site.domains.filter((domain) => domain.status === "verified").length;
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-2xl font-semibold">{site.sourceUrl}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <StatusBadge status={site.status} />
            <span>{verifiedDomains} verified domain(s)</span>
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <form action={updateSiteStatusAction}>
              <input name="siteId" type="hidden" value={site.id} />
              <input
                name="status"
                type="hidden"
                value={site.status === "active" ? "inactive" : "active"}
              />
              <Button type="submit" variant="outline">
                {site.status === "active" ? "Pause translations" : "Activate translations"}
              </Button>
            </form>
          ) : null}
          <Button asChild variant="link">
            <Link href="/dashboard/sites">Back to list</Link>
          </Button>
        </div>
      </CardHeader>
    </Card>
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

function StatusBadge({ status }: { status: Site["status"] }) {
  if (status === "active") {
    return <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>;
  }
  return <Badge variant="outline">Inactive</Badge>;
}

function DomainSection({
  canManageDomains,
  domains,
  siteId,
}: {
  canManageDomains: boolean;
  domains: Site["domains"];
  siteId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Domains</CardTitle>
        <CardDescription>
          Configure DNS for each hostname, then run a provisioning check.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">No domains registered for this site yet.</p>
        ) : (
          domains.map((domain) => (
            <div
              key={domain.domain}
              className="grid gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 md:grid-cols-[2fr_1fr]"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-foreground">{domain.domain}</p>
                  <Badge variant={domain.status === "verified" ? "secondary" : "outline"}>
                    {domain.status}
                  </Badge>
                </div>
                {domain.dnsInstructions ? (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>
                      DNS record:{" "}
                      <code className="rounded bg-muted px-1 py-0.5">
                        {domain.dnsInstructions.type} {domain.dnsInstructions.name} →{" "}
                        {domain.dnsInstructions.target}
                      </code>
                    </p>
                    {domain.cloudflare ? (
                      <p>
                        Cloudflare:{" "}
                        <span className="font-mono text-foreground">
                          {domain.cloudflare.hostnameStatus ?? "unknown"} /{" "}
                          {domain.cloudflare.certStatus ?? "unknown"}
                        </span>
                      </p>
                    ) : null}
                    <p>
                      {domain.verifiedAt ? `Verified at ${domain.verifiedAt}` : "Not verified yet"}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p>
                      Verification token:{" "}
                      <code className="rounded bg-muted px-1 py-0.5">
                        {domain.verificationToken}
                      </code>
                    </p>
                    <p>
                      {domain.verifiedAt ? `Verified at ${domain.verifiedAt}` : "Not verified yet"}
                    </p>
                  </div>
                )}
              </div>
              {canManageDomains ? (
                domain.dnsInstructions ? (
                  <div className="flex flex-col gap-2 md:items-end">
                    <form action={provisionDomainAction}>
                      <input name="siteId" type="hidden" value={siteId} />
                      <input name="domain" type="hidden" value={domain.domain} />
                      <Button type="submit" variant="outline">
                        Provision
                      </Button>
                    </form>
                    <form action={refreshDomainAction}>
                      <input name="siteId" type="hidden" value={siteId} />
                      <input name="domain" type="hidden" value={domain.domain} />
                      <Button type="submit" variant="ghost">
                        Refresh
                      </Button>
                    </form>
                  </div>
                ) : (
                  <form action={verifyDomainAction} className="flex flex-col gap-2 md:items-end">
                    <input name="siteId" type="hidden" value={siteId} />
                    <input name="domain" type="hidden" value={domain.domain} />
                    <Input
                      aria-label="Test token (optional)"
                      className="w-full"
                      name="token"
                      placeholder="Test token (optional)"
                    />
                    <Button type="submit" variant="outline">
                      Check now
                    </Button>
                  </form>
                )
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function DeploymentsCard({ deployments }: { deployments: Deployment[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployments</CardTitle>
        <CardDescription>Per-locale status, deployment IDs, and route prefixes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {deployments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deployments reported yet.</p>
        ) : (
          deployments.map((deployment) => (
            <div
              key={`${deployment.targetLang}-${deployment.deploymentId}`}
              className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/30 p-3"
            >
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground">
                  {deployment.targetLang.toUpperCase()}
                </p>
                <Badge variant="outline">{deployment.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Deployment ID:{" "}
                <span className="font-mono text-foreground">{deployment.deploymentId}</span>
              </p>
              {deployment.activeDeploymentId ? (
                <p className="text-xs text-muted-foreground">
                  Active ID:{" "}
                  <span className="font-mono text-foreground">{deployment.activeDeploymentId}</span>
                </p>
              ) : null}
              {deployment.routePrefix ? (
                <p className="text-xs text-muted-foreground">
                  Route prefix: {deployment.routePrefix}
                </p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
