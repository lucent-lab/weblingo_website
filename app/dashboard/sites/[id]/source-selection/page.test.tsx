import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSite: vi.fn(),
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
  fetchSite: mocks.fetchSite,
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
    mocks.fetchSite.mockResolvedValue({
      id: "site-1",
      routeConfig: {
        sourceSelection: {
          rules: [
            {
              action: "canonical_source",
              pattern: "/blog/alias/*",
              canonicalSourcePattern: "/blog/*",
            },
          ],
        },
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
  });
});
