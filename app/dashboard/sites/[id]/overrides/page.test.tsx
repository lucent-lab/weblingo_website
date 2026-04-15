import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSite: vi.fn(),
  fetchGlossary: vi.fn(),
  fetchConsistencyCpm: vi.fn(),
  fetchConsistencyBlocks: vi.fn(),
  fetchConsistencyOverrideHygiene: vi.fn(),
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
vi.mock("@/components/dashboard/error-state-card", () => ({
  ErrorStateCard: () => null,
}));
vi.mock("../glossary-editor", () => ({
  GlossaryEditor: () => null,
}));
vi.mock("../locked-feature-card", () => ({
  LockedFeatureCard: () => null,
}));
vi.mock("../site-header", () => ({
  SiteHeader: () => null,
}));
vi.mock("../translation-forms", () => ({
  OverrideForm: () => null,
  SlugForm: () => null,
}));
vi.mock("../consistency/consistency-manager", () => ({
  ConsistencyManager: () => null,
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
  fetchGlossary: mocks.fetchGlossary,
  fetchConsistencyCpm: mocks.fetchConsistencyCpm,
  fetchConsistencyBlocks: mocks.fetchConsistencyBlocks,
  fetchConsistencyOverrideHygiene: mocks.fetchConsistencyOverrideHygiene,
}));
vi.mock("@internal/i18n", () => ({
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));

describe("SiteOverridesPage", () => {
  it("skips consistency fetches when the account cannot edit", async () => {
    mocks.requireDashboardAuth.mockResolvedValue({
      webhooksAuth: { token: "token", subjectAccountId: "acct-1" },
      mutationsAllowed: false,
      has: vi.fn().mockReturnValue(false),
      account: {
        accountId: "acct-1",
        featureFlags: {},
        planType: "starter",
        planStatus: "active",
      },
      subjectAccount: null,
      actorAccount: null,
      actorAccountId: "acct-1",
      subjectAccountId: "acct-1",
      actingAsCustomer: false,
      subjectFallbackToActor: false,
    });
    mocks.fetchSite.mockResolvedValue({
      id: "site-1",
      locales: [{ sourceLang: "en", targetLang: "fr" }],
    });
    mocks.fetchGlossary.mockResolvedValue([]);

    vi.resetModules();
    const { default: SiteOverridesPage } = await import("./page");

    await SiteOverridesPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({ sourceLang: "en", targetLang: "fr" }),
    });

    expect(mocks.fetchSite).toHaveBeenCalledOnce();
    expect(mocks.fetchConsistencyCpm).not.toHaveBeenCalled();
    expect(mocks.fetchConsistencyBlocks).not.toHaveBeenCalled();
    expect(mocks.fetchConsistencyOverrideHygiene).not.toHaveBeenCalled();
  });
});
