import type { PreviewErrorCode, PreviewStage } from "./preview-sse";
import {
  isActivePreviewJobPhase,
  isPreviewCapacityRetryHintReason,
  type PreviewRetryHintReason,
} from "./preview-job-machine";
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
  provision_failed: "try.error.provision_failed",
  source_fetch_failed: "try.error.source_fetch_failed",
  translation_failed: "try.error.translation_failed",
  showcase_failed: "try.error.showcase_failed",
  provision_stalled: "try.error.provision_stalled",
  processing_stalled: "try.error.processing_stalled",
  translation_capacity_exhausted: "try.error.translation_capacity_exhausted",
  source_page_too_large: "try.error.source_page_too_large",
  unknown: "try.error.unknown",
};

export const PREVIEW_STATUS_CENTER_STAGE_MESSAGE_KEYS: Record<PreviewStage, string> = {
  fetching_page: "try.stage.fetching_page",
  analyzing_content: "try.stage.analyzing_content",
  translating: "try.stage.translating",
  generating_preview: "try.stage.generating_preview",
  saving: "try.stage.saving",
};

// The marketing status center only mirrors the single active run, so it needs the
// active status/stage copy plus the capacity hints.
export const PREVIEW_STATUS_CENTER_MESSAGE_KEYS: ReadonlyArray<string> = [
  "try.center.capacityHint",
  "try.center.providerCapacityHint",
  "try.stage.analyzing_content",
  "try.stage.fetching_page",
  "try.stage.generating_preview",
  "try.stage.saving",
  "try.stage.translating",
  "try.status.pending",
  "try.status.processing",
  "try.status.restoring",
  "try.status.waitingProviderCapacity",
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
  if (job.status === "waiting_provider_capacity") {
    return t("try.status.waitingProviderCapacity");
  }
  // Only never-verified restored jobs show the restoring copy; jobs that were verified
  // once keep their last known progress copy through transport blips.
  if (
    !job.remoteStatusVerified &&
    job.lastVerifiedAt === null &&
    isActivePreviewJobPhase(job.status)
  ) {
    return t("try.status.restoring");
  }
  if (job.status === "pending") {
    return resolvePreviewStatusCenterStageMessage(job.stage, t) ?? t("try.status.pending");
  }
  if (job.status === "processing") {
    return resolvePreviewStatusCenterStageMessage(job.stage, t) ?? t("try.status.processing");
  }
  if (job.status === "ready") {
    return job.error ?? t("try.status.ready");
  }
  if (job.status === "expired") {
    return t("try.error.preview_expired");
  }
  return resolvePreviewStatusCenterErrorMessage(job, t);
}

export function resolvePreviewStatusCenterCapacityHint(
  job: PreviewStatusCenterJob,
  t: PreviewStatusCenterTranslator,
): string | null {
  if (!job.remoteStatusVerified && job.status !== "waiting_provider_capacity") {
    return null;
  }
  return resolvePreviewCapacityHintMessage(job.retryHint?.reason, t, {
    browser: "try.center.capacityHint",
    provider: "try.center.providerCapacityHint",
  });
}

export function resolvePreviewCapacityHintMessage(
  reason: PreviewRetryHintReason | null | undefined,
  t: PreviewStatusCenterTranslator,
  keys: { browser: string; provider: string },
): string | null {
  if (!isPreviewCapacityRetryHintReason(reason)) {
    return null;
  }
  return t(reason === "provider_capacity_wait" ? keys.provider : keys.browser);
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
