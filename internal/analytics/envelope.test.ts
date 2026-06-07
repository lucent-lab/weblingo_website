import { describe, expect, it } from "vitest";

import { BACKEND_PRODUCED_ANALYTICS_EVENTS } from "./events";
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
});
