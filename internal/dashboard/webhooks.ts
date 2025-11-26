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

const domainSchema = z.object({
  domain: z.string(),
  status: z.enum(["pending", "verified", "failed"]),
  verificationToken: z.string(),
  verifiedAt: z.string().nullable().optional(),
  lastCheckedAt: z.string().nullable().optional(),
});

const routeLocaleSchema = z.object({
  lang: z.string(),
  origin: z.string().optional(),
  routePrefix: z.string().optional(),
});

const routeConfigSchema = z
  .object({
    sourceLang: z.string(),
    sourceOrigin: z.string().optional(),
    pattern: z.string(),
    locales: z.array(routeLocaleSchema),
  })
  .nullable();

const siteProfileSchema = z
  .record(z.any())
  .refine((value) => value === null || Object.keys(value).length > 0, {
    message: "siteProfile must be a non-empty object or null",
  })
  .nullable();

const siteSchema = z.object({
  id: z.string(),
  sourceUrl: z.string(),
  status: z.enum(["active", "inactive"]),
  sitePlan: z.enum(["starter", "pro"]),
  maxLocales: z.number().int().positive().nullable(),
  siteProfile: siteProfileSchema,
  locales: z.array(
    z.object({
      sourceLang: z.string(),
      targetLang: z.string(),
    }),
  ),
  routeConfig: routeConfigSchema,
  domains: z.array(domainSchema),
});

const crawlStatusSchema = z.object({
  enqueued: z.boolean(),
  error: z.string().optional(),
});

const deploymentSchema = z.object({
  targetLang: z.string(),
  status: z.enum(["publishing", "active", "failed", "unknown"]),
  deploymentId: z.string(),
  activatedAt: z.string().nullable().optional(),
  routePrefix: z.string().nullable().optional(),
  artifactManifest: z.unknown().optional(),
  activeDeploymentId: z.string().nullable().optional(),
});

const glossaryEntrySchema = z.object({
  source: z.string(),
  target: z.string(),
  targetLangs: z.array(z.string()).optional(),
  matchType: z.string().optional(),
  caseSensitive: z.boolean().optional(),
});

const authResponseSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T[^ ]+Z$/)),
});

export type Site = z.infer<typeof siteSchema>;
export type Domain = z.infer<typeof domainSchema>;
export type RouteConfig = z.infer<typeof routeConfigSchema>;
export type CrawlStatus = z.infer<typeof crawlStatusSchema>;
export type Deployment = z.infer<typeof deploymentSchema>;
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

type RequestOptions<T> = {
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  schema: z.ZodSchema<T>;
  headers?: HeadersInit;
};

async function request<T>({
  path,
  method = "GET",
  token,
  body,
  schema,
  headers,
}: RequestOptions<T>): Promise<T> {
  const url = path.startsWith("http") ? path : `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  const parsed = text ? safeParseJson(text) : undefined;

  if (!response.ok) {
    const parsedError = parsed ? errorResponseSchema.safeParse(parsed) : null;
    const message =
      parsedError?.success && parsedError.data.error
        ? parsedError.data.error
        : `Request failed with status ${response.status}`;
    const details = parsedError?.success ? parsedError.data.details : parsed ?? undefined;
    throw new WebhooksApiError(message, response.status, details);
  }

  if (parsed === undefined) {
    throw new WebhooksApiError("Empty response from API", response.status);
  }

  return schema.parse(parsed);
}

function safeParseJson(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}

export async function exchangeWebhooksToken(
  supabaseAccessToken: string,
): Promise<{ token: string; expiresAt: string }> {
  return request({
    path: "/auth/token",
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAccessToken}`,
    },
    schema: authResponseSchema,
  });
}

export async function listSites(token: string): Promise<Site[]> {
  const data = await request({
    path: "/sites",
    token,
    schema: z.object({ sites: z.array(siteSchema) }),
  });

  return data.sites;
}

export async function fetchSite(token: string, siteId: string): Promise<Site> {
  return request({
    path: `/sites/${siteId}`,
    token,
    schema: siteSchema,
  });
}

export type CreateSitePayload = {
  sourceUrl: string;
  sourceLang: string;
  targetLangs: string[];
  subdomainPattern: string;
  siteProfile: Record<string, unknown>;
  sitePlan?: "starter" | "pro";
  maxLocales?: number | null;
};

export async function createSite(token: string, payload: CreateSitePayload) {
  return request({
    path: "/sites",
    method: "POST",
    token,
    body: payload,
    schema: siteSchema.extend({ crawlStatus: crawlStatusSchema }).strict(),
  });
}

export async function updateSite(
  token: string,
  siteId: string,
  payload: Partial<Omit<CreateSitePayload, "targetLangs">> & { targetLangs?: string[]; status?: "active" | "inactive" },
) {
  return request({
    path: `/sites/${siteId}`,
    method: "PATCH",
    token,
    body: payload,
    schema: siteSchema,
  });
}

export async function triggerCrawl(token: string, siteId: string) {
  return request({
    path: `/sites/${siteId}/crawl`,
    method: "POST",
    token,
    schema: crawlStatusSchema,
  });
}

export async function verifyDomain(token: string, siteId: string, domain: string, overrideToken?: string) {
  return request({
    path: `/sites/${siteId}/domains/${encodeURIComponent(domain)}/verify`,
    method: "POST",
    token,
    body: overrideToken ? { token: overrideToken, env: "test" } : undefined,
    schema: z.object({ domain: domainSchema }),
  });
}

export async function fetchDeployments(token: string, siteId: string): Promise<Deployment[]> {
  const data = await request({
    path: `/sites/${siteId}/deployments`,
    token,
    schema: z.object({ deployments: z.array(deploymentSchema) }),
  });

  return data.deployments;
}

export async function fetchGlossary(token: string, siteId: string): Promise<GlossaryEntry[]> {
  const data = await request({
    path: `/sites/${siteId}/glossary`,
    token,
    schema: z.object({ entries: z.array(glossaryEntrySchema) }),
  });

  return data.entries;
}

export async function updateGlossary(
  token: string,
  siteId: string,
  entries: GlossaryEntry[],
  retranslate?: boolean,
) {
  return request({
    path: `/sites/${siteId}/glossary`,
    method: "PUT",
    token,
    body: { entries, retranslate },
    schema: z
      .object({
        entries: z.array(glossaryEntrySchema),
        crawlStatus: crawlStatusSchema.optional(),
      })
      .strict(),
  });
}

export async function createOverride(
  token: string,
  siteId: string,
  payload: { segmentId: string; targetLang: string; text: string; contextHashScope?: string },
) {
  return request({
    path: `/sites/${siteId}/overrides`,
    method: "POST",
    token,
    body: payload,
    schema: z
      .object({
        segmentId: z.string(),
        targetLang: z.string(),
        contextHashScope: z.string().optional(),
      })
      .strict(),
  });
}

export async function updateSlug(
  token: string,
  siteId: string,
  payload: { pageId: string; lang: string; path: string },
) {
  return request({
    path: `/sites/${siteId}/slugs`,
    method: "POST",
    token,
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
