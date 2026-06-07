// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/dashboard/sites/site-1/history";
let searchParams = new URLSearchParams({ targetLang: "fr" });

const mocks = vi.hoisted(() => ({
  captureAnalyticsEvent: vi.fn(),
  groupAnalyticsSite: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
}));

vi.mock("@internal/analytics/client", () => ({
  ANALYTICS_EVENTS: {
    siteDashboardViewed: "site_dashboard_viewed",
  },
  buildNavigationAnalyticsProperties: ({ pathname: currentPathname }: { pathname: string }) => ({
    dashboard_route: true,
    route_template: currentPathname.replace(/\/dashboard\/sites\/[^/]+/, "/dashboard/sites/[id]"),
  }),
  buildNavigationQueryCaptureKey: (params: URLSearchParams) =>
    params.get("targetLang") ? `targetLang:${params.get("targetLang")}` : "none",
  captureAnalyticsEvent: mocks.captureAnalyticsEvent,
  groupAnalyticsSite: mocks.groupAnalyticsSite,
}));

vi.mock("@internal/analytics/navigation", () => ({
  resolveDashboardRouteFeature: () => "deployment_history",
}));

import { DashboardSiteAnalyticsScope } from "./site-analytics-scope";

describe("DashboardSiteAnalyticsScope", () => {
  beforeEach(() => {
    pathname = "/dashboard/sites/site-1/history";
    searchParams = new URLSearchParams({ targetLang: "fr" });
    mocks.captureAnalyticsEvent.mockReset();
    mocks.groupAnalyticsSite.mockReset();
  });

  it("tracks semantic search-param changes on the same site route", async () => {
    const rendered = render(<DashboardSiteAnalyticsScope accountId="acct-1" siteId="site-1" />);

    await waitFor(() => {
      expect(mocks.captureAnalyticsEvent).toHaveBeenCalledTimes(1);
    });

    searchParams = new URLSearchParams({ targetLang: "de" });
    rendered.rerender(<DashboardSiteAnalyticsScope accountId="acct-1" siteId="site-1" />);

    await waitFor(() => {
      expect(mocks.captureAnalyticsEvent).toHaveBeenCalledTimes(2);
    });
    expect(mocks.captureAnalyticsEvent).toHaveBeenLastCalledWith(
      "site_dashboard_viewed",
      expect.objectContaining({
        account_id: "acct-1",
        feature: "deployment_history",
        route_template: "/dashboard/sites/[id]/history",
        site_id: "site-1",
      }),
    );
  });
});
