// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  getSiteTargetLangsCached: vi.fn(),
  normalizeLocale: vi.fn((locale: string) => locale),
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
vi.mock("@internal/i18n", () => ({
  normalizeLocale: mocks.normalizeLocale,
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

describe("HistoryPage webhooks contract path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    setClientEnv();
    (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
    mocks.getSiteTargetLangsCached.mockResolvedValue(["fr", "ja"]);
    mocks.requireDashboardAuth.mockResolvedValue(
      makeAuth({ token: "token", subjectAccountId: "acct-1" }),
    );
  });

  afterEach(() => {
    cleanup();
    process.env = ORIGINAL_ENV;
    (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
  });

  it("sends a selected configured locale through the real client parser", async () => {
    const fetchSpy = mockTranslationRunsFetch("translation");

    vi.resetModules();
    const { default: HistoryPage } = await import("./page");
    const tree = await HistoryPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({ targetLang: "fr", historyType: "runs" }),
    });

    render(tree);

    const select = screen.getByRole("combobox", { name: "Target locale" }) as HTMLSelectElement;
    expect(select.value).toBe("fr");
    expect(Array.from(select.options).map((option) => option.value)).toEqual(["", "fr", "ja"]);
    expect(within(select).getByRole("option", { name: "French (fr)" })).toBeTruthy();
    expect(within(select).getByRole("option", { name: "Japanese (ja)" })).toBeTruthy();
    expect(screen.getAllByText("Translation runs").length).toBeGreaterThan(0);
    expect(screen.getByText("Translation run failed")).toBeTruthy();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [input, init] = fetchSpy.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const requestUrl = typeof input === "string" ? input : input.toString();
    expect(requestUrl).toBe(
      "https://api.weblingo.example/api/sites/site-1/translation-runs?targetLang=fr&limit=10&offset=0",
    );
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token");
  });

  it("renders the safe contract error state when a valid locale response has invalid customer data", async () => {
    const fetchSpy = mockTranslationRunsFetch("raw_internal_area");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      vi.resetModules();
      const { default: HistoryPage } = await import("./page");
      const tree = await HistoryPage({
        params: Promise.resolve({ id: "site-1" }),
        searchParams: Promise.resolve({ targetLang: "fr", historyType: "runs" }),
      });

      render(tree);

      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(screen.getByText("This section cannot be shown safely")).toBeTruthy();
      expect(document.body.textContent).toContain("Error code");
      expect(document.body.textContent).toContain("response_schema_mismatch");
      expect(screen.getByText("Show raw server details")).toBeTruthy();
      expect(document.body.textContent).toContain("invalid_value");
      expect(document.body.textContent).toContain("customerError");
      expect(document.body.textContent).toContain("area");
      expect(document.body.textContent).toContain("Retry history");
      expect(document.body.textContent).toContain("Site overview");
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }
  });

  it("sends selected customer deployment history through the real client parser", async () => {
    const fetchSpy = mockCustomerDeploymentHistoryFetch();

    vi.resetModules();
    const { default: HistoryPage } = await import("./page");
    const tree = await HistoryPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({ targetLang: "fr", historyType: "deployments" }),
    });

    render(tree);

    expect(screen.getAllByText("Deployments").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [input, init] = fetchSpy.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const requestUrl = typeof input === "string" ? input : input.toString();
    expect(requestUrl).toBe(
      "https://api.weblingo.example/api/sites/site-1/deployments/history?view=customer&targetLang=fr&limit=10&offset=0",
    );
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token");
  });
});

function setClientEnv() {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_123";
  process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
  process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://posthog.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_anon_key";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_BASE = "https://api.weblingo.example/api";
  process.env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS = "15000";
}

function makeAuth(authToken: { token: string; subjectAccountId: string }) {
  return {
    webhooksAuth: authToken,
    mutationsAllowed: true,
    has: vi.fn().mockReturnValue(true),
    actorAccountId: "acct-1",
    subjectAccountId: "acct-1",
    actingAsCustomer: false,
  };
}

function mockTranslationRunsFetch(area: string) {
  const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    void _input;
    void _init;
    return new Response(JSON.stringify(makeTranslationRunsResponse(area)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;
  return fetchSpy;
}

function mockCustomerDeploymentHistoryFetch() {
  const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    void _input;
    void _init;
    return new Response(JSON.stringify(makeCustomerDeploymentHistoryResponse()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;
  return fetchSpy;
}

function makeTranslationRunsResponse(area: string) {
  return {
    runs: [
      {
        id: "tr-1",
        targetLang: "fr",
        rawStatus: "failed",
        customerStatus: "failed",
        progress: {
          completed: 2,
          total: 3,
          failed: 1,
        },
        startedAt: "2026-05-07T00:00:00.000Z",
        finishedAt: "2026-05-07T00:01:00.000Z",
        createdAt: "2026-05-07T00:00:00.000Z",
        updatedAt: "2026-05-07T00:01:00.000Z",
        customerError: {
          id: "translation_run_failed:tr-1",
          area,
          severity: "danger",
          code: "translation_run_failed",
          titleKey: "dashboard.errors.translationRunFailed.title",
          descriptionKey: "dashboard.errors.translationRunFailed.description",
          lastSeenAt: "2026-05-07T00:01:00.000Z",
        },
      },
    ],
    pagination: {
      limit: 10,
      offset: 0,
      nextOffset: null,
    },
    generatedAt: "2026-05-07T00:02:00.000Z",
  };
}

function makeCustomerDeploymentHistoryResponse() {
  return {
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
    pagination: {
      limit: 10,
      offset: 0,
      nextOffset: null,
    },
    generatedAt: "2026-05-07T00:02:00.000Z",
  };
}
