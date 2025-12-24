import Link from "next/link";
import { notFound } from "next/navigation";

import {
  provisionDomainAction,
  refreshDomainAction,
  triggerCrawlAction,
  triggerPageCrawlAction,
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
  fetchSitePages,
  type GlossaryEntry,
  type Deployment,
  type Site,
  type SitePageSummary,
} from "@internal/dashboard/webhooks";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { i18nConfig } from "@internal/i18n";

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
  const authToken = auth.webhooksAuth!;
  const mutationsAllowed = auth.mutationsAllowed;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;
  const canEdit = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canGlossary = auth.has({ allFeatures: ["edit", "glossary"] }) && mutationsAllowed;
  const canOverrides = auth.has({ allFeatures: ["edit", "overrides"] }) && mutationsAllowed;
  const canSlugs = auth.has({ allFeatures: ["edit", "slug_edit"] }) && mutationsAllowed;
  const canCrawl = auth.has({ allFeatures: ["edit", "crawl_trigger"] }) && mutationsAllowed;
  const canDomains = auth.has({ allFeatures: ["edit", "domain_verify"] }) && mutationsAllowed;
  const lockCtaLabel = mutationsAllowed ? "Upgrade plan" : "Update billing";
  const lockBadgeLabel = mutationsAllowed ? "Locked" : "Billing issue";

  let site: Site | null = null;
  let deployments: Deployment[] = [];
  let glossary: GlossaryEntry[] = [];
  let pages: SitePageSummary[] = [];
  let error: string | null = null;

  try {
    site = await fetchSite(authToken, id);
    deployments = await fetchDeployments(authToken, id);
    pages = await fetchSitePages(authToken, id);
    if (canGlossary) {
      glossary = await fetchGlossary(authToken, id);
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

  const targetLangs = Array.from(new Set(site.locales.map((locale) => locale.targetLang)));
  const hasVerifiedDomain = site.domains.some((domain) => domain.status === "verified");
  const crawlReady = site.status === "active" && hasVerifiedDomain;
  const crawlGateNote = crawlReady
    ? "Crawls use the latest route config and glossary. You will see deployment updates below after processing."
    : "Activate the site and verify at least one domain to start crawling.";

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
      <Header site={site} canEdit={canEdit} mutationsAllowed={mutationsAllowed} />

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

      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <CardDescription>
            Discovered pages from sitemaps and crawls. Activate and verify a domain before
            triggering a new crawl.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pages discovered yet. We will seed from sitemaps after validation, then crawl to
              refresh once the site is active.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Page</th>
                    <th className="px-3 py-2 text-left">Last crawled</th>
                    <th className="px-3 py-2 text-left">Last update</th>
                    {canCrawl ? <th className="px-3 py-2 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.id} className="border-t border-border/50">
                      <td className="px-3 py-3 align-top">
                        <span className="rounded bg-muted/60 px-2 py-1 font-mono text-xs text-foreground">
                          {page.sourcePath}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-muted-foreground">
                        {formatTimestamp(page.lastSeenAt)}
                      </td>
                      <td className="px-3 py-3 align-top text-muted-foreground">
                        {formatTimestamp(page.lastVersionAt)}
                      </td>
                      {canCrawl ? (
                        <td className="px-3 py-3 text-right align-top">
                          <form action={triggerPageCrawlAction}>
                            <input name="siteId" type="hidden" value={site.id} />
                            <input name="pageId" type="hidden" value={page.id} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              disabled={!crawlReady}
                              title={
                                crawlReady
                                  ? "Enqueue a crawl for this page."
                                  : "Activate the site and verify a domain to crawl."
                              }
                            >
                              Force crawl
                            </Button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <DomainSection
        canManageDomains={canDomains}
        domains={site.domains}
        siteId={site.id}
        pricingPath={pricingPath}
        lockCtaLabel={lockCtaLabel}
        lockBadgeLabel={lockBadgeLabel}
        billingBlocked={!mutationsAllowed}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {canCrawl ? (
          <Card>
            <CardHeader>
              <CardTitle>Trigger crawl</CardTitle>
              <CardDescription>
                Refresh translations from the source site once the site is active and verified.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <form action={triggerCrawlAction}>
                <input name="siteId" type="hidden" value={site.id} />
                <Button
                  type="submit"
                  disabled={!crawlReady}
                  title={
                    crawlReady
                      ? "Enqueue a full-site crawl."
                      : "Activate the site and verify a domain to crawl."
                  }
                >
                  Enqueue crawl
                </Button>
              </form>
              <p className="text-sm text-muted-foreground">{crawlGateNote}</p>
            </CardContent>
          </Card>
        ) : (
          <LockedFeatureCard
            title="Trigger crawl"
            description={
              mutationsAllowed
                ? "Unlock manual crawl triggers to refresh translations on demand."
                : "Update billing to resume manual crawl triggers."
            }
            pricingPath={pricingPath}
            ctaLabel={lockCtaLabel}
            badgeLabel={lockBadgeLabel}
          />
        )}

        <DeploymentsCard deployments={deployments} />
      </div>

      {canGlossary ? (
        <Card>
          <CardHeader>
            <CardTitle>Glossary</CardTitle>
            <CardDescription>
              Maintain terminology control and optional retranslate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GlossaryEditor initialEntries={glossary} siteId={site.id} targetLangs={targetLangs} />
          </CardContent>
        </Card>
      ) : (
        <LockedFeatureCard
          title="Glossary"
          description={
            mutationsAllowed
              ? "Upgrade to manage glossary entries and keep terminology consistent."
              : "Update billing to resume glossary management."
          }
          pricingPath={pricingPath}
          ctaLabel={lockCtaLabel}
          badgeLabel={lockBadgeLabel}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {canOverrides ? (
          <OverrideForm siteId={site.id} />
        ) : (
          <LockedFeatureCard
            title="Manual overrides"
            description={
              mutationsAllowed
                ? "Upgrade to override individual translations."
                : "Update billing to resume manual overrides."
            }
            pricingPath={pricingPath}
            ctaLabel={lockCtaLabel}
            badgeLabel={lockBadgeLabel}
          />
        )}
        {canSlugs ? (
          <SlugForm siteId={site.id} />
        ) : (
          <LockedFeatureCard
            title="Localized slugs"
            description={
              mutationsAllowed
                ? "Upgrade to customize translated URL slugs."
                : "Update billing to resume localized slug edits."
            }
            pricingPath={pricingPath}
            ctaLabel={lockCtaLabel}
            badgeLabel={lockBadgeLabel}
          />
        )}
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

function Header({
  site,
  canEdit,
  mutationsAllowed,
}: {
  site: Site;
  canEdit: boolean;
  mutationsAllowed: boolean;
}) {
  const verifiedDomains = site.domains.filter((domain) => domain.status === "verified").length;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{site.sourceUrl}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <StatusBadge status={site.status} />
          <span>{verifiedDomains} verified domain(s)</span>
        </div>
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
        ) : mutationsAllowed ? (
          <Button disabled variant="outline">
            Pause translations
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={`/dashboard/sites/${site.id}/admin`}>Settings</Link>
        </Button>
        <Button asChild variant="link">
          <Link href="/dashboard/sites">Back to list</Link>
        </Button>
      </div>
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

function StatusBadge({ status }: { status: Site["status"] }) {
  if (status === "active") {
    return <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>;
  }
  return <Badge variant="outline">Inactive</Badge>;
}

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return date.toLocaleString();
}

function DomainSection({
  canManageDomains,
  domains,
  siteId,
  pricingPath,
  lockCtaLabel,
  lockBadgeLabel,
  billingBlocked,
}: {
  canManageDomains: boolean;
  domains: Site["domains"];
  siteId: string;
  pricingPath: string;
  lockCtaLabel: string;
  lockBadgeLabel: string;
  billingBlocked: boolean;
}) {
  if (!canManageDomains) {
    return (
      <LockedFeatureCard
        title="Domains"
        description={
          billingBlocked
            ? "Update billing to resume domain verification and provisioning."
            : "Upgrade to manage domain verification and provisioning."
        }
        pricingPath={pricingPath}
        ctaLabel={lockCtaLabel}
        badgeLabel={lockBadgeLabel}
      />
    );
  }

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
        <CardDescription>Per-language status, deployment IDs, and route prefixes.</CardDescription>
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

function LockedFeatureCard({
  title,
  description,
  pricingPath,
  ctaLabel = "Upgrade plan",
  badgeLabel = "Locked",
}: {
  title: string;
  description: string;
  pricingPath: string;
  ctaLabel?: string;
  badgeLabel?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button asChild variant="secondary">
          <Link href={pricingPath}>{ctaLabel}</Link>
        </Button>
        <Badge variant="outline">{badgeLabel}</Badge>
      </CardContent>
    </Card>
  );
}
