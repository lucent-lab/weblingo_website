import { describe, expect, it } from "vitest";

import { ANALYTICS_EVENTS, BACKEND_PRODUCED_ANALYTICS_EVENTS } from "./events";
import { buildCommonAnalyticsProperties } from "./envelope";

describe("analytics envelope helpers", () => {
  it("keeps backend-produced events on the explicit backend app surface", () => {
    for (const eventName of BACKEND_PRODUCED_ANALYTICS_EVENTS) {
      expect(
        buildCommonAnalyticsProperties(eventName, {
          app_surface: "webhooks_worker",
        }),
      ).toMatchObject({
        app_surface: "webhooks_worker",
        repo: "weblingo_website",
      });
    }
  });

  it("routes sanitized exceptions to the surface implied by route metadata", () => {
    expect(
      buildCommonAnalyticsProperties(ANALYTICS_EVENTS.posthogException, {
        route_template: "/dashboard/sites/[id]/pages",
      }),
    ).toMatchObject({ app_surface: "dashboard" });

    expect(
      buildCommonAnalyticsProperties(ANALYTICS_EVENTS.posthogException, {
        route_area: "api",
        route_template: "/api/checkout/session",
      }),
    ).toMatchObject({ app_surface: "api" });

    expect(
      buildCommonAnalyticsProperties(ANALYTICS_EVENTS.posthogException, {
        route_template: "/login",
      }),
    ).toMatchObject({ app_surface: "auth" });
  });
});
