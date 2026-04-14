// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
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
      <StrictMode>
        <AnalyticsPageView
          event="pricing_page_view"
          properties={{ locale: "en", page_path: "/en/pricing" }}
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(captureAnalyticsEventMock).toHaveBeenCalledWith("pricing_page_view", {
        locale: "en",
        page_path: "/en/pricing",
      });
    });
    expect(captureAnalyticsEventMock).toHaveBeenCalledTimes(1);
  });
});
