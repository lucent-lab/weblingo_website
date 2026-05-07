import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchCustomerDeploymentHistory: vi.fn(),
  fetchCustomerTranslationRuns: vi.fn(),
  fetchDeploymentHistory: vi.fn(),
  resolvePreferredLocale: vi.fn(() => "en"),
  resolveLocaleTranslator: vi.fn(async () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("@/components/dashboard/action-form", () => ({
  ActionForm: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: mocks.requireDashboardAuth,
}));
vi.mock("@internal/dashboard/webhooks", () => ({
  fetchCustomerDeploymentHistory: mocks.fetchCustomerDeploymentHistory,
  fetchCustomerTranslationRuns: mocks.fetchCustomerTranslationRuns,
  fetchDeploymentHistory: mocks.fetchDeploymentHistory,
  WebhooksApiError: class WebhooksApiError extends Error {},
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));
vi.mock("../../../actions", () => ({
  cancelTranslationRunAction: vi.fn(),
  resumeTranslationRunAction: vi.fn(),
  retryFailedTranslationRunAction: vi.fn(),
}));
vi.mock("../site-header", () => ({
  SiteHeader: () => null,
}));

describe("HistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not load history streams until a target locale is selected", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));

    vi.resetModules();
    const { default: HistoryPage } = await import("./page");
    const tree = await HistoryPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({}),
    });

    expect(isValidElement(tree)).toBe(true);
    expect(mocks.fetchCustomerTranslationRuns).not.toHaveBeenCalled();
    expect(mocks.fetchCustomerDeploymentHistory).not.toHaveBeenCalled();
    expect(mocks.fetchDeploymentHistory).not.toHaveBeenCalled();
  });

  it("loads only customer-safe translation runs for the selected locale", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    mocks.fetchCustomerTranslationRuns.mockResolvedValue({
      runs: [],
      pagination: { limit: 10, offset: 0, nextOffset: null },
      generatedAt: "2026-05-07T00:00:00.000Z",
    });

    vi.resetModules();
    const { default: HistoryPage } = await import("./page");
    const tree = await HistoryPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({ targetLang: "fr" }),
    });

    expect(isValidElement(tree)).toBe(true);
    expect(mocks.fetchCustomerTranslationRuns).toHaveBeenCalledWith(authToken, "site-1", {
      targetLang: "fr",
      limit: 10,
      offset: 0,
    });
    expect(mocks.fetchCustomerDeploymentHistory).not.toHaveBeenCalled();
    expect(mocks.fetchDeploymentHistory).not.toHaveBeenCalled();
  });

  it("loads only customer deployment history and does not render raw deployment status", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    mocks.fetchCustomerDeploymentHistory.mockResolvedValue({
      targetLang: "fr",
      entries: [
        {
          rawStatus: "active",
          customerStatus: "published",
          titleKey: "dashboard.history.deployment.published.title",
          descriptionKey: "dashboard.history.deployment.published.description",
          createdAt: "2026-05-07T00:00:00.000Z",
          publishedAt: "2026-05-07T00:01:00.000Z",
          pageCount: 3,
          customerError: null,
        },
      ],
      pagination: { limit: 10, offset: 0, nextOffset: null },
      generatedAt: "2026-05-07T00:00:00.000Z",
    });

    vi.resetModules();
    const { default: HistoryPage } = await import("./page");
    const tree = await HistoryPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({ targetLang: "fr", historyType: "deployments" }),
    });

    expect(isValidElement(tree)).toBe(true);
    expect(mocks.fetchCustomerDeploymentHistory).toHaveBeenCalledWith(authToken, "site-1", {
      targetLang: "fr",
      limit: 10,
      offset: 0,
    });
    expect(mocks.fetchCustomerTranslationRuns).not.toHaveBeenCalled();
    expect(mocks.fetchDeploymentHistory).not.toHaveBeenCalled();
    expect(collectText(tree)).not.toContain("Raw status");
    expect(collectText(tree)).not.toContain("active");
  });
});

function makeAuth(authToken: { token: string; subjectAccountId: string }) {
  return {
    webhooksAuth: authToken,
    mutationsAllowed: true,
    has: vi.fn().mockReturnValue(true),
    actorAccountId: "acct-1",
    subjectAccountId: "acct-1",
    actingAsCustomer: false,
    subjectFallbackToActor: false,
  };
}

function collectText(node: unknown): string {
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(collectText).join(" ");
  }
  if (!isValidElement(node)) {
    return "";
  }
  const props = node.props as { children?: unknown };
  return collectText(props.children);
}
