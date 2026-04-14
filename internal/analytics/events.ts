export const ANALYTICS_EVENTS = {
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

type PublicUrlContext = {
  sourceHost: string | null;
  sourcePath: string | null;
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
