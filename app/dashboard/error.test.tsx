// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  captureAnalyticsEvent: vi.fn(),
  resetAnalyticsIdentity: vi.fn(),
  resetBoundary: vi.fn(),
}));

let pathname = "/dashboard/sites/site-demo-123/domains";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({
    back: mocks.back,
  }),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  type LinkProps = { href: unknown; children?: ReactNode } & Record<string, unknown>;
  return {
    default: ({ href, children, ...props }: LinkProps) =>
      React.createElement("a", { href: String(href), ...props }, children),
  };
});

vi.mock("@/app/auth/logout/actions", () => ({
  logout: vi.fn(),
}));

vi.mock("@internal/analytics/client", () => ({
  ANALYTICS_EVENTS: {
    appErrorViewed: "app_error_viewed",
    dashboardErrorRetryClicked: "dashboard_error_retry_clicked",
  },
  buildNavigationAnalyticsProperties: ({
    pathname: currentPathname,
  }: {
    pathname: string | null;
  }) => ({
    route_template: (currentPathname ?? "/dashboard").replace(
      /\/dashboard\/sites\/[^/]+/,
      "/dashboard/sites/[id]",
    ),
  }),
  captureAnalyticsEvent: mocks.captureAnalyticsEvent,
  resetAnalyticsIdentity: mocks.resetAnalyticsIdentity,
}));

import DashboardError from "./error";

describe("DashboardError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/dashboard/sites/site-demo-123/domains";
  });

  afterEach(() => {
    cleanup();
  });

  it("tracks dashboard errors with the current route template", async () => {
    render(<DashboardError error={new Error("first")} reset={mocks.resetBoundary} />);

    await waitFor(() =>
      expect(mocks.captureAnalyticsEvent).toHaveBeenCalledWith("app_error_viewed", {
        app_surface: "dashboard",
        error_digest_present: false,
        error_name: "Error",
        feature: "dashboard_error",
        handled: true,
        route_template: "/dashboard/sites/[id]/domains",
      }),
    );
  });

  it("tracks distinct no-digest errors while the boundary remains mounted", async () => {
    const rendered = render(
      <DashboardError error={new Error("first")} reset={mocks.resetBoundary} />,
    );
    await waitFor(() => expect(mocks.captureAnalyticsEvent).toHaveBeenCalledTimes(1));

    rendered.rerender(<DashboardError error={new Error("second")} reset={mocks.resetBoundary} />);

    await waitFor(() => expect(mocks.captureAnalyticsEvent).toHaveBeenCalledTimes(2));
  });

  it("tracks retry clicks with the current route template", async () => {
    render(<DashboardError error={new Error("first")} reset={mocks.resetBoundary} />);
    await waitFor(() => expect(mocks.captureAnalyticsEvent).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(mocks.captureAnalyticsEvent).toHaveBeenCalledWith(
      "dashboard_error_retry_clicked",
      {
        app_surface: "dashboard",
        error_digest_present: false,
        feature: "dashboard_error",
        handled: true,
        route_template: "/dashboard/sites/[id]/domains",
      },
      { sendInstantly: true },
    );
    expect(mocks.resetBoundary).toHaveBeenCalledTimes(1);
  });
});
