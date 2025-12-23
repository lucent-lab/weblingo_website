"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createOverride,
  createSite,
  provisionDomain,
  refreshDomain,
  triggerCrawl,
  updateGlossary,
  updateSite,
  updateSlug,
  verifyDomain,
  type GlossaryEntry,
} from "@internal/dashboard/webhooks";
import { requireDashboardAuth, type DashboardAuth } from "@internal/dashboard/auth";

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

function siteRedirect(siteId: string, params: { toast?: string; error?: string }) {
  const base = `/dashboard/sites/${encodeURIComponent(siteId)}`;
  if (params.error) {
    return `${base}?error=${encodeURIComponent(params.error)}`;
  }
  if (params.toast) {
    return `${base}?toast=${encodeURIComponent(params.toast)}`;
  }
  return base;
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

function parseJsonObject(input: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    if (Object.keys(parsed).length === 0) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function validateSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Source URL must start with http:// or https://.";
    }
    return null;
  } catch {
    return "Source URL must be a valid URL.";
  }
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
  const glossaryEntriesRaw = formData.get("glossaryEntries")?.toString().trim() ?? "";

  const uniqueTargets = Array.from(new Set(targetLangs));

  if (!sourceUrl || !sourceLang || uniqueTargets.length === 0 || !subdomainPattern) {
    return failed("Please fill every required field and pick at least one target language.");
  }

  const sourceUrlError = validateSourceUrl(sourceUrl);
  if (sourceUrlError) {
    return failed(sourceUrlError);
  }

  const siteProfile = siteProfileRaw ? parseJsonObject(siteProfileRaw) : null;
  if (siteProfileRaw && !siteProfile) {
    return failed("Site profile must be a non-empty JSON object.");
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
      siteProfile,
      maxLocales,
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

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
    revalidatePath(`/dashboard/sites/${site.id}`);

    return succeeded(toast ?? "Site created and crawl enqueued", {
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

export async function triggerCrawlAction(formData: FormData): Promise<void> {
  const siteId = formData.get("siteId")?.toString();

  if (!siteId) {
    return;
  }

  let nextRedirect: string;

  try {
    const status = await withWebhooksAuth((auth) => triggerCrawl(auth, siteId));
    revalidatePath(`/dashboard/sites/${siteId}`);
    nextRedirect = status.enqueued
      ? siteRedirect(siteId, { toast: "Crawl enqueued." })
      : status.error
        ? siteRedirect(siteId, { error: status.error })
        : siteRedirect(siteId, { toast: "Crawl is already queued." });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] triggerCrawlAction failed:", error);
    nextRedirect = siteRedirect(siteId, {
      error: toFriendlyDashboardActionError(error, "Unable to enqueue a crawl right now."),
    });
  }

  redirect(nextRedirect);
}

export async function verifyDomainAction(formData: FormData): Promise<void> {
  const siteId = formData.get("siteId")?.toString();
  const domain = formData.get("domain")?.toString();
  const overrideToken = formData.get("token")?.toString() || undefined;

  if (!siteId || !domain) {
    return;
  }

  let nextRedirect: string;

  try {
    const { domain: updated } = await withWebhooksAuth((auth) =>
      verifyDomain(auth, siteId, domain, overrideToken),
    );
    revalidatePath(`/dashboard/sites/${siteId}`);
    nextRedirect =
      updated.status === "verified"
        ? siteRedirect(siteId, { toast: `Domain verified: ${domain}.` })
        : updated.status === "pending"
          ? siteRedirect(siteId, { toast: `Domain verification pending: ${domain}.` })
          : siteRedirect(siteId, { error: `Domain verification failed for ${domain}.` });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] verifyDomainAction failed:", error);
    nextRedirect = siteRedirect(siteId, {
      error: toFriendlyDashboardActionError(error, `Unable to verify ${domain} right now.`),
    });
  }

  redirect(nextRedirect);
}

export async function provisionDomainAction(formData: FormData): Promise<void> {
  const siteId = formData.get("siteId")?.toString();
  const domain = formData.get("domain")?.toString();

  if (!siteId || !domain) {
    return;
  }

  let nextRedirect: string;

  try {
    const { domain: updated } = await withWebhooksAuth((auth) =>
      provisionDomain(auth, siteId, domain),
    );
    revalidatePath(`/dashboard/sites/${siteId}`);
    nextRedirect =
      updated.status === "failed"
        ? siteRedirect(siteId, { error: `Provisioning failed for ${domain}.` })
        : siteRedirect(siteId, { toast: `Provisioning requested for ${domain}.` });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] provisionDomainAction failed:", error);
    nextRedirect = siteRedirect(siteId, {
      error: toFriendlyDashboardActionError(error, `Unable to provision ${domain} right now.`),
    });
  }

  redirect(nextRedirect);
}

export async function refreshDomainAction(formData: FormData): Promise<void> {
  const siteId = formData.get("siteId")?.toString();
  const domain = formData.get("domain")?.toString();

  if (!siteId || !domain) {
    return;
  }

  let nextRedirect: string;

  try {
    const { domain: updated } = await withWebhooksAuth((auth) =>
      refreshDomain(auth, siteId, domain),
    );
    revalidatePath(`/dashboard/sites/${siteId}`);
    nextRedirect =
      updated.status === "failed"
        ? siteRedirect(siteId, { error: `Refresh failed for ${domain}.` })
        : siteRedirect(siteId, { toast: `Refresh requested for ${domain}.` });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] refreshDomainAction failed:", error);
    nextRedirect = siteRedirect(siteId, {
      error: toFriendlyDashboardActionError(error, `Unable to refresh ${domain} right now.`),
    });
  }

  redirect(nextRedirect);
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

export async function updateSiteStatusAction(formData: FormData): Promise<void> {
  const siteId = formData.get("siteId")?.toString();
  const status = formData.get("status")?.toString() as "active" | "inactive" | undefined;

  if (!siteId || !status) {
    return;
  }

  if (status !== "active" && status !== "inactive") {
    return;
  }

  let nextRedirect: string;

  try {
    const updated = await withWebhooksAuth((auth) => updateSite(auth, siteId, { status }));
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
    nextRedirect = siteRedirect(siteId, {
      toast: updated.status === "active" ? "Translations activated." : "Translations paused.",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    console.error("[dashboard] updateSiteStatusAction failed:", error);
    nextRedirect = siteRedirect(siteId, {
      error: toFriendlyDashboardActionError(error, "Unable to update site status right now."),
    });
  }

  redirect(nextRedirect);
}
