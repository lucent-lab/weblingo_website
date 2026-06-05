"use server";

import { revalidatePath } from "next/cache";

import {
  createOverride,
  createManagedDemo,
  createSiteShowcase,
  createSite,
  deactivateSite,
  cancelTranslationRun,
  upsertConsistencyCpm,
  updateConsistencyBlock,
  updateSiteShowcase,
  fetchSwitcherSnippets,
  getSiteShowcase,
  listRuntimeRequestObservations,
  listTranslationSummaries,
  provisionDomain,
  refreshDomain,
  rerunManagedDemoSiteCrawl,
  resumeTranslationRun,
  setTranslationSummaryPreference,
  setLocaleServing,
  fetchSite,
  updateRuntimeRequestObservationLifecycle,
  translateSite,
  triggerCrawl,
  triggerCrawlTranslate,
  triggerPageCrawl,
  upsertDigestSubscription,
  updateGlossary,
  updateSite,
  updateSlug,
  verifyDomain,
  WebhooksApiError,
  type DigestFrequency,
  type GlossaryEntry,
  type RuntimeRequestLifecycle,
  type RuntimeRequestPolicyConfig,
  type RuntimeRequestPolicyRule,
  type SourceSelectionConfig,
  type TranslationSummaryFrequency,
} from "@internal/dashboard/webhooks";
import { invalidateSiteDashboardCache, invalidateSitesCache } from "@internal/dashboard/data";
import {
  hasActorInternalOps,
  invalidateDashboardBootstrapCache,
  requireDashboardAuth,
  type DashboardAuth,
  type WebhooksAuthContext,
} from "@internal/dashboard/auth";
import { isDashboardAuthScopedToSite } from "@internal/dashboard/demo-scope";
import { readDashboardErrorCode } from "@internal/dashboard/error-state";
import {
  buildSiteSettingsUpdatePayload,
  deriveSiteSettingsAccess,
  parseJsonObject,
  parseLocaleAliases,
  parseWebhookEvents,
  validateSourceUrl,
} from "@internal/dashboard/site-settings";
import type { WebLingoFeature } from "@internal/dashboard/entitlements";

export type ActionResponse = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
};

type DashboardWebhooksAuth = DashboardAuth & {
  webhooksAuth: WebhooksAuthContext;
};

type DashboardMutationAuth = DashboardWebhooksAuth & {
  account: NonNullable<DashboardAuth["account"]>;
};

type DashboardReadAuth = DashboardWebhooksAuth;

type DashboardMutationGate = {
  actionLabel: string;
  permissionError: string;
  feature?: WebLingoFeature;
  allFeatures?: readonly WebLingoFeature[];
  demo?: {
    siteId: string;
    feature: WebLingoFeature;
    blockedResponse?: ActionResponse;
  };
};

const failed = (message: string, meta?: Record<string, unknown>): ActionResponse => ({
  ok: false,
  message,
  meta,
});

const succeeded = (message: string, meta?: Record<string, unknown>): ActionResponse => ({
  ok: true,
  message,
  meta,
});

const digestFrequencies = new Set<DigestFrequency>(["daily", "weekly", "off"]);
const translationSummaryFrequencies = new Set<TranslationSummaryFrequency>([
  "daily",
  "weekly",
  "off",
]);
const consistencyStatuses = new Set(["proposed", "approved", "frozen"]);
const consistencyBlockModes = new Set(["strict", "prefer"]);
const sourceSelectionRuleActions = new Set(["include", "exclude"]);
const runtimeRequestPolicyActions = new Set(["observe", "deny", "neutralize", "proxy"]);
const runtimeRequestPolicyMethods = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);
const runtimeRequestPolicyCredentials = new Set(["omit", "same_origin", "include"]);
const runtimeRequestPolicyCacheModes = new Set(["no-store", "edge"]);
const runtimeRequestPolicyRedirectScopes = new Set(["same_origin", "same_registrable_domain"]);
const runtimeRequestPolicyConfirmations = new Set([
  "non_get_proxy",
  "credential_forwarding",
  "high_risk_path",
]);
const runtimeRequestLifecycles = new Set(["open", "reviewed", "dismissed", "ignored"]);

function isEditableSourceSelectionAction(value: string): value is "include" | "exclude" {
  return sourceSelectionRuleActions.has(value);
}

function isRuntimeRequestLifecycle(value: string): value is RuntimeRequestLifecycle {
  return runtimeRequestLifecycles.has(value);
}

function toFriendlyDashboardActionError(error: unknown, fallback: string): string {
  if (error instanceof WebhooksApiError) {
    if (error.status === 0) {
      return "Unable to reach the dashboard service. Try again in a moment.";
    }
    if (readDashboardErrorCode(error) === "single_site_account_limit") {
      return "This account already has a website. Open the existing website workspace and use Settings to change the source URL when it changes.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Your session cannot perform this dashboard action.";
    }
    if (error.status === 404) {
      return "The requested dashboard data could not be found.";
    }
    if (error.status === 504) {
      return "The dashboard action timed out. Try again in a moment.";
    }
    if (error.status >= 500) {
      return "The dashboard service is unavailable right now.";
    }
  }
  return fallback;
}

function toTranslateAndServeError(error: unknown, fallback: string): string {
  if (error instanceof WebhooksApiError && error.status === 409) {
    const message = error.message.toLowerCase();
    if (message.includes("snapshot")) {
      return "Snapshots missing or incomplete. Run a crawl first, then try Translate & serve.";
    }
  }
  return toFriendlyDashboardActionError(error, fallback);
}

function toFriendlyDashboardActionErrorWithDetails(
  error: unknown,
  fallback: string,
): { message: string; details?: string | null } {
  return { message: toFriendlyDashboardActionError(error, fallback), details: null };
}

function toFriendlyGlossaryActionError(error: unknown, fallback: string): string {
  if (error instanceof WebhooksApiError) {
    const details = error.details;
    if (details && typeof details === "object" && !Array.isArray(details)) {
      const maxGlossarySources = (details as Record<string, unknown>).maxGlossarySources;
      const uniqueSources = (details as Record<string, unknown>).uniqueSources;
      if (typeof maxGlossarySources === "number" && Number.isFinite(maxGlossarySources)) {
        const attempted =
          typeof uniqueSources === "number" && Number.isFinite(uniqueSources)
            ? ` You tried to save ${uniqueSources}.`
            : "";
        return `This demo allows up to ${maxGlossarySources} glossary source terms.${attempted}`;
      }
    }
  }
  return toFriendlyDashboardActionError(error, fallback);
}

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function formatBillingBlockMessage(auth: DashboardAuth, actionLabel: string): string {
  const issue = auth.billingIssue;
  if (!issue) {
    return `Your plan is not active. Update billing to ${actionLabel}.`;
  }
  const status = issue.status.replaceAll("_", " ");
  if (issue.scope === "actor" && auth.actorAccount?.planType === "agency") {
    return `Agency billing is ${status}. Update billing to ${actionLabel}.`;
  }
  if (issue.scope === "actor") {
    return `Your plan is ${status}. Update billing to ${actionLabel}.`;
  }
  if (auth.actingAsCustomer && auth.actorAccount?.planType === "agency") {
    return `This customer account is ${status}. Update billing to ${actionLabel}.`;
  }
  return `Your plan is ${status}. Update billing to ${actionLabel}.`;
}

async function requireDashboardMutationAuth(
  gate: DashboardMutationGate,
): Promise<{ ok: true; auth: DashboardWebhooksAuth } | { ok: false; response: ActionResponse }> {
  const auth = await requireDashboardAuth();
  if (!auth.webhooksAuth) {
    return { ok: false, response: failed("Unable to resolve account entitlements.") };
  }
  if (auth.accessMode === "demo") {
    if (gate.demo) {
      if (!isDashboardAuthScopedToSite(auth, gate.demo.siteId)) {
        return {
          ok: false,
          response: failed("The requested dashboard data could not be found."),
        };
      }
      if (gate.demo.blockedResponse) {
        return { ok: false, response: gate.demo.blockedResponse };
      }
      if (!auth.has({ feature: gate.demo.feature })) {
        return { ok: false, response: failed(gate.permissionError) };
      }
      return { ok: true, auth: auth as DashboardWebhooksAuth };
    }
    return {
      ok: false,
      response: failed(
        "Demo dashboard access is read-only. Use the activation flow to publish it on your domain.",
      ),
    };
  }
  if (!auth.account) {
    return { ok: false, response: failed("Unable to resolve account entitlements.") };
  }
  if (!auth.mutationsAllowed) {
    return { ok: false, response: failed(formatBillingBlockMessage(auth, gate.actionLabel)) };
  }
  if (gate.feature && !auth.has({ feature: gate.feature })) {
    return { ok: false, response: failed(gate.permissionError) };
  }
  if (gate.allFeatures?.length && !auth.has({ allFeatures: gate.allFeatures })) {
    return { ok: false, response: failed(gate.permissionError) };
  }
  return { ok: true, auth: auth as DashboardMutationAuth };
}

async function requireScopedDashboardReadAuth(
  siteId: string,
): Promise<{ ok: true; auth: DashboardReadAuth } | { ok: false; response: ActionResponse }> {
  const auth = await requireDashboardAuth();
  if (!auth.webhooksAuth) {
    return { ok: false, response: failed("Unable to authenticate dashboard request.") };
  }
  if (!isDashboardAuthScopedToSite(auth, siteId)) {
    return {
      ok: false,
      response: failed("The requested dashboard data could not be found."),
    };
  }
  return { ok: true, auth: auth as DashboardReadAuth };
}

async function invalidateDashboardCaches(
  auth: WebhooksAuthContext,
  siteId: string,
  options: { invalidateSitesList: boolean },
): Promise<void> {
  await invalidateSiteDashboardCache(auth, siteId);
  if (options.invalidateSitesList) {
    await invalidateSitesCache(auth);
  }
}

async function runSiteMutation<T>(options: {
  siteId: string;
  invalidateSitesList: boolean;
  revalidatePaths: string[];
  logLabel: string;
  fallbackError: string;
  gate: DashboardMutationGate;
  mutate: (auth: WebhooksAuthContext) => Promise<T>;
  onSuccess: (result: T) => ActionResponse;
  formatError?: (error: unknown, fallback: string) => string;
}): Promise<ActionResponse> {
  try {
    const mutationAuth = await requireDashboardMutationAuth(options.gate);
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    const result = await (async (auth) => {
      const response = await options.mutate(auth.webhooksAuth);
      await invalidateDashboardCaches(auth.webhooksAuth, options.siteId, {
        invalidateSitesList: options.invalidateSitesList,
      });
      return response;
    })(mutationAuth.auth);
    for (const path of options.revalidatePaths) {
      revalidatePath(path);
    }
    return options.onSuccess(result);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error(`[dashboard] ${options.logLabel} failed:`, error);
    return failed(
      (options.formatError ?? toFriendlyDashboardActionError)(error, options.fallbackError),
    );
  }
}

async function requireInternalAdminWorkspaceAuth(): Promise<WebhooksAuthContext> {
  const auth = await requireDashboardAuth();
  if (!hasActorInternalOps(auth)) {
    throw new Error("Internal admin access is required.");
  }
  const webhooksAuth = auth.actorWebhooksAuth;
  if (!webhooksAuth) {
    throw new Error("Unable to authenticate internal admin actions.");
  }
  return webhooksAuth;
}

function normalizeGlossaryEntries(entries: unknown): GlossaryEntry[] | string {
  if (!Array.isArray(entries)) {
    return "Glossary entries must be an array.";
  }

  const normalized: GlossaryEntry[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      return "Glossary entries must be an array of valid entries.";
    }

    const record = entry as Record<string, unknown>;
    const source = typeof record.source === "string" ? record.source.trim() : "";
    const target = typeof record.target === "string" ? record.target.trim() : "";

    if (!source || !target) {
      return "Every glossary entry needs source and target text.";
    }

    const targetLangs =
      record.targetLangs && Array.isArray(record.targetLangs)
        ? record.targetLangs
            .filter((lang) => lang != null)
            .map((lang) => lang.toString().trim())
            .filter(Boolean)
        : undefined;

    normalized.push({
      source,
      target,
      matchType:
        typeof record.matchType === "string" ? record.matchType.trim() || undefined : undefined,
      targetLangs,
      caseSensitive: record.caseSensitive === true,
      scope: record.scope === "segment" || record.scope === "in_segment" ? record.scope : undefined,
    });
  }

  return normalized;
}

function parseSourceSelectionConfig(
  rawValue: FormDataEntryValue | null,
): SourceSelectionConfig | string {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return "Source selection payload is required.";
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return "Source selection payload must be valid JSON.";
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "Source selection payload must be an object.";
  }

  const rulesValue = (parsed as Record<string, unknown>).rules;
  if (!Array.isArray(rulesValue)) {
    return "Source selection rules must be an array.";
  }

  const rules: SourceSelectionConfig["rules"] = [];
  for (const [index, ruleValue] of rulesValue.entries()) {
    if (!ruleValue || typeof ruleValue !== "object" || Array.isArray(ruleValue)) {
      return `Source selection rule ${index + 1} must be an object.`;
    }
    const record = ruleValue as Record<string, unknown>;
    if (typeof record.action !== "string" || !isEditableSourceSelectionAction(record.action)) {
      return `Source selection rule ${index + 1} must use include or exclude.`;
    }
    if (typeof record.pattern !== "string" || record.pattern.trim().length === 0) {
      return `Source selection rule ${index + 1} needs a path pattern.`;
    }
    rules.push({
      action: record.action,
      pattern: record.pattern.trim(),
    });
  }

  return { rules };
}

function sourceSelectionConfigFingerprint(config: SourceSelectionConfig): string {
  return JSON.stringify({
    rules: config.rules.map((rule) => ({
      action: rule.action,
      pattern: rule.pattern.trim(),
    })),
  });
}

function editableSourceSelectionConfigFromRules(
  rules: readonly SourceSelectionConfig["rules"][number][],
): SourceSelectionConfig {
  return {
    rules: rules.flatMap((rule) => {
      if (!isEditableSourceSelectionAction(rule.action)) {
        return [];
      }
      return [{ action: rule.action, pattern: rule.pattern.trim() }];
    }),
  };
}

function parseRuntimeRequestPolicyConfig(
  rawValue: FormDataEntryValue | null,
): RuntimeRequestPolicyConfig | string {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return "Runtime request policy payload is required.";
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return "Runtime request policy payload must be valid JSON.";
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "Runtime request policy payload must be an object.";
  }
  const record = parsed as Record<string, unknown>;
  const rulesValue = record.rules;
  if (!Array.isArray(rulesValue)) {
    return "Runtime request policy rules must be an array.";
  }
  if (rulesValue.length > 200) {
    return "Runtime request policy supports up to 200 rules.";
  }

  const rules: RuntimeRequestPolicyRule[] = [];
  for (const [index, ruleValue] of rulesValue.entries()) {
    const rule = parseRuntimeRequestPolicyRule(ruleValue, index);
    if (typeof rule === "string") {
      return rule;
    }
    rules.push(rule);
  }
  if (typeof record.enabled !== "boolean") {
    return "Runtime request policy enabled flag is required.";
  }

  return {
    schemaVersion: 1,
    mode: "standard",
    enabled: record.enabled,
    rules,
  };
}

function parseRuntimeRequestPolicyRule(
  value: unknown,
  index: number,
): RuntimeRequestPolicyRule | string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return `Runtime request rule ${index + 1} must be an object.`;
  }
  const record = value as Record<string, unknown>;
  const id = readRuntimePolicyString(record.id, `runtime request rule ${index + 1} id`, 64);
  if (!id.ok) {
    return id.error;
  }
  const name = readRuntimePolicyString(record.name, `runtime request rule ${index + 1} name`, 120);
  if (!name.ok) {
    return name.error;
  }
  const pattern = readRuntimePolicyString(
    record.pattern,
    `runtime request rule ${index + 1} pattern`,
    300,
  );
  if (!pattern.ok) {
    return pattern.error;
  }
  const action = typeof record.action === "string" ? record.action : "";
  if (!runtimeRequestPolicyActions.has(action)) {
    return `Runtime request rule ${index + 1} must use observe, deny, neutralize, or proxy.`;
  }
  const methods = parseRuntimePolicyStringSet(
    record.methods,
    runtimeRequestPolicyMethods,
    `runtime request rule ${index + 1} methods`,
    { allowEmpty: false },
  );
  if (typeof methods === "string") {
    return methods;
  }
  const confirmations = parseRuntimePolicyStringSet(
    record.confirmations,
    runtimeRequestPolicyConfirmations,
    `runtime request rule ${index + 1} confirmations`,
    { allowEmpty: true },
  );
  if (typeof confirmations === "string") {
    return confirmations;
  }
  const neutralization = parseRuntimePolicyNeutralization(record.neutralization);
  if (typeof neutralization === "string") {
    return `Runtime request rule ${index + 1} ${neutralization}`;
  }
  const enabled = readRuntimePolicyBoolean(record.enabled, `runtime request rule ${index + 1}`);
  if (typeof enabled === "string") {
    return enabled;
  }
  const credentials = readRuntimePolicyEnum(
    record.credentials,
    runtimeRequestPolicyCredentials,
    `runtime request rule ${index + 1} credentials`,
  );
  if (!credentials.ok) {
    return credentials.error;
  }
  const cache = readRuntimePolicyEnum(
    record.cache,
    runtimeRequestPolicyCacheModes,
    `runtime request rule ${index + 1} cache`,
  );
  if (!cache.ok) {
    return cache.error;
  }
  const redirectScope = readRuntimePolicyEnum(
    record.redirectScope,
    runtimeRequestPolicyRedirectScopes,
    `runtime request rule ${index + 1} redirect scope`,
  );
  if (!redirectScope.ok) {
    return redirectScope.error;
  }
  const maxBodyBytes = readRuntimePolicyInteger(
    record.maxBodyBytes,
    `runtime request rule ${index + 1} max body bytes`,
    0,
    1_048_576,
  );
  if (typeof maxBodyBytes === "string") {
    return maxBodyBytes;
  }
  const maxResponseBytes = readRuntimePolicyInteger(
    record.maxResponseBytes,
    `runtime request rule ${index + 1} max response bytes`,
    0,
    10_485_760,
  );
  if (typeof maxResponseBytes === "string") {
    return maxResponseBytes;
  }
  const timeoutMs = readRuntimePolicyInteger(
    record.timeoutMs,
    `runtime request rule ${index + 1} timeout ms`,
    1,
    30_000,
  );
  if (typeof timeoutMs === "string") {
    return timeoutMs;
  }
  const requestHeaders = parseRuntimePolicyHeaderPolicy(
    record.requestHeaders,
    `runtime request rule ${index + 1} request headers`,
  );
  if (typeof requestHeaders === "string") {
    return requestHeaders;
  }
  const responseHeaders = parseRuntimePolicyHeaderPolicy(
    record.responseHeaders,
    `runtime request rule ${index + 1} response headers`,
  );
  if (typeof responseHeaders === "string") {
    return responseHeaders;
  }
  const requestContentTypes = parseRuntimePolicyStringArray(
    record.requestContentTypes,
    `runtime request rule ${index + 1} request content types`,
  );
  if (typeof requestContentTypes === "string") {
    return requestContentTypes;
  }
  const responseContentTypes = parseRuntimePolicyStringArray(
    record.responseContentTypes,
    `runtime request rule ${index + 1} response content types`,
  );
  if (typeof responseContentTypes === "string") {
    return responseContentTypes;
  }
  return {
    id: id.value,
    name: name.value,
    enabled,
    pattern: pattern.value,
    methods: methods as RuntimeRequestPolicyRule["methods"],
    action: action as RuntimeRequestPolicyRule["action"],
    credentials: credentials.value as RuntimeRequestPolicyRule["credentials"],
    cache: cache.value as RuntimeRequestPolicyRule["cache"],
    maxBodyBytes,
    maxResponseBytes,
    timeoutMs,
    redirectScope: redirectScope.value as RuntimeRequestPolicyRule["redirectScope"],
    requestHeaders,
    responseHeaders,
    requestContentTypes,
    responseContentTypes,
    neutralization,
    confirmations: confirmations as RuntimeRequestPolicyRule["confirmations"],
  };
}

function readRuntimePolicyString(
  value: unknown,
  label: string,
  maxLength: number,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    return { ok: false, error: `${label} is required.` };
  }
  return { ok: true, value: value.trim() };
}

function parseRuntimePolicyStringSet(
  value: unknown,
  allowed: Set<string>,
  label: string,
  options: { allowEmpty: boolean },
): string[] | string {
  if (!Array.isArray(value)) {
    return `${label} must be an array.`;
  }
  const out = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      return `${label} must contain only strings.`;
    }
    const normalized = entry.trim();
    if (!allowed.has(normalized)) {
      return `${label} contains an unsupported value: ${normalized || "(empty)"}.`;
    }
    out.add(normalized);
  }
  if (!options.allowEmpty && out.size === 0) {
    return `${label} must include at least one value.`;
  }
  return Array.from(out);
}

function parseRuntimePolicyStringArray(value: unknown, label: string): string[] | string {
  if (!Array.isArray(value)) {
    return `${label} must be an array.`;
  }
  if (value.length > 20) {
    return `${label} supports up to 20 values.`;
  }
  const out = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || !entry.trim()) {
      return `${label} must contain only non-empty strings.`;
    }
    out.add(entry.trim().toLowerCase());
  }
  return Array.from(out);
}

function parseRuntimePolicyHeaderPolicy(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return `${label} must be an object.`;
  }
  const allow = parseRuntimePolicyStringArray((value as Record<string, unknown>).allow, label);
  if (typeof allow === "string") {
    return allow;
  }
  return { allow };
}

function readRuntimePolicyBoolean(value: unknown, label: string): boolean | string {
  if (typeof value !== "boolean") {
    return `${label} enabled flag is required.`;
  }
  return value;
}

function readRuntimePolicyEnum(
  value: unknown,
  allowed: Set<string>,
  label: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string" || !allowed.has(value)) {
    return { ok: false, error: `${label} is invalid.` };
  }
  return { ok: true, value };
}

function readRuntimePolicyInteger(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number | string {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return `${label} must be an integer.`;
  }
  if (value < min || value > max) {
    return `${label} must be between ${min} and ${max}.`;
  }
  return value;
}

function parseRuntimePolicyNeutralization(
  value: unknown,
): RuntimeRequestPolicyRule["neutralization"] | string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "neutralization must be an object.";
  }
  const record = value as Record<string, unknown>;
  const shape = record.shape;
  if (shape !== "empty_text" && shape !== "no_content" && shape !== "empty_json") {
    return "neutralization shape is invalid.";
  }
  if (shape === "no_content") {
    if (record.status !== 204 || record.contentType !== null || record.body !== null) {
      return "neutralization no_content payload is invalid.";
    }
    return { shape, status: 204, contentType: null, body: null };
  }
  if (shape === "empty_text") {
    if (
      record.status !== 200 ||
      record.contentType !== "text/plain; charset=utf-8" ||
      record.body !== ""
    ) {
      return "neutralization empty_text payload is invalid.";
    }
    return { shape, status: 200, contentType: "text/plain; charset=utf-8", body: "" };
  }
  if (record.status !== 200 || record.contentType !== "application/json" || record.body !== "{}") {
    return "neutralization empty_json payload is invalid.";
  }
  return { shape, status: 200, contentType: "application/json", body: "{}" };
}

function parseCsvField(rawValue: FormDataEntryValue | null): string[] {
  if (typeof rawValue !== "string") {
    return [];
  }
  const normalized = rawValue
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

export async function createSiteAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const sourceUrl = formData.get("sourceUrl")?.toString().trim() ?? "";
  const sourceLang = formData.get("sourceLang")?.toString().trim() ?? "";
  const targetLangs = formData
    .getAll("targetLangs")
    .map((lang) => lang.toString().trim())
    .filter(Boolean);
  const subdomainPattern = formData.get("subdomainPattern")?.toString().trim() ?? "";
  const siteProfileRaw = formData.get("siteProfile")?.toString().trim() ?? "";
  const localeAliasesRaw = formData.get("localeAliases")?.toString().trim() ?? "";
  const glossaryEntriesRaw = formData.get("glossaryEntries")?.toString().trim() ?? "";
  const servingMode = formData.get("servingMode")?.toString().trim() ?? "";
  const webhookUrlRaw = formData.get("webhookUrl")?.toString().trim() ?? "";
  const webhookSecretRaw = formData.get("webhookSecret")?.toString().trim() ?? "";
  const webhookEventsRaw = formData.get("webhookEvents")?.toString();

  const uniqueTargets = Array.from(new Set(targetLangs));

  if (!sourceUrl || !sourceLang || uniqueTargets.length === 0 || !subdomainPattern) {
    return failed("Please fill every required field and pick at least one target language.");
  }
  if (servingMode !== "strict" && servingMode !== "tolerant") {
    return failed("Serving mode must be set to strict or tolerant.");
  }

  const sourceUrlError = validateSourceUrl(sourceUrl);
  if (sourceUrlError) {
    return failed(sourceUrlError);
  }

  const siteProfile = siteProfileRaw ? parseJsonObject(siteProfileRaw) : null;
  if (siteProfileRaw && !siteProfile) {
    return failed("Site profile must be a non-empty JSON object.");
  }

  const localeAliases = parseLocaleAliases(localeAliasesRaw, uniqueTargets);
  if (typeof localeAliases === "string") {
    return failed(localeAliases);
  }
  const webhookEvents = parseWebhookEvents(webhookEventsRaw);
  if (typeof webhookEvents === "string") {
    return failed(webhookEvents);
  }
  let webhookUrl: string | null = null;
  if (webhookUrlRaw) {
    try {
      const parsedUrl = new URL(webhookUrlRaw);
      if (parsedUrl.protocol !== "https:") {
        return failed("Webhook URL must use https://.");
      }
      webhookUrl = parsedUrl.toString();
    } catch {
      return failed("Webhook URL must be a valid HTTPS URL.");
    }
  }
  const webhookSecret = webhookSecretRaw.length > 0 ? webhookSecretRaw : null;

  let normalizedGlossary: GlossaryEntry[] = [];
  if (glossaryEntriesRaw) {
    try {
      const parsedEntries = JSON.parse(glossaryEntriesRaw) as unknown;
      const normalized = normalizeGlossaryEntries(parsedEntries);
      if (typeof normalized === "string") {
        return failed(normalized);
      }
      normalizedGlossary = normalized;
    } catch {
      return failed("Glossary entries must be valid JSON.");
    }
  }

  try {
    const auth = await requireDashboardAuth();
    if (!auth.account || !auth.webhooksAuth) {
      return failed("Unable to resolve account entitlements.");
    }
    if (!auth.mutationsAllowed) {
      return failed(formatBillingBlockMessage(auth, "create new sites"));
    }
    if (!auth.has({ feature: "site_create" })) {
      return failed("Site creation is disabled for this account.");
    }

    const maxLocales = auth.account.featureFlags.maxLocales;

    if (maxLocales !== null && uniqueTargets.length > maxLocales) {
      return failed(`Your plan allows up to ${maxLocales} target language(s) per site.`);
    }

    const site = await createSite(auth.webhooksAuth, {
      sourceUrl,
      sourceLang,
      targetLangs: uniqueTargets,
      subdomainPattern,
      localeAliases: localeAliases ?? undefined,
      siteProfile,
      maxLocales,
      servingMode,
      webhookUrl,
      webhookSecret,
      webhookEvents,
    });

    if (
      normalizedGlossary.length > 0 &&
      auth.has({ allFeatures: ["edit", "glossary"] }) &&
      auth.mutationsAllowed
    ) {
      try {
        await updateGlossary(auth.webhooksAuth, site.id, normalizedGlossary, false);
      } catch (error) {
        console.error("[dashboard] createSiteAction glossary update failed:", error);
        await invalidateDashboardCaches(auth.webhooksAuth, site.id, {
          invalidateSitesList: true,
        });
        revalidatePath("/dashboard");
        revalidatePath(`/dashboard/sites/${site.id}`);
        return failed("Site was created, but glossary entries could not be saved.", {
          siteId: site.id,
          partialSiteCreated: true,
        });
      }
    }

    await invalidateDashboardCaches(auth.webhooksAuth, site.id, {
      invalidateSitesList: true,
    });
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/sites/${site.id}`);

    return succeeded("Site created. Verify domains and activate to start crawling.", {
      siteId: site.id,
      crawlStatus: site.crawlStatus,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof Error) {
      return failed(toFriendlyDashboardActionError(error, "Unable to create site right now."));
    }
    return failed("Unable to create site right now.");
  }
}

export async function createManagedDemoAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const accountPlan = formData.get("accountPlan")?.toString().trim() ?? "";
  const sourceUrl = formData.get("sourceUrl")?.toString().trim() ?? "";
  const sourceLang = formData.get("sourceLang")?.toString().trim() ?? "";
  const targetLangs = formData
    .getAll("targetLangs")
    .map((lang) => lang.toString().trim())
    .filter(Boolean);
  const subdomainPattern = formData.get("subdomainPattern")?.toString().trim() ?? "";
  const localeAliasesRaw = formData.get("localeAliases")?.toString().trim() ?? "";
  const websitePath = formData.get("websitePath")?.toString().trim() ?? "";
  const defaultLangRaw = formData.get("defaultLang")?.toString().trim() ?? "";

  const uniqueTargets = Array.from(new Set(targetLangs));

  if (!sourceUrl || !sourceLang || uniqueTargets.length === 0 || !subdomainPattern) {
    return failed("Please fill every required field and pick at least one target language.");
  }
  if (accountPlan !== "free" && accountPlan !== "starter" && accountPlan !== "pro") {
    return failed("Managed demo accounts can only start on Free, Starter, or Pro.");
  }

  const sourceUrlError = validateSourceUrl(sourceUrl);
  if (sourceUrlError) {
    return failed(sourceUrlError);
  }
  if (!subdomainPattern.includes("{lang}")) {
    return failed("Generated subdomain pattern is invalid. Check the source URL.");
  }
  const defaultLang = defaultLangRaw || uniqueTargets[0] || "";
  if (!defaultLang || !uniqueTargets.includes(defaultLang)) {
    return failed("Default showcase language must be one of the selected target languages.");
  }
  const localeAliases = parseLocaleAliases(localeAliasesRaw, uniqueTargets);
  if (typeof localeAliases === "string") {
    return failed(localeAliases);
  }

  try {
    const dashboardAuth = await requireDashboardAuth();
    if (!hasActorInternalOps(dashboardAuth)) {
      throw new Error("Internal admin access is required.");
    }
    if (!dashboardAuth.session?.access_token) {
      throw new Error("Unable to read the current dashboard session.");
    }
    const auth = dashboardAuth.actorWebhooksAuth;
    if (!auth) {
      throw new Error("Unable to authenticate internal admin actions.");
    }
    const result = await createManagedDemo(auth, {
      accountPlan,
      site: {
        sourceUrl,
        sourceLang,
        targetLangs: uniqueTargets,
        subdomainPattern,
        ...(localeAliases ? { localeAliases } : {}),
        servingMode: "strict",
        maxLocales: null,
      },
      showcase: {
        ...(websitePath ? { websitePath } : {}),
        defaultLang,
      },
    });
    await invalidateDashboardBootstrapCache(dashboardAuth.session.access_token);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/agency");
    revalidatePath("/dashboard/agency/customers");
    revalidatePath("/dashboard/ops/showcases");
    return succeeded("Managed demo created.", {
      accountId: result.accountId,
      siteId: result.site.id,
      showcaseUrl: result.showcase.url,
      websitePath: result.showcase.websitePath,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] createManagedDemoAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to create the managed demo right now."),
    );
  }
}

export async function createSiteShowcaseAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim() ?? "";
  const websitePath = formData.get("websitePath")?.toString().trim() ?? "";
  const defaultLangRaw = formData.get("defaultLang")?.toString().trim();
  const defaultLang = defaultLangRaw ? defaultLangRaw : null;

  if (!siteId || !websitePath) {
    return failed("Site ID and website path are required.");
  }

  try {
    const auth = await requireInternalAdminWorkspaceAuth();
    const result = await createSiteShowcase(auth, siteId, { websitePath, defaultLang });
    await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: true });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/settings`);
    revalidatePath("/dashboard/ops/showcases");
    return succeeded("Showcase created.", {
      showcaseUrl: result.showcase.url,
      websitePath: result.showcase.websitePath,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] createSiteShowcaseAction failed:", error);
    return failed(toFriendlyDashboardActionError(error, "Unable to create showcase."));
  }
}

export async function updateSiteShowcaseAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim() ?? "";
  const defaultLangValue = formData.get("defaultLang")?.toString().trim();
  const statusValue = formData.get("status")?.toString().trim();

  if (!siteId) {
    return failed("Site ID is required.");
  }
  const payload: { defaultLang?: string | null; status?: "active" | "disabled" } = {};
  if (defaultLangValue !== undefined) {
    payload.defaultLang = defaultLangValue ? defaultLangValue : null;
  }
  if (statusValue) {
    if (statusValue !== "active" && statusValue !== "disabled") {
      return failed("Showcase status must be active or disabled.");
    }
    payload.status = statusValue;
  }
  if (!("defaultLang" in payload) && !payload.status) {
    return failed("Choose a showcase update to apply.");
  }

  try {
    const auth = await requireInternalAdminWorkspaceAuth();
    const existing = await getSiteShowcase(auth, siteId);
    const result = await updateSiteShowcase(auth, siteId, {
      defaultLang: "defaultLang" in payload ? payload.defaultLang : existing.showcase.defaultLang,
      status: payload.status ?? existing.showcase.status,
    });
    await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: true });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/settings`);
    revalidatePath("/dashboard/ops/showcases");
    return succeeded("Showcase updated.", {
      showcaseUrl: result.showcase.url,
      websitePath: result.showcase.websitePath,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] updateSiteShowcaseAction failed:", error);
    return failed(toFriendlyDashboardActionError(error, "Unable to update showcase."));
  }
}

export async function updateSiteSettingsAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  if (!siteId) {
    return failed("Site ID is required.");
  }

  try {
    const auth = await requireDashboardAuth();
    if (!auth.account || !auth.webhooksAuth) {
      return failed("Unable to resolve account entitlements.");
    }
    const access = deriveSiteSettingsAccess({
      has: auth.has,
      mutationsAllowed: auth.mutationsAllowed,
    });
    if (access.billingBlocked) {
      return failed(formatBillingBlockMessage(auth, "edit site settings"));
    }
    const update = buildSiteSettingsUpdatePayload(formData, access);
    if (!update.ok) {
      return failed(update.error);
    }
    if (Object.keys(update.payload).length === 0) {
      return failed("Choose at least one setting to update.");
    }

    await updateSite(auth.webhooksAuth, siteId, update.payload);

    await invalidateDashboardCaches(auth.webhooksAuth, siteId, {
      invalidateSitesList: true,
    });
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/settings`);

    return succeeded("Site settings saved.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof Error) {
      return failed(toFriendlyDashboardActionError(error, "Unable to update site settings."));
    }
    return failed("Unable to update site settings.");
  }
}

export async function updateSourceSelectionAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  if (!siteId) {
    return failed("Site ID is required.");
  }

  const sourceSelection = parseSourceSelectionConfig(formData.get("sourceSelection"));
  if (typeof sourceSelection === "string") {
    return failed(sourceSelection);
  }
  const expectedSourceSelectionFingerprint = formData
    .get("expectedSourceSelectionFingerprint")
    ?.toString();
  const expectedRouteConfigUpdatedAt = formData.get("expectedRouteConfigUpdatedAt")?.toString();

  try {
    const auth = await requireDashboardAuth();
    if (!auth.webhooksAuth) {
      return failed("Unable to authenticate dashboard request.");
    }
    if (!auth.has({ feature: "edit" })) {
      return failed("Source selection editing is not enabled for this account.");
    }
    if (!auth.mutationsAllowed) {
      return failed(formatBillingBlockMessage(auth, "edit source selection"));
    }

    const currentSite = await fetchSite(auth.webhooksAuth, siteId);
    const currentRules = currentSite.routeConfig?.sourceSelection?.rules ?? [];
    if (currentRules.some((rule) => !isEditableSourceSelectionAction(rule.action))) {
      return failed(
        "Source selection contains unsupported rules and cannot be edited from this dashboard.",
      );
    }
    if (expectedSourceSelectionFingerprint) {
      const currentFingerprint = sourceSelectionConfigFingerprint(
        editableSourceSelectionConfigFromRules(currentRules),
      );
      if (currentFingerprint !== expectedSourceSelectionFingerprint) {
        return failed(
          "Source selection changed since this page was loaded. Reload the site, review the latest rules, and preview again before saving.",
          { code: "source_selection_conflict" },
        );
      }
    }
    if (
      expectedRouteConfigUpdatedAt &&
      currentSite.routeConfig?.updatedAt !== expectedRouteConfigUpdatedAt
    ) {
      return failed(
        "Site route settings changed since this page was loaded. Reload the site, review the latest rules, and preview again before saving.",
        { code: "source_selection_conflict" },
      );
    }

    const updated = await updateSite(auth.webhooksAuth, siteId, {
      sourceSelection,
      ...(expectedRouteConfigUpdatedAt ? { expectedRouteConfigUpdatedAt } : {}),
      ...(expectedSourceSelectionFingerprint ? { expectedSourceSelectionFingerprint } : {}),
    });
    const savedRouteConfig = updated.routeConfig;
    if (
      !savedRouteConfig?.sourceSelection ||
      typeof savedRouteConfig.updatedAt !== "string" ||
      typeof savedRouteConfig.sourceSelectionFingerprint !== "string"
    ) {
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, {
        invalidateSitesList: false,
      });
      revalidatePath(`/dashboard/sites/${siteId}`);
      revalidatePath(`/dashboard/sites/${siteId}/source-selection`);
      return failed("Source selection was saved, but the confirmation payload was incomplete.", {
        code: "source_selection_incomplete_response",
      });
    }
    await invalidateDashboardCaches(auth.webhooksAuth, siteId, {
      invalidateSitesList: false,
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/pages`);
    revalidatePath(`/dashboard/sites/${siteId}/source-selection`);

    return succeeded("Source selection saved.", {
      sourceSelection: savedRouteConfig.sourceSelection,
      routeConfigUpdatedAt: savedRouteConfig.updatedAt,
      sourceSelectionFingerprint: savedRouteConfig.sourceSelectionFingerprint,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] updateSourceSelectionAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to update source selection right now."),
    );
  }
}

export async function updateRuntimeRequestPolicyAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  if (!siteId) {
    return failed("Site ID is required.");
  }
  const runtimeRequestPolicy = parseRuntimeRequestPolicyConfig(
    formData.get("runtimeRequestPolicy"),
  );
  if (typeof runtimeRequestPolicy === "string") {
    return failed(runtimeRequestPolicy);
  }
  const expectedRuntimeRequestPolicyFingerprint = formData
    .get("expectedRuntimeRequestPolicyFingerprint")
    ?.toString();

  try {
    const auth = await requireDashboardAuth();
    if (!auth.webhooksAuth) {
      return failed("Unable to authenticate dashboard request.");
    }
    if (!auth.has({ feature: "edit" })) {
      return failed("Runtime request editing is not enabled for this account.");
    }
    if (!auth.mutationsAllowed) {
      return failed(formatBillingBlockMessage(auth, "edit runtime request rules"));
    }

    const updated = await updateSite(auth.webhooksAuth, siteId, {
      runtimeRequestPolicy,
      ...(expectedRuntimeRequestPolicyFingerprint
        ? { expectedRuntimeRequestPolicyFingerprint }
        : {}),
    });
    const savedRouteConfig = updated.routeConfig;
    if (
      !savedRouteConfig?.runtimeRequestPolicy ||
      typeof savedRouteConfig.runtimeRequestPolicyFingerprint !== "string" ||
      typeof savedRouteConfig.runtimeRequestPolicyVersion !== "string"
    ) {
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, {
        invalidateSitesList: false,
      });
      revalidatePath(`/dashboard/sites/${siteId}`);
      revalidatePath(`/dashboard/sites/${siteId}/runtime-requests`);
      return failed(
        "Runtime request policy was saved, but the confirmation payload was incomplete.",
        { code: "runtime_request_policy_incomplete_response" },
      );
    }
    await invalidateDashboardCaches(auth.webhooksAuth, siteId, {
      invalidateSitesList: false,
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/runtime-requests`);

    return succeeded("Runtime request policy saved.", {
      runtimeRequestPolicy: savedRouteConfig.runtimeRequestPolicy,
      runtimeRequestPolicyFingerprint: savedRouteConfig.runtimeRequestPolicyFingerprint,
      runtimeRequestPolicyVersion: savedRouteConfig.runtimeRequestPolicyVersion,
      runtimeRequestPolicyPropagation: savedRouteConfig.runtimeRequestPolicyPropagation ?? null,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] updateRuntimeRequestPolicyAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to update runtime request policy right now."),
    );
  }
}

export async function listRuntimeRequestObservationsAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  if (!siteId) {
    return failed("Site ID is required.");
  }

  try {
    const readAuth = await requireScopedDashboardReadAuth(siteId);
    if (!readAuth.ok) {
      return readAuth.response;
    }

    const response = await listRuntimeRequestObservations(readAuth.auth.webhooksAuth, siteId, {
      limit: 50,
      lifecycle: "all",
      sort: "last_seen_desc",
    });
    return succeeded("Runtime request observations loaded.", { groups: response.groups });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] listRuntimeRequestObservationsAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to load runtime request observations."),
    );
  }
}

export async function updateRuntimeRequestObservationLifecycleAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  const groupingPathHash = formData.get("groupingPathHash")?.toString().trim();
  const method = formData.get("method")?.toString().trim();
  const shapeSignature = formData.get("shapeSignature")?.toString().trim();
  const lifecycleRaw = formData.get("lifecycle")?.toString().trim();
  if (!siteId || !groupingPathHash || !method || !shapeSignature || !lifecycleRaw) {
    return failed("Observation lifecycle payload is incomplete.");
  }
  if (!isRuntimeRequestLifecycle(lifecycleRaw)) {
    return failed("Observation lifecycle is invalid.");
  }

  try {
    const auth = await requireDashboardAuth();
    if (!auth.webhooksAuth) {
      return failed("Unable to authenticate dashboard request.");
    }
    if (!auth.has({ feature: "edit" })) {
      return failed("Runtime request review is not enabled for this account.");
    }
    if (!auth.mutationsAllowed) {
      return failed(formatBillingBlockMessage(auth, "review runtime request observations"));
    }

    const result = await updateRuntimeRequestObservationLifecycle(
      auth.webhooksAuth,
      siteId,
      groupingPathHash,
      { lifecycle: lifecycleRaw, method, shapeSignature },
    );
    revalidatePath(`/dashboard/sites/${siteId}/runtime-requests`);
    return succeeded("Observation updated.", { state: result.state });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] updateRuntimeRequestObservationLifecycleAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to update runtime request observation."),
    );
  }
}

export async function triggerCrawlAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const force = formData.get("force")?.toString() === "true";

  if (!siteId) {
    return failed("Site ID is required.");
  }

  return runSiteMutation({
    siteId,
    invalidateSitesList: false,
    revalidatePaths: [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/pages`],
    logLabel: "triggerCrawlAction",
    fallbackError: "Unable to enqueue a crawl right now.",
    gate: {
      actionLabel: "start crawls",
      permissionError: "Crawl triggering is not enabled for this account.",
      allFeatures: ["edit", "crawl_trigger"],
    },
    mutate: (auth) => triggerCrawl(auth, siteId, force ? { force } : undefined),
    onSuccess: (status) => {
      if (status.enqueued) {
        return succeeded("Crawl enqueued.");
      }
      if (status.error) {
        return failed(status.error);
      }
      return succeeded("Crawl is already queued.");
    },
  });
}

export async function triggerManagedDemoForceCrawlAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();

  if (!siteId) {
    return failed("Site ID is required.");
  }

  try {
    const auth = await requireInternalAdminWorkspaceAuth();
    const result = await rerunManagedDemoSiteCrawl(auth, siteId, { force: true });
    await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: false });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/pages`);
    revalidatePath(`/dashboard/sites/${siteId}/history`);
    if (result.crawlStatus.enqueued) {
      return succeeded(
        result.targetLangs.length > 0
          ? `Forced pipeline refresh enqueued for ${result.targetLangs.length} locale${result.targetLangs.length === 1 ? "" : "s"}.`
          : "Forced crawl enqueued.",
      );
    }
    if (result.crawlStatus.error) {
      return failed(result.crawlStatus.error);
    }
    return succeeded("Forced crawl is already queued.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] triggerManagedDemoForceCrawlAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(
        error,
        "Unable to enqueue a forced pipeline refresh right now.",
      ),
    );
  }
}

export async function triggerCrawlTranslateAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  const targetLangs = parseCsvField(formData.get("targetLangs"));
  const pageIds = parseCsvField(formData.get("pageIds"));
  const sourcePaths = parseCsvField(formData.get("sourcePaths"));
  const force = formData.get("force")?.toString() === "true";

  if (!siteId) {
    return failed("Site ID is required.");
  }
  if (targetLangs.length === 0) {
    return failed("At least one target language is required.");
  }

  return runSiteMutation({
    siteId,
    invalidateSitesList: false,
    revalidatePaths: [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/pages`],
    logLabel: "triggerCrawlTranslateAction",
    fallbackError: "Unable to queue crawl + translate right now.",
    gate: {
      actionLabel: "queue crawl and translation",
      permissionError: "Crawl and translation triggering is not enabled for this account.",
      allFeatures: ["edit", "crawl_trigger"],
    },
    mutate: (auth) =>
      triggerCrawlTranslate(auth, siteId, {
        targetLangs,
        ...(pageIds.length ? { pageIds } : {}),
        ...(sourcePaths.length ? { sourcePaths } : {}),
        ...(force ? { force: true } : {}),
      }),
    onSuccess: (result) =>
      succeeded(
        `Crawl + translate queued (${result.enqueuedCount}/${result.selectedCount} pages).`,
        {
          crawlId: result.crawlId,
          selectedCount: result.selectedCount,
          enqueuedCount: result.enqueuedCount,
        },
      ),
  });
}

export async function translateAndServeAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const siteStatus = formData.get("siteStatus")?.toString();
  const targetLang = formData.get("targetLang")?.toString();

  if (!siteId || !targetLang) {
    return failed("Site ID and target language are required.");
  }

  const shouldActivate = siteStatus === "inactive";

  return runSiteMutation({
    siteId,
    invalidateSitesList: shouldActivate,
    revalidatePaths: shouldActivate
      ? [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/domains`, "/dashboard"]
      : [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/domains`],
    logLabel: "translateAndServeAction",
    fallbackError: "Unable to start translation and serving right now.",
    formatError: toTranslateAndServeError,
    gate: {
      actionLabel: "start translation and serving",
      permissionError: "Translation and serving is not enabled for this account.",
      allFeatures: ["edit", "crawl_trigger", "serve"],
    },
    mutate: async (auth) => {
      if (shouldActivate) {
        await updateSite(auth, siteId, { status: "active" });
      }
      return translateSite(auth, siteId, targetLang, {
        intent: "translate_and_serve",
      });
    },
    onSuccess: (result) => {
      const activationPrefix = shouldActivate ? "Localization enabled. " : "";
      const crawlEnqueued = Boolean(result.crawlEnqueued);
      const missingSnapshots = result.missingSnapshots ?? 0;
      const runStarted = Boolean(result.run);
      let toast = "Translation run started.";
      if (!runStarted && crawlEnqueued) {
        toast = "Crawl queued. Translation will start once snapshots are ready.";
      } else if (runStarted && crawlEnqueued && missingSnapshots > 0) {
        toast = "Translation started for available snapshots. Crawl queued for missing pages.";
      }
      return succeeded(`${activationPrefix}${toast}`);
    },
  });
}

export async function upsertDigestSubscriptionAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  const email = formData.get("email")?.toString().trim();
  const frequencyRaw = formData.get("frequency")?.toString().trim();

  if (!email) {
    return failed("Digest email is required.");
  }
  if (!frequencyRaw || !digestFrequencies.has(frequencyRaw as DigestFrequency)) {
    return failed("Digest frequency must be daily, weekly, or off.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "update digest notifications",
      permissionError: "Digest notification settings are not enabled for this account.",
      feature: "edit",
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    const subscription = await (async (auth) =>
      upsertDigestSubscription(auth.webhooksAuth, {
        email,
        frequency: frequencyRaw as DigestFrequency,
      }))(mutationAuth.auth);
    revalidatePath("/dashboard");
    if (siteId) {
      revalidatePath(`/dashboard/sites/${siteId}`);
    }
    return succeeded(
      subscription.frequency === "off"
        ? "Digest notifications disabled."
        : `Digest subscription set to ${subscription.frequency}.`,
      { subscription },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] upsertDigestSubscriptionAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to update digest subscription right now."),
    );
  }
}

export async function setTranslationSummaryPreferenceAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  const targetLang = formData.get("targetLang")?.toString().trim();
  const frequencyRaw = formData.get("frequency")?.toString().trim();

  if (!siteId || !targetLang) {
    return failed("Site ID and target language are required.");
  }
  if (
    !frequencyRaw ||
    !translationSummaryFrequencies.has(frequencyRaw as TranslationSummaryFrequency)
  ) {
    return failed("Translation summary frequency must be daily, weekly, or off.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "update translation summary notifications",
      permissionError: "Translation summary settings are not enabled for this account.",
      feature: "edit",
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    const preference = await (async (auth) => {
      const response = await setTranslationSummaryPreference(
        auth.webhooksAuth,
        siteId,
        targetLang,
        frequencyRaw as TranslationSummaryFrequency,
      );
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: false });
      return response;
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}`);
    return succeeded(`Summary notifications for ${targetLang} set to ${preference.frequency}.`, {
      preference,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] setTranslationSummaryPreferenceAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(
        error,
        "Unable to update translation summary settings right now.",
      ),
    );
  }
}

export async function listTranslationSummariesAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  if (!siteId) {
    return failed("Site ID is required.");
  }

  try {
    const readAuth = await requireScopedDashboardReadAuth(siteId);
    if (!readAuth.ok) {
      return readAuth.response;
    }
    const summaries = await listTranslationSummaries(readAuth.auth.webhooksAuth, siteId);
    return succeeded(`Loaded ${summaries.length} translation summary record(s).`, {
      summaries,
      summaryCount: summaries.length,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] listTranslationSummariesAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to fetch translation summaries right now."),
    );
  }
}

export async function fetchSwitcherSnippetsAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  const relativePath = formData.get("path")?.toString().trim();
  const currentLang = formData.get("currentLang")?.toString().trim();

  if (!siteId) {
    return failed("Site ID is required.");
  }

  try {
    const readAuth = await requireScopedDashboardReadAuth(siteId);
    if (!readAuth.ok) {
      return readAuth.response;
    }
    const snippets = await fetchSwitcherSnippets(readAuth.auth.webhooksAuth, siteId, {
      ...(relativePath ? { path: relativePath } : {}),
      ...(currentLang ? { currentLang } : {}),
    });
    return succeeded(
      `Loaded ${snippets.snippets.length} switcher snippet template(s) for ${snippets.path}.`,
      {
        marker: snippets.marker,
        fallbackIds: snippets.fallbackIds,
        snippetCount: snippets.snippets.length,
        snippets: snippets.snippets,
      },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] fetchSwitcherSnippetsAction failed:", error);
    return failed(toFriendlyDashboardActionError(error, "Unable to fetch switcher snippets."));
  }
}

export async function cancelTranslationRunAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const runId = formData.get("runId")?.toString();

  if (!siteId || !runId) {
    return failed("Site ID and run ID are required.");
  }

  return runSiteMutation({
    siteId,
    invalidateSitesList: false,
    revalidatePaths: [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/history`],
    logLabel: "cancelTranslationRunAction",
    fallbackError: "Unable to cancel the translation run.",
    gate: {
      actionLabel: "manage translation runs",
      permissionError: "Translation run management is not enabled for this account.",
      allFeatures: ["edit", "crawl_trigger"],
    },
    mutate: (auth) => cancelTranslationRun(auth, siteId, runId),
    onSuccess: () => succeeded("Translation run cancelled."),
  });
}

function buildResumeToast(
  mode: "resume" | "retry",
  result: { enqueued?: number; enqueuedTranslate?: number; enqueuedRender?: number },
): string {
  const enqueuedTranslate = result.enqueuedTranslate ?? 0;
  const enqueuedRender = result.enqueuedRender ?? 0;
  const total = result.enqueued ?? enqueuedTranslate + enqueuedRender;
  if (total <= 0) {
    return mode === "resume" ? "Translation resumed." : "Retrying failed pages.";
  }
  if (enqueuedRender > 0 && enqueuedTranslate === 0) {
    const prefix = mode === "resume" ? "Rendering resumed." : "Retrying rendering.";
    return `${prefix} ${total} page${total === 1 ? "" : "s"} re-queued.`;
  }
  if (enqueuedTranslate > 0 && enqueuedRender === 0) {
    const prefix = mode === "resume" ? "Translation resumed." : "Retrying translation.";
    return `${prefix} ${total} page${total === 1 ? "" : "s"} re-queued.`;
  }
  const prefix = mode === "resume" ? "Pipeline resumed." : "Retrying pipeline.";
  return `${prefix} ${total} page${total === 1 ? "" : "s"} re-queued (${enqueuedTranslate} translate / ${enqueuedRender} render).`;
}

export async function resumeTranslationRunAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const runId = formData.get("runId")?.toString();

  if (!siteId || !runId) {
    return failed("Site ID and run ID are required.");
  }

  return runSiteMutation({
    siteId,
    invalidateSitesList: false,
    revalidatePaths: [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/history`],
    logLabel: "resumeTranslationRunAction",
    fallbackError: "Unable to resume the translation run.",
    gate: {
      actionLabel: "manage translation runs",
      permissionError: "Translation run management is not enabled for this account.",
      allFeatures: ["edit", "crawl_trigger"],
    },
    mutate: (auth) => resumeTranslationRun(auth, siteId, runId),
    onSuccess: (result) => succeeded(buildResumeToast("resume", result)),
  });
}

export async function retryFailedTranslationRunAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const runId = formData.get("runId")?.toString();

  if (!siteId || !runId) {
    return failed("Site ID and run ID are required.");
  }

  return runSiteMutation({
    siteId,
    invalidateSitesList: false,
    revalidatePaths: [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/history`],
    logLabel: "retryFailedTranslationRunAction",
    fallbackError: "Unable to retry failed pages right now.",
    gate: {
      actionLabel: "manage translation runs",
      permissionError: "Translation run management is not enabled for this account.",
      allFeatures: ["edit", "crawl_trigger"],
    },
    mutate: (auth) => resumeTranslationRun(auth, siteId, runId),
    onSuccess: (result) => succeeded(buildResumeToast("retry", result)),
  });
}

export async function triggerPageCrawlAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const pageId = formData.get("pageId")?.toString();

  if (!siteId || !pageId) {
    return failed("Site ID and page ID are required.");
  }

  return runSiteMutation({
    siteId,
    invalidateSitesList: false,
    revalidatePaths: [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/pages`],
    logLabel: "triggerPageCrawlAction",
    fallbackError: "Unable to enqueue a page crawl right now.",
    gate: {
      actionLabel: "start page crawls",
      permissionError: "Page crawl triggering is not enabled for this account.",
      allFeatures: ["edit", "crawl_trigger"],
    },
    mutate: (auth) => triggerPageCrawl(auth, siteId, pageId),
    onSuccess: (status) => {
      if (status.enqueued) {
        return succeeded("Page crawl enqueued.");
      }
      if (status.error) {
        return failed(status.error);
      }
      return succeeded("Page crawl is already queued.");
    },
  });
}

export async function verifyDomainAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const domain = formData.get("domain")?.toString();
  const siteStatus = formData.get("siteStatus")?.toString();
  const overrideToken = formData.get("token")?.toString() || undefined;

  if (!siteId || !domain) {
    return failed("Site ID and domain are required.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "verify domains",
      permissionError: "Domain verification is not enabled for this account.",
      allFeatures: ["edit", "domain_verify"],
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    const { domain: updated } = await (async (auth) => {
      const result = await verifyDomain(auth.webhooksAuth, siteId, domain, overrideToken);
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: true });
      return result;
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/domains`);
    const verifiedToast =
      siteStatus === "inactive"
        ? `Domain verified: ${domain}. Activate the site to start crawling.`
        : `Domain verified: ${domain}. Crawl enqueued.`;
    if (updated.status === "verified") {
      return succeeded(verifiedToast);
    }
    if (updated.status === "pending") {
      return succeeded(`Domain verification pending: ${domain}.`);
    }
    return failed(`Domain verification failed for ${domain}.`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] verifyDomainAction failed:", error);
    const friendly = toFriendlyDashboardActionErrorWithDetails(
      error,
      `Unable to verify ${domain} right now.`,
    );
    const detailsSuffix = friendly.details ? ` ${friendly.details}` : "";
    return failed(`${friendly.message}${detailsSuffix}`.trim());
  }
}

export async function provisionDomainAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const domain = formData.get("domain")?.toString();
  const siteStatus = formData.get("siteStatus")?.toString();

  if (!siteId || !domain) {
    return failed("Site ID and domain are required.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "provision domains",
      permissionError: "Domain provisioning is not enabled for this account.",
      allFeatures: ["edit", "domain_verify"],
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    const { domain: updated } = await (async (auth) => {
      const result = await provisionDomain(auth.webhooksAuth, siteId, domain);
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: true });
      return result;
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/domains`);
    const verifiedToast =
      siteStatus === "inactive"
        ? `Domain verified: ${domain}. Activate the site to start crawling.`
        : `Domain verified: ${domain}. Crawl enqueued.`;
    if (updated.status === "failed") {
      return failed(`Provisioning failed for ${domain}.`);
    }
    if (updated.status === "verified") {
      return succeeded(verifiedToast);
    }
    return succeeded(`Provisioning requested for ${domain}.`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] provisionDomainAction failed:", error);
    const friendly = toFriendlyDashboardActionErrorWithDetails(
      error,
      `Unable to provision ${domain} right now.`,
    );
    const detailsSuffix = friendly.details ? ` ${friendly.details}` : "";
    return failed(`${friendly.message}${detailsSuffix}`.trim());
  }
}

export async function refreshDomainAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const domain = formData.get("domain")?.toString();
  const siteStatus = formData.get("siteStatus")?.toString();

  if (!siteId || !domain) {
    return failed("Site ID and domain are required.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "refresh domain status",
      permissionError: "Domain status refresh is not enabled for this account.",
      allFeatures: ["edit", "domain_verify"],
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    const { domain: updated } = await (async (auth) => {
      const result = await refreshDomain(auth.webhooksAuth, siteId, domain);
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: true });
      return result;
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/domains`);
    const verifiedToast =
      siteStatus === "inactive"
        ? `Domain verified: ${domain}. Activate the site to start crawling.`
        : `Domain verified: ${domain}. Crawl enqueued.`;
    if (updated.status === "failed") {
      return failed(`Refresh failed for ${domain}.`);
    }
    if (updated.status === "verified") {
      return succeeded(verifiedToast);
    }
    return succeeded(`Refresh requested for ${domain}.`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] refreshDomainAction failed:", error);
    const friendly = toFriendlyDashboardActionErrorWithDetails(
      error,
      `Unable to refresh ${domain} right now.`,
    );
    const detailsSuffix = friendly.details ? ` ${friendly.details}` : "";
    return failed(`${friendly.message}${detailsSuffix}`.trim());
  }
}

export async function updateGlossaryAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const entriesRaw = formData.get("entries")?.toString();
  const retranslate = formData.get("retranslate") === "true";

  if (!siteId || !entriesRaw) {
    return failed("Glossary update is missing data.");
  }

  let entries: GlossaryEntry[];

  try {
    const parsedEntries = JSON.parse(entriesRaw) as unknown;
    const normalized = normalizeGlossaryEntries(parsedEntries);
    if (typeof normalized === "string") {
      return failed(normalized);
    }
    entries = normalized;
  } catch {
    return failed("Glossary entries must be valid JSON.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "manage glossary entries",
      permissionError: "Glossary editing is not enabled for this account.",
      allFeatures: ["edit", "glossary"],
      demo: {
        siteId,
        feature: "glossary",
        blockedResponse: retranslate
          ? failed("Demo glossary edits cannot trigger retranslation.")
          : undefined,
      },
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    const result = await updateGlossary(
      mutationAuth.auth.webhooksAuth,
      siteId,
      entries,
      retranslate,
    );
    await invalidateDashboardCaches(mutationAuth.auth.webhooksAuth, siteId, {
      invalidateSitesList: false,
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/overrides`);
    revalidatePath(`/dashboard/sites/${siteId}/quality`);
    return succeeded("Glossary saved.", { crawlStatus: result.crawlStatus });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return failed(toFriendlyGlossaryActionError(error, "Unable to save glossary."));
  }
}

export async function upsertConsistencyCpmEntryAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  const sourceLangRaw = formData.get("sourceLang")?.toString().trim();
  const targetLang = formData.get("targetLang")?.toString().trim();
  const contentId = formData.get("contentId")?.toString().trim();
  const targetText = formData.get("targetText")?.toString().trim();
  const status = formData.get("status")?.toString().trim().toLowerCase();
  const scope = formData.get("scope")?.toString().trim();

  if (!siteId || !targetLang || !contentId || !targetText || !status) {
    return failed("Canonical phrase update is missing required fields.");
  }
  if (!consistencyStatuses.has(status)) {
    return failed("Status must be one of proposed, approved, or frozen.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "manage consistency governance",
      permissionError: "Consistency governance editing is not enabled for this account.",
      feature: "edit",
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    await (async (auth) => {
      await upsertConsistencyCpm(auth.webhooksAuth, siteId, {
        targetLang,
        sourceLang: sourceLangRaw || undefined,
        entries: [
          {
            contentId,
            targetText,
            status: status as "proposed" | "approved" | "frozen",
            scope: scope || undefined,
          },
        ],
      });
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: false });
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}/overrides`);
    return succeeded("Canonical phrase updated.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return failed(toFriendlyDashboardActionError(error, "Unable to update canonical phrase."));
  }
}

export async function updateConsistencyBlockAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  const blockId = formData.get("blockId")?.toString().trim();
  const status = formData.get("status")?.toString().trim().toLowerCase();
  const mode = formData.get("mode")?.toString().trim().toLowerCase();
  const membersCsv = formData.get("membersCsv")?.toString() ?? "";

  if (!siteId || !blockId || !status || !mode) {
    return failed("Block update is missing required fields.");
  }
  if (!consistencyStatuses.has(status)) {
    return failed("Status must be one of proposed, approved, or frozen.");
  }
  if (!consistencyBlockModes.has(mode)) {
    return failed("Mode must be strict or prefer.");
  }

  const members = membersCsv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "manage consistency governance",
      permissionError: "Consistency governance editing is not enabled for this account.",
      feature: "edit",
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    await (async (auth) => {
      await updateConsistencyBlock(auth.webhooksAuth, siteId, blockId, {
        status: status as "proposed" | "approved" | "frozen",
        mode: mode as "strict" | "prefer",
        members: members.length ? members : undefined,
      });
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: false });
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}/overrides`);
    return succeeded("Consistency block updated.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return failed(toFriendlyDashboardActionError(error, "Unable to update consistency block."));
  }
}

export async function createOverrideAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  const segmentId = formData.get("segmentId")?.toString().trim();
  const targetLang = formData.get("targetLang")?.toString().trim();
  const text = formData.get("text")?.toString().trim();
  const contextHashScopeRaw = formData.get("contextHashScope")?.toString().trim();
  const contextHashScope = contextHashScopeRaw ? contextHashScopeRaw : null;

  if (!siteId || !segmentId || !targetLang || !text) {
    return failed("Override requires segment, target language, and text.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "manage manual overrides",
      permissionError: "Manual overrides are not enabled for this account.",
      allFeatures: ["edit", "overrides"],
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    const result = await (async (auth) => {
      const response = await createOverride(auth.webhooksAuth, siteId, {
        segmentId,
        targetLang,
        text,
        contextHashScope,
      });
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: false });
      return response;
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/overrides`);
    revalidatePath(`/dashboard/sites/${siteId}/quality`);
    return succeeded("Override saved.", { override: result });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return failed(toFriendlyDashboardActionError(error, "Unable to save override."));
  }
}

export async function updateSlugAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString().trim();
  const pageId = formData.get("pageId")?.toString().trim();
  const lang = formData.get("lang")?.toString().trim();
  const path = formData.get("path")?.toString().trim();

  if (!siteId || !pageId || !lang || !path) {
    return failed("Slug updates require page, language, and path.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "manage localized slugs",
      permissionError: "Localized slug editing is not enabled for this account.",
      allFeatures: ["edit", "slug_edit"],
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    const result = await (async (auth) => {
      const response = await updateSlug(auth.webhooksAuth, siteId, { pageId, lang, path });
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: false });
      return response;
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/overrides`);
    revalidatePath(`/dashboard/sites/${siteId}/quality`);
    return succeeded("Slug saved and crawl enqueued.", { status: result.crawlStatus });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return failed(toFriendlyDashboardActionError(error, "Unable to update slug."));
  }
}

export async function updateSiteStatusAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const status = formData.get("status")?.toString() as "active" | "inactive" | undefined;

  if (!siteId || !status) {
    return failed("Site ID and status are required.");
  }

  if (status !== "active" && status !== "inactive") {
    return failed("Status must be active or inactive.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: status === "active" ? "enable localization" : "pause localization",
      permissionError: "Site status changes are not enabled for this account.",
      feature: "edit",
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    const updated = await (async (auth) => {
      const updatedSite = await updateSite(auth.webhooksAuth, siteId, { status });
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: true });
      return updatedSite;
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard");
    return succeeded(
      updated.status === "active" ? "Localization reactivated." : "Localization deactivated.",
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] updateSiteStatusAction failed:", error);
    return failed(toFriendlyDashboardActionError(error, "Unable to update site status right now."));
  }
}

export async function setLocaleServingAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const targetLang = formData.get("targetLang")?.toString();
  const enabledRaw = formData.get("enabled")?.toString();

  if (!siteId || !targetLang || !enabledRaw) {
    return failed("Site ID, target language, and enabled flag are required.");
  }

  if (enabledRaw !== "true" && enabledRaw !== "false") {
    return failed("Enabled must be true or false.");
  }

  const enabled = enabledRaw === "true";

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "update serving settings",
      permissionError: "Serving controls are not enabled for this account.",
      allFeatures: ["edit", "serve"],
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    await (async (auth) => {
      await setLocaleServing(auth.webhooksAuth, siteId, targetLang, enabled);
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: true });
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/domains`);
    revalidatePath(`/dashboard/sites/${siteId}/pages`);
    return succeeded(enabled ? "Serving enabled." : "Serving disabled.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] setLocaleServingAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to update serving settings right now."),
    );
  }
}

export async function deactivateSiteAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();

  if (!siteId) {
    return failed("Site ID is required.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "pause localization",
      permissionError: "Site status changes are not enabled for this account.",
      feature: "edit",
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    await (async (auth) => {
      await deactivateSite(auth.webhooksAuth, siteId);
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: true });
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard");
    return succeeded("Localization paused. You can re-enable it anytime from this page.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] deactivateSiteAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to deactivate this site right now."),
    );
  }
}

export async function activateSiteAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();

  if (!siteId) {
    return failed("Site ID is required.");
  }

  try {
    const mutationAuth = await requireDashboardMutationAuth({
      actionLabel: "enable localization",
      permissionError: "Site status changes are not enabled for this account.",
      feature: "edit",
    });
    if (!mutationAuth.ok) {
      return mutationAuth.response;
    }
    await (async (auth) => {
      await updateSite(auth.webhooksAuth, siteId, { status: "active" });
      await invalidateDashboardCaches(auth.webhooksAuth, siteId, { invalidateSitesList: true });
    })(mutationAuth.auth);
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard");
    return succeeded("Localization enabled.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] activateSiteAction failed:", error);
    return failed(toFriendlyDashboardActionError(error, "Unable to activate this site right now."));
  }
}
