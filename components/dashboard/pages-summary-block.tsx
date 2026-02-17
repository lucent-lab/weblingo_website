import type { SitePagesSummary } from "@internal/dashboard/webhooks";

type PagesSummaryLabels = {
  lastCrawlStarted: string;
  lastCrawlFinished: string;
  pagesUpdated: string;
  pagesPendingCrawl: string;
  remainingPageCrawlsToday: string;
  unavailable: string;
};

type PagesSummaryBlockProps = {
  summary?: SitePagesSummary | null;
  remainingQuotaLabel: string;
  labels: PagesSummaryLabels;
  locale?: string;
};

export function PagesSummaryBlock({
  summary,
  remainingQuotaLabel,
  labels,
  locale = "en",
}: PagesSummaryBlockProps) {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <SummaryStat
        label={labels.lastCrawlStarted}
        value={formatTimestamp(summary?.lastCrawlStartedAt, formatter, labels.unavailable)}
      />
      <SummaryStat
        label={labels.lastCrawlFinished}
        value={formatTimestamp(summary?.lastCrawlFinishedAt, formatter, labels.unavailable)}
      />
      <SummaryStat label={labels.pagesUpdated} value={String(summary?.pagesUpdated ?? 0)} />
      <SummaryStat label={labels.pagesPendingCrawl} value={String(summary?.pagesPending ?? 0)} />
      <SummaryStat label={labels.remainingPageCrawlsToday} value={remainingQuotaLabel} />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatTimestamp(
  value: string | null | undefined,
  formatter: Intl.DateTimeFormat,
  unavailable: string,
): string {
  if (!value) {
    return unavailable;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return formatter.format(new Date(parsed));
}
