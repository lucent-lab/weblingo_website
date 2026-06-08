import { cookies } from "next/headers";
import { z } from "zod";

import {
  SUPPORTED_LANGUAGES_STATIC,
  WEBHOOK_EVENT_TYPES,
  type KnownWebhookEventType,
  type NotifyWebhookEventType,
  type SupportedLanguage,
} from "@internal/dashboard/webhook-contracts";
import { WebhooksApiError } from "@internal/dashboard/webhooks-error";
import {
  normalizeValidationMarker,
  QA_MARKER_COOKIE_NAME,
  QA_MARKER_HEADER_NAME,
} from "@internal/analytics/validation-marker";
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
export { SUPPORTED_LANGUAGES_STATIC, WEBHOOK_EVENT_TYPES };
export { WebhooksApiError };
export type { KnownWebhookEventType, NotifyWebhookEventType, SupportedLanguage };

const DASHBOARD_E2E_MOCK_SITE_ID = "site-smoke-1";
const DASHBOARD_E2E_MOCK_ACCOUNT_ID = "acct-e2e-smoke";
const DASHBOARD_E2E_MOCK_SOURCE_URL = "https://source.example.test";

type RequestTimeoutProfile = keyof typeof REQUEST_TIMEOUT_MS;

const errorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getBodyRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

const planTypeSchema = z.enum(["free", "starter", "pro", "agency"]);
const managedAccountPlanSchema = z.enum(["free", "starter", "pro"]);
const planStatusSchema = z.enum(["active", "past_due", "cancelled"]);
const siteStatusValueSchema = z.enum(["active", "inactive"]);

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

const webhookEventTypeSchema = z.enum(WEBHOOK_EVENT_TYPES);

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

const sourceSelectionRuleActionSchema = z.enum(["include", "exclude", "canonical_source"]);

const sourceSelectionRuleSchema = z
  .object({
    action: sourceSelectionRuleActionSchema,
    pattern: z.string(),
    canonicalSourcePattern: z.string().optional(),
  })
  .strict();

const sourceSelectionConfigSchema = z
  .object({
    rules: z.array(sourceSelectionRuleSchema),
  })
  .strict();

const runtimeRequestPolicyActionSchema = z.enum(["observe", "deny", "neutralize", "proxy"]);
const runtimeRequestPolicyMethodSchema = z.enum([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);
const runtimeRequestPolicyCredentialsSchema = z.enum(["omit", "same_origin", "include"]);
const runtimeRequestPolicyCacheSchema = z.enum(["no-store", "edge"]);
const runtimeRequestPolicyRedirectScopeSchema = z.enum(["same_origin", "same_registrable_domain"]);
const runtimeRequestPolicyNeutralizationShapeSchema = z.enum([
  "empty_json",
  "empty_text",
  "no_content",
]);
const runtimeRequestPolicyConfirmationSchema = z.enum([
  "non_get_proxy",
  "credential_forwarding",
  "high_risk_path",
]);
const runtimeRequestHeaderPolicySchema = z
  .object({
    allow: z.array(z.string()),
  })
  .strict();
const runtimeRequestNeutralizationSchema = z
  .object({
    shape: runtimeRequestPolicyNeutralizationShapeSchema,
    status: z.number().int().min(100).max(599),
    contentType: z.string().nullable(),
    body: z.string().nullable(),
  })
  .strict();
const runtimeRequestPolicyRuleSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    pattern: z.string(),
    methods: z.array(runtimeRequestPolicyMethodSchema),
    action: runtimeRequestPolicyActionSchema,
    credentials: runtimeRequestPolicyCredentialsSchema,
    cache: runtimeRequestPolicyCacheSchema,
    maxBodyBytes: z.number().int().nonnegative(),
    maxResponseBytes: z.number().int().nonnegative(),
    timeoutMs: z.number().int().positive(),
    redirectScope: runtimeRequestPolicyRedirectScopeSchema,
    requestHeaders: runtimeRequestHeaderPolicySchema,
    responseHeaders: runtimeRequestHeaderPolicySchema,
    requestContentTypes: z.array(z.string()),
    responseContentTypes: z.array(z.string()),
    neutralization: runtimeRequestNeutralizationSchema,
    confirmations: z.array(runtimeRequestPolicyConfirmationSchema),
  })
  .strict();
const runtimeRequestPolicyConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    mode: z.literal("standard"),
    enabled: z.boolean(),
    rules: z.array(runtimeRequestPolicyRuleSchema),
  })
  .strict();
const runtimeRequestPolicyPropagationSchema = z
  .object({
    servedVersion: z.string().nullable(),
    expectedVersion: z.string().nullable(),
    stale: z.boolean(),
  })
  .strict();

const localizedPathTemplateSchema = z
  .object({
    targetLang: z.string(),
    sourcePattern: z.string(),
    targetPattern: z.string(),
  })
  .strict();

const previewCspModeSchema = z.enum([
  "strict",
  "compat",
  "origin-derived",
  "origin-derived-compat",
]);
const proxyCspOverrideModeSchema = z.enum([
  "off",
  "compat",
  "origin-derived",
  "origin-derived-compat",
]);

const footerSettingsSchema = z
  .object({
    enabled: z.boolean(),
    copyId: z.string().optional(),
    themeId: z.string().optional(),
  })
  .strict();

const languageSwitcherSettingsSchema = z
  .object({
    enabled: z.boolean(),
    mode: z.string().optional(),
    templateId: z.string().optional(),
    placement: z.string().optional(),
    label: z.string().optional(),
  })
  .strict();

const routeConfigSchema = z
  .object({
    updatedAt: z.string().optional(),
    sourceSelectionFingerprint: z.string().optional(),
    runtimeRequestPolicyFingerprint: z.string().optional(),
    runtimeRequestPolicyVersion: z.string().optional(),
    runtimeRequestPolicyPropagation: runtimeRequestPolicyPropagationSchema.optional(),
    sourceLang: z.string(),
    sourceOrigin: z.string(),
    pattern: z.string().nullable().optional(),
    locales: z.array(routeLocaleSchema),
    urlMode: z.enum(["original", "translated"]).optional(),
    clientRuntimeEnabled: z.boolean(),
    crawlCaptureMode: crawlCaptureModeSchema,
    maxDepth: z.number().int().nonnegative().optional(),
    previewCspMode: previewCspModeSchema.optional(),
    proxyCspOverrideMode: proxyCspOverrideModeSchema.optional(),
    translatableAttributes: z.array(z.string()).nullable().optional(),
    spaRefresh: spaRefreshSchema.nullable().optional(),
    footer: footerSettingsSchema.nullable().optional(),
    languageSwitcher: languageSwitcherSettingsSchema.nullable().optional(),
    localizedPathTemplates: z.array(localizedPathTemplateSchema).nullable().optional(),
    sourceSelection: sourceSelectionConfigSchema.optional(),
    runtimeRequestPolicy: runtimeRequestPolicyConfigSchema.optional(),
  })
  .nullable();

const siteProfileSchema = z.record(z.string(), z.unknown()).nullable();

const siteSummarySchema = z
  .object({
    id: z.string(),
    accountId: z.string(),
    sourceUrl: z.string(),
    status: siteStatusValueSchema,
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
  status: siteStatusValueSchema,
  managedDemo: z.boolean().optional(),
  servingMode: z.enum(["strict", "tolerant"]),
  maxLocales: z.number().int().positive().nullable(),
  siteProfile: siteProfileSchema,
  webhookUrl: z.string().nullable().optional(),
  webhookSecret: z.string().nullable().optional(),
  webhookEvents: z.array(webhookEventTypeSchema),
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
  customerServingStatus: z
    .lazy(() => deploymentServingStatusSchema)
    .nullable()
    .optional(),
  showcaseServingStatus: z
    .lazy(() => deploymentServingStatusSchema)
    .nullable()
    .optional(),
  showcase: z
    .lazy(() => siteShowcaseSchema)
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

const customerCrawlStatusValueSchema = z.enum([
  "not_started",
  "queued",
  "in_progress",
  "completed",
  "failed",
  "unknown",
]);

const sitePagesSummarySchema = z
  .object({
    lastCrawlStartedAt: z.string().nullable().optional(),
    lastCrawlFinishedAt: z.string().nullable().optional(),
    pagesUpdated: z.number().int().nonnegative(),
    pagesPending: z.number().int().nonnegative(),
    nextEligibleCrawlAt: z.string().nullable().optional(),
    eligiblePageCount: z.number().int().nonnegative().nullable().optional(),
    rawLatestCrawlStatus: z.string().nullable().optional(),
    customerCrawlStatus: customerCrawlStatusValueSchema.optional(),
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
    servingStatus: z.enum(["inactive", "disabled", "needs_domain", "ready", "serving", "degraded"]),
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

const deploymentServingStatusSchema = z.enum([
  "inactive",
  "disabled",
  "needs_domain",
  "ready",
  "serving",
  "degraded",
]);

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
  servingStatus: deploymentServingStatusSchema,
  translationRun: translationRunSchema.nullable().optional(),
  completeness: deploymentCompletenessSchema,
});

const listDeploymentsResponseSchema = z.object({ deployments: z.array(deploymentSchema) });

const dashboardProjectionViewSchema = z.enum([
  "overview",
  "languages",
  "domains",
  "settings",
  "developer_tools",
  "source_selection",
  "quality",
]);

const customerScalarParamSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const customerParamsSchema = z.record(z.string(), customerScalarParamSchema);
const customerSeveritySchema = z.enum(["success", "info", "warning", "danger"]);
const customerErrorSeveritySchema = z.enum(["info", "warning", "danger"]);
const customerErrorAreaSchema = z.enum([
  "account",
  "domain",
  "crawl",
  "translation",
  "deployment",
  "publish",
  "serving",
  "runtime",
  "quota",
  "unknown",
]);
const customerNextActionKindSchema = z.enum([
  "none",
  "fix_billing",
  "create_site",
  "activate_site",
  "add_language",
  "configure_domain",
  "verify_domain",
  "refresh_domain_status",
  "start_crawl",
  "wait_for_crawl",
  "retry_crawl",
  "review_source_selection",
  "translate_and_publish",
  "wait_for_translation",
  "retry_translation",
  "enable_serving",
  "review_serving_issue",
  "review_quota",
  "view_live_site",
  "contact_support",
]);
const customerServingStatusValueSchema = z.enum([
  "not_configured",
  "needs_domain",
  "ready",
  "live",
  "degraded",
  "disabled",
  "inactive",
  "blocked",
  "unknown",
]);
const customerDomainStatusValueSchema = z.enum([
  "not_configured",
  "needs_dns",
  "pending",
  "verifying",
  "verified",
  "failed",
  "unknown",
]);
const customerActivityStatusSchema = z.enum([
  "queued",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
  "blocked",
  "unknown",
]);
const customerTranslationStatusSchema = z.enum([
  "queued",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
  "unknown",
]);
const customerDeploymentStatusSchema = z.enum([
  "publishing",
  "published",
  "failed",
  "replaced",
  "unknown",
]);
const offsetPaginationSchema = z
  .object({
    limit: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    total: z.number().int().nonnegative().optional(),
    nextOffset: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();
const customerCtaRefSchema = z
  .object({
    labelKey: z.string(),
    href: z.string().optional(),
    actionId: z.string().optional(),
    method: z.enum(["link", "server_action"]).optional(),
    requiresConfirmation: z.boolean().optional(),
    disabled: z.boolean().optional(),
    disabledReasonCode: z.string().nullable().optional(),
    params: customerParamsSchema.optional(),
  })
  .strict();
const customerSiteRefSchema = z
  .object({
    id: z.string(),
    sourceUrl: z.string(),
    sourceLang: z.string(),
    status: siteStatusValueSchema,
    profile: z.string().nullable().optional(),
    servingMode: z.string().nullable().optional(),
  })
  .strict();
const customerAccessSummarySchema = z
  .object({
    mutationsAllowed: z.boolean(),
    lockedReasonCode: z.string().nullable().optional(),
    features: z.record(z.string(), z.boolean()),
  })
  .strict();
const customerNextActionSchema = z
  .object({
    kind: customerNextActionKindSchema,
    priority: z.number(),
    severity: z.enum(["none", "info", "warning", "danger"]),
    titleKey: z.string(),
    descriptionKey: z.string().optional(),
    params: customerParamsSchema.optional(),
    cta: customerCtaRefSchema.nullable().optional(),
    blockedBy: z.array(z.string()).optional(),
  })
  .strict();
const customerBlockerSchema = z
  .object({
    code: z.string(),
    area: z.enum([
      "account",
      "site",
      "domain",
      "serving",
      "crawl",
      "translation",
      "deployment",
      "publish",
      "quota",
      "runtime",
      "unknown",
    ]),
    severity: customerSeveritySchema,
    titleKey: z.string(),
    descriptionKey: z.string().optional(),
    params: customerParamsSchema.optional(),
    affectedLangs: z.array(z.string()).optional(),
    affectedDomains: z.array(z.string()).optional(),
    cta: customerCtaRefSchema.nullable().optional(),
  })
  .strict();
const customerErrorSummaryItemSchema = z
  .object({
    id: z.string(),
    area: customerErrorAreaSchema,
    severity: customerErrorSeveritySchema,
    code: z.string(),
    titleKey: z.string(),
    descriptionKey: z.string().optional(),
    params: customerParamsSchema.optional(),
    firstSeenAt: z.string().nullable().optional(),
    lastSeenAt: z.string().nullable().optional(),
    affectedLangs: z.array(z.string()).optional(),
    affectedPaths: z.array(z.string()).optional(),
    affectedDomains: z.array(z.string()).optional(),
    cta: customerCtaRefSchema.nullable().optional(),
  })
  .strict();
const customerServingStatusSchema = z
  .object({
    value: customerServingStatusValueSchema,
    rawStatus: z.string().nullable().optional(),
    titleKey: z.string(),
    descriptionKey: z.string().optional(),
    lastChangedAt: z.string().nullable().optional(),
    cta: customerCtaRefSchema.nullable().optional(),
  })
  .strict();
const customerDomainSummarySchema = z
  .object({
    domain: z.string(),
    targetLang: z.string().nullable().optional(),
    status: customerDomainStatusValueSchema,
    rawStatus: z.string().nullable().optional(),
    lastCheckedAt: z.string().nullable().optional(),
    requiredDns: z
      .array(
        z
          .object({
            type: z.string(),
            name: z.string(),
            value: z.string(),
          })
          .strict(),
      )
      .optional(),
    servingStatus: customerServingStatusSchema.optional(),
    cta: customerCtaRefSchema.nullable().optional(),
  })
  .strict();
const customerLanguageIndexingStatusSchema = z
  .object({
    mode: z.enum(["noindex", "indexable"]),
    effectiveMode: z.enum(["noindex", "indexable"]),
    optedIn: z.boolean(),
    canIndex: z.boolean(),
    blockers: z.array(z.string()),
  })
  .strict();
const customerLanguageStatusSchema = z
  .object({
    tag: z.string(),
    labelKey: z.string().optional(),
    enabled: z.boolean(),
    serveEnabled: z.boolean(),
    indexing: customerLanguageIndexingStatusSchema,
    servingStatus: customerServingStatusSchema,
    domain: z.string().nullable().optional(),
    domainStatus: customerDomainStatusValueSchema.nullable().optional(),
    routePrefix: z.string().nullable().optional(),
    alias: z.string().nullable().optional(),
    lastPublishedAt: z.string().nullable().optional(),
    lastTranslatedAt: z.string().nullable().optional(),
    canServe: z.boolean().optional(),
    lockedReasonCode: z.string().nullable().optional(),
  })
  .strict();
const customerPagesSummarySchema = z
  .object({
    totalKnownPages: z.number().int().nonnegative().nullable().optional(),
    includedPages: z.number().int().nonnegative().nullable().optional(),
    excludedPages: z.number().int().nonnegative().nullable().optional(),
    translatedPages: z.number().int().nonnegative().nullable().optional(),
    pagesUpdated: z.number().int().nonnegative().nullable().optional(),
    pendingPages: z.number().int().nonnegative().nullable().optional(),
    pagesPending: z.number().int().nonnegative().nullable().optional(),
    failedPages: z.number().int().nonnegative().nullable().optional(),
    lastCrawlStartedAt: z.string().nullable().optional(),
    lastCrawlFinishedAt: z.string().nullable().optional(),
    nextEligibleCrawlAt: z.string().nullable().optional(),
    eligiblePageCount: z.number().int().nonnegative().nullable().optional(),
    inventoryMayBeIncomplete: z.boolean().optional(),
    rawLatestCrawlStatus: z.string().nullable().optional(),
    customerCrawlStatus: customerCrawlStatusValueSchema.optional(),
  })
  .strict();
const customerActivitySchema = z
  .object({
    id: z.string(),
    type: z.string(),
    customerStatus: customerActivityStatusSchema,
    rawStatus: z.string().nullable().optional(),
    titleKey: z.string(),
    descriptionKey: z.string().optional(),
    targetLang: z.string().nullable().optional(),
    sourcePath: z.string().nullable().optional(),
    startedAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
    finishedAt: z.string().nullable().optional(),
    progress: z
      .object({
        completed: z.number().int().nonnegative().optional(),
        total: z.number().int().nonnegative().optional(),
        failed: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    cta: customerCtaRefSchema.nullable().optional(),
  })
  .strict();
const customerQuotaSnapshotSchema = z
  .object({
    key: z.string(),
    labelKey: z.string(),
    used: z.number().int().nonnegative().nullable().optional(),
    limit: z.number().int().nonnegative().nullable().optional(),
    remaining: z.number().int().nonnegative().nullable().optional(),
    resetsAt: z.string().nullable().optional(),
    status: z.enum(["ok", "near_limit", "reached", "unknown"]),
    cta: customerCtaRefSchema.nullable().optional(),
  })
  .strict();
const customerErrorSummaryResponseSchema = z
  .object({
    errors: z.array(customerErrorSummaryItemSchema),
    pagination: offsetPaginationSchema,
    generatedAt: z.string(),
  })
  .strict();
const customerTranslationRunSummarySchema = z
  .object({
    id: z.string(),
    targetLang: z.string(),
    rawStatus: z.string(),
    customerStatus: z.enum([
      "queued",
      "in_progress",
      "completed",
      "failed",
      "cancelled",
      "unknown",
    ]),
    progress: z
      .object({
        completed: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
      })
      .strict(),
    startedAt: z.string().nullable().optional(),
    finishedAt: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
    customerError: customerErrorSummaryItemSchema.nullable().optional(),
  })
  .strict();
const customerTranslationRunsResponseSchema = z
  .object({
    runs: z.array(customerTranslationRunSummarySchema),
    pagination: offsetPaginationSchema,
    generatedAt: z.string(),
  })
  .strict();
const dashboardProjectionMetaSchema = <TView extends z.infer<typeof dashboardProjectionViewSchema>>(
  view: TView,
) =>
  z
    .object({
      view: z.literal(view),
      generatedAt: z.string(),
      schemaVersion: z.literal(1),
    })
    .strict();
const siteCustomerOverviewResponseSchema = z
  .object({
    meta: dashboardProjectionMetaSchema("overview"),
    site: customerSiteRefSchema,
    account: z
      .object({
        accountId: z.string(),
        planType: z.string(),
        planStatus: z.string(),
        mutationsAllowed: z.boolean(),
      })
      .strict(),
    health: z
      .object({
        status: z.enum([
          "healthy",
          "needs_setup",
          "in_progress",
          "degraded",
          "blocked",
          "inactive",
          "unknown",
        ]),
        titleKey: z.string(),
        descriptionKey: z.string().optional(),
        params: customerParamsSchema.optional(),
        lastImportantChangeAt: z.string().nullable().optional(),
      })
      .strict(),
    nextAction: customerNextActionSchema,
    blockers: z.array(customerBlockerSchema),
    languages: z.array(customerLanguageStatusSchema),
    domains: z.array(customerDomainSummarySchema),
    pagesSummary: customerPagesSummarySchema,
    currentActivity: z.array(customerActivitySchema),
    errors: z.array(customerErrorSummaryItemSchema),
    quotas: z.array(customerQuotaSnapshotSchema),
  })
  .strict();
const siteLanguagesProjectionResponseSchema = z
  .object({
    meta: dashboardProjectionMetaSchema("languages"),
    site: customerSiteRefSchema,
    access: customerAccessSummarySchema.extend({
      canAddLanguage: z.boolean(),
      canRemoveLanguage: z.boolean(),
      canUpdateLanguageAliases: z.boolean(),
      canToggleServing: z.boolean(),
    }),
    sourceLanguage: z
      .object({
        tag: z.string(),
        labelKey: z.string().optional(),
        direction: z.string().optional(),
      })
      .strict(),
    targetLanguages: z.array(customerLanguageStatusSchema.extend({ canRemove: z.boolean() })),
    localeQuota: z
      .object({
        used: z.number().int().nonnegative(),
        limit: z.number().int().nonnegative().nullable().optional(),
        remaining: z.number().int().nonnegative().nullable().optional(),
      })
      .strict(),
  })
  .strict();
const siteDomainsProjectionResponseSchema = z
  .object({
    meta: dashboardProjectionMetaSchema("domains"),
    site: customerSiteRefSchema,
    access: customerAccessSummarySchema.extend({
      canVerifyDomain: z.boolean(),
      canRefreshDomain: z.boolean(),
      canProvisionDomain: z.boolean(),
      canUpdateRouting: z.boolean(),
      canToggleServing: z.boolean(),
    }),
    routing: z
      .object({
        urlMode: z.string().nullable().optional(),
        servingMode: z.string().nullable().optional(),
        routePrefixes: z.array(z.object({ targetLang: z.string(), prefix: z.string() }).strict()),
      })
      .strict(),
    languages: z.array(customerLanguageStatusSchema),
    domains: z.array(customerDomainSummarySchema),
  })
  .strict();
const siteSettingsProjectionResponseSchema = z
  .object({
    meta: dashboardProjectionMetaSchema("settings"),
    site: customerSiteRefSchema.extend({
      createdAt: z.string().nullable().optional(),
      updatedAt: z.string().nullable().optional(),
    }),
    access: customerAccessSummarySchema.extend({
      canEditBasic: z.boolean(),
      canChangeSourceUrl: z.boolean(),
      canEditLocales: z.boolean(),
      canEditRouting: z.boolean(),
      canEditRuntime: z.boolean(),
      canEditWebhooks: z.boolean(),
      canDeactivateSite: z.boolean(),
      canDeleteSite: z.boolean(),
    }),
    basic: z
      .object({
        sourceUrl: z.string(),
        profile: z.string().nullable().optional(),
        servingMode: z.string().nullable().optional(),
      })
      .strict(),
    routing: z
      .object({
        urlMode: z.string().nullable().optional(),
        routePrefixes: z.array(z.object({ targetLang: z.string(), prefix: z.string() }).strict()),
        localizedPathTemplates: z
          .array(z.object({ targetLang: z.string(), pattern: z.string() }).strict())
          .optional(),
      })
      .strict(),
    crawl: z
      .object({
        captureMode: z.string().nullable().optional(),
        maxDepth: z.number().int().nonnegative().nullable().optional(),
        crawlMaxPages: z.number().int().nonnegative().nullable().optional(),
      })
      .strict(),
    runtime: z
      .object({
        clientRuntimeEnabled: z.boolean().optional(),
        spaRefreshEnabled: z.boolean().optional(),
        translatableAttributes: z.array(z.string()).optional(),
        footerRequired: z.boolean().nullable().optional(),
        cspMode: z.string().nullable().optional(),
      })
      .strict(),
    webhooks: z
      .object({
        url: z.string().nullable().optional(),
        events: z.array(z.string()),
        hasSecret: z.boolean(),
      })
      .strict(),
    settings: z
      .object({
        sourceLang: z.string(),
        targetLangs: z.array(z.string()),
        aliases: z.record(z.string(), z.string().nullable()),
        pattern: z.string().nullable().optional(),
        maxLocales: z.number().int().positive().nullable(),
        servingMode: z.enum(["strict", "tolerant"]),
        crawlCaptureMode: crawlCaptureModeSchema,
        clientRuntimeEnabled: z.boolean(),
        spaRefresh: spaRefreshSchema.nullable().optional(),
        translatableAttributes: z.array(z.string()).nullable().optional(),
        webhookUrl: z.string().nullable().optional(),
        webhookEvents: z.array(webhookEventTypeSchema),
        siteProfile: z
          .object({
            brandVoice: z.string().optional(),
            description: z.string().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    notifications: z
      .object({
        digestFrequency: z.string().optional(),
        translationSummaryFrequencyByLocale: z.record(z.string(), z.string()).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const siteDeveloperToolsProjectionResponseSchema = z
  .object({
    meta: dashboardProjectionMetaSchema("developer_tools"),
    site: customerSiteRefSchema,
    access: customerAccessSummarySchema.extend({
      canEditRuntime: z.boolean(),
      canEditWebhooks: z.boolean(),
      canViewRuntimeRequests: z.boolean(),
    }),
    runtime: z
      .object({
        clientRuntimeEnabled: z.boolean().optional(),
        switcherEnabled: z.boolean().optional(),
        spaRefreshEnabled: z.boolean().optional(),
        translatableAttributes: z.array(z.string()).optional(),
      })
      .strict(),
    webhooks: z
      .object({
        url: z.string().nullable().optional(),
        events: z.array(z.string()),
        hasSecret: z.boolean(),
      })
      .strict(),
    snippets: z.object({ available: z.boolean(), fetchHref: z.string().optional() }).strict(),
    runtimeRequests: z
      .object({
        available: z.boolean(),
        policy: runtimeRequestPolicyConfigSchema.nullable().optional(),
        policySummary: z
          .object({
            rulesCount: z.number().int().nonnegative(),
            fingerprint: z.string().nullable().optional(),
            version: z.string().nullable().optional(),
            lastUpdatedAt: z.string().nullable().optional(),
          })
          .strict()
          .optional(),
        propagation: runtimeRequestPolicyPropagationSchema.nullable().optional(),
        summary: z
          .object({
            openCount: z.number().int().nonnegative().nullable().optional(),
            reviewedCount: z.number().int().nonnegative().nullable().optional(),
            dismissedCount: z.number().int().nonnegative().nullable().optional(),
            ignoredCount: z.number().int().nonnegative().nullable().optional(),
            lastSeenAt: z.string().nullable().optional(),
          })
          .strict()
          .optional(),
        pageHref: z.string().optional(),
        observationsHref: z.string().optional(),
        policyPreviewHref: z.string().optional(),
      })
      .strict(),
  })
  .strict();
const siteSourceSelectionProjectionResponseSchema = z
  .object({
    meta: dashboardProjectionMetaSchema("source_selection"),
    site: customerSiteRefSchema,
    access: customerAccessSummarySchema.extend({
      canEditSourceSelection: z.boolean(),
      canPreviewSourceSelection: z.boolean(),
    }),
    policy: z
      .object({
        fingerprint: z.string().nullable().optional(),
        updatedAt: z.string().nullable().optional(),
        rules: z.array(
          z
            .object({
              id: z.string().optional(),
              kind: z.string(),
              pattern: z.string(),
              target: z.string().nullable().optional(),
            })
            .strict(),
        ),
        ruleLimit: z.number().int().nonnegative().nullable().optional(),
        warnings: z
          .array(
            z
              .object({
                code: z.string(),
                severity: customerErrorSeveritySchema,
                messageKey: z.string(),
                params: customerParamsSchema.optional(),
              })
              .strict(),
          )
          .optional(),
      })
      .strict(),
    inventorySummary: z
      .object({
        knownPageCount: z.number().int().nonnegative().nullable().optional(),
        includedPageCount: z.number().int().nonnegative().nullable().optional(),
        excludedPageCount: z.number().int().nonnegative().nullable().optional(),
        inventoryMayBeIncomplete: z.boolean().optional(),
      })
      .strict(),
    preconditions: z
      .object({
        expectedRouteConfigUpdatedAt: z.string().nullable().optional(),
        expectedSourceSelectionFingerprint: z.string().nullable().optional(),
      })
      .strict(),
  })
  .strict();
const siteQualityProjectionResponseSchema = z
  .object({
    meta: dashboardProjectionMetaSchema("quality"),
    site: customerSiteRefSchema,
    access: customerAccessSummarySchema.extend({
      canUseGlossary: z.boolean(),
      canUseOverrides: z.boolean(),
      canEditSlugs: z.boolean(),
      canUseConsistencyGovernance: z.boolean(),
    }),
    glossarySummary: z
      .object({
        entriesCount: z.number().int().nonnegative(),
        sourceLimit: z.number().int().nonnegative().nullable().optional(),
        remainingSources: z.number().int().nonnegative().nullable().optional(),
      })
      .strict()
      .optional(),
    overrideSummary: z
      .object({ entriesCount: z.number().int().nonnegative().optional() })
      .strict()
      .optional(),
    slugSummary: z
      .object({
        localizedSlugCount: z.number().int().nonnegative().optional(),
        conflicts: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const siteDashboardProjectionResponseSchema = z.union([
  siteCustomerOverviewResponseSchema,
  siteLanguagesProjectionResponseSchema,
  siteDomainsProjectionResponseSchema,
  siteSettingsProjectionResponseSchema,
  siteDeveloperToolsProjectionResponseSchema,
  siteSourceSelectionProjectionResponseSchema,
  siteQualityProjectionResponseSchema,
]);
const siteCompactStatusResponseSchema = z
  .object({
    siteId: z.string(),
    siteStatus: siteStatusValueSchema,
    latestCrawlRun: z
      .object({
        id: z.string(),
        rawStatus: z.string(),
        customerStatus: customerCrawlStatusValueSchema,
        startedAt: z.string().nullable().optional(),
        finishedAt: z.string().nullable().optional(),
        updatedAt: z.string().nullable().optional(),
        pagesUpdated: z.number().int().nonnegative().optional(),
        pagesPending: z.number().int().nonnegative().optional(),
        customerError: customerErrorSummaryItemSchema.nullable().optional(),
      })
      .strict()
      .nullable()
      .optional(),
    activeTranslationRuns: z
      .array(
        z
          .object({
            id: z.string(),
            targetLang: z.string(),
            rawStatus: z.string(),
            customerStatus: customerTranslationStatusSchema,
            updatedAt: z.string().nullable().optional(),
            progress: z
              .object({
                completed: z.number().int().nonnegative().optional(),
                total: z.number().int().nonnegative().optional(),
                failed: z.number().int().nonnegative().optional(),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .optional(),
    currentActivity: z.array(customerActivitySchema).optional(),
    generatedAt: z.string(),
  })
  .strict();
const customerDeploymentHistoryEntrySchema = z
  .object({
    eventId: z.string().optional(),
    rawStatus: z.string(),
    customerStatus: customerDeploymentStatusSchema,
    titleKey: z.string(),
    descriptionKey: z.string().optional(),
    params: customerParamsSchema.optional(),
    createdAt: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
    pageCount: z.number().int().nonnegative().nullable().optional(),
    customerError: customerErrorSummaryItemSchema.nullable().optional(),
  })
  .strict();
const customerDeploymentHistoryResponseSchema = z
  .object({
    targetLang: z.string(),
    entries: z.array(customerDeploymentHistoryEntrySchema),
    pagination: offsetPaginationSchema,
    generatedAt: z.string(),
  })
  .strict();
const deploymentHistoryRouteResponseSchema = customerDeploymentHistoryResponseSchema;

const glossaryEntrySchema = z.object({
  source: z.string(),
  target: z.string(),
  targetLangs: z.array(z.string()).optional(),
  matchType: z.string().optional(),
  caseSensitive: z.boolean().optional(),
  scope: z.enum(["segment", "in_segment"]).optional(),
});

const glossaryRetranslateLocaleStatusSchema = z
  .object({
    targetLang: z.string(),
    status: z.enum(["started", "noop", "skipped"]),
    enqueued: z.number().int().nonnegative().nullable().optional(),
    impactedSegmentCount: z.number().int().nonnegative(),
    impactedPageCount: z.number().int().nonnegative(),
    reason: z
      .enum(["no_glossary_change", "no_impacted_segments", "no_latest_page_versions", "active_run"])
      .optional(),
    runId: z.string().nullable().optional(),
  })
  .strict();

const glossaryRetranslateStatusSchema = z
  .object({
    mode: z.literal("targeted"),
    locales: z.array(glossaryRetranslateLocaleStatusSchema),
  })
  .strict();

const glossaryResponseSchema = z
  .object({
    entries: z.array(glossaryEntrySchema),
    crawlStatus: crawlStatusSchema.nullable().optional(),
    retranslateStatus: glossaryRetranslateStatusSchema.nullable().optional(),
  })
  .strict();

const consistencyStatusSchema = z.enum(["proposed", "approved", "frozen"]);
const consistencyBlockModeSchema = z.enum(["strict", "prefer"]);

const consistencyCpmEntrySchema = z
  .object({
    id: z.string(),
    contentId: z.string(),
    sourceLang: z.string(),
    targetLang: z.string(),
    targetText: z.string(),
    scope: z.string(),
    status: consistencyStatusSchema,
    occurrencesCount: z.number().int().nonnegative(),
    lastUsedAt: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .strict();

const consistencyCpmListResponseSchema = z
  .object({
    siteId: z.string(),
    sourceLang: z.string(),
    targetLang: z.string(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    statusFilter: z.array(consistencyStatusSchema),
    entries: z.array(consistencyCpmEntrySchema),
  })
  .strict();

const consistencyCpmUpsertResponseSchema = z
  .object({
    siteId: z.string(),
    sourceLang: z.string(),
    targetLang: z.string(),
    upserted: z.array(consistencyCpmEntrySchema),
  })
  .strict();

const consistencyBlockMemberSchema = z
  .object({
    id: z.string(),
    contentId: z.string(),
    position: z.number().int().nonnegative(),
  })
  .strict();

const consistencyBlockSchema = z
  .object({
    id: z.string(),
    blockType: z.string(),
    blockSignature: z.string(),
    familySignature: z.string().nullable().optional(),
    mode: consistencyBlockModeSchema,
    status: consistencyStatusSchema,
    occurrencesCount: z.number().int().nonnegative(),
    firstSeenAt: z.string().nullable().optional(),
    lastSeenAt: z.string().nullable().optional(),
    members: z.array(consistencyBlockMemberSchema),
  })
  .strict();

const consistencyBlocksListResponseSchema = z
  .object({
    siteId: z.string(),
    statusFilter: z.array(consistencyStatusSchema),
    blocks: z.array(consistencyBlockSchema),
  })
  .strict();

const consistencyBlockUpdateResponseSchema = z
  .object({
    siteId: z.string(),
    block: consistencyBlockSchema,
  })
  .strict();

const consistencyOverrideHygieneWarningSchema = z
  .object({
    segmentId: z.string(),
    contentId: z.string(),
    sourceText: z.string(),
    overrideText: z.string(),
    canonicalTargetText: z.string(),
    canonicalStatus: z.enum(["approved", "frozen"]),
    canonicalScope: z.string(),
    contextHashScope: z.string(),
    reason: z.literal("context_override_global_exact_conflict"),
  })
  .strict();

const consistencyOverrideHygieneResponseSchema = z
  .object({
    siteId: z.string(),
    sourceLang: z.string(),
    targetLang: z.string(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    hasMore: z.boolean(),
    scopedOverrideCount: z.number().int().nonnegative(),
    totalWarnings: z.number().int().nonnegative(),
    warnings: z.array(consistencyOverrideHygieneWarningSchema),
  })
  .strict();

const authResponseSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string(),
  entitlements: entitlementsSchema,
  actorAccountId: z.string().min(1),
  subjectAccountId: z.string().min(1),
});

const listSitePagesResponseSchema = z
  .object({
    site: z
      .object({
        id: z.string(),
        sourceUrl: z.string(),
        status: z.enum(["active", "inactive"]),
      })
      .strict(),
    status: siteCompactStatusResponseSchema,
    pagesSummary: sitePagesSummarySchema,
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

const siteDashboardRouteResponseSchema = siteDashboardProjectionResponseSchema;

const sourceSelectionPreviewReasonSchema = z.enum([
  "included_by_default",
  "included_by_rule",
  "excluded_by_rule",
  "canonicalized_by_rule",
  "not_included_by_rule",
]);

const sourceSelectionPreviewEffectiveStateSchema = z.enum([
  "included",
  "excluded",
  "canonicalized",
]);

const sourceSelectionPreviewRuleScopeSchema = z.enum(["direct", "inherited"]);

const sourceSelectionPreviewRuleMatchSchema = z
  .object({
    action: sourceSelectionRuleActionSchema,
    pattern: z.string(),
    canonicalSourcePattern: z.string().optional(),
  })
  .strict();

const sourceSelectionPreviewPageSchema = z
  .object({
    sourcePath: z.string(),
    selected: z.boolean(),
    reason: sourceSelectionPreviewReasonSchema,
    effectiveState: sourceSelectionPreviewEffectiveStateSchema,
    previousSelected: z.boolean(),
    previousReason: sourceSelectionPreviewReasonSchema,
    changed: z.boolean(),
    matchedPattern: z.string().optional(),
    matchedAction: sourceSelectionRuleActionSchema.optional(),
    ruleScope: sourceSelectionPreviewRuleScopeSchema.optional(),
    directRule: sourceSelectionPreviewRuleMatchSchema.nullable().optional(),
    inheritedRule: sourceSelectionPreviewRuleMatchSchema.nullable().optional(),
    canonicalSourcePath: z.string().optional(),
  })
  .strict();

const sourceSelectionPreviewSummarySchema = z
  .object({
    knownPagesTotal: z.number().nonnegative(),
    knownPagesIncluded: z.number().nonnegative(),
    knownPagesExcluded: z.number().nonnegative(),
    includedByDefault: z.number().nonnegative(),
    includedByRule: z.number().nonnegative(),
    excludedByRule: z.number().nonnegative(),
    notIncludedByRule: z.number().nonnegative(),
    canonicalizedByRule: z.number().nonnegative(),
    rulesTotal: z.number().nonnegative(),
  })
  .strict();

const sourceSelectionPreviewWarningCodeSchema = z.enum([
  "include_rules_create_allowlist",
  "selected_to_excluded_pages",
  "selection_excludes_majority",
]);

const sourceSelectionPreviewWarningSchema = z
  .object({
    code: sourceSelectionPreviewWarningCodeSchema,
    message: z.string(),
    count: z.number().nonnegative().optional(),
    sourcePaths: z.array(z.string()).optional(),
  })
  .strict();

const sourceSelectionPreviewImpactSchema = z
  .object({
    scope: z.literal("known_pages"),
    changedKnownPages: z.number().nonnegative(),
    selectedToExcluded: z
      .object({
        count: z.number().nonnegative(),
        sourcePaths: z.array(z.string()),
      })
      .strict(),
    activeSiteRerun: z
      .object({
        required: z.boolean(),
        basis: z.literal("site_status_and_config_change"),
        activeDeploymentCount: z.number().nonnegative(),
        deploymentImpact: z.enum(["not_estimated", "none", "has_active_deployments"]),
        message: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const sourceSelectionPreviewResponseSchema = z
  .object({
    sourceSelection: sourceSelectionConfigSchema,
    summary: sourceSelectionPreviewSummarySchema,
    affectedPages: z.array(sourceSelectionPreviewPageSchema),
    pagination: listSitePagesResponseSchema.shape.pagination,
    warnings: z.array(sourceSelectionPreviewWarningSchema),
    impact: sourceSelectionPreviewImpactSchema,
  })
  .strict();

const sourceSelectionTreePreviewEffectiveStateSchema =
  sourceSelectionPreviewEffectiveStateSchema.or(z.literal("mixed"));

const sourceSelectionTreePreviewNodeSchema = z
  .object({
    id: z.string(),
    kind: z.enum(["folder", "page"]),
    sourcePath: z.string(),
    depth: z.number().int().nonnegative(),
    hasChildren: z.boolean(),
    selected: z.boolean().nullable(),
    reason: sourceSelectionPreviewReasonSchema.optional(),
    effectiveState: sourceSelectionTreePreviewEffectiveStateSchema,
    previousSelected: z.boolean().nullable().optional(),
    previousReason: sourceSelectionPreviewReasonSchema.optional(),
    changed: z.boolean(),
    knownPagesTotal: z.number().nonnegative(),
    knownPagesIncluded: z.number().nonnegative(),
    knownPagesExcluded: z.number().nonnegative(),
    changedKnownPages: z.number().nonnegative(),
    matchedPattern: z.string().optional(),
    matchedAction: sourceSelectionRuleActionSchema.optional(),
    ruleScope: sourceSelectionPreviewRuleScopeSchema.optional(),
    directRule: sourceSelectionPreviewRuleMatchSchema.nullable().optional(),
    inheritedRule: sourceSelectionPreviewRuleMatchSchema.nullable().optional(),
    descendantRule: sourceSelectionPreviewRuleMatchSchema.nullable().optional(),
    canonicalSourcePath: z.string().optional(),
  })
  .strict();

const sourceSelectionTreePreviewInventorySchema = z
  .object({
    knownPagesTotal: z.number().nonnegative(),
    resultNodesTotal: z.number().nonnegative(),
    resultMode: z.enum(["children", "search"]),
    summaryScope: z.literal("global_known_pages"),
    resultScope: z.literal("filtered_tree_nodes"),
    parentPath: z.string().optional(),
    search: z.string().optional(),
    maxPageSize: z.number().int().positive(),
    complete: z.boolean(),
  })
  .strict();

const sourceSelectionTreePreviewResponseSchema = z
  .object({
    sourceSelection: sourceSelectionConfigSchema,
    summary: sourceSelectionPreviewSummarySchema,
    nodes: z.array(sourceSelectionTreePreviewNodeSchema),
    pagination: z
      .object({
        limit: z.number().int().positive(),
        cursor: z.string().optional(),
        nextCursor: z.string().optional(),
        total: z.number().nonnegative(),
        hasMore: z.boolean(),
      })
      .strict(),
    warnings: z.array(sourceSelectionPreviewWarningSchema),
    impact: sourceSelectionPreviewImpactSchema,
    inventory: sourceSelectionTreePreviewInventorySchema,
  })
  .strict();

const runtimeRequestAcceptClassSchema = z.enum([
  "html",
  "json",
  "rsc",
  "asset",
  "event-stream",
  "other",
  "missing",
]);
const runtimeRequestIntentSchema = z.enum([
  "navigation",
  "fetch",
  "route-data",
  "asset",
  "preflight",
  "beacon",
  "form",
  "unknown",
]);
const runtimeRequestClassificationSchema = z.enum([
  "malformed",
  "static_asset",
  "showcase_telemetry",
  "html_navigation",
  "dynamic_api",
  "route_data",
  "api_like_json",
  "high_risk_dynamic",
  "preflight",
  "default_dynamic",
]);
const runtimeRequestRiskSchema = z.enum(["low", "medium", "high"]);
const runtimeRequestLifecycleSchema = z.enum(["open", "reviewed", "dismissed", "ignored"]);
const runtimeRequestBodySizeBucketSchema = z.enum([
  "none",
  "unknown",
  "1-1kb",
  "1kb-10kb",
  "10kb-100kb",
  "100kb-1mb",
  "over-1mb",
]);
const runtimeRequestPolicySourceSchema = z.enum([
  "explicit_rule",
  "standard_default",
  "policy_disabled",
]);
const runtimeRequestDiagnosticCodeSchema = z.enum([
  "runtime_request_observed",
  "runtime_request_denied",
  "runtime_request_neutralized",
  "runtime_request_proxy_allowed",
  "runtime_request_policy_disabled",
]);
const runtimeRequestPolicyEvaluationSchema = z
  .object({
    policyVersion: z.string(),
    method: runtimeRequestPolicyMethodSchema.or(z.literal("OTHER")),
    host: z.string(),
    normalizedPath: z.string(),
    groupingPath: z.string(),
    groupingPathHash: z.string(),
    hasQuery: z.boolean(),
    bodySizeBucket: runtimeRequestBodySizeBucketSchema,
    bodyPresent: z.boolean(),
    acceptClass: runtimeRequestAcceptClassSchema,
    intent: runtimeRequestIntentSchema,
    classification: runtimeRequestClassificationSchema,
    canonicalizationIssue: z
      .enum(["malformed_url", "encoded_slash", "dot_segments", "invalid_encoding"])
      .nullable(),
    risk: runtimeRequestRiskSchema,
    riskReasons: z.array(z.string()),
    action: runtimeRequestPolicyActionSchema,
    source: runtimeRequestPolicySourceSchema,
    ruleId: z.string().nullable(),
    shouldFetchSourceOrigin: z.boolean(),
    shouldStoreObservation: z.boolean(),
    status: z.number().int(),
    diagnosticCode: runtimeRequestDiagnosticCodeSchema,
  })
  .strict();
const runtimeRequestObservationGroupSchema = z
  .object({
    siteId: z.string(),
    groupingPathHash: z.string(),
    shapeSignature: z.string(),
    path: z.string(),
    method: z.string(),
    likelyType: runtimeRequestClassificationSchema,
    intent: runtimeRequestIntentSchema,
    acceptClass: runtimeRequestAcceptClassSchema,
    risk: runtimeRequestRiskSchema,
    riskReasons: z.array(z.string()),
    firstSeenAt: z.string(),
    lastSeenAt: z.string(),
    count: z.number().int().nonnegative(),
    seenFromPage: z.string().nullable(),
    currentAction: runtimeRequestPolicyActionSchema,
    suggestedAction: runtimeRequestPolicyActionSchema,
    policyRuleId: z.string().nullable(),
    routePolicyVersion: z.string().nullable(),
    routePolicyStale: z.boolean(),
    lifecycle: runtimeRequestLifecycleSchema,
    reviewedAt: z.string().nullable(),
    dismissedAt: z.string().nullable(),
    ignoredAt: z.string().nullable(),
    bodyPresent: z.boolean(),
    bodySizeBucket: runtimeRequestBodySizeBucketSchema,
  })
  .strict();
const runtimeRequestObservationGroupsResponseSchema = z
  .object({
    groups: z.array(runtimeRequestObservationGroupSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();
const runtimeRequestObservationLifecycleResponseSchema = z
  .object({
    state: z
      .object({
        siteId: z.string(),
        groupingPathHash: z.string(),
        method: z.string(),
        shapeSignature: z.string(),
        reviewedAt: z.string().nullable(),
        dismissedAt: z.string().nullable(),
        ignoredAt: z.string().nullable(),
        updatedAt: z.string(),
      })
      .strict(),
  })
  .strict();
const runtimeRequestPolicyPreviewResponseSchema = z
  .object({
    runtimeRequestPolicy: runtimeRequestPolicyConfigSchema,
    validationErrors: z.array(
      z.object({ code: z.string(), ruleId: z.string(), message: z.string() }).strict(),
    ),
    warnings: z.array(
      z.object({ code: z.string(), ruleId: z.string(), message: z.string() }).strict(),
    ),
    collisions: z.array(
      z.object({ leftRuleId: z.string(), rightRuleId: z.string(), code: z.string() }).strict(),
    ),
    highRiskConfirmations: z.array(z.object({ ruleId: z.string(), code: z.string() }).strict()),
    sampleResults: z.array(
      z
        .object({
          index: z.number().int().nonnegative(),
          result: runtimeRequestPolicyEvaluationSchema,
        })
        .strict(),
    ),
    matchedObservationGroups: z.array(runtimeRequestObservationGroupSchema),
    propagation: z
      .object({
        currentRouteConfigUpdatedAt: z.string().nullable(),
        currentRuntimeRequestPolicyVersion: z.string().nullable(),
      })
      .strict(),
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

const usageCountersSchema = z
  .object({
    periodStart: z.string(),
    periodEnd: z.string(),
    pagesPublished: z.number().int().nonnegative(),
    charsTranslated: z.number().int().nonnegative(),
    rebuildsTriggered: z.number().int().nonnegative(),
    dailySiteCrawls: z.number().int().nonnegative(),
    dailyPageCrawls: z.number().int().nonnegative(),
  })
  .strict();

const quotaLimitsSchema = z
  .object({
    maxSites: z.number().int().nonnegative().nullable(),
    translationChars: z.number().int().nonnegative().nullable(),
    dailySiteCrawls: z.number().int().nonnegative().nullable(),
    dailyPageCrawls: z.number().int().nonnegative().nullable(),
    previewRequests: z.number().int().nonnegative().nullable(),
  })
  .strict();

const quotasSchema = z
  .object({
    maxSites: z.number().int().nonnegative().nullable(),
    freeQuota: z.number().int().nonnegative().nullable(),
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
    usageCounters: usageCountersSchema,
    quotaLimits: quotaLimitsSchema,
    quotas: quotasSchema,
  })
  .strict();

const agencyCustomerPlanSchema = managedAccountPlanSchema;
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

const updateAgencyCustomerResponseSchema = z
  .object({
    customer: agencyCustomerSchema,
  })
  .strict();

const managedAccountQuotaOverridesSchema = quotasSchema;

const managedAccountFeatureFlagOverridesSchema = featureFlagsSchema.partial();

const managedAccountAgencyLinkSchema = z
  .object({
    agencyAccountId: z.string(),
    customerPlan: agencyCustomerPlanSchema,
    status: agencyCustomerStatusSchema,
    createdAt: z.string().nullable().optional(),
  })
  .strict();

const managedAccountPolicySchema = z
  .object({
    accountId: z.string(),
    planType: managedAccountPlanSchema,
    planStatus: planStatusSchema,
    managedDemo: z.boolean(),
    createdAt: z.string().nullable().optional(),
    accountEmail: z.string().nullable().optional(),
    activeSiteCount: z.number().int().nonnegative(),
    quotas: managedAccountQuotaOverridesSchema,
    featureFlags: managedAccountFeatureFlagOverridesSchema,
    agencyLinks: z.array(managedAccountAgencyLinkSchema),
  })
  .strict();

const listAdminAccountsResponseSchema = z
  .object({
    items: z.array(managedAccountPolicySchema),
    pagination: z
      .object({
        limit: z.number().int().positive(),
        offset: z.number().int().nonnegative(),
        hasMore: z.boolean(),
      })
      .strict(),
  })
  .strict();

const getAdminAccountResponseSchema = z
  .object({
    account: managedAccountPolicySchema,
  })
  .strict();

const updateAdminAccountResponseSchema = z
  .object({
    account: managedAccountPolicySchema,
  })
  .strict();

const managedDemoShowcaseStatusSchema = z.enum(["active", "disabled"]);

const siteShowcaseSchema = z
  .object({
    websitePath: z.string(),
    defaultLang: z.string().nullable(),
    status: managedDemoShowcaseStatusSchema,
    url: z.string().nullable(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .strict();

const siteShowcaseResponseSchema = z
  .object({
    siteId: z.string(),
    customerServingStatus: deploymentServingStatusSchema,
    showcaseServingStatus: deploymentServingStatusSchema,
    showcase: siteShowcaseSchema,
  })
  .strict();

const managedDemoDeploymentSummarySchema = z
  .object({
    targetLang: z.string(),
    deploymentId: z.string().nullable(),
    status: z.string().nullable(),
    activatedAt: z.string().nullable().optional(),
    activeDeploymentId: z.string().nullable(),
    activeDeploymentRowId: z.string().nullable(),
    activeDeploymentStatus: z.string().nullable(),
    activeActivatedAt: z.string().nullable().optional(),
  })
  .strict();

const managedDemoShowcaseLocaleSummarySchema = z
  .object({
    targetLang: z.string(),
    serveEnabled: z.boolean(),
    isDefault: z.boolean(),
    customerServingStatus: deploymentServingStatusSchema,
    showcaseServingStatus: deploymentServingStatusSchema,
    url: z.string(),
  })
  .strict();

const managedDemoSiteSummarySchema = z
  .object({
    accountId: z.string(),
    accountPlan: managedAccountPlanSchema,
    siteId: z.string(),
    sourceUrl: z.string(),
    siteStatus: z.enum(["active", "inactive"]),
    customerServingStatus: deploymentServingStatusSchema,
    showcaseServingStatus: deploymentServingStatusSchema,
    showcase: siteShowcaseSchema,
    showcaseLocales: z.array(managedDemoShowcaseLocaleSummarySchema),
    deployment: managedDemoDeploymentSummarySchema.nullable(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .strict();

const listManagedDemoSitesResponseSchema = z
  .object({
    items: z.array(managedDemoSiteSummarySchema),
  })
  .strict();

const createManagedDemoSiteResponseSchema = z
  .object({
    accountId: z.string(),
    site: siteWithCrawlStatusSchema,
    showcase: siteShowcaseSchema,
  })
  .strict();

const rerunManagedDemoSiteCrawlResponseSchema = z
  .object({
    siteId: z.string(),
    sourceUrl: z.string(),
    adminInitiated: z.literal(true),
    usageCounted: z.literal(false),
    force: z.boolean(),
    targetLangs: z.array(z.string()),
    crawlStatus: crawlStatusSchema,
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

const prospectDemoConversionResponseSchema = z
  .object({
    prospectShowcaseRef: z.string(),
    status: z.enum(["checkout_pending", "activation_pending", "payment_failed", "converted"]),
    activationStatus: z.enum(["activation_pending", "payment_failed", "active"]),
    locked: z.boolean(),
    lockedReason: z.string(),
    accountId: z.string(),
    siteId: z.string(),
    nextAction: z.string(),
    inviteLink: z.string().optional(),
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
    retranslateStatus: glossaryRetranslateStatusSchema.nullable().optional(),
  })
  .strict();

export type Site = z.infer<typeof siteSchema>;
export type SiteSummary = z.infer<typeof siteSummarySchema>;
export type Domain = z.infer<typeof domainSchema>;
export type RouteConfig = z.infer<typeof routeConfigSchema>;
export type CrawlCaptureMode = z.infer<typeof crawlCaptureModeSchema>;
export type SpaRefreshSettings = z.infer<typeof spaRefreshSchema>;
export type SpaRefreshFallback = z.infer<typeof spaRefreshFallbackSchema>;
export type SourceSelectionRuleAction = z.infer<typeof sourceSelectionRuleActionSchema>;
export type SourceSelectionRule = z.infer<typeof sourceSelectionRuleSchema>;
export type SourceSelectionConfig = z.infer<typeof sourceSelectionConfigSchema>;
export type SourceSelectionPreviewReason = z.infer<typeof sourceSelectionPreviewReasonSchema>;
export type SourceSelectionPreviewPage = z.infer<typeof sourceSelectionPreviewPageSchema>;
export type SourceSelectionPreviewSummary = z.infer<typeof sourceSelectionPreviewSummarySchema>;
export type SourceSelectionPreviewWarning = z.infer<typeof sourceSelectionPreviewWarningSchema>;
export type SourceSelectionPreviewImpact = z.infer<typeof sourceSelectionPreviewImpactSchema>;
export type SourceSelectionPreviewResponse = z.infer<typeof sourceSelectionPreviewResponseSchema>;
export type SourceSelectionTreePreviewNode = z.infer<typeof sourceSelectionTreePreviewNodeSchema>;
export type SourceSelectionTreePreviewInventory = z.infer<
  typeof sourceSelectionTreePreviewInventorySchema
>;
export type SourceSelectionTreePreviewResponse = z.infer<
  typeof sourceSelectionTreePreviewResponseSchema
>;
export type RuntimeRequestPolicyAction = z.infer<typeof runtimeRequestPolicyActionSchema>;
export type RuntimeRequestPolicyMethod = z.infer<typeof runtimeRequestPolicyMethodSchema>;
export type RuntimeRequestPolicyCredentials = z.infer<typeof runtimeRequestPolicyCredentialsSchema>;
export type RuntimeRequestPolicyCache = z.infer<typeof runtimeRequestPolicyCacheSchema>;
export type RuntimeRequestPolicyRedirectScope = z.infer<
  typeof runtimeRequestPolicyRedirectScopeSchema
>;
export type RuntimeRequestPolicyNeutralizationShape = z.infer<
  typeof runtimeRequestPolicyNeutralizationShapeSchema
>;
export type RuntimeRequestPolicyConfirmation = z.infer<
  typeof runtimeRequestPolicyConfirmationSchema
>;
export type RuntimeRequestPolicyRule = z.infer<typeof runtimeRequestPolicyRuleSchema>;
export type RuntimeRequestPolicyConfig = z.infer<typeof runtimeRequestPolicyConfigSchema>;
export type RuntimeRequestPolicyPropagation = z.infer<typeof runtimeRequestPolicyPropagationSchema>;
export type RuntimeRequestObservationGroup = z.infer<typeof runtimeRequestObservationGroupSchema>;
export type RuntimeRequestObservationGroupsResponse = z.infer<
  typeof runtimeRequestObservationGroupsResponseSchema
>;
export type RuntimeRequestLifecycle = z.infer<typeof runtimeRequestLifecycleSchema>;
export type RuntimeRequestPolicyPreviewSample = {
  url: string;
  method?: string;
  accept?: string;
};
export type RuntimeRequestPolicyPreviewResponse = z.infer<
  typeof runtimeRequestPolicyPreviewResponseSchema
>;
export type CrawlStatus = z.infer<typeof crawlStatusSchema>;
export type Deployment = z.infer<typeof deploymentSchema>;
export type DeploymentCompleteness = z.infer<typeof deploymentCompletenessSchema>;
export type DashboardProjectionView = z.infer<typeof dashboardProjectionViewSchema>;
export type CustomerErrorSummaryItem = z.infer<typeof customerErrorSummaryItemSchema>;
export type CustomerErrorSummaryResponse = z.infer<typeof customerErrorSummaryResponseSchema>;
export type CustomerDeploymentHistoryEntry = z.infer<typeof customerDeploymentHistoryEntrySchema>;
export type CustomerDeploymentHistoryResponse = z.infer<
  typeof customerDeploymentHistoryResponseSchema
>;
export type DeploymentHistoryRouteResponse = z.infer<typeof deploymentHistoryRouteResponseSchema>;
export type TranslationRun = z.infer<typeof translationRunSchema>;
export type CustomerTranslationRunSummary = z.infer<typeof customerTranslationRunSummarySchema>;
export type CustomerTranslationRunsResponse = z.infer<typeof customerTranslationRunsResponseSchema>;
export type SitePageSummary = z.infer<typeof sitePageSummarySchema>;
export type SitePagesSummary = z.infer<typeof sitePagesSummarySchema>;
export type SitePagesPagination = z.infer<typeof listSitePagesResponseSchema.shape.pagination>;
export type SitePagesResponse = z.infer<typeof listSitePagesResponseSchema>;
export type SiteCustomerOverviewResponse = z.infer<typeof siteCustomerOverviewResponseSchema>;
export type SiteLanguagesProjectionResponse = z.infer<typeof siteLanguagesProjectionResponseSchema>;
export type SiteDomainsProjectionResponse = z.infer<typeof siteDomainsProjectionResponseSchema>;
export type SiteSettingsProjectionResponse = z.infer<typeof siteSettingsProjectionResponseSchema>;
export type SiteDeveloperToolsProjectionResponse = z.infer<
  typeof siteDeveloperToolsProjectionResponseSchema
>;
export type SiteSourceSelectionProjectionResponse = z.infer<
  typeof siteSourceSelectionProjectionResponseSchema
>;
export type SiteQualityProjectionResponse = z.infer<typeof siteQualityProjectionResponseSchema>;
export type SiteDashboardProjectionResponse = z.infer<typeof siteDashboardProjectionResponseSchema>;
export type SiteDashboardRouteResponse = z.infer<typeof siteDashboardRouteResponseSchema>;
export type SiteCompactStatusResponse = z.infer<typeof siteCompactStatusResponseSchema>;
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;
export type ConsistencyStatus = z.infer<typeof consistencyStatusSchema>;
export type ConsistencyBlockMode = z.infer<typeof consistencyBlockModeSchema>;
export type ConsistencyCpmEntry = z.infer<typeof consistencyCpmEntrySchema>;
export type ConsistencyCpmListResponse = z.infer<typeof consistencyCpmListResponseSchema>;
export type ConsistencyBlockMember = z.infer<typeof consistencyBlockMemberSchema>;
export type ConsistencyBlock = z.infer<typeof consistencyBlockSchema>;
export type ConsistencyBlocksListResponse = z.infer<typeof consistencyBlocksListResponseSchema>;
export type ConsistencyOverrideHygieneWarning = z.infer<
  typeof consistencyOverrideHygieneWarningSchema
>;
export type ConsistencyOverrideHygieneResponse = z.infer<
  typeof consistencyOverrideHygieneResponseSchema
>;
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
export type ManagedAccountPlan = z.infer<typeof managedAccountPlanSchema>;
export type AgencyCustomer = z.infer<typeof agencyCustomerSchema>;
export type AgencyCustomersSummary = z.infer<typeof agencyCustomersSummarySchema>;
export type AgencyCustomersResponse = z.infer<typeof listAgencyCustomersResponseSchema>;
export type CreateAgencyCustomerResponse = z.infer<typeof createAgencyCustomerResponseSchema>;
export type UpdateAgencyCustomerResponse = z.infer<typeof updateAgencyCustomerResponseSchema>;
export type ManagedAccountQuotaOverrides = z.infer<typeof managedAccountQuotaOverridesSchema>;
export type ManagedAccountFeatureFlagOverrides = z.infer<
  typeof managedAccountFeatureFlagOverridesSchema
>;
export type ManagedAccountAgencyLink = z.infer<typeof managedAccountAgencyLinkSchema>;
export type ManagedAccountPolicy = z.infer<typeof managedAccountPolicySchema>;
export type ListAdminAccountsResponse = z.infer<typeof listAdminAccountsResponseSchema>;
export type GetAdminAccountResponse = z.infer<typeof getAdminAccountResponseSchema>;
export type UpdateAdminAccountResponse = z.infer<typeof updateAdminAccountResponseSchema>;
export type DashboardBootstrapResponse = z.infer<typeof dashboardBootstrapResponseSchema>;
export type ProspectDemoConversionResponse = z.infer<typeof prospectDemoConversionResponseSchema>;
export type SiteShowcase = z.infer<typeof siteShowcaseSchema>;
export type SiteShowcaseResponse = z.infer<typeof siteShowcaseResponseSchema>;
export type ManagedDemoDeploymentSummary = z.infer<typeof managedDemoDeploymentSummarySchema>;
export type ManagedDemoSiteSummary = z.infer<typeof managedDemoSiteSummarySchema>;
export type ListManagedDemoSitesResponse = z.infer<typeof listManagedDemoSitesResponseSchema>;
export type CreateManagedDemoSiteResponse = z.infer<typeof createManagedDemoSiteResponseSchema>;
export type RerunManagedDemoSiteCrawlResponse = z.infer<
  typeof rerunManagedDemoSiteCrawlResponseSchema
>;

// Exported for cross-repo contract tests only (OpenAPI ↔ website zod schemas).
export const __webhooksZodContracts = {
  supportedLanguagesResponseSchema,
  authResponseSchema,
  dashboardBootstrapResponseSchema,
  accountMeSchema,
  listAgencyCustomersResponseSchema,
  createAgencyCustomerResponseSchema,
  updateAgencyCustomerResponseSchema,
  listAdminAccountsResponseSchema,
  getAdminAccountResponseSchema,
  updateAdminAccountResponseSchema,
  prospectDemoConversionResponseSchema,
  listManagedDemoSitesResponseSchema,
  createManagedDemoSiteResponseSchema,
  rerunManagedDemoSiteCrawlResponseSchema,
  siteShowcaseResponseSchema,
  listSitesResponseSchema,
  siteSummarySchema,
  siteSchema,
  siteWithCrawlStatusSchema,
  crawlStatusSchema,
  translateSiteResponseSchema,
  setLocaleServingResponseSchema,
  translationRunResponseSchema,
  customerTranslationRunsResponseSchema,
  resumeTranslationRunResponseSchema,
  domainResponseSchema,
  listDeploymentsResponseSchema,
  customerDeploymentHistoryResponseSchema,
  deploymentHistoryRouteResponseSchema,
  listSitePagesResponseSchema,
  siteDashboardRouteResponseSchema,
  siteCustomerOverviewResponseSchema,
  siteLanguagesProjectionResponseSchema,
  siteDomainsProjectionResponseSchema,
  siteSettingsProjectionResponseSchema,
  siteDeveloperToolsProjectionResponseSchema,
  siteSourceSelectionProjectionResponseSchema,
  siteQualityProjectionResponseSchema,
  siteCompactStatusResponseSchema,
  customerErrorSummaryResponseSchema,
  customerErrorSummaryItemSchema,
  sourceSelectionPreviewResponseSchema,
  sourceSelectionTreePreviewResponseSchema,
  runtimeRequestObservationGroupsResponseSchema,
  runtimeRequestObservationLifecycleResponseSchema,
  runtimeRequestPolicyPreviewResponseSchema,
  upsertDigestSubscriptionResponseSchema,
  crawlTranslateResponseSchema,
  setTranslationSummaryPreferenceResponseSchema,
  listTranslationSummariesResponseSchema,
  languageSwitcherSnippetsResponseSchema,
  consistencyCpmListResponseSchema,
  consistencyCpmUpsertResponseSchema,
  consistencyBlocksListResponseSchema,
  consistencyBlockUpdateResponseSchema,
  consistencyOverrideHygieneResponseSchema,
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

function createDashboardE2eMockRuntimeRequestPolicy(rules: RuntimeRequestPolicyRule[] = []) {
  return {
    schemaVersion: 1 as const,
    mode: "standard" as const,
    enabled: true,
    rules,
  };
}

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
    webhookEvents: ["translation.completed", "translation.failed", "translation.summary"],
    locales: [
      { sourceLang: "en", targetLang: "fr", alias: null, serveEnabled: true },
      { sourceLang: "en", targetLang: "ja", alias: null, serveEnabled: true },
    ],
    routeConfig: {
      updatedAt: now,
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
      runtimeRequestPolicyFingerprint: JSON.stringify({ schemaVersion: 1, rules: [] }),
      runtimeRequestPolicyVersion: `site-config:${now}`,
      runtimeRequestPolicyPropagation: {
        servedVersion: `site-config:${now}`,
        expectedVersion: `site-config:${now}`,
        stale: false,
      },
      runtimeRequestPolicy: createDashboardE2eMockRuntimeRequestPolicy(),
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

function createDashboardE2eMockCustomerDeploymentHistory(
  targetLang: string,
  limit: number,
  offset: number,
) {
  const now = Date.now();
  const allEntries = Array.from({ length: 4 }, (_, index) => {
    const createdAt = new Date(now - index * 3_600_000).toISOString();
    const customerStatus = index === 0 ? "published" : "replaced";
    return {
      rawStatus: index === 0 ? "active" : "superseded",
      customerStatus,
      titleKey: `dashboard.history.deployment.${customerStatus}.title`,
      descriptionKey: `dashboard.history.deployment.${customerStatus}.description`,
      createdAt,
      publishedAt: createdAt,
      pageCount: 30 - index,
      customerError: null,
    };
  });
  const entries = allEntries.slice(offset, offset + limit);
  return {
    targetLang,
    entries,
    pagination: {
      limit,
      offset,
      total: allEntries.length,
      nextOffset: offset + entries.length < allEntries.length ? offset + entries.length : null,
    },
    generatedAt: new Date(now).toISOString(),
  };
}

function createDashboardE2eMockCustomerTranslationRuns(
  targetLang: string | null,
  limit: number,
  offset: number,
) {
  const now = Date.now();
  const allRuns = ["fr", "ja"].flatMap((lang) =>
    Array.from({ length: 3 }, (_, index) => {
      const createdAt = new Date(
        now - index * 4_000_000 - (lang === "ja" ? 1_000_000 : 0),
      ).toISOString();
      const failed = index === 2;
      return {
        id: `tr-${lang}-${index + 1}`,
        targetLang: lang,
        rawStatus: failed ? "failed" : index === 0 ? "completed" : "in_progress",
        customerStatus: failed ? "failed" : index === 0 ? "completed" : "in_progress",
        progress: {
          completed: failed ? 12 : 30 - index * 3,
          total: 30,
          failed: failed ? 2 : 0,
        },
        startedAt: createdAt,
        finishedAt: index === 1 ? null : createdAt,
        createdAt,
        updatedAt: createdAt,
        customerError: failed
          ? {
              id: `translation_run_failed:tr-${lang}-${index + 1}`,
              area: "translation" as const,
              severity: "danger" as const,
              code: "translation_run_failed",
              titleKey: "dashboard.errors.translationRunFailed.title",
              lastSeenAt: createdAt,
            }
          : null,
      };
    }),
  );
  const filtered = targetLang ? allRuns.filter((run) => run.targetLang === targetLang) : allRuns;
  const runs = filtered.slice(offset, offset + limit);
  return {
    runs,
    pagination: {
      limit,
      offset,
      total: filtered.length,
      nextOffset: offset + runs.length < filtered.length ? offset + runs.length : null,
    },
    generatedAt: new Date(now).toISOString(),
  };
}

function createDashboardE2eMockProjectionSite(siteId: string) {
  return {
    id: siteId,
    sourceUrl: DASHBOARD_E2E_MOCK_SOURCE_URL,
    sourceLang: "en",
    status: "active",
    profile: null,
    servingMode: "strict",
  };
}

function createDashboardE2eMockProjectionAccess() {
  return {
    mutationsAllowed: true,
    lockedReasonCode: null,
    features: {
      edit: true,
      crawl_trigger: true,
      domain_verify: true,
      serve: true,
      glossary: true,
      overrides: true,
    },
  };
}

function createDashboardE2eMockProjectionServingStatus(
  value: z.infer<typeof customerServingStatusValueSchema> = "live",
) {
  return {
    value,
    rawStatus: value,
    titleKey: `dashboard.status.serving.${value}.title`,
    descriptionKey: `dashboard.status.serving.${value}.description`,
  };
}

function createDashboardE2eMockProjectionIndexingStatus(canIndex: boolean) {
  return {
    mode: canIndex ? ("indexable" as const) : ("noindex" as const),
    effectiveMode: canIndex ? ("indexable" as const) : ("noindex" as const),
    optedIn: canIndex,
    canIndex,
    blockers: canIndex ? [] : ["indexing_not_opted_in"],
  };
}

function createDashboardE2eMockProjectionLanguages() {
  return [
    {
      tag: "fr",
      labelKey: "languages.fr",
      enabled: true,
      serveEnabled: true,
      indexing: createDashboardE2eMockProjectionIndexingStatus(true),
      servingStatus: createDashboardE2eMockProjectionServingStatus("live"),
      domain: "fr.example.test",
      domainStatus: "verified" as const,
      routePrefix: "/fr",
      alias: null,
      lastPublishedAt: new Date().toISOString(),
      lastTranslatedAt: new Date().toISOString(),
      canServe: true,
      lockedReasonCode: null,
    },
    {
      tag: "ja",
      labelKey: "languages.ja",
      enabled: true,
      serveEnabled: true,
      indexing: createDashboardE2eMockProjectionIndexingStatus(false),
      servingStatus: createDashboardE2eMockProjectionServingStatus("needs_domain"),
      domain: "verify.example.test",
      domainStatus: "pending" as const,
      routePrefix: "/ja",
      alias: null,
      lastPublishedAt: null,
      lastTranslatedAt: new Date().toISOString(),
      canServe: false,
      lockedReasonCode: null,
    },
  ];
}

function createDashboardE2eMockProjectionDomains() {
  return [
    {
      domain: "fr.example.test",
      targetLang: "fr",
      status: "verified" as const,
      rawStatus: "verified",
      lastCheckedAt: new Date().toISOString(),
      servingStatus: createDashboardE2eMockProjectionServingStatus("live"),
      cta: null,
    },
    {
      domain: "verify.example.test",
      targetLang: "ja",
      status: "pending" as const,
      rawStatus: "pending",
      lastCheckedAt: new Date().toISOString(),
      requiredDns: [
        {
          type: "CNAME",
          name: "verify.example.test",
          value: "mock-site.t.weblingo.app",
        },
      ],
      servingStatus: createDashboardE2eMockProjectionServingStatus("needs_domain"),
      cta: {
        labelKey: "dashboard.cta.verifyDomain",
        actionId: "verify_domain",
        method: "server_action" as const,
        params: { domain: "verify.example.test" },
      },
    },
  ];
}

function createDashboardE2eMockCustomerDashboardProjection(
  siteId: string,
  view: DashboardProjectionView,
) {
  const now = new Date().toISOString();
  const site = createDashboardE2eMockProjectionSite(siteId);
  const access = createDashboardE2eMockProjectionAccess();
  const languages = createDashboardE2eMockProjectionLanguages();
  const domains = createDashboardE2eMockProjectionDomains();
  const meta = { view, generatedAt: now, schemaVersion: 1 as const };

  if (view === "overview") {
    return {
      meta,
      site,
      account: {
        accountId: DASHBOARD_E2E_MOCK_ACCOUNT_ID,
        planType: "pro",
        planStatus: "active",
        mutationsAllowed: true,
      },
      health: {
        status: "needs_setup" as const,
        titleKey: "dashboard.health.needsSetup.title",
        descriptionKey: "dashboard.health.needsSetup.description",
        lastImportantChangeAt: now,
      },
      nextAction: {
        kind: "verify_domain" as const,
        priority: 20,
        severity: "warning" as const,
        titleKey: "dashboard.nextAction.verifyDomain.title",
        descriptionKey: "dashboard.nextAction.verifyDomain.description",
        cta: {
          labelKey: "dashboard.cta.verifyDomain",
          actionId: "verify_domain",
          method: "server_action" as const,
          params: { domain: "verify.example.test" },
        },
        blockedBy: ["domain_not_verified"],
      },
      blockers: [
        {
          code: "domain_not_verified",
          area: "domain" as const,
          severity: "warning" as const,
          titleKey: "dashboard.blockers.domainNotVerified.title",
          affectedDomains: ["verify.example.test"],
        },
      ],
      languages,
      domains,
      pagesSummary: {
        totalKnownPages: 30,
        includedPages: 30,
        excludedPages: 0,
        translatedPages: 24,
        pagesUpdated: 18,
        pendingPages: 6,
        pagesPending: 5,
        failedPages: 0,
        lastCrawlStartedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
        lastCrawlFinishedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
        nextEligibleCrawlAt: now,
        eligiblePageCount: 5,
        inventoryMayBeIncomplete: false,
        rawLatestCrawlStatus: "completed",
        customerCrawlStatus: "completed" as const,
      },
      currentActivity: [],
      errors: [
        {
          id: "domain_not_verified:domain:0",
          area: "domain" as const,
          severity: "warning" as const,
          code: "domain_not_verified",
          titleKey: "dashboard.blockers.domainNotVerified.title",
          affectedDomains: ["verify.example.test"],
        },
      ],
      quotas: [
        {
          key: "locales",
          labelKey: "dashboard.quotas.locales",
          used: 2,
          limit: 5,
          remaining: 3,
          status: "ok" as const,
        },
      ],
    };
  }

  if (view === "languages") {
    return {
      meta,
      site,
      access: {
        ...access,
        canAddLanguage: true,
        canRemoveLanguage: true,
        canUpdateLanguageAliases: true,
        canToggleServing: true,
      },
      sourceLanguage: { tag: "en", labelKey: "languages.en", direction: "ltr" },
      targetLanguages: languages.map((language) => ({ ...language, canRemove: true })),
      localeQuota: { used: 2, limit: 5, remaining: 3 },
    };
  }

  if (view === "domains") {
    return {
      meta,
      site,
      access: {
        ...access,
        canVerifyDomain: true,
        canRefreshDomain: true,
        canProvisionDomain: true,
        canUpdateRouting: true,
        canToggleServing: true,
      },
      routing: {
        urlMode: "subdomain",
        servingMode: "strict",
        routePrefixes: [
          { targetLang: "fr", prefix: "/fr" },
          { targetLang: "ja", prefix: "/ja" },
        ],
      },
      languages,
      domains,
    };
  }

  if (view === "settings") {
    return {
      meta,
      site: { ...site, createdAt: now, updatedAt: now },
      access: {
        ...access,
        canEditBasic: true,
        canChangeSourceUrl: true,
        canEditLocales: true,
        canEditRouting: true,
        canEditRuntime: true,
        canEditWebhooks: true,
        canDeactivateSite: true,
        canDeleteSite: true,
      },
      basic: { sourceUrl: DASHBOARD_E2E_MOCK_SOURCE_URL, profile: null, servingMode: "strict" },
      routing: {
        urlMode: "subdomain",
        routePrefixes: [
          { targetLang: "fr", prefix: "/fr" },
          { targetLang: "ja", prefix: "/ja" },
        ],
        localizedPathTemplates: [],
      },
      crawl: { captureMode: "template_plus_hydrated", maxDepth: 3, crawlMaxPages: null },
      runtime: {
        clientRuntimeEnabled: true,
        spaRefreshEnabled: false,
        translatableAttributes: [],
        footerRequired: false,
        cspMode: "strict",
      },
      webhooks: { url: null, events: WEBHOOK_EVENT_TYPES.slice(), hasSecret: false },
      settings: {
        sourceLang: "en",
        targetLangs: ["fr", "ja"],
        aliases: { fr: "fr", ja: "ja" },
        pattern: "https://{lang}.example.test",
        maxLocales: 5,
        servingMode: "strict" as const,
        crawlCaptureMode: "template_plus_hydrated" as const,
        clientRuntimeEnabled: true,
        spaRefresh: null,
        translatableAttributes: [],
        webhookUrl: null,
        webhookEvents: WEBHOOK_EVENT_TYPES.slice(),
        siteProfile: {},
      },
    };
  }

  if (view === "developer_tools") {
    return {
      meta,
      site,
      access: {
        ...access,
        canEditRuntime: true,
        canEditWebhooks: true,
        canViewRuntimeRequests: true,
      },
      runtime: {
        clientRuntimeEnabled: true,
        switcherEnabled: true,
        spaRefreshEnabled: false,
        translatableAttributes: [],
      },
      webhooks: { url: null, events: WEBHOOK_EVENT_TYPES.slice(), hasSecret: false },
      snippets: { available: true, fetchHref: `/api/sites/${siteId}/switcher-snippets` },
      runtimeRequests: {
        available: true,
        policy: createDashboardE2eMockRuntimeRequestPolicy(),
        policySummary: {
          rulesCount: 0,
          fingerprint: JSON.stringify({ schemaVersion: 1, rules: [] }),
          version: `site-config:${now}`,
          lastUpdatedAt: now,
        },
        propagation: {
          servedVersion: `site-config:${now}`,
          expectedVersion: `site-config:${now}`,
          stale: false,
        },
        pageHref: `/dashboard/sites/${siteId}/runtime-requests`,
        observationsHref: `/api/sites/${siteId}/runtime-requests/observations`,
        policyPreviewHref: `/api/sites/${siteId}/runtime-request-policy/preview`,
      },
    };
  }

  if (view === "source_selection") {
    return {
      meta,
      site,
      access: {
        ...access,
        canEditSourceSelection: true,
        canPreviewSourceSelection: true,
      },
      policy: {
        fingerprint: "mock-source-selection",
        updatedAt: now,
        rules: [],
        ruleLimit: 200,
        warnings: [],
      },
      inventorySummary: {
        knownPageCount: 30,
        includedPageCount: 30,
        excludedPageCount: 0,
        inventoryMayBeIncomplete: false,
      },
      preconditions: {
        expectedRouteConfigUpdatedAt: now,
        expectedSourceSelectionFingerprint: "mock-source-selection",
      },
    };
  }

  return {
    meta,
    site,
    access: {
      ...access,
      canUseGlossary: true,
      canUseOverrides: true,
      canEditSlugs: true,
      canUseConsistencyGovernance: false,
    },
    glossarySummary: { entriesCount: 0, sourceLimit: 10, remainingSources: 10 },
    overrideSummary: { entriesCount: 0 },
    slugSummary: { localizedSlugCount: 0, conflicts: 0 },
  };
}

function createDashboardE2eMockCompactStatus(siteId: string) {
  const now = new Date().toISOString();
  return {
    siteId,
    siteStatus: "active",
    latestCrawlRun: {
      id: "crawl-run-latest",
      rawStatus: "completed",
      customerStatus: "completed" as const,
      startedAt: now,
      finishedAt: now,
      updatedAt: now,
      pagesUpdated: 18,
      pagesPending: 0,
      customerError: null,
    },
    activeTranslationRuns: [],
    currentActivity: [],
    generatedAt: now,
  };
}

function createDashboardE2eMockErrorSummary(limit: number, offset: number) {
  const errors = [
    {
      id: "domain_not_verified:domain:0",
      area: "domain" as const,
      severity: "warning" as const,
      code: "domain_not_verified",
      titleKey: "dashboard.blockers.domainNotVerified.title",
      affectedDomains: ["verify.example.test"],
    },
  ].slice(offset, offset + limit);
  return {
    errors,
    pagination: {
      limit,
      offset,
      total: 1,
      nextOffset: offset + errors.length < 1 ? offset + errors.length : null,
    },
    generatedAt: new Date().toISOString(),
  };
}

function createDashboardE2eMockDashboardPayload(siteId: string, searchParams: URLSearchParams) {
  const view = searchParams.get("view");
  if (dashboardProjectionViewSchema.safeParse(view).success) {
    return createDashboardE2eMockCustomerDashboardProjection(
      siteId,
      view as DashboardProjectionView,
    );
  }
  throw new Error("dashboard view is required in dashboard e2e mock mode");
}

function createDashboardE2eMockSourceSelectionPreview(
  searchParams: URLSearchParams,
  body: unknown,
) {
  const payload = getBodyRecord(body);
  const rawSourceSelection = getBodyRecord(payload.sourceSelection);
  const rules = Array.isArray(rawSourceSelection.rules)
    ? rawSourceSelection.rules
        .filter((value): value is Record<string, unknown> => isRecord(value))
        .map((rule) => ({
          action:
            rule.action === "exclude" || rule.action === "canonical_source"
              ? rule.action
              : ("include" as const),
          pattern: typeof rule.pattern === "string" ? rule.pattern : "/",
          ...(typeof rule.canonicalSourcePattern === "string"
            ? { canonicalSourcePattern: rule.canonicalSourcePattern }
            : {}),
        }))
    : [];
  const limitRaw = Number(searchParams.get("limit") ?? "100");
  const offsetRaw = Number(searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 100;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
  const allPages = createDashboardE2eMockPages(30);
  const hasIncludeRule = rules.some((rule) => rule.action === "include");

  const matchesPattern = (pattern: string, sourcePath: string) => {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2) || "/";
      return sourcePath === prefix || sourcePath.startsWith(`${prefix}/`);
    }
    return pattern === sourcePath;
  };

  const decisions = allPages.map((page) => {
    const matchedRule = rules.findLast((rule) => matchesPattern(rule.pattern, page.sourcePath));
    const selected = matchedRule ? matchedRule.action === "include" : hasIncludeRule ? false : true;
    const reason = matchedRule
      ? matchedRule.action === "exclude"
        ? "excluded_by_rule"
        : matchedRule.action === "canonical_source"
          ? "canonicalized_by_rule"
          : "included_by_rule"
      : hasIncludeRule
        ? "not_included_by_rule"
        : "included_by_default";
    const ruleScope =
      matchedRule && matchedRule.pattern.endsWith("/*")
        ? ("inherited" as const)
        : ("direct" as const);
    return {
      sourcePath: page.sourcePath,
      selected,
      reason,
      effectiveState:
        reason === "canonicalized_by_rule"
          ? ("canonicalized" as const)
          : selected
            ? "included"
            : "excluded",
      previousSelected: true,
      previousReason: "included_by_default" as const,
      changed: selected === false,
      ...(matchedRule
        ? {
            matchedPattern: matchedRule.pattern,
            matchedAction: matchedRule.action,
            ruleScope,
            directRule: ruleScope === "direct" ? matchedRule : null,
            inheritedRule: ruleScope === "inherited" ? matchedRule : null,
          }
        : {}),
    };
  });
  const knownPagesIncluded = decisions.filter((page) => page.selected).length;
  const knownPagesExcluded = decisions.length - knownPagesIncluded;

  return {
    sourceSelection: { rules },
    summary: {
      knownPagesTotal: decisions.length,
      knownPagesIncluded,
      knownPagesExcluded,
      includedByDefault: decisions.filter((page) => page.reason === "included_by_default").length,
      includedByRule: decisions.filter((page) => page.reason === "included_by_rule").length,
      excludedByRule: decisions.filter((page) => page.reason === "excluded_by_rule").length,
      notIncludedByRule: decisions.filter((page) => page.reason === "not_included_by_rule").length,
      canonicalizedByRule: decisions.filter((page) => page.reason === "canonicalized_by_rule")
        .length,
      rulesTotal: rules.length,
    },
    affectedPages: decisions.slice(offset, offset + limit),
    pagination: {
      limit,
      offset,
      total: decisions.length,
      hasMore: offset + limit < decisions.length,
    },
    warnings: hasIncludeRule
      ? [
          {
            code: "include_rules_create_allowlist" as const,
            message:
              "Unmatched paths will be excluded because at least one include rule is present.",
          },
        ]
      : [],
  };
}

function createDashboardE2eMockRuntimeObservationGroups(searchParams: URLSearchParams) {
  const now = new Date().toISOString();
  const groups = [
    {
      siteId: DASHBOARD_E2E_MOCK_SITE_ID,
      groupingPathHash: "cart-group",
      shapeSignature: "POST:cart-group:high_risk_dynamic:fetch:json",
      path: "/api/cart",
      method: "POST",
      likelyType: "high_risk_dynamic" as const,
      intent: "fetch" as const,
      acceptClass: "json" as const,
      risk: "high" as const,
      riskReasons: ["non_read_method", "high_risk_path"],
      firstSeenAt: new Date(Date.now() - 86_400_000).toISOString(),
      lastSeenAt: now,
      count: 7,
      seenFromPage: "/pricing",
      currentAction: "observe" as const,
      suggestedAction: "deny" as const,
      policyRuleId: null,
      routePolicyVersion: `site-config:${now}`,
      routePolicyStale: false,
      lifecycle: "open" as const,
      reviewedAt: null,
      dismissedAt: null,
      ignoredAt: null,
      bodyPresent: true,
      bodySizeBucket: "1-1kb" as const,
    },
    {
      siteId: DASHBOARD_E2E_MOCK_SITE_ID,
      groupingPathHash: "search-group",
      shapeSignature: "GET:search-group:dynamic_api:fetch:json",
      path: "/api/search",
      method: "GET",
      likelyType: "dynamic_api" as const,
      intent: "fetch" as const,
      acceptClass: "json" as const,
      risk: "medium" as const,
      riskReasons: [],
      firstSeenAt: new Date(Date.now() - 172_800_000).toISOString(),
      lastSeenAt: new Date(Date.now() - 3_600_000).toISOString(),
      count: 18,
      seenFromPage: "/",
      currentAction: "observe" as const,
      suggestedAction: "proxy" as const,
      policyRuleId: null,
      routePolicyVersion: `site-config:${now}`,
      routePolicyStale: false,
      lifecycle: "open" as const,
      reviewedAt: null,
      dismissedAt: null,
      ignoredAt: null,
      bodyPresent: false,
      bodySizeBucket: "none" as const,
    },
  ];
  const risk = searchParams.get("risk");
  const lifecycle = searchParams.get("lifecycle");
  const search = searchParams.get("search")?.trim().toLowerCase();
  const filtered = groups.filter((group) => {
    if (risk && group.risk !== risk) return false;
    if (lifecycle && group.lifecycle !== lifecycle) return false;
    if (search && !group.path.toLowerCase().includes(search)) return false;
    return true;
  });
  return { groups: filtered, nextCursor: null };
}

function createDashboardE2eMockRuntimePolicyPreview(body: unknown) {
  const payload = getBodyRecord(body);
  const rawPolicy = getBodyRecord(payload.runtimeRequestPolicy);
  const rawRules = Array.isArray(rawPolicy.rules) ? rawPolicy.rules : [];
  const rules = rawRules
    .filter((value): value is Record<string, unknown> => isRecord(value))
    .map((rule, index) => createRuntimeRequestPolicyRuleFromRecord(rule, index));
  const runtimeRequestPolicy = createDashboardE2eMockRuntimeRequestPolicy(rules);
  const validationErrors = rules.flatMap((rule) => {
    const errors: Array<{ code: string; ruleId: string; message: string }> = [];
    if (
      rule.action === "proxy" &&
      rule.methods.some((method) => method !== "GET" && method !== "HEAD") &&
      !rule.confirmations.includes("non_get_proxy")
    ) {
      errors.push({
        code: "confirmation_required_non_get_proxy",
        ruleId: rule.id,
        message: "Non-GET proxy rules require confirmation.",
      });
    }
    if (
      rule.action === "proxy" &&
      rule.credentials !== "omit" &&
      !rule.confirmations.includes("credential_forwarding")
    ) {
      errors.push({
        code: "confirmation_required_credential_forwarding",
        ruleId: rule.id,
        message: "Credential forwarding requires confirmation.",
      });
    }
    if (
      /\/(?:api\/)?(?:auth|cart|checkout|payment|account|admin)(?:\/|$)/i.test(rule.pattern) &&
      !rule.confirmations.includes("high_risk_path")
    ) {
      errors.push({
        code: "confirmation_required_high_risk_path",
        ruleId: rule.id,
        message: "High-risk paths require confirmation.",
      });
    }
    return errors;
  });
  return {
    runtimeRequestPolicy,
    validationErrors,
    warnings: [],
    collisions: [],
    highRiskConfirmations: validationErrors.map((error) => ({
      ruleId: error.ruleId,
      code: error.code,
    })),
    sampleResults: [],
    matchedObservationGroups: createDashboardE2eMockRuntimeObservationGroups(
      new URLSearchParams(),
    ).groups.filter((group) => rules.some((rule) => group.path === rule.pattern)),
    propagation: {
      currentRouteConfigUpdatedAt: new Date().toISOString(),
      currentRuntimeRequestPolicyVersion: `site-config:${new Date().toISOString()}`,
    },
  };
}

function createRuntimeRequestPolicyRuleFromRecord(
  record: Record<string, unknown>,
  index: number,
): RuntimeRequestPolicyRule {
  const action =
    record.action === "deny" ||
    record.action === "neutralize" ||
    record.action === "proxy" ||
    record.action === "observe"
      ? record.action
      : "observe";
  const methods = Array.isArray(record.methods)
    ? record.methods.filter(
        (method): method is RuntimeRequestPolicyMethod =>
          runtimeRequestPolicyMethodSchema.safeParse(method).success,
      )
    : action === "proxy"
      ? (["GET", "HEAD"] as RuntimeRequestPolicyMethod[])
      : (["GET", "HEAD", "POST", "OPTIONS"] as RuntimeRequestPolicyMethod[]);
  const confirmations = Array.isArray(record.confirmations)
    ? record.confirmations.filter(
        (value): value is RuntimeRequestPolicyConfirmation =>
          runtimeRequestPolicyConfirmationSchema.safeParse(value).success,
      )
    : [];
  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `rule-${index + 1}`,
    name:
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : `Rule ${index + 1}`,
    enabled: record.enabled !== false,
    pattern:
      typeof record.pattern === "string" && record.pattern.trim()
        ? record.pattern.trim()
        : "/api/*",
    methods,
    action,
    credentials:
      record.credentials === "same_origin" || record.credentials === "include"
        ? record.credentials
        : "omit",
    cache: record.cache === "edge" ? "edge" : "no-store",
    maxBodyBytes: typeof record.maxBodyBytes === "number" ? record.maxBodyBytes : 0,
    maxResponseBytes:
      typeof record.maxResponseBytes === "number" ? record.maxResponseBytes : 1_048_576,
    timeoutMs: typeof record.timeoutMs === "number" ? record.timeoutMs : 5_000,
    redirectScope:
      record.redirectScope === "same_registrable_domain" ? record.redirectScope : "same_origin",
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
    confirmations,
  };
}

function createDashboardE2eMockSiteShowcase(siteId: string) {
  const now = new Date().toISOString();
  return {
    siteId,
    customerServingStatus: "needs_domain" as const,
    showcaseServingStatus: "ready" as const,
    showcase: {
      websitePath: "source.example.test",
      defaultLang: "fr",
      status: "active" as const,
      url: "https://t2.weblingo.app/source.example.test/fr",
      createdAt: now,
      updatedAt: now,
    },
  };
}

function createDashboardE2eMockManagedDemoSummary() {
  const now = new Date().toISOString();
  return {
    accountId: "acct-demo-managed",
    accountPlan: "starter" as const,
    siteId: DASHBOARD_E2E_MOCK_SITE_ID,
    sourceUrl: DASHBOARD_E2E_MOCK_SOURCE_URL,
    siteStatus: "active" as const,
    customerServingStatus: "needs_domain" as const,
    showcaseServingStatus: "ready" as const,
    showcase: {
      websitePath: "source.example.test",
      defaultLang: "fr",
      status: "active" as const,
      url: "https://t2.weblingo.app/source.example.test/fr",
      createdAt: now,
      updatedAt: now,
    },
    showcaseLocales: [
      {
        targetLang: "fr",
        serveEnabled: true,
        isDefault: true,
        customerServingStatus: "needs_domain" as const,
        showcaseServingStatus: "ready" as const,
        url: "https://t2.weblingo.app/source.example.test/fr",
      },
    ],
    deployment: {
      targetLang: "fr",
      deploymentId: "dep-site-smoke-1-fr-current",
      status: "active",
      activatedAt: now,
      activeDeploymentId: "dep-site-smoke-1-fr-current",
      activeDeploymentRowId: "deployment-row-fr",
      activeDeploymentStatus: "active",
      activeActivatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
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
    return { languages: SUPPORTED_LANGUAGES_STATIC.slice(0, 3) };
  }

  if (method === "GET" && pathname === "/admin/managed-demos") {
    return { items: [createDashboardE2eMockManagedDemoSummary()] };
  }

  if (method === "POST" && pathname === "/admin/managed-demos") {
    return {
      accountId: "acct-demo-managed",
      site: {
        ...createDashboardE2eMockSite(DASHBOARD_E2E_MOCK_SITE_ID),
        crawlStatus: {
          enqueued: true,
        },
      },
      showcase: createDashboardE2eMockSiteShowcase(DASHBOARD_E2E_MOCK_SITE_ID).showcase,
    };
  }

  if (
    method === "POST" &&
    pathname ===
      `/admin/managed-demos/${encodeURIComponent(DASHBOARD_E2E_MOCK_SITE_ID)}/rerun-crawl`
  ) {
    const body = getBodyRecord(input.body);
    return {
      siteId: DASHBOARD_E2E_MOCK_SITE_ID,
      sourceUrl: DASHBOARD_E2E_MOCK_SOURCE_URL,
      adminInitiated: true,
      usageCounted: false,
      force: body.force === true,
      targetLangs: ["fr"],
      crawlStatus: { enqueued: true },
    };
  }

  const siteMatch = pathname.match(/^\/sites\/([^/]+)$/);
  if (siteMatch && method === "GET") {
    return createDashboardE2eMockSite(siteMatch[1]);
  }
  if (siteMatch && method === "PATCH") {
    return createDashboardE2eMockSite(siteMatch[1]);
  }

  const siteDashboardMatch = pathname.match(/^\/sites\/([^/]+)\/dashboard$/);
  if (siteDashboardMatch && method === "GET") {
    return createDashboardE2eMockDashboardPayload(siteDashboardMatch[1], url.searchParams);
  }

  const sitePagesMatch = pathname.match(/^\/sites\/([^/]+)\/pages$/);
  if (sitePagesMatch && method === "GET") {
    const limitRaw = Number(url.searchParams.get("limit") ?? "25");
    const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 25;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
    const allPages = createDashboardE2eMockPages(30);
    const pages = allPages.slice(offset, offset + limit);
    return {
      site: {
        id: sitePagesMatch[1],
        sourceUrl: DASHBOARD_E2E_MOCK_SOURCE_URL,
        status: "active" as const,
      },
      status: createDashboardE2eMockCompactStatus(sitePagesMatch[1]),
      pagesSummary: {
        lastCrawlStartedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
        lastCrawlFinishedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
        pagesUpdated: 18,
        pagesPending: 5,
        nextEligibleCrawlAt: new Date().toISOString(),
        eligiblePageCount: 5,
        rawLatestCrawlStatus: "completed",
        customerCrawlStatus: "completed" as const,
      },
      pages,
      pagination: {
        limit,
        offset,
        total: allPages.length,
        hasMore: offset + pages.length < allPages.length,
      },
    };
  }

  const siteStatusMatch = pathname.match(/^\/sites\/([^/]+)\/status$/);
  if (siteStatusMatch && method === "GET") {
    return createDashboardE2eMockCompactStatus(siteStatusMatch[1]);
  }

  const siteErrorSummaryMatch = pathname.match(/^\/sites\/([^/]+)\/errors\/summary$/);
  if (siteErrorSummaryMatch && method === "GET") {
    const limitRaw = Number(url.searchParams.get("limit") ?? "10");
    const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 10;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
    return createDashboardE2eMockErrorSummary(limit, offset);
  }

  const siteTranslationRunsMatch = pathname.match(/^\/sites\/([^/]+)\/translation-runs$/);
  if (siteTranslationRunsMatch && method === "GET") {
    const limitRaw = Number(url.searchParams.get("limit") ?? "10");
    const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 10;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
    return createDashboardE2eMockCustomerTranslationRuns(
      url.searchParams.get("targetLang"),
      limit,
      offset,
    );
  }

  const runtimeObservationsMatch = pathname.match(
    /^\/sites\/([^/]+)\/runtime-requests\/observations$/,
  );
  if (runtimeObservationsMatch && method === "GET") {
    return createDashboardE2eMockRuntimeObservationGroups(url.searchParams);
  }

  const runtimeObservationLifecycleMatch = pathname.match(
    /^\/sites\/([^/]+)\/runtime-requests\/observations\/([^/]+)$/,
  );
  if (runtimeObservationLifecycleMatch && method === "PATCH") {
    const payload = getBodyRecord(input.body);
    const now = new Date().toISOString();
    return {
      state: {
        siteId: runtimeObservationLifecycleMatch[1],
        groupingPathHash: decodeURIComponent(runtimeObservationLifecycleMatch[2]),
        method: typeof payload.method === "string" ? payload.method : "GET",
        shapeSignature:
          typeof payload.shapeSignature === "string" ? payload.shapeSignature : "GET:mock",
        reviewedAt: payload.lifecycle === "reviewed" ? now : null,
        dismissedAt: payload.lifecycle === "dismissed" ? now : null,
        ignoredAt: payload.lifecycle === "ignored" ? now : null,
        updatedAt: now,
      },
    };
  }

  const runtimePolicyPreviewMatch = pathname.match(
    /^\/sites\/([^/]+)\/runtime-request-policy\/preview$/,
  );
  if (runtimePolicyPreviewMatch && method === "POST") {
    return createDashboardE2eMockRuntimePolicyPreview(input.body);
  }

  const sourceSelectionPreviewMatch = pathname.match(
    /^\/sites\/([^/]+)\/source-selection\/preview$/,
  );
  if (sourceSelectionPreviewMatch && method === "POST") {
    return createDashboardE2eMockSourceSelectionPreview(url.searchParams, input.body);
  }

  const glossaryMatch = pathname.match(/^\/sites\/([^/]+)\/glossary$/);
  if (glossaryMatch && method === "GET") {
    return {
      entries: [],
      crawlStatus: null,
      retranslateStatus: null,
    };
  }
  if (glossaryMatch && method === "PUT") {
    const payload = getBodyRecord(input.body);
    const entries = Array.isArray(payload.entries)
      ? payload.entries.filter((value): value is Record<string, unknown> => isRecord(value))
      : [];
    return {
      entries,
      crawlStatus: null,
      retranslateStatus: null,
    };
  }

  const siteShowcaseMatch = pathname.match(/^\/sites\/([^/]+)\/showcase$/);
  if (siteShowcaseMatch && method === "GET") {
    return createDashboardE2eMockSiteShowcase(siteShowcaseMatch[1]);
  }
  if (siteShowcaseMatch && (method === "POST" || method === "PATCH")) {
    const payload = getBodyRecord(input.body);
    const current = createDashboardE2eMockSiteShowcase(siteShowcaseMatch[1]);
    return {
      ...current,
      showcase: {
        ...current.showcase,
        websitePath:
          typeof payload.websitePath === "string" && payload.websitePath.trim().length > 0
            ? payload.websitePath.trim()
            : current.showcase.websitePath,
        defaultLang:
          payload.defaultLang === null
            ? null
            : typeof payload.defaultLang === "string"
              ? payload.defaultLang
              : current.showcase.defaultLang,
        status:
          payload.status === "disabled" || payload.status === "active"
            ? payload.status
            : current.showcase.status,
      },
    };
  }

  const deploymentsMatch = pathname.match(/^\/sites\/([^/]+)\/deployments$/);
  if (deploymentsMatch && method === "GET") {
    return {
      deployments: createDashboardE2eMockDeployments(deploymentsMatch[1]),
    };
  }

  const deploymentHistoryMatch = pathname.match(/^\/sites\/([^/]+)\/deployments\/history$/);
  if (deploymentHistoryMatch && method === "GET") {
    const limitRaw = Number(url.searchParams.get("limit") ?? "5");
    const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 5;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
    if (url.searchParams.get("view") === "customer") {
      return createDashboardE2eMockCustomerDeploymentHistory(
        url.searchParams.get("targetLang") ?? "fr",
        limit,
        offset,
      );
    }
    return createDashboardE2eMockDeploymentHistory(limit);
  }

  const consistencyCpmMatch = pathname.match(/^\/sites\/([^/]+)\/consistency\/cpm$/);
  if (consistencyCpmMatch && method === "GET") {
    const targetLang = url.searchParams.get("targetLang") ?? "fr";
    const limitRaw = Number(url.searchParams.get("limit") ?? "100");
    const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 100;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
    return {
      siteId: consistencyCpmMatch[1],
      sourceLang: "en",
      targetLang,
      limit,
      offset,
      statusFilter: [] as const,
      entries: [
        {
          id: "cpm-1",
          contentId: "cid_demo_contact",
          sourceLang: "en",
          targetLang,
          targetText: "Contactez-nous",
          scope: "site",
          status: "approved" as const,
          occurrencesCount: 12,
          lastUsedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
  }

  if (consistencyCpmMatch && method === "PUT") {
    const payload = getBodyRecord(input.body);
    const entries = Array.isArray(payload.entries)
      ? payload.entries.filter((value): value is Record<string, unknown> => isRecord(value))
      : [];
    const first = entries[0] ?? {};
    const targetLang = typeof payload.targetLang === "string" ? payload.targetLang : "fr";
    return {
      siteId: consistencyCpmMatch[1],
      sourceLang: typeof payload.sourceLang === "string" ? payload.sourceLang : "en",
      targetLang,
      upserted: [
        {
          id: "cpm-upserted",
          contentId: typeof first.contentId === "string" ? first.contentId : "cid_demo_contact",
          sourceLang: "en",
          targetLang,
          targetText: typeof first.targetText === "string" ? first.targetText : "Contactez-nous",
          scope: typeof first.scope === "string" ? first.scope : "site",
          status:
            first.status === "approved" || first.status === "frozen" || first.status === "proposed"
              ? first.status
              : ("proposed" as const),
          occurrencesCount: 0,
          lastUsedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
  }

  const consistencyBlocksListMatch = pathname.match(/^\/sites\/([^/]+)\/consistency\/blocks$/);
  if (consistencyBlocksListMatch && method === "GET") {
    return {
      siteId: consistencyBlocksListMatch[1],
      statusFilter: [] as const,
      blocks: [
        {
          id: "block-nav",
          blockType: "nav",
          blockSignature: "nav-signature",
          familySignature: "nav-family",
          mode: "strict" as const,
          status: "approved" as const,
          occurrencesCount: 8,
          firstSeenAt: new Date(Date.now() - 86_400_000).toISOString(),
          lastSeenAt: new Date().toISOString(),
          members: [
            { id: "member-1", contentId: "cid_demo_home", position: 0 },
            { id: "member-2", contentId: "cid_demo_pricing", position: 1 },
          ],
        },
      ],
    };
  }

  const consistencyBlockUpdateMatch = pathname.match(
    /^\/sites\/([^/]+)\/consistency\/blocks\/([^/]+)$/,
  );
  if (consistencyBlockUpdateMatch && method === "PUT") {
    const payload = getBodyRecord(input.body);
    const members = Array.isArray(payload.members)
      ? payload.members
          .filter((value): value is string => typeof value === "string")
          .map((contentId, index) => ({
            id: `member-${index + 1}`,
            contentId,
            position: index,
          }))
      : [
          { id: "member-1", contentId: "cid_demo_home", position: 0 },
          { id: "member-2", contentId: "cid_demo_pricing", position: 1 },
        ];
    return {
      siteId: consistencyBlockUpdateMatch[1],
      block: {
        id: decodeURIComponent(consistencyBlockUpdateMatch[2]),
        blockType: "nav",
        blockSignature: "nav-signature",
        familySignature: "nav-family",
        mode: payload.mode === "prefer" ? "prefer" : "strict",
        status:
          payload.status === "approved" ||
          payload.status === "frozen" ||
          payload.status === "proposed"
            ? payload.status
            : "proposed",
        occurrencesCount: 8,
        firstSeenAt: new Date(Date.now() - 86_400_000).toISOString(),
        lastSeenAt: new Date().toISOString(),
        members,
      },
    };
  }

  const overrideHygieneMatch = pathname.match(/^\/sites\/([^/]+)\/consistency\/override-hygiene$/);
  if (overrideHygieneMatch && method === "GET") {
    const targetLang = url.searchParams.get("targetLang") ?? "fr";
    const limitRaw = Number(url.searchParams.get("limit") ?? "100");
    const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 100;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
    return {
      siteId: overrideHygieneMatch[1],
      sourceLang: "en",
      targetLang,
      limit,
      offset,
      hasMore: false,
      scopedOverrideCount: 1,
      totalWarnings: 1,
      warnings: [
        {
          segmentId: "seg-demo-contact",
          contentId: "cid_demo_contact",
          sourceText: "Contact us",
          overrideText: "Parlez-nous",
          canonicalTargetText: "Contactez-nous",
          canonicalStatus: "approved" as const,
          canonicalScope: "site",
          contextHashScope: "ctx-demo",
          reason: "context_override_global_exact_conflict" as const,
        },
      ],
    };
  }

  const crawlMatch = pathname.match(/^\/sites\/([^/]+)\/crawl$/);
  if (crawlMatch && method === "POST") {
    return { enqueued: true };
  }

  const crawlTranslateMatch = pathname.match(/^\/sites\/([^/]+)\/crawl-translate$/);
  if (crawlTranslateMatch && method === "POST") {
    const payload = getBodyRecord(input.body);
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
    const payload = getBodyRecord(input.body);
    const targetLang = typeof payload.targetLang === "string" ? payload.targetLang : "fr";
    const now = new Date().toISOString();
    return {
      run: {
        id: `run-${targetLang}-smoke`,
        siteId: translateMatch[1],
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
    const payload = getBodyRecord(input.body);
    const enabled = payload.enabled === true;
    const targetLang = decodeURIComponent(serveToggleMatch[2]);
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
    const domain = decodeURIComponent(domainMatch[2]);
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

async function readRequestValidationMarker(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return normalizeValidationMarker(cookieStore.get(QA_MARKER_COOKIE_NAME)?.value);
  } catch {
    return null;
  }
}

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
  const hasBody = body !== undefined;
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
  const forwardsToWebLingoApi = url === apiBase || url.startsWith(`${apiBase}/`);
  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestHeaders = new Headers();
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
    if (hasBody) {
      requestHeaders.set("Content-Type", "application/json");
    }
    requestHeaders.set("x-dashboard-trace-id", traceId);
    const validationMarker = forwardsToWebLingoApi ? await readRequestValidationMarker() : null;
    if (validationMarker) {
      requestHeaders.set(QA_MARKER_HEADER_NAME, validationMarker);
    }
    new Headers(headers).forEach((value, key) => {
      requestHeaders.set(key, value);
    });

    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: hasBody ? JSON.stringify(body) : undefined,
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
    const parsedError = parsed === undefined ? null : errorResponseSchema.safeParse(parsed);
    const message =
      parsedError?.success === true
        ? parsedError.data.error
        : `Request failed with status ${response.status}`;
    const details = parsedError?.success === true ? parsedError.data.details : parsed;
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
    const details = {
      code: "response_schema_mismatch",
      issues: result.error.issues,
    };
    console.error("[webhooks] response schema mismatch", {
      path,
      method,
      status: response.status,
      issues: details.issues,
    });
    throw new WebhooksApiError(
      "The WebLingo API returned an unexpected dashboard response.",
      response.status,
      details,
    );
  }
  logTiming(response.status, true);
  return result.data;
}

function safeParseJson(input: string): unknown | undefined {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

function normalizeAuth(auth?: AuthInput): WebhooksAuth | null {
  if (auth == null) {
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
  const subjectAccountId =
    typeof payload?.subjectAccountId === "string" && payload.subjectAccountId.length > 0
      ? payload.subjectAccountId
      : undefined;
  const includeAgencyCustomers = payload?.includeAgencyCustomers === true;
  const body =
    subjectAccountId !== undefined || includeAgencyCustomers
      ? {
          subjectAccountId,
          includeAgencyCustomers: includeAgencyCustomers ? true : undefined,
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

export async function convertProspectShowcaseDemo(
  auth: AuthInput,
  prospectShowcaseRef: string,
  payload: { email: string; conversionToken: string },
): Promise<ProspectDemoConversionResponse> {
  return request({
    path: `/prospect-showcases/${encodeURIComponent(prospectShowcaseRef)}/convert`,
    method: "POST",
    auth,
    body: payload,
    schema: prospectDemoConversionResponseSchema,
    timeoutProfile: "mutation",
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

export async function updateAgencyCustomer(
  auth: AuthInput,
  customerAccountId: string,
  payload: { customerPlan: "starter" | "pro" },
): Promise<UpdateAgencyCustomerResponse> {
  return request({
    path: `/agency/customers/${customerAccountId}`,
    method: "PATCH",
    auth,
    body: payload,
    schema: updateAgencyCustomerResponseSchema,
    timeoutProfile: "mutation",
  });
}

export async function listAdminAccounts(
  auth: AuthInput,
  options?: {
    accountId?: string;
    planType?: ManagedAccountPlan;
    managedDemo?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<ListAdminAccountsResponse> {
  const qs = new URLSearchParams();
  if (options?.accountId) {
    qs.set("accountId", options.accountId);
  }
  if (options?.planType) {
    qs.set("planType", options.planType);
  }
  if (typeof options?.managedDemo === "boolean") {
    qs.set("managedDemo", String(options.managedDemo));
  }
  if (typeof options?.limit === "number") {
    qs.set("limit", String(options.limit));
  }
  if (typeof options?.offset === "number") {
    qs.set("offset", String(options.offset));
  }
  const path = qs.size ? `/admin/accounts?${qs.toString()}` : "/admin/accounts";
  return request({
    path,
    auth,
    schema: listAdminAccountsResponseSchema,
    timeoutProfile: "list",
  });
}

export async function getAdminAccount(
  auth: AuthInput,
  accountId: string,
): Promise<GetAdminAccountResponse> {
  return request({
    path: `/admin/accounts/${accountId}`,
    auth,
    schema: getAdminAccountResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function updateAdminAccount(
  auth: AuthInput,
  accountId: string,
  payload: {
    planType?: ManagedAccountPlan;
    planStatus?: z.infer<typeof planStatusSchema>;
    managedDemo?: boolean;
    maxSites?: number | null;
    freeQuota?: number | null;
    starterQuota?: number | null;
    proQuota?: number | null;
    featureFlags?: ManagedAccountFeatureFlagOverrides | null;
  },
): Promise<UpdateAdminAccountResponse> {
  return request({
    path: `/admin/accounts/${accountId}`,
    method: "PATCH",
    auth,
    body: payload,
    schema: updateAdminAccountResponseSchema,
    timeoutProfile: "mutation",
  });
}

export type CreateManagedDemoSitePayload = {
  site: CreateSitePayload;
  accountPlan?: ManagedAccountPlan;
  showcase?: {
    websitePath?: string;
    defaultLang?: string | null;
  };
};

export async function listManagedDemos(auth: AuthInput): Promise<ListManagedDemoSitesResponse> {
  return request({
    path: "/admin/managed-demos",
    auth,
    schema: listManagedDemoSitesResponseSchema,
    timeoutProfile: "list",
  });
}

export async function createManagedDemo(
  auth: AuthInput,
  payload: CreateManagedDemoSitePayload,
): Promise<CreateManagedDemoSiteResponse> {
  return request({
    path: "/admin/managed-demos",
    method: "POST",
    auth,
    body: payload,
    schema: createManagedDemoSiteResponseSchema,
    timeoutProfile: "mutation",
  });
}

export async function rerunManagedDemoSiteCrawl(
  auth: AuthInput,
  siteId: string,
  options?: { force?: boolean },
): Promise<RerunManagedDemoSiteCrawlResponse> {
  return request({
    path: `/admin/managed-demos/${siteId}/rerun-crawl`,
    method: "POST",
    auth,
    body: options?.force === true ? { force: true } : undefined,
    schema: rerunManagedDemoSiteCrawlResponseSchema,
    timeoutProfile: "mutation",
  });
}

export async function listSupportedLanguages(): Promise<SupportedLanguage[]> {
  const data = await request({
    path: "/meta/languages",
    schema: supportedLanguagesResponseSchema,
    timeoutProfile: "metadata",
  });
  return data.languages;
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

export async function fetchSiteDashboardProjection(
  auth: AuthInput,
  siteId: string,
  view: "overview",
): Promise<SiteCustomerOverviewResponse>;
export async function fetchSiteDashboardProjection(
  auth: AuthInput,
  siteId: string,
  view: "languages",
): Promise<SiteLanguagesProjectionResponse>;
export async function fetchSiteDashboardProjection(
  auth: AuthInput,
  siteId: string,
  view: "domains",
): Promise<SiteDomainsProjectionResponse>;
export async function fetchSiteDashboardProjection(
  auth: AuthInput,
  siteId: string,
  view: "settings",
): Promise<SiteSettingsProjectionResponse>;
export async function fetchSiteDashboardProjection(
  auth: AuthInput,
  siteId: string,
  view: "developer_tools",
): Promise<SiteDeveloperToolsProjectionResponse>;
export async function fetchSiteDashboardProjection(
  auth: AuthInput,
  siteId: string,
  view: "source_selection",
): Promise<SiteSourceSelectionProjectionResponse>;
export async function fetchSiteDashboardProjection(
  auth: AuthInput,
  siteId: string,
  view: "quality",
): Promise<SiteQualityProjectionResponse>;
export async function fetchSiteDashboardProjection(
  auth: AuthInput,
  siteId: string,
  view: DashboardProjectionView,
): Promise<SiteDashboardProjectionResponse> {
  const qs = new URLSearchParams({ view });
  return request({
    path: `/sites/${siteId}/dashboard?${qs.toString()}`,
    auth,
    schema: dashboardProjectionSchemaForView(view),
    timeoutProfile: "detail",
  });
}

function dashboardProjectionSchemaForView(
  view: DashboardProjectionView,
): z.ZodSchema<SiteDashboardProjectionResponse> {
  switch (view) {
    case "overview":
      return siteCustomerOverviewResponseSchema;
    case "languages":
      return siteLanguagesProjectionResponseSchema;
    case "domains":
      return siteDomainsProjectionResponseSchema;
    case "settings":
      return siteSettingsProjectionResponseSchema;
    case "developer_tools":
      return siteDeveloperToolsProjectionResponseSchema;
    case "source_selection":
      return siteSourceSelectionProjectionResponseSchema;
    case "quality":
      return siteQualityProjectionResponseSchema;
  }
}

export async function fetchSiteCustomerOverview(
  auth: AuthInput,
  siteId: string,
): Promise<SiteCustomerOverviewResponse> {
  return request({
    path: `/sites/${siteId}/dashboard?view=overview`,
    auth,
    schema: siteCustomerOverviewResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function fetchSiteCompactStatus(
  auth: AuthInput,
  siteId: string,
): Promise<SiteCompactStatusResponse> {
  return request({
    path: `/sites/${siteId}/status`,
    auth,
    schema: siteCompactStatusResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function fetchCustomerErrorSummary(
  auth: AuthInput,
  siteId: string,
  options?: { limit?: number; offset?: number },
): Promise<CustomerErrorSummaryResponse> {
  const qs = new URLSearchParams();
  if (typeof options?.limit === "number") {
    qs.set("limit", String(options.limit));
  }
  if (typeof options?.offset === "number") {
    qs.set("offset", String(options.offset));
  }
  const path = qs.size
    ? `/sites/${siteId}/errors/summary?${qs.toString()}`
    : `/sites/${siteId}/errors/summary`;
  return request({
    path,
    auth,
    schema: customerErrorSummaryResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function previewSourceSelection(
  auth: AuthInput,
  siteId: string,
  payload: {
    sourceSelection: SourceSelectionConfig;
    includeUnknownFutureDescendants?: boolean;
  },
  options?: { limit?: number; offset?: number },
): Promise<SourceSelectionPreviewResponse> {
  const qs = new URLSearchParams();
  if (typeof options?.limit === "number") {
    qs.set("limit", String(options.limit));
  }
  if (typeof options?.offset === "number") {
    qs.set("offset", String(options.offset));
  }
  const path = qs.size
    ? `/sites/${siteId}/source-selection/preview?${qs.toString()}`
    : `/sites/${siteId}/source-selection/preview`;
  return request({
    path,
    method: "POST",
    auth,
    body: payload,
    schema: sourceSelectionPreviewResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function previewSourceSelectionTree(
  auth: AuthInput,
  siteId: string,
  payload: {
    sourceSelection: SourceSelectionConfig;
    includeUnknownFutureDescendants?: boolean;
  },
  options?: { limit?: number; cursor?: string; parentPath?: string; search?: string },
): Promise<SourceSelectionTreePreviewResponse> {
  const qs = new URLSearchParams();
  if (typeof options?.limit === "number") {
    qs.set("limit", String(options.limit));
  }
  if (typeof options?.cursor === "string" && options.cursor.trim()) {
    qs.set("cursor", options.cursor);
  }
  if (typeof options?.search === "string" && options.search.trim()) {
    qs.set("search", options.search.trim());
  } else if (typeof options?.parentPath === "string" && options.parentPath.trim()) {
    qs.set("parentPath", options.parentPath.trim());
  }
  const path = qs.size
    ? `/sites/${siteId}/source-selection/tree-preview?${qs.toString()}`
    : `/sites/${siteId}/source-selection/tree-preview`;
  return request({
    path,
    method: "POST",
    auth,
    body: payload,
    schema: sourceSelectionTreePreviewResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function listRuntimeRequestObservations(
  auth: AuthInput,
  siteId: string,
  options?: {
    limit?: number;
    cursor?: string | null;
    lifecycle?: RuntimeRequestLifecycle | "all";
    risk?: "low" | "medium" | "high" | "all";
    method?: string | null;
    search?: string | null;
    sort?: "last_seen_desc" | "last_seen_asc" | "count_desc";
  },
): Promise<RuntimeRequestObservationGroupsResponse> {
  const qs = new URLSearchParams();
  if (typeof options?.limit === "number") {
    qs.set("limit", String(options.limit));
  }
  if (typeof options?.cursor === "string" && options.cursor.trim()) {
    qs.set("cursor", options.cursor);
  }
  if (options?.lifecycle && options.lifecycle !== "all") {
    qs.set("lifecycle", options.lifecycle);
  }
  if (options?.risk && options.risk !== "all") {
    qs.set("risk", options.risk);
  }
  if (typeof options?.method === "string" && options.method.trim()) {
    qs.set("method", options.method.trim().toUpperCase());
  }
  if (typeof options?.search === "string" && options.search.trim()) {
    qs.set("search", options.search.trim());
  }
  if (options?.sort) {
    qs.set("sort", options.sort);
  }
  const path = qs.size
    ? `/sites/${siteId}/runtime-requests/observations?${qs.toString()}`
    : `/sites/${siteId}/runtime-requests/observations`;
  return request({
    path,
    auth,
    schema: runtimeRequestObservationGroupsResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function updateRuntimeRequestObservationLifecycle(
  auth: AuthInput,
  siteId: string,
  groupingPathHash: string,
  payload: { lifecycle: RuntimeRequestLifecycle; method: string; shapeSignature: string },
) {
  return request({
    path: `/sites/${siteId}/runtime-requests/observations/${encodeURIComponent(groupingPathHash)}`,
    method: "PATCH",
    auth,
    body: payload,
    schema: runtimeRequestObservationLifecycleResponseSchema,
    timeoutProfile: "mutation",
  });
}

export async function previewRuntimeRequestPolicy(
  auth: AuthInput,
  siteId: string,
  payload: {
    runtimeRequestPolicy: RuntimeRequestPolicyConfig;
    samples?: Array<string | RuntimeRequestPolicyPreviewSample>;
  },
): Promise<RuntimeRequestPolicyPreviewResponse> {
  return request({
    path: `/sites/${siteId}/runtime-request-policy/preview`,
    method: "POST",
    auth,
    body: payload,
    schema: runtimeRequestPolicyPreviewResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function getSiteShowcase(
  auth: AuthInput,
  siteId: string,
): Promise<SiteShowcaseResponse> {
  return request({
    path: `/sites/${siteId}/showcase`,
    auth,
    schema: siteShowcaseResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function createSiteShowcase(
  auth: AuthInput,
  siteId: string,
  payload: { websitePath: string; defaultLang?: string | null },
): Promise<SiteShowcaseResponse> {
  return request({
    path: `/sites/${siteId}/showcase`,
    method: "POST",
    auth,
    body: payload,
    schema: siteShowcaseResponseSchema,
    timeoutProfile: "mutation",
  });
}

export async function updateSiteShowcase(
  auth: AuthInput,
  siteId: string,
  payload: { defaultLang?: string | null; status?: "active" | "disabled" },
): Promise<SiteShowcaseResponse> {
  return request({
    path: `/sites/${siteId}/showcase`,
    method: "PATCH",
    auth,
    body: payload,
    schema: siteShowcaseResponseSchema,
    timeoutProfile: "mutation",
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
  sourceSelection?: SourceSelectionConfig | null;
  runtimeRequestPolicy?: RuntimeRequestPolicyConfig | null;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
  webhookEvents?: NotifyWebhookEventType[];
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
    expectedRouteConfigUpdatedAt?: string;
    expectedSourceSelectionFingerprint?: string;
    expectedRuntimeRequestPolicyFingerprint?: string;
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
    body: options?.force === true ? { force: true } : undefined,
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

export async function fetchCustomerTranslationRuns(
  auth: AuthInput,
  siteId: string,
  options?: { targetLang?: string; limit?: number; offset?: number },
): Promise<CustomerTranslationRunsResponse> {
  const searchParams = new URLSearchParams();
  if (options?.targetLang) {
    searchParams.set("targetLang", options.targetLang);
  }
  if (typeof options?.limit === "number") {
    searchParams.set("limit", String(options.limit));
  }
  if (typeof options?.offset === "number") {
    searchParams.set("offset", String(options.offset));
  }
  const path = searchParams.size
    ? `/sites/${siteId}/translation-runs?${searchParams.toString()}`
    : `/sites/${siteId}/translation-runs`;
  return request({
    path,
    auth,
    schema: customerTranslationRunsResponseSchema,
    timeoutProfile: "detail",
  });
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

export async function fetchCustomerDeploymentHistory(
  auth: AuthInput,
  siteId: string,
  options: { targetLang: string; limit?: number; offset?: number },
): Promise<CustomerDeploymentHistoryResponse> {
  const searchParams = new URLSearchParams({
    view: "customer",
    targetLang: options.targetLang,
  });
  if (typeof options.limit === "number") {
    searchParams.set("limit", String(options.limit));
  }
  if (typeof options.offset === "number") {
    searchParams.set("offset", String(options.offset));
  }
  return request({
    path: `/sites/${siteId}/deployments/history?${searchParams.toString()}`,
    auth,
    schema: customerDeploymentHistoryResponseSchema,
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

export async function fetchConsistencyCpm(
  auth: AuthInput,
  siteId: string,
  options: {
    targetLang: string;
    sourceLang?: string;
    status?: ConsistencyStatus[];
    limit?: number;
    offset?: number;
  },
): Promise<ConsistencyCpmListResponse> {
  const qs = new URLSearchParams();
  qs.set("targetLang", options.targetLang);
  if (options.sourceLang) {
    qs.set("sourceLang", options.sourceLang);
  }
  for (const status of options.status ?? []) {
    qs.append("status", status);
  }
  if (typeof options.limit === "number") {
    qs.set("limit", String(options.limit));
  }
  if (typeof options.offset === "number") {
    qs.set("offset", String(options.offset));
  }

  return request({
    path: `/sites/${siteId}/consistency/cpm?${qs.toString()}`,
    auth,
    schema: consistencyCpmListResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function upsertConsistencyCpm(
  auth: AuthInput,
  siteId: string,
  payload: {
    targetLang: string;
    sourceLang?: string;
    entries: Array<{
      contentId: string;
      targetText: string;
      status?: ConsistencyStatus;
      scope?: string;
    }>;
  },
) {
  return request({
    path: `/sites/${siteId}/consistency/cpm`,
    method: "PUT",
    auth,
    body: payload,
    schema: consistencyCpmUpsertResponseSchema,
  });
}

export async function fetchConsistencyBlocks(
  auth: AuthInput,
  siteId: string,
  options?: { status?: ConsistencyStatus[] },
): Promise<ConsistencyBlocksListResponse> {
  const qs = new URLSearchParams();
  for (const status of options?.status ?? []) {
    qs.append("status", status);
  }
  const path = qs.size
    ? `/sites/${siteId}/consistency/blocks?${qs.toString()}`
    : `/sites/${siteId}/consistency/blocks`;
  return request({
    path,
    auth,
    schema: consistencyBlocksListResponseSchema,
    timeoutProfile: "detail",
  });
}

export async function updateConsistencyBlock(
  auth: AuthInput,
  siteId: string,
  blockId: string,
  payload: {
    status?: ConsistencyStatus;
    mode?: ConsistencyBlockMode;
    members?: string[];
  },
) {
  return request({
    path: `/sites/${siteId}/consistency/blocks/${encodeURIComponent(blockId)}`,
    method: "PUT",
    auth,
    body: payload,
    schema: consistencyBlockUpdateResponseSchema,
  });
}

export async function fetchConsistencyOverrideHygiene(
  auth: AuthInput,
  siteId: string,
  options: {
    targetLang: string;
    sourceLang?: string;
    limit?: number;
    offset?: number;
  },
): Promise<ConsistencyOverrideHygieneResponse> {
  const qs = new URLSearchParams();
  qs.set("targetLang", options.targetLang);
  if (options.sourceLang) {
    qs.set("sourceLang", options.sourceLang);
  }
  if (typeof options.limit === "number") {
    qs.set("limit", String(options.limit));
  }
  if (typeof options.offset === "number") {
    qs.set("offset", String(options.offset));
  }

  return request({
    path: `/sites/${siteId}/consistency/override-hygiene?${qs.toString()}`,
    auth,
    schema: consistencyOverrideHygieneResponseSchema,
    timeoutProfile: "detail",
  });
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
