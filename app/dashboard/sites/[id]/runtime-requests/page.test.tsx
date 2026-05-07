import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSiteDashboardProjection: vi.fn(),
  resolvePreferredLocale: vi.fn(() => "en"),
  resolveLocaleTranslator: vi.fn(async () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  })),
  RuntimeRequestsManager: vi.fn(() => null),
  SiteHeader: vi.fn(() => null),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("@/components/dashboard/error-state-card", () => ({
  ErrorStateCard: () => null,
}));
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: mocks.requireDashboardAuth,
}));
vi.mock("@internal/dashboard/error-state", () => ({
  resolveDashboardErrorView: vi.fn((error, fallback) => ({
    ...fallback,
    message: error instanceof Error ? error.message : fallback.message,
  })),
}));
vi.mock("@internal/dashboard/webhooks", () => ({
  fetchSiteDashboardProjection: mocks.fetchSiteDashboardProjection,
  WebhooksApiError: class WebhooksApiError extends Error {
    status = 500;
    details = null;
  },
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));
vi.mock("../../../actions", () => ({
  listRuntimeRequestObservationsAction: vi.fn(),
  updateRuntimeRequestObservationLifecycleAction: vi.fn(),
  updateRuntimeRequestPolicyAction: vi.fn(),
}));
vi.mock("../locked-feature-card", () => ({
  LockedFeatureCard: () => null,
}));
vi.mock("../site-header", () => ({
  SiteHeader: mocks.SiteHeader,
}));
vi.mock("./runtime-requests-manager", () => ({
  RuntimeRequestsManager: mocks.RuntimeRequestsManager,
}));

function findElement(node: unknown, type: unknown): Record<string, unknown> | null {
  if (!node) {
    return null;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (!isValidElement(node)) {
    return null;
  }
  if (node.type === type) {
    return node.props as Record<string, unknown>;
  }
  const props = node.props as { children?: unknown };
  return findElement(props.children, type);
}

describe("RuntimeRequestsPage", () => {
  it("loads only the focused developer-tools projection on first paint", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    const runtimeRequestPolicy = {
      schemaVersion: 1,
      mode: "standard",
      enabled: true,
      rules: [
        {
          id: "cart-proxy",
          name: "Cart proxy",
          enabled: true,
          pattern: "/api/cart",
          methods: ["POST"],
          action: "proxy",
          credentials: "same_origin",
          cache: "no-store",
          maxBodyBytes: 1024,
          maxResponseBytes: 1048576,
          timeoutMs: 5000,
          redirectScope: "same_origin",
          requestHeaders: { allow: [] },
          responseHeaders: { allow: [] },
          requestContentTypes: [],
          responseContentTypes: [],
          neutralization: {
            shape: "empty_json",
            status: 200,
            contentType: "application/json",
            body: "{}",
          },
          confirmations: ["non_get_proxy"],
        },
      ],
    };
    mocks.requireDashboardAuth.mockResolvedValue({
      webhooksAuth: authToken,
      mutationsAllowed: true,
      has: vi.fn().mockReturnValue(true),
      actorAccountId: "acct-1",
      subjectAccountId: "acct-1",
      actingAsCustomer: false,
      subjectFallbackToActor: false,
    });
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: { view: "developer_tools" },
      site: {
        id: "site-1",
        sourceUrl: "https://example.com",
        sourceLang: "en",
        status: "active",
      },
      access: {
        mutationsAllowed: true,
        lockedReasonCode: null,
        features: {},
        canEditRuntime: true,
        canEditWebhooks: true,
        canViewRuntimeRequests: true,
      },
      runtime: {},
      webhooks: { url: null, events: [], hasSecret: false },
      snippets: { available: false },
      runtimeRequests: {
        available: true,
        policy: runtimeRequestPolicy,
        policySummary: {
          rulesCount: 1,
          fingerprint: "fingerprint-1",
          version: "site-config:v1",
          lastUpdatedAt: "2026-05-07T00:00:00.000Z",
        },
        propagation: {
          servedVersion: "site-config:v1",
          expectedVersion: "site-config:v1",
          stale: false,
        },
        pageHref: "/dashboard/sites/site-1/runtime-requests",
        observationsHref: "/api/sites/site-1/runtime-requests/observations",
        policyPreviewHref: "/api/sites/site-1/runtime-request-policy/preview",
      },
    });

    vi.resetModules();
    const { default: RuntimeRequestsPage } = await import("./page");

    const tree = await RuntimeRequestsPage({
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(mocks.fetchSiteDashboardProjection).toHaveBeenCalledWith(
      authToken,
      "site-1",
      "developer_tools",
    );
    expect(findElement(tree, mocks.SiteHeader)).toMatchObject({
      site: expect.objectContaining({ id: "site-1" }),
    });
    expect(findElement(tree, mocks.RuntimeRequestsManager)).toMatchObject({
      siteId: "site-1",
      initialPolicy: runtimeRequestPolicy,
      runtimeRequestPolicyFingerprint: "fingerprint-1",
      runtimeRequestPolicyVersion: "site-config:v1",
      propagation: expect.objectContaining({ stale: false }),
      observations: [],
      observationsLoaded: false,
      canEdit: true,
      canLoadObservations: true,
    });
  });

  it("keeps runtime observations readable when edit mutations are locked", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue({
      webhooksAuth: authToken,
      mutationsAllowed: false,
      has: vi.fn((check: { feature?: string }) => check.feature !== "edit"),
      actorAccountId: "acct-1",
      subjectAccountId: "acct-1",
      actingAsCustomer: false,
      subjectFallbackToActor: false,
    });
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: { view: "developer_tools" },
      site: {
        id: "site-1",
        sourceUrl: "https://example.com",
        sourceLang: "en",
        status: "active",
      },
      access: {
        mutationsAllowed: false,
        lockedReasonCode: "billing_inactive",
        features: {},
        canEditRuntime: false,
        canEditWebhooks: false,
        canViewRuntimeRequests: true,
      },
      runtime: {},
      webhooks: { url: null, events: [], hasSecret: false },
      snippets: { available: false },
      runtimeRequests: {
        available: true,
        policy: { schemaVersion: 1, mode: "standard", enabled: true, rules: [] },
        policySummary: {
          rulesCount: 0,
          fingerprint: "fingerprint-1",
          version: "site-config:v1",
          lastUpdatedAt: null,
        },
        propagation: null,
      },
    });

    vi.resetModules();
    const { default: RuntimeRequestsPage } = await import("./page");

    const tree = await RuntimeRequestsPage({
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(findElement(tree, mocks.RuntimeRequestsManager)).toMatchObject({
      siteId: "site-1",
      canEdit: false,
      canLoadObservations: true,
      observationsLoaded: false,
    });
  });
});
