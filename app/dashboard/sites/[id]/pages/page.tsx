import Link from "next/link";
import { notFound } from "next/navigation";

import { triggerPageCrawlAction } from "../../../actions";

import { ActionForm } from "@/components/dashboard/action-form";
import { PagesSummaryBlock } from "@/components/dashboard/pages-summary-block";
import { SiteHeader } from "../site-header";
import { CrawlSummaryClient } from "./crawl-summary.client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { getSiteDashboardCached } from "@internal/dashboard/data";
import {
  WebhooksApiError,
  type Deployment,
  type Site,
  type SitePageSummary,
  type SitePagesSummary,
} from "@internal/dashboard/webhooks";
import { i18nConfig, resolveLocaleTranslator } from "@internal/i18n";

export const metadata = {
  title: "Site pages",
  robots: { index: false, follow: false },
};

type SitePagesPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ page?: string }>;
};

const PAGES_PAGE_SIZE = 25;

export default async function SitePagesPage({ params, searchParams }: SitePagesPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedPage = Number.parseInt(resolvedSearchParams?.page ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const offset = (currentPage - 1) * PAGES_PAGE_SIZE;
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
  const crawlLastSuccessfulLabel = t("dashboard.crawl.summary.lastSuccessful");
  const crawlDiscoveredLabel = t("dashboard.crawl.summary.discovered");
  const crawlEnqueuedLabel = t("dashboard.crawl.summary.enqueued");
  const crawlSelectedLabel = t("dashboard.crawl.summary.selected");
  const crawlSkippedLabel = t("dashboard.crawl.summary.skippedDueToLimit");
  const crawlErrorLabel = t("dashboard.crawl.summary.error");
  const pagesTitle = t("dashboard.pages.title");
  const pagesDescription = t("dashboard.pages.description");
  const pagesEmpty = t("dashboard.pages.empty");
  const pagesSummaryTitle = t("dashboard.pages.summary.title");
  const pagesSummaryDescription = t("dashboard.pages.summary.description");
  const pagesSummaryLastCrawlStartedLabel = t("dashboard.pages.summary.lastCrawlStarted");
  const pagesSummaryLastCrawlFinishedLabel = t("dashboard.pages.summary.lastCrawlFinished");
  const pagesSummaryUpdatedLabel = t("dashboard.pages.summary.pagesUpdated");
  const pagesSummaryPendingLabel = t("dashboard.pages.summary.pagesPendingCrawl");
  const pagesSummaryRemainingLabel = t("dashboard.pages.summary.remainingPageCrawlsToday");
  const pagesSummaryUnavailableLabel = t("dashboard.pages.summary.unavailable", "—");
  const pageColumnLabel = t("dashboard.pages.columns.page");
  const lastCrawlLabel = t("dashboard.pages.columns.lastCrawl");
  const lastChangeLabel = t("dashboard.pages.columns.lastChange");
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
  let pageTotal = 0;
  let pageHasMore = false;
  let deployments: Deployment[] = [];
  let pagesSummary: SitePagesSummary | null = null;
  let error: string | null = null;

  try {
    const payload = await getSiteDashboardCached(authToken, id, {
      includePages: true,
      limit: PAGES_PAGE_SIZE,
      offset,
    });
    site = payload.site;
    pages = payload.pages ?? [];
    pageTotal = payload.pagination?.total ?? 0;
    pageHasMore = payload.pagination?.hasMore ?? false;
    deployments = payload.deployments ?? [];
    pagesSummary = payload.pagesSummary ?? null;
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load site pages.";
    if (err instanceof WebhooksApiError) {
      console.warn("[dashboard] fetchSiteDashboard failed", {
        siteId: id,
        status: err.status,
        message: err.message,
        details: err.details ?? null,
        subjectAccountId: auth.subjectAccountId,
        actorAccountId: auth.actorAccountId,
        actingAsCustomer: auth.actingAsCustomer,
      });
    } else {
      console.warn("[dashboard] fetchSiteDashboard failed (unknown error)", {
        siteId: id,
        message: error,
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

  const dailyUsage = auth.account?.dailyCrawlUsage;
  const maxDailyPageCrawls = auth.account?.featureFlags.maxDailyPageRecrawls ?? null;
  const pageCrawlsUsed = dailyUsage?.pageCrawls ?? 0;
  const pageCrawlsRemaining =
    maxDailyPageCrawls === null ? null : Math.max(maxDailyPageCrawls - pageCrawlsUsed, 0);
  const pageCrawlRemainingLabel =
    maxDailyPageCrawls === null
      ? t("dashboard.pages.summary.remainingUnlimited", "Unlimited")
      : t("dashboard.pages.summary.remainingToday", "{remaining} remaining today", {
          remaining: String(pageCrawlsRemaining ?? 0),
        });
  const pageCrawlLimitReached = maxDailyPageCrawls !== null && pageCrawlsUsed >= maxDailyPageCrawls;
  const crawlReady = site.status === "active";
  const targetLangs = Array.from(new Set(site.locales.map((locale) => locale.targetLang)));
  const deploymentsByLang = new Map(
    deployments.map((deployment) => [deployment.targetLang, deployment]),
  );
  const servingRows = targetLangs
    .map((lang) => deploymentsByLang.get(lang))
    .filter((deployment): deployment is Deployment => Boolean(deployment));
  const totalPages = Math.max(1, Math.ceil(pageTotal / PAGES_PAGE_SIZE));
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = pageHasMore;
  const basePagesPath = `/dashboard/sites/${site.id}/pages`;
  const previousPageHref =
    currentPage - 1 <= 1 ? basePagesPath : `${basePagesPath}?page=${currentPage - 1}`;
  const nextPageHref = `${basePagesPath}?page=${currentPage + 1}`;

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
          <CardTitle>{crawlSummaryTitle}</CardTitle>
          <CardDescription>{crawlSummaryDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <CrawlSummaryClient
            siteId={site.id}
            initialSite={site}
            emptyLabel={crawlSummaryEmpty}
            statusLabel={crawlStatusLabel}
            triggerLabel={crawlTriggerLabel}
            captureModeLabel={crawlCaptureModeLabel}
            startedLabel={crawlStartedLabel}
            finishedLabel={crawlFinishedLabel}
            lastSuccessfulLabel={crawlLastSuccessfulLabel}
            discoveredLabel={crawlDiscoveredLabel}
            enqueuedLabel={crawlEnqueuedLabel}
            selectedLabel={crawlSelectedLabel}
            skippedLabel={crawlSkippedLabel}
            errorLabel={crawlErrorLabel}
            statusLabels={crawlStatusLabels}
            triggerLabels={crawlTriggerLabels}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{pagesSummaryTitle}</CardTitle>
          <CardDescription>{pagesSummaryDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <PagesSummaryBlock
            summary={pagesSummary}
            remainingQuotaLabel={pageCrawlRemainingLabel}
            labels={{
              lastCrawlStarted: pagesSummaryLastCrawlStartedLabel,
              lastCrawlFinished: pagesSummaryLastCrawlFinishedLabel,
              pagesUpdated: pagesSummaryUpdatedLabel,
              pagesPendingCrawl: pagesSummaryPendingLabel,
              remainingPageCrawlsToday: pagesSummaryRemainingLabel,
              unavailable: pagesSummaryUnavailableLabel,
            }}
            locale={i18nConfig.defaultLocale}
          />
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
                        key={
                          deployment.deploymentId ??
                          `${deployment.targetLang}-${deployment.domain ?? "domain"}`
                        }
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
          <CardTitle>{pagesTitle}</CardTitle>
          <CardDescription>{pagesDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{pagesEmpty}</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">{pageColumnLabel}</th>
                      <th className="px-3 py-2 text-left">{lastCrawlLabel}</th>
                      <th className="px-3 py-2 text-left">{lastChangeLabel}</th>
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
                              refreshOnSuccess={false}
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
              {pageTotal > PAGES_PAGE_SIZE ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Page {Math.min(currentPage, totalPages)} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    {hasPreviousPage ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={previousPageHref}>Previous</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        Previous
                      </Button>
                    )}
                    {hasNextPage ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={nextPageHref}>Next</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        Next
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
