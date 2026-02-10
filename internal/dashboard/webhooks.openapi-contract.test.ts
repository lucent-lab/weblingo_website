import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

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
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  vi.restoreAllMocks();
});

type OpenApiSpec = {
  paths?: Record<string, Record<string, unknown>>;
  components?: {
    schemas?: Record<string, unknown>;
  };
};

function buildOpenApiDefinitionsIndex(spec: OpenApiSpec): Map<string, unknown> {
  const index = new Map<string, unknown>();
  const schemas = spec.components?.schemas ?? {};
  for (const schema of Object.values(schemas)) {
    if (!schema || typeof schema !== "object") continue;
    const definitions = (schema as { definitions?: unknown }).definitions;
    if (!definitions || typeof definitions !== "object") continue;
    for (const [name, defSchema] of Object.entries(definitions as Record<string, unknown>)) {
      if (!index.has(name)) {
        index.set(name, defSchema);
      }
    }
  }
  return index;
}

function readOpenApiSpecFromEnv(): OpenApiSpec | null {
  const envPath = process.env.WEBHOOKS_OPENAPI_JSON_PATH;
  if (!envPath) {
    return null;
  }

  const absPath = resolve(process.cwd(), envPath);
  if (!existsSync(absPath)) {
    throw new Error(
      `[contracts] WEBHOOKS_OPENAPI_JSON_PATH is set but file is missing: ${absPath}`,
    );
  }

  return JSON.parse(readFileSync(absPath, "utf8")) as OpenApiSpec;
}

function resolveOpenApiRef(
  spec: OpenApiSpec,
  definitionsIndex: Map<string, unknown>,
  schema: unknown,
): unknown {
  if (!schema || typeof schema !== "object") {
    return schema;
  }
  const ref = (schema as { $ref?: unknown }).$ref;
  if (typeof ref !== "string") {
    return schema;
  }

  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  if (!match) {
    throw new Error(`[contracts] Unsupported OpenAPI $ref: ${ref}`);
  }
  const name = match[1];
  const resolved = spec.components?.schemas?.[name];
  if (resolved) {
    return resolved;
  }

  const fromDefinitions = definitionsIndex.get(name);
  if (fromDefinitions) {
    return fromDefinitions;
  }

  throw new Error(`[contracts] OpenAPI ref not found: ${ref}`);
}

function normalizeOpenApiSchema(
  spec: OpenApiSpec,
  definitionsIndex: Map<string, unknown>,
  schema: unknown,
): unknown {
  const resolved = resolveOpenApiRef(spec, definitionsIndex, schema);
  if (!resolved || typeof resolved !== "object") {
    return resolved;
  }

  const type = (resolved as { type?: unknown }).type;
  if (Array.isArray(type)) {
    // OpenAPI 3.1 can express nullable types as `type: ["string", "null"]`.
    return { ...resolved, type: type.filter((t) => t !== "null") };
  }

  return resolved;
}

function openApiHasPath(
  spec: OpenApiSpec,
  definitionsIndex: Map<string, unknown>,
  schema: unknown,
  path: string[],
): boolean {
  if (path.length === 0) {
    return true;
  }

  const normalized = normalizeOpenApiSchema(spec, definitionsIndex, schema);
  if (!normalized || typeof normalized !== "object") {
    return false;
  }

  const anyOf = (normalized as { anyOf?: unknown }).anyOf;
  if (Array.isArray(anyOf)) {
    return anyOf.some((sub) => openApiHasPath(spec, definitionsIndex, sub, path));
  }
  const oneOf = (normalized as { oneOf?: unknown }).oneOf;
  if (Array.isArray(oneOf)) {
    return oneOf.some((sub) => openApiHasPath(spec, definitionsIndex, sub, path));
  }
  const allOf = (normalized as { allOf?: unknown }).allOf;
  if (Array.isArray(allOf)) {
    return allOf.some((sub) => openApiHasPath(spec, definitionsIndex, sub, path));
  }

  const [head, ...tail] = path;
  if (head === "*") {
    const items = (normalized as { items?: unknown }).items;
    if (!items) {
      return false;
    }
    return openApiHasPath(spec, definitionsIndex, items, tail);
  }

  const properties = (normalized as { properties?: Record<string, unknown> }).properties;
  if (!properties || typeof properties !== "object") {
    return false;
  }
  if (!(head in properties)) {
    return false;
  }

  return openApiHasPath(spec, definitionsIndex, properties[head], tail);
}

function unwrapZod(schema: unknown): unknown {
  let current: unknown = schema;
  // Zod v4 wrappers expose `.unwrap()`; unwrap as many as possible so we can inspect shapes.
  while (current && typeof current === "object") {
    const type = (current as { type?: unknown }).type;
    const unwrap = (current as { unwrap?: unknown }).unwrap;
    const isWrapper =
      type === "optional" ||
      type === "nullable" ||
      type === "default" ||
      type === "prefault" ||
      type === "catch";
    if (!isWrapper || typeof unwrap !== "function") {
      break;
    }
    current = (unwrap as () => unknown)();
  }
  return current;
}

function collectZodPaths(schema: unknown, prefix: string[] = [], out: string[][] = []): string[][] {
  const unwrapped = unwrapZod(schema);
  if (!unwrapped || typeof unwrapped !== "object") {
    return out;
  }

  const type = (unwrapped as { type?: unknown }).type;
  if (type === "object") {
    const shapeValue = (unwrapped as { def?: { shape?: unknown } }).def?.shape;
    if (!shapeValue || typeof shapeValue !== "object") {
      return out;
    }
    for (const [key, child] of Object.entries(shapeValue as Record<string, unknown>)) {
      const next = [...prefix, key];
      out.push(next);
      collectZodPaths(child, next, out);
    }
    return out;
  }

  if (type === "array") {
    const element = (unwrapped as { def?: { element?: unknown } }).def?.element;
    if (!element) {
      return out;
    }
    collectZodPaths(element, [...prefix, "*"], out);
    return out;
  }

  if (type === "union") {
    const options = (unwrapped as { def?: { options?: unknown } }).def?.options;
    if (Array.isArray(options)) {
      for (const option of options) {
        collectZodPaths(option, prefix, out);
      }
    }
    return out;
  }

  return out;
}

function uniquePaths(paths: string[][]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const path of paths) {
    const key = path.join(".");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(path);
  }
  return out;
}

describe("webhooks OpenAPI contract (dashboard client)", () => {
  it("matches the backend OpenAPI paths and response shapes", async () => {
    const spec = readOpenApiSpecFromEnv();
    if (!spec) {
      // This runs in CI only when the backend repo is checked out.
      return;
    }
    const definitionsIndex = buildOpenApiDefinitionsIndex(spec);

    vi.resetModules();
    const { __webhooksZodContracts } = await import("./webhooks");

    const requiredPaths: Array<{
      path: string;
      method: "get" | "post" | "patch" | "put" | "delete";
    }> = [
      { path: "/meta/languages", method: "get" },
      { path: "/auth/token", method: "post" },
      { path: "/dashboard/bootstrap", method: "post" },
      { path: "/accounts/me", method: "get" },
      { path: "/agency/customers", method: "get" },
      { path: "/agency/customers", method: "post" },
      { path: "/sites", method: "get" },
      { path: "/sites", method: "post" },
      { path: "/sites/{siteId}", method: "get" },
      { path: "/sites/{siteId}", method: "patch" },
      { path: "/sites/{siteId}/crawl", method: "post" },
      { path: "/sites/{siteId}/translate", method: "post" },
      { path: "/sites/{siteId}/locales/{targetLang}/serve", method: "post" },
      { path: "/sites/{siteId}/translation-runs/{runId}", method: "get" },
      { path: "/sites/{siteId}/translation-runs/{runId}/cancel", method: "post" },
      { path: "/sites/{siteId}/translation-runs/{runId}/resume", method: "post" },
      { path: "/sites/{siteId}/pages/{pageId}/crawl", method: "post" },
      { path: "/sites/{siteId}/domains/{domain}/verify", method: "post" },
      { path: "/sites/{siteId}/domains/{domain}/provision", method: "post" },
      { path: "/sites/{siteId}/domains/{domain}/refresh", method: "post" },
      { path: "/sites/{siteId}/deployments", method: "get" },
      { path: "/sites/{siteId}/pages", method: "get" },
      { path: "/sites/{siteId}/glossary", method: "get" },
      { path: "/sites/{siteId}/glossary", method: "put" },
      { path: "/sites/{siteId}/overrides", method: "post" },
      { path: "/sites/{siteId}/slugs", method: "post" },
    ];

    for (const item of requiredPaths) {
      expect(spec.paths).toBeTruthy();
      expect(spec.paths?.[item.path]).toBeTruthy();
      expect(Object.keys(spec.paths?.[item.path] ?? {})).toContain(item.method);
    }

    const requiredSchemas: Array<{ name: string; schema: unknown }> = [
      {
        name: "ListSupportedLanguagesResponse",
        schema: __webhooksZodContracts.supportedLanguagesResponseSchema,
      },
      { name: "AuthTokenResponse", schema: __webhooksZodContracts.authResponseSchema },
      {
        name: "DashboardBootstrapResponse",
        schema: __webhooksZodContracts.dashboardBootstrapResponseSchema,
      },
      { name: "AccountMeResponse", schema: __webhooksZodContracts.accountMeSchema },
      {
        name: "ListAgencyCustomersResponse",
        schema: __webhooksZodContracts.listAgencyCustomersResponseSchema,
      },
      {
        name: "CreateAgencyCustomerResponse",
        schema: __webhooksZodContracts.createAgencyCustomerResponseSchema,
      },
      { name: "ListSitesResponse", schema: __webhooksZodContracts.listSitesResponseSchema },
      { name: "Site", schema: __webhooksZodContracts.siteSchema },
      { name: "SiteWithCrawlStatus", schema: __webhooksZodContracts.siteWithCrawlStatusSchema },
      { name: "CrawlStatus", schema: __webhooksZodContracts.crawlStatusSchema },
      { name: "TranslateSiteResponse", schema: __webhooksZodContracts.translateSiteResponseSchema },
      {
        name: "SetLocaleServingResponse",
        schema: __webhooksZodContracts.setLocaleServingResponseSchema,
      },
      {
        name: "TranslationRunResponse",
        schema: __webhooksZodContracts.translationRunResponseSchema,
      },
      {
        name: "CancelTranslationRunResponse",
        schema: __webhooksZodContracts.translationRunResponseSchema,
      },
      {
        name: "ResumeTranslationRunResponse",
        schema: __webhooksZodContracts.resumeTranslationRunResponseSchema,
      },
      { name: "VerifyDomainResponse", schema: __webhooksZodContracts.domainResponseSchema },
      { name: "ProvisionDomainResponse", schema: __webhooksZodContracts.domainResponseSchema },
      { name: "RefreshDomainResponse", schema: __webhooksZodContracts.domainResponseSchema },
      {
        name: "ListDeploymentsResponse",
        schema: __webhooksZodContracts.listDeploymentsResponseSchema,
      },
      { name: "ListSitePagesResponse", schema: __webhooksZodContracts.listSitePagesResponseSchema },
      { name: "GlossaryResponse", schema: __webhooksZodContracts.upsertGlossaryResponseSchema },
      {
        name: "CreateOverrideResponse",
        schema: __webhooksZodContracts.createOverrideResponseSchema,
      },
      { name: "SetSlugResponse", schema: __webhooksZodContracts.setSlugResponseSchema },
    ];

    expect(spec.components?.schemas).toBeTruthy();
    for (const { name, schema } of requiredSchemas) {
      const openApiSchema = spec.components?.schemas?.[name];
      expect(openApiSchema).toBeTruthy();
      const paths = uniquePaths(collectZodPaths(schema));
      for (const path of paths) {
        expect(openApiHasPath(spec, definitionsIndex, openApiSchema, path)).toBe(true);
      }
    }
  });
});
