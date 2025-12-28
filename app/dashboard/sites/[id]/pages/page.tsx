import Link from "next/link";
import { notFound } from "next/navigation";

import { triggerPageCrawlAction } from "../../../actions";
import { SiteHeader } from "../site-header";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import {
  fetchSite,
  fetchSitePages,
  WebhooksApiError,
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

  let site: Site | null = null;
  let pages: SitePageSummary[] = [];
  let error: string | null = null;

  try {
    site = await fetchSite(authToken, id);
    pages = await fetchSitePages(authToken, id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load site pages.";
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
          <CardTitle>Pages</CardTitle>
          <CardDescription>
            Discovered pages from sitemaps and crawls. Enable localization before triggering a
            new crawl.
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
                            <input name="returnTo" type="hidden" value={returnTo} />
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
