import Link from "next/link";
import { headers } from "next/headers";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { ActionForm } from "@/components/dashboard/action-form";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { formatCustomerCopy, formatCustomerStatusValue } from "@internal/dashboard/customer-copy";
import {
  fetchCustomerDeploymentHistory,
  fetchCustomerTranslationRuns,
  WebhooksApiError,
  type CustomerDeploymentHistoryResponse,
  type CustomerTranslationRunsResponse,
} from "@internal/dashboard/webhooks";
import { resolveLocaleTranslator, resolvePreferredLocale, type Translator } from "@internal/i18n";

import {
  cancelTranslationRunAction,
  resumeTranslationRunAction,
  retryFailedTranslationRunAction,
} from "../../../actions";
import {
  FocusedRouteErrorState,
  formatCount,
  formatDate,
  StatusValueBadge,
  toneForStatus,
} from "../focused-route-utils";

export const metadata = {
  title: "History",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 10;

type HistoryKind = "runs" | "deployments";

type HistoryPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    targetLang?: string;
    historyType?: string;
    runsPage?: string;
    deploymentsPage?: string;
  }>;
};

export default async function HistoryPage({ params, searchParams }: HistoryPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const auth = await requireDashboardAuth();
  const authToken = auth.webhooksAuth!;
  const locale = resolvePreferredLocale((await headers()).get("accept-language"));
  const { t } = await resolveLocaleTranslator(Promise.resolve({ locale }));
  const historyType = readHistoryKind(resolvedSearchParams?.historyType);
  const selectedTargetLang = normalizeTargetLang(resolvedSearchParams?.targetLang);
  const runsPage = readPageNumber(resolvedSearchParams?.runsPage);
  const deploymentsPage = readPageNumber(resolvedSearchParams?.deploymentsPage);
  const canManageRuns =
    auth.has({ allFeatures: ["edit", "crawl_trigger"] }) && auth.mutationsAllowed;

  let runs: CustomerTranslationRunsResponse | null = null;
  let deployments: CustomerDeploymentHistoryResponse | null = null;
  let error: unknown = null;

  if (selectedTargetLang) {
    try {
      if (historyType === "deployments") {
        deployments = await fetchCustomerDeploymentHistory(authToken, id, {
          targetLang: selectedTargetLang,
          limit: PAGE_SIZE,
          offset: (deploymentsPage - 1) * PAGE_SIZE,
        });
      } else {
        runs = await fetchCustomerTranslationRuns(authToken, id, {
          targetLang: selectedTargetLang,
          limit: PAGE_SIZE,
          offset: (runsPage - 1) * PAGE_SIZE,
        });
      }
    } catch (err) {
      error = err;
      logHistoryError(id, selectedTargetLang, historyType, auth, err);
    }
  }

  if (error && selectedTargetLang) {
    return (
      <FocusedRouteErrorState
        error={error}
        title="Unable to load history"
        description="We could not complete your request. You can retry or return to the dashboard."
        message="Unable to load history."
      />
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            Translation runs and deployment events load for one locale and one history stream at a
            time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={`/dashboard/sites/${id}/history`}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input name="historyType" type="hidden" value={historyType} />
            <div className="w-full max-w-xs space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="targetLang">
                Target locale
              </label>
              <Input
                id="targetLang"
                name="targetLang"
                defaultValue={selectedTargetLang ?? ""}
                placeholder="fr"
              />
            </div>
            <Button type="submit">
              <Search className="h-4 w-4" />
              Load history
            </Button>
          </form>

          {selectedTargetLang ? (
            <nav aria-label="History stream" className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant={historyType === "runs" ? "default" : "outline"}>
                <Link
                  href={historyHref(id, {
                    targetLang: selectedTargetLang,
                    historyType: "runs",
                  })}
                >
                  Translation runs
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={historyType === "deployments" ? "default" : "outline"}
              >
                <Link
                  href={historyHref(id, {
                    targetLang: selectedTargetLang,
                    historyType: "deployments",
                  })}
                >
                  Deployments
                </Link>
              </Button>
            </nav>
          ) : null}
        </CardContent>
      </Card>

      {!selectedTargetLang ? (
        <Card>
          <CardHeader>
            <CardTitle>Select a locale</CardTitle>
            <CardDescription>
              Choose a target locale before loading translation or deployment history.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : historyType === "deployments" && deployments ? (
        <DeploymentsCard
          page={deploymentsPage}
          response={deployments}
          siteId={id}
          t={t}
          targetLang={selectedTargetLang}
        />
      ) : runs ? (
        <TranslationRunsCard
          canManageRuns={canManageRuns}
          page={runsPage}
          response={runs}
          siteId={id}
          t={t}
          targetLang={selectedTargetLang}
        />
      ) : null}
    </div>
  );
}

function TranslationRunsCard({
  canManageRuns,
  page,
  response,
  siteId,
  t,
  targetLang,
}: {
  canManageRuns: boolean;
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
              <RunActions canManageRuns={canManageRuns} run={run} siteId={siteId} />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No translation runs for this locale.</p>
        )}
        <PaginationLinks
          currentPage={page}
          historyType="runs"
          nextOffset={response.pagination.nextOffset}
          siteId={siteId}
          targetLang={targetLang}
        />
      </CardContent>
    </Card>
  );
}

function RunActions({
  canManageRuns,
  run,
  siteId,
}: {
  canManageRuns: boolean;
  run: CustomerTranslationRunsResponse["runs"][number];
  siteId: string;
}) {
  if (run.customerStatus === "queued" || run.customerStatus === "in_progress") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionForm
          action={cancelTranslationRunAction}
          loading="Cancelling run..."
          success="Translation run cancelled."
          error="Unable to cancel run."
          refreshOnSuccess={true}
        >
          <>
            <input name="siteId" type="hidden" value={siteId} />
            <input name="runId" type="hidden" value={run.id} />
            <Button disabled={!canManageRuns} size="sm" type="submit" variant="outline">
              Cancel run
            </Button>
          </>
        </ActionForm>
      </div>
    );
  }

  if (run.customerStatus === "failed") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionForm
          action={retryFailedTranslationRunAction}
          loading="Retrying run..."
          success="Retry queued."
          error="Unable to retry run."
          refreshOnSuccess={true}
        >
          <>
            <input name="siteId" type="hidden" value={siteId} />
            <input name="runId" type="hidden" value={run.id} />
            <Button disabled={!canManageRuns} size="sm" type="submit" variant="outline">
              Retry failed pages
            </Button>
          </>
        </ActionForm>
      </div>
    );
  }

  if (run.customerStatus === "cancelled") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <ActionForm
          action={resumeTranslationRunAction}
          loading="Resuming run..."
          success="Translation resumed."
          error="Unable to resume run."
          refreshOnSuccess={true}
        >
          <>
            <input name="siteId" type="hidden" value={siteId} />
            <input name="runId" type="hidden" value={run.id} />
            <Button disabled={!canManageRuns} size="sm" type="submit" variant="outline">
              Resume run
            </Button>
          </>
        </ActionForm>
      </div>
    );
  }

  return null;
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
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No deployment events for this locale.</p>
        )}
        <PaginationLinks
          currentPage={page}
          historyType="deployments"
          nextOffset={response.pagination.nextOffset}
          siteId={siteId}
          targetLang={targetLang}
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
  historyType,
  nextOffset,
  siteId,
  targetLang,
}: {
  currentPage: number;
  historyType: HistoryKind;
  nextOffset?: number | null;
  siteId: string;
  targetLang: string;
}) {
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = nextOffset == null ? null : currentPage + 1;
  const pageParam = historyType === "runs" ? "runsPage" : "deploymentsPage";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {currentPage > 1 ? (
        <Button asChild size="sm" variant="outline">
          <Link
            href={historyHref(siteId, {
              targetLang,
              historyType,
              [pageParam]: String(previousPage),
            })}
          >
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
          <Link
            href={historyHref(siteId, {
              targetLang,
              historyType,
              [pageParam]: String(nextPage),
            })}
          >
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

function readHistoryKind(rawValue?: string): HistoryKind {
  return rawValue === "deployments" ? "deployments" : "runs";
}

function normalizeTargetLang(rawValue?: string): string | null {
  const value = rawValue?.trim();
  return value ? value : null;
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

function logHistoryError(
  siteId: string,
  targetLang: string,
  historyType: HistoryKind,
  auth: Awaited<ReturnType<typeof requireDashboardAuth>>,
  err: unknown,
) {
  if (err instanceof WebhooksApiError) {
    console.warn("[dashboard] fetch history failed", {
      siteId,
      targetLang,
      historyType,
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
      historyType,
      message: err,
    });
  }
}
