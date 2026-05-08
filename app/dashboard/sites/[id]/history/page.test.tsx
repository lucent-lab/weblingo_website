// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchCustomerDeploymentHistory: vi.fn(),
  fetchCustomerTranslationRuns: vi.fn(),
  fetchDeploymentHistory: vi.fn(),
  getSiteTargetLangsCached: vi.fn(),
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
vi.mock("@internal/dashboard/data", () => ({
  getSiteTargetLangsCached: mocks.getSiteTargetLangsCached,
}));
vi.mock("@internal/dashboard/webhooks", () => ({
  fetchCustomerDeploymentHistory: mocks.fetchCustomerDeploymentHistory,
  fetchCustomerTranslationRuns: mocks.fetchCustomerTranslationRuns,
  fetchDeploymentHistory: mocks.fetchDeploymentHistory,
  WebhooksApiError: class WebhooksApiError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, status: number, details?: unknown) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
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
    mocks.getSiteTargetLangsCached.mockResolvedValue(["fr", "ja"]);
  });

  afterEach(() => {
    cleanup();
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

  it("rejects unknown target locales before loading a history stream", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));

    vi.resetModules();
    const { default: HistoryPage } = await import("./page");
    const tree = await HistoryPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({ targetLang: "it", historyType: "runs" }),
    });

    render(tree);
    expect(screen.getByText("Locale unavailable")).toBeTruthy();
    expect(document.body.textContent).toContain("IT is not configured for this site");
    expect(mocks.fetchCustomerTranslationRuns).not.toHaveBeenCalled();
    expect(mocks.fetchCustomerDeploymentHistory).not.toHaveBeenCalled();
  });

  it("renders a customer-safe error state when history schema validation fails", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      vi.resetModules();
      const { WebhooksApiError } = await import("@internal/dashboard/webhooks");
      mocks.fetchCustomerTranslationRuns.mockRejectedValue(
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
      );
      const { default: HistoryPage } = await import("./page");
      const tree = await HistoryPage({
        params: Promise.resolve({ id: "site-1" }),
        searchParams: Promise.resolve({ targetLang: "fr", historyType: "runs" }),
      });

      render(tree);
      expect(screen.getByText("This section cannot be shown safely")).toBeTruthy();
      expect(screen.getByText("What happened")).toBeTruthy();
      expect(screen.getByText("What you can do")).toBeTruthy();
      expect(screen.getByText("Retry history")).toBeTruthy();
      expect(screen.getByText("Site overview")).toBeTruthy();
      expect(screen.getByText("Contact support")).toBeTruthy();
      expect(document.body.textContent).toContain("Error code");
      expect(document.body.textContent).toContain("response_schema_mismatch");
      expect(screen.getByText("Show raw server details")).toBeTruthy();
      expect(document.body.textContent).toContain('"code": "response_schema_mismatch"');
      expect(document.body.textContent).toContain("invalid_value");
      expect(document.body.textContent).toContain("customerError");
    } finally {
      warnSpy.mockRestore();
    }
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
