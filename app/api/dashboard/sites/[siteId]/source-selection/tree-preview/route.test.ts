import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardAuth } from "@internal/dashboard/auth";

import { POST } from "./route";
import { requireDashboardAuth } from "@internal/dashboard/auth";
import { previewSourceSelectionTree } from "@internal/dashboard/webhooks";

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
    previewSourceSelectionTree: vi.fn(),
    WebhooksApiError,
  };
});

const mockedRequireDashboardAuth = vi.mocked(requireDashboardAuth);
const mockedPreviewSourceSelectionTree = vi.mocked(previewSourceSelectionTree);

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

describe("POST /api/dashboard/sites/[siteId]/source-selection/tree-preview", () => {
  it("uses the subject auth context and forwards tree query options", async () => {
    const auth = makeAuth();
    mockedRequireDashboardAuth.mockResolvedValue(auth);
    mockedPreviewSourceSelectionTree.mockResolvedValue({
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
      nodes: [],
      pagination: { limit: 100, total: 0, hasMore: false },
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
      inventory: {
        knownPagesTotal: 1,
        resultNodesTotal: 0,
        resultMode: "children",
        summaryScope: "global_known_pages",
        resultScope: "filtered_tree_nodes",
        parentPath: "/products",
        maxPageSize: 200,
        complete: true,
      },
    });

    const response = await POST(
      new Request(
        "http://localhost/api/dashboard/sites/site-1/source-selection/tree-preview?limit=100&parentPath=/products",
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
    expect(mockedPreviewSourceSelectionTree).toHaveBeenCalledWith(
      auth.webhooksAuth,
      "site-1",
      {
        sourceSelection: { rules: [{ action: "exclude", pattern: "/products/*" }] },
      },
      { limit: 100, parentPath: "/products" },
    );
  });

  it.each([
    ["limit=0", "limit must be at least 1."],
    ["limit=201", "limit must be at most 200."],
    ["limit=1.5", "limit must be an integer."],
    ["parentPath=blog", "parentPath must start with /."],
  ])("rejects invalid tree query %s", async (query, message) => {
    mockedRequireDashboardAuth.mockResolvedValue(makeAuth());

    const response = await POST(
      new Request(
        `http://localhost/api/dashboard/sites/site-1/source-selection/tree-preview?${query}`,
        {
          method: "POST",
          body: JSON.stringify({ sourceSelection: { rules: [] } }),
        },
      ),
      { params: Promise.resolve({ siteId: "site-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: message });
    expect(mockedPreviewSourceSelectionTree).not.toHaveBeenCalled();
  });
});
