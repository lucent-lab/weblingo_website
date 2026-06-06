// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDashboardAuth: vi.fn(),
  fetchSite: vi.fn(),
  fetchGlossary: vi.fn(),
  fetchConsistencyCpm: vi.fn(),
  fetchConsistencyBlocks: vi.fn(),
  fetchConsistencyOverrideHygiene: vi.fn(),
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
vi.mock("@/components/dashboard/error-state-card", () => ({
  ErrorStateCard: () => null,
}));
vi.mock("../glossary-editor", () => ({
  GlossaryEditor: function MockGlossaryEditor({
    allowRetranslate,
    mode,
    targetLangs,
  }: {
    allowRetranslate?: boolean;
    mode?: string;
    targetLangs: string[];
  }) {
    void allowRetranslate;
    void mode;
    return <div>glossary-editor:{targetLangs.join(",")}</div>;
  },
}));
vi.mock("../locked-feature-card", () => ({
  LockedFeatureCard: () => null,
}));
vi.mock("../site-header", () => ({
  SiteHeader: () => null,
}));
vi.mock("../translation-forms", () => ({
  OverrideForm: function MockOverrideForm({
    mode,
    targetLangs,
  }: {
    mode?: string;
    targetLangs: string[];
  }) {
    void mode;
    return <div>override-form:{targetLangs.join(",")}</div>;
  },
  SlugForm: function MockSlugForm({ mode, targetLangs }: { mode?: string; targetLangs: string[] }) {
    void mode;
    return <div>slug-form:{targetLangs.join(",")}</div>;
  },
}));
vi.mock("../consistency/consistency-manager", () => ({
  ConsistencyManager: () => <div>consistency-manager</div>,
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
  normalizeLocale: mocks.normalizeLocale,
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));

describe("SiteOverridesPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

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

  it("renders editable translation rules and loads consistency data for the selected locale", async () => {
    const authToken = {
      token: "token",
      expiresAt: "2026-01-01T00:00:00.000Z",
      subjectAccountId: "acct-1",
      refresh: async () => "token",
    };
    mocks.requireDashboardAuth.mockResolvedValue({
      webhooksAuth: authToken,
      mutationsAllowed: true,
      has: vi.fn().mockReturnValue(true),
      account: {
        accountId: "acct-1",
        featureFlags: {},
        planType: "pro",
        planStatus: "active",
      },
      subjectAccount: null,
      actorAccount: null,
      actorAccountId: "acct-1",
      subjectAccountId: "acct-1",
      actingAsCustomer: false,
    });
    mocks.fetchSite.mockResolvedValue({
      id: "site-1",
      status: "active",
      sourceUrl: "https://example.com",
      locales: [
        { sourceLang: "en", targetLang: "fr" },
        { sourceLang: "en", targetLang: "ja" },
      ],
    });
    mocks.fetchGlossary.mockResolvedValue([
      {
        id: "glossary-1",
        sourceText: "Cart",
        targetText: "Panier",
        targetLang: "fr",
        updatedAt: "2026-05-07T00:00:00.000Z",
      },
    ]);
    mocks.fetchConsistencyCpm.mockResolvedValue({
      entries: [],
      pagination: { limit: 100, offset: 0, total: 0, nextOffset: null },
    });
    mocks.fetchConsistencyBlocks.mockResolvedValue({
      blocks: [],
      pagination: { limit: 100, offset: 0, total: 0, nextOffset: null },
    });
    mocks.fetchConsistencyOverrideHygiene.mockResolvedValue({
      warnings: [],
      pagination: { limit: 100, offset: 0, total: 0, nextOffset: null },
    });

    vi.resetModules();
    const { ConsistencyGovernanceSection, default: SiteOverridesPage } = await import("./page");

    const tree = await SiteOverridesPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({ sourceLang: "en", targetLang: "fr" }),
    });

    expect(findElementPropsByComponentName(tree, "MockGlossaryEditor")?.targetLangs).toEqual([
      "fr",
      "ja",
    ]);
    expect(findElementPropsByComponentName(tree, "MockOverrideForm")?.targetLangs).toEqual([
      "fr",
      "ja",
    ]);
    expect(findElementPropsByComponentName(tree, "MockSlugForm")?.targetLangs).toEqual([
      "fr",
      "ja",
    ]);

    const consistencyTree = await ConsistencyGovernanceSection({
      authToken,
      canEdit: true,
      dashboardLocale: null,
      mutationsAllowed: true,
      pricingPath: "/en/pricing",
      selectedLocaleScope: { sourceLang: "en", targetLang: "fr" },
      siteId: "site-1",
    });
    render(consistencyTree);

    expect(screen.getByText("consistency-manager")).toBeTruthy();
    expect(mocks.fetchGlossary).toHaveBeenCalledWith(authToken, "site-1");
    expect(mocks.fetchConsistencyCpm).toHaveBeenCalledWith(authToken, "site-1", {
      targetLang: "fr",
      sourceLang: "en",
      limit: 100,
      offset: 0,
    });
    expect(mocks.fetchConsistencyBlocks).toHaveBeenCalledWith(authToken, "site-1");
    expect(mocks.fetchConsistencyOverrideHygiene).toHaveBeenCalledWith(authToken, "site-1", {
      targetLang: "fr",
      sourceLang: "en",
      limit: 100,
      offset: 0,
    });
  });

  it("renders readonly example forms for demo scoped auth", async () => {
    const authToken = {
      token: "demo-token",
      expiresAt: "2026-01-01T00:00:00.000Z",
      subjectAccountId: "acct-demo",
      refresh: async () => "demo-token",
    };
    mocks.requireDashboardAuth.mockResolvedValue({
      accessMode: "demo",
      demoSession: { siteId: "site-1" },
      webhooksAuth: authToken,
      mutationsAllowed: false,
      has: vi.fn((check: { feature?: string; allFeatures?: string[] }) => {
        if (check.feature) {
          return check.feature === "glossary";
        }
        return false;
      }),
      account: {
        accountId: "acct-demo",
        featureFlags: {},
        planType: "pro",
        planStatus: "active",
      },
      subjectAccount: null,
      actorAccount: null,
      actorAccountId: "acct-demo",
      subjectAccountId: "acct-demo",
      actingAsCustomer: false,
    });
    mocks.fetchSite.mockResolvedValue({
      id: "site-1",
      status: "active",
      sourceUrl: "https://example.com",
      locales: [{ sourceLang: "fr", targetLang: "en" }],
    });
    mocks.fetchGlossary.mockResolvedValue([]);
    mocks.resolveLocaleTranslator.mockResolvedValueOnce({
      t: (key: string, fallback?: string) =>
        ({
          "dashboard.demo.examples.badge": "Localized example values",
          "dashboard.site.overrides.demoGlossary.title": "Localized glossary",
          "dashboard.site.overrides.demoGlossary.description":
            "Localized demo glossary description.",
        })[key] ??
        fallback ??
        key,
    });

    vi.resetModules();
    const { default: SiteOverridesPage } = await import("./page");

    const tree = await SiteOverridesPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({ sourceLang: "fr", targetLang: "en" }),
    });

    expect(findElementPropsByComponentName(tree, "MockGlossaryEditor")).toMatchObject({
      mode: "example",
      targetLangs: ["en"],
    });
    expect(findElementPropsByComponentName(tree, "MockOverrideForm")).toMatchObject({
      mode: "example",
      targetLangs: ["en"],
    });
    expect(findElementPropsByComponentName(tree, "MockSlugForm")).toMatchObject({
      mode: "example",
      targetLangs: ["en"],
      exampleBadgeLabel: "Localized example values",
    });
    expect(findElementPropsByComponentName(tree, "MockOverrideForm")).toMatchObject({
      exampleBadgeLabel: "Localized example values",
    });
    expect(findElementPropsByComponentName(tree, "ExampleValuesBadge")).toMatchObject({
      label: "Localized example values",
    });
    expect(treeIncludesText(tree, "Localized glossary")).toBe(true);
    expect(treeIncludesText(tree, "Localized demo glossary description.")).toBe(true);
    expect(mocks.fetchGlossary).toHaveBeenCalledWith(authToken, "site-1");
  });

  it("renders demo examples even when glossary write features are unavailable", async () => {
    const authToken = {
      token: "demo-token",
      expiresAt: "2026-01-01T00:00:00.000Z",
      subjectAccountId: "acct-demo",
      refresh: async () => "demo-token",
    };
    mocks.requireDashboardAuth.mockResolvedValue({
      accessMode: "demo",
      demoSession: { siteId: "site-1" },
      webhooksAuth: authToken,
      mutationsAllowed: true,
      has: vi.fn((check: { feature?: string; allFeatures?: string[] }) => {
        if (check.feature) {
          return false;
        }
        return check.allFeatures?.includes("glossary") === true;
      }),
      account: {
        accountId: "acct-demo",
        featureFlags: {},
        planType: "pro",
        planStatus: "active",
      },
      subjectAccount: null,
      actorAccount: null,
      actorAccountId: "acct-demo",
      subjectAccountId: "acct-demo",
      actingAsCustomer: false,
    });
    mocks.fetchSite.mockResolvedValue({
      id: "site-1",
      status: "active",
      sourceUrl: "https://example.com",
      locales: [{ sourceLang: "fr", targetLang: "en" }],
    });
    mocks.fetchGlossary.mockResolvedValue([]);

    vi.resetModules();
    const { default: SiteOverridesPage } = await import("./page");

    const tree = await SiteOverridesPage({
      params: Promise.resolve({ id: "site-1" }),
      searchParams: Promise.resolve({ sourceLang: "fr", targetLang: "en" }),
    });

    expect(findElementPropsByComponentName(tree, "MockGlossaryEditor")).toMatchObject({
      mode: "example",
      targetLangs: ["en"],
    });
    expect(findElementPropsByComponentName(tree, "MockOverrideForm")).toMatchObject({
      mode: "example",
      targetLangs: ["en"],
    });
    expect(findElementPropsByComponentName(tree, "MockSlugForm")).toMatchObject({
      mode: "example",
      targetLangs: ["en"],
    });
  });
});

function findElementPropsByComponentName(
  node: ReactNode,
  componentName: string,
): (Record<string, unknown> & { children?: ReactNode }) | null {
  if (!isValidElement(node)) {
    return null;
  }

  const typeName = typeof node.type === "function" ? node.type.name : null;
  if (typeName === componentName) {
    return node.props as Record<string, unknown> & { children?: ReactNode };
  }

  const props = node.props as { children?: ReactNode };
  for (const child of Children.toArray(props.children)) {
    const found = findElementPropsByComponentName(child, componentName);
    if (found) {
      return found;
    }
  }

  return null;
}

function treeIncludesText(node: ReactNode, expected: string): boolean {
  if (typeof node === "string" || typeof node === "number") {
    return String(node) === expected;
  }

  if (Array.isArray(node)) {
    return node.some((child) => treeIncludesText(child, expected));
  }

  if (!isValidElement(node)) {
    return false;
  }

  const props = node.props as { children?: ReactNode };
  return treeIncludesText(props.children, expected);
}
