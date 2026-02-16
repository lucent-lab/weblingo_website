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
  createSite,
  deactivateSite,
  cancelTranslationRun,
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
vi.mock("@internal/dashboard/auth", () => ({
  requireDashboardAuth,
}));

vi.mock("@internal/dashboard/site-settings", () => ({
  buildSiteSettingsUpdatePayload: vi.fn(),
  deriveSiteSettingsAccess: vi.fn(),
  parseJsonObject: vi.fn(),
  parseLocaleAliases: vi.fn(),
  validateSourceUrl: vi.fn(),
}));

describe("dashboard capability actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withWebhooksAuth.mockImplementation(async (callback: (auth: { token: string }) => unknown) =>
      callback({ token: "webhooks-token" }),
    );
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
});
