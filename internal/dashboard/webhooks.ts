import { z } from "zod";

import { env } from "@internal/core";

const apiBase = env.NEXT_PUBLIC_WEBHOOKS_API_BASE.replace(/\/$/, "");

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

const routeConfigSchema = z
  .object({
    sourceLang: z.string(),
    sourceOrigin: z.string(),
    pattern: z.string().nullable().optional(),
    locales: z.array(routeLocaleSchema),
  })
  .nullable();

const siteProfileSchema = z.record(z.unknown()).nullable();

const siteSchema = z.object({
  id: z.string(),
  sourceUrl: z.string(),
  status: z.enum(["active", "inactive"]),
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
      error: z.string().nullable().optional(),
      startedAt: z.string().nullable().optional(),
      finishedAt: z.string().nullable().optional(),
      createdAt: z.string().nullable().optional(),
      updatedAt: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const sitePageSummarySchema = z.object({
  id: z.string(),
  sourcePath: z.string(),
  lastSeenAt: z.string().nullable().optional(),
  lastVersionAt: z.string().nullable().optional(),
});

const crawlStatusSchema = z.object({
  enqueued: z.boolean(),
  error: z.string().optional(),
});

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

const artifactManifestSchema = z
  .union([z.string(), z.object({}).passthrough()])
  .nullable()
  .optional();

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
});

const glossaryEntrySchema = z.object({
  source: z.string(),
  target: z.string(),
  targetLangs: z.array(z.string()).optional(),
  matchType: z.string().optional(),
  caseSensitive: z.boolean().optional(),
  scope: z.enum(["segment", "in_segment"]).optional(),
});

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
    renderEnabled: z.boolean(),
    agencyActionsEnabled: z.boolean(),
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

export type Site = z.infer<typeof siteSchema>;
export type Domain = z.infer<typeof domainSchema>;
export type RouteConfig = z.infer<typeof routeConfigSchema>;
export type CrawlStatus = z.infer<typeof crawlStatusSchema>;
export type Deployment = z.infer<typeof deploymentSchema>;
export type TranslationRun = z.infer<typeof translationRunSchema>;
export type SitePageSummary = z.infer<typeof sitePageSummarySchema>;
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;
export type AccountMe = z.infer<typeof accountMeSchema>;
export type SupportedLanguage = z.infer<typeof supportedLanguageSchema>;
export type AgencyCustomer = z.infer<typeof agencyCustomerSchema>;
export type AgencyCustomersSummary = z.infer<typeof agencyCustomersSummarySchema>;
export type AgencyCustomersResponse = z.infer<typeof listAgencyCustomersResponseSchema>;
export type CreateAgencyCustomerResponse = z.infer<typeof createAgencyCustomerResponseSchema>;

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

type RequestOptions<T> = {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  auth?: AuthInput;
  body?: unknown;
  schema: z.ZodSchema<T>;
  headers?: HeadersInit;
  retry?: boolean;
  allowEmptyResponse?: boolean;
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
}: RequestOptions<T>): Promise<T> {
  const resolvedAuth = normalizeAuth(auth);
  const token = resolvedAuth?.token;
  const url = path.startsWith("http")
    ? path
    : `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (error) {
    throw new WebhooksApiError(
      "Unable to reach the WebLingo API. Check NEXT_PUBLIC_WEBHOOKS_API_BASE and that the webhooks worker is running.",
      0,
      error,
    );
  }

  const text = await response.text();
  const parsed = text ? safeParseJson(text) : undefined;

  if (!response.ok) {
    if (response.status === 401 && resolvedAuth?.refresh && !retry) {
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
        });
      } catch (refreshError) {
        console.warn("[webhooks] token refresh failed:", refreshError);
      }
    }
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
      return schema.parse(undefined);
    }
    throw new WebhooksApiError("Empty response from API", response.status);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error("[webhooks] response schema mismatch", {
      path,
      method,
      status: response.status,
      issues: result.error.issues,
    });
    throw result.error;
  }
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
  });
}

export async function fetchAccountMe(auth: AuthInput): Promise<AccountMe> {
  return request({
    path: "/accounts/me",
    auth,
    schema: accountMeSchema,
  });
}

export async function listAgencyCustomers(auth: AuthInput): Promise<AgencyCustomersResponse> {
  return request({
    path: "/agency/customers",
    auth,
    schema: listAgencyCustomersResponseSchema,
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
  });
}

export async function listSupportedLanguages(): Promise<SupportedLanguage[]> {
  try {
    const data = await request({
      path: "/meta/languages",
      schema: supportedLanguagesResponseSchema,
    });
    return data.languages;
  } catch (error) {
    console.warn("[webhooks] listSupportedLanguages failed; using fallback list:", error);
    return [...FALLBACK_SUPPORTED_LANGUAGES];
  }
}

export async function listSites(auth: AuthInput): Promise<Site[]> {
  const data = await request({
    path: "/sites",
    auth,
    schema: z.object({ sites: z.array(siteSchema) }),
  });

  return data.sites;
}

export async function fetchSite(auth: AuthInput, siteId: string): Promise<Site> {
  return request({
    path: `/sites/${siteId}`,
    auth,
    schema: siteSchema,
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
};

export async function createSite(auth: AuthInput, payload: CreateSitePayload) {
  return request({
    path: "/sites",
    method: "POST",
    auth,
    body: payload,
    schema: siteSchema.extend({ crawlStatus: crawlStatusSchema }).strict(),
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

export async function deleteSite(auth: AuthInput, siteId: string) {
  return request({
    path: `/sites/${siteId}`,
    method: "DELETE",
    auth,
    schema: z.void(),
    allowEmptyResponse: true,
  });
}

export async function triggerCrawl(
  auth: AuthInput,
  siteId: string,
  options?: { intent?: "translate_and_serve" },
) {
  const searchParams = new URLSearchParams();
  if (options?.intent) {
    searchParams.set("intent", options.intent);
  }
  return request({
    path: `/sites/${siteId}/crawl${searchParams.toString() ? `?${searchParams}` : ""}`,
    method: "POST",
    auth,
    schema: crawlStatusSchema,
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

export async function fetchTranslationRun(auth: AuthInput, siteId: string, runId: string) {
  const data = await request({
    path: `/sites/${siteId}/translation-runs/${runId}`,
    auth,
    schema: z.object({ run: translationRunSchema }).strict(),
  });
  return data.run;
}

export async function cancelTranslationRun(auth: AuthInput, siteId: string, runId: string) {
  const data = await request({
    path: `/sites/${siteId}/translation-runs/${runId}/cancel`,
    method: "POST",
    auth,
    schema: z.object({ run: translationRunSchema }).strict(),
  });
  return data.run;
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
    schema: z.object({ domain: domainSchema }),
  });
}

export async function provisionDomain(auth: AuthInput, siteId: string, domain: string) {
  return request({
    path: `/sites/${siteId}/domains/${encodeURIComponent(domain)}/provision`,
    method: "POST",
    auth,
    schema: z.object({ domain: domainSchema }),
  });
}

export async function refreshDomain(auth: AuthInput, siteId: string, domain: string) {
  return request({
    path: `/sites/${siteId}/domains/${encodeURIComponent(domain)}/refresh`,
    method: "POST",
    auth,
    schema: z.object({ domain: domainSchema }),
  });
}

export async function fetchDeployments(auth: AuthInput, siteId: string): Promise<Deployment[]> {
  const data = await request({
    path: `/sites/${siteId}/deployments`,
    auth,
    schema: z.object({ deployments: z.array(deploymentSchema) }),
  });

  return data.deployments;
}

export async function fetchSitePages(auth: AuthInput, siteId: string): Promise<SitePageSummary[]> {
  const data = await request({
    path: `/sites/${siteId}/pages`,
    auth,
    schema: listSitePagesResponseSchema,
  });

  return data.pages;
}

export async function fetchGlossary(auth: AuthInput, siteId: string): Promise<GlossaryEntry[]> {
  const data = await request({
    path: `/sites/${siteId}/glossary`,
    auth,
    schema: z.object({ entries: z.array(glossaryEntrySchema) }),
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
    schema: z
      .object({
        entries: z.array(glossaryEntrySchema),
        crawlStatus: crawlStatusSchema.nullable().optional(),
      })
      .strict(),
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
    schema: z
      .object({
        segmentId: z.string(),
        targetLang: z.string(),
        contextHashScope: z.string().nullable(),
      })
      .strict(),
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
    schema: z
      .object({
        pageId: z.string(),
        lang: z.string(),
        path: z.string(),
        crawlStatus: crawlStatusSchema,
      })
      .strict(),
  });
}
