// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SiteCompactStatusResponse } from "@internal/dashboard/webhooks";

import { CrawlSummaryClient } from "./crawl-summary.client";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CrawlSummaryClient", () => {
  it("does not render raw crawl status as a customer-facing error fallback", () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const initialStatus: SiteCompactStatusResponse = {
      siteId: "site-1",
      siteStatus: "active",
      latestCrawlRun: {
        id: "crawl-1",
        rawStatus: "provider_internal_error",
        customerStatus: "failed",
        startedAt: "2026-05-07T00:00:00.000Z",
        finishedAt: "2026-05-07T00:01:00.000Z",
        pagesUpdated: 0,
        pagesPending: 0,
        customerError: null,
      },
      activeTranslationRuns: [],
      currentActivity: [],
      generatedAt: "2026-05-07T00:02:00.000Z",
    };

    render(
      <CrawlSummaryClient
        siteId="site-1"
        initialStatus={initialStatus}
        emptyLabel="No crawl yet."
        statusLabel="Status"
        startedLabel="Started"
        finishedLabel="Finished"
        pagesUpdatedLabel="Updated"
        pagesPendingLabel="Pending"
        errorLabel="Error"
        statusLabels={{
          queued: "Queued",
          in_progress: "In progress",
          completed: "Completed",
          failed: "Failed",
          not_started: "Not started",
          unknown: "Unknown",
        }}
      />,
    );

    expect(screen.getByText("Crawl failed")).toBeTruthy();
    expect(screen.queryByText("provider_internal_error")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
