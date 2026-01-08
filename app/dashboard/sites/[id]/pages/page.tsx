import Link from "next/link";
import { notFound } from "next/navigation";

import { triggerPageCrawlAction } from "../../../actions";

import { ActionForm } from "@/components/dashboard/action-form";
import { SiteHeader } from "../site-header";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import {
  fetchDeployments,
  fetchSite,
  fetchSitePages,
  WebhooksApiError,
  type Deployment,
  type Site,
  type SitePageSummary,
} from "@internal/dashboard/webhooks";
import { i18nConfig, resolveLocaleTranslator } from "@internal/i18n";

export const metadata = {
  title: "Site pages",
  robots: { index: false, follow: false },
};

type SitePagesPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    toast?: string | string[];
    error?: string | string[];
  }>;
};

export default async function SitePagesPage({ params, searchParams }: SitePagesPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const toastMessage = decodeSearchParam(resolvedSearchParams?.toast);
  const actionErrorMessage = decodeSearchParam(resolvedSearchParams?.error);
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const mutationsAllowed = auth.mutationsAllowed;
  const { t } = await resolveLocaleTranslator(
    Promise.resolve({ locale: i18nConfig.defaultLocale }),
  );
  const canEdit = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" });
  const canResumeTranslations = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canCrawl = auth.has({ allFeatures: ["edit", "crawl_trigger"] }) && mutationsAllowed;
  const deactivateLabel = t("dashboard.site.status.deactivate");
  const reactivateLabel = t("dashboard.site.status.reactivate");
  const deactivateConfirm = t("dashboard.site.status.deactivateConfirm");
  const activateHelpLabel = t("dashboard.site.status.activateHelpLabel");
  const activateHelp = t("dashboard.site.status.activateHelp");
  const servingTitle = t("dashboard.serving.languages.title");
  const servingDescription = t("dashboard.serving.languages.description");
  const servingLanguageLabel = t("dashboard.serving.languages.columns.language");
  const servingDomainLabel = t("dashboard.serving.languages.columns.domain");
  const servingStatusLabel = t("dashboard.serving.languages.columns.serving");
  const servingActiveLabel = t("dashboard.deployments.activeId.label");
  const deploymentsEmpty = t("dashboard.deployments.empty");
  const crawlSummaryTitle = t("dashboard.crawl.summary.title");
  const crawlSummaryDescription = t("dashboard.crawl.summary.description");
  const crawlSummaryEmpty = t("dashboard.crawl.summary.empty");
  const crawlStatusLabel = t("dashboard.crawl.summary.status");
  const crawlTriggerLabel = t("dashboard.crawl.summary.trigger");
  const crawlCaptureModeLabel = t("dashboard.crawl.summary.captureMode");
  const crawlStartedLabel = t("dashboard.crawl.summary.startedAt");
  const crawlFinishedLabel = t("dashboard.crawl.summary.finishedAt");
  const crawlDiscoveredLabel = t("dashboard.crawl.summary.discovered");
  const crawlEnqueuedLabel = t("dashboard.crawl.summary.enqueued");
  const crawlSelectedLabel = t("dashboard.crawl.summary.selected");
  const crawlSkippedLabel = t("dashboard.crawl.summary.skippedDueToLimit");
  const crawlErrorLabel = t("dashboard.crawl.summary.error");
  const pageNextCrawlLabel = t("dashboard.pages.columns.nextCrawl");
  const eligibleNowLabel = t("dashboard.pages.eligibleNow");
  const servingStatusLabels = {
    inactive: t("dashboard.serving.status.inactive"),
    disabled: t("dashboard.serving.status.disabled"),
    needs_domain: t("dashboard.serving.status.needsDomain"),
    ready: t("dashboard.serving.status.ready"),
    serving: t("dashboard.serving.status.serving"),
  };
  const crawlStatusLabels = {
    in_progress: t("dashboard.crawl.status.inProgress"),
    completed: t("dashboard.crawl.status.completed"),
    failed: t("dashboard.crawl.status.failed"),
  };
  const crawlTriggerLabels = {
    cron: t("dashboard.crawl.trigger.cron"),
    queue: t("dashboard.crawl.trigger.queue"),
  };

  let site: Site | null = null;
  let pages: SitePageSummary[] = [];
  let deployments: Deployment[] = [];
  let error: string | null = null;

  const [siteResult, pagesResult, deploymentsResult] = await Promise.allSettled([
    fetchSite(authToken, id),
    fetchSitePages(authToken, id),
    fetchDeployments(authToken, id),
  ]);

  if (siteResult.status === "fulfilled") {
    site = siteResult.value;
  } else {
    const err = siteResult.reason;
    error = err instanceof Error ? err.message : "Unable to load site pages.";
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

  if (pagesResult.status === "fulfilled") {
    pages = pagesResult.value;
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

  if (deploymentsResult.status === "fulfilled") {
    deployments = deploymentsResult.value;
  } else {
    console.warn("[dashboard] fetchDeployments failed:", deploymentsResult.reason);
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

  const dailyUsage = auth.account?.dailyCrawlUsage;
  const maxDailyPageCrawls = auth.account?.featureFlags.maxDailyPageRecrawls ?? null;
  const pageCrawlLimitReached =
    maxDailyPageCrawls !== null && (dailyUsage?.pageCrawls ?? 0) >= maxDailyPageCrawls;
  const crawlReady = site.status === "active";
  const returnTo = `/dashboard/sites/${site.id}/pages`;
  const targetLangs = Array.from(new Set(site.locales.map((locale) => locale.targetLang)));
  const deploymentsByLang = new Map(
    deployments.map((deployment) => [deployment.targetLang, deployment]),
  );
  const latestCrawlRun = site.latestCrawlRun ?? null;
  const servingRows = targetLangs
    .map((lang) => deploymentsByLang.get(lang))
    .filter((deployment): deployment is Deployment => Boolean(deployment));

  return (
    <div className="space-y-8">
      {actionErrorMessage ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionErrorMessage}{" "}
          <Link className="font-medium underline" href={returnTo}>
            Dismiss
          </Link>
        </div>
      ) : toastMessage ? (
        <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground">
          {toastMessage}{" "}
          <Link className="font-medium underline" href={returnTo}>
            Dismiss
          </Link>
        </div>
      ) : null}

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
          <CardTitle>{crawlSummaryTitle}</CardTitle>
          <CardDescription>{crawlSummaryDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {!latestCrawlRun ? (
            <p className="text-sm text-muted-foreground">{crawlSummaryEmpty}</p>
          ) : (
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlStatusLabel}</div>
                <Badge variant={resolveCrawlStatusVariant(latestCrawlRun.status)}>
                  {crawlStatusLabels[latestCrawlRun.status] ?? latestCrawlRun.status}
                </Badge>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlTriggerLabel}</div>
                <span className="font-mono text-foreground">
                  {crawlTriggerLabels[latestCrawlRun.trigger] ?? latestCrawlRun.trigger}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">
                  {crawlCaptureModeLabel}
                </div>
                <span className="font-mono text-foreground">
                  {latestCrawlRun.crawlCaptureMode ?? "—"}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlStartedLabel}</div>
                <span className="text-muted-foreground">
                  {formatTimestamp(latestCrawlRun.startedAt)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlFinishedLabel}</div>
                <span className="text-muted-foreground">
                  {formatTimestamp(latestCrawlRun.finishedAt)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">
                  {crawlDiscoveredLabel}
                </div>
                <span className="font-mono text-foreground">{latestCrawlRun.pagesDiscovered}</span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlEnqueuedLabel}</div>
                <span className="font-mono text-foreground">{latestCrawlRun.pagesEnqueued}</span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlSelectedLabel}</div>
                <span className="font-mono text-foreground">{latestCrawlRun.selectedCount}</span>
              </div>
              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">{crawlSkippedLabel}</div>
                <span className="font-mono text-foreground">
                  {latestCrawlRun.skippedDueToLimitCount}
                </span>
              </div>
              <div className="space-y-1 md:col-span-2">
                <div className="text-xs uppercase text-muted-foreground">{crawlErrorLabel}</div>
                <span
                  className={latestCrawlRun.error ? "text-destructive" : "text-muted-foreground"}
                >
                  {latestCrawlRun.error ?? "—"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{servingTitle}</CardTitle>
          <CardDescription>{servingDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {servingRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{deploymentsEmpty}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">{servingLanguageLabel}</th>
                    <th className="px-3 py-2 text-left">{servingDomainLabel}</th>
                    <th className="px-3 py-2 text-left">{servingStatusLabel}</th>
                    <th className="px-3 py-2 text-left">{servingActiveLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {servingRows.map((deployment) => {
                    const domainStatus = deployment.domainStatus ?? null;
                    const servingLabel =
                      servingStatusLabels[deployment.servingStatus] ?? deployment.servingStatus;
                    const servingVariant = resolveServingStatusVariant(deployment.servingStatus);
                    const domainVariant = resolveDomainStatusVariant(domainStatus);
                    return (
                      <tr
                        key={`${deployment.targetLang}-${deployment.domain ?? "domain"}`}
                        className="border-t border-border/50"
                      >
                        <td className="px-3 py-3 align-top font-semibold text-foreground">
                          {deployment.targetLang.toUpperCase()}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="text-foreground">{deployment.domain ?? "—"}</span>
                            {domainStatus ? (
                              <Badge variant={domainVariant}>{domainStatus}</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Badge variant={servingVariant}>{servingLabel}</Badge>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span
                            className={
                              deployment.activeDeploymentId
                                ? "font-mono text-foreground"
                                : "text-muted-foreground"
                            }
                          >
                            {deployment.activeDeploymentId ?? "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <CardDescription>
            Discovered pages from sitemaps and crawls. Enable localization before triggering a new
            crawl.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pages discovered yet. We will seed from sitemaps after onboarding, then refresh
              once localization is enabled.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Page</th>
                    <th className="px-3 py-2 text-left">Last crawl</th>
                    <th className="px-3 py-2 text-left">Last change</th>
                    <th className="px-3 py-2 text-left">{pageNextCrawlLabel}</th>
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
                        {formatTimestamp(page.lastCrawledAt)}
                      </td>
                      <td className="px-3 py-3 align-top text-muted-foreground">
                        {formatTimestamp(page.lastSnapshotAt)}
                      </td>
                      <td className="px-3 py-3 align-top text-muted-foreground">
                        {formatNextCrawlAt(page.nextCrawlAt, eligibleNowLabel)}
                      </td>
                      {canCrawl ? (
                        <td className="px-3 py-3 text-right align-top">
                          <ActionForm
                            action={triggerPageCrawlAction}
                            loading="Starting page crawl..."
                            success="Page crawl enqueued."
                            error="Unable to enqueue page crawl."
                          >
                            <>
                              <input name="siteId" type="hidden" value={site.id} />
                              <input name="pageId" type="hidden" value={page.id} />
                              <Button
                                type="submit"
                                size="sm"
                                variant="outline"
                                disabled={!crawlReady || pageCrawlLimitReached}
                                title={
                                  pageCrawlLimitReached
                                    ? "Daily page crawl limit reached."
                                    : crawlReady
                                      ? "Enqueue a crawl for this page."
                                      : "Enable localization to crawl."
                                }
                              >
                                Force crawl
                              </Button>
                            </>
                          </ActionForm>
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

function formatNextCrawlAt(value: string | null | undefined, eligibleNowLabel: string): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  if (date.getTime() <= Date.now()) {
    return eligibleNowLabel;
  }
  return formatTimestamp(value);
}

function resolveServingStatusVariant(status: Deployment["servingStatus"]) {
  switch (status) {
    case "serving":
      return "default";
    case "ready":
      return "secondary";
    case "disabled":
    case "needs_domain":
    case "inactive":
    default:
      return "outline";
  }
}

function resolveCrawlStatusVariant(status: "in_progress" | "completed" | "failed") {
  switch (status) {
    case "completed":
      return "secondary";
    case "failed":
      return "destructive";
    case "in_progress":
    default:
      return "outline";
  }
}

function resolveDomainStatusVariant(status: Deployment["domainStatus"] | null) {
  switch (status) {
    case "verified":
      return "secondary";
    case "failed":
      return "destructive";
    case "pending":
    default:
      return "outline";
  }
}
