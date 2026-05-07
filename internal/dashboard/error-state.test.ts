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
    expect(view.message).toBe("The dashboard service is unavailable right now.");
    expect(view.nextSteps).toContain("Retry in a moment.");
    expect(view.referenceCode).toBe("webhooks_http_503");
  });

  it("turns schema mismatches into actionable contract recovery copy", () => {
    const view = resolveDashboardErrorView(
      new WebhooksApiError("The WebLingo API returned an unexpected dashboard response.", 200, {
        code: "response_schema_mismatch",
        issues: [
          {
            code: "invalid_value",
            path: ["runs", 5, "customerError", "area"],
            message: "Invalid option",
          },
        ],
      }),
      {
        title: "Unable to load history",
        description: "Fallback description",
        message: "Unable to load history.",
      },
    );

    expect(view.kind).toBe("contract_mismatch");
    expect(view.title).toBe("This section cannot be shown safely");
    expect(view.message).toContain("This section is paused");
    expect(view.nextSteps).toContain("Retry this section once to rule out a stale response.");
    expect(view.referenceCode).toBe("response_schema_mismatch");
    expect(view.message).not.toContain("invalid_value");
    expect(view.message).not.toContain("customerError");
  });

  it("treats dashboard contract mismatch codes as safe recovery states", () => {
    const view = resolveDashboardErrorView(
      new WebhooksApiError("The dashboard received incomplete domain setup data.", 200, {
        code: "dashboard_domain_setup_contract_mismatch",
      }),
      {
        title: "Unable to load domains",
        description: "Fallback description",
        message: "Unable to load domain setup.",
      },
    );

    expect(view.kind).toBe("contract_mismatch");
    expect(view.referenceCode).toBe("dashboard_domain_setup_contract_mismatch");
    expect(view.message).toContain("This section is paused");
    expect(view.message).not.toContain("incomplete domain setup data");
  });

  it("does not render raw schema or implementation errors to dashboard UI", () => {
    const view = resolveDashboardErrorView(
      new Error(
        '[{"code":"invalid_value","path":["runs",5,"customerError","area"],"message":"Invalid option"}]',
      ),
      {
        title: "Unable to load history",
        description: "Fallback description",
        message: "Unable to load history.",
      },
    );

    expect(view.kind).toBe("unknown");
    expect(view.message).toBe("Unable to load history.");
    expect(view.message).not.toContain("invalid_value");
  });
});
