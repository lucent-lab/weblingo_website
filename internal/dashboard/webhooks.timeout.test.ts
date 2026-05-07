import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function setEnv(name: string, value: string | undefined) {
  (process.env as Record<string, string | undefined>)[name] = value;
}

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

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  setClientEnv();
  (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  (globalThis as { fetch: typeof fetch }).fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("webhooks request wrapper", () => {
  it("passes an AbortSignal to fetch (timeout guard)", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(typeof input === "string" ? input : input.toString()).toContain("/sites/site-1");
      expect(init?.signal).toBeTruthy();
      expect(typeof (init?.signal as AbortSignal | undefined)?.aborted).toBe("boolean");

      const site = {
        id: "site-1",
        accountId: "acct-1",
        sourceUrl: "https://example.com",
        status: "active",
        servingMode: "strict",
        maxLocales: null,
        siteProfile: null,
        webhookEvents: ["translation.completed", "translation.failed", "translation.summary"],
        locales: [],
        domains: [],
        latestCrawlRun: null,
      };
      return new Response(JSON.stringify(site), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    vi.resetModules();
    const { fetchSite } = await import("./webhooks");
    const site = await fetchSite("token", "site-1");

    expect(site.id).toBe("site-1");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("rejects schema mismatches with a safe public error", async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          runs: [
            {
              id: "run-1",
              customerError: {
                area: "raw_internal_area",
              },
            },
          ],
          pagination: { limit: 10, offset: 0, nextOffset: null },
          generatedAt: "2026-05-07T00:00:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      vi.resetModules();
      const { fetchCustomerTranslationRuns, WebhooksApiError } = await import("./webhooks");

      let caught: unknown;
      try {
        await fetchCustomerTranslationRuns("token", "site-1", {
          targetLang: "it",
          limit: 10,
          offset: 0,
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(WebhooksApiError);
      expect(caught).toMatchObject({
        message: "The WebLingo API returned an unexpected dashboard response.",
        status: 200,
        details: {
          code: "response_schema_mismatch",
        },
      });
      expect(consoleError).toHaveBeenCalledWith(
        "[webhooks] response schema mismatch",
        expect.objectContaining({
          path: "/sites/site-1/translation-runs?targetLang=it&limit=10&offset=0",
          issues: expect.any(Array),
        }),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("applies endpoint timeout profiles for list/detail/auth requests", async () => {
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer token");
        expect(typeof headers.get("x-dashboard-trace-id")).toBe("string");
        return new Response(
          JSON.stringify({
            sites: [
              {
                id: "site-1",
                accountId: "acct-1",
                sourceUrl: "https://example.com",
                status: "active",
                servingMode: "strict",
                maxLocales: null,
                siteProfile: null,
                sourceLang: "en",
                targetLangs: ["fr"],
                localeCount: 1,
                serveEnabledLocaleCount: 1,
                domainCount: 1,
                verifiedDomainCount: 1,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      })
      .mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            id: "site-1",
            accountId: "acct-1",
            sourceUrl: "https://example.com",
            status: "active",
            servingMode: "strict",
            maxLocales: null,
            siteProfile: null,
            webhookEvents: ["translation.completed", "translation.failed", "translation.summary"],
            locales: [
              {
                sourceLang: "en",
                targetLang: "fr",
                alias: "fr",
                serveEnabled: true,
              },
            ],
            domains: [],
            latestCrawlRun: null,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      })
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer sb-token");
        return new Response(
          JSON.stringify({
            token: "wb-token",
            expiresAt: tokenExpiresAt,
            entitlements: { planType: "pro", planStatus: "active" },
            actorAccountId: "acct-1",
            subjectAccountId: "acct-1",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    vi.resetModules();
    const { exchangeWebhooksToken, fetchSite, listSites } = await import("./webhooks");

    await listSites("token");
    await fetchSite("token", "site-1");
    await exchangeWebhooksToken("sb-token");

    const timeoutValues = timeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((value): value is number => typeof value === "number");
    expect(timeoutValues).toContain(7_500);
    expect(timeoutValues).toContain(10_000);
    expect(timeoutValues).toContain(6_000);
  });

  it("requests consolidated site dashboard payload with query params", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toContain("/sites/site-1/dashboard");
      expect(url).toContain("includePages=true");
      expect(url).toContain("includeOperationalSummary=false");
      expect(url).toContain("limit=10");
      expect(url).toContain("offset=20");

      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer token");
      expect(typeof headers.get("x-dashboard-trace-id")).toBe("string");

      return new Response(
        JSON.stringify({
          site: {
            id: "site-1",
            accountId: "acct-1",
            sourceUrl: "https://example.com",
            status: "active",
            servingMode: "strict",
            maxLocales: null,
            siteProfile: null,
            webhookEvents: ["translation.completed", "translation.failed", "translation.summary"],
            locales: [],
            domains: [],
            latestCrawlRun: null,
          },
          deployments: [],
          pages: [
            {
              id: "page-1",
              sourcePath: "/",
              lastSeenAt: null,
              lastCrawledAt: null,
              lastSnapshotAt: null,
              nextCrawlAt: null,
              lastVersionAt: null,
            },
          ],
          pagination: {
            limit: 10,
            offset: 20,
            total: 21,
            hasMore: false,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    vi.resetModules();
    const { fetchSiteDashboard } = await import("./webhooks");
    const payload = await fetchSiteDashboard("token", "site-1", {
      includePages: true,
      includeOperationalSummary: false,
      limit: 10,
      offset: 20,
    });

    expect(payload.site.id).toBe("site-1");
    expect(payload.pages).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const timeoutValues = timeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((value): value is number => typeof value === "number");
    expect(timeoutValues).toContain(10_000);
  });

  it("previews proposed source-selection rules without saving", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toContain("/sites/site-1/source-selection/preview");
      expect(url).toContain("limit=100");
      expect(url).toContain("offset=0");
      expect(init?.method).toBe("POST");

      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer token");
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(typeof headers.get("x-dashboard-trace-id")).toBe("string");
      expect(JSON.parse(init?.body as string)).toEqual({
        sourceSelection: {
          rules: [{ action: "include", pattern: "/blog/*" }],
        },
      });

      return new Response(
        JSON.stringify({
          sourceSelection: {
            rules: [{ action: "include", pattern: "/blog/*" }],
          },
          summary: {
            knownPagesTotal: 2,
            knownPagesIncluded: 1,
            knownPagesExcluded: 1,
            includedByDefault: 0,
            includedByRule: 1,
            excludedByRule: 0,
            notIncludedByRule: 1,
            canonicalizedByRule: 0,
            rulesTotal: 1,
          },
          affectedPages: [
            {
              sourcePath: "/blog",
              selected: true,
              reason: "included_by_rule",
              effectiveState: "included",
              previousSelected: true,
              previousReason: "included_by_default",
              changed: false,
              matchedPattern: "/blog/*",
              matchedAction: "include",
              ruleScope: "inherited",
              directRule: null,
              inheritedRule: { action: "include", pattern: "/blog/*" },
            },
          ],
          pagination: {
            limit: 100,
            offset: 0,
            total: 2,
            hasMore: false,
          },
          impact: {
            scope: "known_pages",
            changedKnownPages: 0,
            selectedToExcluded: { count: 0, sourcePaths: [] },
            activeSiteRerun: {
              required: false,
              basis: "site_status_and_config_change",
              activeDeploymentCount: 0,
              deploymentImpact: "not_estimated",
            },
          },
          warnings: [
            {
              code: "include_rules_create_allowlist",
              message:
                "Unmatched paths will be excluded because at least one include rule is present.",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    vi.resetModules();
    const { previewSourceSelection } = await import("./webhooks");
    const preview = await previewSourceSelection(
      "token",
      "site-1",
      {
        sourceSelection: {
          rules: [{ action: "include", pattern: "/blog/*" }],
        },
      },
      { limit: 100, offset: 0 },
    );

    expect(preview.summary.knownPagesIncluded).toBe(1);
    expect(preview.affectedPages[0]?.matchedPattern).toBe("/blog/*");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("accepts site dashboard payloads with operational summary fields", async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer token");

      return new Response(
        JSON.stringify({
          site: {
            id: "site-1",
            accountId: "acct-1",
            sourceUrl: "https://example.com",
            status: "active",
            servingMode: "strict",
            maxLocales: null,
            siteProfile: null,
            webhookEvents: ["translation.completed", "translation.failed", "translation.summary"],
            locales: [],
            domains: [],
            latestCrawlRun: null,
          },
          deployments: [],
          operationalSummary: {
            retry: {
              activeRunCount: 1,
              pagesCompleted: 1,
              pagesPending: 2,
              pagesInProgress: 0,
              pagesFailed: 0,
            },
            dlq: {
              total: 1,
              perWorker: { translate: 1 },
              oldest: "2026-03-25T00:00:00.000Z",
              newest: "2026-03-25T00:00:00.000Z",
              truncated: false,
              complete: true,
              invalidEntries: 0,
              unreadableEntries: 0,
              monitorPath: "/api/sites/site-1/dlq",
              replayPath: "/api/sites/site-1/dlq/replay",
            },
            health: {
              readyPaths: {
                webhooks: "/api/health/ready",
                serve: "/health/ready",
                ops: "/health/ready",
              },
              heartbeatKey: "heartbeat:v1:webhooks.scheduled",
              runbookPath: "/docs/ops/V1_OPERATIONS.md#queue-backlog--pipeline-stalls",
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    vi.resetModules();
    const { fetchSiteDashboard } = await import("./webhooks");
    const payload = await fetchSiteDashboard("token", "site-1");

    expect(payload.operationalSummary?.health.heartbeatKey).toBe("heartbeat:v1:webhooks.scheduled");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("requests deployment history with optional filters", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toContain("/sites/site-1/deployments/history");
      expect(url).toContain("targetLang=fr");
      expect(url).toContain("limit=3");

      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer token");
      expect(typeof headers.get("x-dashboard-trace-id")).toBe("string");

      return new Response(
        JSON.stringify({
          history: [
            {
              targetLang: "fr",
              entries: [
                {
                  deploymentId: "dep-1",
                  status: "active",
                  activatedAt: "2026-02-17T00:00:00Z",
                  createdAt: "2026-02-17T00:00:00Z",
                  routePrefix: "/fr",
                  artifactManifest: "manifest-1",
                },
              ],
            },
          ],
          perLocaleLimit: 3,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    vi.resetModules();
    const { fetchDeploymentHistory } = await import("./webhooks");
    const payload = await fetchDeploymentHistory("token", "site-1", {
      targetLang: "fr",
      limit: 3,
    });

    expect(payload.perLocaleLimit).toBe(3);
    expect(payload.history).toHaveLength(1);
    expect(payload.history[0]?.entries[0]?.deploymentId).toBe("dep-1");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("calls crawl-translate, digest, summary, and switcher endpoints with expected payloads", async () => {
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        expect(url).toContain("/sites/site-1/crawl-translate");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(
          JSON.stringify({
            targetLangs: ["fr", "de"],
            pageIds: ["page-1"],
            sourcePaths: ["/pricing"],
            force: true,
          }),
        );
        return new Response(
          JSON.stringify({
            crawlId: "crawl-1",
            selectedCount: 3,
            enqueuedCount: 3,
            targetLangs: ["fr", "de"],
            force: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      })
      .mockImplementationOnce(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        expect(url).toContain("/digests/subscription");
        expect(init?.method).toBe("PUT");
        expect(init?.body).toBe(
          JSON.stringify({
            email: "alerts@example.com",
            frequency: "weekly",
          }),
        );
        return new Response(
          JSON.stringify({
            subscription: {
              id: "sub-1",
              accountId: "acct-1",
              email: "alerts@example.com",
              frequency: "weekly",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      })
      .mockImplementationOnce(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        expect(url).toContain("/sites/site-1/locales/fr/translation-summary");
        expect(init?.method).toBe("PUT");
        expect(init?.body).toBe(JSON.stringify({ frequency: "daily" }));
        return new Response(
          JSON.stringify({
            preference: {
              siteId: "site-1",
              targetLang: "fr",
              frequency: "daily",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      })
      .mockImplementationOnce(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        expect(url).toContain("/sites/site-1/translation-summaries");
        return new Response(
          JSON.stringify({
            summaries: [
              {
                id: "sum-1",
                siteId: "site-1",
                targetLang: "fr",
                period: "daily",
                rangeStart: "2026-02-14T00:00:00.000Z",
                rangeEnd: "2026-02-15T00:00:00.000Z",
                pagesTranslated: 8,
                pagesUpdated: 2,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      })
      .mockImplementationOnce(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        expect(url).toContain("/sites/site-1/switcher-snippets");
        expect(url).toContain("path=%2Fpricing");
        expect(url).toContain("currentLang=fr");
        return new Response(
          JSON.stringify({
            siteId: "site-1",
            path: "/pricing",
            currentLang: "fr",
            marker: "weblingo-switcher",
            fallbackIds: ["nav"],
            snippets: [{ templateId: "inline", html: "<nav>...</nav>" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });

    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    vi.resetModules();
    const {
      fetchSwitcherSnippets,
      listTranslationSummaries,
      setTranslationSummaryPreference,
      triggerCrawlTranslate,
      upsertDigestSubscription,
    } = await import("./webhooks");

    const crawlResult = await triggerCrawlTranslate("token", "site-1", {
      targetLangs: ["fr", "de"],
      pageIds: ["page-1"],
      sourcePaths: ["/pricing"],
      force: true,
    });
    expect(crawlResult.enqueuedCount).toBe(3);

    const digest = await upsertDigestSubscription("token", {
      email: "alerts@example.com",
      frequency: "weekly",
    });
    expect(digest.frequency).toBe("weekly");

    const preference = await setTranslationSummaryPreference("token", "site-1", "fr", "daily");
    expect(preference.frequency).toBe("daily");

    const summaries = await listTranslationSummaries("token", "site-1");
    expect(summaries).toHaveLength(1);

    const snippets = await fetchSwitcherSnippets("token", "site-1", {
      path: "/pricing",
      currentLang: "fr",
    });
    expect(snippets.snippets).toHaveLength(1);

    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it("keeps managed-demo mock payloads aligned with strict dashboard schemas", async () => {
    setEnv("DASHBOARD_E2E_MOCK", "1");
    setEnv("NODE_ENV", "test");
    setEnv("VERCEL_ENV", "preview");

    vi.resetModules();
    const { createManagedDemo, listManagedDemos } = await import("./webhooks");

    const created = await createManagedDemo("token", {
      site: {
        sourceUrl: "https://www.autotrim.com",
        sourceLang: "en",
        targetLangs: ["fr"],
        subdomainPattern: "https://{lang}.autotrim.com",
        servingMode: "strict",
        maxLocales: null,
        webhookEvents: ["translation.completed", "translation.failed", "translation.summary"],
      },
      showcase: {
        defaultLang: "fr",
      },
    });
    const listed = await listManagedDemos("token");

    expect(created.accountId).toBe("acct-demo-managed");
    expect(created.site.id).toBe("site-smoke-1");
    expect(created.site.crawlStatus).toEqual({ enqueued: true });
    expect(created.showcase.websitePath).toBe("source.example.test");
    expect(listed.items[0]?.showcaseServingStatus).toBe("ready");
    expect(listed.items[0]?.showcaseLocales).toEqual([
      expect.objectContaining({
        targetLang: "fr",
        isDefault: true,
        url: "https://t2.weblingo.app/source.example.test/fr",
      }),
    ]);
  });

  it("requests admin preview list and detail endpoints with strict schemas", async () => {
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        expect(url).toContain("/admin/previews");
        expect(url).toContain("limit=10");
        expect(url).toContain("offset=20");

        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer token");

        return new Response(
          JSON.stringify({
            items: [
              {
                previewId: "preview-1",
                sourceUrl: "https://example.com/pricing",
                sourceLang: "en",
                targetLang: "fr",
                status: "ready",
                previewUrl: "https://preview.weblingo.app/_preview/preview-1",
                expiresAt: "2026-04-04T00:00:00.000Z",
                readyAt: "2026-04-03T00:05:00.000Z",
                stageLast: "complete",
                errorCode: null,
                errorStage: null,
                error: null,
                createdAt: "2026-04-03T00:00:00.000Z",
                updatedAt: "2026-04-03T00:12:00.000Z",
                feedback: {
                  reviewCount: 2,
                  latestSubmittedAt: "2026-04-03T00:12:00.000Z",
                },
              },
            ],
            pagination: {
              limit: 10,
              offset: 20,
              hasMore: true,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      })
      .mockImplementationOnce(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        expect(url).toContain("/admin/previews/preview-1");

        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer token");

        return new Response(
          JSON.stringify({
            preview: {
              previewId: "preview-1",
              sourceUrl: "https://example.com/pricing",
              sourceLang: "en",
              targetLang: "fr",
              status: "ready",
              previewUrl: "https://preview.weblingo.app/_preview/preview-1",
              expiresAt: "2026-04-04T00:00:00.000Z",
              readyAt: "2026-04-03T00:05:00.000Z",
              stageLast: "complete",
              errorCode: null,
              errorStage: null,
              error: null,
              createdAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-03T00:12:00.000Z",
              feedback: {
                reviewCount: 2,
                latestSubmittedAt: "2026-04-03T00:12:00.000Z",
              },
            },
            reviews: [
              {
                id: "review-1",
                translationRating: 4,
                designRating: 5,
                comment: "Looks good overall.",
                previewStatusAtSubmit: "ready",
                previewStageAtSubmit: "complete",
                previewErrorCodeAtSubmit: null,
                channel: "overlay",
                originUrl: "https://preview.weblingo.app/_preview/preview-1",
                submittedAt: "2026-04-03T00:12:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });
    (globalThis as { fetch: typeof fetch }).fetch = fetchSpy as typeof fetch;

    vi.resetModules();
    const { getAdminPreview, listAdminPreviews } = await import("./webhooks");

    const list = await listAdminPreviews("token", { limit: 10, offset: 20 });
    const detail = await getAdminPreview("token", "preview-1");

    expect(list.pagination).toEqual({
      limit: 10,
      offset: 20,
      hasMore: true,
    });
    expect(list.items[0]?.feedback.reviewCount).toBe(2);
    expect(detail.preview.previewId).toBe("preview-1");
    expect(detail.reviews[0]?.channel).toBe("overlay");

    const timeoutValues = timeoutSpy.mock.calls
      .map((call) => call[1])
      .filter((value): value is number => typeof value === "number");
    expect(timeoutValues).toContain(7_500);
    expect(timeoutValues).toContain(10_000);
  });
});
