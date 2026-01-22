export type PreviewErrorCode =
  | "invalid_url"
  | "blocked_host"
  | "dns_failed"
  | "dns_timeout"
  | "page_too_large"
  | "render_failed"
  | "translate_failed"
  | "storage_failed"
  | "config_error"
  | "processing_timeout"
  | "queue_enqueue_failed"
  | "preview_not_found"
  | "preview_expired"
  | "canceled"
  | "unknown";

export type PreviewStage =
  | "fetching_page"
  | "analyzing_content"
  | "translating"
  | "generating_preview"
  | "saving";

const PREVIEW_ERROR_CODES: PreviewErrorCode[] = [
  "invalid_url",
  "blocked_host",
  "dns_failed",
  "dns_timeout",
  "page_too_large",
  "render_failed",
  "translate_failed",
  "storage_failed",
  "config_error",
  "processing_timeout",
  "queue_enqueue_failed",
  "preview_not_found",
  "preview_expired",
  "canceled",
  "unknown",
];

const PREVIEW_STAGES: PreviewStage[] = [
  "fetching_page",
  "analyzing_content",
  "translating",
  "generating_preview",
  "saving",
];

export function isPreviewErrorCode(value: unknown): value is PreviewErrorCode {
  return typeof value === "string" && PREVIEW_ERROR_CODES.includes(value as PreviewErrorCode);
}

export function isPreviewStage(value: unknown): value is PreviewStage {
  return typeof value === "string" && PREVIEW_STAGES.includes(value as PreviewStage);
}

export function hasExplicitFailure(payload: Record<string, unknown>): boolean {
  if (payload.status === "failed") {
    return true;
  }
  if (isPreviewErrorCode(payload.errorCode) || isPreviewStage(payload.errorStage)) {
    return true;
  }
  if (payload.details && typeof payload.details === "object") {
    const details = payload.details as Record<string, unknown>;
    if (isPreviewErrorCode(details.errorCode) || isPreviewStage(details.errorStage)) {
      return true;
    }
  }
  return false;
}
