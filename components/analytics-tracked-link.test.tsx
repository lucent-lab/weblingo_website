// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { captureAnalyticsEventMock } = vi.hoisted(() => ({
  captureAnalyticsEventMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a {...props} href={href}>
      {children}
    </a>
  ),
}));

vi.mock("@internal/analytics/client", () => ({
  captureAnalyticsEvent: captureAnalyticsEventMock,
}));

import { AnalyticsTrackedLink } from "./analytics-tracked-link";

describe("AnalyticsTrackedLink", () => {
  afterEach(() => {
    captureAnalyticsEventMock.mockReset();
  });

  it("captures analytics for internal links", () => {
    render(
      <AnalyticsTrackedLink
        analyticsProperties={{ cta_id: "pricing_final_start_free" }}
        event="pricing_cta_clicked"
        href="/en/login"
      >
        Start free
      </AnalyticsTrackedLink>,
    );

    fireEvent.click(screen.getByText("Start free"), { button: 0 });

    expect(captureAnalyticsEventMock).toHaveBeenCalledWith(
      "pricing_cta_clicked",
      {
        cta_id: "pricing_final_start_free",
      },
      { sendInstantly: true },
    );
  });

  it("skips analytics when a consumer prevents default navigation", () => {
    render(
      <AnalyticsTrackedLink
        event="marketing_cta_clicked"
        href="/en#try"
        onClick={(event) => event.preventDefault()}
      >
        Try now
      </AnalyticsTrackedLink>,
    );

    fireEvent.click(screen.getByText("Try now"), { button: 0 });

    expect(captureAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("captures analytics for external links", () => {
    render(
      <AnalyticsTrackedLink
        analyticsProperties={{ cta_id: "pricing_header_contact" }}
        event="pricing_cta_clicked"
        external
        href="mailto:contact@weblingo.app"
      >
        Contact sales
      </AnalyticsTrackedLink>,
    );

    fireEvent.click(screen.getByText("Contact sales"), { button: 0 });

    expect(captureAnalyticsEventMock).toHaveBeenCalledWith(
      "pricing_cta_clicked",
      {
        cta_id: "pricing_header_contact",
      },
      { sendInstantly: true },
    );
  });
});
