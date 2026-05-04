import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardAuth } from "@internal/dashboard/auth";

import { POST } from "./route";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { previewSourceSelection } from "@internal/dashboard/webhooks";

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
    previewSourceSelection: vi.fn(),
    WebhooksApiError,
  };
});

const mockedRequireDashboardAuth = vi.mocked(requireDashboardAuth);
const mockedPreviewSourceSelection = vi.mocked(previewSourceSelection);

function makeAuth(): DashboardAuth {
  return {
    user: null,
    session: null,
    webhooksAuth: {
      token: "subject-token",
      expiresAt: "2026-01-01T00:00:00.000Z",
      subjectAccountId: "acct-customer",
      refresh: async () => "subject-token",
    },
    account: null,
    actorAccount: null,
    subjectAccount: null,
    actorWebhooksAuth: {
      token: "actor-token",
      expiresAt: "2026-01-01T00:00:00.000Z",
      subjectAccountId: "acct-agency",
      refresh: async () => "actor-token",
    },
    agencyCustomers: null,
    actorAccountId: "acct-agency",
    subjectAccountId: "acct-customer",
    actingAsCustomer: true,
    subjectFallbackToActor: false,
    actorPlanActive: true,
    subjectPlanActive: true,
    mutationsAllowed: true,
    billingIssue: null,
    stripeBillingRuntime: null,
    has: () => true,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/dashboard/sites/[siteId]/source-selection/preview", () => {
  it("uses the subject-scoped dashboard auth context for agency workspaces", async () => {
    const auth = makeAuth();
    mockedRequireDashboardAuth.mockResolvedValue(auth);
    mockedPreviewSourceSelection.mockResolvedValue({
      sourceSelection: { rules: [{ action: "exclude", pattern: "/products/*" }] },
      summary: {
        knownPagesTotal: 1,
        knownPagesIncluded: 0,
        knownPagesExcluded: 1,
        includedByDefault: 0,
        includedByRule: 0,
        excludedByRule: 1,
        notIncludedByRule: 0,
        canonicalizedByRule: 0,
        rulesTotal: 1,
      },
      affectedPages: [],
      pagination: { limit: 100, offset: 0, total: 1, hasMore: false },
      warnings: [],
      impact: {
        scope: "known_pages",
        changedKnownPages: 0,
        selectedToExcluded: { count: 0, sourcePaths: [] },
        activeSiteRerun: {
          required: false,
          basis: "site_status_and_config_change",
          activeDeploymentCount: 0,
          deploymentImpact: "not_estimated",
        },
      },
    });

    const response = await POST(
      new Request(
        "http://localhost/api/dashboard/sites/site-1/source-selection/preview?limit=100",
        {
          method: "POST",
          body: JSON.stringify({
            sourceSelection: { rules: [{ action: "exclude", pattern: "/products/*" }] },
          }),
        },
      ),
      { params: Promise.resolve({ siteId: "site-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockedPreviewSourceSelection).toHaveBeenCalledWith(
      auth.webhooksAuth,
      "site-1",
      {
        sourceSelection: { rules: [{ action: "exclude", pattern: "/products/*" }] },
      },
      { limit: 100 },
    );
  });

  it("forwards structured validation details from the backend preview", async () => {
    mockedRequireDashboardAuth.mockResolvedValue(makeAuth());
    const { WebhooksApiError } = await import("@internal/dashboard/webhooks");
    mockedPreviewSourceSelection.mockRejectedValue(
      new WebhooksApiError(
        "sourceSelection.rules[0].pattern must use exact paths or /* wildcards",
        400,
        {
          code: "source_selection_validation_failed",
          validation: {
            field: "sourceSelection.rules[0].pattern",
            message: "sourceSelection.rules[0].pattern must use exact paths or /* wildcards",
          },
        },
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/dashboard/sites/site-1/source-selection/preview", {
        method: "POST",
        body: JSON.stringify({
          sourceSelection: { rules: [{ action: "include", pattern: "/blog*" }] },
        }),
      }),
      { params: Promise.resolve({ siteId: "site-1" }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.details.validation.field).toBe("sourceSelection.rules[0].pattern");
  });

  it.each([
    ["limit=0", "limit must be at least 1."],
    ["limit=201", "limit must be at most 200."],
    ["limit=1.5", "limit must be an integer."],
    ["limit=abc", "limit must be an integer."],
    ["offset=-1", "offset must be at least 0."],
    ["offset=1.5", "offset must be an integer."],
  ])("rejects invalid pagination query %s", async (query, message) => {
    mockedRequireDashboardAuth.mockResolvedValue(makeAuth());

    const response = await POST(
      new Request(`http://localhost/api/dashboard/sites/site-1/source-selection/preview?${query}`, {
        method: "POST",
        body: JSON.stringify({
          sourceSelection: { rules: [] },
        }),
      }),
      { params: Promise.resolve({ siteId: "site-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: message });
    expect(mockedPreviewSourceSelection).not.toHaveBeenCalled();
  });
});
