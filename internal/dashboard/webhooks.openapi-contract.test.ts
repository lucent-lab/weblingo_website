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

const DEFAULT_OPENAPI_SPEC_PATH = "content/docs/_generated/backend-openapi.snapshot.json";

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

function readOpenApiSpecFromEnv(): OpenApiSpec {
  const configuredPath =
    process.env.WEBHOOKS_OPENAPI_JSON_PATH?.trim() || DEFAULT_OPENAPI_SPEC_PATH;
  const absPath = resolve(process.cwd(), configuredPath);
  if (!existsSync(absPath)) {
    throw new Error(
      `[contracts] OpenAPI spec file is missing: ${absPath}. Run WEBLINGO_REPO_PATH=/path/to/weblingo pnpm docs:sync`,
    );
  }

  return JSON.parse(readFileSync(absPath, "utf8")) as OpenApiSpec;
}

function resolveOpenApiRef(
  spec: OpenApiSpec,
  definitionsIndex: Map<string, unknown>,
  schema: unknown,
): unknown {
  let current = schema;
  const seen = new Set<string>();

  while (current && typeof current === "object") {
    const ref = (current as { $ref?: unknown }).$ref;
    if (typeof ref !== "string") {
      return current;
    }
    if (seen.has(ref)) {
      throw new Error(`[contracts] Cyclic OpenAPI $ref: ${ref}`);
    }
    seen.add(ref);

    const match = ref.match(/^#\/components\/schemas\/(.+)$/);
    if (!match) {
      throw new Error(`[contracts] Unsupported OpenAPI $ref: ${ref}`);
    }
    const name = match[1];
    const resolved = spec.components?.schemas?.[name] ?? definitionsIndex.get(name);
    if (!resolved) {
      throw new Error(`[contracts] OpenAPI ref not found: ${ref}`);
    }
    current = resolved;
  }

  return current;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeStringArrays(left: unknown, right: unknown): string[] | undefined {
  const leftStrings = Array.isArray(left)
    ? left.filter((v): v is string => typeof v === "string")
    : [];
  const rightStrings = Array.isArray(right)
    ? right.filter((v): v is string => typeof v === "string")
    : [];
  const merged = Array.from(new Set([...leftStrings, ...rightStrings]));
  return merged.length ? merged : undefined;
}

function mergeOpenApiSchemaObjects(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...left, ...right };

  const leftProps = left.properties;
  const rightProps = right.properties;
  if (isPlainObject(leftProps) || isPlainObject(rightProps)) {
    const mergedProps: Record<string, unknown> = {
      ...(isPlainObject(leftProps) ? leftProps : {}),
      ...(isPlainObject(rightProps) ? rightProps : {}),
    };
    if (isPlainObject(leftProps) && isPlainObject(rightProps)) {
      for (const key of Object.keys(leftProps)) {
        if (key in rightProps) {
          mergedProps[key] = { allOf: [leftProps[key], rightProps[key]] };
        }
      }
    }
    out.properties = mergedProps;
  }

  const required = mergeStringArrays(left.required, right.required);
  if (required) {
    out.required = required;
  }

  const leftItems = left.items;
  const rightItems = right.items;
  if (leftItems && rightItems) {
    out.items = { allOf: [leftItems, rightItems] };
  } else if (rightItems) {
    out.items = rightItems;
  } else if (leftItems) {
    out.items = leftItems;
  }

  return out;
}

function flattenAllOf(
  spec: OpenApiSpec,
  definitionsIndex: Map<string, unknown>,
  schema: unknown,
): unknown {
  const normalized = normalizeOpenApiSchema(spec, definitionsIndex, schema);
  if (!isPlainObject(normalized)) {
    return normalized;
  }

  const allOf = normalized.allOf;
  if (!Array.isArray(allOf)) {
    return normalized;
  }

  const base: Record<string, unknown> = { ...normalized };
  delete base.allOf;

  let merged = base;
  for (const sub of allOf) {
    const subFlattened = flattenAllOf(spec, definitionsIndex, sub);
    if (!isPlainObject(subFlattened)) {
      continue;
    }
    merged = mergeOpenApiSchemaObjects(merged, subFlattened);
  }
  return merged;
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
    return openApiHasPath(
      spec,
      definitionsIndex,
      flattenAllOf(spec, definitionsIndex, normalized),
      path,
    );
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

function collectOpenApiRequiredPaths(
  spec: OpenApiSpec,
  definitionsIndex: Map<string, unknown>,
  schema: unknown,
  prefix: string[] = [],
  out: string[][] = [],
): string[][] {
  const normalized = flattenAllOf(spec, definitionsIndex, schema);
  if (!normalized || typeof normalized !== "object") {
    return out;
  }

  const anyOf = (normalized as { anyOf?: unknown }).anyOf;
  const oneOf = (normalized as { oneOf?: unknown }).oneOf;
  if (Array.isArray(anyOf) || Array.isArray(oneOf)) {
    return out;
  }

  const type = (normalized as { type?: unknown }).type;
  const items = (normalized as { items?: unknown }).items;
  if ((type === "array" || items) && items) {
    collectOpenApiRequiredPaths(spec, definitionsIndex, items, [...prefix, "*"], out);
    return out;
  }

  const properties = (normalized as { properties?: Record<string, unknown> }).properties;
  const required = (normalized as { required?: unknown }).required;
  if (!properties || typeof properties !== "object" || !Array.isArray(required)) {
    return out;
  }

  for (const key of required.filter((value): value is string => typeof value === "string")) {
    const next = [...prefix, key];
    out.push(next);
    collectOpenApiRequiredPaths(spec, definitionsIndex, properties[key], next, out);
  }
  return out;
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

function pathKey(path: readonly string[]): string {
  return path.join(".");
}

describe("webhooks OpenAPI contract (dashboard client)", () => {
  it("merges allOf branches when checking for paths", () => {
    const spec: OpenApiSpec = {};
    const definitionsIndex = new Map<string, unknown>();
    const schema = {
      allOf: [{ type: "object", properties: { a: { type: "object" } } }],
      type: "object",
      properties: { a: { type: "object", properties: { b: { type: "string" } } } },
    };

    expect(openApiHasPath(spec, definitionsIndex, schema, ["a", "b"])).toBe(true);
  });

  it("matches the backend OpenAPI paths and response shapes", async () => {
    const spec = readOpenApiSpecFromEnv();
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
      { path: "/agency/customers/{customerAccountId}", method: "patch" },
      { path: "/admin/accounts", method: "get" },
      { path: "/admin/accounts/{accountId}", method: "get" },
      { path: "/admin/accounts/{accountId}", method: "patch" },
      { path: "/admin/managed-demos", method: "get" },
      { path: "/admin/managed-demos", method: "post" },
      { path: "/digests/subscription", method: "put" },
      { path: "/sites", method: "get" },
      { path: "/sites", method: "post" },
      { path: "/sites/{siteId}", method: "get" },
      { path: "/sites/{siteId}", method: "patch" },
      { path: "/sites/{siteId}/dashboard", method: "get" },
      { path: "/sites/{siteId}/status", method: "get" },
      { path: "/sites/{siteId}/errors/summary", method: "get" },
      { path: "/sites/{siteId}/source-selection/preview", method: "post" },
      { path: "/sites/{siteId}/source-selection/tree-preview", method: "post" },
      { path: "/sites/{siteId}/runtime-requests/observations", method: "get" },
      { path: "/sites/{siteId}/runtime-requests/observations/{groupHash}", method: "patch" },
      { path: "/sites/{siteId}/runtime-request-policy/preview", method: "post" },
      { path: "/sites/{siteId}/showcase", method: "get" },
      { path: "/sites/{siteId}/showcase", method: "post" },
      { path: "/sites/{siteId}/showcase", method: "patch" },
      { path: "/sites/{siteId}/crawl", method: "post" },
      { path: "/sites/{siteId}/crawl-translate", method: "post" },
      { path: "/sites/{siteId}/translate", method: "post" },
      { path: "/sites/{siteId}/locales/{targetLang}/serve", method: "post" },
      { path: "/sites/{siteId}/locales/{targetLang}/translation-summary", method: "put" },
      { path: "/sites/{siteId}/translation-runs", method: "get" },
      { path: "/sites/{siteId}/translation-runs/{runId}", method: "get" },
      { path: "/sites/{siteId}/translation-runs/{runId}/cancel", method: "post" },
      { path: "/sites/{siteId}/translation-runs/{runId}/resume", method: "post" },
      { path: "/sites/{siteId}/translation-summaries", method: "get" },
      { path: "/sites/{siteId}/switcher-snippets", method: "get" },
      { path: "/sites/{siteId}/pages/{pageId}/crawl", method: "post" },
      { path: "/sites/{siteId}/domains/{domain}/verify", method: "post" },
      { path: "/sites/{siteId}/domains/{domain}/provision", method: "post" },
      { path: "/sites/{siteId}/domains/{domain}/refresh", method: "post" },
      { path: "/sites/{siteId}/deployments", method: "get" },
      { path: "/sites/{siteId}/deployments/history", method: "get" },
      { path: "/sites/{siteId}/consistency/cpm", method: "get" },
      { path: "/sites/{siteId}/consistency/cpm", method: "put" },
      { path: "/sites/{siteId}/consistency/blocks", method: "get" },
      { path: "/sites/{siteId}/consistency/blocks/{blockId}", method: "put" },
      { path: "/sites/{siteId}/consistency/override-hygiene", method: "get" },
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
      {
        name: "UpdateAgencyCustomerResponse",
        schema: __webhooksZodContracts.updateAgencyCustomerResponseSchema,
      },
      {
        name: "ListAdminAccountsResponse",
        schema: __webhooksZodContracts.listAdminAccountsResponseSchema,
      },
      {
        name: "GetAdminAccountResponse",
        schema: __webhooksZodContracts.getAdminAccountResponseSchema,
      },
      {
        name: "UpdateAdminAccountResponse",
        schema: __webhooksZodContracts.updateAdminAccountResponseSchema,
      },
      {
        name: "ListManagedDemoSitesResponse",
        schema: __webhooksZodContracts.listManagedDemoSitesResponseSchema,
      },
      {
        name: "CreateManagedDemoSiteResponse",
        schema: __webhooksZodContracts.createManagedDemoSiteResponseSchema,
      },
      {
        name: "SiteShowcaseResponse",
        schema: __webhooksZodContracts.siteShowcaseResponseSchema,
      },
      {
        name: "DigestSubscriptionResponse",
        schema: __webhooksZodContracts.upsertDigestSubscriptionResponseSchema,
      },
      { name: "ListSitesResponse", schema: __webhooksZodContracts.listSitesResponseSchema },
      { name: "Site", schema: __webhooksZodContracts.siteSchema },
      { name: "SiteWithCrawlStatus", schema: __webhooksZodContracts.siteWithCrawlStatusSchema },
      { name: "CrawlStatus", schema: __webhooksZodContracts.crawlStatusSchema },
      {
        name: "CrawlTranslateResponse",
        schema: __webhooksZodContracts.crawlTranslateResponseSchema,
      },
      { name: "TranslateSiteResponse", schema: __webhooksZodContracts.translateSiteResponseSchema },
      {
        name: "SetLocaleServingResponse",
        schema: __webhooksZodContracts.setLocaleServingResponseSchema,
      },
      {
        name: "SetTranslationSummaryPreferenceResponse",
        schema: __webhooksZodContracts.setTranslationSummaryPreferenceResponseSchema,
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
      {
        name: "ListDeploymentHistoryResponse",
        schema: __webhooksZodContracts.listDeploymentHistoryResponseSchema,
      },
      {
        name: "ConsistencyCpmListResponse",
        schema: __webhooksZodContracts.consistencyCpmListResponseSchema,
      },
      {
        name: "ConsistencyCpmUpsertResponse",
        schema: __webhooksZodContracts.consistencyCpmUpsertResponseSchema,
      },
      {
        name: "ConsistencyBlocksListResponse",
        schema: __webhooksZodContracts.consistencyBlocksListResponseSchema,
      },
      {
        name: "ConsistencyBlockUpdateResponse",
        schema: __webhooksZodContracts.consistencyBlockUpdateResponseSchema,
      },
      {
        name: "ConsistencyOverrideHygieneResponse",
        schema: __webhooksZodContracts.consistencyOverrideHygieneResponseSchema,
      },
      {
        name: "ListTranslationSummariesResponse",
        schema: __webhooksZodContracts.listTranslationSummariesResponseSchema,
      },
      {
        name: "LanguageSwitcherSnippetsResponse",
        schema: __webhooksZodContracts.languageSwitcherSnippetsResponseSchema,
      },
      { name: "ListSitePagesResponse", schema: __webhooksZodContracts.listSitePagesResponseSchema },
      { name: "SiteDashboardResponse", schema: __webhooksZodContracts.siteDashboardResponseSchema },
      {
        name: "SiteDashboardRouteResponse",
        schema: __webhooksZodContracts.siteDashboardRouteResponseSchema,
      },
      {
        name: "SiteCustomerOverviewResponse",
        schema: __webhooksZodContracts.siteCustomerOverviewResponseSchema,
      },
      {
        name: "SiteLanguagesProjectionResponse",
        schema: __webhooksZodContracts.siteLanguagesProjectionResponseSchema,
      },
      {
        name: "SiteDomainsProjectionResponse",
        schema: __webhooksZodContracts.siteDomainsProjectionResponseSchema,
      },
      {
        name: "SiteSettingsProjectionResponse",
        schema: __webhooksZodContracts.siteSettingsProjectionResponseSchema,
      },
      {
        name: "SiteDeveloperToolsProjectionResponse",
        schema: __webhooksZodContracts.siteDeveloperToolsProjectionResponseSchema,
      },
      {
        name: "SiteSourceSelectionProjectionResponse",
        schema: __webhooksZodContracts.siteSourceSelectionProjectionResponseSchema,
      },
      {
        name: "SiteQualityProjectionResponse",
        schema: __webhooksZodContracts.siteQualityProjectionResponseSchema,
      },
      {
        name: "SiteCompactStatusResponse",
        schema: __webhooksZodContracts.siteCompactStatusResponseSchema,
      },
      {
        name: "CustomerErrorSummaryResponse",
        schema: __webhooksZodContracts.customerErrorSummaryResponseSchema,
      },
      {
        name: "CustomerTranslationRunsResponse",
        schema: __webhooksZodContracts.customerTranslationRunsResponseSchema,
      },
      {
        name: "DeploymentHistoryRouteResponse",
        schema: __webhooksZodContracts.deploymentHistoryRouteResponseSchema,
      },
      {
        name: "CustomerDeploymentHistoryResponse",
        schema: __webhooksZodContracts.customerDeploymentHistoryResponseSchema,
      },
      {
        name: "SourceSelectionPreviewResponse",
        schema: __webhooksZodContracts.sourceSelectionPreviewResponseSchema,
      },
      {
        name: "SourceSelectionTreePreviewResponse",
        schema: __webhooksZodContracts.sourceSelectionTreePreviewResponseSchema,
      },
      {
        name: "RuntimeRequestObservationGroupsResponse",
        schema: __webhooksZodContracts.runtimeRequestObservationGroupsResponseSchema,
      },
      {
        name: "RuntimeRequestPolicyPreviewResponse",
        schema: __webhooksZodContracts.runtimeRequestPolicyPreviewResponseSchema,
      },
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
        const hasPath = openApiHasPath(spec, definitionsIndex, openApiSchema, path);
        expect(hasPath, `[contracts] ${name} missing OpenAPI path: ${path.join(".")}`).toBe(true);
      }
    }
  });

  it("fails when required backend dashboard contract fields are missing from website schemas", async () => {
    const spec = readOpenApiSpecFromEnv();
    const definitionsIndex = buildOpenApiDefinitionsIndex(spec);

    vi.resetModules();
    const { __webhooksZodContracts } = await import("./webhooks");
    const mirroredSchemas: Array<{ name: string; schema: unknown }> = [
      {
        name: "SourceSelectionPreviewResponse",
        schema: __webhooksZodContracts.sourceSelectionPreviewResponseSchema,
      },
      {
        name: "SourceSelectionTreePreviewResponse",
        schema: __webhooksZodContracts.sourceSelectionTreePreviewResponseSchema,
      },
      {
        name: "SiteCustomerOverviewResponse",
        schema: __webhooksZodContracts.siteCustomerOverviewResponseSchema,
      },
      {
        name: "SiteCompactStatusResponse",
        schema: __webhooksZodContracts.siteCompactStatusResponseSchema,
      },
      {
        name: "CustomerErrorSummaryResponse",
        schema: __webhooksZodContracts.customerErrorSummaryResponseSchema,
      },
      {
        name: "CustomerTranslationRunsResponse",
        schema: __webhooksZodContracts.customerTranslationRunsResponseSchema,
      },
      {
        name: "CustomerDeploymentHistoryResponse",
        schema: __webhooksZodContracts.customerDeploymentHistoryResponseSchema,
      },
    ];

    for (const { name, schema } of mirroredSchemas) {
      const openApiSchema = spec.components?.schemas?.[name];
      expect(openApiSchema).toBeTruthy();
      const zodPathKeys = new Set(uniquePaths(collectZodPaths(schema)).map(pathKey));
      const requiredPaths = uniquePaths(
        collectOpenApiRequiredPaths(spec, definitionsIndex, openApiSchema),
      );
      for (const path of requiredPaths) {
        expect(
          zodPathKeys.has(pathKey(path)),
          `[contracts] ${name} required OpenAPI field is not accepted by website schema: ${path.join(
            ".",
          )}`,
        ).toBe(true);
      }
    }
  });

  it("accepts customer translation runs with complete customer-safe error summaries", async () => {
    vi.resetModules();
    const { __webhooksZodContracts } = await import("./webhooks");

    const parsed = __webhooksZodContracts.customerTranslationRunsResponseSchema.parse({
      runs: [
        {
          id: "tr-failed",
          targetLang: "fr",
          rawStatus: "failed",
          customerStatus: "failed",
          progress: { completed: 2, total: 4, failed: 1 },
          startedAt: null,
          finishedAt: "2026-05-06T00:02:00.000Z",
          createdAt: "2026-05-06T00:00:00.000Z",
          updatedAt: "2026-05-06T00:01:00.000Z",
          customerError: {
            id: "translation_run_failed:tr-failed",
            area: "translation",
            severity: "danger",
            code: "translation_run_failed",
            titleKey: "dashboard.errors.translationRunFailed.title",
            descriptionKey: "dashboard.errors.translationRunFailed.description",
            lastSeenAt: "2026-05-06T00:02:00.000Z",
          },
        },
      ],
      pagination: { limit: 10, offset: 0, nextOffset: null },
      generatedAt: "2026-05-07T00:00:00.000Z",
    });

    expect(parsed.runs[0]?.customerError?.area).toBe("translation");
  });

  it("accepts customer-safe error summaries on the other dashboard surfaces", async () => {
    vi.resetModules();
    const { __webhooksZodContracts } = await import("./webhooks");

    __webhooksZodContracts.siteCompactStatusResponseSchema.parse({
      siteId: "site-1",
      siteStatus: "active",
      latestCrawlRun: {
        id: "crawl-1",
        rawStatus: "failed",
        customerStatus: "failed",
        customerError: {
          id: "crawl:crawl-1",
          area: "crawl",
          severity: "danger",
          code: "crawl_failed",
          titleKey: "dashboard.errors.crawlFailed.title",
        },
      },
      activeTranslationRuns: [],
      currentActivity: [],
      generatedAt: "2026-05-07T00:00:00.000Z",
    });

    __webhooksZodContracts.customerDeploymentHistoryResponseSchema.parse({
      targetLang: "fr",
      entries: [
        {
          rawStatus: "failed",
          customerStatus: "failed",
          titleKey: "dashboard.history.deployment.failed.title",
          customerError: {
            id: "deployment_failed:fr:2026-05-07T00:00:00.000Z",
            area: "deployment",
            severity: "danger",
            code: "deployment_failed",
            titleKey: "dashboard.errors.deploymentFailed.title",
          },
        },
      ],
      pagination: { limit: 10, offset: 0, nextOffset: null },
      generatedAt: "2026-05-07T00:00:00.000Z",
    });

    __webhooksZodContracts.customerErrorSummaryResponseSchema.parse({
      errors: [
        {
          id: "domain_not_verified:domain:example.com",
          area: "domain",
          severity: "warning",
          code: "domain_not_verified",
          titleKey: "dashboard.errors.domainNotVerified.title",
        },
      ],
      pagination: { limit: 10, offset: 0, total: 1, nextOffset: null },
      generatedAt: "2026-05-07T00:00:00.000Z",
    });
  });

  it("rejects dashboard customer payloads with unsupported site statuses", async () => {
    vi.resetModules();
    const { __webhooksZodContracts } = await import("./webhooks");

    const overview = __webhooksZodContracts.siteCustomerOverviewResponseSchema.safeParse({
      meta: {
        view: "overview",
        generatedAt: "2026-05-07T00:00:00.000Z",
        schemaVersion: 1,
      },
      site: {
        id: "site-1",
        sourceUrl: "https://example.com",
        sourceLang: "en",
        status: "paused",
      },
      account: {
        accountId: "acct-1",
        planType: "starter",
        planStatus: "active",
        mutationsAllowed: true,
      },
      health: {
        status: "healthy",
        titleKey: "dashboard.health.healthy.title",
      },
      nextAction: {
        kind: "none",
        priority: 100,
        severity: "none",
        titleKey: "dashboard.nextAction.none.title",
      },
      blockers: [],
      languages: [],
      domains: [],
      pagesSummary: {},
      currentActivity: [],
      errors: [],
      quotas: [],
    });
    expect(overview.success).toBe(false);

    const compact = __webhooksZodContracts.siteCompactStatusResponseSchema.safeParse({
      siteId: "site-1",
      siteStatus: "paused",
      latestCrawlRun: null,
      generatedAt: "2026-05-07T00:00:00.000Z",
    });
    expect(compact.success).toBe(false);
  });

  it("parses managed demo create responses that include showcase-aware site fields", async () => {
    vi.resetModules();
    const { __webhooksZodContracts } = await import("./webhooks");

    const parsed = __webhooksZodContracts.createManagedDemoSiteResponseSchema.parse({
      accountId: "acct-demo",
      site: {
        id: "site-demo",
        accountId: "acct-demo",
        sourceUrl: "https://www.autotrim.com",
        status: "active",
        servingMode: "strict",
        maxLocales: 1,
        siteProfile: null,
        webhookUrl: null,
        webhookSecret: null,
        webhookEvents: ["translation.completed", "translation.failed", "translation.summary"],
        locales: [
          {
            sourceLang: "en",
            targetLang: "fr",
            alias: null,
            serveEnabled: true,
          },
        ],
        routeConfig: null,
        domains: [],
        latestCrawlRun: null,
        customerServingStatus: "needs_domain",
        showcaseServingStatus: "ready",
        showcase: {
          websitePath: "autotrim.com",
          defaultLang: "fr",
          status: "active",
          url: "https://t2.weblingo.app/autotrim.com/fr",
          createdAt: null,
          updatedAt: null,
        },
        crawlStatus: {
          enqueued: true,
        },
      },
      showcase: {
        websitePath: "autotrim.com",
        defaultLang: "fr",
        status: "active",
        url: "https://t2.weblingo.app/autotrim.com/fr",
        createdAt: null,
        updatedAt: null,
      },
    });

    expect(parsed.site.customerServingStatus).toBe("needs_domain");
    expect(parsed.site.showcaseServingStatus).toBe("ready");
    expect(parsed.site.showcase?.websitePath).toBe("autotrim.com");
  });

  it("requires backend preview page state fields in source-selection responses", async () => {
    vi.resetModules();
    const { __webhooksZodContracts } = await import("./webhooks");

    const result = __webhooksZodContracts.sourceSelectionPreviewResponseSchema.safeParse({
      sourceSelection: { rules: [] },
      summary: {
        knownPagesTotal: 1,
        knownPagesIncluded: 1,
        knownPagesExcluded: 0,
        includedByDefault: 1,
        includedByRule: 0,
        excludedByRule: 0,
        notIncludedByRule: 0,
        canonicalizedByRule: 0,
        rulesTotal: 0,
      },
      affectedPages: [
        {
          sourcePath: "/",
          selected: true,
          reason: "included_by_default",
        },
      ],
      pagination: { limit: 100, offset: 0, total: 1, hasMore: false },
      warnings: [],
    });

    expect(result.success).toBe(false);
  });

  it("keeps SiteShowcaseResponse.showcaseServingStatus required and non-null", async () => {
    const spec = readOpenApiSpecFromEnv();
    const openApiSchema = spec.components?.schemas?.SiteShowcaseResponse as
      | {
          required?: string[];
          properties?: Record<string, { nullable?: boolean }>;
        }
      | undefined;
    expect(openApiSchema).toBeTruthy();
    expect(openApiSchema?.required).toContain("showcaseServingStatus");
    expect(openApiSchema?.properties?.showcaseServingStatus?.nullable ?? false).toBe(false);
  });
});
