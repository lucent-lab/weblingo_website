"use client";

import { useCallback } from "react";

import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCustomerStatusValue } from "@internal/dashboard/customer-copy";
import { usePoll } from "@internal/dashboard/use-poll";
import type { SiteCompactStatusResponse } from "@internal/dashboard/webhooks";

type CrawlSummaryClientProps = {
  siteId: string;
  locale: string;
  initialStatus: SiteCompactStatusResponse;
  emptyLabel: string;
  statusLabel: string;
  startedLabel: string;
  finishedLabel: string;
  pagesUpdatedLabel: string;
  pagesPendingLabel: string;
  errorLabel: string;
  statusLabels: Record<
    NonNullable<SiteCompactStatusResponse["latestCrawlRun"]>["customerStatus"],
    string
  >;
};

export function CrawlSummaryClient({
  siteId,
  locale,
  initialStatus,
  emptyLabel,
  statusLabel,
  startedLabel,
  finishedLabel,
  pagesUpdatedLabel,
  pagesPendingLabel,
  errorLabel,
  statusLabels,
}: CrawlSummaryClientProps) {
  const fetchStatus = useCallback(async () => {
    const response = await fetch(`/api/dashboard/sites/${siteId}/status`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Unable to load site status.");
    }
    return (await response.json()) as SiteCompactStatusResponse;
  }, [siteId]);

  const isTerminal = useCallback((value: SiteCompactStatusResponse) => !hasActiveWork(value), []);

  const { value: status, error: refreshError } = usePoll<SiteCompactStatusResponse>({
    enabled: hasActiveWork(initialStatus),
    intervalMs: 3000,
    fetcher: fetchStatus,
    isTerminal,
    initial: initialStatus,
  });

  const latestCrawlRun = status.latestCrawlRun ?? null;
  const refreshWarning = refreshError ? (
    <Alert className="border-amber-200 bg-amber-50/60 text-amber-950">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Status refresh delayed</AlertTitle>
      <AlertDescription>
        The crawl summary could not refresh. The values below may be stale; refresh this page before
        making crawl decisions.
      </AlertDescription>
    </Alert>
  ) : null;

  if (!latestCrawlRun) {
    return (
      <div className="space-y-3">
        {refreshWarning}
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  const showError = latestCrawlRun.customerStatus === "failed";
  const errorText = showError
    ? latestCrawlRun.customerError
      ? formatCustomerStatusValue(latestCrawlRun.customerError.code)
      : "Crawl failed"
    : "-";
  const errorTone = showError ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      {refreshWarning}
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs uppercase text-muted-foreground">{statusLabel}</div>
          <Badge variant={resolveCrawlStatusVariant(latestCrawlRun.customerStatus)}>
            {statusLabels[latestCrawlRun.customerStatus] ?? "Status unavailable"}
          </Badge>
        </div>
        <div className="space-y-1">
          <div className="text-xs uppercase text-muted-foreground">{startedLabel}</div>
          <span className="text-muted-foreground">
            {formatTimestamp(latestCrawlRun.startedAt, locale)}
          </span>
        </div>
        <div className="space-y-1">
          <div className="text-xs uppercase text-muted-foreground">{finishedLabel}</div>
          <span className="text-muted-foreground">
            {formatTimestamp(latestCrawlRun.finishedAt, locale)}
          </span>
        </div>
        <div className="space-y-1">
          <div className="text-xs uppercase text-muted-foreground">{pagesUpdatedLabel}</div>
          <span className="font-mono text-foreground">{latestCrawlRun.pagesUpdated ?? "-"}</span>
        </div>
        <div className="space-y-1">
          <div className="text-xs uppercase text-muted-foreground">{pagesPendingLabel}</div>
          <span className="font-mono text-foreground">{latestCrawlRun.pagesPending ?? "-"}</span>
        </div>
        <div className="space-y-1 md:col-span-2">
          <div className="text-xs uppercase text-muted-foreground">{errorLabel}</div>
          <span className={errorTone}>{errorText}</span>
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(value: string | null | undefined, locale: string): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function hasActiveWork(status: SiteCompactStatusResponse): boolean {
  const latestCrawlRun = status.latestCrawlRun ?? null;
  if (
    latestCrawlRun?.customerStatus === "queued" ||
    latestCrawlRun?.customerStatus === "in_progress"
  ) {
    return true;
  }
  return (
    status.activeTranslationRuns?.some(
      (run) => run.customerStatus === "queued" || run.customerStatus === "in_progress",
    ) ?? false
  );
}

function resolveCrawlStatusVariant(
  status: NonNullable<SiteCompactStatusResponse["latestCrawlRun"]>["customerStatus"],
) {
  switch (status) {
    case "completed":
      return "secondary";
    case "failed":
      return "destructive";
    case "queued":
    case "in_progress":
    default:
      return "outline";
  }
}
