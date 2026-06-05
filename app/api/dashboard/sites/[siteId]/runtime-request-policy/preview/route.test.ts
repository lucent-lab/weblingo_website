import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardAuth } from "@internal/dashboard/auth";

import { POST } from "./route";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { previewRuntimeRequestPolicy } from "@internal/dashboard/webhooks";

vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: vi.fn(),
}));

vi.mock("@internal/dashboard/webhooks", () => {
  class WebhooksApiError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }
  return {
    previewRuntimeRequestPolicy: vi.fn(),
    WebhooksApiError,
  };
});

const mockedRequireDashboardAuth = vi.mocked(requireDashboardAuth);
const mockedPreviewRuntimeRequestPolicy = vi.mocked(previewRuntimeRequestPolicy);

function makeAuth(): DashboardAuth {
  return {
    accessMode: "supabase",
    user: null,
    session: null,
    demoSession: null,
    webhooksAuth: {
      token: "subject-token",
      expiresAt: "2026-01-01T00:00:00.000Z",
      subjectAccountId: "acct-customer",
      refresh: async () => "subject-token",
    },
    account: null,
    actorAccount: null,
    subjectAccount: null,
    actorWebhooksAuth: null,
    agencyCustomers: null,
    actorAccountId: "acct-agency",
    subjectAccountId: "acct-customer",
    actingAsCustomer: true,
    actorPlanActive: true,
    subjectPlanActive: true,
    mutationsAllowed: true,
    billingIssue: null,
    stripeBillingRuntime: null,
    has: () => true,
  };
}

function makePolicy() {
  return {
    schemaVersion: 1 as const,
    mode: "standard" as const,
    enabled: true,
    rules: [],
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/dashboard/sites/[siteId]/runtime-request-policy/preview", () => {
  it("uses the subject-scoped dashboard auth context", async () => {
    const auth = makeAuth();
    mockedRequireDashboardAuth.mockResolvedValue(auth);
    mockedPreviewRuntimeRequestPolicy.mockResolvedValue({
      runtimeRequestPolicy: makePolicy(),
      validationErrors: [],
      warnings: [],
      collisions: [],
      highRiskConfirmations: [],
      sampleResults: [],
      matchedObservationGroups: [],
      propagation: {
        currentRouteConfigUpdatedAt: "2026-05-04T00:00:00.000Z",
        currentRuntimeRequestPolicyVersion: "site-config:2026-05-04T00:00:00.000Z",
      },
    });

    const payload = { runtimeRequestPolicy: makePolicy() };
    const response = await POST(
      new Request("http://localhost/api/dashboard/sites/site-1/runtime-request-policy/preview", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ siteId: "site-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockedPreviewRuntimeRequestPolicy).toHaveBeenCalledWith(
      auth.webhooksAuth,
      "site-1",
      payload,
    );
  });

  it("forwards stable backend validation codes", async () => {
    mockedRequireDashboardAuth.mockResolvedValue(makeAuth());
    const { WebhooksApiError } = await import("@internal/dashboard/webhooks");
    mockedPreviewRuntimeRequestPolicy.mockRejectedValue(
      new WebhooksApiError("runtimeRequestPolicy failed validation", 400, {
        code: "runtime_request_policy_validation_failed",
        validationErrors: [{ code: "confirmation_required_non_get_proxy", ruleId: "cart" }],
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/dashboard/sites/site-1/runtime-request-policy/preview", {
        method: "POST",
        body: JSON.stringify({ runtimeRequestPolicy: makePolicy() }),
      }),
      { params: Promise.resolve({ siteId: "site-1" }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.details.validationErrors[0].code).toBe("confirmation_required_non_get_proxy");
  });
});
