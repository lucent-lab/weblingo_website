import type { PreviewErrorCode, PreviewStage } from "./preview-sse";
import type { PreviewStatusCenterJob } from "./status-center-store";

export const PREVIEW_STATUS_CENTER_ERROR_MESSAGE_KEYS: Record<PreviewErrorCode, string> = {
  invalid_url: "try.error.invalid_url",
  blocked_host: "try.error.blocked_host",
  dns_failed: "try.error.dns_failed",
  dns_timeout: "try.error.dns_timeout",
  page_too_large: "try.error.page_too_large",
  render_failed: "try.error.render_failed",
  template_decode_failed: "try.error.template_decode_failed",
  waf_blocked: "try.error.waf_blocked",
  translate_failed: "try.error.translate_failed",
  storage_failed: "try.error.storage_failed",
  config_error: "try.error.config_error",
  processing_timeout: "try.error.processing_timeout",
  queue_enqueue_failed: "try.error.queue_enqueue_failed",
  preview_not_found: "try.error.preview_not_found",
  preview_expired: "try.error.preview_expired",
  canceled: "try.error.canceled",
  unknown: "try.error.unknown",
};

export const PREVIEW_STATUS_CENTER_STAGE_MESSAGE_KEYS: Record<PreviewStage, string> = {
  fetching_page: "try.stage.fetching_page",
  analyzing_content: "try.stage.analyzing_content",
  translating: "try.stage.translating",
  generating_preview: "try.stage.generating_preview",
  saving: "try.stage.saving",
};

export const PREVIEW_STATUS_CENTER_MESSAGE_KEYS: ReadonlyArray<string> = [
  "try.center.dismiss",
  "try.center.retryHint",
  "try.error.blocked_host",
  "try.error.canceled",
  "try.error.checkStatusFailed",
  "try.error.config_error",
  "try.error.default",
  "try.error.dns_failed",
  "try.error.dns_timeout",
  "try.error.invalid_url",
  "try.error.page_too_large",
  "try.error.preview_expired",
  "try.error.preview_not_found",
  "try.error.processing_timeout",
  "try.error.queue_enqueue_failed",
  "try.error.render_failed",
  "try.error.storage_failed",
  "try.error.template_decode_failed",
  "try.error.translate_failed",
  "try.error.unknown",
  "try.error.waf_blocked",
  "try.preview.open",
  "try.stage.analyzing_content",
  "try.stage.fetching_page",
  "try.stage.generating_preview",
  "try.stage.saving",
  "try.stage.translating",
  "try.status.pending",
  "try.status.processing",
  "try.status.ready",
];

type PreviewStatusCenterTranslator = (
  key: string,
  fallback?: string,
  replacements?: Record<string, string>,
) => string;

export function resolvePreviewStatusCenterStageMessage(
  stage: PreviewStage | null,
  t: PreviewStatusCenterTranslator,
): string | null {
  if (!stage) {
    return null;
  }
  return t(PREVIEW_STATUS_CENTER_STAGE_MESSAGE_KEYS[stage]);
}

export function resolvePreviewStatusCenterErrorMessage(
  job: PreviewStatusCenterJob,
  t: PreviewStatusCenterTranslator,
): string {
  if (job.errorCode) {
    return t(PREVIEW_STATUS_CENTER_ERROR_MESSAGE_KEYS[job.errorCode]);
  }
  return job.error ?? t("try.error.default");
}

export function resolvePreviewStatusCenterMessage(
  job: PreviewStatusCenterJob,
  t: PreviewStatusCenterTranslator,
): string {
  if (job.status === "pending") {
    return resolvePreviewStatusCenterStageMessage(job.stage, t) ?? t("try.status.pending");
  }
  if (job.status === "processing") {
    return resolvePreviewStatusCenterStageMessage(job.stage, t) ?? t("try.status.processing");
  }
  if (job.status === "ready") {
    return t("try.status.ready");
  }
  if (job.status === "expired") {
    return t("try.error.preview_expired");
  }
  return resolvePreviewStatusCenterErrorMessage(job, t);
}

export function resolvePreviewStatusCenterTextClass(job: PreviewStatusCenterJob): string {
  if (job.status === "ready") {
    return "text-primary";
  }
  if (job.status === "failed" || job.status === "expired") {
    return "text-destructive";
  }
  return "text-foreground";
}
