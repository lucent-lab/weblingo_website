export const ANALYTICS_EVENTS = {
  posthogException: "$exception",
  posthogPageView: "$pageview",
  tryFormStarted: "try_form_started",
  tryFormValidated: "try_form_validated",
  tryFormSubmitted: "try_form_submitted",
  previewCreateSucceeded: "preview_create_succeeded",
  previewCreateFailed: "preview_create_failed",
  previewStatusTransition: "preview_status_transition",
  previewReady: "preview_ready",
  previewFailed: "preview_failed",
  previewOpenClicked: "preview_open_clicked",
  previewCopyClicked: "preview_copy_clicked",
  previewEmailSaved: "preview_email_saved",
  previewStatusCenterOpenClicked: "preview_status_center_open_clicked",
  previewStatusCenterDismissed: "preview_status_center_dismissed",
  marketingPageView: "marketing_page_view",
  marketingCtaClicked: "marketing_cta_clicked",
  pricingPageView: "pricing_page_view",
  pricingCtaClicked: "pricing_cta_clicked",
  checkoutSuccessView: "checkout_success_view",
  checkoutCancelView: "checkout_cancel_view",
  checkoutCtaClicked: "checkout_cta_clicked",
  checkoutSessionCreateSucceeded: "checkout_session_create_succeeded",
  checkoutSessionCreateFailed: "checkout_session_create_failed",
  stripeWebhookReceived: "stripe_webhook_received",
  stripeWebhookProcessed: "stripe_webhook_processed",
  authViewed: "auth_viewed",
  authSubmitted: "auth_submitted",
  authSucceeded: "auth_succeeded",
  authFailed: "auth_failed",
  accountIdentified: "account_identified",
  accountClaimStarted: "account_claim_started",
  accountClaimSucceeded: "account_claim_succeeded",
  accountClaimFailed: "account_claim_failed",
  dashboardBootstrapped: "dashboard_bootstrapped",
  workspaceSwitched: "workspace_switched",
  siteDashboardViewed: "site_dashboard_viewed",
  siteCreateStarted: "site_create_started",
  siteCreated: "site_created",
  siteCreateFailed: "site_create_failed",
  onboardingStepCompleted: "onboarding_step_completed",
  domainVerificationStarted: "domain_verification_started",
  domainVerified: "domain_verified",
  domainVerificationFailed: "domain_verification_failed",
  domainProvisioned: "domain_provisioned",
  domainProvisionFailed: "domain_provision_failed",
  domainRefreshRequested: "domain_refresh_requested",
  domainRefreshFailed: "domain_refresh_failed",
  crawlTriggered: "crawl_triggered",
  translationRunStarted: "translation_run_started",
  translationRunCancelled: "translation_run_cancelled",
  translationRunRetried: "translation_run_retried",
  translationRunResumed: "translation_run_resumed",
  sourceSelectionSaved: "source_selection_saved",
  glossaryUpdated: "glossary_updated",
  overrideCreated: "override_created",
  slugPolicyUpdated: "slug_policy_updated",
  localeServingToggled: "locale_serving_toggled",
  siteSettingSaved: "site_setting_saved",
  quotaLimitHit: "quota_limit_hit",
  upgradeCtaClicked: "upgrade_cta_clicked",
  appErrorViewed: "app_error_viewed",
  dashboardErrorRetryClicked: "dashboard_error_retry_clicked",
  analyticsProxyFailed: "analytics_proxy_failed",
  waitlistSignupSaved: "waitlist_signup_saved",
  waitlistSignupFailed: "waitlist_signup_failed",
  contactMessageSubmitted: "contact_message_submitted",
  contactMessageFailed: "contact_message_failed",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsPropertyValue = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;
type SanitizedAnalyticsPropertyValue = Exclude<AnalyticsPropertyValue, null | undefined>;

export const ANALYTICS_SAFE_PROPERTY_NAMES = [
  "account_id",
  "actor_account_id",
  "actor_plan_status",
  "actor_plan_type",
  "actor_role",
  "app_surface",
  "auth_action",
  "auth_method",
  "cadence",
  "checkout_mode",
  "checkout_url_present",
  "crawl_enqueued",
  "crawl_id",
  "cta_id",
  "customer_present",
  "dashboard_acting_as_customer",
  "dashboard_plan_status",
  "dashboard_plan_type",
  "dashboard_route",
  "dashboard_user",
  "dashboard_workspace_audience",
  "deployment_channel",
  "domain_present",
  "domain_host",
  "domain_status",
  "duration_ms",
  "email_present",
  "enqueued_count",
  "environment",
  "error_code",
  "error_digest_present",
  "error_name",
  "error_stage",
  "failure_kind",
  "failure_status",
  "feature",
  "field_layout",
  "form_id",
  "glossary_entry_count",
  "group_type",
  "handled",
  "locale",
  "locales_present",
  "message_present",
  "missing_snapshot_count",
  "outcome",
  "override_context_present",
  "page_path",
  "page_type",
  "plan_id",
  "plan_status",
  "plan_type",
  "preview_id",
  "repo",
  "replay_allowed",
  "replay_sampled",
  "retranslate",
  "retry_hint_reason",
  "route_area",
  "route_template",
  "rule_count",
  "runtime",
  "sampling_rate",
  "segment",
  "selected_count",
  "serve_enabled",
  "serving_status",
  "session_present",
  "site_id",
  "site_status",
  "site_url_present",
  "slug_path_present",
  "source",
  "source_host",
  "source_lang",
  "source_path",
  "source_selection_rule_count",
  "stage",
  "status",
  "stripe_event_type",
  "subject_account_id",
  "subject_plan_status",
  "subject_plan_type",
  "subscription_present",
  "subscription_status",
  "target_host",
  "target_kind",
  "target_lang",
  "target_lang_count",
  "target_locale_count",
  "target_path",
  "variant",
  "workspace_audience",
] as const;

export type AnalyticsSafePropertyName = (typeof ANALYTICS_SAFE_PROPERTY_NAMES)[number];

export const ANALYTICS_FORBIDDEN_PROPERTY_NAMES = [
  "api_key",
  "authorization",
  "body",
  "content",
  "cookie",
  "domain",
  "email",
  "full_name",
  "full_url",
  "glossary",
  "href",
  "html",
  "invite_link",
  "jwt",
  "message",
  "name",
  "password",
  "payload",
  "prompt",
  "provider_payload",
  "raw_url",
  "request",
  "request_body",
  "response",
  "response_body",
  "secret",
  "source_html",
  "source_text",
  "source_url",
  "target_url",
  "text",
  "token",
  "translated_html",
  "translated_text",
  "url",
  "verification_token",
  "work_email",
] as const;

const safeAnalyticsPropertyNameSet = new Set<string>(ANALYTICS_SAFE_PROPERTY_NAMES);
const forbiddenAnalyticsPropertyNameSet = new Set<string>(ANALYTICS_FORBIDDEN_PROPERTY_NAMES);

const SAFE_ANALYTICS_PROPERTY_PATTERNS = [
  /^[a-z][a-z0-9_]*_count$/,
  /^[a-z][a-z0-9_]*_duration_ms$/,
  /^[a-z][a-z0-9_]*_enabled$/,
  /^[a-z][a-z0-9_]*_id$/,
  /^[a-z][a-z0-9_]*_kind$/,
  /^[a-z][a-z0-9_]*_present$/,
  /^[a-z][a-z0-9_]*_role$/,
  /^[a-z][a-z0-9_]*_status$/,
  /^[a-z][a-z0-9_]*_type$/,
] as const;

const EMAIL_VALUE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const SECRET_VALUE_PATTERNS = [
  /\b(?:sk|pk|rk|whsec|phc|supabase|eyJ)[A-Za-z0-9_=-]{12,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/i,
  /\b(?:token|secret|password|api[_-]?key)=/i,
] as const;

export class AnalyticsPropertyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyticsPropertyValidationError";
  }
}

type PreviewAnalyticsInput = {
  locale?: string | null;
  sourceUrl?: string | null;
  sourceLang?: string | null;
  targetLang?: string | null;
  previewId?: string | null;
  status?: string | null;
  stage?: string | null;
  errorCode?: string | null;
  errorStage?: string | null;
  retryHintReason?: string | null;
  fieldLayout?: string | null;
};

type PageAnalyticsInput = {
  locale?: string | null;
  pageType?: string | null;
  pagePath?: string | null;
  routeTemplate?: string | null;
  routeArea?: string | null;
  variant?: string | null;
  segment?: string | null;
  sessionPresent?: boolean | null;
  dashboardRoute?: boolean | null;
};

type CtaAnalyticsInput = PageAnalyticsInput & {
  ctaId?: string | null;
  targetHref?: string | null;
  planId?: string | null;
};

type PublicUrlContext = {
  sourceHost: string | null;
  sourcePath: string | null;
};

type LinkTargetContext = {
  targetKind: string | null;
  targetHost: string | null;
  targetPath: string | null;
};

function normalizeTrimmed(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeSourcePath(pathname: string): string | null {
  const trimmed = pathname.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed;
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function normalizeAnchorTarget(target: string): string | null {
  const trimmed = normalizeTrimmed(target);
  if (!trimmed || !trimmed.startsWith("#")) {
    return null;
  }
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
}

function combinePathWithHash(pathname: string, hash: string): string | null {
  const normalizedPath = normalizeSourcePath(pathname);
  const normalizedHash = normalizeAnchorTarget(hash);

  if (!normalizedPath) {
    return normalizedHash;
  }
  if (!normalizedHash) {
    return normalizedPath;
  }

  return normalizeSourcePath(`${normalizedPath}${normalizedHash}`);
}

function hasForbiddenAnalyticsPropertyName(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (forbiddenAnalyticsPropertyNameSet.has(normalized)) {
    return true;
  }
  return /(^|_)(password|secret|token|cookie|jwt|authorization|prompt|payload|body)$/i.test(
    normalized,
  );
}

function isAllowedAnalyticsPropertyName(key: string): boolean {
  if (safeAnalyticsPropertyNameSet.has(key)) {
    return true;
  }
  return SAFE_ANALYTICS_PROPERTY_PATTERNS.some((pattern) => pattern.test(key));
}

function looksLikeFullUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeQueryBearingPath(value: string): boolean {
  return /^\/[^\s?#]+(?:\/[^\s?#]+)*\?/.test(value);
}

function looksLikeSecretValue(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

export function assertSafeAnalyticsProperty(
  key: string,
  value: SanitizedAnalyticsPropertyValue,
): void {
  if (hasForbiddenAnalyticsPropertyName(key)) {
    throw new AnalyticsPropertyValidationError(
      `Analytics property "${key}" is forbidden because it can carry PII, secrets, raw content, or payload bodies.`,
    );
  }
  if (!isAllowedAnalyticsPropertyName(key)) {
    throw new AnalyticsPropertyValidationError(
      `Analytics property "${key}" is not in the safe allowlist.`,
    );
  }
  if (typeof value !== "string") {
    return;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }
  if (EMAIL_VALUE_PATTERN.test(trimmed)) {
    throw new AnalyticsPropertyValidationError(
      `Analytics property "${key}" contains an email-like value.`,
    );
  }
  if (looksLikeFullUrl(trimmed)) {
    throw new AnalyticsPropertyValidationError(
      `Analytics property "${key}" contains a full URL; use host/path helpers instead.`,
    );
  }
  if (looksLikeQueryBearingPath(trimmed)) {
    throw new AnalyticsPropertyValidationError(
      `Analytics property "${key}" contains a query string.`,
    );
  }
  if (looksLikeSecretValue(trimmed)) {
    throw new AnalyticsPropertyValidationError(
      `Analytics property "${key}" contains a secret-like value.`,
    );
  }
}

export function assertSafeAnalyticsProperties(properties: AnalyticsProperties): void {
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null) {
      continue;
    }
    assertSafeAnalyticsProperty(key, value);
  }
}

export function extractPublicUrlContext(sourceUrl?: string | null): PublicUrlContext {
  const trimmed = normalizeTrimmed(sourceUrl);
  if (!trimmed) {
    return { sourceHost: null, sourcePath: null };
  }

  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
      return { sourceHost: null, sourcePath: null };
    }
    return {
      sourceHost: parsed.hostname.trim().toLowerCase() || null,
      sourcePath: normalizeSourcePath(parsed.pathname || "/"),
    };
  } catch {
    return { sourceHost: null, sourcePath: null };
  }
}

export function extractLinkTargetContext(targetHref?: string | null): LinkTargetContext {
  const trimmed = normalizeTrimmed(targetHref);
  if (!trimmed) {
    return { targetKind: null, targetHost: null, targetPath: null };
  }

  if (trimmed.startsWith("#")) {
    return {
      targetKind: "anchor",
      targetHost: null,
      targetPath: normalizeAnchorTarget(trimmed),
    };
  }

  if (trimmed.startsWith("/")) {
    const parsed = new URL(trimmed, "https://weblingo.app");
    return {
      targetKind: "internal",
      targetHost: null,
      targetPath: combinePathWithHash(parsed.pathname || "/", parsed.hash),
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "mailto:") {
      return {
        targetKind: "mailto",
        targetHost: null,
        targetPath: null,
      };
    }

    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
      return { targetKind: null, targetHost: null, targetPath: null };
    }

    return {
      targetKind: "external",
      targetHost: parsed.hostname.trim().toLowerCase() || null,
      targetPath: combinePathWithHash(parsed.pathname || "/", parsed.hash),
    };
  } catch {
    return { targetKind: null, targetHost: null, targetPath: null };
  }
}

export function sanitizeAnalyticsProperties(
  properties: AnalyticsProperties,
): Record<string, SanitizedAnalyticsPropertyValue> {
  const sanitized: Record<string, SanitizedAnalyticsPropertyValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null) {
      continue;
    }
    assertSafeAnalyticsProperty(key, value);
    sanitized[key] = value;
  }
  return sanitized;
}

export function buildPreviewAnalyticsProperties(
  input: PreviewAnalyticsInput,
): Record<string, SanitizedAnalyticsPropertyValue> {
  const { sourceHost, sourcePath } = extractPublicUrlContext(input.sourceUrl);
  return sanitizeAnalyticsProperties({
    locale: normalizeTrimmed(input.locale),
    source_host: sourceHost,
    source_path: sourcePath,
    source_lang: normalizeTrimmed(input.sourceLang),
    target_lang: normalizeTrimmed(input.targetLang),
    preview_id: normalizeTrimmed(input.previewId),
    status: normalizeTrimmed(input.status),
    stage: normalizeTrimmed(input.stage),
    error_code: normalizeTrimmed(input.errorCode),
    error_stage: normalizeTrimmed(input.errorStage),
    retry_hint_reason: normalizeTrimmed(input.retryHintReason),
    field_layout: normalizeTrimmed(input.fieldLayout),
  });
}

export function buildPageAnalyticsProperties(
  input: PageAnalyticsInput,
): Record<string, SanitizedAnalyticsPropertyValue> {
  return sanitizeAnalyticsProperties({
    dashboard_route: input.dashboardRoute ?? undefined,
    locale: normalizeTrimmed(input.locale),
    page_type: normalizeTrimmed(input.pageType),
    page_path: normalizeSourcePath(input.pagePath ?? ""),
    route_area: normalizeTrimmed(input.routeArea),
    route_template: normalizeSourcePath(input.routeTemplate ?? ""),
    variant: normalizeTrimmed(input.variant),
    segment: normalizeTrimmed(input.segment),
    session_present: input.sessionPresent ?? undefined,
  });
}

export function buildCtaAnalyticsProperties(
  input: CtaAnalyticsInput,
): Record<string, SanitizedAnalyticsPropertyValue> {
  const { targetKind, targetHost, targetPath } = extractLinkTargetContext(input.targetHref);
  return sanitizeAnalyticsProperties({
    ...buildPageAnalyticsProperties(input),
    cta_id: normalizeTrimmed(input.ctaId),
    plan_id: normalizeTrimmed(input.planId),
    target_kind: targetKind,
    target_host: targetHost,
    target_path: targetPath,
  });
}
