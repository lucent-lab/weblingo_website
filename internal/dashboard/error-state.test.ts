import { describe, expect, it } from "vitest";

import { WebhooksApiError } from "./webhooks";
import { resolveDashboardErrorView } from "./error-state";

describe("dashboard error state", () => {
  it("classifies account-missing errors consistently", () => {
    const view = resolveDashboardErrorView(new Error("account not found"), {
      title: "Fallback",
      description: "Fallback description",
    });

    expect(view.kind).toBe("account_missing");
    expect(view.title).toBe("Account not provisioned");
  });

  it("classifies timeouts consistently", () => {
    const view = resolveDashboardErrorView(
      new WebhooksApiError("The WebLingo API request timed out. Please retry.", 504),
      {
        title: "Fallback",
        description: "Fallback description",
      },
    );

    expect(view.kind).toBe("timeout");
    expect(view.title).toBe("Request timed out");
  });

  it("classifies backend unavailability consistently", () => {
    const view = resolveDashboardErrorView(new WebhooksApiError("service unavailable", 503), {
      title: "Fallback",
      description: "Fallback description",
    });

    expect(view.kind).toBe("backend_unavailable");
    expect(view.title).toBe("Dashboard service unavailable");
  });
});
