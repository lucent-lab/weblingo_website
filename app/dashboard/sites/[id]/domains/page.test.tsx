// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionFormProps: [] as Array<{
    analytics?: { event?: string; failureEvent?: string; successEvent?: string };
  }>,
  requireDashboardAuth: vi.fn(),
  fetchSiteDashboardProjection: vi.fn(),
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
  ActionForm: ({
    analytics,
    children,
  }: {
    analytics?: { event?: string; failureEvent?: string; successEvent?: string };
    children: ReactNode;
  }) => {
    mocks.actionFormProps.push({ analytics });
    return children;
  },
}));
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth: mocks.requireDashboardAuth,
}));
vi.mock("@internal/dashboard/data", () => ({}));
vi.mock("@internal/dashboard/webhooks", () => ({
  fetchSiteDashboardProjection: mocks.fetchSiteDashboardProjection,
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
  normalizeLocale: mocks.normalizeLocale,
  resolvePreferredLocale: mocks.resolvePreferredLocale,
  resolveLocaleTranslator: mocks.resolveLocaleTranslator,
}));
vi.mock("../../../actions", () => ({
  provisionDomainAction: vi.fn(),
  refreshDomainAction: vi.fn(),
  setLocaleServingAction: vi.fn(),
  translateAndServeAction: vi.fn(),
  verifyDomainAction: vi.fn(),
}));
vi.mock("../site-header", () => ({
  SiteHeader: () => null,
}));

describe("DomainsPage", () => {
  afterEach(() => {
    cleanup();
    mocks.actionFormProps = [];
  });

  it("uses the domains dashboard projection without legacy dashboard or history fetches", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: { view: "domains", generatedAt: "2026-05-07T00:00:00.000Z", schemaVersion: 1 },
      site: makeSite(),
      access: {
        mutationsAllowed: true,
        features: {},
        canVerifyDomain: true,
        canRefreshDomain: true,
        canProvisionDomain: true,
        canUpdateRouting: true,
        canToggleServing: true,
      },
      routing: {
        urlMode: "subdomain",
        servingMode: "strict",
        routePrefixes: [{ targetLang: "fr", prefix: "/fr" }],
      },
      languages: [
        {
          tag: "fr",
          labelKey: "languages.fr",
          enabled: true,
          serveEnabled: true,
          indexing: {
            mode: "noindex",
            effectiveMode: "noindex",
            optedIn: false,
            canIndex: false,
            blockers: ["indexing_not_opted_in", "domain_unverified"],
          },
          servingStatus: {
            value: "needs_domain",
            rawStatus: "needs_domain",
            titleKey: "dashboard.status.serving.needs_domain.title",
          },
          domain: "fr.example.com",
          domainStatus: "pending",
          routePrefix: "/fr",
          alias: null,
          lastPublishedAt: null,
          lastTranslatedAt: null,
        },
      ],
      domains: [
        {
          domain: "fr.example.com",
          targetLang: "fr",
          status: "pending",
          rawStatus: "pending",
          lastCheckedAt: null,
          requiredDns: [
            {
              type: "TXT",
              name: "_weblingo.fr.example.com",
              value: "verify-fr-token",
            },
          ],
          servingStatus: {
            value: "needs_domain",
            rawStatus: "needs_domain",
            titleKey: "dashboard.status.serving.needs_domain.title",
          },
        },
      ],
    });

    vi.resetModules();
    const { default: DomainsPage } = await import("./page");
    const tree = await DomainsPage({ params: Promise.resolve({ id: "site-1" }) });

    expect(isValidElement(tree)).toBe(true);
    render(tree);
    expect(mocks.fetchSiteDashboardProjection).toHaveBeenCalledWith(authToken, "site-1", "domains");
    expect(screen.getByText("_weblingo.fr.example.com")).toBeTruthy();
    expect(screen.getByText("verify-fr-token")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review DNS setup" }).getAttribute("href")).toBe(
      "#domain-fr-example-com",
    );
    expect(screen.queryByRole("link", { name: "Verify a domain" })?.getAttribute("href")).not.toBe(
      "/dashboard/sites/site-1/domains",
    );
  });

  it("shows focused recovery when an unverified domain has no DNS setup instructions", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: { view: "domains", generatedAt: "2026-05-07T00:00:00.000Z", schemaVersion: 1 },
      site: makeSite(),
      access: {
        mutationsAllowed: true,
        features: {},
        canVerifyDomain: true,
        canRefreshDomain: true,
        canProvisionDomain: true,
        canUpdateRouting: true,
        canToggleServing: true,
      },
      routing: {
        urlMode: "subdomain",
        servingMode: "strict",
        routePrefixes: [],
      },
      languages: [],
      domains: [
        {
          domain: "missing.example.com",
          targetLang: "fr",
          status: "pending",
          rawStatus: "pending",
          lastCheckedAt: null,
        },
      ],
    });

    vi.resetModules();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { default: DomainsPage } = await import("./page");
      const tree = await DomainsPage({ params: Promise.resolve({ id: "site-1" }) });

      render(tree);
      expect(screen.getByText("This section cannot be shown safely")).toBeTruthy();
      expect(document.body.textContent).toContain("Error code");
      expect(document.body.textContent).toContain("dashboard_domain_setup_contract_mismatch");
      expect(screen.getByText("Show raw server details")).toBeTruthy();
      expect(document.body.textContent).not.toContain("missing.example.com");
      expect(document.body.textContent).not.toContain("Missing DNS setup instructions");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("keeps provision and refresh failures scoped to their domain action events", async () => {
    const authToken = { token: "token", subjectAccountId: "acct-1" };
    mocks.requireDashboardAuth.mockResolvedValue(makeAuth(authToken));
    mocks.fetchSiteDashboardProjection.mockResolvedValue({
      meta: { view: "domains", generatedAt: "2026-05-07T00:00:00.000Z", schemaVersion: 1 },
      site: makeSite(),
      access: {
        mutationsAllowed: true,
        features: {},
        canVerifyDomain: true,
        canRefreshDomain: true,
        canProvisionDomain: true,
        canUpdateRouting: true,
        canToggleServing: true,
      },
      routing: {
        urlMode: "subdomain",
        servingMode: "strict",
        routePrefixes: [],
      },
      languages: [],
      domains: [
        {
          domain: "fr.example.com",
          targetLang: "fr",
          status: "pending",
          rawStatus: "pending",
          lastCheckedAt: null,
          requiredDns: [
            {
              type: "CNAME",
              name: "fr.example.com",
              value: "fr.example.weblingo.app",
            },
          ],
        },
      ],
    });

    vi.resetModules();
    const { default: DomainsPage } = await import("./page");
    const tree = await DomainsPage({ params: Promise.resolve({ id: "site-1" }) });

    render(tree);

    expect(mocks.actionFormProps.map((props) => props.analytics)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "domain_provisioned",
          failureEvent: undefined,
        }),
        expect.objectContaining({
          event: "domain_refresh_requested",
          failureEvent: undefined,
        }),
      ]),
    );
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
  };
}

function makeSite() {
  return {
    id: "site-1",
    sourceUrl: "https://example.com",
    sourceLang: "en",
    status: "active",
  };
}
