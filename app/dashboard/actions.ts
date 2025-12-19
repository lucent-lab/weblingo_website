"use server";

import { revalidatePath } from "next/cache";

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
import { requireDashboardAuth } from "@internal/dashboard/auth";

import { withWebhooksToken } from "./_lib/webhooks-token";

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

  const uniqueTargets = Array.from(new Set(targetLangs));

  if (!sourceUrl || !sourceLang || uniqueTargets.length === 0 || !subdomainPattern) {
    return failed("Please fill every required field and pick at least one target language.");
  }

  const siteProfile = parseJsonObject(siteProfileRaw || "{}");

  if (!siteProfile) {
    return failed("Site profile must be a non-empty JSON object (brand voice, terminology, etc.).");
  }

  try {
    const auth = await requireDashboardAuth();
    if (!auth.account || !auth.webhooksToken) {
      return failed("Unable to resolve account entitlements.");
    }
    if (!auth.has({ feature: "site_create" })) {
      return failed("Site creation is disabled for this account.");
    }

    const maxLocales = auth.account.featureFlags.maxLocales;

    if (maxLocales !== null && uniqueTargets.length > maxLocales) {
      return failed(`Your plan allows up to ${maxLocales} locale(s) per site.`);
    }

    const site = await createSite(auth.webhooksToken, {
      sourceUrl,
      sourceLang,
      targetLangs: uniqueTargets,
      subdomainPattern,
      siteProfile,
      maxLocales,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
    revalidatePath(`/dashboard/sites/${site.id}`);

    return succeeded("Site created and crawl enqueued", {
      siteId: site.id,
      crawlStatus: site.crawlStatus,
    });
  } catch (error) {
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

  try {
    const status = await withWebhooksToken((token) => triggerCrawl(token, siteId));
    if (status.enqueued) {
      revalidatePath(`/dashboard/sites/${siteId}`);
    }
  } catch (error) {
    console.error("[dashboard] triggerCrawlAction failed:", error);
  }
}

export async function verifyDomainAction(formData: FormData): Promise<void> {
  const siteId = formData.get("siteId")?.toString();
  const domain = formData.get("domain")?.toString();
  const overrideToken = formData.get("token")?.toString() || undefined;

  if (!siteId || !domain) {
    return;
  }

  try {
    await withWebhooksToken((token) => verifyDomain(token, siteId, domain, overrideToken));
    revalidatePath(`/dashboard/sites/${siteId}`);
  } catch (error) {
    console.error("[dashboard] verifyDomainAction failed:", error);
  }
}

export async function provisionDomainAction(formData: FormData): Promise<void> {
  const siteId = formData.get("siteId")?.toString();
  const domain = formData.get("domain")?.toString();

  if (!siteId || !domain) {
    return;
  }

  try {
    await withWebhooksToken((token) => provisionDomain(token, siteId, domain));
    revalidatePath(`/dashboard/sites/${siteId}`);
  } catch (error) {
    console.error("[dashboard] provisionDomainAction failed:", error);
  }
}

export async function refreshDomainAction(formData: FormData): Promise<void> {
  const siteId = formData.get("siteId")?.toString();
  const domain = formData.get("domain")?.toString();

  if (!siteId || !domain) {
    return;
  }

  try {
    await withWebhooksToken((token) => refreshDomain(token, siteId, domain));
    revalidatePath(`/dashboard/sites/${siteId}`);
  } catch (error) {
    console.error("[dashboard] refreshDomainAction failed:", error);
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
    entries = JSON.parse(entriesRaw) as GlossaryEntry[];
  } catch {
    return failed("Glossary entries must be valid JSON.");
  }

  if (!Array.isArray(entries)) {
    return failed("Glossary entries must be an array.");
  }

  const normalized: GlossaryEntry[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      return failed("Glossary entries must be an array of valid entries.");
    }

    const source = typeof entry.source === "string" ? entry.source.trim() : "";
    const target = typeof entry.target === "string" ? entry.target.trim() : "";

    if (!source || !target) {
      return failed("Every glossary entry needs source and target text.");
    }

    const targetLangs =
      entry.targetLangs && Array.isArray(entry.targetLangs)
        ? entry.targetLangs.map((lang) => lang.toString().trim()).filter(Boolean)
        : undefined;

    normalized.push({
      source,
      target,
      matchType:
        typeof entry.matchType === "string" ? entry.matchType.trim() || undefined : undefined,
      targetLangs,
      caseSensitive: entry.caseSensitive === true,
    });
  }

  try {
    const result = await withWebhooksToken((token) =>
      updateGlossary(token, siteId, normalized, retranslate),
    );
    revalidatePath(`/dashboard/sites/${siteId}`);
    return succeeded("Glossary saved.", { crawlStatus: result.crawlStatus });
  } catch (error) {
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
    const result = await withWebhooksToken((token) =>
      createOverride(token, siteId, { segmentId, targetLang, text, contextHashScope }),
    );
    revalidatePath(`/dashboard/sites/${siteId}`);
    return succeeded("Override saved.", { override: result });
  } catch (error) {
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
    const result = await withWebhooksToken((token) =>
      updateSlug(token, siteId, { pageId, lang, path }),
    );
    revalidatePath(`/dashboard/sites/${siteId}`);
    return succeeded("Slug saved and crawl enqueued.", { status: result.crawlStatus });
  } catch (error) {
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

  try {
    await withWebhooksToken((token) => updateSite(token, siteId, { status }));
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sites");
  } catch (error) {
    console.error("[dashboard] updateSiteStatusAction failed:", error);
  }
}
