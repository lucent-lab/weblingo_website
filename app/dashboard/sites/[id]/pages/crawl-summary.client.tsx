"use client";

import { useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { usePoll } from "@internal/dashboard/use-poll";
import type { Site } from "@internal/dashboard/webhooks";

type CrawlSummaryClientProps = {
  siteId: string;
  initialSite: Site;
  emptyLabel: string;
  statusLabel: string;
  triggerLabel: string;
  captureModeLabel: string;
  startedLabel: string;
  finishedLabel: string;
  lastSuccessfulLabel: string;
  discoveredLabel: string;
  enqueuedLabel: string;
  selectedLabel: string;
  skippedLabel: string;
  errorLabel: string;
  statusLabels: Record<"in_progress" | "completed" | "failed", string>;
  triggerLabels: Record<"cron" | "queue", string>;
};

export function CrawlSummaryClient({
  siteId,
  initialSite,
  emptyLabel,
  statusLabel,
  triggerLabel,
  captureModeLabel,
  startedLabel,
  finishedLabel,
  lastSuccessfulLabel,
  discoveredLabel,
  enqueuedLabel,
  selectedLabel,
  skippedLabel,
  errorLabel,
  statusLabels,
  triggerLabels,
}: CrawlSummaryClientProps) {
  const fetchStatus = useCallback(async () => {
    const response = await fetch(`/api/dashboard/sites/${siteId}/status`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Unable to load site status.");
    }
    const data = (await response.json()) as { site: Site };
    return data.site;
  }, [siteId]);

  const isTerminal = useCallback((value: Site) => {
    const latestCrawlRun = value.latestCrawlRun ?? null;
    if (!latestCrawlRun) {
      return true;
    }
    return latestCrawlRun.status === "completed" || latestCrawlRun.status === "failed";
  }, []);

  const { value: site } = usePoll<Site>({
    enabled: true,
    intervalMs: 3000,
    fetcher: fetchStatus,
    isTerminal,
    initial: initialSite,
  });

  const latestCrawlRun = site.latestCrawlRun ?? null;

  if (!latestCrawlRun) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const lastSuccessfulAt = resolveLastSuccessfulAt(latestCrawlRun);
  const showError = latestCrawlRun.status === "failed";
  const errorText = showError ? (latestCrawlRun.error ?? "—") : "—";
  const errorTone =
    showError && latestCrawlRun.error ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      <div className="space-y-1">
        <div className="text-xs uppercase text-muted-foreground">{statusLabel}</div>
        <Badge variant={resolveCrawlStatusVariant(latestCrawlRun.status)}>
          {statusLabels[latestCrawlRun.status] ?? latestCrawlRun.status}
        </Badge>
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase text-muted-foreground">{triggerLabel}</div>
        <span className="font-mono text-foreground">
          {triggerLabels[latestCrawlRun.trigger] ?? latestCrawlRun.trigger}
        </span>
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase text-muted-foreground">{captureModeLabel}</div>
        <span className="font-mono text-foreground">{latestCrawlRun.crawlCaptureMode ?? "—"}</span>
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase text-muted-foreground">{startedLabel}</div>
        <span className="text-muted-foreground">{formatTimestamp(latestCrawlRun.startedAt)}</span>
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase text-muted-foreground">{finishedLabel}</div>
        <span className="text-muted-foreground">{formatTimestamp(latestCrawlRun.finishedAt)}</span>
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase text-muted-foreground">{lastSuccessfulLabel}</div>
        <span className="text-muted-foreground">{formatTimestamp(lastSuccessfulAt)}</span>
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase text-muted-foreground">{discoveredLabel}</div>
        <span className="font-mono text-foreground">{latestCrawlRun.pagesDiscovered ?? "—"}</span>
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase text-muted-foreground">{enqueuedLabel}</div>
        <span className="font-mono text-foreground">{latestCrawlRun.pagesEnqueued ?? "—"}</span>
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase text-muted-foreground">{selectedLabel}</div>
        <span className="font-mono text-foreground">{latestCrawlRun.selectedCount ?? "—"}</span>
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase text-muted-foreground">{skippedLabel}</div>
        <span className="font-mono text-foreground">
          {latestCrawlRun.skippedDueToLimitCount ?? "—"}
        </span>
      </div>
      <div className="space-y-1 md:col-span-2">
        <div className="text-xs uppercase text-muted-foreground">{errorLabel}</div>
        <span className={errorTone}>{errorText}</span>
      </div>
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

function resolveLastSuccessfulAt(
  latestCrawlRun: NonNullable<Site["latestCrawlRun"]>,
): string | null {
  if (latestCrawlRun.status !== "completed") {
    return null;
  }
  return latestCrawlRun.finishedAt ?? latestCrawlRun.updatedAt ?? latestCrawlRun.startedAt ?? null;
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
