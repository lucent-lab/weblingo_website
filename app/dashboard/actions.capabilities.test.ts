import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const withWebhooksAuth = vi.fn();
vi.mock("./_lib/webhooks-token", () => ({ withWebhooksAuth }));

const triggerCrawlTranslate = vi.fn();
const upsertDigestSubscription = vi.fn();
const setTranslationSummaryPreference = vi.fn();
const listTranslationSummaries = vi.fn();
const fetchSwitcherSnippets = vi.fn();
const fetchSite = vi.fn();
const updateSite = vi.fn();
const triggerCrawl = vi.fn();
const translateSite = vi.fn();
const cancelTranslationRun = vi.fn();
const resumeTranslationRun = vi.fn();
const triggerPageCrawl = vi.fn();
const verifyDomain = vi.fn();
const provisionDomain = vi.fn();
const refreshDomain = vi.fn();
const updateGlossary = vi.fn();
const createOverride = vi.fn();
const createManagedDemo = vi.fn();
const rerunManagedDemoSiteCrawl = vi.fn();
const updateSlug = vi.fn();
const setLocaleServing = vi.fn();
const deactivateSite = vi.fn();
const createSite = vi.fn();

class MockWebhooksApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

vi.mock("@internal/dashboard/webhooks", () => ({
  createOverride,
  createManagedDemo,
  rerunManagedDemoSiteCrawl,
  createSite,
  deactivateSite,
  cancelTranslationRun,
  fetchSite,
  fetchSwitcherSnippets,
  listTranslationSummaries,
  provisionDomain,
  refreshDomain,
  resumeTranslationRun,
  setTranslationSummaryPreference,
  setLocaleServing,
  translateSite,
  triggerCrawl,
  triggerCrawlTranslate,
  triggerPageCrawl,
  upsertDigestSubscription,
  updateGlossary,
  updateSite,
  updateSlug,
  verifyDomain,
  WebhooksApiError: MockWebhooksApiError,
}));

const invalidateSiteDashboardCache = vi.fn();
const invalidateSitesCache = vi.fn();
vi.mock("@internal/dashboard/data", () => ({
  invalidateSiteDashboardCache,
  invalidateSitesCache,
}));

const requireDashboardAuth = vi.fn();
const invalidateDashboardBootstrapCache = vi.fn();
const hasActorInternalOps = vi.fn();
vi.mock("@internal/dashboard/auth", () => ({
  hasActorInternalOps,
  invalidateDashboardBootstrapCache,
  requireDashboardAuth,
}));

const buildSiteSettingsUpdatePayload = vi.fn();
const deriveSiteSettingsAccess = vi.fn();
const parseJsonObject = vi.fn();
const parseLocaleAliases = vi.fn();
const parseWebhookEvents = vi.fn();
const validateSourceUrl = vi.fn();
vi.mock("@internal/dashboard/site-settings", () => ({
  buildSiteSettingsUpdatePayload,
  deriveSiteSettingsAccess,
  parseJsonObject,
  parseLocaleAliases,
  parseWebhookEvents,
  validateSourceUrl,
}));

describe("dashboard capability actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withWebhooksAuth.mockImplementation(async (callback: (auth: { token: string }) => unknown) =>
      callback({ token: "webhooks-token" }),
    );
    requireDashboardAuth.mockResolvedValue({
      account: { accountId: "acct-1", planType: "pro", featureFlags: {} },
      webhooksAuth: { token: "webhooks-token", subjectAccountId: "acct-1" },
      actorWebhooksAuth: { token: "actor-token", subjectAccountId: "acct-admin" },
      mutationsAllowed: true,
      billingIssue: null,
      has: vi.fn(() => true),
    });
    hasActorInternalOps.mockReturnValue(true);
    validateSourceUrl.mockReturnValue(null);
    parseLocaleAliases.mockImplementation((raw: string) => (raw ? JSON.parse(raw) : undefined));
    parseWebhookEvents.mockImplementation((raw: string | null | undefined) =>
      raw
        ? JSON.parse(raw)
        : ["translation.completed", "translation.failed", "translation.summary"],
    );
    fetchSite.mockResolvedValue({
      routeConfig: {
        sourceSelection: { rules: [] },
      },
    });
  });

  it("queues crawl+translate with parsed csv payload and force flag", async () => {
    triggerCrawlTranslate.mockResolvedValue({
      crawlId: "crawl-1",
      selectedCount: 4,
      enqueuedCount: 4,
      targetLangs: ["fr", "de"],
      force: true,
    });

    const { triggerCrawlTranslateAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set("targetLangs", "fr, de, fr");
    formData.set("pageIds", "page-1\npage-2");
    formData.set("sourcePaths", "/pricing, /about");
    formData.set("force", "true");

    const result = await triggerCrawlTranslateAction(undefined, formData);

    expect(result).toMatchObject({
      ok: true,
      message: "Crawl + translate queued (4/4 pages).",
    });
    expect(triggerCrawlTranslate).toHaveBeenCalledWith(
      expect.objectContaining({ token: "webhooks-token" }),
      "site-1",
      {
        targetLangs: ["fr", "de"],
        pageIds: ["page-1", "page-2"],
        sourcePaths: ["/pricing", "/about"],
        force: true,
      },
    );
    expect(invalidateSiteDashboardCache).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/sites/site-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/sites/site-1/pages");
  });

  it("returns validation error when crawl+translate target languages are missing", async () => {
    const { triggerCrawlTranslateAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set("targetLangs", "  ");

    const result = await triggerCrawlTranslateAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      message: "At least one target language is required.",
      meta: undefined,
    });
    expect(triggerCrawlTranslate).not.toHaveBeenCalled();
  });

  it("updates digest subscription and returns off-specific messaging", async () => {
    upsertDigestSubscription.mockResolvedValue({
      id: "sub-1",
      accountId: "acct-1",
      email: "alerts@example.com",
      frequency: "off",
    });

    const { upsertDigestSubscriptionAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set("email", "alerts@example.com");
    formData.set("frequency", "off");

    const result = await upsertDigestSubscriptionAction(undefined, formData);

    expect(result).toMatchObject({
      ok: true,
      message: "Digest notifications disabled.",
    });
    expect(upsertDigestSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ token: "webhooks-token" }),
      {
        email: "alerts@example.com",
        frequency: "off",
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/sites/site-1");
  });

  it("blocks site settings edits through the shared access helper when billing is blocked", async () => {
    requireDashboardAuth.mockResolvedValue({
      account: { accountId: "acct-1", planType: "pro", featureFlags: {} },
      webhooksAuth: { token: "webhooks-token", subjectAccountId: "acct-1" },
      mutationsAllowed: false,
      billingIssue: null,
      has: vi.fn(),
    });
    deriveSiteSettingsAccess.mockReturnValue({
      billingBlocked: true,
      canEditBasics: false,
      canEditLocales: false,
      canEditServingMode: false,
      canEditCrawlCaptureMode: false,
      canEditClientRuntime: false,
      canEditSpaRefresh: false,
      canEditTranslatableAttributes: false,
      canEditProfile: false,
      canEditWebhooks: false,
    });

    const { updateSiteSettingsAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");

    const result = await updateSiteSettingsAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      message: "Your plan is not active. Update billing to edit site settings.",
      meta: undefined,
    });
    expect(deriveSiteSettingsAccess).toHaveBeenCalledWith({
      has: expect.any(Function),
      mutationsAllowed: false,
    });
    expect(buildSiteSettingsUpdatePayload).not.toHaveBeenCalled();
    expect(updateSite).not.toHaveBeenCalled();
  });

  it("does not send empty site settings updates to the backend", async () => {
    deriveSiteSettingsAccess.mockReturnValue({
      billingBlocked: false,
      canEditBasics: true,
      canEditLocales: true,
      canEditServingMode: true,
      canEditCrawlCaptureMode: true,
      canEditClientRuntime: true,
      canEditSpaRefresh: true,
      canEditTranslatableAttributes: true,
      canEditProfile: true,
      canEditWebhooks: true,
    });
    buildSiteSettingsUpdatePayload.mockReturnValue({ ok: true, payload: {} });

    const { updateSiteSettingsAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");

    const result = await updateSiteSettingsAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      message: "Choose at least one setting to update.",
      meta: undefined,
    });
    expect(updateSite).not.toHaveBeenCalled();
  });

  it("uses the existing site update path for source URL replacement", async () => {
    const payload = {
      sourceUrl: "https://www.new-example.com",
      subdomainPattern: "https://{lang}.new-example.com",
    };
    deriveSiteSettingsAccess.mockReturnValue({
      billingBlocked: false,
      canEditBasics: true,
      canEditLocales: true,
      canEditServingMode: true,
      canEditCrawlCaptureMode: true,
      canEditClientRuntime: true,
      canEditSpaRefresh: true,
      canEditTranslatableAttributes: true,
      canEditProfile: true,
      canEditWebhooks: true,
    });
    buildSiteSettingsUpdatePayload.mockReturnValue({ ok: true, payload });

    const { updateSiteSettingsAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set("sourceUrl", payload.sourceUrl);
    formData.set("subdomainPattern", payload.subdomainPattern);

    const result = await updateSiteSettingsAction(undefined, formData);

    expect(result).toMatchObject({ ok: true, message: "Site settings saved." });
    expect(updateSite).toHaveBeenCalledWith(
      expect.objectContaining({ token: "webhooks-token" }),
      "site-1",
      payload,
    );
    expect(createSite).not.toHaveBeenCalled();
    expect(invalidateSiteDashboardCache).toHaveBeenCalledWith(
      expect.objectContaining({ token: "webhooks-token" }),
      "site-1",
    );
    expect(invalidateSitesCache).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/sites/site-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/sites/site-1/settings");
  });

  it("blocks focused dashboard mutations when the workspace mutation lock is active", async () => {
    requireDashboardAuth.mockResolvedValue({
      account: { accountId: "acct-1", planType: "pro", featureFlags: {} },
      webhooksAuth: { token: "webhooks-token", subjectAccountId: "acct-1" },
      mutationsAllowed: false,
      billingIssue: null,
      has: vi.fn(() => true),
    });

    const { updateSiteStatusAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set("status", "inactive");

    const result = await updateSiteStatusAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      message: "Your plan is not active. Update billing to pause localization.",
      meta: undefined,
    });
    expect(updateSite).not.toHaveBeenCalled();
  });

  it("blocks notification preference mutations when the workspace mutation lock is active", async () => {
    requireDashboardAuth.mockResolvedValue({
      account: { accountId: "acct-1", planType: "pro", featureFlags: {} },
      webhooksAuth: { token: "webhooks-token", subjectAccountId: "acct-1" },
      mutationsAllowed: false,
      billingIssue: null,
      has: vi.fn(() => true),
    });

    const { setTranslationSummaryPreferenceAction, upsertDigestSubscriptionAction } =
      await import("./actions");
    const digestFormData = new FormData();
    digestFormData.set("siteId", "site-1");
    digestFormData.set("email", "alerts@example.com");
    digestFormData.set("frequency", "weekly");
    const summaryFormData = new FormData();
    summaryFormData.set("siteId", "site-1");
    summaryFormData.set("targetLang", "fr");
    summaryFormData.set("frequency", "daily");

    await expect(upsertDigestSubscriptionAction(undefined, digestFormData)).resolves.toEqual({
      ok: false,
      message: "Your plan is not active. Update billing to update digest notifications.",
      meta: undefined,
    });
    await expect(
      setTranslationSummaryPreferenceAction(undefined, summaryFormData),
    ).resolves.toEqual({
      ok: false,
      message:
        "Your plan is not active. Update billing to update translation summary notifications.",
      meta: undefined,
    });
    expect(upsertDigestSubscription).not.toHaveBeenCalled();
    expect(setTranslationSummaryPreference).not.toHaveBeenCalled();
  });

  it("blocks domain mutations when domain verification is not enabled", async () => {
    requireDashboardAuth.mockResolvedValue({
      account: { accountId: "acct-1", planType: "starter", featureFlags: {} },
      webhooksAuth: { token: "webhooks-token", subjectAccountId: "acct-1" },
      mutationsAllowed: true,
      billingIssue: null,
      has: vi.fn(
        (check: { allFeatures?: string[] }) =>
          check.allFeatures?.every((feature) => feature !== "domain_verify") ?? true,
      ),
    });

    const { verifyDomainAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set("domain", "fr.example.com");

    const result = await verifyDomainAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      message: "Domain verification is not enabled for this account.",
      meta: undefined,
    });
    expect(verifyDomain).not.toHaveBeenCalled();
  });

  it("does not return raw provider details from domain action failures", async () => {
    verifyDomain.mockRejectedValue(
      new MockWebhooksApiError("raw provider failure secret-token", 500, {
        errors: [{ code: "raw_code", message: "raw dns provider body" }],
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const { verifyDomainAction } = await import("./actions");
      const formData = new FormData();
      formData.set("siteId", "site-1");
      formData.set("domain", "fr.example.com");

      const result = await verifyDomainAction(undefined, formData);

      expect(result.ok).toBe(false);
      expect(result.message).toBe("The dashboard service is unavailable right now.");
      expect(result.message).not.toContain("secret-token");
      expect(result.message).not.toContain("raw dns provider body");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("saves source-selection rules through the site PATCH payload", async () => {
    requireDashboardAuth.mockResolvedValue({
      account: { accountId: "acct-1", planType: "pro", featureFlags: {} },
      webhooksAuth: { token: "webhooks-token", subjectAccountId: "acct-1" },
      mutationsAllowed: true,
      billingIssue: null,
      has: vi.fn((check: { feature?: string }) => check.feature === "edit"),
    });
    fetchSite.mockResolvedValue({
      routeConfig: {
        updatedAt: "2026-05-04T00:00:00.000Z",
        sourceSelectionFingerprint: '{"rules":[]}',
        sourceSelection: { rules: [] },
      },
    });
    updateSite.mockResolvedValue({
      routeConfig: {
        updatedAt: "2026-05-04T00:01:00.000Z",
        sourceSelectionFingerprint: "fingerprint-after-save",
        sourceSelection: {
          rules: [
            { action: "include", pattern: "/blog/*" },
            { action: "exclude", pattern: "/blog/drafts/*" },
          ],
        },
      },
    });

    const { updateSourceSelectionAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set("expectedRouteConfigUpdatedAt", "2026-05-04T00:00:00.000Z");
    formData.set("expectedSourceSelectionFingerprint", '{"rules":[]}');
    formData.set(
      "sourceSelection",
      JSON.stringify({
        rules: [
          { action: "include", pattern: "/blog/*" },
          { action: "exclude", pattern: "/blog/drafts/*" },
        ],
      }),
    );

    const result = await updateSourceSelectionAction(undefined, formData);

    expect(result.ok).toBe(true);
    expect(fetchSite).toHaveBeenCalledWith(
      expect.objectContaining({ token: "webhooks-token", subjectAccountId: "acct-1" }),
      "site-1",
    );
    expect(updateSite).toHaveBeenCalledWith(
      expect.objectContaining({ token: "webhooks-token", subjectAccountId: "acct-1" }),
      "site-1",
      {
        sourceSelection: {
          rules: [
            { action: "include", pattern: "/blog/*" },
            { action: "exclude", pattern: "/blog/drafts/*" },
          ],
        },
        expectedRouteConfigUpdatedAt: "2026-05-04T00:00:00.000Z",
        expectedSourceSelectionFingerprint: '{"rules":[]}',
      },
    );
    expect(result.meta).toMatchObject({
      routeConfigUpdatedAt: "2026-05-04T00:01:00.000Z",
      sourceSelectionFingerprint: "fingerprint-after-save",
    });
    expect(invalidateSiteDashboardCache).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/sites/site-1/source-selection");
  });

  it("does not report source-selection success when the PATCH response omits confirmation metadata", async () => {
    updateSite.mockResolvedValue({
      routeConfig: {
        sourceSelection: { rules: [{ action: "include", pattern: "/blog/*" }] },
      },
    });

    const { updateSourceSelectionAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set(
      "sourceSelection",
      JSON.stringify({
        rules: [{ action: "include", pattern: "/blog/*" }],
      }),
    );

    const result = await updateSourceSelectionAction(undefined, formData);

    expect(result).toMatchObject({
      ok: false,
      message: "Source selection was saved, but the confirmation payload was incomplete.",
      meta: { code: "source_selection_incomplete_response" },
    });
    expect(invalidateSiteDashboardCache).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/sites/site-1/source-selection");
  });

  it("blocks source-selection save when the editable preview contract is malformed", async () => {
    requireDashboardAuth.mockResolvedValue({
      account: { accountId: "acct-1", planType: "pro", featureFlags: {} },
      webhooksAuth: { token: "webhooks-token", subjectAccountId: "acct-1" },
      mutationsAllowed: true,
      billingIssue: null,
      has: vi.fn(() => true),
    });

    const { updateSourceSelectionAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set(
      "sourceSelection",
      JSON.stringify({
        rules: [{ action: "canonical_source", pattern: "/fr/*" }],
      }),
    );

    const result = await updateSourceSelectionAction(undefined, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/include or exclude/i);
    expect(updateSite).not.toHaveBeenCalled();
  });

  it("blocks source-selection save when persisted rules contain unsupported actions", async () => {
    requireDashboardAuth.mockResolvedValue({
      account: { accountId: "acct-1", planType: "pro", featureFlags: {} },
      webhooksAuth: { token: "webhooks-token", subjectAccountId: "acct-1" },
      mutationsAllowed: true,
      billingIssue: null,
      has: vi.fn((check: { feature?: string }) => check.feature === "edit"),
    });
    fetchSite.mockResolvedValue({
      routeConfig: {
        sourceSelection: {
          rules: [
            {
              action: "canonical_source",
              pattern: "/fr/*",
              canonicalSourcePattern: "/blog/*",
            },
          ],
        },
      },
    });

    const { updateSourceSelectionAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set(
      "sourceSelection",
      JSON.stringify({
        rules: [{ action: "include", pattern: "/blog/*" }],
      }),
    );

    const result = await updateSourceSelectionAction(undefined, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/unsupported rules/i);
    expect(updateSite).not.toHaveBeenCalled();
  });

  it("blocks source-selection save when persisted rules changed after the page loaded", async () => {
    requireDashboardAuth.mockResolvedValue({
      account: { accountId: "acct-1", planType: "pro", featureFlags: {} },
      webhooksAuth: { token: "webhooks-token", subjectAccountId: "acct-1" },
      mutationsAllowed: true,
      billingIssue: null,
      has: vi.fn((check: { feature?: string }) => check.feature === "edit"),
    });
    fetchSite.mockResolvedValue({
      routeConfig: {
        sourceSelection: {
          rules: [{ action: "include", pattern: "/blog/*" }],
        },
      },
    });

    const { updateSourceSelectionAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set("expectedSourceSelectionFingerprint", '{"rules":[]}');
    formData.set(
      "sourceSelection",
      JSON.stringify({
        rules: [{ action: "exclude", pattern: "/products/*" }],
      }),
    );

    const result = await updateSourceSelectionAction(undefined, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/changed since this page was loaded/i);
    expect(result.meta?.code).toBe("source_selection_conflict");
    expect(updateSite).not.toHaveBeenCalled();
  });

  it("creates a site with webhook settings and allowlisted events", async () => {
    createSite.mockResolvedValue({
      id: "site-created",
      crawlStatus: { enqueued: false },
    });
    requireDashboardAuth.mockResolvedValue({
      account: {
        accountId: "acct-1",
        planType: "pro",
        featureFlags: { maxLocales: null },
      },
      webhooksAuth: { token: "webhooks-token", subjectAccountId: "acct-1" },
      mutationsAllowed: true,
      billingIssue: null,
      has: vi.fn(
        (check: { feature?: string; allFeatures?: string[] }) =>
          check.feature === "site_create" || check.feature === "edit",
      ),
    });

    const { createSiteAction } = await import("./actions");
    const formData = new FormData();
    formData.set("sourceUrl", "https://www.example.com");
    formData.set("sourceLang", "en");
    formData.append("targetLangs", "fr");
    formData.set("subdomainPattern", "https://{lang}.example.com");
    formData.set("servingMode", "strict");
    formData.set("webhookUrl", "https://hooks.example.com/weblingo");
    formData.set("webhookSecret", "secret-123");
    formData.set("webhookEvents", JSON.stringify(["translation.completed", "translation.summary"]));

    const result = await createSiteAction(undefined, formData);

    expect(result).toMatchObject({
      ok: true,
      message: "Site created. Verify domains and activate to start crawling.",
    });
    expect(createSite).toHaveBeenCalledWith(
      expect.objectContaining({ token: "webhooks-token" }),
      expect.objectContaining({
        sourceUrl: "https://www.example.com",
        sourceLang: "en",
        targetLangs: ["fr"],
        subdomainPattern: "https://{lang}.example.com",
        servingMode: "strict",
        webhookUrl: "https://hooks.example.com/weblingo",
        webhookSecret: "secret-123",
        webhookEvents: ["translation.completed", "translation.summary"],
      }),
    );
  });

  it("reports create-site glossary persistence failures instead of returning success", async () => {
    createSite.mockResolvedValue({
      id: "site-created",
      crawlStatus: { enqueued: false },
    });
    updateGlossary.mockRejectedValue(new Error("glossary write failed"));
    requireDashboardAuth.mockResolvedValue({
      account: {
        accountId: "acct-1",
        planType: "pro",
        featureFlags: { maxLocales: null },
      },
      webhooksAuth: { token: "webhooks-token", subjectAccountId: "acct-1" },
      mutationsAllowed: true,
      billingIssue: null,
      has: vi.fn(() => true),
    });

    const { createSiteAction } = await import("./actions");
    const formData = new FormData();
    formData.set("sourceUrl", "https://www.example.com");
    formData.set("sourceLang", "en");
    formData.append("targetLangs", "fr");
    formData.set("subdomainPattern", "https://{lang}.example.com");
    formData.set("servingMode", "strict");
    formData.set(
      "glossaryEntries",
      JSON.stringify([{ source: "Hello", target: "Bonjour", targetLang: "fr" }]),
    );

    const result = await createSiteAction(undefined, formData);

    expect(result).toMatchObject({
      ok: false,
      message: "Site was created, but glossary entries could not be saved.",
      meta: { siteId: "site-created", partialSiteCreated: true },
    });
    expect(updateGlossary).toHaveBeenCalled();
    expect(invalidateSiteDashboardCache).toHaveBeenCalled();
    expect(invalidateSitesCache).toHaveBeenCalled();
  });

  it("returns user-facing copy for stale single-website create actions", async () => {
    createSite.mockRejectedValue(
      new MockWebhooksApiError("This account already has an active website", 403, {
        code: "single_site_account_limit",
      }),
    );

    const { createSiteAction } = await import("./actions");
    const formData = new FormData();
    formData.set("sourceUrl", "https://www.example.com");
    formData.set("sourceLang", "en");
    formData.append("targetLangs", "fr");
    formData.set("subdomainPattern", "https://{lang}.example.com");
    formData.set("servingMode", "strict");

    const result = await createSiteAction(undefined, formData);

    expect(result).toMatchObject({
      ok: false,
      message: expect.stringMatching(/already has a website/i),
    });
    expect(result.message).toMatch(/Settings/i);
    expect(result.message).toMatch(/source URL/i);
  });

  it("rejects incomplete runtime request policy rule payloads", async () => {
    const { updateRuntimeRequestPolicyAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set(
      "runtimeRequestPolicy",
      JSON.stringify({
        schemaVersion: 1,
        mode: "standard",
        enabled: true,
        rules: [
          {
            id: "rule-1",
            name: "Rule 1",
            enabled: true,
            pattern: "/api/*",
            methods: ["GET"],
            action: "proxy",
            cache: "no-store",
            maxBodyBytes: 0,
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
            confirmations: [],
          },
        ],
      }),
    );

    const result = await updateRuntimeRequestPolicyAction(undefined, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/credentials is invalid/i);
    expect(updateSite).not.toHaveBeenCalled();
  });

  it("does not report runtime policy success when the PATCH response omits confirmation metadata", async () => {
    updateSite.mockResolvedValue({
      routeConfig: {
        runtimeRequestPolicy: { schemaVersion: 1, mode: "standard", enabled: true, rules: [] },
      },
    });
    const { updateRuntimeRequestPolicyAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set(
      "runtimeRequestPolicy",
      JSON.stringify({
        schemaVersion: 1,
        mode: "standard",
        enabled: true,
        rules: [],
      }),
    );

    const result = await updateRuntimeRequestPolicyAction(undefined, formData);

    expect(result).toMatchObject({
      ok: false,
      message: "Runtime request policy was saved, but the confirmation payload was incomplete.",
      meta: { code: "runtime_request_policy_incomplete_response" },
    });
    expect(invalidateSiteDashboardCache).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/sites/site-1/runtime-requests");
  });

  it("updates locale summary preferences and invalidates site dashboard cache", async () => {
    setTranslationSummaryPreference.mockResolvedValue({
      siteId: "site-1",
      targetLang: "fr",
      frequency: "daily",
    });

    const { setTranslationSummaryPreferenceAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-1");
    formData.set("targetLang", "fr");
    formData.set("frequency", "daily");

    const result = await setTranslationSummaryPreferenceAction(undefined, formData);

    expect(result).toMatchObject({
      ok: true,
      message: "Summary notifications for fr set to daily.",
    });
    expect(setTranslationSummaryPreference).toHaveBeenCalledWith(
      expect.objectContaining({ token: "webhooks-token" }),
      "site-1",
      "fr",
      "daily",
    );
    expect(invalidateSiteDashboardCache).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/sites/site-1");
  });

  it("loads summaries and switcher snippets via read-focused actions", async () => {
    listTranslationSummaries.mockResolvedValue([
      {
        id: "sum-1",
        siteId: "site-1",
        targetLang: "fr",
        period: "daily",
        rangeStart: "2026-02-14T00:00:00.000Z",
        rangeEnd: "2026-02-15T00:00:00.000Z",
        pagesTranslated: 5,
        pagesUpdated: 2,
      },
    ]);
    fetchSwitcherSnippets.mockResolvedValue({
      siteId: "site-1",
      path: "/pricing",
      currentLang: "fr",
      marker: "weblingo-switcher",
      fallbackIds: ["nav"],
      snippets: [{ templateId: "inline", html: "<nav>...</nav>" }],
    });

    const { fetchSwitcherSnippetsAction, listTranslationSummariesAction } =
      await import("./actions");

    const summaryFormData = new FormData();
    summaryFormData.set("siteId", "site-1");
    const summaryResult = await listTranslationSummariesAction(undefined, summaryFormData);
    expect(summaryResult).toMatchObject({
      ok: true,
      message: "Loaded 1 translation summary record(s).",
    });

    const snippetFormData = new FormData();
    snippetFormData.set("siteId", "site-1");
    snippetFormData.set("path", "/pricing");
    snippetFormData.set("currentLang", "fr");
    const snippetResult = await fetchSwitcherSnippetsAction(undefined, snippetFormData);
    expect(snippetResult).toMatchObject({
      ok: true,
      message: "Loaded 1 switcher snippet template(s) for /pricing.",
    });
    expect(fetchSwitcherSnippets).toHaveBeenCalledWith(
      expect.objectContaining({ token: "webhooks-token" }),
      "site-1",
      {
        path: "/pricing",
        currentLang: "fr",
      },
    );
  });

  it("creates a managed demo with locale aliases and invalidates actor bootstrap auth", async () => {
    requireDashboardAuth.mockResolvedValue({
      session: { access_token: "session-token" },
      actorWebhooksAuth: { token: "actor-token", subjectAccountId: "acct-admin" },
      webhooksAuth: { token: "subject-token", subjectAccountId: "acct-customer" },
      actorAccount: { accountId: "acct-admin", planType: "agency", featureFlags: {} },
      account: { accountId: "acct-customer", planType: "pro", featureFlags: {} },
    });
    createManagedDemo.mockResolvedValue({
      accountId: "acct-demo",
      site: { id: "site-demo" },
      showcase: { url: "https://t2.weblingo.app/autotrim.com/fr", websitePath: "autotrim.com" },
    });

    const { createManagedDemoAction } = await import("./actions");
    const formData = new FormData();
    formData.set("accountPlan", "starter");
    formData.set("sourceUrl", "https://www.autotrim.com");
    formData.set("sourceLang", "en");
    formData.append("targetLangs", "fr");
    formData.append("targetLangs", "de");
    formData.set("subdomainPattern", "https://{lang}.autotrim.com");
    formData.set("defaultLang", "fr");
    formData.set("localeAliases", JSON.stringify({ fr: "fr-fr" }));

    const result = await createManagedDemoAction(undefined, formData);

    expect(result).toMatchObject({
      ok: true,
      meta: {
        accountId: "acct-demo",
        siteId: "site-demo",
      },
    });
    expect(createManagedDemo).toHaveBeenCalledWith(
      expect.objectContaining({ token: "actor-token" }),
      expect.objectContaining({
        accountPlan: "starter",
        site: expect.objectContaining({
          localeAliases: { fr: "fr-fr" },
          targetLangs: ["fr", "de"],
        }),
      }),
    );
    expect(invalidateDashboardBootstrapCache).toHaveBeenCalledWith("session-token");
  });

  it("fails closed when internal admin actor auth is unavailable", async () => {
    requireDashboardAuth.mockResolvedValue({
      session: { access_token: "session-token" },
      actorWebhooksAuth: null,
      webhooksAuth: { token: "subject-token", subjectAccountId: "acct-customer" },
      actorAccount: { accountId: "acct-admin", planType: "agency", featureFlags: {} },
      account: { accountId: "acct-customer", planType: "pro", featureFlags: {} },
    });

    const { createManagedDemoAction } = await import("./actions");
    const formData = new FormData();
    formData.set("accountPlan", "starter");
    formData.set("sourceUrl", "https://www.autotrim.com");
    formData.set("sourceLang", "en");
    formData.append("targetLangs", "fr");
    formData.set("subdomainPattern", "https://{lang}.autotrim.com");
    formData.set("defaultLang", "fr");
    formData.set("localeAliases", JSON.stringify({ fr: "fr-fr" }));

    const result = await createManagedDemoAction(undefined, formData);

    expect(result.ok).toBe(false);
    expect(createManagedDemo).not.toHaveBeenCalled();
  });

  it("queues a forced managed demo crawl with internal admin auth", async () => {
    requireDashboardAuth.mockResolvedValue({
      actorWebhooksAuth: { token: "actor-token", subjectAccountId: "acct-admin" },
      webhooksAuth: { token: "subject-token", subjectAccountId: "acct-demo" },
      actorAccount: {
        accountId: "acct-admin",
        planType: "agency",
        featureFlags: { internalOpsEnabled: true },
      },
      actorAccountId: "acct-admin",
      subjectAccountId: "acct-admin",
      mutationsAllowed: true,
    });
    rerunManagedDemoSiteCrawl.mockResolvedValue({
      siteId: "site-demo",
      sourceUrl: "https://www.weblingo.app/",
      adminInitiated: true,
      usageCounted: false,
      force: true,
      targetLangs: ["it"],
      crawlStatus: { enqueued: true },
    });

    const { triggerManagedDemoForceCrawlAction } = await import("./actions");
    const formData = new FormData();
    formData.set("siteId", "site-demo");

    const result = await triggerManagedDemoForceCrawlAction(undefined, formData);

    expect(result).toMatchObject({
      ok: true,
      message: "Forced pipeline refresh enqueued for 1 locale.",
    });
    expect(rerunManagedDemoSiteCrawl).toHaveBeenCalledWith(
      expect.objectContaining({ subjectAccountId: "acct-admin", token: "actor-token" }),
      "site-demo",
      { force: true },
    );
    expect(invalidateSiteDashboardCache).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/sites/site-demo/pages");
  });

  it("rejects managed demo creation when locale aliases are invalid", async () => {
    parseLocaleAliases.mockReturnValue("Locale aliases are invalid.");

    const { createManagedDemoAction } = await import("./actions");
    const formData = new FormData();
    formData.set("accountPlan", "pro");
    formData.set("sourceUrl", "https://www.autotrim.com");
    formData.set("sourceLang", "en");
    formData.append("targetLangs", "fr");
    formData.set("subdomainPattern", "https://{lang}.autotrim.com");
    formData.set("defaultLang", "fr");
    formData.set("localeAliases", '{"fr":"bad alias"}');

    const result = await createManagedDemoAction(undefined, formData);

    expect(result).toEqual({
      ok: false,
      message: "Locale aliases are invalid.",
      meta: undefined,
    });
    expect(createManagedDemo).not.toHaveBeenCalled();
  });
});
