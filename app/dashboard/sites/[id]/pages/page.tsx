import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { triggerPageCrawlAction } from "../../../actions";

import { ActionForm } from "@/components/dashboard/action-form";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { PagesSummaryBlock } from "@/components/dashboard/pages-summary-block";
import { SiteHeader } from "../site-header";
import { CrawlSummaryClient } from "./crawl-summary.client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { resolveDashboardErrorView } from "@internal/dashboard/error-state";
import {
  fetchSiteCompactStatus,
  fetchSitePages,
  WebhooksApiError,
  type SiteCompactStatusResponse,
  type SitePageSummary,
  type SitePagesSummary,
} from "@internal/dashboard/webhooks";
import { resolvePreferredLocale, resolveLocaleTranslator } from "@internal/i18n";

export const metadata = {
  title: "Pages & crawl",
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
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const canEdit = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" });
  const canResumeTranslations = auth.has({ feature: "edit" }) && mutationsAllowed;
  const canCrawl = auth.has({ allFeatures: ["edit", "crawl_trigger"] }) && mutationsAllowed;
  const deactivateLabel = t("dashboard.site.status.deactivate");
  const reactivateLabel = t("dashboard.site.status.reactivate");
  const deactivateConfirm = t("dashboard.site.status.deactivateConfirm");
  const activateHelpLabel = t("dashboard.site.status.activateHelpLabel");
  const activateHelp = t("dashboard.site.status.activateHelp");
  const crawlSummaryTitle = t("dashboard.crawl.summary.title");
  const crawlSummaryDescription = t("dashboard.crawl.summary.description");
  const crawlSummaryEmpty = t("dashboard.crawl.summary.empty");
  const crawlStatusLabel = t("dashboard.crawl.summary.status");
  const crawlStartedLabel = t("dashboard.crawl.summary.startedAt");
  const crawlFinishedLabel = t("dashboard.crawl.summary.finishedAt");
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
  const crawlStatusLabels = {
    not_started: t("dashboard.crawl.status.notStarted", "Not started"),
    queued: t("dashboard.crawl.status.queued", "Queued"),
    in_progress: t("dashboard.crawl.status.inProgress"),
    completed: t("dashboard.crawl.status.completed"),
    failed: t("dashboard.crawl.status.failed"),
    unknown: t("dashboard.crawl.status.unknown", "Unknown"),
  };

  let pages: SitePageSummary[] = [];
  let pageTotal = 0;
  let pageHasMore = false;
  let compactStatus: SiteCompactStatusResponse | null = null;
  let pagesSummary: SitePagesSummary | null = null;
  let error: unknown = null;

  try {
    const [pagesPayload, statusPayload] = await Promise.all([
      fetchSitePages(authToken, id, {
        limit: PAGES_PAGE_SIZE,
        offset,
      }),
      fetchSiteCompactStatus(authToken, id),
    ]);
    pages = pagesPayload.pages;
    pageTotal = pagesPayload.pagination.total;
    pageHasMore = pagesPayload.pagination.hasMore;
    compactStatus = statusPayload;
    pagesSummary = buildPagesSummary(statusPayload);
  } catch (err) {
    error = err;
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
      console.warn("[dashboard] fetchSitePages failed (unknown error)", {
        siteId: id,
        message: error,
      });
    }
  }

  if (!compactStatus) {
    if (error) {
      const errorView = resolveDashboardErrorView(error, {
        title: "Unable to load site",
        description:
          "We could not complete your request. You can retry or return to the dashboard.",
        message: "Unable to load site pages.",
      });
      return (
        <ErrorStateCard
          title={errorView.title}
          description={errorView.description}
          message={errorView.message}
          actions={
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          }
        />
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
  const crawlReady = compactStatus.siteStatus === "active";
  const totalPages = Math.max(1, Math.ceil(pageTotal / PAGES_PAGE_SIZE));
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = pageHasMore;
  const basePagesPath = `/dashboard/sites/${id}/pages`;
  const previousPageHref =
    currentPage - 1 <= 1 ? basePagesPath : `${basePagesPath}?page=${currentPage - 1}`;
  const nextPageHref = `${basePagesPath}?page=${currentPage + 1}`;
  const headerSite = {
    id,
    sourceUrl: `Site ${id}`,
    status: compactStatus.siteStatus,
  };

  return (
    <div className="space-y-8">
      <SiteHeader
        site={headerSite}
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
            siteId={id}
            initialStatus={compactStatus}
            emptyLabel={crawlSummaryEmpty}
            statusLabel={crawlStatusLabel}
            startedLabel={crawlStartedLabel}
            finishedLabel={crawlFinishedLabel}
            pagesUpdatedLabel={pagesSummaryUpdatedLabel}
            pagesPendingLabel={pagesSummaryPendingLabel}
            errorLabel={crawlErrorLabel}
            statusLabels={crawlStatusLabels}
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
            locale={locale}
          />
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
                                <input name="siteId" type="hidden" value={id} />
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

function buildPagesSummary(status: SiteCompactStatusResponse): SitePagesSummary {
  const latestCrawlRun = status.latestCrawlRun ?? null;
  return {
    lastCrawlStartedAt: latestCrawlRun?.startedAt ?? null,
    lastCrawlFinishedAt: latestCrawlRun?.finishedAt ?? null,
    pagesUpdated: latestCrawlRun?.pagesUpdated ?? 0,
    pagesPending: latestCrawlRun?.pagesPending ?? 0,
    nextEligibleCrawlAt: null,
    eligiblePageCount: null,
  };
}
