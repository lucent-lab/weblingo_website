// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PagesSummaryBlock } from "./pages-summary-block";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("PagesSummaryBlock", () => {
  const labels = {
    lastCrawlStarted: "Last crawl started",
    lastCrawlFinished: "Last crawl finished",
    pagesUpdated: "Pages updated",
    pagesPendingCrawl: "Pages pending crawl",
    remainingPageCrawlsToday: "Remaining page crawls today",
    unavailable: "—",
  };

  it("renders crawl/page summary metrics", () => {
    render(
      <PagesSummaryBlock
        locale="en-US"
        remainingQuotaLabel="12 remaining today"
        labels={labels}
        summary={{
          lastCrawlStartedAt: "2026-02-17T10:00:00Z",
          lastCrawlFinishedAt: "2026-02-17T10:12:00Z",
          pagesUpdated: 14,
          pagesPending: 3,
        }}
      />,
    );

    expect(screen.getByText("Pages updated")).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByText("Pages pending crawl")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("12 remaining today")).toBeTruthy();
  });

  it("falls back when summary values are missing", () => {
    render(<PagesSummaryBlock remainingQuotaLabel="Unlimited" labels={labels} summary={null} />);
    expect(screen.getByText("Remaining page crawls today")).toBeTruthy();
    expect(screen.getByText("Unlimited")).toBeTruthy();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
