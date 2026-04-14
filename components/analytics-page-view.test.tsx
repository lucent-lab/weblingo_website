// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { captureAnalyticsEventMock } = vi.hoisted(() => ({
  captureAnalyticsEventMock: vi.fn(),
}));

vi.mock("@internal/analytics/client", () => ({
  captureAnalyticsEvent: captureAnalyticsEventMock,
}));

import { AnalyticsPageView } from "./analytics-page-view";

describe("AnalyticsPageView", () => {
  afterEach(() => {
    captureAnalyticsEventMock.mockReset();
  });

  it("captures a page view once on mount", async () => {
    render(
      <AnalyticsPageView
        event="pricing_page_view"
        properties={{ locale: "en", page_path: "/en/pricing" }}
      />,
    );
    await waitFor(() => {
      expect(captureAnalyticsEventMock).toHaveBeenCalledWith("pricing_page_view", {
        locale: "en",
        page_path: "/en/pricing",
      });
      expect(captureAnalyticsEventMock).toHaveBeenCalledTimes(1);
    });
  });

  it("captures a new page view when the same page is visited again", async () => {
    const firstRender = render(
      <AnalyticsPageView
        event="pricing_page_view"
        properties={{ locale: "en", page_path: "/en/pricing" }}
      />,
    );
    await waitFor(() => {
      expect(captureAnalyticsEventMock).toHaveBeenCalledTimes(1);
    });
    firstRender.unmount();

    render(
      <AnalyticsPageView
        event="pricing_page_view"
        properties={{ locale: "en", page_path: "/en/pricing" }}
      />,
    );
    await waitFor(() => {
      expect(captureAnalyticsEventMock).toHaveBeenCalledTimes(2);
    });
  });
});
