// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

const { captureAnalyticsEvent } = vi.hoisted(() => ({
  captureAnalyticsEvent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams() {
    return new URLSearchParams("message=boom&trace=secret-trace");
  },
}));

vi.mock("@internal/analytics/client", () => ({
  ANALYTICS_EVENTS: {
    appErrorViewed: "app_error_viewed",
  },
  captureAnalyticsEvent,
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  type LinkProps = { href: unknown; children?: ReactNode } & Record<string, unknown>;
  return {
    default: ({ href, children, ...props }: LinkProps) =>
      React.createElement("a", { href: String(href), ...props }, children),
  };
});

describe("ErrorPageClient", () => {
  it("does not log query-param diagnostics in production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const groupSpy = vi.spyOn(console, "group").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const groupEndSpy = vi.spyOn(console, "groupEnd").mockImplementation(() => {});

    vi.resetModules();
    const { default: ErrorPageClient } = await import("./error-page-client");
    render(<ErrorPageClient />);

    // Flush effects.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(groupSpy).not.toHaveBeenCalledWith("Error page diagnostics");
    expect(errorSpy).not.toHaveBeenCalledWith("Trace:", "secret-trace");
    expect(infoSpy).not.toHaveBeenCalledWith("Context:", expect.anything());
    expect(groupEndSpy).not.toHaveBeenCalled();
    expect(captureAnalyticsEvent).toHaveBeenCalledWith("app_error_viewed", {
      app_surface: "marketing",
      error_name: "Error",
      feature: "global_error",
      handled: true,
      message_present: true,
      route_template: "/error",
    });

    groupSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
    groupEndSpy.mockRestore();
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  });
});
