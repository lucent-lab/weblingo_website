export type SiteSettingsFeature =
  | "edit"
  | "locale_update"
  | "serve"
  | "crawl_capture_mode"
  | "client_runtime_toggle"
  | "translatable_attributes";

export type HasCheck =
  | { feature: SiteSettingsFeature }
  | { allFeatures: readonly SiteSettingsFeature[] };

export const REQUIRED_FIELDS_MESSAGE =
  "Please fill every required field and pick at least one target language.";

export const CRAWL_CAPTURE_MODES = [
  "template_plus_hydrated",
  "template_only",
  "hydrated_only",
] as const;

export type CrawlCaptureMode = (typeof CRAWL_CAPTURE_MODES)[number];

const SPA_REFRESH_FALLBACKS = ["globalOnly", "baseline"] as const;
export type SpaRefreshFallback = (typeof SPA_REFRESH_FALLBACKS)[number];

export type SiteSettingsAccess = {
  billingBlocked: boolean;
  canEditBasics: boolean;
  canEditLocales: boolean;
  canEditServingMode: boolean;
  canEditCrawlCaptureMode: boolean;
  canEditClientRuntime: boolean;
  canEditSpaRefresh: boolean;
  canEditTranslatableAttributes: boolean;
  canEditProfile: boolean;
};

export type SiteSettingsUpdatePayload = Partial<{
  sourceUrl: string;
  targetLangs: string[];
  subdomainPattern: string;
  localeAliases: Record<string, string | null>;
  siteProfile: Record<string, unknown> | null;
  servingMode: "strict" | "tolerant";
  crawlCaptureMode: CrawlCaptureMode;
  clientRuntimeEnabled: boolean;
  translatableAttributes: string[] | null;
  spaRefresh: {
    enabled: boolean;
    missingFallback?: SpaRefreshFallback;
    errorFallback?: SpaRefreshFallback;
    enableSectionScope?: boolean;
  };
}>;

export type SiteSettingsUpdateResult =
  | { ok: true; payload: SiteSettingsUpdatePayload }
  | { ok: false; error: string };

export function deriveSiteSettingsAccess(options: {
  has: (check: HasCheck) => boolean;
  mutationsAllowed: boolean;
}): SiteSettingsAccess {
  const billingBlocked = !options.mutationsAllowed;
  const canEditBasics = options.has({ feature: "edit" }) && !billingBlocked;
  const canEditLocales = options.has({ allFeatures: ["edit", "locale_update"] }) && !billingBlocked;
  const canEditServingMode = options.has({ allFeatures: ["edit", "serve"] }) && !billingBlocked;
  const canEditCrawlCaptureMode =
    options.has({ allFeatures: ["edit", "crawl_capture_mode"] }) && !billingBlocked;
  const canEditClientRuntime =
    options.has({ allFeatures: ["edit", "client_runtime_toggle"] }) && !billingBlocked;
  const canEditSpaRefresh = canEditClientRuntime;
  const canEditTranslatableAttributes =
    options.has({ allFeatures: ["edit", "translatable_attributes"] }) && !billingBlocked;
  const canEditProfile = options.has({ feature: "edit" }) && !billingBlocked;
  return {
    billingBlocked,
    canEditBasics,
    canEditLocales,
    canEditServingMode,
    canEditCrawlCaptureMode,
    canEditClientRuntime,
    canEditSpaRefresh,
    canEditTranslatableAttributes,
    canEditProfile,
  };
}

export function buildSiteSettingsUpdatePayload(
  formData: FormData,
  access: SiteSettingsAccess,
): SiteSettingsUpdateResult {
  const payload: SiteSettingsUpdatePayload = {};
  const hasBasics = formData.has("sourceUrl") || formData.has("subdomainPattern");
  const targetLangs = formData
    .getAll("targetLangs")
    .map((lang) => lang.toString().trim())
    .filter(Boolean);
  const uniqueTargets = Array.from(new Set(targetLangs));
  const hasLocales = targetLangs.length > 0 || formData.has("localeAliases");
  const hasServingMode = formData.has("servingMode");
  const hasCrawlCaptureMode = formData.has("crawlCaptureMode");
  const hasClientRuntime = formData.has("clientRuntimeEnabled");
  const hasSpaRefresh = formData.has("spaRefreshEnabled");
  const hasTranslatableAttributes = formData.has("translatableAttributes");
  const hasProfile = formData.has("siteProfile");

  if (hasBasics && !access.canEditBasics) {
    return { ok: false, error: "Source URL and routing are locked for this account." };
  }
  if (hasLocales && !access.canEditLocales) {
    return { ok: false, error: "Locale updates are locked for this account." };
  }
  if (hasServingMode && !access.canEditServingMode) {
    return { ok: false, error: "Serving mode updates are locked for this account." };
  }
  if (hasCrawlCaptureMode && !access.canEditCrawlCaptureMode) {
    return { ok: false, error: "Crawl capture mode is locked for this account." };
  }
  if (hasClientRuntime && !access.canEditClientRuntime) {
    return { ok: false, error: "Client runtime settings are locked for this account." };
  }
  if (hasSpaRefresh && !access.canEditSpaRefresh) {
    return { ok: false, error: "Client navigation settings are locked for this account." };
  }
  if (hasTranslatableAttributes && !access.canEditTranslatableAttributes) {
    return { ok: false, error: "Attribute translation settings are locked for this account." };
  }
  if (hasProfile && !access.canEditProfile) {
    return { ok: false, error: "Site profile updates are locked for this account." };
  }

  if (hasBasics) {
    const sourceUrl = formData.get("sourceUrl")?.toString().trim() ?? "";
    const subdomainPattern = formData.get("subdomainPattern")?.toString().trim() ?? "";
    if (!sourceUrl || !subdomainPattern) {
      return { ok: false, error: REQUIRED_FIELDS_MESSAGE };
    }
    const sourceUrlError = validateSourceUrl(sourceUrl);
    if (sourceUrlError) {
      return { ok: false, error: sourceUrlError };
    }
    payload.sourceUrl = sourceUrl;
    payload.subdomainPattern = subdomainPattern;
  }

  if (hasLocales) {
    if (uniqueTargets.length === 0) {
      return { ok: false, error: REQUIRED_FIELDS_MESSAGE };
    }
    payload.targetLangs = uniqueTargets;
    const localeAliasesRaw = formData.get("localeAliases")?.toString().trim() ?? "";
    const localeAliases = parseLocaleAliases(localeAliasesRaw, uniqueTargets);
    if (typeof localeAliases === "string") {
      return { ok: false, error: localeAliases };
    }
    if (localeAliases) {
      payload.localeAliases = localeAliases;
    }
  }

  if (hasServingMode) {
    const servingMode = formData.get("servingMode")?.toString().trim() ?? "";
    if (servingMode !== "strict" && servingMode !== "tolerant") {
      return { ok: false, error: "Serving mode must be set to strict or tolerant." };
    }
    payload.servingMode = servingMode;
  }

  if (hasCrawlCaptureMode) {
    const crawlCaptureModeRaw = formData.get("crawlCaptureMode")?.toString().trim() ?? "";
    if (!crawlCaptureModeRaw) {
      return { ok: false, error: "Crawl capture mode must be set to a supported option." };
    }
    if (!CRAWL_CAPTURE_MODES.includes(crawlCaptureModeRaw as CrawlCaptureMode)) {
      return { ok: false, error: "Crawl capture mode must be set to a supported option." };
    }
    payload.crawlCaptureMode = crawlCaptureModeRaw as CrawlCaptureMode;
  }

  if (hasClientRuntime) {
    const clientRuntimeValues = formData
      .getAll("clientRuntimeEnabled")
      .map((value) => value.toString().trim())
      .filter(Boolean);
    if (clientRuntimeValues.length) {
      if (clientRuntimeValues.includes("true")) {
        payload.clientRuntimeEnabled = true;
      } else if (clientRuntimeValues.includes("false")) {
        payload.clientRuntimeEnabled = false;
      } else {
        return { ok: false, error: "Client runtime must be enabled or disabled." };
      }
    }
  }

  if (hasSpaRefresh) {
    const spaRefreshValues = formData
      .getAll("spaRefreshEnabled")
      .map((value) => value.toString().trim())
      .filter(Boolean);
    if (!spaRefreshValues.length) {
      return { ok: false, error: "Client navigation support must be enabled or disabled." };
    }
    let enabled: boolean | null = null;
    if (spaRefreshValues.includes("true")) {
      enabled = true;
    } else if (spaRefreshValues.includes("false")) {
      enabled = false;
    }
    if (enabled === null) {
      return { ok: false, error: "Client navigation support must be enabled or disabled." };
    }
    try {
      const missingFallback = parseSpaRefreshFallback(
        formData.get("spaRefreshMissingFallback"),
        "missingFallback",
      );
      const errorFallback = parseSpaRefreshFallback(
        formData.get("spaRefreshErrorFallback"),
        "errorFallback",
      );
      const enableSectionScope = parseSpaRefreshBoolean(
        formData.get("spaRefreshEnableSectionScope"),
      );
      payload.spaRefresh = {
        enabled,
        missingFallback,
        errorFallback,
        enableSectionScope,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid SPA refresh configuration.";
      return { ok: false, error: message };
    }
  }

  if (hasTranslatableAttributes) {
    const raw = formData.get("translatableAttributes")?.toString() ?? "";
    const parsed = parseAttributeList(raw);
    if (parsed.invalid.length > 0) {
      return {
        ok: false,
        error: "Only data-* and aria-* attributes are allowed.",
      };
    }
    payload.translatableAttributes = parsed.values.length ? parsed.values : null;
  }

  if (hasProfile) {
    const siteProfileRaw = formData.get("siteProfile")?.toString().trim() ?? "";
    const siteProfile = siteProfileRaw ? parseJsonObject(siteProfileRaw) : null;
    if (siteProfileRaw && !siteProfile) {
      return { ok: false, error: "Site profile must be a non-empty JSON object." };
    }
    payload.siteProfile = siteProfile;
  }

  if (!Object.keys(payload).length) {
    return { ok: false, error: "No editable changes submitted." };
  }

  return { ok: true, payload };
}

export function parseJsonObject(input: string): Record<string, unknown> | null {
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

function parseAttributeList(input: string): { values: string[]; invalid: string[] } {
  const values = input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase());
  const invalid = values.filter((value) => !isAllowedAttribute(value));
  return { values, invalid };
}

function isAllowedAttribute(value: string): boolean {
  return value.startsWith("data-") || value.startsWith("aria-");
}

function parseSpaRefreshFallback(
  value: FormDataEntryValue | null,
  context: string,
): SpaRefreshFallback {
  if (!value) {
    return "globalOnly";
  }
  const normalized = value.toString().trim();
  if (SPA_REFRESH_FALLBACKS.includes(normalized as SpaRefreshFallback)) {
    return normalized as SpaRefreshFallback;
  }
  throw new Error(`spaRefresh ${context} must be globalOnly or baseline.`);
}

function parseSpaRefreshBoolean(value: FormDataEntryValue | null): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.toString().trim();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error("spaRefresh enableSectionScope must be true or false.");
}

export function parseLocaleAliases(
  raw: string,
  targetLangs: string[],
): Record<string, string | null> | string | null {
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "Locale aliases must be valid JSON.";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "Locale aliases must be an object.";
  }
  const targetSet = new Set(targetLangs);
  const aliases: Record<string, string | null> = {};
  for (const [lang, value] of Object.entries(parsed)) {
    if (!targetSet.has(lang)) {
      return `Alias provided for unknown language "${lang}".`;
    }
    try {
      aliases[lang] = normalizeLocaleAliasValue(value);
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid alias value.";
    }
  }
  return aliases;
}

export function validateSourceUrl(value: string): string | null {
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

function normalizeLocaleAliasValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Aliases must be strings.");
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 63) {
    throw new Error("Aliases must be 63 characters or fewer.");
  }
  if (trimmed.startsWith("-") || trimmed.endsWith("-")) {
    throw new Error("Aliases cannot start or end with a hyphen.");
  }
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    throw new Error("Aliases must use lowercase letters, numbers, or hyphens.");
  }
  return trimmed;
}
