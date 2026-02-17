import { z } from "zod";

import { env } from "@internal/core";
import { isDashboardE2eMockEnabled } from "@internal/dashboard/e2e-mock";

const apiBase = env.NEXT_PUBLIC_WEBHOOKS_API_BASE.replace(/\/$/, "");
const apiTimeoutMs = Number(env.NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS);
if (!Number.isFinite(apiTimeoutMs) || apiTimeoutMs < 1) {
  throw new Error("[config] NEXT_PUBLIC_WEBHOOKS_API_TIMEOUT_MS must be a positive integer");
}

const REQUEST_TIMEOUT_MS = {
  auth: Math.min(apiTimeoutMs, 6_000),
  bootstrap: Math.min(apiTimeoutMs, 8_000),
  metadata: Math.min(apiTimeoutMs, 8_000),
  list: Math.min(apiTimeoutMs, 7_500),
  detail: Math.min(apiTimeoutMs, 10_000),
  mutation: apiTimeoutMs,
} as const;
const DASHBOARD_E2E_MOCK_SITE_ID = "site-smoke-1";
const DASHBOARD_E2E_MOCK_ACCOUNT_ID = "acct-e2e-smoke";
const DASHBOARD_E2E_MOCK_SOURCE_URL = "https://source.example.test";

type RequestTimeoutProfile = keyof typeof REQUEST_TIMEOUT_MS;

export class WebhooksApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const errorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});

const planTypeSchema = z.enum(["free", "starter", "pro", "agency"]);
const planStatusSchema = z.enum(["active", "past_due", "cancelled"]);

const entitlementsSchema = z
  .object({
    planType: planTypeSchema,
    planStatus: planStatusSchema,
  })
  .strict();

const supportedLanguageSchema = z
  .object({
    tag: z.string().min(1),
    englishName: z.string().min(1),
    direction: z.enum(["ltr", "rtl"]),
  })
  .strict();

const supportedLanguagesResponseSchema = z
  .object({
    languages: z.array(supportedLanguageSchema),
  })
  .strict();

const dnsInstructionsSchema = z
  .object({
    type: z.literal("CNAME"),
    name: z.string(),
    target: z.string(),
    notes: z.string().optional(),
  })
  .strict();

const cloudflareHostnameStateSchema = z
  .object({
    customHostnameId: z.string().nullable(),
    hostnameStatus: z.string().nullable(),
    certStatus: z.string().nullable(),
    lastSyncedAt: z.string().nullable(),
    errors: z.unknown().nullable(),
    errorMessages: z.array(z.string()).nullable().optional(),
  })
  .strict();

const domainSchema = z.object({
  domain: z.string(),
  status: z.enum(["pending", "verified", "failed"]),
  verificationToken: z.string(),
  verifiedAt: z.string().nullable().optional(),
  lastCheckedAt: z.string().nullable().optional(),
  dnsInstructions: dnsInstructionsSchema.nullable().optional(),
  cloudflare: cloudflareHostnameStateSchema.nullable().optional(),
});

const routeLocaleSchema = z.object({
  lang: z.string(),
  origin: z.string(),
  routePrefix: z.string().nullable().optional(),
});

const crawlCaptureModeSchema = z.enum(["template_plus_hydrated", "template_only", "hydrated_only"]);
const spaRefreshFallbackSchema = z.enum(["globalOnly", "baseline"]);
const spaRefreshSchema = z
  .object({
    enabled: z.boolean(),
    missingFallback: spaRefreshFallbackSchema.optional(),
    errorFallback: spaRefreshFallbackSchema.optional(),
    enableSectionScope: z.boolean().optional(),
  })
  .strict();

const routeConfigSchema = z
  .object({
    sourceLang: z.string(),
    sourceOrigin: z.string(),
    pattern: z.string().nullable().optional(),
    locales: z.array(routeLocaleSchema),
    clientRuntimeEnabled: z.boolean(),
    crawlCaptureMode: crawlCaptureModeSchema,
    translatableAttributes: z.array(z.string()).nullable().optional(),
    spaRefresh: spaRefreshSchema.nullable().optional(),
  })
  .nullable();

const siteProfileSchema = z.record(z.string(), z.unknown()).nullable();

const siteSummarySchema = z
  .object({
    id: z.string(),
    accountId: z.string(),
    sourceUrl: z.string(),
    status: z.enum(["active", "inactive"]),
    servingMode: z.enum(["strict", "tolerant"]),
    maxLocales: z.number().int().positive().nullable(),
    siteProfile: siteProfileSchema,
    sourceLang: z.string().nullable(),
    targetLangs: z.array(z.string()),
    localeCount: z.number().int().nonnegative(),
    serveEnabledLocaleCount: z.number().int().nonnegative(),
    domainCount: z.number().int().nonnegative(),
    verifiedDomainCount: z.number().int().nonnegative(),
  })
  .strict();

const siteSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  sourceUrl: z.string(),
  status: z.enum(["active", "inactive"]),
  servingMode: z.enum(["strict", "tolerant"]),
  maxLocales: z.number().int().positive().nullable(),
  siteProfile: siteProfileSchema,
  locales: z.array(
    z.object({
      sourceLang: z.string(),
      targetLang: z.string(),
      alias: z.string().nullable().optional(),
      serveEnabled: z.boolean(),
    }),
  ),
  routeConfig: routeConfigSchema.optional(),
  domains: z.array(domainSchema),
  latestCrawlRun: z
    .object({
      id: z.string(),
      sourceUrl: z.string(),
      trigger: z.enum(["cron", "queue"]),
      status: z.enum(["in_progress", "completed", "failed"]),
      pagesDiscovered: z.number().int().nonnegative(),
      pagesEnqueued: z.number().int().nonnegative(),
      selectedCount: z.number().int().nonnegative(),
      skippedDueToLimitCount: z.number().int().nonnegative(),
      crawlCaptureMode: crawlCaptureModeSchema.nullable().optional(),
      error: z.string().nullable().optional(),
      startedAt: z.string().nullable().optional(),
      finishedAt: z.string().nullable().optional(),
      createdAt: z.string().nullable().optional(),
      updatedAt: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const listSitesResponseSchema = z.object({ sites: z.array(siteSummarySchema) });

const sitePageSummarySchema = z.object({
  id: z.string(),
  sourcePath: z.string(),
  lastSeenAt: z.string().nullable().optional(),
  lastCrawledAt: z.string().nullable().optional(),
  lastSnapshotAt: z.string().nullable().optional(),
  nextCrawlAt: z.string().nullable().optional(),
  lastVersionAt: z.string().nullable().optional(),
});

const sitePagesSummarySchema = z
  .object({
    lastCrawlStartedAt: z.string().nullable().optional(),
    lastCrawlFinishedAt: z.string().nullable().optional(),
    pagesUpdated: z.number().int().nonnegative(),
    pagesPending: z.number().int().nonnegative(),
  })
  .strict();

const crawlStatusSchema = z.object({
  enqueued: z.boolean(),
  error: z.string().optional(),
});

const siteWithCrawlStatusSchema = siteSchema.extend({ crawlStatus: crawlStatusSchema }).strict();

const translationRunSchema = z
  .object({
    id: z.string(),
    siteId: z.string(),
    targetLang: z.string(),
    status: z.enum(["queued", "in_progress", "completed", "failed", "cancelled"]),
    pagesTotal: z.number().int().nonnegative(),
    pagesCompleted: z.number().int().nonnegative(),
    pagesFailed: z.number().int().nonnegative(),
    startedAt: z.string().nullable().optional(),
    finishedAt: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .strict();

const translateSiteResponseSchema = z
  .object({
    run: translationRunSchema.nullable(),
    enqueued: z.number().int().nonnegative(),
    missingSnapshots: z.number().int().nonnegative().optional(),
    crawlEnqueued: z.boolean().optional(),
  })
  .strict();

const setLocaleServingResponseSchema = z
  .object({
    targetLang: z.string(),
    serveEnabled: z.boolean(),
    servingStatus: z.enum(["inactive", "disabled", "needs_domain", "ready", "serving"]),
    activeDeploymentId: z.string().nullable().optional(),
  })
  .strict();

const digestFrequencySchema = z.enum(["daily", "weekly", "off"]);

const digestSubscriptionSchema = z
  .object({
    id: z.string(),
    accountId: z.string(),
    email: z.string(),
    frequency: digestFrequencySchema,
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .strict();

const upsertDigestSubscriptionResponseSchema = z
  .object({
    subscription: digestSubscriptionSchema,
  })
  .strict();

const crawlTranslateResponseSchema = z
  .object({
    crawlId: z.string(),
    selectedCount: z.number().nonnegative(),
    enqueuedCount: z.number().nonnegative(),
    targetLangs: z.array(z.string().min(1)),
    force: z.boolean(),
  })
  .strict();

const translationSummaryFrequencySchema = digestFrequencySchema;

const translationSummaryPreferenceSchema = z
  .object({
    siteId: z.string(),
    targetLang: z.string(),
    frequency: translationSummaryFrequencySchema,
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .strict();

const setTranslationSummaryPreferenceResponseSchema = z
  .object({
    preference: translationSummaryPreferenceSchema,
  })
  .strict();

const translationSummarySchema = z
  .object({
    id: z.string(),
    siteId: z.string(),
    targetLang: z.string(),
    period: z.enum(["daily", "weekly"]),
    rangeStart: z.string(),
    rangeEnd: z.string(),
    pagesTranslated: z.number().nonnegative(),
    pagesUpdated: z.number().nonnegative(),
    lastDeploymentAt: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .strict();

const listTranslationSummariesResponseSchema = z
  .object({
    summaries: z.array(translationSummarySchema),
  })
  .strict();

const languageSwitcherTemplateIdSchema = z.enum([
  "inline",
  "disclosure",
  "pill",
  "tabs",
  "compact",
]);

const languageSwitcherSnippetTemplateIdSchema = z.union([
  languageSwitcherTemplateIdSchema,
  z.literal("headless"),
]);

const languageSwitcherSnippetSchema = z
  .object({
    templateId: languageSwitcherSnippetTemplateIdSchema,
    html: z.string(),
  })
  .strict();

const languageSwitcherSnippetsResponseSchema = z
  .object({
    siteId: z.string(),
    path: z.string(),
    currentLang: z.string(),
    marker: z.string(),
    fallbackIds: z.array(z.string()),
    snippets: z.array(languageSwitcherSnippetSchema),
  })
  .strict();

const artifactManifestSchema = z
  .union([z.string(), z.object({}).passthrough()])
  .nullable()
  .optional();

const deploymentCompletenessStatusSchema = z.enum([
  "not_started",
  "partial",
  "complete",
  "unknown",
]);

const deploymentCompletenessSchema = z
  .object({
    discoveredPages: z.number().int().nonnegative(),
    translatedPages: z.number().int().nonnegative(),
    pendingPages: z.number().int().nonnegative(),
    percentage: z.number().int().min(0).max(100),
    status: deploymentCompletenessStatusSchema,
  })
  .strict();

const deploymentSchema = z.object({
  targetLang: z.string(),
  status: z.string(),
  deploymentId: z.string().nullable().optional(),
  activatedAt: z.string().nullable().optional(),
  routePrefix: z.string().nullable().optional(),
  artifactManifest: artifactManifestSchema,
  activeDeploymentId: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  domainStatus: z.enum(["pending", "verified", "failed"]).nullable().optional(),
  serveEnabled: z.boolean(),
  servingStatus: z.enum(["inactive", "disabled", "needs_domain", "ready", "serving"]),
  translationRun: translationRunSchema.nullable().optional(),
  completeness: deploymentCompletenessSchema,
});

const listDeploymentsResponseSchema = z.object({ deployments: z.array(deploymentSchema) });

const deploymentHistoryEntrySchema = z
  .object({
    deploymentId: z.string(),
    status: z.string(),
    createdAt: z.string().nullable().optional(),
    activatedAt: z.string().nullable().optional(),
    routePrefix: z.string().nullable().optional(),
    artifactManifest: artifactManifestSchema,
  })
  .strict();

const deploymentHistoryByLocaleSchema = z
  .object({
    targetLang: z.string(),
    entries: z.array(deploymentHistoryEntrySchema),
  })
  .strict();

const listDeploymentHistoryResponseSchema = z
  .object({
    history: z.array(deploymentHistoryByLocaleSchema),
    perLocaleLimit: z.number().int().positive(),
  })
  .strict();

const glossaryEntrySchema = z.object({
  source: z.string(),
  target: z.string(),
  targetLangs: z.array(z.string()).optional(),
  matchType: z.string().optional(),
  caseSensitive: z.boolean().optional(),
  scope: z.enum(["segment", "in_segment"]).optional(),
});

const glossaryResponseSchema = z.object({ entries: z.array(glossaryEntrySchema) });

const authResponseSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string(),
  entitlements: entitlementsSchema,
  actorAccountId: z.string().min(1),
  subjectAccountId: z.string().min(1),
});

const listSitePagesResponseSchema = z
  .object({
    pages: z.array(sitePageSummarySchema),
    pagination: z
      .object({
        limit: z.number().int().nonnegative(),
        offset: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
        hasMore: z.boolean(),
      })
      .strict(),
  })
  .strict();

const siteDashboardResponseSchema = z
  .object({
    site: siteSchema,
    deployments: z.array(deploymentSchema),
    pagesSummary: sitePagesSummarySchema.optional(),
    pages: z.array(sitePageSummarySchema).optional(),
    pagination: listSitePagesResponseSchema.shape.pagination.optional(),
  })
  .strict();

const featureFlagsSchema = z
  .object({
    editEnabled: z.boolean(),
    slugEditEnabled: z.boolean(),
    glossaryEnabled: z.boolean(),
    overridesEnabled: z.boolean(),
    tmWriteEnabled: z.boolean(),
    publishEnabled: z.boolean(),
    pipelineAllowed: z.boolean(),
    serveAllowed: z.boolean(),
    siteCreateEnabled: z.boolean(),
    localeUpdateEnabled: z.boolean(),
    domainVerifyEnabled: z.boolean(),
    crawlTriggerEnabled: z.boolean(),
    crawlCaptureModeEnabled: z.boolean(),
    clientRuntimeToggleEnabled: z.boolean(),
    translatableAttributesEnabled: z.boolean(),
    renderEnabled: z.boolean(),
    agencyActionsEnabled: z.boolean(),
    internalOpsEnabled: z.boolean(),
    demoMode: z.boolean(),
    maxSites: z.number().int().nonnegative().nullable(),
    maxLocales: z.number().int().nonnegative().nullable(),
    maxDailyRecrawls: z.number().int().nonnegative().nullable(),
    maxDailyPageRecrawls: z.number().int().nonnegative().nullable(),
    maxGlossarySources: z.number().int().nonnegative().nullable(),
    featurePreview: z.array(z.string()),
  })
  .strict();

const dailyCrawlUsageSchema = z
  .object({
    date: z.string(),
    siteCrawls: z.number().int().nonnegative(),
    pageCrawls: z.number().int().nonnegative(),
  })
  .strict();

const quotasSchema = z
  .object({
    maxSites: z.number().int().nonnegative().nullable(),
    starterQuota: z.number().int().nonnegative().nullable(),
    proQuota: z.number().int().nonnegative().nullable(),
  })
  .strict();

const accountMeSchema = z
  .object({
    accountId: z.string(),
    planType: planTypeSchema,
    planStatus: planStatusSchema,
    featureFlags: featureFlagsSchema,
    dailyCrawlUsage: dailyCrawlUsageSchema,
    quotas: quotasSchema,
  })
  .strict();

const agencyCustomerPlanSchema = z.enum(["starter", "pro"]);
const agencyCustomerStatusSchema = z.enum(["active", "suspended"]);

const agencyCustomerSchema = z
  .object({
    agencyAccountId: z.string(),
    customerAccountId: z.string(),
    customerPlan: agencyCustomerPlanSchema,
    planStatus: planStatusSchema,
    status: agencyCustomerStatusSchema,
    createdAt: z.string().nullable().optional(),
    activeSiteCount: z.number().int().nonnegative(),
    customerEmail: z.string().nullable().optional(),
  })
  .strict();

const agencyCustomersSummarySchema = z
  .object({
    totalActiveSites: z.number().int().nonnegative(),
    maxSites: z.number().int().nonnegative().nullable(),
  })
  .strict();

const listAgencyCustomersResponseSchema = z
  .object({
    customers: z.array(agencyCustomerSchema),
    summary: agencyCustomersSummarySchema,
  })
  .strict();

const createAgencyCustomerResponseSchema = z
  .object({
    customer: agencyCustomerSchema,
    inviteLink: z.string(),
  })
  .strict();

const dashboardBootstrapResponseSchema = z
  .object({
    token: z.string().min(1),
    expiresAt: z.string(),
    entitlements: entitlementsSchema,
    actorAccountId: z.string().min(1),
    subjectAccountId: z.string().min(1),
    account: accountMeSchema,
    agencyCustomers: listAgencyCustomersResponseSchema.nullable(),
  })
  .strict();

const translationRunResponseSchema = z.object({ run: translationRunSchema }).strict();

const resumeTranslationRunResponseSchema = z
  .object({
    run: translationRunSchema,
    enqueued: z.number().int().nonnegative(),
    enqueuedTranslate: z.number().int().nonnegative(),
    enqueuedRender: z.number().int().nonnegative(),
  })
  .strict();

const domainResponseSchema = z.object({ domain: domainSchema });

const createOverrideResponseSchema = z
  .object({
    segmentId: z.string(),
    targetLang: z.string(),
    contextHashScope: z.string().nullable(),
  })
  .strict();

const setSlugResponseSchema = z
  .object({
    pageId: z.string(),
    lang: z.string(),
    path: z.string(),
    crawlStatus: crawlStatusSchema,
  })
  .strict();

const upsertGlossaryResponseSchema = z
  .object({
    entries: z.array(glossaryEntrySchema),
    crawlStatus: crawlStatusSchema.nullable().optional(),
  })
  .strict();

export type Site = z.infer<typeof siteSchema>;
export type SiteSummary = z.infer<typeof siteSummarySchema>;
export type Domain = z.infer<typeof domainSchema>;
export type RouteConfig = z.infer<typeof routeConfigSchema>;
export type CrawlCaptureMode = z.infer<typeof crawlCaptureModeSchema>;
export type SpaRefreshSettings = z.infer<typeof spaRefreshSchema>;
export type SpaRefreshFallback = z.infer<typeof spaRefreshFallbackSchema>;
export type CrawlStatus = z.infer<typeof crawlStatusSchema>;
export type Deployment = z.infer<typeof deploymentSchema>;
export type DeploymentCompleteness = z.infer<typeof deploymentCompletenessSchema>;
export type DeploymentHistoryEntry = z.infer<typeof deploymentHistoryEntrySchema>;
export type DeploymentHistoryByLocale = z.infer<typeof deploymentHistoryByLocaleSchema>;
export type DeploymentHistoryResponse = z.infer<typeof listDeploymentHistoryResponseSchema>;
export type TranslationRun = z.infer<typeof translationRunSchema>;
export type SitePageSummary = z.infer<typeof sitePageSummarySchema>;
export type SitePagesSummary = z.infer<typeof sitePagesSummarySchema>;
export type SitePagesPagination = z.infer<typeof listSitePagesResponseSchema.shape.pagination>;
export type SitePagesResponse = z.infer<typeof listSitePagesResponseSchema>;
export type SiteDashboardResponse = z.infer<typeof siteDashboardResponseSchema>;
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;
export type DigestFrequency = z.infer<typeof digestFrequencySchema>;
export type DigestSubscription = z.infer<typeof digestSubscriptionSchema>;
export type CrawlTranslateResponse = z.infer<typeof crawlTranslateResponseSchema>;
export type TranslationSummaryFrequency = z.infer<typeof translationSummaryFrequencySchema>;
export type TranslationSummaryPreference = z.infer<typeof translationSummaryPreferenceSchema>;
export type TranslationSummary = z.infer<typeof translationSummarySchema>;
export type LanguageSwitcherSnippet = z.infer<typeof languageSwitcherSnippetSchema>;
export type LanguageSwitcherSnippetsResponse = z.infer<
  typeof languageSwitcherSnippetsResponseSchema
>;
export type AccountMe = z.infer<typeof accountMeSchema>;
export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;
export type AgencyCustomer = z.infer<typeof agencyCustomerSchema>;
export type AgencyCustomersSummary = z.infer<typeof agencyCustomersSummarySchema>;
export type AgencyCustomersResponse = z.infer<typeof listAgencyCustomersResponseSchema>;
export type CreateAgencyCustomerResponse = z.infer<typeof createAgencyCustomerResponseSchema>;
export type DashboardBootstrapResponse = z.infer<typeof dashboardBootstrapResponseSchema>;

// Exported for cross-repo contract tests only (OpenAPI ↔ website zod schemas).
export const __webhooksZodContracts = {
  supportedLanguagesResponseSchema,
  authResponseSchema,
  dashboardBootstrapResponseSchema,
  accountMeSchema,
  listAgencyCustomersResponseSchema,
  createAgencyCustomerResponseSchema,
  listSitesResponseSchema,
  siteSummarySchema,
  siteSchema,
  siteWithCrawlStatusSchema,
  crawlStatusSchema,
  translateSiteResponseSchema,
  setLocaleServingResponseSchema,
  translationRunResponseSchema,
  resumeTranslationRunResponseSchema,
  domainResponseSchema,
  listDeploymentsResponseSchema,
  listDeploymentHistoryResponseSchema,
  listSitePagesResponseSchema,
  siteDashboardResponseSchema,
  upsertDigestSubscriptionResponseSchema,
  crawlTranslateResponseSchema,
  setTranslationSummaryPreferenceResponseSchema,
  listTranslationSummariesResponseSchema,
  languageSwitcherSnippetsResponseSchema,
  glossaryResponseSchema,
  upsertGlossaryResponseSchema,
  createOverrideResponseSchema,
  setSlugResponseSchema,
} as const;

export type WebhooksAuth = {
  token: string;
  refresh?: () => Promise<string>;
};

type AuthInput = string | WebhooksAuth;

const FALLBACK_SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { tag: "ar", englishName: "Arabic", direction: "rtl" },
  { tag: "bg", englishName: "Bulgarian (Bulgaria)", direction: "ltr" },
  { tag: "cs", englishName: "Czech (Czech Republic)", direction: "ltr" },
  { tag: "da", englishName: "Danish (Denmark)", direction: "ltr" },
  { tag: "de", englishName: "German (Germany)", direction: "ltr" },
  { tag: "el", englishName: "Greek (Greece)", direction: "ltr" },
  { tag: "en", englishName: "English", direction: "ltr" },
  { tag: "en-GB", englishName: "English (United Kingdom)", direction: "ltr" },
  { tag: "es", englishName: "Spanish (Spain)", direction: "ltr" },
  { tag: "es-419", englishName: "Spanish (Latin America)", direction: "ltr" },
  { tag: "et", englishName: "Estonian (Estonia)", direction: "ltr" },
  { tag: "fi", englishName: "Finnish (Finland)", direction: "ltr" },
  { tag: "fil", englishName: "Filipino (Philippines)", direction: "ltr" },
  { tag: "fr", englishName: "French (France)", direction: "ltr" },
  { tag: "fr-CA", englishName: "French (Canada)", direction: "ltr" },
  { tag: "he", englishName: "Hebrew (Israel)", direction: "rtl" },
  { tag: "hr", englishName: "Croatian (Croatia)", direction: "ltr" },
  { tag: "hu", englishName: "Hungarian (Hungary)", direction: "ltr" },
  { tag: "id", englishName: "Indonesian (Indonesia)", direction: "ltr" },
  { tag: "it", englishName: "Italian (Italy)", direction: "ltr" },
  { tag: "ja", englishName: "Japanese (Japan)", direction: "ltr" },
  { tag: "ko", englishName: "Korean (Korea)", direction: "ltr" },
  { tag: "lt", englishName: "Lithuanian (Lithuania)", direction: "ltr" },
  { tag: "lv", englishName: "Latvian (Latvia)", direction: "ltr" },
  { tag: "ms", englishName: "Malay (Malaysia)", direction: "ltr" },
  { tag: "mt", englishName: "Maltese (Malta)", direction: "ltr" },
  { tag: "nb", englishName: "Norwegian Bokmål", direction: "ltr" },
  { tag: "nl", englishName: "Dutch (Netherlands)", direction: "ltr" },
  { tag: "pl", englishName: "Polish (Poland)", direction: "ltr" },
  { tag: "pt", englishName: "Portuguese", direction: "ltr" },
  { tag: "pt-BR", englishName: "Portuguese (Brazil)", direction: "ltr" },
  { tag: "ro", englishName: "Romanian (Romania)", direction: "ltr" },
  { tag: "ru", englishName: "Russian (Russia)", direction: "ltr" },
  { tag: "sk", englishName: "Slovak (Slovakia)", direction: "ltr" },
  { tag: "sl", englishName: "Slovenian (Slovenia)", direction: "ltr" },
  { tag: "sv", englishName: "Swedish (Sweden)", direction: "ltr" },
  { tag: "th", englishName: "Thai (Thailand)", direction: "ltr" },
  { tag: "tr", englishName: "Turkish (Turkey)", direction: "ltr" },
  { tag: "vi", englishName: "Vietnamese (Vietnam)", direction: "ltr" },
  { tag: "zh", englishName: "Chinese Simplified (China)", direction: "ltr" },
  { tag: "zh-HK", englishName: "Chinese Traditional (Hong Kong)", direction: "ltr" },
  { tag: "zh-TW", englishName: "Chinese Traditional (Taiwan)", direction: "ltr" },
] as const;

export const SUPPORTED_LANGUAGES_STATIC: SupportedLanguage[] = [...FALLBACK_SUPPORTED_LANGUAGES];

function createDashboardE2eMockSiteSummary(siteId: string) {
  return {
    id: siteId,
    accountId: DASHBOARD_E2E_MOCK_ACCOUNT_ID,
    sourceUrl: DASHBOARD_E2E_MOCK_SOURCE_URL,
    status: "active" as const,
    servingMode: "strict" as const,
    maxLocales: null,
    siteProfile: null,
    sourceLang: "en",
    targetLangs: ["fr", "ja"],
    localeCount: 2,
    serveEnabledLocaleCount: 2,
    domainCount: 3,
    verifiedDomainCount: 1,
  };
}

function createDashboardE2eMockSite(siteId: string) {
  const now = new Date().toISOString();
  return {
    id: siteId,
    accountId: DASHBOARD_E2E_MOCK_ACCOUNT_ID,
    sourceUrl: DASHBOARD_E2E_MOCK_SOURCE_URL,
    status: "active" as const,
    servingMode: "strict" as const,
    maxLocales: null,
    siteProfile: null,
    locales: [
      { sourceLang: "en", targetLang: "fr", alias: null, serveEnabled: true },
      { sourceLang: "en", targetLang: "ja", alias: null, serveEnabled: true },
    ],
    routeConfig: {
      sourceLang: "en",
      sourceOrigin: DASHBOARD_E2E_MOCK_SOURCE_URL,
      pattern: null,
      locales: [
        { lang: "fr", origin: "https://fr.example.test", routePrefix: "/fr" },
        { lang: "ja", origin: "https://verify.example.test", routePrefix: "/ja" },
      ],
      clientRuntimeEnabled: true,
      crawlCaptureMode: "template_plus_hydrated" as const,
      translatableAttributes: null,
      spaRefresh: {
        enabled: false,
        missingFallback: "baseline" as const,
        errorFallback: "baseline" as const,
        enableSectionScope: false,
      },
    },
    domains: [
      {
        domain: "pending.example.test",
        status: "pending" as const,
        verificationToken: "pending-token",
        verifiedAt: null,
        lastCheckedAt: now,
        dnsInstructions: {
          type: "CNAME" as const,
          name: "pending",
          target: "weblingo.cfargotunnel.com",
          notes: "Create this CNAME to start provisioning.",
        },
        cloudflare: null,
      },
      {
        domain: "verify.example.test",
        status: "pending" as const,
        verificationToken: "verify-token",
        verifiedAt: null,
        lastCheckedAt: now,
        dnsInstructions: null,
        cloudflare: null,
      },
      {
        domain: "fr.example.test",
        status: "verified" as const,
        verificationToken: "fr-token",
        verifiedAt: now,
        lastCheckedAt: now,
        dnsInstructions: {
          type: "CNAME" as const,
          name: "fr",
          target: "weblingo.cfargotunnel.com",
          notes: "Verified in mock mode.",
        },
        cloudflare: {
          customHostnameId: "cf-hostname-fr",
          hostnameStatus: "active",
          certStatus: "active",
          lastSyncedAt: now,
          errors: null,
          errorMessages: null,
        },
      },
    ],
    latestCrawlRun: {
      id: "crawl-run-latest",
      sourceUrl: DASHBOARD_E2E_MOCK_SOURCE_URL,
      trigger: "cron" as const,
      status: "completed" as const,
      pagesDiscovered: 30,
      pagesEnqueued: 30,
      selectedCount: 30,
      skippedDueToLimitCount: 0,
      crawlCaptureMode: "template_plus_hydrated" as const,
      error: null,
      startedAt: now,
      finishedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  };
}

function createDashboardE2eMockDeployments(siteId: string) {
  const now = new Date().toISOString();
  const siteSlug = siteId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return [
    {
      targetLang: "fr",
      status: "active",
      deploymentId: `dep-${siteSlug}-fr-current`,
      activatedAt: now,
      routePrefix: "/fr",
      artifactManifest: { pages: ["/", "/pricing"], generatedAt: now },
      activeDeploymentId: `dep-${siteSlug}-fr-current`,
      domain: "fr.example.test",
      domainStatus: "verified" as const,
      serveEnabled: true,
      servingStatus: "ready" as const,
      translationRun: null,
      completeness: {
        discoveredPages: 30,
        translatedPages: 30,
        pendingPages: 0,
        percentage: 100,
        status: "complete" as const,
      },
    },
    {
      targetLang: "ja",
      status: "pending",
      deploymentId: null,
      activatedAt: null,
      routePrefix: "/ja",
      artifactManifest: null,
      activeDeploymentId: null,
      domain: "verify.example.test",
      domainStatus: "pending" as const,
      serveEnabled: true,
      servingStatus: "needs_domain" as const,
      translationRun: null,
      completeness: {
        discoveredPages: 30,
        translatedPages: 14,
        pendingPages: 16,
        percentage: 47,
        status: "partial" as const,
      },
    },
  ];
}

function createDashboardE2eMockPages(total = 30) {
  const now = Date.now();
  return Array.from({ length: total }, (_, index) => {
    const pageNumber = index + 1;
    const timestamp = new Date(now - index * 60_000).toISOString();
    const nextCrawlAt = new Date(now + (index % 2 === 0 ? -1 : 1) * 3_600_000).toISOString();
    return {
      id: `page-${pageNumber}`,
      sourcePath: pageNumber === 1 ? "/" : `/page-${pageNumber}`,
      lastSeenAt: timestamp,
      lastCrawledAt: timestamp,
      lastSnapshotAt: timestamp,
      nextCrawlAt,
      lastVersionAt: timestamp,
    };
  });
}

function createDashboardE2eMockDeploymentHistory(limit: number) {
  const now = Date.now();
  const createEntries = (targetLang: "fr" | "ja") =>
    Array.from({ length: Math.max(limit, 1) }, (_, index) => {
      const createdAt = new Date(now - index * 3_600_000).toISOString();
      return {
        deploymentId: `dep-${targetLang}-${index + 1}`,
        status: index === 0 ? "active" : "superseded",
        createdAt,
        activatedAt: createdAt,
        routePrefix: `/${targetLang}`,
        artifactManifest: {
          pages: ["/", "/pricing"],
          generatedAt: createdAt,
        },
      };
    }).slice(0, limit);

  return {
    history: [
      { targetLang: "fr", entries: createEntries("fr") },
      { targetLang: "ja", entries: createEntries("ja") },
    ],
    perLocaleLimit: limit,
  };
}

function createDashboardE2eMockDashboardPayload(siteId: string, searchParams: URLSearchParams) {
  const includePages = searchParams.get("includePages") === "true";
  const limitRaw = Number(searchParams.get("limit") ?? "25");
  const offsetRaw = Number(searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 25;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
  const allPages = createDashboardE2eMockPages(30);
  const pages = allPages.slice(offset, offset + limit);
  const payload: Record<string, unknown> = {
    site: createDashboardE2eMockSite(siteId),
    deployments: createDashboardE2eMockDeployments(siteId),
    pagesSummary: {
      lastCrawlStartedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
      lastCrawlFinishedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
      pagesUpdated: 18,
      pagesPending: 5,
    },
  };
  if (includePages) {
    payload.pages = pages;
    payload.pagination = {
      limit,
      offset,
      total: allPages.length,
      hasMore: offset + pages.length < allPages.length,
    };
  }
  return payload;
}

function resolveDashboardE2eMockPayload(input: {
  path: string;
  method: string;
  body?: unknown;
}): unknown | null {
  const url = input.path.startsWith("http")
    ? new URL(input.path)
    : new URL(input.path, "https://mock.weblingo.local");
  const method = input.method.toUpperCase();
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/sites") {
    return { sites: [createDashboardE2eMockSiteSummary(DASHBOARD_E2E_MOCK_SITE_ID)] };
  }

  if (method === "GET" && pathname === "/meta/languages") {
    return { languages: FALLBACK_SUPPORTED_LANGUAGES.slice(0, 3) };
  }

  const siteMatch = pathname.match(/^\/sites\/([^/]+)$/);
  if (siteMatch && method === "GET") {
    return createDashboardE2eMockSite(siteMatch[1] ?? DASHBOARD_E2E_MOCK_SITE_ID);
  }
  if (siteMatch && method === "PATCH") {
    return createDashboardE2eMockSite(siteMatch[1] ?? DASHBOARD_E2E_MOCK_SITE_ID);
  }

  const siteDashboardMatch = pathname.match(/^\/sites\/([^/]+)\/dashboard$/);
  if (siteDashboardMatch && method === "GET") {
    return createDashboardE2eMockDashboardPayload(
      siteDashboardMatch[1] ?? DASHBOARD_E2E_MOCK_SITE_ID,
      url.searchParams,
    );
  }

  const deploymentsMatch = pathname.match(/^\/sites\/([^/]+)\/deployments$/);
  if (deploymentsMatch && method === "GET") {
    return {
      deployments: createDashboardE2eMockDeployments(
        deploymentsMatch[1] ?? DASHBOARD_E2E_MOCK_SITE_ID,
      ),
    };
  }

  const deploymentHistoryMatch = pathname.match(/^\/sites\/([^/]+)\/deployments\/history$/);
  if (deploymentHistoryMatch && method === "GET") {
    const limitRaw = Number(url.searchParams.get("limit") ?? "5");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 5;
    return createDashboardE2eMockDeploymentHistory(limit);
  }

  const crawlMatch = pathname.match(/^\/sites\/([^/]+)\/crawl$/);
  if (crawlMatch && method === "POST") {
    return { enqueued: true };
  }

  const crawlTranslateMatch = pathname.match(/^\/sites\/([^/]+)\/crawl-translate$/);
  if (crawlTranslateMatch && method === "POST") {
    const payload =
      input.body && typeof input.body === "object" ? (input.body as Record<string, unknown>) : {};
    const targetLangs = Array.isArray(payload.targetLangs)
      ? payload.targetLangs.filter((value): value is string => typeof value === "string")
      : ["fr"];
    return {
      crawlId: "crawl-translate-smoke",
      selectedCount: 2,
      enqueuedCount: 2,
      targetLangs,
      force: payload.force === true,
    };
  }

  const translateMatch = pathname.match(/^\/sites\/([^/]+)\/translate$/);
  if (translateMatch && method === "POST") {
    const payload =
      input.body && typeof input.body === "object" ? (input.body as Record<string, unknown>) : {};
    const targetLang = typeof payload.targetLang === "string" ? payload.targetLang : "fr";
    const now = new Date().toISOString();
    return {
      run: {
        id: `run-${targetLang}-smoke`,
        siteId: translateMatch[1] ?? DASHBOARD_E2E_MOCK_SITE_ID,
        targetLang,
        status: "in_progress",
        pagesTotal: 2,
        pagesCompleted: 0,
        pagesFailed: 0,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      enqueued: 2,
      missingSnapshots: 0,
      crawlEnqueued: false,
    };
  }

  const pageCrawlMatch = pathname.match(/^\/sites\/([^/]+)\/pages\/([^/]+)\/crawl$/);
  if (pageCrawlMatch && method === "POST") {
    return { enqueued: true };
  }

  const serveToggleMatch = pathname.match(/^\/sites\/([^/]+)\/locales\/([^/]+)\/serve$/);
  if (serveToggleMatch && method === "POST") {
    const payload =
      input.body && typeof input.body === "object" ? (input.body as Record<string, unknown>) : {};
    const enabled = payload.enabled === true;
    const targetLang = decodeURIComponent(serveToggleMatch[2] ?? "fr");
    return {
      targetLang,
      serveEnabled: enabled,
      servingStatus: enabled ? "ready" : "disabled",
      activeDeploymentId: enabled ? `dep-${targetLang}-current` : null,
    };
  }

  const domainMatch = pathname.match(
    /^\/sites\/([^/]+)\/domains\/([^/]+)\/(verify|provision|refresh)$/,
  );
  if (domainMatch && method === "POST") {
    const domain = decodeURIComponent(domainMatch[2] ?? "pending.example.test");
    const action = domainMatch[3];
    const now = new Date().toISOString();
    const status =
      action === "verify" || domain === "fr.example.test"
        ? ("verified" as const)
        : ("pending" as const);
    return {
      domain: {
        domain,
        status,
        verificationToken: `${domain}-token`,
        verifiedAt: status === "verified" ? now : null,
        lastCheckedAt: now,
        dnsInstructions:
          domain === "verify.example.test"
            ? null
            : {
                type: "CNAME" as const,
                name: domain.split(".")[0] ?? "www",
                target: "weblingo.cfargotunnel.com",
                notes: "Mock DNS instructions",
              },
        cloudflare: null,
      },
    };
  }

  return null;
}

type RequestOptions<T> = {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  auth?: AuthInput;
  body?: unknown;
  schema: z.ZodSchema<T>;
  headers?: HeadersInit;
  retry?: boolean;
  allowEmptyResponse?: boolean;
  timeoutProfile?: RequestTimeoutProfile;
  traceId?: string;
};

async function request<T>({
  path,
  method = "GET",
  auth,
  body,
  schema,
  headers,
  retry = false,
  allowEmptyResponse = false,
  timeoutProfile = "mutation",
  traceId: inputTraceId,
}: RequestOptions<T>): Promise<T> {
  const startedAt = Date.now();
  let loggedTiming = false;
  const traceId = inputTraceId ?? buildDashboardTraceId();
  const timeoutMs = REQUEST_TIMEOUT_MS[timeoutProfile];
  const logTiming = (status: number, ok: boolean, note?: string) => {
    if (loggedTiming) {
      return;
    }
    loggedTiming = true;
    const payload: Record<string, unknown> = {
      path,
      method,
      status,
      ok,
      retry,
      durationMs: Date.now() - startedAt,
      traceId,
      timeoutProfile,
      timeoutMs,
    };
    if (note) {
      payload.note = note;
    }
    console.info("[webhooks] timing", payload);
  };

  if (isDashboardE2eMockEnabled()) {
    const mockPayload = resolveDashboardE2eMockPayload({
      path,
      method,
      body,
    });
    if (mockPayload === null) {
      logTiming(500, false, "mock_missing_fixture");
      throw new WebhooksApiError(`[mock] No fixture for ${method} ${path}`, 500);
    }
    const parsedMock = schema.safeParse(mockPayload);
    if (!parsedMock.success) {
      logTiming(500, false, "mock_schema_mismatch");
      throw parsedMock.error;
    }
    logTiming(200, true, "mock");
    return parsedMock.data;
  }

  const resolvedAuth = normalizeAuth(auth);
  const token = resolvedAuth?.token;
  const url = path.startsWith("http")
    ? path
    : `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        "x-dashboard-trace-id": traceId,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = controller.signal.aborted;
    logTiming(0, false, timedOut ? "timeout" : "fetch_failed");
    throw new WebhooksApiError(
      timedOut
        ? "The WebLingo API request timed out. Please retry."
        : "Unable to reach the WebLingo API. Check NEXT_PUBLIC_WEBHOOKS_API_BASE and that the webhooks worker is running.",
      timedOut ? 504 : 0,
      error,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  const parsed = text ? safeParseJson(text) : undefined;

  if (!response.ok) {
    if (response.status === 401 && resolvedAuth?.refresh && !retry) {
      logTiming(response.status, false, "auth_refresh");
      try {
        const refreshed = await resolvedAuth.refresh();
        resolvedAuth.token = refreshed;
        return request({
          path,
          method,
          auth: resolvedAuth,
          body,
          schema,
          headers,
          retry: true,
          allowEmptyResponse,
          timeoutProfile,
          traceId,
        });
      } catch (refreshError) {
        console.warn("[webhooks] token refresh failed:", refreshError);
      }
    }
    logTiming(response.status, false);
    const parsedError = parsed ? errorResponseSchema.safeParse(parsed) : null;
    const message =
      parsedError?.success && parsedError.data.error
        ? parsedError.data.error
        : `Request failed with status ${response.status}`;
    const details = parsedError?.success ? parsedError.data.details : (parsed ?? undefined);
    throw new WebhooksApiError(message, response.status, details);
  }

  if (parsed === undefined) {
    if (allowEmptyResponse) {
      logTiming(response.status, true, "empty");
      return schema.parse(undefined);
    }
    logTiming(response.status, false, "empty");
    throw new WebhooksApiError("Empty response from API", response.status);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    logTiming(response.status, false, "schema_mismatch");
    console.error("[webhooks] response schema mismatch", {
      path,
      method,
      status: response.status,
      issues: result.error.issues,
    });
    throw result.error;
  }
  logTiming(response.status, true);
  return result.data;
}

function safeParseJson(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

function normalizeAuth(auth?: AuthInput): WebhooksAuth | null {
  if (!auth) {
    return null;
  }
  if (typeof auth === "string") {
    return { token: auth };
  }
  return auth;
}

function buildDashboardTraceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function exchangeWebhooksToken(
  supabaseAccessToken: string,
  subjectAccountId?: string | null,
): Promise<{
  token: string;
  expiresAt: string;
  entitlements: z.infer<typeof entitlementsSchema>;
  actorAccountId: string;
  subjectAccountId: string;
}> {
  return request({
    path: "/auth/token",
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
    },
    body: subjectAccountId ? { subjectAccountId } : undefined,
    schema: authResponseSchema,
    timeoutProfile: "auth",
  });
}

export async function fetchDashboardBootstrap(
  supabaseAccessToken: string,
  payload?: { subjectAccountId?: string | null; includeAgencyCustomers?: boolean },
): Promise<DashboardBootstrapResponse> {
  const body =
    payload && (payload.subjectAccountId || payload.includeAgencyCustomers)
      ? {
          subjectAccountId: payload.subjectAccountId ?? undefined,
          includeAgencyCustomers: payload.includeAgencyCustomers ?? undefined,
        }
      : undefined;
  return request({
    path: "/dashboard/bootstrap",
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
    },
    body,
    schema: dashboardBootstrapResponseSchema,
    timeoutProfile: "bootstrap",
  });
}

export async function fetchAccountMe(auth: AuthInput): Promise<AccountMe> {
  return request({
    path: "/accounts/me",
    auth,
    schema: accountMeSchema,
    timeoutProfile: "detail",
  });
}

export async function listAgencyCustomers(auth: AuthInput): Promise<AgencyCustomersResponse> {
  return request({
    path: "/agency/customers",
    auth,
    schema: listAgencyCustomersResponseSchema,
    timeoutProfile: "list",
  });
}

export async function createAgencyCustomer(
  auth: AuthInput,
  payload: { email: string; customerPlan: "starter" | "pro" },
): Promise<CreateAgencyCustomerResponse> {
  return request({
    path: "/agency/customers",
    method: "POST",
    auth,
    body: payload,
    schema: createAgencyCustomerResponseSchema,
    timeoutProfile: "mutation",
  });
}

export async function listSupportedLanguages(): Promise<SupportedLanguage[]> {
  try {
    const data = await request({
      path: "/meta/languages",
      schema: supportedLanguagesResponseSchema,
      timeoutProfile: "metadata",
    });
    return data.languages;
  } catch (error) {
    console.warn("[webhooks] listSupportedLanguages failed; using fallback list:", error);
    return [...FALLBACK_SUPPORTED_LANGUAGES];
  }
}

export async function listSites(auth: AuthInput): Promise<SiteSummary[]> {
  const data = await request({
    path: "/sites",
    auth,
    schema: listSitesResponseSchema,
    timeoutProfile: "list",
  });

  return data.sites;
}

export async function fetchSite(auth: AuthInput, siteId: string): Promise<Site> {
  return request({
    path: `/sites/${siteId}`,
    auth,
    schema: siteSchema,
    timeoutProfile: "detail",
  });
}

export async function fetchSiteDashboard(
  auth: AuthInput,
  siteId: string,
  options?: { includePages?: boolean; limit?: number; offset?: number },
): Promise<SiteDashboardResponse> {
  const qs = new URLSearchParams();
  if (typeof options?.includePages === "boolean") {
    qs.set("includePages", String(options.includePages));
  }
  if (typeof options?.limit === "number") {
    qs.set("limit", String(options.limit));
  }
  if (typeof options?.offset === "number") {
    qs.set("offset", String(options.offset));
  }
  const path = qs.size
    ? `/sites/${siteId}/dashboard?${qs.toString()}`
    : `/sites/${siteId}/dashboard`;
  return request({
    path,
    auth,
    schema: siteDashboardResponseSchema,
    timeoutProfile: "detail",
  });
}

export type CreateSitePayload = {
  sourceUrl: string;
  sourceLang: string;
  targetLangs: string[];
  subdomainPattern: string;
  localeAliases?: Record<string, string | null>;
  siteProfile?: Record<string, unknown> | null;
  maxLocales: number | null;
  servingMode: "strict" | "tolerant";
  crawlCaptureMode?: CrawlCaptureMode;
  clientRuntimeEnabled?: boolean;
  translatableAttributes?: string[] | null;
  spaRefresh?: SpaRefreshSettings | null;
};

export async function createSite(auth: AuthInput, payload: CreateSitePayload) {
  return request({
    path: "/sites",
    method: "POST",
    auth,
    body: payload,
    schema: siteWithCrawlStatusSchema,
  });
}

export async function updateSite(
  auth: AuthInput,
  siteId: string,
  payload: Partial<Omit<CreateSitePayload, "targetLangs">> & {
    targetLangs?: string[];
    status?: "active" | "inactive";
  },
) {
  return request({
    path: `/sites/${siteId}`,
    method: "PATCH",
    auth,
    body: payload,
    schema: siteSchema,
  });
}

export async function deactivateSite(auth: AuthInput, siteId: string) {
  return updateSite(auth, siteId, { status: "inactive" });
}

export async function triggerCrawl(
  auth: AuthInput,
  siteId: string,
  options?: { intent?: "translate_and_serve"; force?: boolean },
) {
  const searchParams = new URLSearchParams();
  if (options?.intent) {
    searchParams.set("intent", options.intent);
  }
  return request({
    path: `/sites/${siteId}/crawl${searchParams.toString() ? `?${searchParams}` : ""}`,
    method: "POST",
    auth,
    body: options?.force ? { force: true } : undefined,
    schema: crawlStatusSchema,
  });
}

export async function triggerCrawlTranslate(
  auth: AuthInput,
  siteId: string,
  payload: {
    targetLangs: string[];
    pageIds?: string[];
    sourcePaths?: string[];
    force?: boolean;
  },
): Promise<CrawlTranslateResponse> {
  return request({
    path: `/sites/${siteId}/crawl-translate`,
    method: "POST",
    auth,
    body: payload,
    schema: crawlTranslateResponseSchema,
  });
}

export async function translateSite(
  auth: AuthInput,
  siteId: string,
  targetLang: string,
  options?: { intent?: "translate_and_serve" },
) {
  return request({
    path: `/sites/${siteId}/translate`,
    method: "POST",
    auth,
    body: { targetLang, ...(options?.intent ? { intent: options.intent } : {}) },
    schema: translateSiteResponseSchema,
  });
}

export async function setLocaleServing(
  auth: AuthInput,
  siteId: string,
  targetLang: string,
  enabled: boolean,
) {
  return request({
    path: `/sites/${siteId}/locales/${encodeURIComponent(targetLang)}/serve`,
    method: "POST",
    auth,
    body: { enabled },
    schema: setLocaleServingResponseSchema,
  });
}

export async function upsertDigestSubscription(
  auth: AuthInput,
  payload: { email: string; frequency: DigestFrequency },
): Promise<DigestSubscription> {
  const data = await request({
    path: "/digests/subscription",
    method: "PUT",
    auth,
    body: payload,
    schema: upsertDigestSubscriptionResponseSchema,
  });
  return data.subscription;
}

export async function setTranslationSummaryPreference(
  auth: AuthInput,
  siteId: string,
  targetLang: string,
  frequency: TranslationSummaryFrequency,
): Promise<TranslationSummaryPreference> {
  const data = await request({
    path: `/sites/${siteId}/locales/${encodeURIComponent(targetLang)}/translation-summary`,
    method: "PUT",
    auth,
    body: { frequency },
    schema: setTranslationSummaryPreferenceResponseSchema,
  });
  return data.preference;
}

export async function listTranslationSummaries(
  auth: AuthInput,
  siteId: string,
): Promise<TranslationSummary[]> {
  const data = await request({
    path: `/sites/${siteId}/translation-summaries`,
    auth,
    schema: listTranslationSummariesResponseSchema,
    timeoutProfile: "detail",
  });
  return data.summaries;
}

export async function fetchSwitcherSnippets(
  auth: AuthInput,
  siteId: string,
  options?: { path?: string; currentLang?: string },
): Promise<LanguageSwitcherSnippetsResponse> {
  const searchParams = new URLSearchParams();
  if (options?.path) {
    searchParams.set("path", options.path);
  }
  if (options?.currentLang) {
    searchParams.set("currentLang", options.currentLang);
  }
  const path = searchParams.size
    ? `/sites/${siteId}/switcher-snippets?${searchParams.toString()}`
    : `/sites/${siteId}/switcher-snippets`;
  return request({
    path,
    auth,
    schema: languageSwitcherSnippetsResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function fetchTranslationRun(auth: AuthInput, siteId: string, runId: string) {
  const data = await request({
    path: `/sites/${siteId}/translation-runs/${runId}`,
    auth,
    schema: translationRunResponseSchema,
    timeoutProfile: "detail",
  });
  return data.run;
}

export async function cancelTranslationRun(auth: AuthInput, siteId: string, runId: string) {
  const data = await request({
    path: `/sites/${siteId}/translation-runs/${runId}/cancel`,
    method: "POST",
    auth,
    schema: translationRunResponseSchema,
  });
  return data.run;
}

export async function resumeTranslationRun(auth: AuthInput, siteId: string, runId: string) {
  const data = await request({
    path: `/sites/${siteId}/translation-runs/${runId}/resume`,
    method: "POST",
    auth,
    schema: resumeTranslationRunResponseSchema,
  });
  return data;
}

export async function triggerPageCrawl(auth: AuthInput, siteId: string, pageId: string) {
  return request({
    path: `/sites/${siteId}/pages/${pageId}/crawl`,
    method: "POST",
    auth,
    schema: crawlStatusSchema,
  });
}

export async function verifyDomain(
  auth: AuthInput,
  siteId: string,
  domain: string,
  overrideToken?: string,
) {
  return request({
    path: `/sites/${siteId}/domains/${encodeURIComponent(domain)}/verify`,
    method: "POST",
    auth,
    body: overrideToken ? { token: overrideToken } : {},
    schema: domainResponseSchema,
  });
}

export async function provisionDomain(auth: AuthInput, siteId: string, domain: string) {
  return request({
    path: `/sites/${siteId}/domains/${encodeURIComponent(domain)}/provision`,
    method: "POST",
    auth,
    schema: domainResponseSchema,
  });
}

export async function refreshDomain(auth: AuthInput, siteId: string, domain: string) {
  return request({
    path: `/sites/${siteId}/domains/${encodeURIComponent(domain)}/refresh`,
    method: "POST",
    auth,
    schema: domainResponseSchema,
  });
}

export async function fetchDeployments(auth: AuthInput, siteId: string): Promise<Deployment[]> {
  const data = await request({
    path: `/sites/${siteId}/deployments`,
    auth,
    schema: listDeploymentsResponseSchema,
    timeoutProfile: "detail",
  });

  return data.deployments;
}

export async function fetchDeploymentHistory(
  auth: AuthInput,
  siteId: string,
  options?: { targetLang?: string; limit?: number },
): Promise<DeploymentHistoryResponse> {
  const searchParams = new URLSearchParams();
  if (options?.targetLang) {
    searchParams.set("targetLang", options.targetLang);
  }
  if (typeof options?.limit === "number") {
    searchParams.set("limit", String(options.limit));
  }
  const path = searchParams.size
    ? `/sites/${siteId}/deployments/history?${searchParams.toString()}`
    : `/sites/${siteId}/deployments/history`;
  return request({
    path,
    auth,
    schema: listDeploymentHistoryResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function fetchSitePages(
  auth: AuthInput,
  siteId: string,
  options?: { limit?: number; offset?: number },
): Promise<SitePagesResponse> {
  const qs = new URLSearchParams();

  if (typeof options?.limit === "number") {
    qs.set("limit", String(options.limit));
  }
  if (typeof options?.offset === "number") {
    qs.set("offset", String(options.offset));
  }

  const path = qs.size ? `/sites/${siteId}/pages?${qs.toString()}` : `/sites/${siteId}/pages`;
  const data = await request({
    path,
    auth,
    schema: listSitePagesResponseSchema,
    timeoutProfile: "detail",
  });

  return data;
}

export async function fetchGlossary(auth: AuthInput, siteId: string): Promise<GlossaryEntry[]> {
  const data = await request({
    path: `/sites/${siteId}/glossary`,
    auth,
    schema: glossaryResponseSchema,
    timeoutProfile: "detail",
  });

  return data.entries;
}

export async function updateGlossary(
  auth: AuthInput,
  siteId: string,
  entries: GlossaryEntry[],
  retranslate?: boolean,
) {
  return request({
    path: `/sites/${siteId}/glossary`,
    method: "PUT",
    auth,
    body: { entries, retranslate },
    schema: upsertGlossaryResponseSchema,
  });
}

export async function createOverride(
  auth: AuthInput,
  siteId: string,
  payload: { segmentId: string; targetLang: string; text: string; contextHashScope: string | null },
) {
  return request({
    path: `/sites/${siteId}/overrides`,
    method: "POST",
    auth,
    body: payload,
    schema: createOverrideResponseSchema,
  });
}

export async function updateSlug(
  auth: AuthInput,
  siteId: string,
  payload: { pageId: string; lang: string; path: string },
) {
  return request({
    path: `/sites/${siteId}/slugs`,
    method: "POST",
    auth,
    body: payload,
    schema: setSlugResponseSchema,
  });
}
