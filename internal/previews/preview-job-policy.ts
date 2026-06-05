import { isPreviewStage, type PreviewStage } from "./preview-sse";

export function buildPreviewJobStatusUrl(previewId: string, statusToken: string): string {
  const token = encodeURIComponent(statusToken);
  return `/api/prospect-showcases/${encodeURIComponent(previewId)}/status?token=${token}`;
}

export function buildPreviewJobStreamUrl(previewId: string, statusToken: string): string {
  const token = encodeURIComponent(statusToken);
  return `/api/prospect-showcases/${encodeURIComponent(previewId)}/stream?token=${token}`;
}

export function resolvePreviewJobPayloadUrl(
  payload: Record<string, unknown> | null,
): string | null {
  return typeof payload?.showcaseUrl === "string" ? payload.showcaseUrl : null;
}

export function resolvePreviewJobPayloadDemoDashboardUrl(
  payload: Record<string, unknown> | null,
): string | null {
  return typeof payload?.demoDashboardUrl === "string" ? payload.demoDashboardUrl : null;
}

export function resolvePreviewJobPayloadExpiresAt(
  payload: Record<string, unknown> | null,
): number | null {
  const raw = payload?.expiresAt;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw !== "string") {
    return null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolvePreviewJobPayloadStage(value: unknown): PreviewStage | null {
  if (isPreviewStage(value)) {
    return value;
  }
  if (value === "accepted" || value === "queued" || value === "validating") {
    return "fetching_page";
  }
  if (value === "creating_demo" || value === "crawling_source") {
    return "analyzing_content";
  }
  if (value === "translating") {
    return "translating";
  }
  if (value === "building_showcase") {
    return "generating_preview";
  }
  return null;
}
