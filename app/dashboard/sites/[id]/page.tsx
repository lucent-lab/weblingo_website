import Link from "next/link";
import { notFound } from "next/navigation";

import { getWebhooksToken } from "../../_lib/webhooks-token";
import { triggerCrawlAction, updateSiteStatusAction, verifyDomainAction } from "../../actions";
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

type SitePageProps = {
  params: { id: string };
};

export default async function SitePage({ params }: SitePageProps) {
  const { id } = params;
  const { token } = await getWebhooksToken();

  let site: Site | null = null;
  let deployments: Deployment[] = [];
  let glossary: GlossaryEntry[] = [];
  let error: string | null = null;

  try {
    site = await fetchSite(token, id);
    deployments = await fetchDeployments(token, id);
    glossary = await fetchGlossary(token, id);
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
      <Header site={site} />

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
            value={site.locales.map((locale) => `${locale.sourceLang}→${locale.targetLang}`).join(", ")}
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

      <DomainSection domains={site.domains} siteId={site.id} />

      <div className="grid gap-4 md:grid-cols-2">
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
              Crawls use the latest route config and glossary. You will see deployment updates below
              after processing.
            </p>
          </CardContent>
        </Card>

        <DeploymentsCard deployments={deployments} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Glossary</CardTitle>
          <CardDescription>Maintain terminology control and optional retranslate.</CardDescription>
        </CardHeader>
        <CardContent>
          <GlossaryEditor initialEntries={glossary} siteId={site.id} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <OverrideForm siteId={site.id} />
        <SlugForm siteId={site.id} />
      </div>
    </div>
  );
}

function Header({ site }: { site: Site }) {
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
        <form action={updateSiteStatusAction} className="flex items-center gap-2">
          <input name="siteId" type="hidden" value={site.id} />
          <input
            name="status"
            type="hidden"
            value={site.status === "active" ? "inactive" : "active"}
          />
          <Button type="submit" variant="outline">
            {site.status === "active" ? "Pause translations" : "Activate translations"}
          </Button>
          <Button asChild variant="link">
            <Link href="/dashboard/sites">Back to list</Link>
          </Button>
        </form>
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

function DomainSection({ domains, siteId }: { domains: Site["domains"]; siteId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Domains</CardTitle>
        <CardDescription>
          Copy the verification token into a DNS TXT record, then run a check.
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
                <p className="text-xs text-muted-foreground">
                  Verification token: <code className="rounded bg-muted px-1 py-0.5">{domain.verificationToken}</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  {domain.verifiedAt ? `Verified at ${domain.verifiedAt}` : "Not verified yet"}
                </p>
              </div>
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
                <p className="font-semibold text-foreground">{deployment.targetLang.toUpperCase()}</p>
                <Badge variant="outline">{deployment.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Deployment ID: <span className="font-mono text-foreground">{deployment.deploymentId}</span>
              </p>
              {deployment.activeDeploymentId ? (
                <p className="text-xs text-muted-foreground">
                  Active ID: <span className="font-mono text-foreground">{deployment.activeDeploymentId}</span>
                </p>
              ) : null}
              {deployment.routePrefix ? (
                <p className="text-xs text-muted-foreground">Route prefix: {deployment.routePrefix}</p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
