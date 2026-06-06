import { describe, expect, it } from "vitest";

import { localizeDashboardRouteHref } from "./focused-route-utils";

describe("localizeDashboardRouteHref", () => {
  it("preserves the dashboard handoff locale on site routes and dashboard home", () => {
    expect(localizeDashboardRouteHref("/dashboard", "fr")).toBe("/dashboard?locale=fr");
    expect(localizeDashboardRouteHref("/dashboard/sites/site-1", "fr")).toBe(
      "/dashboard/sites/site-1?locale=fr",
    );
    expect(localizeDashboardRouteHref("/dashboard/sites/site-1#activate-demo", "fr")).toBe(
      "/dashboard/sites/site-1?locale=fr#activate-demo",
    );
  });

  it("leaves non-dashboard destinations untouched", () => {
    expect(localizeDashboardRouteHref("/fr/pricing", "fr")).toBe("/fr/pricing");
    expect(localizeDashboardRouteHref("https://example.com/dashboard", "fr")).toBe(
      "https://example.com/dashboard",
    );
    expect(localizeDashboardRouteHref("#activate-demo", "fr")).toBe("#activate-demo");
  });
});
