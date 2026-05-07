import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSiteDashboardProjection: vi.fn(),
  resolvePreferredLocale: vi.fn(() => "en"),
  resolveLocaleTranslator: vi.fn(async () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  })),
  ErrorStateCard: vi.fn(() => null),
  SourceSelectionManager: vi.fn(() => null),
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
  ErrorStateCard: mocks.ErrorStateCard,
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
  WebhooksApiError: class WebhooksApiError extends Error {},
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));
vi.mock("../../../actions", () => ({
  updateSourceSelectionAction: vi.fn(),
}));
vi.mock("../locked-feature-card", () => ({
  LockedFeatureCard: () => null,
}));
vi.mock("../site-header", () => ({
  SiteHeader: () => null,
}));
vi.mock("./source-selection-manager", () => ({
  SourceSelectionManager: mocks.SourceSelectionManager,
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

describe("SourceSelectionPage", () => {
  it("blocks editing when persisted source-selection rules include unsupported actions", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      webhooksAuth: { token: "token", subjectAccountId: "acct-1" },
      mutationsAllowed: true,
      has: vi.fn().mockReturnValue(true),
      actorAccountId: "acct-1",
      subjectAccountId: "acct-1",
      actingAsCustomer: false,
      subjectFallbackToActor: false,
    });
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: { view: "source_selection" },
      site: {
        id: "site-1",
        sourceUrl: "https://example.com",
        sourceLang: "en",
        status: "active",
      },
      access: {
        mutationsAllowed: true,
        features: {},
        canEditSourceSelection: true,
        canPreviewSourceSelection: true,
      },
      policy: {
        rules: [
          {
            kind: "canonical",
            pattern: "/blog/alias/*",
            target: "/blog/*",
          },
        ],
      },
      inventorySummary: {
        knownPageCount: 0,
      },
      preconditions: {
        expectedRouteConfigUpdatedAt: "2026-05-07T00:00:00.000Z",
        expectedSourceSelectionFingerprint: "fingerprint",
      },
    });

    vi.resetModules();
    const { default: SourceSelectionPage } = await import("./page");

    const tree = await SourceSelectionPage({
      params: Promise.resolve({ id: "site-1" }),
    });

    expect(findElement(tree, mocks.SourceSelectionManager)).toBeNull();
    expect(findElement(tree, mocks.ErrorStateCard)).toMatchObject({
      title: "Unsupported source-selection rules",
      message: "Editing is blocked to avoid deleting unsupported rules.",
    });
    expect(mocks.fetchSiteDashboardProjection).toHaveBeenCalledWith(
      { token: "token", subjectAccountId: "acct-1" },
      "site-1",
      "source_selection",
    );
  });
});
