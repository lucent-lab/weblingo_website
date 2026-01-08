"use server";

import { revalidatePath } from "next/cache";

import {
  createOverride,
  createSite,
  deactivateSite,
  deleteSite,
  cancelTranslationRun,
  provisionDomain,
  refreshDomain,
  resumeTranslationRun,
  setLocaleServing,
  translateSite,
  triggerCrawl,
  triggerPageCrawl,
  updateGlossary,
  updateSite,
  updateSlug,
  verifyDomain,
  WebhooksApiError,
  type GlossaryEntry,
} from "@internal/dashboard/webhooks";
import { invalidateSitesCache } from "@internal/dashboard/data";
import { requireDashboardAuth, type DashboardAuth } from "@internal/dashboard/auth";
import {
  buildSiteSettingsUpdatePayload,
  deriveSiteSettingsAccess,
  parseJsonObject,
  parseLocaleAliases,
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
  const status = issue.status.replace("_", " ");
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
        ? record.targetLangs.map((lang) => lang.toString().trim()).filter(Boolean)
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

    await invalidateSitesCache(auth.webhooksAuth);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
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
      return failed(error.message);
    }
    return failed("Unable to create site right now.");
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
    if (!auth.mutationsAllowed) {
      return failed(formatBillingBlockMessage(auth, "edit site settings"));
    }
    const access = deriveSiteSettingsAccess({
      has: auth.has,
      mutationsAllowed: auth.mutationsAllowed,
    });
    const update = buildSiteSettingsUpdatePayload(formData, access);
    if (!update.ok) {
      return failed(update.error);
    }

    await updateSite(auth.webhooksAuth, siteId, update.payload);

    await invalidateSitesCache(auth.webhooksAuth);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/admin`);

    return succeeded("Site settings saved.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof Error) {
      return failed(error.message);
    }
    return failed("Unable to update site settings.");
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

  try {
    const status = await withWebhooksAuth((auth) =>
      triggerCrawl(auth, siteId, force ? { force } : undefined),
    );
    revalidatePath(`/dashboard/sites/${siteId}`);
    if (status.enqueued) {
      return succeeded("Crawl enqueued.");
    }
    if (status.error) {
      return failed(status.error);
    }
    return succeeded("Crawl is already queued.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] triggerCrawlAction failed:", error);
    return failed(toFriendlyDashboardActionError(error, "Unable to enqueue a crawl right now."));
  }
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

  try {
    const result = await withWebhooksAuth(async (auth) => {
      if (shouldActivate) {
        await updateSite(auth, siteId, { status: "active" });
      }
      return translateSite(auth, siteId, targetLang, { intent: "translate_and_serve" });
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    if (shouldActivate) {
      revalidatePath(`/dashboard/sites/${siteId}/admin`);
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/sites");
    }
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
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] translateAndServeAction failed:", error);
    return failed(
      toTranslateAndServeError(error, "Unable to start translation and serving right now."),
    );
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

  try {
    await withWebhooksAuth((auth) => cancelTranslationRun(auth, siteId, runId));
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/admin`);
    return succeeded("Translation run cancelled.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] cancelTranslationRunAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to cancel the translation run."),
    );
  }
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

  try {
    const result = await withWebhooksAuth((auth) => resumeTranslationRun(auth, siteId, runId));
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/admin`);
    const message = buildResumeToast("resume", result);
    return succeeded(message);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] resumeTranslationRunAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to resume the translation run."),
    );
  }
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

  try {
    const result = await withWebhooksAuth((auth) => resumeTranslationRun(auth, siteId, runId));
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath(`/dashboard/sites/${siteId}/admin`);
    const message = buildResumeToast("retry", result);
    return succeeded(message);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] retryFailedTranslationRunAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to retry failed pages right now."),
    );
  }
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

  try {
    const status = await withWebhooksAuth((auth) => triggerPageCrawl(auth, siteId, pageId));
    revalidatePath(`/dashboard/sites/${siteId}`);
    if (status.enqueued) {
      return succeeded("Page crawl enqueued.");
    }
    if (status.error) {
      return failed(status.error);
    }
    return succeeded("Page crawl is already queued.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] triggerPageCrawlAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to enqueue a page crawl right now."),
    );
  }
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
    const { domain: updated } = await withWebhooksAuth((auth) =>
      verifyDomain(auth, siteId, domain, overrideToken),
    );
    revalidatePath(`/dashboard/sites/${siteId}`);
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
    const { domain: updated } = await withWebhooksAuth((auth) =>
      provisionDomain(auth, siteId, domain),
    );
    revalidatePath(`/dashboard/sites/${siteId}`);
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
    const { domain: updated } = await withWebhooksAuth((auth) =>
      refreshDomain(auth, siteId, domain),
    );
    revalidatePath(`/dashboard/sites/${siteId}`);
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
    const result = await withWebhooksAuth((auth) =>
      updateGlossary(auth, siteId, entries, retranslate),
    );
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
    const result = await withWebhooksAuth((auth) =>
      createOverride(auth, siteId, { segmentId, targetLang, text, contextHashScope }),
    );
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
    const result = await withWebhooksAuth((auth) =>
      updateSlug(auth, siteId, { pageId, lang, path }),
    );
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
      const updated = await updateSite(auth, siteId, { status });
      await invalidateSitesCache(auth);
      return updated;
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
    return succeeded(
      updated.status === "active" ? "Localization reactivated." : "Localization deactivated.",
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] updateSiteStatusAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to update site status right now."),
    );
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
    await withWebhooksAuth((auth) => setLocaleServing(auth, siteId, targetLang, enabled));
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
      await invalidateSitesCache(auth);
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
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

export async function deleteSiteAction(
  _prevState: ActionResponse | undefined,
  formData: FormData,
): Promise<ActionResponse> {
  const siteId = formData.get("siteId")?.toString();
  const confirmation = formData.get("confirmation")?.toString().trim();

  if (!siteId) {
    return failed("Site ID is required.");
  }

  if (confirmation !== "DELETE") {
    return failed("Type DELETE to confirm.");
  }

  try {
    await withWebhooksAuth(async (auth) => {
      await deleteSite(auth, siteId);
      await invalidateSitesCache(auth);
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
    return succeeded("Site deleted.", { redirectTo: "/dashboard/sites" });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] deleteSiteAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to delete this site right now."),
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
      await invalidateSitesCache(auth);
    });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
    return succeeded("Localization enabled.");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] activateSiteAction failed:", error);
    return failed(
      toFriendlyDashboardActionError(error, "Unable to activate this site right now."),
    );
  }
}
