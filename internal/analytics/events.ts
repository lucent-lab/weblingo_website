export const ANALYTICS_EVENTS = {
  posthogPageView: "$pageview",
  tryFormStarted: "try_form_started",
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
  waitlistSignupSaved: "waitlist_signup_saved",
  waitlistSignupFailed: "waitlist_signup_failed",
  contactMessageSubmitted: "contact_message_submitted",
  contactMessageFailed: "contact_message_failed",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsPropertyValue = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;
type SanitizedAnalyticsPropertyValue = Exclude<AnalyticsPropertyValue, null | undefined>;

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
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined && value !== null),
  ) as Record<string, SanitizedAnalyticsPropertyValue>;
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
