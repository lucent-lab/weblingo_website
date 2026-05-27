// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

let pathname = "/en";
let searchParams = new URLSearchParams();

const { captureAnalyticsEventMock } = vi.hoisted(() => ({
  captureAnalyticsEventMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
}));

vi.mock("@internal/analytics/client", async () => {
  const actual = await vi.importActual<typeof import("@internal/analytics/client")>(
    "@internal/analytics/client",
  );

  return {
    ...actual,
    captureAnalyticsEvent: captureAnalyticsEventMock,
  };
});

import { NavigationAnalyticsTracker } from "./navigation-analytics-tracker";

describe("NavigationAnalyticsTracker", () => {
  beforeEach(() => {
    pathname = "/en";
    searchParams = new URLSearchParams();
    captureAnalyticsEventMock.mockReset();
    vi.useRealTimers();
  });

  it("captures the initial route and subsequent route changes once per pathname", async () => {
    const rendered = render(<NavigationAnalyticsTracker />);

    await waitFor(() => {
      expect(captureAnalyticsEventMock).toHaveBeenCalledWith(
        "navigation_page_view",
        expect.objectContaining({
          locale: "en",
          route_template: "/[locale]",
        }),
        { sendInstantly: true },
      );
    });
    expect(captureAnalyticsEventMock).toHaveBeenCalledTimes(1);

    rendered.rerender(<NavigationAnalyticsTracker />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(captureAnalyticsEventMock).toHaveBeenCalledTimes(1);

    pathname = "/dashboard/sites/site_1234567890/settings";
    rendered.rerender(<NavigationAnalyticsTracker />);

    await waitFor(() => {
      expect(captureAnalyticsEventMock).toHaveBeenCalledWith(
        "navigation_page_view",
        expect.objectContaining({
          dashboard_route: true,
          route_template: "/dashboard/sites/[id]/settings",
        }),
        { sendInstantly: true },
      );
    });
    expect(captureAnalyticsEventMock).toHaveBeenCalledTimes(2);
  });

  it("dedupes the immediate StrictMode-style remount without dropping later visits", async () => {
    pathname = "/fr";
    const firstRender = render(<NavigationAnalyticsTracker />);

    await waitFor(() => {
      expect(captureAnalyticsEventMock).toHaveBeenCalledTimes(1);
    });
    firstRender.unmount();

    render(<NavigationAnalyticsTracker />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(captureAnalyticsEventMock).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 1001));
    const laterRender = render(<NavigationAnalyticsTracker />);
    await waitFor(() => {
      expect(captureAnalyticsEventMock).toHaveBeenCalledTimes(2);
    });
    laterRender.unmount();
  });

  it("tracks checkout session presence without sending the session id", async () => {
    pathname = "/en/checkout/success";
    searchParams = new URLSearchParams({ session_id: "cs_secret_123" });

    render(<NavigationAnalyticsTracker />);

    await waitFor(() => {
      expect(captureAnalyticsEventMock).toHaveBeenCalledWith(
        "navigation_page_view",
        expect.objectContaining({
          page_type: "checkout_success",
          route_template: "/[locale]/checkout/success",
          session_present: true,
        }),
        { sendInstantly: true },
      );
    });
    expect(JSON.stringify(captureAnalyticsEventMock.mock.calls)).not.toContain("cs_secret_123");
  });
});
