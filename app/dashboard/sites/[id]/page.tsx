import Link from "next/link";
import { notFound } from "next/navigation";

import {
  cancelTranslationRunAction,
  refreshDomainAction,
  resumeTranslationRunAction,
  retryFailedTranslationRunAction,
  translateAndServeAction,
  verifyDomainAction,
} from "../../actions";
import { SiteHeader } from "./site-header";
import { LockedFeatureCard } from "./locked-feature-card";

import { Info } from "lucide-react";

import { ActionForm } from "@/components/dashboard/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  fetchDeployments,
  fetchSite,
  fetchSitePages,
  WebhooksApiError,
  type Deployment,
  type Site,
  type SitePageSummary,
} from "@internal/dashboard/webhooks";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { i18nConfig, resolveLocaleTranslator } from "@internal/i18n";

type SitePageProps = {
  params: Promise<{ id: string }>;
};

const STALLED_RUN_THRESHOLD_MS = 15 * 60 * 1000;

export default async function SitePage({ params }: SitePageProps) {
  const { id } = await params;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const mutationsAllowed = auth.mutationsAllowed;
  const pricingPath = `/${i18nConfig.defaultLocale}/pricing`;
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
  const canEdit = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" });
  const canResumeTranslations = auth.has({ feature: "edit" }) && mutationsAllowed;
  const deactivateLabel = t("dashboard.site.status.deactivate");
  const reactivateLabel = t("dashboard.site.status.reactivate");
  const deactivateConfirm = t("dashboard.site.status.deactivateConfirm");
  const activateHelpLabel = t("dashboard.site.status.activateHelpLabel");
  const activateHelp = t("dashboard.site.status.activateHelp");
  const cloudflareStatusHelpLabel = t("dashboard.domains.cloudflare.helpLabel");
  const cloudflareStatusHelp = t("dashboard.domains.cloudflare.help");
  const cloudflareStatusUnknown = t("dashboard.domains.cloudflare.unknown");
  const cloudflareLastSyncedLabel = t("dashboard.domains.cloudflare.lastSyncedLabel");
  const cloudflareErrorsLabel = t("dashboard.domains.cloudflare.errorsLabel");
  const nextEligibleCrawlLabel = t("dashboard.crawl.summary.nextEligible");
  const eligibleNowLabel = t("dashboard.crawl.summary.eligibleNow");
  const canCrawl = auth.has({ allFeatures: ["edit", "crawl_trigger"] }) && mutationsAllowed;
  const canDomains = auth.has({ allFeatures: ["edit", "domain_verify"] }) && mutationsAllowed;
  const lockCtaLabel = mutationsAllowed ? "Upgrade plan" : "Update billing";
  const lockBadgeLabel = mutationsAllowed ? "Locked" : "Billing issue";

  let site: Site | null = null;
  let deployments: Deployment[] = [];
  let pages: SitePageSummary[] = [];
  let error: string | null = null;

  const [siteResult, deploymentsResult, pagesResult] = await Promise.allSettled([
    fetchSite(authToken, id),
    fetchDeployments(authToken, id),
    fetchSitePages(authToken, id),
  ]);

  if (siteResult.status === "fulfilled") {
    site = siteResult.value;
  } else {
    const err = siteResult.reason;
    error = err instanceof Error ? err.message : "Unable to load site.";
    if (err instanceof WebhooksApiError) {
      console.warn("[dashboard] fetchSite failed", {
        siteId: id,
        status: err.status,
        message: err.message,
        details: err.details ?? null,
        subjectAccountId: auth.subjectAccountId,
        actorAccountId: auth.actorAccountId,
        actingAsCustomer: auth.actingAsCustomer,
      });
    } else {
      console.warn("[dashboard] fetchSite failed (unknown error)", {
        siteId: id,
        message: error,
      });
    }
  }

  if (deploymentsResult.status === "fulfilled") {
    deployments = deploymentsResult.value;
  } else {
    console.warn("[dashboard] fetchDeployments failed:", deploymentsResult.reason);
  }

  if (pagesResult.status === "fulfilled") {
    pages = pagesResult.value.pages;
  } else {
    const err = pagesResult.reason;
    if (err instanceof WebhooksApiError) {
      console.warn("[dashboard] fetchSitePages failed", {
        siteId: id,
        status: err.status,
        message: err.message,
        details: err.details ?? null,
        subjectAccountId: auth.subjectAccountId,
        actorAccountId: auth.actorAccountId,
        actingAsCustomer: auth.actingAsCustomer,
      });
    } else {
      const message = err instanceof Error ? err.message : "Unable to load site pages.";
      console.warn("[dashboard] fetchSitePages failed (unknown error)", {
        siteId: id,
        message,
      });
    }
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

  const domainLocales = buildDomainLocaleLookup(site.routeConfig);
  const deploymentsByLang = deployments.reduce<Record<string, Deployment>>((acc, deployment) => {
    acc[deployment.targetLang] = deployment;
    return acc;
  }, {});
  const nextCrawlValue = resolveNextEligibleCrawlValue({
    pages,
    siteStatus: site.status,
    eligibleNowLabel,
  });

  return (
    <div className="space-y-8">
      <SiteHeader
        site={site}
        canEdit={canEdit}
        canPauseTranslations={canPauseTranslations}
        canResumeTranslations={canResumeTranslations}
        deactivateLabel={deactivateLabel}
        reactivateLabel={reactivateLabel}
        deactivateConfirm={deactivateConfirm}
        activateHelpLabel={activateHelpLabel}
        activateHelp={activateHelp}
      />

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
          <InfoBlock label={nextEligibleCrawlLabel} value={nextCrawlValue} />
          <InfoBlock label="Profile" value={site.siteProfile ? "Provided" : "Not set"} />
        </CardContent>
      </Card>

      <DomainSection
        canManageDomains={canDomains}
        canTranslate={canCrawl}
        domains={site.domains}
        domainLocales={domainLocales}
        deploymentsByLang={deploymentsByLang}
        siteId={site.id}
        siteStatus={site.status}
        pricingPath={pricingPath}
        lockCtaLabel={lockCtaLabel}
        lockBadgeLabel={lockBadgeLabel}
        cloudflareStatusHelpLabel={cloudflareStatusHelpLabel}
        cloudflareStatusHelp={cloudflareStatusHelp}
        cloudflareStatusUnknown={cloudflareStatusUnknown}
        cloudflareLastSyncedLabel={cloudflareLastSyncedLabel}
        cloudflareErrorsLabel={cloudflareErrorsLabel}
        billingBlocked={!mutationsAllowed}
      />
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

function getHostname(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
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

function resolveNextEligibleCrawlValue({
  pages,
  siteStatus,
  eligibleNowLabel,
}: {
  pages: SitePageSummary[];
  siteStatus: Site["status"];
  eligibleNowLabel: string;
}): string {
  const nextCrawlAt = findEarliestNextCrawl(pages);
  if (!nextCrawlAt) {
    return siteStatus === "active" ? "—" : "— (activate to run)";
  }
  const nextDate = new Date(nextCrawlAt);
  if (Number.isNaN(nextDate.valueOf())) {
    return siteStatus === "active" ? nextCrawlAt : `${nextCrawlAt} (activate to run)`;
  }
  const eligibleNow = nextDate.getTime() <= Date.now();
  const value = eligibleNow ? eligibleNowLabel : formatTimestamp(nextCrawlAt);
  return siteStatus === "active" ? value : `${value} (activate to run)`;
}

function findEarliestNextCrawl(pages: SitePageSummary[]): string | null {
  let earliest: string | null = null;
  let earliestTs: number | null = null;
  for (const page of pages) {
    if (!page.nextCrawlAt) {
      continue;
    }
    const ts = Date.parse(page.nextCrawlAt);
    if (!Number.isFinite(ts)) {
      if (!earliest) {
        earliest = page.nextCrawlAt;
      }
      continue;
    }
    if (earliestTs === null || ts < earliestTs) {
      earliestTs = ts;
      earliest = page.nextCrawlAt;
    }
  }
  return earliest;
}

function buildDomainLocaleLookup(routeConfig: Site["routeConfig"]): Record<string, string> {
  if (!routeConfig?.locales?.length) {
    return {};
  }
  const lookup: Record<string, string> = {};
  for (const locale of routeConfig.locales) {
    const host = getHostname(locale.origin);
    if (host) {
      lookup[host.toLowerCase()] = locale.lang;
    }
  }
  return lookup;
}

function DomainSection({
  canManageDomains,
  canTranslate,
  domains,
  domainLocales,
  deploymentsByLang,
  siteId,
  siteStatus,
  pricingPath,
  lockCtaLabel,
  lockBadgeLabel,
  cloudflareStatusHelpLabel,
  cloudflareStatusHelp,
  cloudflareStatusUnknown,
  cloudflareLastSyncedLabel,
  cloudflareErrorsLabel,
  billingBlocked,
}: {
  canManageDomains: boolean;
  canTranslate: boolean;
  domains: Site["domains"];
  domainLocales: Record<string, string>;
  deploymentsByLang: Record<string, Deployment>;
  siteId: string;
  siteStatus: Site["status"];
  pricingPath: string;
  lockCtaLabel: string;
  lockBadgeLabel: string;
  cloudflareStatusHelpLabel: string;
  cloudflareStatusHelp: string;
  cloudflareStatusUnknown: string;
  cloudflareLastSyncedLabel: string;
  cloudflareErrorsLabel: string;
  billingBlocked: boolean;
}) {
  if (!canManageDomains) {
    return (
      <LockedFeatureCard
        title="Domains"
        description={
          billingBlocked
            ? "Update billing to resume domain verification and serving."
            : "Upgrade to manage domain verification and serving."
        }
        pricingPath={pricingPath}
        ctaLabel={lockCtaLabel}
        badgeLabel={lockBadgeLabel}
      />
    );
  }

  return (
    <Card id="domains">
      <CardHeader>
        <CardTitle>Domains</CardTitle>
        <CardDescription>
          Verify each hostname, then translate and serve that language once verified. Translate &
          serve will enable localization if it is paused.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">No domains registered for this site yet.</p>
        ) : (
          domains.map((domain) => {
            const domainLocale = domainLocales[domain.domain.toLowerCase()];
            const isVerified = domain.status === "verified";
            const deployment = domainLocale ? deploymentsByLang[domainLocale] : undefined;
            const translationRun = deployment?.translationRun ?? null;
            const runActive =
              translationRun?.status === "queued" || translationRun?.status === "in_progress";
            const runFailed = translationRun?.status === "failed";
            const lastActivity =
              translationRun?.updatedAt ??
              translationRun?.startedAt ??
              translationRun?.createdAt ??
              null;
            const lastActivityMs = lastActivity ? Date.parse(lastActivity) : NaN;
            // eslint-disable-next-line react-hooks/purity
            const nowMs = Date.now();
            const runStalled =
              runActive &&
              Number.isFinite(lastActivityMs) &&
              nowMs - lastActivityMs > STALLED_RUN_THRESHOLD_MS;
            const stalledSince = runStalled ? formatTimestamp(lastActivity) : null;
            const runStatusLabel = runFailed
              ? "failed"
              : translationRun?.status === "queued"
                ? "queued"
                : "in progress";
            const showRunStatus = Boolean(translationRun && (runActive || runFailed));
            const translateDisabled = !canTranslate || !domainLocale || runActive;
            const translateTitle = translateDisabled
              ? !canTranslate
                ? "Upgrade to enable translation triggers."
                : !domainLocale
                  ? "No language configured for this hostname."
                  : "Translation already running."
              : undefined;

            return (
              <div
                key={domain.domain}
                className="grid gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 md:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-foreground">{domain.domain}</p>
                    <Badge variant={isVerified ? "secondary" : "outline"}>{domain.status}</Badge>
                    {domainLocale ? (
                      <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {domainLocale.toUpperCase()}
                      </span>
                    ) : null}
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
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <span>Cloudflare</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  aria-label={cloudflareStatusHelpLabel}
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 text-muted-foreground"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="max-w-xs text-xs text-muted-foreground">
                                <div className="space-y-2">
                                  <p>{cloudflareStatusHelp}</p>
                                  {domain.cloudflare?.lastSyncedAt ? (
                                    <p>
                                      <span className="font-semibold text-foreground">
                                        {cloudflareLastSyncedLabel}:
                                      </span>{" "}
                                      {formatTimestamp(domain.cloudflare.lastSyncedAt)}
                                    </p>
                                  ) : null}
                                  {domain.cloudflare?.errorMessages?.length ? (
                                    <div>
                                      <p className="font-semibold text-foreground">
                                        {cloudflareErrorsLabel}
                                      </p>
                                      <ul className="list-disc space-y-1 pl-4">
                                        {domain.cloudflare.errorMessages.map((message, index) => (
                                          <li key={`${domain.domain}-cf-error-${index}`}>
                                            {message}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </span>
                          <span className="font-mono text-foreground">
                            {domain.cloudflare.hostnameStatus ?? cloudflareStatusUnknown} /{" "}
                            {domain.cloudflare.certStatus ?? cloudflareStatusUnknown}
                          </span>
                        </p>
                      ) : null}
                      <p>
                        {domain.verifiedAt
                          ? `Verified at ${domain.verifiedAt}`
                          : "Not verified yet"}
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
                        {domain.verifiedAt
                          ? `Verified at ${domain.verifiedAt}`
                          : "Not verified yet"}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  {isVerified ? (
                    <div className="flex w-full flex-col gap-2 md:items-end">
                      <ActionForm
                        action={translateAndServeAction}
                        className="w-full md:w-auto"
                        loading="Starting translation..."
                        success="Translation started."
                        error="Unable to start translation."
                        refreshOnSuccess={false}
                      >
                        <>
                          <input name="siteId" type="hidden" value={siteId} />
                          <input name="siteStatus" type="hidden" value={siteStatus} />
                          <input name="targetLang" type="hidden" value={domainLocale ?? ""} />
                          <Button
                            type="submit"
                            className="w-full md:w-auto"
                            disabled={translateDisabled}
                            title={translateTitle ?? "Translate & serve"}
                          >
                            Translate & serve
                          </Button>
                        </>
                      </ActionForm>
                      {showRunStatus ? (
                        <div className="w-full rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground md:text-right">
                          <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                            <span>
                              Translation {runStatusLabel}
                              {translationRun?.pagesTotal
                                ? ` (${translationRun.pagesCompleted}/${translationRun.pagesTotal})`
                                : ""}
                              {runStalled ? " · Stalled" : ""}
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              {runStalled && translationRun?.id && canTranslate ? (
                                <ActionForm
                                  action={resumeTranslationRunAction}
                                  loading="Resuming run..."
                                  success="Translation resumed."
                                  error="Unable to resume run."
                                >
                                  <>
                                    <input name="siteId" type="hidden" value={siteId} />
                                    <input name="runId" type="hidden" value={translationRun.id} />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      type="submit"
                                      title="Resume"
                                    >
                                      Resume
                                    </Button>
                                  </>
                                </ActionForm>
                              ) : null}
                              {runFailed && translationRun?.id && canTranslate ? (
                                <ActionForm
                                  action={retryFailedTranslationRunAction}
                                  loading="Retrying failed pages..."
                                  success="Retrying failed pages."
                                  error="Unable to retry failed pages."
                                >
                                  <>
                                    <input name="siteId" type="hidden" value={siteId} />
                                    <input name="runId" type="hidden" value={translationRun.id} />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      type="submit"
                                      title="Retry failed pages"
                                    >
                                      Retry failed pages
                                    </Button>
                                  </>
                                </ActionForm>
                              ) : null}
                              {runActive && translationRun?.id && canTranslate ? (
                                <ActionForm
                                  action={cancelTranslationRunAction}
                                  loading="Cancelling run..."
                                  success="Translation run cancelled."
                                  error="Unable to cancel run."
                                >
                                  <>
                                    <input name="siteId" type="hidden" value={siteId} />
                                    <input name="runId" type="hidden" value={translationRun.id} />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      type="submit"
                                      title="Cancel"
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                </ActionForm>
                              ) : null}
                            </div>
                          </div>
                          {runStalled && stalledSince ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              No progress since {stalledSince}. You can resume to retry pending
                              pages.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : domain.dnsInstructions ? (
                    <ActionForm
                      action={refreshDomainAction}
                      className="w-full md:w-auto"
                      loading="Checking DNS..."
                      success="DNS check requested."
                      error="Unable to refresh domain."
                    >
                      <>
                        <input name="siteId" type="hidden" value={siteId} />
                        <input name="siteStatus" type="hidden" value={siteStatus} />
                        <input name="domain" type="hidden" value={domain.domain} />
                        <Button
                          type="submit"
                          variant="outline"
                          className="w-full md:w-auto"
                          title="Check DNS"
                        >
                          Check DNS
                        </Button>
                      </>
                    </ActionForm>
                  ) : (
                    <ActionForm
                      action={verifyDomainAction}
                      className="flex w-full flex-col gap-2 md:items-end"
                      loading="Checking domain..."
                      success="Domain check requested."
                      error="Unable to verify domain."
                    >
                      <>
                        <input name="siteId" type="hidden" value={siteId} />
                        <input name="siteStatus" type="hidden" value={siteStatus} />
                        <input name="domain" type="hidden" value={domain.domain} />
                        <Input
                          aria-label="Test token (optional)"
                          className="w-full"
                          name="token"
                          placeholder="Test token (optional)"
                        />
                        <Button
                          type="submit"
                          variant="outline"
                          className="w-full md:w-auto"
                          title="Check now"
                        >
                          Check now
                        </Button>
                      </>
                    </ActionForm>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
