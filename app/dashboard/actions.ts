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
  listTranslationSummaries,
  provisionDomain,
  refreshDomain,
  rerunManagedDemoSiteCrawl,
  resumeTranslationRun,
  setTranslationSummaryPreference,
  setLocaleServing,
  fetchSite,
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
import {
  buildSiteSettingsUpdatePayload,
  deriveSiteSettingsAccess,
  parseJsonObject,
  parseLocaleAliases,
  parseWebhookEvents,
  validateSourceUrl,
} from "@internal/dashboard/site-settings";

import { withWebhooksAuth } from "./_lib/webhooks-token";

export type ActionResponse = {
  ok: boolean;
  message: string;
  meta?: Record<string, unknown>;
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

function isEditableSourceSelectionAction(value: string): value is "include" | "exclude" {
  return sourceSelectionRuleActions.has(value);
}

function toFriendlyDashboardActionError(error: unknown, fallback: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  if (error instanceof Error) {
    const message = error.message.trim();
    if (!message) {
      return fallback;
    }
    if (!isDev && message.includes("NEXT_PUBLIC_WEBHOOKS_API_BASE")) {
      return fallback;
    }
    return isDev ? message : fallback;
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
  const message = toFriendlyDashboardActionError(error, fallback);
  const details = extractSafeErrorDetails(error);
  return { message, details };
}

function extractSafeErrorDetails(error: unknown): string | null {
  if (!(error instanceof WebhooksApiError)) {
    return null;
  }
  return formatCloudflareErrorDetails(error.details);
}

function formatCloudflareErrorDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") {
    return null;
  }
  const payload = details as Record<string, unknown>;
  const parts = [
    ...extractErrorMessages(payload.errors),
    ...extractErrorMessages(payload.messages),
  ];
  const normalized = Array.from(new Set(parts.map((entry) => entry.trim()))).filter(Boolean);
  if (!normalized.length) {
    return null;
  }
  return normalized.map((entry) => truncateText(entry, 200)).join("\n");
}

function extractErrorMessages(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractErrorMessages(entry));
  }
  if (typeof value === "string") {
    return [value];
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code.trim() : "";
    const message = typeof record.message === "string" ? record.message.trim() : "";
    if (code && message) {
      return [`${code}: ${message}`];
    }
    if (message) {
      return [message];
    }
    if (code) {
      return [code];
    }
  }
  return [];
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
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
  mutate: (auth: WebhooksAuthContext) => Promise<T>;
  onSuccess: (result: T) => ActionResponse;
  formatError?: (error: unknown, fallback: string) => string;
}): Promise<ActionResponse> {
  try {
    const result = await withWebhooksAuth(async (auth) => {
      const response = await options.mutate(auth);
      await invalidateDashboardCaches(auth, options.siteId, {
        invalidateSitesList: options.invalidateSitesList,
      });
      return response;
    });
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

    let toast: string | null = null;
    if (
      normalizedGlossary.length > 0 &&
      auth.has({ allFeatures: ["edit", "glossary"] }) &&
      auth.mutationsAllowed
    ) {
      try {
        await updateGlossary(auth.webhooksAuth, site.id, normalizedGlossary, false);
      } catch (error) {
        console.error("[dashboard] createSiteAction glossary update failed:", error);
        toast = "Site created, but glossary entries could not be saved.";
      }
    }

    await invalidateDashboardCaches(auth.webhooksAuth, site.id, {
      invalidateSitesList: true,
    });
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/sites/${site.id}`);

    return succeeded(toast ?? "Site created. Verify domains and activate to start crawling.", {
      siteId: site.id,
      crawlStatus: site.crawlStatus,
      toast: toast ?? undefined,
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
    revalidatePath(`/dashboard/sites/${siteId}/admin`);
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
    revalidatePath(`/dashboard/sites/${siteId}/admin`);
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

    await updateSite(auth.webhooksAuth, siteId, update.payload);

    await invalidateDashboardCaches(auth.webhooksAuth, siteId, {
      invalidateSitesList: true,
    });
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/admin`);

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
    await invalidateDashboardCaches(auth.webhooksAuth, siteId, {
      invalidateSitesList: false,
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/pages`);
    revalidatePath(`/dashboard/sites/${siteId}/source-selection`);

    return succeeded("Source selection saved.", {
      sourceSelection: updated.routeConfig?.sourceSelection ?? sourceSelection,
      routeConfigUpdatedAt: updated.routeConfig?.updatedAt ?? null,
      sourceSelectionFingerprint: updated.routeConfig?.sourceSelectionFingerprint ?? null,
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
    revalidatePaths: [`/dashboard/sites/${siteId}`],
    logLabel: "triggerCrawlAction",
    fallbackError: "Unable to enqueue a crawl right now.",
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
    revalidatePath(`/dashboard/sites/${siteId}/admin`);
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
      ? [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/admin`, "/dashboard"]
      : [`/dashboard/sites/${siteId}`],
    logLabel: "translateAndServeAction",
    fallbackError: "Unable to start translation and serving right now.",
    formatError: toTranslateAndServeError,
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
    const subscription = await withWebhooksAuth(async (auth) =>
      upsertDigestSubscription(auth, {
        email,
        frequency: frequencyRaw as DigestFrequency,
      }),
    );
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
    const preference = await withWebhooksAuth(async (auth) => {
      const response = await setTranslationSummaryPreference(
        auth,
        siteId,
        targetLang,
        frequencyRaw as TranslationSummaryFrequency,
      );
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: false });
      return response;
    });
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
    const summaries = await withWebhooksAuth(async (auth) =>
      listTranslationSummaries(auth, siteId),
    );
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
    const snippets = await withWebhooksAuth(async (auth) =>
      fetchSwitcherSnippets(auth, siteId, {
        ...(relativePath ? { path: relativePath } : {}),
        ...(currentLang ? { currentLang } : {}),
      }),
    );
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
    revalidatePaths: [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/admin`],
    logLabel: "cancelTranslationRunAction",
    fallbackError: "Unable to cancel the translation run.",
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
    revalidatePaths: [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/admin`],
    logLabel: "resumeTranslationRunAction",
    fallbackError: "Unable to resume the translation run.",
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
    revalidatePaths: [`/dashboard/sites/${siteId}`, `/dashboard/sites/${siteId}/admin`],
    logLabel: "retryFailedTranslationRunAction",
    fallbackError: "Unable to retry failed pages right now.",
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
    revalidatePaths: [`/dashboard/sites/${siteId}`],
    logLabel: "triggerPageCrawlAction",
    fallbackError: "Unable to enqueue a page crawl right now.",
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
    const { domain: updated } = await withWebhooksAuth(async (auth) => {
      const result = await verifyDomain(auth, siteId, domain, overrideToken);
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: true });
      return result;
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/admin`);
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
    const { domain: updated } = await withWebhooksAuth(async (auth) => {
      const result = await provisionDomain(auth, siteId, domain);
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: true });
      return result;
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/admin`);
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
    const { domain: updated } = await withWebhooksAuth(async (auth) => {
      const result = await refreshDomain(auth, siteId, domain);
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: true });
      return result;
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/admin`);
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
    const result = await withWebhooksAuth(async (auth) => {
      const response = await updateGlossary(auth, siteId, entries, retranslate);
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: false });
      return response;
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    return succeeded("Glossary saved.", { crawlStatus: result.crawlStatus });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof Error) {
      return failed(error.message);
    }
    return failed("Unable to save glossary.");
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
    await withWebhooksAuth(async (auth) => {
      await upsertConsistencyCpm(auth, siteId, {
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
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: false });
    });
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
    await withWebhooksAuth(async (auth) => {
      await updateConsistencyBlock(auth, siteId, blockId, {
        status: status as "proposed" | "approved" | "frozen",
        mode: mode as "strict" | "prefer",
        members: members.length ? members : undefined,
      });
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: false });
    });
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
    const result = await withWebhooksAuth(async (auth) => {
      const response = await createOverride(auth, siteId, {
        segmentId,
        targetLang,
        text,
        contextHashScope,
      });
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: false });
      return response;
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    return succeeded("Override saved.", { override: result });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof Error) {
      return failed(error.message);
    }
    return failed("Unable to save override.");
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
    const result = await withWebhooksAuth(async (auth) => {
      const response = await updateSlug(auth, siteId, { pageId, lang, path });
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: false });
      return response;
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    return succeeded("Slug saved and crawl enqueued.", { status: result.crawlStatus });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof Error) {
      return failed(error.message);
    }
    return failed("Unable to update slug.");
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
    const updated = await withWebhooksAuth(async (auth) => {
      const updatedSite = await updateSite(auth, siteId, { status });
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: true });
      return updatedSite;
    });
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
    await withWebhooksAuth(async (auth) => {
      await setLocaleServing(auth, siteId, targetLang, enabled);
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: true });
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/admin`);
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
    await withWebhooksAuth(async (auth) => {
      await deactivateSite(auth, siteId);
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: true });
    });
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
    await withWebhooksAuth(async (auth) => {
      await updateSite(auth, siteId, { status: "active" });
      await invalidateDashboardCaches(auth, siteId, { invalidateSitesList: true });
    });
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
