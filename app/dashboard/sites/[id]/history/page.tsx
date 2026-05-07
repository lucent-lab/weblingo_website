import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { formatCustomerCopy, formatCustomerStatusValue } from "@internal/dashboard/customer-copy";
import {
  fetchCustomerDeploymentHistory,
  fetchCustomerTranslationRuns,
  fetchSiteDashboardProjection,
  WebhooksApiError,
  type CustomerDeploymentHistoryResponse,
  type CustomerTranslationRunsResponse,
  type SiteDashboardProjectionResponse,
} from "@internal/dashboard/webhooks";
import { resolveLocaleTranslator, resolvePreferredLocale, type Translator } from "@internal/i18n";

import {
  buildSiteHeaderLabels,
  FocusedRouteErrorState,
  formatCount,
  formatDate,
  StatusValueBadge,
  toneForStatus,
} from "../focused-route-utils";
import { SiteHeader } from "../site-header";

export const metadata = {
  title: "History",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 10;

type HistoryPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    targetLang?: string;
    runsPage?: string;
    deploymentsPage?: string;
  }>;
};

type LanguagesProjection = Extract<
  SiteDashboardProjectionResponse,
  { meta: { view: "languages" } }
>;

export default async function HistoryPage({ params, searchParams }: HistoryPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const canEdit = auth.has({ feature: "edit" }) && auth.mutationsAllowed;
  const canPauseTranslations = auth.has({ feature: "edit" });
  const canResumeTranslations = auth.has({ feature: "edit" }) && auth.mutationsAllowed;
  const runsPage = readPageNumber(resolvedSearchParams?.runsPage);
  const deploymentsPage = readPageNumber(resolvedSearchParams?.deploymentsPage);

  let projection: LanguagesProjection | null = null;
  let error: unknown = null;

  try {
    const payload = await fetchSiteDashboardProjection(authToken, id, "languages");
    projection = isLanguagesProjection(payload) ? payload : null;
  } catch (err) {
    error = err;
    logProjectionError(id, auth, err);
  }

  if (!projection) {
    if (error) {
      return (
        <FocusedRouteErrorState
          error={error}
          title="Unable to load history"
          description="We could not complete your request. You can retry or return to the dashboard."
          message="Unable to load history."
        />
      );
    }
    notFound();
  }

  const selectedTargetLang = resolveSelectedTargetLang(
    projection.targetLanguages.map((language) => language.tag),
    resolvedSearchParams?.targetLang,
  );
  let runs: CustomerTranslationRunsResponse | null = null;
  let deployments: CustomerDeploymentHistoryResponse | null = null;

  if (selectedTargetLang) {
    try {
      [runs, deployments] = await Promise.all([
        fetchCustomerTranslationRuns(authToken, id, {
          targetLang: selectedTargetLang,
          limit: PAGE_SIZE,
          offset: (runsPage - 1) * PAGE_SIZE,
        }),
        fetchCustomerDeploymentHistory(authToken, id, {
          targetLang: selectedTargetLang,
          limit: PAGE_SIZE,
          offset: (deploymentsPage - 1) * PAGE_SIZE,
        }),
      ]);
    } catch (err) {
      error = err;
      logHistoryError(id, selectedTargetLang, auth, err);
    }
  }

  if (error && selectedTargetLang && (!runs || !deployments)) {
    return (
      <FocusedRouteErrorState
        error={error}
        title="Unable to load history"
        description="We could not complete your request. You can retry or return to the dashboard."
        message="Unable to load history."
      />
    );
  }

  const headerLabels = buildSiteHeaderLabels(t);

  return (
    <div className="space-y-8">
      <SiteHeader
        site={projection.site}
        canEdit={canEdit}
        canPauseTranslations={canPauseTranslations}
        canResumeTranslations={canResumeTranslations}
        {...headerLabels}
      />

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            Translation runs and deployment events are loaded for one selected locale at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <nav aria-label="History locale" className="flex flex-wrap gap-2">
            {projection.targetLanguages.map((language) => (
              <Button
                asChild
                key={language.tag}
                size="sm"
                variant={language.tag === selectedTargetLang ? "default" : "outline"}
              >
                <Link href={historyHref(projection.site.id, { targetLang: language.tag })}>
                  {language.tag.toUpperCase()}
                </Link>
              </Button>
            ))}
          </nav>
        </CardContent>
      </Card>

      {selectedTargetLang && runs && deployments ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <TranslationRunsCard
            page={runsPage}
            response={runs}
            siteId={projection.site.id}
            t={t}
            targetLang={selectedTargetLang}
          />
          <DeploymentsCard
            page={deploymentsPage}
            response={deployments}
            siteId={projection.site.id}
            t={t}
            targetLang={selectedTargetLang}
          />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No target languages</CardTitle>
            <CardDescription>
              Add a target language before translation and deployment history is available.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function isLanguagesProjection(
  payload: SiteDashboardProjectionResponse,
): payload is LanguagesProjection {
  return payload.meta.view === "languages";
}

function TranslationRunsCard({
  page,
  response,
  siteId,
  t,
  targetLang,
}: {
  page: number;
  response: CustomerTranslationRunsResponse;
  siteId: string;
  t: Translator;
  targetLang: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Translation runs</CardTitle>
        <CardDescription>
          Offset-paginated run summaries for {targetLang.toUpperCase()}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {response.runs.length ? (
          response.runs.map((run) => (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3" key={run.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{run.targetLang.toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDate(run.updatedAt)}
                  </p>
                </div>
                <StatusValueBadge status={run.customerStatus} />
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <HistoryMetric label="Completed" value={formatCount(run.progress.completed)} />
                <HistoryMetric label="Failed" value={formatCount(run.progress.failed)} />
                <HistoryMetric label="Total" value={formatCount(run.progress.total)} />
              </div>
              {run.customerError ? (
                <p className="mt-3 text-sm text-destructive">
                  {formatCustomerCopy(t, run.customerError.titleKey, {
                    fallback: formatCustomerStatusValue(run.customerError.code),
                    params: run.customerError.params,
                  })}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No translation runs for this locale.</p>
        )}
        <PaginationLinks
          currentPage={page}
          nextOffset={response.pagination.nextOffset}
          siteId={siteId}
          targetLang={targetLang}
          type="runs"
        />
      </CardContent>
    </Card>
  );
}

function DeploymentsCard({
  page,
  response,
  siteId,
  t,
  targetLang,
}: {
  page: number;
  response: CustomerDeploymentHistoryResponse;
  siteId: string;
  t: Translator;
  targetLang: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Deployments</CardTitle>
        <CardDescription>
          Customer-safe deployment events for {response.targetLang.toUpperCase()}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {response.entries.length ? (
          response.entries.map((entry, index) => (
            <div
              className="rounded-md border border-border/60 bg-muted/20 p-3"
              key={`${entry.createdAt ?? "deployment"}:${index}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {formatCustomerCopy(t, entry.titleKey, {
                      fallback: formatCustomerStatusValue(entry.customerStatus),
                      params: entry.params,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Published {formatDate(entry.publishedAt ?? entry.createdAt)}
                  </p>
                </div>
                <StatusBadge tone={toneForStatus(entry.customerStatus)}>
                  {formatCustomerStatusValue(entry.customerStatus)}
                </StatusBadge>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <HistoryMetric label="Pages" value={formatCount(entry.pageCount)} />
                <HistoryMetric
                  label="Raw status"
                  value={formatCustomerStatusValue(entry.rawStatus)}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No deployment events for this locale.</p>
        )}
        <PaginationLinks
          currentPage={page}
          nextOffset={response.pagination.nextOffset}
          siteId={siteId}
          targetLang={targetLang}
          type="deployments"
        />
      </CardContent>
    </Card>
  );
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function PaginationLinks({
  currentPage,
  nextOffset,
  siteId,
  targetLang,
  type,
}: {
  currentPage: number;
  nextOffset?: number | null;
  siteId: string;
  targetLang: string;
  type: "runs" | "deployments";
}) {
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = nextOffset == null ? null : currentPage + 1;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {currentPage > 1 ? (
        <Button asChild size="sm" variant="outline">
          <Link href={historyHref(siteId, { targetLang, [`${type}Page`]: String(previousPage) })}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
        </Button>
      ) : (
        <Button disabled size="sm" variant="outline">
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
      )}
      <span className="text-sm text-muted-foreground">Page {currentPage}</span>
      {nextPage ? (
        <Button asChild size="sm" variant="outline">
          <Link href={historyHref(siteId, { targetLang, [`${type}Page`]: String(nextPage) })}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Button disabled size="sm" variant="outline">
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function readPageNumber(rawValue?: string): number {
  if (!rawValue || !/^\d+$/.test(rawValue)) {
    return 1;
  }
  return Math.max(1, Number.parseInt(rawValue, 10));
}

function resolveSelectedTargetLang(targetLangs: string[], requested?: string): string | null {
  if (!targetLangs.length) {
    return null;
  }
  if (requested && targetLangs.includes(requested)) {
    return requested;
  }
  return targetLangs[0];
}

function historyHref(siteId: string, params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      qs.set(key, value);
    }
  }
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return `/dashboard/sites/${siteId}/history${suffix}`;
}

function logProjectionError(
  siteId: string,
  auth: Awaited<ReturnType<typeof requireDashboardAuth>>,
  err: unknown,
) {
  if (err instanceof WebhooksApiError) {
    console.warn("[dashboard] fetch history languages projection failed", {
      siteId,
      status: err.status,
      message: err.message,
      details: err.details ?? null,
      subjectAccountId: auth.subjectAccountId,
      actorAccountId: auth.actorAccountId,
      actingAsCustomer: auth.actingAsCustomer,
    });
  } else {
    console.warn("[dashboard] fetch history languages projection failed (unknown error)", {
      siteId,
      message: err,
    });
  }
}

function logHistoryError(
  siteId: string,
  targetLang: string,
  auth: Awaited<ReturnType<typeof requireDashboardAuth>>,
  err: unknown,
) {
  if (err instanceof WebhooksApiError) {
    console.warn("[dashboard] fetch history failed", {
      siteId,
      targetLang,
      status: err.status,
      message: err.message,
      details: err.details ?? null,
      subjectAccountId: auth.subjectAccountId,
      actorAccountId: auth.actorAccountId,
      actingAsCustomer: auth.actingAsCustomer,
    });
  } else {
    console.warn("[dashboard] fetch history failed (unknown error)", {
      siteId,
      targetLang,
      message: err,
    });
  }
}
